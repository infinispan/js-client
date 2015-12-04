'use strict';

(function() {

  var _ = require('underscore');
  var net = require('net');
  var Promise = require('promise');

  var f = require('./functional');
  var codec = require('./codec');
  var utils = require('./utils');
  var protocols = require('./protocols');

  var Connection = function(p) {
    var _client = new net.Socket();
    var _reqResMap = utils.keyValueMap();

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
            var decodeHeaderChain = f.actions(p.decodeHeader(), codec.allDecoded);
            var bytebuf = {buf: data, offset: 0};
            var header = decodeHeaderChain(bytebuf);
            var msgId = p.getMsgId(header);

            var promise = _reqResMap.get(msgId);
            try {
              if (p.hasError(header)) {
                p.decodeError(bytebuf);
              } else {
                var decoder = promise.decoder;
                var result = f.existy(decoder) ? decoder(header, bytebuf) : undefined;
                promise.success(result);
              }
            } catch (ex) {
              promise.fail(ex.message);
            } finally {
              _reqResMap.remove(msgId);
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
          _client.write(buffer);
          _reqResMap.put(id, {success: fulfill, fail: reject, decoder: decoder});
        });
      }
    };
  };

  var Client = function(host, port, options) {

    var protocolResolver = function(version) {
      switch (version) {
        case '2.3': return protocols.version23();
        case '2.2': return protocols.version22();
        default : throw new Error('Unknown protocol version: ' + version);
      }
    }

    var p = protocolResolver(options['version']);

    // TODO: Adjust buffer sizes once resizing has been implemented (16/32/64/128)
    var TINY = 128, SMALL = 128, MEDIUM = 128, BIG = 128;
    var msgIdCounter = utils.counter(0);
    var connect = new Connection(p);

    // Context contains a byte buffer (buffer + offset) and generated message id
    function ctx(size) {
      return {buf: new Buffer(size), offset: 0, id: msgIdCounter.incr()};
    }

    function write(decoder) {
      return function(ctx) {
        return connect.write(ctx.id, ctx.buf, decoder);
      }
    }

    function encode(header, body) {
      return function(ctx) {
        var acts = f.existy(body) ? f.cat(header(ctx.id), body()) : header(ctx.id);
        f.actions(acts, codec.bytesEncoded)(ctx);
        return ctx;
      }
    }

    function future(size, op, body, decoder, opts) {
      return f.pipeline(ctx(size), encode(p.encodeHeader(op, opts), body), write(decoder));
    }

    return {
      connect: function() {
        // TODO: Avoid user calling connect by checking if connected
        return connect.connect(this, host, port);
      },
      disconnect: function() {
        return connect.disconnect();
      },
      get: function(k) {
        return future(SMALL, 0x03, p.encodeKey(k), p.decodeValue);
      },
      containsKey: function(k) {
        return future(SMALL, 0x0F, p.encodeKey(k), p.hasSuccess);
      },
      getVersioned: function(k) {
        return future(SMALL, 0x11, p.encodeKey(k), p.decodeVersioned);
      },
      // Returns undefined.
      // With previous option returns previous value or undefined if no previous value.
      put: function(k, v, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, _.constant(undefined));
        return future(MEDIUM, 0x01, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true removed, false if not removed because key did not exist.
      // With previous option returns the removed value, or undefined if the key did not exist.
      remove: function(k, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.hasSuccess);
        return future(SMALL, 0x0B, p.encodeKey(k), decoder, opts);
      },
      // Returns true if absent, false if present.
      // With previous option returns undefined if absent and a non-null value if present.
      putIfAbsent: function(k, v, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasNotExecuted, p.hasSuccess);
        return future(MEDIUM, 0x05, p.encodeKeyValue(k, v, opts), decoder, opts);
      },
      // Returns true if replaced, false if not replaced because key does not exist.
      // With previous option returns the non-null value that was replaced, otherwise it returns undefined.
      replace: function(k, v, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.hasSuccess);
        return future(MEDIUM, 0x07, p.encodeKeyValue(k, v, opts), decoder, opts);
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
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.hasSuccess);
        return future(MEDIUM, 0x09, p.encodeKeyValueVersion(k, v, version, opts), decoder, opts);
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
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.hasSuccess);
        return future(SMALL, 0x0D, p.encodeKeyVersion(k, version), decoder, opts);
      },
      // Returns an array of {key: <K>, value: <V>} pairs
      getAll: function(keys, opts) {
        // TODO: Validate empty keys
        return future(MEDIUM, 0x2F, p.encodeMultiKey(keys), p.decodeValues, opts);
      },
      // Stores an array of key/value pairs where each pair is defined as {key: <K>, value: <V>}
      // API NOTE: The reason {<K>: <V>} was not chosen as pair format is
      // because this limits type of keys since property names have to be Strings.
      putAll: function(pairs, opts) {
        return future(BIG, 0x2D, p.encodeMultiKeyValue(pairs, opts), _.constant(undefined), opts);
      },
      clear: function () { return future(TINY, 0x13); },
      ping: function () { return future(TINY, 0x17); }
    }
  };

  exports.client = function client(port, host, options) {
    var merged = f.merge(Client.config, options);
    //console.log("Merged options: " + JSON.stringify(merged));
    var c = new Client(host, port, merged);
    return c.connect();
  }

  Client.config = {
      version: '2.3'         // Hot Rod protocol version
  };

}.call(this));
