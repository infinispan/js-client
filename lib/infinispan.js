'use strict';

(function() {

  var _ = require('underscore');
  var net = require('net');
  var Promise = require('promise');

  var f = require('./functional');
  var codec = require('./codec');
  var utils = require('./utils');

  // TODO: Move?
  function totalBytes(values, state) {
    // If buffer is too big, slice it up so that it can be sent
    // immediately without any further modifications.
    var bytes = values[values.length - 1];
    if (bytes < state.buf.length)
      state.buf = state.buf.slice(0, bytes);

    return bytes;
  }

  // TODO: Move?
  function decodedValues(values, state) {
    return values;
  }

  // TODO: Move?
  function decodedLast(values, state) {
    return values[0];
  }

  var PUT = 0x01, GET = 0x03
    , PUT_IF_ABSENT = 0x05, REPLACE = 0x07
    , REPLACE_WITH_VERSION = 0x09, REMOVE = 0x0B
    , REMOVE_WITH_VERSION = 0x0D, CONTAINS_KEY = 0x0F
    , GET_VERSIONED = 0x11, CLEAR = 0x13
    , STATS = 0x15, PING = 0x17
    , GET_BULK = 0x19, GET_WITH_META = 0x1B
    , GET_BULK_KEYS = 0x1D, QUERY = 0x1F
    , AUTH_MECH = 0x21, AUTH_REQ = 0x23
    , ADD_LISTENER_IN = 0x25, REMOVE_LISTENER = 0x27
    , SIZE = 0x29, EXEC = 0x2B
    , PUT_ALL = 0x2D, GET_ALL = 0x2F
    , IT_START = 0x31, IT_NEXT = 0x33, IT_END = 0x35
    , ERROR = 0x50;

  var Protocol = function() {
    var MAGIC = 0xA0;
    var VERSION = 23;
    // Status codes
    var SUCCESS = 0x00, NOT_EXECUTED = 0x01, NOT_FOUND = 0x02,
        SUCCESS_WITH_PREV = 0x03, NOT_EXECUTED_WITH_PREV = 0x04;

    var DECODE_OBJECT = f.actions([codec.decodeObject()], decodedValues); // TODO: Could just return the single decoded value
    var DECODE_VERSIONED = f.actions([codec.decodeBytes(8), codec.decodeObject()], decodedValues);
    var DECODE_VINT = f.actions([codec.decodeVInt()], decodedLast);
    var DECODE_PAIR = f.actions([codec.decodeObject(), codec.decodeObject()], decodedValues);

    function op(header) { return header[2] - 1; }
    function status(header) { return header[3]; }

    function decodeError(bytebuf) {
      return new Error(DECODE_OBJECT(bytebuf)[0]);
    }

    function decodeValue(status, bytebuf) {
      return isSuccess(status) ? DECODE_OBJECT(bytebuf)[0] : undefined;
    }

    function decodeValues(bytebuf) {
      var count = DECODE_VINT(bytebuf);
      return _.map(_.range(count), function() {
        var pair = DECODE_PAIR(bytebuf);
        return {key: pair[0], value: pair[1]};
      });
    }

    function decodeVersioned(status, bytebuf) {
      if (isSuccess(status)) {
        var decoded = DECODE_VERSIONED(bytebuf);
        return {version: decoded[0], value: decoded[1]};
      }
      return undefined;
    }

    function isSuccess(status) {
      return status == SUCCESS || status == SUCCESS_WITH_PREV;
    }

    function isNotExecuted(status) {
      return status == NOT_EXECUTED || status == NOT_EXECUTED_WITH_PREV;
    }

    function tryDecodePrev(needsPrevDecode, bytebuf) {
      return function(status) {
        if (needsPrevDecode(status)) {
          var prev = DECODE_OBJECT(bytebuf)[0];
          return _.isEmpty(prev) ? undefined : prev;
        }
        return undefined;
      }
    }

    function decodePrevOrElse(status, opts, orElse, decodePrev) {
      if (hasOptPrev(opts)) return decodePrev(status);
      return orElse(status);
    }

    function hasOptPrev(opts) {
      return _.has(opts, 'previous') && f.thuthy(opts['previous']);
    }

    function encodeFlags(opts) {
      return hasOptPrev(opts) ? 0x01 : 0;
    }

    return {
      header: function (op, opts) {
        return function(id) {
          var flags = encodeFlags(opts);
          return [
            codec.encodeUByte(MAGIC),                       // magic
            codec.encodeVLong(id),                          // msg id
            codec.encodeUByte(VERSION),                     // version
            codec.encodeUByte(op),                          // op code
            codec.encodeVInt(0),                            // cache name length
            codec.encodeVInt(f.existy(flags) ? flags : 0),  // flags
            codec.encodeUByte(1),                           // basic client intelligence
            codec.encodeVInt(0)                             // client topology id
          ];
        }
      },
      key: function (k) {
        return function() {
          return [codec.encodeObject(k)]; // key
        }
      },
      keyVersion: function (k, version) {
        return function() {
          return [codec.encodeObject(k), codec.encodeBytes(version)]; // key + version
        }
      },
      keyValue: function (k, v) {
        return function() {
          return [
            codec.encodeObject(k),     // key
            codec.encodeUByte(0x88),   // infinite lifespan & max idle
            codec.encodeObject(v)      // value
          ];
        }
      },
      keyValueVersion: function (k, v, version) {
        return function() {
          return [
            codec.encodeObject(k),          // key
            codec.encodeUByte(0x88),        // infinite lifespan & max idle
            codec.encodeBytes(version),     // version
            codec.encodeObject(v)           // value
          ];
        }
      },
      multiKey: function (keys) {
        return function() {
          var base = [
            codec.encodeVInt(_.size(keys))           // key count
          ];
          var withKeys = _.map(keys, function (key) {
            return codec.encodeObject(key);      // key
          });

          return f.cat(base, withKeys);
        };
      },
      multiKeyValue: function (pairs) {
        return function() {
          var base = [
            codec.encodeUByte(0x88),      // infinite lifespan & max idle
            codec.encodeVInt(_.size(pairs)) // entry count
          ];
          var withPairs = _.map(pairs, function (pair) {
            return [
              codec.encodeObject(pair.key),    // key
              codec.encodeObject(pair.value)   // value
            ]
          });

          return f.cat(base, _.flatten(withPairs));
        };
      },
      decodeHeader: function() {
        // TODO: Cache?
        return [
          codec.decodeUByte(), // magic
          codec.decodeUByte(), // msg id
          codec.decodeUByte(), // op code
          codec.decodeUByte(), // status
          codec.decodeUByte()  // topology change marker
        ];
      },
      msgId: function(header) {
        return header[1];
      },
      decodeBody: function(header, bytebuf, opts) {
        // Prefer switch to functional dispatch for better handling of
        // undefined return values, e.g. get() since functional dispatch uses
        // undefined return of function application to try next function
        switch (op(header)) {
          case GET:
            return decodeValue(status(header), bytebuf);
          case GET_VERSIONED:
            return decodeVersioned(status(header), bytebuf);
          case PUT:
            return decodePrevOrElse(status(header), opts, _.constant(undefined), tryDecodePrev(isSuccess, bytebuf));
          case PUT_IF_ABSENT:
            return decodePrevOrElse(status(header), opts, isSuccess, tryDecodePrev(isNotExecuted, bytebuf));
          case REMOVE:
          case REPLACE:
          case REPLACE_WITH_VERSION:
          case REMOVE_WITH_VERSION:
            return decodePrevOrElse(status(header), opts, isSuccess, tryDecodePrev(isSuccess, bytebuf));
          case GET_ALL:
            return decodeValues(bytebuf);
          case ERROR:
            throw decodeError(bytebuf);
          default:
            return undefined;
        }
      }
    };
  };

  var Connection = function() {
    var _client = new net.Socket();
    var _reqResMap = utils.keyValueMap();
    var _protocol = new Protocol();

    return {
      connect: function(client, host, port) {
        return new Promise(function (succeed, fail) {
          _client.connect(port, host, function() {
            console.log('Connected');
            succeed(client);
          });
          _client.on('error', function(err){
            console.log('Error: ' + err.message);
            fail(err);
          });
          _client.on('data', function(data) {
            var decodeHeaderChain = f.actions(_protocol.decodeHeader(), decodedValues);
            var bytebuf = {buf: data, offset: 0};
            var header = decodeHeaderChain(bytebuf);
            var msgId = _protocol.msgId(header);

            var p = _reqResMap.get(msgId);
            try {
              var result = _protocol.decodeBody(header, bytebuf, p.opts);
              p.success(result);
            } catch (ex) {
              p.fail(ex.message);
            } finally {
              _reqResMap.remove(msgId);
            }
          })
        });
      },
      write: function(id, buffer, opts) {
        return new Promise(function (fulfill, reject) {
          _client.write(buffer);
          _reqResMap.put(id, {success: fulfill, fail: reject, opts: opts});
        });
      }
    };
  };

  var Client = function(host, port) {
    // TODO: Adjust buffer sizes once resizing has been implemented (16/32/64)
    var TINY = 128, SMALL = 128, MEDIUM = 128, BIG = 128;
    var msgIdCounter = utils.counter(0);
    var connect = new Connection();
    var p = new Protocol();

    // Context contains a byte buffer (buffer + offset) and generated message id
    function ctx(size) {
      return {buf: new Buffer(size), offset: 0, id: msgIdCounter.incr()};
    }

    function write(opts) {
      return function(ctx) {
        return connect.write(ctx.id, ctx.buf, opts);
      }
    }

    function encode(header, body) {
      return function(ctx) {
        var acts = f.existy(body) ? f.cat(header(ctx.id), body()) : header(ctx.id);
        f.actions(acts, totalBytes)(ctx);
        return ctx;
      }
    }

    function future(size, op, body, opts) {
      return f.pipeline(ctx(size), encode(p.header(op, opts), body), write(opts));
    }

    return {
      connect: function() {
        // TODO: Avoid user calling connect by checking if connected
        return connect.connect(this, host, port);
      },
      get: function(k) {
        return future(SMALL, GET, p.key(k));
      },
      getVersioned: function(k) {
        return future(SMALL, GET_VERSIONED, p.key(k));
      },
      // Returns undefined.
      // With previous option returns previous value or undefined if no previous value.
      put: function(k, v, opts) {
        return future(MEDIUM, PUT, p.keyValue(k, v), opts);
      },
      // Returns true removed, false if not removed because key did not exist.
      // With previous option returns the removed value, or undefined if the key did not exist.
      remove: function(k, opts) {
        return future(SMALL, REMOVE, p.key(k), opts);
      },
      // Returns true if absent, false if present.
      // With previous option returns undefined if absent and a non-null value if present.
      putIfAbsent: function(k, v, opts) {
        return future(MEDIUM, PUT_IF_ABSENT, p.keyValue(k, v), opts);
      },
      // Returns true if replaced, false if not replaced because key does not exist.
      // With previous option returns the non-null value that was replaced, otherwise it returns undefined.
      replace: function(k, v, opts) {
        return future(MEDIUM, REPLACE, p.keyValue(k, v), opts);
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
        return future(MEDIUM, REPLACE_WITH_VERSION, p.keyValueVersion(k, v, version), opts);
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
        return future(SMALL, REMOVE_WITH_VERSION, p.keyVersion(k, version), opts);
      },
      // Returns an array of {key: <K>, value: <V>} pairs
      // TODO: Validate empty
      getAll: function(keys, opts) {
        return future(MEDIUM, GET_ALL, p.multiKey(keys), opts);
      },
      // Stores an array of key/value pairs where each pair is defined as {key: <K>, value: <V>}
      // API NOTE: The reason {<K>: <V>} was not chosen as pair format is
      // because this limits type of keys since property names have to be Strings.
      putAll: function(pairs, opts) {
        return future(BIG, PUT_ALL, p.multiKeyValue(pairs), opts);
      },
      clear: function () {
        return future(TINY, CLEAR);
      },
      ping: function () {
        return future(TINY, PING);
      }
    }
  };

  exports.client = client;
  function client(port, host/*, validator */) {
    var c = new Client(host, port);
    return c.connect();
  }

}.call(this));
