'use strict';

(function() {

  var _ = require('underscore');

  var f = require('./functional');
  var codec = require('./codec');
  var utils = require('./utils');

  var MAGIC = 0xA0;

  function hasOptPrev(opts) {
    return _.has(opts, 'previous') && f.thuthy(opts['previous']);
  }

  var EncodeMixin = {
    buildFlags: function (opts) { // TODO: Move out to a Mixin (similar to expiry)
      return hasOptPrev(opts) ? 0x01 : 0;
    },
    encodeHeader: function (op, opts) {
      var protocolVersion = this.version;
      var cacheName = this.clientOpts['cacheName'];
      var flags = this.buildFlags(opts);
      return function(id) {
        return [
          codec.encodeUByte(MAGIC),                       // magic
          codec.encodeVLong(id),                          // msg id
          codec.encodeUByte(protocolVersion),             // version
          codec.encodeUByte(op),                          // op code
          codec.encodeString(cacheName),                  // cache name
          codec.encodeVInt(f.existy(flags) ? flags : 0),  // flags
          codec.encodeUByte(1),                           // basic client intelligence
          codec.encodeVInt(0)                             // client topology id
        ];
      }
    },
    encodeKey: function (k) {
      return function() {
        return [codec.encodeObject(k)]; // key
      }
    },
    encodeKeyVersion: function (k, version) {
      return function() {
        return [codec.encodeObject(k), codec.encodeBytes(version)]; // key + version
      }
    },
    encodeKeyValue: function (k, v, opts) {
      var outer = this;
      return function() {
        return f.cat(
          [codec.encodeObject(k)],      // key
          outer.encodeExpiry(opts),     // lifespan & max idle
          [codec.encodeObject(v)]       // value
        );
      }
    },
    encodeKeyValueVersion: function (k, v, version, opts) {
      var outer = this;
      return function() {
        return f.cat(
          [codec.encodeObject(k)],          // key
          outer.encodeExpiry(opts),         // lifespan & max idle
          [codec.encodeBytes(version),      // version
          codec.encodeObject(v)]            // value
        );
      }
    },
    encodeMultiKey: function (keys) {
      return function() {
        var base = [
          codec.encodeVInt(_.size(keys))            // key count
        ];
        var withKeys = _.map(keys, function (key) {
          return codec.encodeObject(key);           // key
        });

        return f.cat(base, withKeys);
      };
    },
    encodeMultiKeyValue: function (pairs, opts) {
      var outer = this;
      return function() {
        var withPairs = _.map(pairs, function (pair) {
          return [
            codec.encodeObject(pair.key),    // key
            codec.encodeObject(pair.value)   // value
          ]
        });

        return f.cat(
          outer.encodeExpiry(opts),           // lifespan & max idle
          [codec.encodeVInt(_.size(pairs))],  // entry count
          _.flatten(withPairs));              // key + value pairs
      };
    },
    encodeNum: function (num) {
      return function() {
        return [codec.encodeVInt(num)];   // number
      }
    }
  };

  var ExpiryEncodeMixin = (function() {
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
      encodeExpiry: function (opts) {
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
    }
  }());

  var DecodeMixin = (function() {
    var logger = utils.logger('decoder');

    var DECODE_OBJECT = f.actions([codec.decodeObject()], codec.lastDecoded);
    var DECODE_VINT = f.actions([codec.decodeVInt()], codec.lastDecoded);
    var DECODE_UBYTE = f.actions([codec.decodeUByte()], codec.lastDecoded);

    var DECODE_PAIR = f.actions([codec.decodeObject(), codec.decodeObject()], extractKeyValue);
    function extractKeyValue(values, state) {
      return {key: values[0], value: values[1]}
    }

    var DECODE_VERSIONED = f.actions([codec.decodeBytes(8), codec.decodeObject()], extractVersioned);
    function extractVersioned(values, state) {
      return {version: values[0], value: values[1]};
    }

    var SUCCESS = 0x00, NOT_EXECUTED = 0x01, NOT_FOUND = 0x02,
      SUCCESS_WITH_PREV = 0x03, NOT_EXECUTED_WITH_PREV = 0x04;

    function op(header) { return header[2] - 1; }
    function status(header) { return header[3]; }
    function msgId(header) { return header[1]; }

    function isSuccess(status) {
      return status == SUCCESS || status == SUCCESS_WITH_PREV;
    }

    function isNotExecuted(status) {
      return status == NOT_EXECUTED || status == NOT_EXECUTED_WITH_PREV;
    }

    function hasPrevious(status) {
      return status == SUCCESS_WITH_PREV || status == NOT_EXECUTED_WITH_PREV;
    }

    function decodePrev(promise, header, bytebuf) {
      var prev = DECODE_OBJECT(bytebuf);
      if (f.existy(prev))
        return fulfill(promise, _.isEmpty(prev) ? undefined : prev, header);
      else
        return false;
    }

    function decodeObject(promise, header, bytebuf, action) {
      if (isSuccess(status(header))) {
        var obj = action(bytebuf);
        if (f.existy(obj)) return fulfill(promise, obj, header);
        else return false;
      }

      return fulfill(promise, undefined, header);
    }

    function fulfill(promise, value, header) {
      logger.tracef('Complete promise for request(msgId=%d) with %s', msgId(header), value);
      promise.success(value);
      return true;
    }

    return {
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
      decodeValue: function(promise, header, bytebuf) {
        return decodeObject(promise, header, bytebuf, DECODE_OBJECT);
      },
      decodeVersioned: function(promise, header, bytebuf) {
        return decodeObject(promise, header, bytebuf, DECODE_VERSIONED);
      },
      decodePrevOrElse: function(opts, cond, orElse) {
        var shouldReturnPrev = hasOptPrev(opts);
        return function(promise, header, bytebuf) {
          if (shouldReturnPrev)
            return cond(header)
                ? decodePrev(promise, header, bytebuf)
                : fulfill(promise, undefined, header);

          return orElse(promise, header);
        }
      },
      decodeCountValues: function(promise, header, bytebuf) {
        var count = DECODE_VINT(bytebuf);
        var pairs = [], i = 0;
        while (i++ < count) {
          var pair = DECODE_PAIR(bytebuf);
          if (f.existy(pair)) pairs.push(pair);
          else return false;
        }

        return fulfill(promise, pairs, header);
      },
      decodeValues: function(promise, header, bytebuf) {
        var pairs = [];
        do {
          var more = DECODE_UBYTE(bytebuf);
          if (more == 1) {
            var pair = DECODE_PAIR(bytebuf);
            if (f.existy(pair)) pairs.push(pair);
            else return false;
          }
        } while (more == 1);

        return fulfill(promise, pairs, header);
      },
      decodeError: function (bytebuf) {
        throw new Error(DECODE_OBJECT(bytebuf));
      },
      getMsgId: function(header) {
        return header[1];
      },
      hasSuccess: function(header) {
        return isSuccess(status(header));
      },
      hasNotExecuted: function(header) {
        return isNotExecuted(status(header));
      },
      hasError: function(header) {
        return op(header) == 0x50;
      },
      hasPrevious: function(header) {
        return hasPrevious(status(header));
      },
      complete: function(f) {
        return function(promise, header) {
          return fulfill(promise, f(header), header);
        }
      }
    }
  }());

  function Protocol(v, clientOpts) {
    this.version = v;
    this.clientOpts = clientOpts;
  }

  var Protocol23 = function(clientOpts) {
    Protocol.call(this, 23, clientOpts);
  };

  var Protocol22 = function(clientOpts) {
    Protocol.call(this, 22, clientOpts);
  };

  // TODO: Missing operations, just for reference
  var IdsMixin = {
    getWithMetadata: function() { return 0x1B; },
    getBulkKeysId: function() { return 0x1D },
    queryId: function() { return 0x1F },
    authMechId: function() { return 0x21 },
    authReqId: function() { return 0x23 },
    addListenerId: function() { return 0x25 },
    removeListenerId: function() { return 0x27 },
    sizeId: function() { return 0x29 },
    execId: function() { return 0x2B },
    iterStartId: function() { return 0x31 }, // protocol 2.3+
    iterNextId: function() { return 0x33 },  // protocol 2.3+
    iterEndId: function() { return 0x35 }    // protocol 2.3+
  };

  _.extend(Protocol23.prototype
    , EncodeMixin
    , ExpiryEncodeMixin
    , DecodeMixin
    , IdsMixin);

  _.extend(Protocol22.prototype
    , EncodeMixin
    , ExpiryEncodeMixin
    , DecodeMixin
    , IdsMixin);

  exports.version23 = function(clientOpts) {
    return new Protocol23(clientOpts);
  };

  exports.version22 = function(clientOpts) {
    return new Protocol22(clientOpts);
  };

}.call(this));
