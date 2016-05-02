'use strict';

(function() {

  var _ = require('underscore');
  var net = require('net');
  var Promise = require('promise');

  var f = require('./functional');
  var codec = require('./codec');
  var u = require('./utils');
  var protocols = require('./protocols');
  var io = require('./io');

  var Client = function(addrs, clientOpts) {
    var logger = u.logger('client');

    var protocolResolver = function(version) {
      switch (version) {
        case '2.5': return protocols.version25(clientOpts);
        case '2.2': return protocols.version22(clientOpts);
        default : throw new Error('Unknown protocol version: ' + version);
      }
    };

    var p = protocolResolver(clientOpts['version']);

    var TINY = 16, SMALL = 32, MEDIUM = 64, BIG = 128;

    var transport = io(addrs, p);

    function stepsHeader(ctx, op, opts) {
      return p.encodeHeader(op, transport.getTopologyId(), opts)(ctx.id);
    }

    function stepsHeaderBody(ctx, op, body, opts) {
      var header = stepsHeader(ctx, op, opts);
      return f.cat(header, body());
    }

    function future(ctx, op, body, decoder, opts) {
      f.actions(stepsHeaderBody(ctx, op, body, opts), codec.bytesEncoded)(ctx);
      return transport.writeCommand(ctx, decoder);
    }

    function futurePreWrite(ctx, op, body, decoder, opts, preWrite) {
      f.actions(stepsHeaderBody(ctx, op, body, opts), codec.bytesEncoded)(ctx);
      return transport.writeCommand(ctx, decoder, preWrite);
    }

    function futureDecodeOnly(ctx, op, decoder, opts) {
      f.actions(stepsHeader(ctx, op, opts), codec.bytesEncoded)(ctx);
      return transport.writeCommand(ctx, decoder);
    }

    function futureEmpty(ctx, op) {
      f.actions(stepsHeader(ctx, op), codec.bytesEncoded)(ctx);
      return transport.writeCommand(ctx);
    }

    function futureKey(ctx, op, key, body, decoder, opts) {
      f.actions(stepsHeaderBody(ctx, op, body, opts), codec.bytesEncoded)(ctx);
      return transport.writeKeyCommand(ctx, key, decoder);
    }

    function futurePinned(ctx, op, body, decoder, conn) {
      f.actions(stepsHeaderBody(ctx, op, body), codec.bytesEncoded)(ctx);
      return transport.writeCommandPinned(ctx, decoder, conn);
    }

    function iterator(iterId, conn) {
      var nextElems = [];
      var done = false;

      function nextPromise() {
        var kv = nextElems.pop();
        return new Promise(function (fulfill, reject) {
          fulfill(f.merge({done: done}, kv));
        });
      }

      function donePromise() {
        return new Promise(function (fulfill, reject) {
          fulfill({done: done});
        });
      }

      return {
        next: function() {
          if (done) {
            logger.tracef('Iterator(iteratorId=%s) already exhausted', iterId);
            return donePromise();
          } else if (_.isEmpty(nextElems)) {
            var ctx = u.context(SMALL);
            logger.tracef('Invoke iterator.next(msgId=%d,iteratorId=%s) on %s', ctx.id, iterId, conn.toString());
            var remote = futurePinned(ctx, 0x33, p.encodeIterId(iterId), p.decodeNextEntries, conn);
            return remote.then(function(entries) {
              if (_.isEmpty(entries)) {
                done = true;
                return donePromise();
              } else {
                _.each(entries, function(entry) {
                  nextElems.push(entry);
                });
                return nextPromise();
              }
            });
          }
          logger.tracef('Return next from locally cached entries for iterator(iteratorId=%s)', iterId);
          return nextPromise();
        },
        close: function() {
          var ctx = u.context(SMALL);
          logger.debugf('Invoke iterator.close(msgId=%d,iteratorId=%s) on %s', ctx.id, iterId, conn.toString());
          return futurePinned(
              ctx, 0x35, p.encodeIterId(iterId), p.complete(p.hasSuccess), conn);
        }
      }
    }

    function asJBossString(str, bufferSize) {
      var ctx = u.context(bufferSize);
      f.actions(codec.encodeJBossString(str), codec.bytesEncoded)(ctx);
      return ctx.buf;
    }

    function addLocalListener(ctx, event, listener, opts) {
      logger.debugl(function() { return ['Invoke addListener(msgId=%d,event=%s,opts=%s) locally',
                                         ctx.id, event, JSON.stringify(opts)]; });
      return new Promise(function (fulfill, reject) {
        p.addListener(event, listener, opts.listenerId);
        fulfill(opts.listenerId);
      });
    }

    function addRemoteListener(ctx, event, listener, opts) {
      var listenerId = _.uniqueId('listener_');
      logger.debugl(function() {
          return ['Invoke addListener(msgId=%d,event=%s,listenerId=%s,opts=%s) remotely',
              ctx.id, event, listenerId, JSON.stringify(opts)]; });
      var remote = futurePreWrite(ctx, 0x25
          , p.encodeListenerAdd(listenerId, opts), p.complete(p.hasSuccess)
          , opts, preWriteAddListener(event, listener, listenerId));
      return remote
        .then(function(success) { return success ? listenerId : p.removeListeners(listenerId); })
        .catch(function() { p.removeListeners(listenerId); });
    }

    function preWriteAddListener(event, listener, listenerId) {
      return function(conn) {
        // Listener needs to be registered in advance since events might come
        // before reply from server to add listener, e.g. when include state
        // is enabled. To avoid leaking listeners, remove listener if there's
        // any problem.
        p.addListener(event, listener, listenerId, conn);
      }
    }

    return {
      connect: function() {
        // TODO: Avoid user calling connect by checking if connected
        var client = this;
        return transport.connect()
            .then(function() { return client.ping(); }) // ping on startup
            .then(function() { return client; });       // return client
      },
      disconnect: function() {
        return transport.disconnect();
      },
      get: function(k) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke get(msgId=%d,key=%s)', ctx.id, k);
        return futureKey(ctx, 0x03, k, p.encodeKey(k), p.decodeValue);
      },
      containsKey: function(k) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke containsKey(msgId=%d,key=%s)', ctx.id, k);
        return futureKey(ctx, 0x0F, k, p.encodeKey(k), p.complete(p.hasSuccess));
      },
      getVersioned: function(k) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke getVersioned(msgId=%d,key=%s)', ctx.id, k);
        return futureKey(ctx, 0x11, k, p.encodeKey(k), p.decodeVersioned);
      },
      getWithMetadata: function(k) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke getWithMetadata(msgId=%d,key=%s)', ctx.id, k);
        return futureKey(ctx, 0x1B, k, p.encodeKey(k), p.decodeWithMeta);
      },
      // Returns undefined.
      // With previous option returns previous value or undefined if no previous value.
      put: function(k, v, opts) {
        var ctx = u.context(MEDIUM);
        logger.debugl(function() { return ['Invoke put(msgId=%d,key=%s,value=%s,opts=%s)',
                                           ctx.id, k, u.str(v), u.str(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.complete(_.constant(undefined)));
        return futureKey(ctx, 0x01, k, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true removed, false if not removed because key did not exist.
      // With previous option returns the removed value, or undefined if the key did not exist.
      remove: function(k, opts) {
        var ctx = u.context(SMALL);
        logger.debugl(function() {return ['Invoke remove(msgId=%d,key=%s,opts=%s)',
                                          ctx.id, k, JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.complete(p.hasSuccess));
        return futureKey(ctx, 0x0B, k, p.encodeKey(k), decoder, opts);
      },
      // Returns true if absent, false if present.
      // With previous option returns undefined if absent and a non-null value if present.
      putIfAbsent: function(k, v, opts) {
        var ctx = u.context(MEDIUM);
        logger.debugl(function() {return ['Invoke putIfAbsent(msgId=%d,key=%s,value=%s,opts=%s)',
                                          ctx.id, k, v, JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasNotExecuted, p.complete(p.hasSuccess));
        return futureKey(ctx, 0x05, k, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true if replaced, false if not replaced because key does not exist.
      // With previous option returns the non-null value that was replaced, otherwise it returns undefined.
      replace: function(k, v, opts) {
        var ctx = u.context(MEDIUM);
        logger.debugl(function() { return ['Invoke replace(msgId=%d,key=%s,value=%s,opts=%s)',
                                           ctx.id, k, v, JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasPrevious, p.complete(p.hasSuccess));
        return futureKey(ctx, 0x07, k, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true if version matches and value was replaced, otherwise it
      // returns false if not replaced because key does not exist or version
      // sent does not match server-side version.
      // With previous option, it returns the non-null value that was replaced,
      // otherwise it returns undefined.
      // API NOTE: Different method for versioned replace to avoid user errors by
      // guaranteeing that the version is provided, otherwise user could make
      // a mistake with optional version parameter and the operation could be
      // executed as a normal replace.
      replaceWithVersion: function(k, v, version, opts) {
        var ctx = u.context(MEDIUM);
        logger.debugl(function() { return ['Invoke replaceWithVersion(msgId=%d,key=%s,value=%s,version=0x%s,opts=%s)',
                                           ctx.id, k, v, version.toString('hex'), JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasPrevious, p.complete(p.hasSuccess));
        return futureKey(ctx, 0x09, k, p.encodeKeyValueVersion(k, v, version, opts), decoder, opts);
      },
      // Returns true if version matches and value was removed, otherwise it
      // returns false if not removed because key does not exist or version
      // sent does not match server-side version.
      // With previous option, it returns the non-null value that was removed,
      // otherwise it returns undefined.
      // API NOTE: Different method for versioned remove to avoid user errors by
      // guaranteeing that the version is provided, otherwise user could make
      // a mistake with optional version parameter and the operation could be
      // executed as a normal remove.
      removeWithVersion: function(k, version, opts) {
        var ctx = u.context(SMALL);
        logger.debugl(function() { return ['Invoke removeWithVersion(msgId=%d,key=%s,version=0x%s,opts=%s)',
                                           ctx.id, k, version.toString('hex'), JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasPrevious, p.complete(p.hasSuccess));
        return futureKey(ctx, 0x0D, k, p.encodeKeyVersion(k, version), decoder, opts);
      },
      // Returns an array of {key: <K>, value: <V>} pairs
      getAll: function(keys, opts) {
        var ctx = u.context(MEDIUM);
        logger.debugl(function() { return ['Invoke getAll(msgId=%d,keys=[%s],opts=%s)',
                                           ctx.id, keys, JSON.stringify(opts)]; });
        // TODO: Validate empty keys
        return future(ctx, 0x2F, p.encodeMultiKey(keys), p.decodeCountValues, opts);
      },
      // Stores an array of key/value pairs where each pair is defined as {key: <K>, value: <V>}
      // API NOTE: The reason {<K>: <V>} was not chosen as pair format is
      // because this limits type of keys since property names have to be Strings.
      putAll: function(pairs, opts) {
        var ctx = u.context(BIG);
        logger.debugl(function() { return ['Invoke putAll(msgId=%d,pairs=%s,opts=%s)',
                                           ctx.id, JSON.stringify(pairs), JSON.stringify(opts)]; });
        return future(ctx, 0x2D, p.encodeMultiKeyValue(pairs, opts), p.complete(_.constant(undefined)), opts);
      },
      getBulk: function(count) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke getBulk(msgId=%d,count=%d)', ctx.id, count);
        return future(ctx, 0x19, p.encodeNum(f.existy(count) ? count : 0), p.decodeValues);
      },
      getBulkKeys: function(count) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke getBulkKeys(msgId=%d,count=%d)', ctx.id, count);
        return future(ctx, 0x1D, p.encodeNum(f.existy(count) ? count : 0), p.decodeKeys);
      },
      iterator: function(batchSize, opts) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke iterator(msgId=%d,batchSize=%d,opts=%s)', ctx.id, batchSize, u.str(opts));
        var remote = future(ctx, 0x31, p.encodeIterStart(batchSize, opts), p.decodeIterId);
        return remote.then(function(result) {
          return iterator(result.iterId, result.conn);
        });
      },
      size: function() {
        var ctx = u.context(TINY);
        logger.debugf('Invoke size(msgId=%d)', ctx.id);
        return futureDecodeOnly(ctx, 0x29, p.decodeVInt);
      },
      clear: function() {
        var ctx = u.context(TINY);
        logger.debugf('Invoke clear(msgId=%d)', ctx.id);
        return futureEmpty(ctx, 0x13);
      },
      ping: function() {
        var ctx = u.context(TINY);
        logger.debugf('Invoke ping(msgId=%d)', ctx.id);
        return futureEmpty(ctx, 0x17);
      },
      stats: function() {
        var ctx = u.context(TINY);
        logger.debugf('Invoke stats(msgId=%d)', ctx.id);
        return futureDecodeOnly(ctx, 0x15, p.decodeStringPairs);
      },
      // Add an event listener. Possible events currently are: 'create',
      // 'modify', 'remove' and 'expiry'. Method returns a Promise with
      // the id of the listener. Each listener can listen for multiple events,
      // using the listener id received in the first call to register interest
      // for multiple events.
      addListener: function(event, listener, opts) {
        var ctx = u.context(SMALL);
        return _.has(opts, 'listenerId')
            ? addLocalListener(ctx, event, listener, opts)
            : addRemoteListener(ctx, event, listener, opts);
      },
      // Remove a listener. If event is provided, only the listener's
      // registration with that event is removed. Returns true if listeners
      // removed, false otherwise.
      removeListener: function(listenerId, event) {
        if (f.existy(event)) {
          // TODO: Remove locally only...
          //p.removeListeners(listenerId);
          //return true;
        } else {
          var ctx = u.context(SMALL);
          logger.debugf('Invoke removeListener(msgId=%d,listenerId=%s) remotely', ctx.id, listenerId);
          var conn = p.findConnectionListener(listenerId);
          if (!f.existy(conn))
            return Promise.reject(
              new Error('No server connection for listener (listenerId=' + listenerId + ')'));

          var remote = futurePinned(ctx, 0x27, p.encodeListenerId(listenerId), p.complete(p.hasSuccess), conn);
          return remote.then(function (success) {
            if (success) {
              p.removeListeners(listenerId);
              return true;
            }
            return false;
          })
        }
      },
      addScript: function(scriptName, script) {
        var encodedScriptName = asJBossString(scriptName, TINY);
        var encodedScript = asJBossString(script, MEDIUM);
        var scriptClientOpts = f.merge(clientOpts, {cacheName: '___script_cache'});
        var scriptClient = new Client(addrs, scriptClientOpts);
        return scriptClient.connect().then(function(c) {
          return c.put(encodedScriptName, encodedScript)
              .finally(function() { return c.disconnect(); })
        });
      },
      execute: function(scriptName, params) {
        var ctx = u.context(SMALL);
        logger.debugf('Invoke execute(msgId=%d,scriptName=%s,params=%s)', ctx.id, scriptName, u.str(params));
        return future(ctx, 0x2B, p.encodeNameParams(scriptName, params), p.decodeValue);
      },
      getTopologyInfo: function() {
        return new TopologyInfo(transport);
      }
    }
  };

  var TopologyInfo = function(transport) {
    return {
      getTopologyId: function() {
        return transport.getTopologyId();
      },
      getMembers: function() {
        return transport.getMembers();
      },
      findOwners: function(k) {
        return transport.findOwners(k);
      }
    }
  };

  // Different formats:
  //
  // client({port: 11222, host: 'localhost'})
  // client([{port: 11322, host: 'node1'}, {port: 11422, host: 'node2'}])
  //
  exports.client = function client(args, options) {
    var merged = f.merge(Client.config, options);
    var c = new Client(u.normalizeAddresses(args), merged);
    return c.connect();
  };

  Client.config = {
    version: '2.5',         // Hot Rod protocol version
    cacheName: undefined    // Cache name
  };

}.call(this));
