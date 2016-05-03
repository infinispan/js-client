'use strict';

(function() {

  var _ = require('underscore');
  var events = require('events');
  var net = require('net');
  var Promise = require('promise');

  var f = require('./functional');
  var u = require('./utils');
  var codec = require('./codec');

  module.exports = transport;

  function showArrayConnections(conns) {
    return ["[", _.map(conns, function(c) { return c.toString(); }).join(","), "]"].join('');
  }

  var Connection = function(addr, transport) {
    var logger = u.logger('connection');
    var sock = new net.Socket();
    var replayable = u.replayableBuffer();

    function show() { return u.showAddress(addr); }

    function onConnect(fulfill, conn) {
      return function() {
        logger.debugf('Connected to %s', show());
        fulfill(conn);
      };
    }

    function onError(reject) {
      return function(err) {
        logger.error('Error from %s: %s', show(), err.message);
        reject(err);
      };
    }

    function onEnd() {
      logger.debugf('Disconnected from %s', show());
    }

    function rewind() {
      logger.tracef("Incomplete response or event, rewind buffer and wait more data");
      replayable.rewind();
    }

    function trim(header, bytebuf) {
      logger.tracef("After decoding request(msgId=%d), buffer size is %d, and offset %d",
                    header.msgId, bytebuf.buf.length, bytebuf.offset);
      replayable.trim(bytebuf);
    }

    function completeRpc(rpc, header, isError, topology, body) {
      // If new topology is received, rpc needs to be
      // completed after new topology has been installed
      // TODO: If no new topology received, avoid chaining
      topology.then(function() {
        logger.tracel(function() { return [
            'Complete %s for request(msgId=%d) with %s',
          isError ? 'failure' : 'success', header.msgId, u.str(body.result)]; });

        if (isError)
          rpc.fail(body.result);
        else
          rpc.success(body.result);

        transport.removeRpc(header.msgId);
      });
    }

    function onData(data) {
      replayable.append(data);
      var canDecodeMore = true;
      var protocol = transport.getProtocol();
      while (!replayable.isEmpty() && canDecodeMore) {
        var bytebuf = replayable.mark();
        var header = protocol.decodeHeader(bytebuf);

        var topology = header.hasNewTopology
            ? transport.updateTopology(bytebuf)
            : Promise.resolve();

        canDecodeMore = f.existy(topology);

        if (canDecodeMore) {
          if (protocol.isEvent(header)) {
            canDecodeMore = protocol.decodeEvent(header, bytebuf);
          } else {
            var rpc = transport.findRpc(header.msgId);
            var body = protocol.isError(header)
                ? protocol.decodeError(header, bytebuf)
                : protocol.decodeBody(rpc.decoder, header, bytebuf, conn);
            canDecodeMore = body.continue;
            if (body.continue)
              completeRpc(rpc, header, protocol.isError(header), topology, body);
          }

          if (!canDecodeMore)
            rewind(); // Incomplete event or body, rewind
          else
            trim(header, bytebuf); // Trim buffer after reading event or body
        } else {
          rewind(); // Incomplete topology, rewind
        }
      }
    }

    var conn = {
      connect: function() {
        return new Promise(function (fulfill, reject) {
          logger.debugf('Connecting to %s', show());
          sock.connect(addr.port, addr.host, onConnect(fulfill, conn));
          sock.on('error', onError(reject));
          sock.on('end', onEnd);
          sock.on('data', onData);
        });
      },
      disconnect: function() {
        return new Promise(function (fulfill, reject) {
          sock.end();
          fulfill();
        });
      },
      write: function(buffer) {
        sock.write(buffer);
      },
      getAddress: function() {
        return addr;
      },
      toString: function() {
        return show();
      }
    };
    return conn;
  };

  var RpcMap = function() {
    var promiseMap = u.keyValueMap();

    return {
      put: function(id, value) {
        promiseMap.put(id, value);
      },
      find: function(id) {
        return promiseMap.get(id);
      },
      remove: function(id) {
        promiseMap.remove(id);
      }
    };
  };

  var ConsistentHashRouter = function(logger, topologyId, conns, segments) {
    var i = 0;
    var mh3 = u.murmurHash3();

    function filterNot(addrs) {
      var missing = _.filter(conns, function(c) {
        return !_.where(addrs, c.getAddress()).length > 0;
      });
      logger.debugl(function() {
        return ['Removed servers are: %s', showArrayConnections(missing)]; });
      return missing;
    }

    function getConnectionRoundRobin() {
      var conn = conns[i++];
      if (i >= conns.length) i = 0;
      return conn;
    }

    function getSegmentSize(numSegments) {
      return Math.abs(Math.ceil((1 << 31) / numSegments));
    }

    function getNormalizedHash(buf) {
      // make sure no negative numbers are involved.
      var hash = mh3.hash(buf);
      return hash & 0x7FFFFFFF;
    }

    function keyToBytes(k) {
      var ctx = u.context(32);
      f.actions([codec.encodeObject(k)], codec.bytesEncoded)(ctx);
      return f.actions([codec.decodeVariableBytes()], codec.lastDecoded)({buf: ctx.buf, offset: 0});
    }

    function addrToConn(addr) {
      return _.find(conns, function(con) {
        return _.isEqual(con.getAddress(), addr);
      });
    }

    return {
      getTopologyId: function() { return topologyId; },
      getConnection: function(k) {
        return f.existy(k)
            ? addrToConn(this.findOwners(k)[0])
            : getConnectionRoundRobin();
      },
      getAddresses: function() {
        return _.map(conns, function (conn) { return conn.getAddress(); });
      },
      filter: function(addrs) {
        return _.filter(conns, function(conn) {
          return _.where(addrs, conn.getAddress()).length > 0;
        });
      },
      disconnect: function(topology) {
        var missing = f.existy(topology) ? filterNot(topology.servers) : conns;
        var disconnects = _.map(missing, function(c) { return c.disconnect(); });
        return Promise.all(disconnects);
      },
      findOwners: function(k) {
        var keyBytes = keyToBytes(k);
        var segmentSize = getSegmentSize(segments.length);
        var hash = getNormalizedHash(keyBytes);
        var segmentId = Math.floor(hash / segmentSize);
        return segments[segmentId];
      }
    }
  };

  var FixedRouter = function(logger, conn) {
    function isMemberMissing(addrs) {
      return _.isEmpty(_.find(addrs, function(addr) {
        return _.isMatch(addr, conn.getAddress());
      }));
    }

    return {
      getTopologyId: function() { return 0; },
      getConnection: function() { return conn; },
      getAddresses: function() { return [conn.getAddress()]; },
      filter: function(addrs) {
        var found = _.find(addrs, function(addr) {
          return _.isEqual(addr, conn.getAddress());
        });
        return _.isEmpty(found) ? [] : [conn];
      },
      disconnect: function(topology) {
        if (f.existy(topology)) {
          var addrs = topology.servers;
          var isMissing = isMemberMissing(addrs);
          if (isMissing) {
            logger.debugf('Removed server is: %s', conn.toString());
            return conn.disconnect()
          } else {
            logger.debugf('Removed server: none');
            return Promise.resolve();
          }
        } else {
          return conn.disconnect();
        }
      },
      findOwners: function() { return [conn]; }
    }
  };

  function transport(addrs, protocol) {
    var logger = u.logger('transport');
    var rpcMap = new RpcMap();
    var emitter = new events.EventEmitter();
    var router;

    function onRouter(r) { router = r; }

    function filterAdded(topology) {
      var currentAddrs = router.getAddresses();
      var added = _.filter(topology.servers, function(a) {
        return !_.where(currentAddrs, a).length > 0;
      });
      logger.debugl(function() {
        return ['Added servers: %s', u.showArrayAddress(added)]; });
      return added;
    }

    function filterConnected(topology) {
      var connected = _.filter(router.getAddresses(), function(addr) {
        return _.where(topology.servers, addr).length > 0;
      });
      logger.debugl(function() {
        return ['Connected servers: %s', u.showArrayAddress(connected)]; });
      return connected;
    }

    function write(ctx, decoder, connFunc, preWrite) {
      return new Promise(function (fulfill, reject) {
        var conn = connFunc();
        if (f.existy(preWrite))
          preWrite(conn);

        logger.tracel(function() {
          return ['Write buffer(msgId=%d) to %s: %s'
            , ctx.id, conn.toString(), ctx.buf.toString('hex').toUpperCase()]; });

        conn.write(ctx.buf);
        rpcMap.put(ctx.id, {success: fulfill, fail: reject, decoder: decoder});
      });
    }

    function installNewTopology(topology, transport) {
      var newAddrs = topology.servers;
      logger.debugl(function() {return [
        'New topology(id=%s) discovered: %s',
        topology.id, u.showArrayAddress(newAddrs)] });

      // Disconnect connections for members not present in topology
      var disconnectMany = router.disconnect(topology);
      // Filter new addresses for which connections need to be created
      var added = filterAdded(topology);
      // Filter connections which continue connected
      var connected = filterConnected(topology);

      // Then, create new connections for all added members
      var newConnected = disconnectMany.then(function() {
        return Promise.all(_.map(added, function(addr) {
          return new Connection(addr, transport).connect();
        }));
      });
      // Then, join these with the connected members and install new router
      return newConnected.then(function(newConnects) {
        var cons = f.cat(router.filter(connected), newConnects);
        var newRouter = new ConsistentHashRouter(logger, topology.id, cons, topology.segments);
        emitter.emit('router', newRouter);
      });
    }

    var o = {
      connect: function() {
        // Convert to lazy connections
        var lazyConns = _.map(addrs, function(addr) {
          return function() {
            var conn = new Connection(addr, o);
            return conn.connect();
          };
        });

        // Set up router event callback
        emitter.on('router', onRouter);

        // Fold over the lazy connections, only triggering connections if failure
        return _.foldl(lazyConns, function(state, f) {
          return state
            .catch(function(error) { return f(); } ) // if fails, try next
            .then(function(conn) {
              emitter.emit('router', new FixedRouter(logger, conn));
            });
        }, Promise.reject(new Error()));
      },
      disconnect: function() {
        emitter.removeListener('router', onRouter);
        return router.disconnect();
      },
      writeKeyCommand: function(ctx, key, decoder) {
        return write(ctx, decoder, function() { return router.getConnection(key); });
      },
      writeCommand: function(ctx, decoder, preWrite) {
        return write(ctx, decoder, function() { return router.getConnection(); }, preWrite);
      },
      writeCommandPinned: function(ctx, decoder, conn) {
        return write(ctx, decoder, function() { return conn; });
      },
      getProtocol: function() { return protocol; },
      findRpc: function(id) { return rpcMap.find(id); },
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
        return router.findOwners(k);
      }
    };
    return o;
  };

}.call(this));
