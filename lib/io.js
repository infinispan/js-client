'use strict';

(function() {

  var _ = require('underscore');
  var events = require('events');
  var fs = require('fs');
  var net = require('net');

  var tls = require('tls');
  var util = require('util');

  var f = require('./functional');
  var u = require('./utils');
  var codec = require('./codec');

  module.exports = transport;

  var DEFAULT_CLUSTER_NAME = '___DEFAULT-CLUSTER___';

  /**
   * Formats an array of connections as a display string.
   * @param {Array} conns - Array of connection objects.
   * @returns {string} Bracketed comma-separated string of connections.
   */
  function showArrayConnections(conns) {
    return ['[', _.map(conns, function(c) { return c.toString(); }).join(','), ']'].join('');
  }

  var Connection = function(addr, transport, listeners) {
    var id = _.uniqueId('conn_');
    var logger = u.logger(`${transport.getId()  }_${  id}`);
    var sock = new net.Socket();
    var replayable = u.replayableBuffer();
    /** @returns {string} Formatted address string. */
    function show() { return u.showAddress(addr); }

    /**
     * Creates a callback for the socket connect event.
     * @param {Function} fulfill - Promise resolve function.
     * @param {Object} conn - The connection object.
     * @returns {Function} Connect event handler.
     */
    function onConnect(fulfill, conn) {
      return function() {
        logger.debugf('Connected to %s', show());
        fulfill(conn);
      };
    }

    /**
     * Creates a callback for socket error events.
     * @param {Function} reject - Promise reject function.
     * @returns {Function} Error event handler.
     */
    function onError(reject) {
      return function(err) {
        logger.error('Error from %s: %s', show(), err.message);
        reject(err);
        transport.retryRpcs(addr); // retry RPCs in case of error
      };
    }

    /**
     * Handles the socket end (disconnect) event.
     * @returns {void}
     */
    function onEnd() {
      logger.debugf('Disconnected from %s', show());
      // TODO: Try retrying on disconnect when socket.end is invoked
      // Can't wrap 'end' event callback in promise when socket end invoked,
      // so retries might happen while puts are happening after a manual switch,
      // which causes races so try to do the retries after invoking socket.end
      // instead and fulfill when those have been retried
      // transport.retryRpcs(addr); // retry RPCs in case of disconnect
    }

    /**
     * Rewinds the replayable buffer when a response is incomplete.
     * @returns {void}
     */
    function rewind() {
      logger.tracef('Incomplete response or event, rewind buffer and wait more data');
      replayable.rewind();
    }

    /**
     * Trims the replayable buffer after a successful decode.
     * @param {Object} header - Decoded message header.
     * @param {Object} bytebuf - Buffer with current read offset.
     * @returns {void}
     */
    function trim(header, bytebuf) {
      logger.tracef('After decoding request(msgId=%d), buffer size is %d, and offset %d',
                    header.msgId, bytebuf.buf.length, bytebuf.offset);
      replayable.trim(bytebuf);
    }

    /**
     * Waits for topology installation before completing the RPC, if needed.
     * @param {Object} rpc - The pending RPC with success/fail callbacks.
     * @param {Object} header - Decoded response header.
     * @param {boolean} isError - Whether the response is an error.
     * @param {Promise|undefined} topology - Pending topology update promise.
     * @param {Object} body - Decoded response body.
     * @returns {void}
     */
    function waitTopologyThenCompleteRpc(rpc, header, isError, topology, body) {
      if (header.hasNewTopology) {
        // If new topology is received, rpc needs to be
        // completed after new topology has been installed
        topology.then(function() {
          completeRpc(rpc, header, isError, topology, body);
        });
      } else {
        completeRpc(rpc, header, isError, topology, body);
      }
    }

    /**
     * Completes an RPC by invoking its success or failure callback.
     * @param {Object} rpc - The pending RPC with success/fail callbacks.
     * @param {Object} header - Decoded response header.
     * @param {boolean} isError - Whether the response is an error.
     * @param {Promise|undefined} topology - Pending topology update promise.
     * @param {Object} body - Decoded response body.
     * @returns {void}
     */
    function completeRpc(rpc, header, isError, topology, body) {
      logger.tracel(function() { return [
        'Complete %s for request(msgId=%d) with %s',
        isError ? 'failure' : 'success', header.msgId, u.str(body.result)]; });

      if (isError)
        rpc.fail(body.result);
      else
        rpc.success(body.result);

      transport.removeRpc(header.msgId);
    }

    /**
     * Handles incoming socket data by decoding headers, topologies, events, and RPC bodies.
     * @param {Buffer} data - Raw data received from the socket.
     * @returns {void}
     */
    function onData(data) {
      if (!f.existy(replayable))
        replayable = u.replayableBuffer();

      replayable.append(data);
      var canDecodeMore = true;
      var protocol = transport.getProtocol();
      while (!replayable.isEmpty() && canDecodeMore) {
        var bytebuf = replayable.mark();

        var h = protocol.decodeHeader(bytebuf);
        canDecodeMore = h.continue;
        if (canDecodeMore) {
          var header = h.result;
          var topology = header.hasNewTopology
              ? transport.updateTopology(bytebuf)
              : undefined;

          var isTopologyComplete = header.hasNewTopology && f.existy(topology);

          canDecodeMore = !header.hasNewTopology || isTopologyComplete;

          if (canDecodeMore) {
            if (protocol.isEvent(header)) {
              canDecodeMore = protocol.decodeEvent(header, bytebuf, listeners);
            } else {
              if (protocol.isError(header)) {
                canDecodeMore = decodeError(header, bytebuf, topology);
              } else {
                canDecodeMore = decodeRpcBody(header, bytebuf, topology);
              }
            }

            if (!canDecodeMore)
              rewind(); // Incomplete event or body, rewind
            else
              trim(header, bytebuf); // Trim buffer after reading event or body
          } else {
            rewind(); // Incomplete topology, rewind
          }
        } else {
          rewind();  // Incomplete header, rewind
        }
      }

      if (replayable.isEmpty()) // If empty, nullify to avoid leaks
        replayable = null;
    }

    /**
     * Decodes an error response and completes the associated RPC.
     * @param {Object} header - Decoded response header.
     * @param {Object} bytebuf - Buffer to decode from.
     * @param {Promise|undefined} topology - Pending topology update promise.
     * @returns {boolean} Whether decoding can continue.
     */
    function decodeError(header, bytebuf, topology) {
      var protocol = transport.getProtocol();
      var body = protocol.decodeError(header, bytebuf);
      var canDecodeMore = body.continue;
      if (body.continue) {
        var rpc = transport.findRpc(header.msgId);
        if (f.existy(rpc)) {
          waitTopologyThenCompleteRpc(rpc, header, true, topology, body);
        } else {
          logger.error('Error received but rpc not found for (msgId=%d)', header.msgId);
        }
      }
      return canDecodeMore;
    }

    /**
     * Decodes a successful RPC response body and completes the associated RPC.
     * @param {Object} header - Decoded response header.
     * @param {Object} bytebuf - Buffer to decode from.
     * @param {Promise|undefined} topology - Pending topology update promise.
     * @returns {boolean} Whether decoding can continue.
     */
    function decodeRpcBody(header, bytebuf, topology) {
      var protocol = transport.getProtocol();
      var rpc = transport.findRpc(header.msgId);
      if (f.existy(rpc)) {
        var body = protocol.decodeBody(rpc.decoder, header, bytebuf, conn);
        var canDecodeMore = body.continue;
        if (body.continue)
          waitTopologyThenCompleteRpc(rpc, header, false, topology, body);

        return canDecodeMore;
      } else {
        logger.error('Rpc not found for (msgId=%d)', header.msgId);
        return true;
      }
    }

    /**
     * Builds TLS socket options from SSL configuration.
     * @param {Object} sslOpts - SSL options including certificates and protocols.
     * @param {Function} reject - Promise reject function for validation errors.
     * @returns {Object} TLS connection options.
     */
    function sslSocketOpts(sslOpts, reject) {
      var options = {};

      options.ca = _.map(sslOpts.trustCerts, function (cert) {
        return fs.readFileSync(cert);
      });

      options = sslClientAuthOpts(options, sslOpts.clientAuth);
      options = sslCryptoStoreOpts(options, sslOpts.cryptoStore, reject);

      options.secureProtocol = sslOpts.secureProtocol;
      options.servername = sslOpts.sniHostName;

      return options;
    }

    /**
     * Adds client authentication options to the TLS options.
     * @param {Object} options - Existing TLS options.
     * @param {Object} authOpts - Client auth config with key, cert, and passphrase.
     * @returns {Object} Updated TLS options.
     */
    function sslClientAuthOpts(options, authOpts) {
      if (f.existy(authOpts)) {
        options.key = readFileIfExists(authOpts, 'key');
        options.cert = readFileIfExists(authOpts, 'cert');
        options.passphrase = authOpts.passphrase;
      }
      return options;
    }

    /**
     * Adds PKCS#12 crypto store options to the TLS options.
     * @param {Object} options - Existing TLS options.
     * @param {Object} storeOpts - Crypto store config with path and passphrase.
     * @param {Function} reject - Promise reject function for validation errors.
     * @returns {Object} Updated TLS options.
     */
    function sslCryptoStoreOpts(options, storeOpts, reject) {
      if (f.existy(storeOpts)) {
        if (!f.existy(storeOpts.path))
          reject(new Error('No path defined for crypto store'));

        if (!f.existy(storeOpts.passphrase))
          reject(new Error('No passphrase defined for crypto store'));

        options.pfx = fs.readFileSync(storeOpts.path);
        options.passphrase = storeOpts.passphrase;
      }
      return options;
    }

    /**
     * Reads a file specified by a property on the parent object, if defined.
     * @param {Object} parent - Object containing the file path property.
     * @param {string} opt - Property name whose value is the file path.
     * @returns {Buffer|undefined} File contents or undefined.
     */
    function readFileIfExists(parent, opt) {
      return f.existy(parent[opt])
        ? fs.readFileSync(parent[opt])
        : undefined;
    }

    /**
     * Connects via a plain (non-TLS) TCP socket.
     * @param {Function} fulfill - Promise resolve function.
     * @param {Object} conn - The connection object.
     * @returns {Object} The socket instance.
     */
    function connectPlainSocket(fulfill, conn) {
      return sock.connect(addr.port, addr.host, onConnect(fulfill, conn));
    }

    /**
     * Connects via a TLS-encrypted socket.
     * @param {Function} fulfill - Promise resolve function.
     * @param {Function} reject - Promise reject function.
     * @param {Object} conn - The connection object.
     * @returns {Object} The TLS socket instance.
     */
    function connectSslSocket(fulfill, reject, conn) {
      var sslOpts = transport.sslOpts();
      var options = sslSocketOpts(sslOpts, reject);
      var localSock = tls.connect(addr.port, addr.host, options, function() {
        logger.debugf('Connecting via SSL to %s, socket is %s, server name is: `%s`', show(),
                      localSock.authorized ? 'authorized' : 'unauthorized',
                      localSock.servername);
        fulfill(conn);
      });
      return localSock;
    }

    var conn = {
      connect: function() {
        return new Promise(function (fulfill, reject) {
          logger.debugf('Connecting to %s', show());

          var sslOpts = transport.sslOpts();
          sock = sslOpts.enabled
            ? connectSslSocket(fulfill, reject, conn)
            : connectPlainSocket(fulfill, conn);

          sock.on('error', onError(reject));
          sock.on('end', onEnd);
          sock.on('data', onData);
        });
      },
      disconnect: function() {
        return new Promise(function (fulfill, reject) {
          logger.debugf('Called disconnect on %s', show());
          sock.end();
          fulfill();
        });
      },
      write: function(buffer) {
        return new Promise(function (fulfill, reject) {
          var flushed = sock.write(buffer, err => {
            if (err) {
              logger.error('Error writing to socket: %s', err);
              transport.retryRpcs(addr); // retry RPCs in case of error
            }
            fulfill();
          });
          if (!flushed)
            logger.debugf('Buffer write not fully flushed, part of of data queued for: %s',
              buffer.toString('hex').toUpperCase());
        });

      },
      getAddress: function() {
        return addr;
      },
      toString: function() {
        return `${show()  }@${  id}`;
      }
    };
    return conn;
  };

  var ConsistentHashRouter = function(logger, topologyId, conns, segments, clusterName) {
    var i = 0;
    var mh3 = u.murmurHash3();

    /**
     * Finds connections not present in the given address list.
     * @param {Array} addrs - Array of server addresses to check against.
     * @returns {Array} Connections missing from the address list.
     */
    function filterNot(addrs) {
      var missing = _.filter(conns, function(c) {
        return !_.where(addrs, c.getAddress()).length > 0;
      });
      logger.debugl(function() {
        return ['Removed servers are: %s', showArrayConnections(missing)]; });
      return missing;
    }

    /**
     * Returns the next connection using round-robin selection.
     * @returns {Object} The next connection in rotation.
     */
    function getConnectionRoundRobin() {
      var conn = conns[i++];
      if (i >= conns.length) i = 0;
      return conn;
    }

    /**
     * Finds a connection whose address has not been tried yet.
     * @param {Array} triedAddrs - Array of already-tried addresses.
     * @returns {Object|undefined} An untried connection, or undefined.
     */
    function findConnectionUntried(triedAddrs) {
      return _.find(conns, function(c) {
        return !_.contains(triedAddrs, c.getAddress());
      });
    }

    /**
     * Computes the size of each hash segment.
     * @param {number} numSegments - Total number of segments.
     * @returns {number} The size of each segment.
     */
    function getSegmentSize(numSegments) {
      return Math.abs(Math.ceil((1 << 31) / numSegments));
    }

    /**
     * Computes a non-negative MurmurHash3 hash for the given buffer.
     * @param {Buffer} buf - The buffer to hash.
     * @returns {number} Non-negative 32-bit hash value.
     */
    function getNormalizedHash(buf) {
      // make sure no negative numbers are involved.
      var hash = mh3.hash(buf);
      return hash & 0x7FFFFFFF;
    }

    /**
     * Encodes a key to its byte representation using the protocol codec.
     * @param {string|Object} k - The cache key to encode.
     * @param {Object} protocol - The Hot Rod protocol instance.
     * @returns {Buffer} Encoded key bytes.
     */
    function keyToBytes(k, protocol) {
      var ctx = u.context(32);
      f.actions([protocol.encodeMediaKey(k)], codec.bytesEncoded)(ctx);
      return f.actions([codec.decodeVariableBytes()], codec.lastDecoded)({buf: ctx.buf, offset: 0});
    }

    /**
     * Finds the connection matching the given address.
     * @param {Object} addr - Server address with host and port.
     * @returns {Object|undefined} The matching connection, or undefined.
     */
    function addrToConn(addr) {
      return _.find(conns, function(con) {
        return _.isEqual(con.getAddress(), addr);
      });
    }

    return {
      getTopologyId: function() { return topologyId; },
      getConnection: function(k, protocol) {
        return f.existy(k)
            ? addrToConn(this.findOwners(k, protocol)[0])
            : getConnectionRoundRobin();
      },
      findConnection: function(triedAddrs) {
        return findConnectionUntried(triedAddrs);
      },
      getAddresses: function() {
        return _.map(conns, function (conn) { return conn.getAddress(); });
      },
      filter: function(addrs) {
        return _.filter(conns, function(conn) {
          return _.where(addrs, conn.getAddress()).length > 0;
        });
      },
      getMissingConnections: function(topology) {
        return filterNot(topology.servers);
      },
      disconnect: function(missing) {
        var connections = f.existy(missing) ? missing : conns;
        logger.debugf('Disconnect all router connections: %s', showArrayConnections(connections));
        var disconnects = _.map(connections, function(c) { return c.disconnect(); });
        return Promise.all(disconnects);
      },
      findOwners: function(k, protocol) {
        var keyBytes = keyToBytes(k, protocol);
        var segmentSize = getSegmentSize(segments.length);
        var hash = getNormalizedHash(keyBytes);
        var segmentId = Math.floor(hash / segmentSize);
        return segments[segmentId];
      },
      getClusterName: function() { return clusterName; },
      toString: function() {
        return util.format('ConsistentHashRouter(conns=%s)', showArrayConnections(conns));
      }
    };
  };

  var FixedRouter = function(logger, conn, clusterName) {
    /**
     * Checks whether this connection's address is absent from the given list.
     * @param {Array} addrs - Array of server addresses.
     * @returns {boolean} True if this connection's address is not in the list.
     */
    function isMemberMissing(addrs) {
      return _.isEmpty(_.find(addrs, function(addr) {
        return _.isMatch(addr, conn.getAddress());
      }));
    }

    return {
      getTopologyId: function() { return 0; },
      getConnection: function() {
        return conn;
        },
      findConnection: function(triedAddrs) {
        return _.contains(triedAddrs, conn.getAddress()) ? undefined : conn;
      },
      getAddresses: function() { return [conn.getAddress()]; },
      filter: function(addrs) {
        var found = _.find(addrs, function(addr) {
          return _.isEqual(addr, conn.getAddress());
        });
        return _.isEmpty(found) ? [] : [conn];
      },
      getMissingConnections: function(topology) {
        var addrs = topology.servers;
        var isMissing = isMemberMissing(addrs);
        return isMissing ? [conn] : [];
      },
      disconnect: function(missing) {
        if (f.existy(missing)) {
          var isMissing = !_.isEmpty(missing);
          if (isMissing) {
            logger.debugf('Removed server is: %s', conn.toString());
            return conn.disconnect();
          } else {
            logger.debugf('Removed server: none');
            return Promise.resolve();
          }
        } else {
          logger.debugf('Disconnect single connection: %s', conn.toString());
          return conn.disconnect();
        }
      },
      findOwners: function() { return [conn]; },
      getClusterName: function() { return clusterName; },
      toString: function() {
        return util.format('FixedRouter(conn=%s)', conn.toString());
      }
    };
  };

  /**
   * Creates a transport layer managing connections, routing, and failover.
   * @param {Array} addrs - Initial server addresses to connect to.
   * @param {Object} protocol - The Hot Rod protocol instance.
   * @param {Object} clientOpts - Client configuration options.
   * @param {Object} listeners - Event listener manager.
   * @returns {Object} Transport object with connect, write, and topology methods.
   */
  function transport(addrs, protocol, clientOpts, listeners) {
    var id = _.uniqueId('io_');
    var logger = u.logger(id);
    var rpcMap = u.keyValueMap();
    var emitter = new events.EventEmitter();
    var router;
    var clusters = f.cat(clientOpts.clusters,
                    [{ name: DEFAULT_CLUSTER_NAME, servers: addrs}]);
    var clusterSwitchInProgress = false;

    /**
     * Installs a new router and retries all RPCs if a cluster switch occurred.
     * @param {Object} r - The new router to install.
     * @returns {void}
     */
    function onRouter(r) {
      // Check if a different router has been installed as result of cluster switch
      var isRetryAll = f.existy(router)
        && !_.isEqual(router.getClusterName(), r.getClusterName());

      // var oldRouter = router;
      router = r; // Assign new router
      logger.debugf('New router installed: %s', r.toString());

      if (isRetryAll) {
        logger.debugf('Retry all after new router installed %s', r.toString());
        retryAll(); // If cluster switched happened, retry all rpcs
        clusterSwitchInProgress = false;
      }

      // if (f.existy(oldRouter)) {
      //  // Disconnect old router to avoid leaving lingering connections
      //  logger.debugf("Disconnect old router connections");
      //  oldRouter.disconnect();
      // }
    }

    /**
     * Retries all pending RPCs after a cluster switch.
     * @returns {void}
     */
    function retryAll() {
      _.each(rpcMap.values(), function(rpc) {
        rpc.ctx.triedAddrs = [];
        logger.tracef('Retrying request(msgId=%d) after cluster switch', rpc.ctx.id);

        var conn = router.getConnection();
        if (f.existy(conn))
          writeRetry(rpc.ctx, rpc.decoder, conn, rpc.success, rpc.fail);
      });
    }

    /**
     * Filters topology servers to find newly added addresses.
     * @param {Object} topology - The new topology with server addresses.
     * @returns {Array} Server addresses not present in the current router.
     */
    function filterAdded(topology) {
      var currentAddrs = router.getAddresses();
      var added = _.filter(topology.servers, function(a) {
        return !_.where(currentAddrs, a).length > 0;
      });
      logger.debugl(function() {
        return ['Added servers: %s', u.showArrayAddress(added)]; });
      return added;
    }

    /**
     * Filters current router addresses to find those still present in the new topology.
     * @param {Object} topology - The new topology with server addresses.
     * @returns {Array} Addresses that remain connected in the new topology.
     */
    function filterConnected(topology) {
      var connected = _.filter(router.getAddresses(), function(addr) {
        return _.where(topology.servers, addr).length > 0;
      });
      logger.debugl(function() {
        return ['Connected servers: %s', u.showArrayAddress(connected)]; });
      return connected;
    }

    /**
     * Writes an encoded command to a connection and registers the RPC for response.
     * @param {Object} ctx - Encoding context with buffer and message ID.
     * @param {Function} decoder - Response decoder function.
     * @param {Function} connFunc - Function returning the target connection.
     * @param {Function} [preWrite] - Optional callback invoked before writing.
     * @returns {Promise} Resolves with the decoded response.
     */
    function write(ctx, decoder, connFunc, preWrite) {
      return new Promise(function (fulfill, reject) {
        var conn = connFunc();
        if (f.existy(preWrite))
          preWrite(conn);

        logger.tracel(function() {
          return ['Write buffer(msgId=%d) to %s: %s'
            , ctx.id, conn.toString(), ctx.buf.toString('hex').toUpperCase()]; });

        rpcMap.put(ctx.id, {success: fulfill, fail: reject,
          decoder: decoder, address: conn.getAddress(), ctx: ctx});
        conn.write(ctx.buf);
      });
    }

    /**
     * Writes a retried RPC command to a specific connection.
     * @param {Object} ctx - Encoding context with buffer and message ID.
     * @param {Function} decoder - Response decoder function.
     * @param {Object} conn - The target connection.
     * @param {Function} fulfill - Promise resolve function.
     * @param {Function} reject - Promise reject function.
     * @returns {void}
     */
    function writeRetry(ctx, decoder, conn, fulfill, reject) {
      logger.tracel(function() {
        return ['Write retried buffer(msgId=%d) to %s: %s'
          , ctx.id, conn.toString(), ctx.buf.toString('hex').toUpperCase()]; });

      rpcMap.put(ctx.id, {success: fulfill, fail: reject,
        decoder: decoder, address: conn.getAddress(), ctx: ctx});
      conn.write(ctx.buf);
    }

    /**
     * Disconnects the existing router and installs a new one.
     * @param {Object} newRouter - The new router to install.
     * @returns {Promise} Resolves when the new router is installed.
     */
    function disconnectAndEmitRouter(newRouter) {
      if (f.existy(router)) {
        // Disconnect existing router connections
        // and regardless of outcome, install new router
        return router.disconnect().finally(function() {
          onRouter(newRouter);
        });
      } else {
        onRouter(newRouter);
        return Promise.resolve();
      }
    }

    /**
     * Installs a new topology by updating connections and router.
     * @param {Object} topology - New topology with server addresses and segments.
     * @param {Object} transport - The transport instance.
     * @returns {Promise} Resolves when the new topology is fully installed.
     */
    function installNewTopology(topology, transport) {
      var newAddrs = topology.servers;
      logger.debugl(function() {return [
        'New topology(id=%s) discovered: %s',
        topology.id, u.showArrayAddress(newAddrs)]; });

      // Disconnect connections for members not present in topology
      var missing = router.getMissingConnections(topology);
      var disconnectMany = router.disconnect(missing);
      // Filter new addresses for which connections need to be created
      var added = filterAdded(topology);
      // Filter connections which continue connected
      var connected = filterConnected(topology);

      // Then, create new connections for all added members
      var newConnected = disconnectMany.then(function () {
        return Promise.all(_.map(added, function (addr) {
          return new Connection(addr, transport, listeners);
        }));
      });
      // Then, join these with the connected members and install new router
      return newConnected
        .then(function (newConnects) {
          var cons = f.cat(router.filter(connected), newConnects);
          var newRouter = new ConsistentHashRouter(
            logger, topology.id, cons, topology.segments, router.getClusterName());
          onRouter(newRouter);
          return newConnects;
        }).then(function (conns) {
            return Promise.all(_.map(conns, function (conn) {
              return conn.connect().then(function() {
                if(transport.authOpts().enabled) {
                  return authMech(transport, conn, topology.id)
                      .then(function (_) {
                        return auth(transport, conn, topology.id).then(function () {
                          return conn;
                        });
                  });
                } else {
                  return ping(transport, conn, topology.id).then(function () {
                    return conn;
                  });
                }
              });
            }));
          })
          .then(failoverListeners(transport, missing));
    }

    /**
     * Creates a function that fails over listeners from removed connections.
     * @param {Object} transport - The transport instance.
     * @param {Array} missing - Connections that were removed from the topology.
     * @returns {Function} Failover function that re-registers listeners.
     */
    function failoverListeners(transport, missing) {
      return function() {
        logger.debugf('Failover listeners registered in: %s', showArrayConnections(missing));

        var failover = _.map(missing, function(c) {
          var listenersAt = listeners.getListenersAt(c.getAddress());

          return _.map(listenersAt, function(listener) {
            logger.debugf('Failover listener with id: %s', listener.id);
            listeners.removeListeners(listener.id);
            return listeners.addRemoteListener(transport, transport.context(32), listener.event, listener.callback);
          });
        });

        return Promise.all(_.flatten(failover));
      };
    }

    /**
     * Creates lazy connection factories that install a FixedRouter on first call.
     * @param {Array} servers - Server addresses to create connections for.
     * @param {Function} connF - Connection callback to invoke after connecting.
     * @param {Object} transport - The transport instance.
     * @returns {Array} Array of lazy connection factory functions.
     */
    function toLazyConnectionsFirstCall(servers, connF, transport) {
      return _.map(servers, function(server) {
        return function() {
          var conn = new Connection(server, transport, listeners);
          onRouter(new FixedRouter(logger, conn, DEFAULT_CLUSTER_NAME));
          return connF(conn);
        };
      });
    }

    /**
     * Creates lazy connection factories for the given servers.
     * @param {Array} servers - Server addresses to create connections for.
     * @param {Function} connF - Connection callback to invoke after connecting.
     * @param {Object} transport - The transport instance.
     * @returns {Array} Array of lazy connection factory functions.
     */
    function toLazyConnections(servers, connF, transport) {
      return _.map(servers, function(server) {
        return function() {
          var conn = new Connection(server, transport, listeners);
          return connF(conn);
        };
      });
    }

    /**
     * Returns clusters excluding the one that failed.
     * @param {string} failedClusterName - Name of the failed cluster.
     * @returns {Array} Alternative cluster configurations.
     */
    function getCandidateClusters(failedClusterName) {
      return _.filter(clusters, function(cluster) {
        return !_.isEqual(cluster.name, failedClusterName);
      });
    }

    /**
     * Creates a callback that installs a new router after failover.
     * @param {string} failedClusterName - Name of the cluster that failed.
     * @returns {Function} Callback accepting connection info to install new router.
     */
    function getFailoverMainRouter(failedClusterName) {
      return function(connInfo) {
        logger.debugf('Switched from failed cluster=%s to cluster=%s',
                      failedClusterName, connInfo[0]);
        return disconnectAndEmitRouter(new FixedRouter(logger, connInfo[1], connInfo[0]))
          .then(function() { return true; });
      };
    }

    /**
     * Creates a connection factory for an alternative cluster.
     * @param {string} clusterName - Name of the alternative cluster.
     * @returns {Function} Factory that connects and optionally authenticates.
     */
    function altConnection(clusterName) {
      return function(conn) {
        logger.debugf('Alt connection %s', clusterName);
        return Promise.all([Promise.resolve(clusterName), conn.connect()
            .then(function () {
              if(o.authOpts().enabled) {
                return auth(o, conn, o.getTopologyId()).then(function () {
                  logger.debugf('Alt connection, return conn %s', conn.toString());
                  return conn;
                });
              }
              return conn;
        })]);
      };
    }

    /**
     * Creates lazy connection factories for an alternative cluster.
     * @param {Object} cluster - Cluster config with name and servers.
     * @param {Object} transport - The transport instance.
     * @returns {Array} Array of lazy connection factory functions.
     */
    function toLazyAltConnections(cluster, transport) {
      return toLazyConnections(
        cluster.servers, altConnection(cluster.name), transport);
    }

    /**
     * Wraps a cluster switch operation with progress tracking.
     * @param {Function} clusterSwitchF - Function performing the cluster switch.
     * @param {Function} [clusterFailF] - Optional error handler if switch fails.
     * @returns {Promise} Resolves when the cluster switch completes.
     */
    function aroundClusterSwitch(clusterSwitchF, clusterFailF) {
      logger.debugf('aroundClusterSwitch set clusterSwitchInProgress=true');
      clusterSwitchInProgress = true;
      return clusterSwitchF()
          .catch(function(err) {
            logger.error('error in aroundClusterSwitch %s', err.message);
            if (f.existy(clusterFailF)) clusterFailF(err);
          }).finally(function () {
            logger.tracef('aroundClusterSwitch finally, set clusterSwitchInProgress=false');
            clusterSwitchInProgress = false;
          });
    }

    /**
     * Attempts automatic failover to an alternative cluster.
     * @param {Function} noClustersF - Callback if no alternative clusters exist.
     * @param {Function} clusterFailF - Callback if cluster switch fails.
     * @param {Object} transport - The transport instance.
     * @returns {Promise} Resolves when failover completes or is rejected.
     */
    function trySwitchCluster(noClustersF, clusterFailF, transport) {
      var failedClusterName = router.getClusterName();
      logger.debugf('Try to failover away from cluster=%s', failedClusterName);
      if (_.isEmpty(clientOpts.clusters)) {
        logger.tracef('No alternative clusters configured');
        return new Promise(function() { noClustersF(); });
      } else {
        return aroundClusterSwitch(function() {
          var clusters = getCandidateClusters(failedClusterName);
          var allLazyConns = _.flatten(f.cat(_.map(clusters, function(cluster) {
            logger.tracef('Try to move to cluster %s', cluster.name);
            return toLazyAltConnections(cluster, transport);
          })));
          logger.tracef('allLazyConns here, now find first connection');
          return findFirstConnection(allLazyConns, getFailoverMainRouter(failedClusterName));
        }, clusterFailF);
      }
    }

    /**
     * Installs a FixedRouter for a manually selected cluster connection.
     * @param {Array} connInfo - Tuple of [clusterName, connection].
     * @returns {boolean} True indicating the switch succeeded.
     */
    function getManualMainRouter(connInfo) {
      var clusterName = connInfo[0];
      var conn = connInfo[1];
      logger.debugf('Manually switched to cluster=%s, establishing connection to %s',
                    clusterName, conn.toString());
      return disconnectAndEmitRouter(new FixedRouter(logger, conn, clusterName))
        .then(function() { return true; });
    }

    /**
     * Finds a cluster configuration by name for manual switching.
     * @param {string} clusterName - Target cluster name, or undefined for default.
     * @returns {Object|undefined} The matching cluster configuration, or undefined.
     */
    function findManualSwitchCluster(clusterName) {
      var name = f.existy(clusterName) ? clusterName : DEFAULT_CLUSTER_NAME;
      return _.find(clusters, function(cluster) {
        return _.isEqual(cluster.name, name);
      });
    }

    /**
     * Attempts a manual switch to a named cluster.
     * @param {string} clusterName - Name of the target cluster.
     * @param {Object} transport - The transport instance.
     * @returns {Promise<boolean>} Resolves true if switch succeeded, false otherwise.
     */
    function tryManualSwitchCluster(clusterName, transport) {
      logger.debugf('Try to manually switch to cluster=%s', clusterName);
      var targetCluster = findManualSwitchCluster(clusterName);
      if (!f.existy(targetCluster)) {
        logger.debugf('No cluster found for cluster=%s', clusterName);
        return Promise.resolve(false);
      }

      return aroundClusterSwitch(function() {
        var lazyConns = toLazyAltConnections(targetCluster, transport);
        return findFirstConnection(lazyConns, getManualMainRouter);
      }, function () {
        logger.error('Unable to switch to cluster %s', targetCluster.name);
        return Promise.resolve(false);
      });
    }

    /**
     * Establishes and authenticates the main connection to a server.
     * @param {Object} conn - The connection to establish.
     * @returns {Promise<Object>} Resolves with the connected connection.
     */
    function mainConnection(conn) {
      if (o.authOpts().enabled) {
        return conn.connect().then(function () {
          return authMech(o, conn, o.getTopologyId());
        }).then(function (authMechs) {
          logger.tracef(authMechs);
          if (!_.contains(authMechs, o.authOpts().saslMechanism)) {
            throw new Error(`The selected authentication mechanism ${  o.authOpts().saslMechanism
                             } is not among the supported server mechanisms: ${  authMechs}`);
          }
          return auth(o, conn, o.getTopologyId());
        }).then(conn);
      }

      return conn.connect().then(function () {
        return ping(o, conn,  o.getTopologyId());
      }).then(conn);
    }

    /**
     * Tries lazy connections in order, returning the first successful one.
     * @param {Array<Function>} lazyConns - Array of lazy connection factory functions.
     * @returns {Promise<Object>} Resolves with the first successful connection.
     */
    function getFirstConnection(lazyConns) {
      return _.foldl(lazyConns, function(state, f) {
        return state
            .catch(function() { return f(); } ); // if fails, try next
      }, Promise.reject(new Error('Unable to find the first connection')));
    }

    /**
     * Tries lazy connections in order and applies a callback to the first success.
     * @param {Array<Function>} lazyConns - Array of lazy connection factory functions.
     * @param {Function} connF - Callback applied to the successful connection.
     * @returns {Promise} Resolves with the callback result.
     */
    function findFirstConnection(lazyConns, connF) {
      logger.debugf('Call findFirstConnection');

      return _.foldl(lazyConns, function(state, f) {
        return state
          .catch(function() { return f(); } ) // if fails, try next
          .then(connF);
      }, Promise.reject(new Error('Unable to find a connection')));
    }

    /**
     * Sends a ping request to a server connection.
     * @param {Object} transport - The transport instance.
     * @param {Object} conn - The connection to ping.
     * @param {number} topologyId - Current topology ID.
     * @returns {Promise} Resolves with the ping response.
     */
    function ping(transport, conn, topologyId) {
      var ctx = u.context(16);
      ctx.topologyId = topologyId;
      logger.debugf('Invoke ping(msgId=%d)', ctx.id);
      var p = transport.getProtocol();
      f.actions(p.stepsHeader(ctx, 0x17, undefined), codec.bytesEncoded)(ctx);
      return transport.writeCommandPinned(ctx, p.decodePingResponse, conn);
    }

    /**
     * Performs SASL authentication on a connection.
     * @param {Object} transport - The transport instance.
     * @param {Object} conn - The connection to authenticate.
     * @param {number} topologyId - Current topology ID.
     * @returns {Promise<Object>} Resolves with the authenticated connection.
     */
    function auth(transport, conn, topologyId) {
      if (!transport.authOpts().enabled || conn.authDone) {
        logger.debugf('Auth not enabled');
        return Promise.resolve(conn);
      }
      conn.authDone = true;
      var ctx = u.context(16);
      ctx.topologyId = topologyId;
      var p = transport.getProtocol();
      logger.debugf('Invoke auth(msgId=%d)', ctx.id);
      var holder = {};
      f.actions(p.stepsHeaderBody(ctx, 0x23, p.sasl(transport.authOpts(), holder), undefined), codec.bytesEncoded)(ctx);
      var result = transport.writeCommandPinned(ctx, p.decodeSasl, conn);
      return result.then(function (r) {
        ctx = u.context(16);
        ctx.topologyId = topologyId;
        holder.challenge = r.response;
        f.actions(p.stepsHeaderBody(ctx, 0x23, p.sasl(transport.authOpts(), holder) , undefined), codec.bytesEncoded)(ctx);
        return transport.writeCommandPinned(ctx, p.decodeSasl, conn).then(function (r) {
          return r;
        });
        return r;
      });
    }

    /**
     * Queries the server for supported authentication mechanisms.
     * @param {Object} transport - The transport instance.
     * @param {Object} conn - The connection to query.
     * @param {number} topologyId - Current topology ID.
     * @returns {Promise<Array>} Resolves with the list of supported SASL mechanisms.
     */
    function authMech(transport, conn, topologyId) {
      if (!transport.authOpts().enabled) {
        logger.debugf('Auth not enabled');
        return Promise.resolve();
      }
      var ctx = u.context(16);
      ctx.topologyId = topologyId;
      var p = transport.getProtocol();
      logger.debugf('Invoke authMech(msgId=%d)', ctx.id);
      f.actions(p.stepsHeader(ctx, 0x21, undefined), codec.bytesEncoded)(ctx);
      return transport.writeCommandPinned(ctx, p.decodeAuthMech, conn);
    }

    var o = {
      connect: function() {
        // Convert to lazy connections
        var lazyConns = toLazyConnectionsFirstCall(addrs, mainConnection, o);

        // Set up router event callback
        emitter.on('router', onRouter);

        // Fold over the lazy connections, only triggering connections if failure
        return getFirstConnection(lazyConns);
      },
      getConnection: function(key) {
        return router.getConnection(key, protocol);
      },
      disconnect: function() {
        emitter.removeListener('router', onRouter);
        if (f.existy(router)) {
            logger.debugf('Disconnect transport');
            return router.disconnect();
        } else {
          return Promise.resolve();
        }
      },
      writeKeyCommand: function(ctx, key, decoder) {
        return write(ctx, decoder, function() { return router.getConnection(key, protocol); });
      },
      writeCommand: function(ctx, decoder, preWrite) {
        return write(ctx, decoder, function() { return router.getConnection(); }, preWrite);
      },
      writeCommandPinned: function(ctx, decoder, conn) {
        return write(ctx, decoder, function() { return conn; });
      },
      writeRetry: function(ctx, decoder, fulfill, reject, triedAddrs) {
        var conn = router.findConnection(triedAddrs);
        if (f.existy(conn))
          writeRetry(ctx, decoder, conn, fulfill, reject);
        else {
          trySwitchCluster(
            function() { reject('No clusters and no connections left to try on writeRetry.'); },
            function(err) {
              logger.tracef('Clusters configured but none available on writeRetry: %s', err.message);
              reject('Clusters configured but none available on writeRetry. No connections left to try');
            }, o);
        }
      },
      getProtocol: function() { return protocol; },
      findRpc: function(id) { return rpcMap.get(id); },
      removeRpc: function(id) { return rpcMap.remove(id); },
      updateTopology: function(bytebuf) {
        var topology = protocol.decodeTopology(bytebuf);
        if (topology.done && !_.isEqual(topology.id, router.getTopologyId())) {
          return installNewTopology(topology, o);
        }
        return topology.done ? Promise.resolve() : undefined;
      },
      getTopologyId: function() {
        return router.getTopologyId();
      },
      getMembers: function() {
        return router.getAddresses();
      },
      findOwners: function(k) {
        return router.findOwners(k, protocol);
      },
      retryRpcs: function(addr) {
        if (!clusterSwitchInProgress) {
          var pendingRpcs = rpcMap.filter(
            function(rpc) { return _.isEqual(rpc.address, addr); });

          logger.tracel(function() {
            return ['Pending request ids are: [%s]', _.keys(pendingRpcs)]; });

          _.each(pendingRpcs, function(rpc, id) {
            if (rpc.ctx.triedAddrs.length >= clientOpts.maxRetries) {
              trySwitchCluster(
                function() {
                  rpc.fail(util.format(
                    'Unable to complete request(msgId=%d) after trying in %s',
                    id, u.showArrayAddress(rpc.ctx.triedAddrs)));
                },
                function(err) {
                  // Clusters configured but none available
                  logger.tracef('Clusters configured but none available in retryPrcs: %s', err.message);
                  rpc.fail(util.format(
                    'Unable to complete request(msgId=%d) after trying in %s and trying to switch clusters',
                    id, u.showArrayAddress(rpc.ctx.triedAddrs)));
                }, o);
            } else {
              rpc.ctx.triedAddrs.push(addr); // Add tried address
              logger.tracef('Retrying request(msgId=%d), retry %d', id, rpc.ctx.triedAddrs.length);
              o.writeRetry(rpc.ctx, rpc.decoder, rpc.success, rpc.fail, rpc.ctx.triedAddrs);
            }
          });
        } else {
          logger.debugf('Do not retry RPCs since cluster switch is in progress');
        }
      },
      sslOpts: function() {
        return clientOpts.ssl;
      },
      authOpts: function() {
        return clientOpts.authentication;
      },
      switchToCluster: function(clusterName) {
        return tryManualSwitchCluster(clusterName, o);
      },
      switchToDefaultCluster: function() {
        return tryManualSwitchCluster(DEFAULT_CLUSTER_NAME, o);
      },
      toString: function() {
        return util.format('id=%s,router=%s', id, router);
      },
      getId: function() {
        return id;
      },
      context: function(size) {
        var ctx = u.context(size);
        ctx.topologyId = this.getTopologyId();
        return ctx;
      }
    };
    return o;
  }

}.call(this));
