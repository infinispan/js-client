'use strict';

(function() {

  var _ = require('underscore');

  var f = require('./functional');
  var codec = require('./codec');

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
      var flags = this.buildFlags(opts);
      return function(id) {
        return [
          codec.encodeUByte(MAGIC),                       // magic
          codec.encodeVLong(id),                          // msg id
          codec.encodeUByte(protocolVersion),                // version
          codec.encodeUByte(op),                          // op code
          codec.encodeVInt(0),                            // cache name length
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
    var DECODE_OBJECT = f.actions([codec.decodeObject()], codec.allDecoded); // TODO: Could just return the single decoded value
    var DECODE_VERSIONED = f.actions([codec.decodeBytes(8), codec.decodeObject()], codec.allDecoded);
    var DECODE_VINT = f.actions([codec.decodeVInt()], codec.lastDecoded);
    var DECODE_PAIR = f.actions([codec.decodeObject(), codec.decodeObject()], codec.allDecoded);
    var DECODE_UBYTE = f.actions([codec.decodeUByte()], codec.lastDecoded);

    var SUCCESS = 0x00, NOT_EXECUTED = 0x01, NOT_FOUND = 0x02,
      SUCCESS_WITH_PREV = 0x03, NOT_EXECUTED_WITH_PREV = 0x04;

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
      decodeCountValues: function(header, bytebuf) {
        var count = DECODE_VINT(bytebuf);
        return _.map(_.range(count), function() {
          var pair = DECODE_PAIR(bytebuf);
          return {key: pair[0], value: pair[1]};
        });
      },
      decodeValues: function(header, bytebuf) {
        var more = DECODE_UBYTE(bytebuf);
        var results = [];
        while (more == 1) {
          var pair = DECODE_PAIR(bytebuf);
          results.push({key: pair[0], value: pair[1]});
          more = DECODE_UBYTE(bytebuf);
        }
        return results;
      },
      decodeError: function (bytebuf) {
        throw new Error(DECODE_OBJECT(bytebuf)[0]);
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
      }
    }
  }());

  function Protocol(v) {
    this.version = v;
  }

  var Protocol23 = function() {
    Protocol.call(this, 23);
  };

  var Protocol22 = function() {
    Protocol.call(this, 22);
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

  exports.version23 = function version23() {
    return new Protocol23();
  };

  exports.version22 = function version22() {
    return new Protocol22();
  };

}.call(this));
