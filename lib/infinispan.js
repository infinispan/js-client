'use strict';

(function() {

  var _ = require('underscore');
  var net = require('net');
  var Promise = require('promise');

  var f = require('./functional');
  var codec = require('./codec');
  var u = require('./utils');
  var protocols = require('./protocols');

  var Connection = function(p, logger) {
    var _client = new net.Socket();
    var _reqResMap = u.keyValueMap();

    var DECODE_HEADER = f.actions(p.decodeHeader(), codec.allDecoded);

    var replayable = u.replayableBuffer();

    function decodeHeader(bytebuf) {
      try {
        return DECODE_HEADER(bytebuf);
      } catch(ex) {
        logger.error('Error decoding header, message id unknown:', ex);
        throw ex;
      }
    }

    // TODO: Decode body and event are v similar, refactor...
    // e.g. body works with promise completions, and event works with normal function calls
    function decodeBody(header, promise, bytebuf) {
      var msgId = p.getMsgId(header);
      if (p.hasError(header)) {
        p.decodeError(bytebuf);
        return false;
      } else {
        var decoder = promise.decoder;
        logger.tracef('Call decode for request(msgId=%d)', msgId);
        if (f.existy(decoder)) {
          var decoded = decoder(promise, header, bytebuf);
          if (!decoded) {
            logger.tracef("Incomplete response, rewind buffer and wait more data");
            replayable.rewind();
            return true;
          }  else {
            // TODO: Temporary, update offset after reading all the data
            replayable.fromByteBuf(bytebuf);
            return false;
          }
        } else {
          logger.tracef('Complete promise for request(msgId=%d) with undefined', msgId);
          promise.success(undefined);
          // TODO: Temporary, update offset after reading all the data
          replayable.fromByteBuf(bytebuf);
          return false;
        }
      }
    }

    function decodeEvent(header, bytebuf) {
      var decoded = p.decodeEvent(header, bytebuf);
      if (!decoded) {
        logger.tracef("Incomplete event, rewind buffer and wait more data");
        replayable.rewind();
        return true;
      }  else {
        // TODO: Temporary, update offset after reading all the data
        replayable.fromByteBuf(bytebuf);
        return false;
      }
    }

    return {
      connect: function(client, host, port) {
        return new Promise(function (succeed, fail) {
          _client.connect(port, host, function() {
            //console.log('Connected');
            succeed(client);
          });
          _client.on('error', function(err){
            //console.log('Error: ' + err.message);
            fail(err);
          });
          _client.on('end', function() {
            //console.log('Disconnected');
          });
          _client.on('data', function(data) {
            replayable.append(data);
            var incomplete = false;
            while (!replayable.isEmpty() && !incomplete) {
              var bytebuf = replayable.asByteBuf();
              replayable.mark();
              var header = decodeHeader(bytebuf);
              var msgId = p.getMsgId(header);
              logger.tracef("Read header(msgId=%d): [%s]", msgId, header);
              if (p.isEvent(header)) {
                try {
                  incomplete = decodeEvent(header, bytebuf);
                } catch (ex) {
                  logger.error('Error decoding body of event(msgId=%d):', msgId, ex);
                } finally {
                  if (!incomplete) {
                    logger.tracef("After decoding request(msgId=%d), buffer size is %d, and offset %d",
                                  msgId, bytebuf.buf.length, bytebuf.offset);
                    replayable.trim();
                  }
                }
              } else {
                var promise = _reqResMap.get(msgId);
                try {
                  incomplete = decodeBody(header, promise, bytebuf);
                } catch (ex) {
                  logger.error('Error decoding body of request(msgId=%d):', msgId, ex);
                  promise.fail(ex.message);
                } finally {
                  if (!incomplete) {
                    _reqResMap.remove(msgId);
                    logger.tracef("After decoding request(msgId=%d), buffer size is %d, and offset %d",
                                  msgId, bytebuf.buf.length, bytebuf.offset);
                    replayable.trim();
                  }
                }
              }
            }
          })
        });
      },
      disconnect: function() {
        return new Promise(function (fulfill, reject) {
          _client.end();
          fulfill();
        });
      },
      write: function(id, buffer, decoder) {
        return new Promise(function (fulfill, reject) {
          logger.tracef('Write buffer(msgId=%d)', id);
          _client.write(buffer);
          _reqResMap.put(id, {success: fulfill, fail: reject, decoder: decoder});
        });
      }
    };
  };



  var Client = function(host, port, clientOpts) {
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
    var msgIdCounter = u.counter(0);
    var connect = new Connection(p, logger);

    // Context contains a byte buffer (buffer + offset) and generated message id
    function context(size) {
      return {buf: new Buffer(size), offset: 0, id: msgIdCounter.incr()};
    }

    function write(ctx, decoder) {
      return connect.write(ctx.id, ctx.buf, decoder);
    }

    function encode(ctx, header, body) {
      var acts = f.existy(body) ? f.cat(header(ctx.id), body()) : header(ctx.id);
      f.actions(acts, codec.bytesEncoded)(ctx);
      return ctx;
    }

    function future(ctx, op, body, decoder, opts) {
      var encoded = encode(ctx, p.encodeHeader(op, opts), body);
      return write(encoded, decoder);
    }

    function iterator(iterId) {
      var nextElems = [];
      var done = false;

      function nextPromise() {
        var kv = nextElems.pop();
        return new Promise(function (fulfill, reject) {
          fulfill(_.extend({done: done}, kv));
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
            var ctx = context(SMALL);
            logger.tracef('Invoke iterator.next(msgId=%d,iteratorId=%s)', ctx.id, iterId);
            var remote = future(ctx, 0x33, p.encodeIterId(iterId), p.decodeNextEntries);
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
          var ctx = context(SMALL);
          logger.debugf('Invoke iterator.close(msgId=%d,iteratorId=%s)', ctx.id, iterId);
          return future(ctx, 0x35, p.encodeIterId(iterId), p.complete(p.hasSuccess));
        }
      }
    }

    return {
      connect: function() {
        // TODO: Avoid user calling connect by checking if connected
        logger.debugf('Connect to %s:%d', host, port);
        return connect.connect(this, host, port);
      },
      disconnect: function() {
        logger.debugf('Disconnect');
        return connect.disconnect();
      },
      get: function(k) {
        var ctx = context(SMALL);
        logger.debugf('Invoke get(msgId=%d,key=%s)', ctx.id, k);
        return future(ctx, 0x03, p.encodeKey(k), p.decodeValue);
      },
      containsKey: function(k) {
        var ctx = context(SMALL);
        logger.debugf('Invoke containsKey(msgId=%d,key=%s)', ctx.id, k);
        return future(ctx, 0x0F, p.encodeKey(k), p.complete(p.hasSuccess));
      },
      getVersioned: function(k) {
        var ctx = context(SMALL);
        logger.debugf('Invoke getVersioned(msgId=%d,key=%s)', ctx.id, k);
        return future(ctx, 0x11, p.encodeKey(k), p.decodeVersioned);
      },
      getWithMetadata: function(k) {
        var ctx = context(SMALL);
        logger.debugf('Invoke getWithMetadata(msgId=%d,key=%s)', ctx.id, k);
        return future(ctx, 0x1B, p.encodeKey(k), p.decodeWithMeta);
      },
      // Returns undefined.
      // With previous option returns previous value or undefined if no previous value.
      put: function(k, v, opts) {
        var ctx = context(MEDIUM);
        logger.debugl(function() { return ['Invoke put(msgId=%d,key=%s,value=%s,opts=%s)',
                                           ctx.id, k, u.str(v), u.str(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.complete(_.constant(undefined)));
        return future(ctx, 0x01, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true removed, false if not removed because key did not exist.
      // With previous option returns the removed value, or undefined if the key did not exist.
      remove: function(k, opts) {
        var ctx = context(SMALL);
        logger.debugl(function() {return ['Invoke remove(msgId=%d,key=%s,opts=%s)',
                                          ctx.id, k, JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.complete(p.hasSuccess));
        return future(ctx, 0x0B, p.encodeKey(k), decoder, opts);
      },
      // Returns true if absent, false if present.
      // With previous option returns undefined if absent and a non-null value if present.
      putIfAbsent: function(k, v, opts) {
        var ctx = context(MEDIUM);
        logger.debugl(function() {return ['Invoke putIfAbsent(msgId=%d,key=%s,value=%s,opts=%s)',
                                          ctx.id, k, v, JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasNotExecuted, p.complete(p.hasSuccess));
        return future(ctx, 0x05, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true if replaced, false if not replaced because key does not exist.
      // With previous option returns the non-null value that was replaced, otherwise it returns undefined.
      replace: function(k, v, opts) {
        var ctx = context(MEDIUM);
        logger.debugl(function() { return ['Invoke replace(msgId=%d,key=%s,value=%s,opts=%s)',
                                           ctx.id, k, v, JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasPrevious, p.complete(p.hasSuccess));
        return future(ctx, 0x07, p.encodeKeyValue(k, v, opts), decoder, opts);
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
        var ctx = context(MEDIUM);
        logger.debugl(function() { return ['Invoke replaceWithVersion(msgId=%d,key=%s,value=%s,version=0x%s,opts=%s)',
                                           ctx.id, k, v, version.toString('hex'), JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasPrevious, p.complete(p.hasSuccess));
        return future(ctx, 0x09, p.encodeKeyValueVersion(k, v, version, opts), decoder, opts);
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
        var ctx = context(SMALL);
        logger.debugl(function() { return ['Invoke removeWithVersion(msgId=%d,key=%s,version=0x%s,opts=%s)',
                                           ctx.id, k, version.toString('hex'), JSON.stringify(opts)]; });
        var decoder = p.decodePrevOrElse(opts, p.hasPrevious, p.complete(p.hasSuccess));
        return future(ctx, 0x0D, p.encodeKeyVersion(k, version), decoder, opts);
      },
      // Returns an array of {key: <K>, value: <V>} pairs
      getAll: function(keys, opts) {
        var ctx = context(MEDIUM);
        logger.debugl(function() { return ['Invoke getAll(msgId=%d,keys=[%s],opts=%s)',
                                           ctx.id, keys, JSON.stringify(opts)]; });
        // TODO: Validate empty keys
        return future(ctx, 0x2F, p.encodeMultiKey(keys), p.decodeCountValues, opts);
      },
      // Stores an array of key/value pairs where each pair is defined as {key: <K>, value: <V>}
      // API NOTE: The reason {<K>: <V>} was not chosen as pair format is
      // because this limits type of keys since property names have to be Strings.
      putAll: function(pairs, opts) {
        var ctx = context(BIG);
        logger.debugl(function() { return ['Invoke putAll(msgId=%d,pairs=%s,opts=%s)',
                                           ctx.id, JSON.stringify(pairs), JSON.stringify(opts)]; });
        return future(ctx, 0x2D, p.encodeMultiKeyValue(pairs, opts), p.complete(_.constant(undefined)), opts);
      },
      getBulk: function(count) {
        var ctx = context(SMALL);
        logger.debugf('Invoke getBulk(msgId=%d,count=%d)', ctx.id, count);
        return future(ctx, 0x19, p.encodeNum(f.existy(count) ? count : 0), p.decodeValues);
      },
      getBulkKeys: function(count) {
        var ctx = context(SMALL);
        logger.debugf('Invoke getBulkKeys(msgId=%d,count=%d)', ctx.id, count);
        return future(ctx, 0x1D, p.encodeNum(f.existy(count) ? count : 0), p.decodeKeys);
      },
      iterator: function(batchSize, opts) {
        var ctx = context(SMALL);
        logger.debugf('Invoke iterator(msgId=%d,batchSize=%d,opts=%s)', ctx.id, batchSize, u.str(opts));
        var remote = future(ctx, 0x31, p.encodeIterStart(batchSize, opts), p.decodeIterId);
        return remote.then(function(iterId) {
          return iterator(iterId);
        });
      },
      size: function() {
        var ctx = context(TINY);
        logger.debugf('Invoke size(msgId=%d)', ctx.id);
        return future(ctx, 0x29, undefined, p.decodeVInt);
      },
      clear: function () {
        var ctx = context(TINY);
        logger.debugf('Invoke clear(msgId=%d)', ctx.id);
        return future(ctx, 0x13);
      },
      ping: function () {
        var ctx = context(TINY);
        logger.debugf('Invoke ping(msgId=%d)', ctx.id);
        return future(ctx, 0x17);
      },
      // Add an event listener. Possible events currently are: 'create',
      // 'modify', 'remove' and 'expiry'. Method returns a Promise with
      // the id of the listener. Each listener can listen for multiple events,
      // using the listener id received in the first call to register interest
      // for multiple events.
      // TODO: Move to opts to include listener id, include state...etc
      addListener: function(event, listener, opts) {
        var ctx = context(SMALL);
        if (_.has(opts, 'listenerId')) {
          logger.debugl(function() { return ['Invoke addListener(msgId=%d,event=%s,opts=%s) locally',
              ctx.id, event, JSON.stringify(opts)]; });
          return new Promise(function (fulfill, reject) {
            p.addListener(event, listener, opts.listenerId);
            fulfill(opts.listenerId);
          });
        }

        var listenerId = u.guid();
        logger.debugl(function() {return ['Invoke addListener(msgId=%d,event=%s,listenerId=%s,opts=%s) remotely',
                  ctx.id, event, listenerId, JSON.stringify(opts)]; });
        var remote = future(ctx, 0x25, p.encodeListenerAdd(listenerId, opts), p.complete(p.hasSuccess));
        // Listener needs to be registered in advance since events might come
        // before reply from server to add listener, e.g. when include state
        // is enabled. To avoid leaking listeners, remove listener if there's
        // any problem.
        p.addListener(event, listener, listenerId);
        return remote
            .then(function(success) { return success ? listenerId : p.removeListeners(listenerId); })
            .catch(function(err) { p.removeListeners(listenerId); });
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
          var ctx = context(SMALL);
          logger.debugf('Invoke removeListener(msgId=%d,listenerId=%s) remotely', ctx.id, listenerId);
          var remote = future(ctx, 0x27, p.encodeListenerId(listenerId), p.complete(p.hasSuccess));
          return remote.then(function (success) {
            if (success) {
              p.removeListeners(listenerId);
              return true;
            }
            return false;
          })
        }
      }
    }
  };

  exports.client = function client(port, host, options) {
    var merged = f.merge(Client.config, options);
    var c = new Client(host, port, merged);
    return c.connect();
  };

  Client.config = {
    version: '2.5',         // Hot Rod protocol version
    cacheName: undefined    // Cache name
  };

}.call(this));
