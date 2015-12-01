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

    function isSuccess(status) {
      return status == SUCCESS || status == SUCCESS_WITH_PREV;
    }

    function isNotExecuted(status) {
      return status == NOT_EXECUTED || status == NOT_EXECUTED_WITH_PREV;
    }

    function decodePrev(bytebuf) {
      var prev = DECODE_OBJECT(bytebuf)[0];
      return _.isEmpty(prev) ? undefined : prev;
    }

    function hasOptPrev(opts) {
      return _.has(opts, 'previous') && f.thuthy(opts['previous']);
    }

    function encodeFlags(opts) {
      return hasOptPrev(opts) ? 0x01 : 0;
    }

    function encodeExpiry(opts) {
      if (f.existy(opts)) {
        var lifespan = parseDuration(opts['lifespan']);
        var maxIdle = parseDuration(opts['maxIdle']);
        // The way lifespan/maxIdle definitions are interleaved is messy :|
        var steps = [codec.encodeUByte(lifespan[1] << 4 | maxIdle[1])];
        if (f.existy(lifespan[0])) steps.push(codec.encodeVInt(lifespan[0]));
        if (f.existy(maxIdle[0])) steps.push(codec.encodeVInt(maxIdle[0]));
        return steps;
      }
      return [codec.encodeUByte(0x77)]; // default lifespan & max idle
    }

    function parseDuration(d) {
      if (!f.existy(d)) {
        return [undefined, 7];
      } else if(_.isNumber(d)) {
        // Numeric durations only allowed to describe infinite (negative) or default durations (0)
        if (d < 0) return [undefined, 8];
        else if (d == 0) return [undefined, 7];
        else throw new Error('Positive duration provided without time unit: ' + d);
      } else {
        var splitter = /(\d+)[\s,]*([a-zμ]+)/g;
        var matches = splitter.exec(d);
        if (f.existy(matches))
          return [parseInt(matches[1]), timeUnitToByte(matches[2])];
        else
          throw new Error('Unknown duration format for ' + d);
      }
    }

    function timeUnitToByte(unit) {
      switch (unit) {
        case 's': return 0;
        case 'ms': return 1;
        case 'ns': return 2;
        case 'μs': return 3;
        case 'm': return 4;
        case 'h': return 5;
        case 'd': return 6;
        default: // TODO: Could it be caught in regular expression?
          throw new Error('Unknown duration unit in ' + unit);
      }
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
      keyValue: function (k, v, opts) {
        return function() {
          return f.cat(
            [codec.encodeObject(k)],  // key
            encodeExpiry(opts),       // lifespan & max idle
            [codec.encodeObject(v)]   // value
          );
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
      hasSuccess: function(header) {
        return isSuccess(status(header));
      },
      hasNotExecuted: function(header) {
        return isNotExecuted(status(header));
      },
      hasError: function(header) {
        return op(header) == ERROR;
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
      decodeValue: function(header, bytebuf) {
        return isSuccess(status(header)) ? DECODE_OBJECT(bytebuf)[0] : undefined;
      },
      decodeVersioned: function(header, bytebuf) {
        if (isSuccess(status(header))) {
          var decoded = DECODE_VERSIONED(bytebuf);
          return {version: decoded[0], value: decoded[1]};
        }
        return undefined;
      },
      decodePrevOrElse: function(opts, cond, orElse) {
        var isReturnPrevious = hasOptPrev(opts);
        return function(header, bytebuf) {
          if (isReturnPrevious) return cond(header) ? decodePrev(bytebuf) : undefined;
          return orElse(header);
        }
      },
      decodeValues: function(header, bytebuf) {
        var count = DECODE_VINT(bytebuf);
        return _.map(_.range(count), function() {
          var pair = DECODE_PAIR(bytebuf);
          return {key: pair[0], value: pair[1]};
        });
      },
      decodeError: function (bytebuf) {
        throw new Error(DECODE_OBJECT(bytebuf)[0]);
      },
      msgId: function(header) {
        return header[1];
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
            var decodeHeaderChain = f.actions(_protocol.decodeHeader(), decodedValues);
            var bytebuf = {buf: data, offset: 0};
            var header = decodeHeaderChain(bytebuf);
            var msgId = _protocol.msgId(header);

            var promise = _reqResMap.get(msgId);
            try {
              if (_protocol.hasError(header)) {
                _protocol.decodeError(bytebuf);
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

  var Client = function(host, port) {
    // TODO: Adjust buffer sizes once resizing has been implemented (16/32/64/128)
    var TINY = 128, SMALL = 128, MEDIUM = 128, BIG = 128;
    var msgIdCounter = utils.counter(0);
    var connect = new Connection();
    var p = new Protocol();

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
        f.actions(acts, totalBytes)(ctx);
        return ctx;
      }
    }

    function future(size, op, body, decoder, opts) {
      return f.pipeline(ctx(size), encode(p.header(op, opts), body), write(decoder));
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
        return future(SMALL, GET, p.key(k), p.decodeValue);
      },
      containsKey: function(k) {
        return future(SMALL, CONTAINS_KEY, p.key(k), p.hasSuccess);
      },
      getVersioned: function(k) {
        return future(SMALL, GET_VERSIONED, p.key(k), p.decodeVersioned);
      },
      // Returns undefined.
      // With previous option returns previous value or undefined if no previous value.
      put: function(k, v, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, _.constant(undefined));
        return future(MEDIUM, PUT, p.keyValue(k, v, opts), decoder, opts);
      },
      // Returns true removed, false if not removed because key did not exist.
      // With previous option returns the removed value, or undefined if the key did not exist.
      remove: function(k, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.hasSuccess);
        return future(SMALL, REMOVE, p.key(k), decoder, opts);
      },
      // Returns true if absent, false if present.
      // With previous option returns undefined if absent and a non-null value if present.
      putIfAbsent: function(k, v, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasNotExecuted, p.hasSuccess);
        return future(MEDIUM, PUT_IF_ABSENT, p.keyValue(k, v, opts), decoder, opts);
      },
      // Returns true if replaced, false if not replaced because key does not exist.
      // With previous option returns the non-null value that was replaced, otherwise it returns undefined.
      replace: function(k, v, opts) {
        var decoder = p.decodePrevOrElse(opts, p.hasSuccess, p.hasSuccess);
        return future(MEDIUM, REPLACE, p.keyValue(k, v, opts), decoder, opts);
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
        return future(MEDIUM, REPLACE_WITH_VERSION, p.keyValueVersion(k, v, version), decoder, opts);
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
        return future(SMALL, REMOVE_WITH_VERSION, p.keyVersion(k, version), decoder, opts);
      },
      // Returns an array of {key: <K>, value: <V>} pairs
      // TODO: Validate empty
      getAll: function(keys, opts) {
        return future(MEDIUM, GET_ALL, p.multiKey(keys), p.decodeValues, opts);
      },
      // Stores an array of key/value pairs where each pair is defined as {key: <K>, value: <V>}
      // API NOTE: The reason {<K>: <V>} was not chosen as pair format is
      // because this limits type of keys since property names have to be Strings.
      putAll: function(pairs, opts) {
        return future(BIG, PUT_ALL, p.multiKeyValue(pairs), _.constant(undefined), opts);
      },
      clear: function () { return future(TINY, CLEAR); },
      ping: function () { return future(TINY, PING); }
    }
  };

  exports.client = client;
  function client(port, host/*, validator */) {
    var c = new Client(host, port);
    return c.connect();
  }

}.call(this));
