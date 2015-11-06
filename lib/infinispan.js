"use strict";

(function() {

  var _ = require("underscore");
  var net = require('net');
  var Promise = require('promise');

  var f = require("./functional");
  var codec = require("./codec");
  var utils = require("./utils");

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

  var PUT = 0x01, GET = 0x03
    , PUT_IF_ABSENT = 0x05, REPLACE = 0x07
    , REPLACE_WITH_VERSION = 0x09, REMOVE = 0x0B
    , REMOVE_VERSIONED = 0x0D, CONTAINS_KEY = 0x0F
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

  function returnOp(op) {
    return op + 1;
  }

  var Protocol = function() {
    var MAGIC = 0xA0;
    var VERSION = 23;
    // Status codes
    var SUCCESS = 0x00, NOT_EXECUTED = 0x01, NOT_FOUND = 0x02;
    // Operation codes

    var DECODE_OBJECT = f.actions([codec.decodeObject()], decodedValues);
    var DECODE_VERSIONED = f.actions([codec.decodeBytes(8), codec.decodeObject()], decodedValues);

    function header(msgId, opCode) {
      return [
        codec.encodeUByte(MAGIC),    // magic
        codec.encodeVLong(msgId),    // msg id
        codec.encodeUByte(VERSION), // version
        codec.encodeUByte(opCode),   // op code
        codec.encodeVInt(0),         // cache name length
        codec.encodeUByte(0),        // flags
        codec.encodeUByte(1),        // basic client intelligence
        codec.encodeVInt(0)          // client topology id
      ];
    }

    function hasOpt(opts, name) {
      return f.existy(opts) && (name in opts);
    }

    function keyValue(k, v, opts) {
      var base = [
          codec.encodeObject(k),     // key
          codec.encodeUByte(0x88)   // infinite lifespan & max idle
        ];
      var withVersion = hasOpt(opts, "version")
        ? f.cat(base, [codec.encodeBytes(opts.version)]) // version (optional)
        : base;

      return f.cat(withVersion, [codec.encodeObject(v)]); // value
    }

    function key(k) {
      return [codec.encodeObject(k)]
    }

    function op(header) { return header[2] - 1; }
    function status(header) { return header[3]; }

    function decodeError(bytebuf) {
      return new Error(DECODE_OBJECT(bytebuf)[0]);
    }

    function decodeValue(status, bytebuf) {
      return isSuccess(status) ? DECODE_OBJECT(bytebuf)[0] : undefined;
    }

    function decodeVersioned(status, bytebuf) {
      if (isSuccess(status)) {
        var decoded = DECODE_VERSIONED(bytebuf);
        return {version: decoded[0], value: decoded[1]};
      }
      return undefined;
    }

    function isSuccess(status) {
      return status == SUCCESS;
    }

    function chain(acts) {
      return f.actions(acts, totalBytes);
    }

    return {
      encodeK: function (msgId, opCode, k) {
        return chain(f.cat(header(msgId, opCode), key(k)));
      },
      encodeKV: function (msgId, opCode, k, v, opts) {
        return chain(f.cat(header(msgId, opCode), keyValue(k, v, opts)));
      },
      encode: function (msgId, opCode) {
        return chain(header(msgId, opCode));
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
      decodeBody: function(header, bytebuf) {
        // Prefer switch to functional dispatch for better handling of
        // undefined return values, e.g. get() since functional dispatch uses
        // undefined return of function application to try next function
        switch (op(header)) {
          case GET:
            return decodeValue(status(header), bytebuf);
          case GET_VERSIONED:
            return decodeVersioned(status(header), bytebuf);
          case REMOVE:
          case PUT_IF_ABSENT:
          case REPLACE:
          case REPLACE_WITH_VERSION:
            return isSuccess(status(header));
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
            console.log("Error: " + err.message);
            fail(err);
          });
          _client.on('data', function(data) {
            var decodeHeaderChain = f.actions(_protocol.decodeHeader(), decodedValues);
            var bytebuf = {buf: data, offset: 0};
            var header = decodeHeaderChain(bytebuf);
            var msgId = _protocol.msgId(header);

            var p = _reqResMap.get(msgId);
            try {
              var result = _protocol.decodeBody(header, bytebuf);
              p.success(result);
            } catch (ex) {
              p.fail(ex.message);
            } finally {
              _reqResMap.remove(msgId);
            }
          })
        });
      },
      write: function(id, buffer) {
        return new Promise(function (fulfill, reject) {
          _client.write(buffer);
          _reqResMap.put(id, {success: fulfill, fail: reject});
        });
      }
    };
  };

  var Client = function(host, port) {
    // TODO: Adjust buffer sizes once resizing has been implemented (16/32/64)
    var TINY = 128, SMALL = 128, MEDIUM = 128;
    var _msgIdCounter = utils.counter(0);
    var _proto = new Protocol();
    var _connect = new Connection();


    function ctx(size) {
      return {buf: new Buffer(size), offset: 0, id: _msgIdCounter.incr()};
    }

    function enc(op, fun /*, args */) {
      var args = _.tail(_.rest(arguments));
      return function(ctx) {
        fun.apply(null, f.cat([ctx.id, op], args))(ctx);
        return ctx;
      }
    }

    function write(ctx) {
      return _connect.write(ctx.id, ctx.buf);
    }

    //function mkBuf(size) {
    //  return function() {
    //    return {buf: new Buffer(size), offset: 0};
    //  }
    //}
    //
    //function write(bytebufMk, fun) {
    //  var msgId = msgIdCounter.incr();
    //  var bytebuf = bytebufMk.apply();
    //  fun(msgId)(bytebuf);
    //  return _connect.write(msgId, bytebuf.buf);
    //}
    //
    //function encode(op /*, args */) {
    //  var args = _.rest(arguments);
    //  return function(id) {
    //    return _proto.encode.apply(null, f.cat([id, op], args));
    //  }
    //}

    return {
      connect: function() {
        // TODO: Avoid user calling connect by checking if connected
        return _connect.connect(this, host, port);
      },
      put: function(k, v) {
        return f.pipeline(ctx(MEDIUM), enc(PUT, _proto.encodeKV, k, v), write);
      },
      remove: function(k) {
        return f.pipeline(ctx(SMALL), enc(REMOVE, _proto.encodeK, k), write);
      },
      get: function(k) {
        return f.pipeline(ctx(SMALL), enc(GET, _proto.encodeK, k), write);
      },
      putIfAbsent: function(k, v) {
        return f.pipeline(ctx(MEDIUM), enc(PUT_IF_ABSENT, _proto.encodeKV, k, v), write);
      },
      replace: function(k, v) {
        return f.pipeline(ctx(MEDIUM), enc(REPLACE, _proto.encodeKV, k, v), write);
      },
      clear: function () {
        return f.pipeline(ctx(TINY), enc(CLEAR, _proto.encode), write);
      },
      getVersioned: function(k) {
        return f.pipeline(ctx(SMALL), enc(GET_VERSIONED, _proto.encodeK, k), write);
      },
      replaceWithVersion: function(k, v, version) {
        var opts = {version: version};
        return f.pipeline(ctx(MEDIUM), enc(REPLACE_WITH_VERSION, _proto.encodeKV, k, v, opts), write);
        //return write(mkBuf(MEDIUM), encode(REPLACE_WITH_VERSION, k, v, version));
      }
    }
  };

  /////////////////////////////////////////////////////////////////////////

  //// TODO: Rename plus make it take args(main server list) and options(rest of config)
  //function Container(val) {
  //  this._value = val;
  //  //this.init(val);
  //}
  //
  ////Container.prototype.init = _.identity;
  //
  //var Client = function(val) {
  //  // The use of the Container.call method taking the Hole instance’s this
  //  // pointer ensures that what‐ ever Container does on construction will
  //  // occur in the context of the Hole instance
  //  Container.call(this, val);
  //};

  // BOB LOOK HERE
  // I'm using mixins to add different functionality. It's neat but the
  // problem is that once you return a Client instance, all those methods
  // are available to the client. While some I do want to have them available,
  // others not. A single client instance with methods defined as private
  // methods would work alternatively. TBH, I don't really need the mixins
  // since I don't expect anyone to extend/reuse them... I'll experiment a
  // bit with the counter and see if I can get some nicely encapsulated there
  // at a smaller scale and then apply same idea here.

  //var ConnectionMixin = (function() {
  //  var _client = new net.Socket();
  //  var _reqResMap = utils.keyValueMap();
  //
  //  return {
  //    connect: function(port, host) {
  //      var outer = this;
  //      return new Promise(function (succeed, fail) {
  //        _client.connect(port, host, function() {
  //          console.log('Connected');
  //          succeed(outer);
  //        });
  //        _client.on('error', function(err){
  //          console.log("Error: " + err.message);
  //          fail(err);
  //        });
  //        _client.on('data', function(data) {
  //          var decodeHeaderChain = f.actions(outer.decodeHeader(), decodedValues);
  //          var bytebuf = {buf: data, offset: 0};
  //          var decoded = decodeHeaderChain(bytebuf);
  //          var msgId = outer.msgId(decoded);
  //
  //          // TODO: Make this neater!
  //          var promiseFuncs = _reqResMap.get(msgId);
  //          if (outer.extractOpCode(decoded) ==  GET_OUT) {
  //            var status = outer.extractStatus(decoded);
  //            if (status == SUCCESS) {
  //              var decodeValueChain = f.actions(outer.decodeValue(), decodedValues);
  //              var decodedValue = decodeValueChain(bytebuf)[0];
  //              try {
  //                console.log("Decoded value: " + decodedValue);
  //                promiseFuncs.success(decodedValue);
  //              } catch(ex) {
  //                promiseFuncs.fail(ex)
  //              } finally {
  //                _reqResMap.remove(msgId);
  //              }
  //            }
  //          } else {
  //            try {
  //              promiseFuncs.success();
  //            } catch(ex) {
  //              promiseFuncs.fail(ex)
  //            } finally {
  //              _reqResMap.remove(msgId);
  //            }
  //          }
  //        })
  //      });
  //    },
  //    write: function(id, buffer) {
  //      return new Promise(function (fulfill, reject) {
  //        _client.write(buffer);
  //        _reqResMap.put(id, {success: fulfill, fail: reject});
  //      });
  //    }
  //  };
  //}());



  //var ProtocolMixin = (function() {
  //  var _version = 23;
  //
  //  return {
  //    encodeHeader: function(msgId, opCode) {
  //      return [
  //        codec.mEncodeUByte(MAGIC),    // magic
  //        codec.mEncodeVLong(msgId),    // msg id
  //        codec.mEncodeUByte(_version), // version
  //        codec.mEncodeUByte(opCode),   // op code
  //        codec.mEncodeVInt(0),         // cache name length
  //        codec.mEncodeUByte(0),        // flags
  //        codec.mEncodeUByte(1),        // basic client intelligence
  //        codec.mEncodeVInt(0)          // client topology id
  //      ];
  //    },
  //    encodeKeyValue: function(k, v) {
  //      return [
  //        codec.mEncodeObject(k),     // key
  //        codec.mEncodeUByte(0x88),   // infinite lifespan & max idle
  //        codec.mEncodeObject(v)      // value
  //      ]
  //    },
  //    encodeKey: function(k) {
  //      return [codec.mEncodeObject(k)]
  //    },
  //    decodeHeader: function() {
  //      return [
  //        codec.mDecodeUByte(), // magic
  //        codec.mDecodeUByte(), // msg id
  //        codec.mDecodeUByte(), // op code
  //        codec.mDecodeUByte(), // status
  //        codec.mDecodeUByte()  // topology change marker
  //      ];
  //    },
  //    decodeValue: function() {
  //      return [codec.mDecodeObject()];
  //    },
  //    msgId: function(header) {
  //      return header[1];
  //    },
  //    extractOpCode: function(header) {
  //      return header[2];
  //    },
  //    extractStatus: function(header) {
  //      return header[3];
  //    }
  //  };
  //}());

  //var PingMixin = {
  //  ping: function() {
  //    console.log(msgIdCounter);
  //    var msgId = msgIdCounter.incr();
  //    console.log(msgId);
  //    var pingEncode = f.actions(this.encodeHeader(msgId, 0x17), totalBytes);
  //    // TODO: If buffer not big enough, space should be increased...
  //    var bytebuf = {buf: new Buffer(8), offset: 0};
  //    pingEncode(bytebuf);
  //    return this.write(msgId, bytebuf.buf);
  //  }
  //};
  //
  //var PutMixin = {
  //  put: function(k, v) {
  //    var msgId = msgIdCounter.incr();
  //    var elements = f.cat(this.encodeHeader(msgId, PUT_IN), this.encodeKeyValue(k, v));
  //    var putEncode = f.actions(elements, totalBytes);
  //    // TODO: More aggressive byte buffer size? Buffer increase reallocation NIY
  //    var bytebuf = {buf: new Buffer(128), offset: 0};
  //    putEncode(bytebuf);
  //    return this.write(msgId, bytebuf.buf);
  //  }
  //}

  //var GetMixin = {
  //  get: function(k) {
  //    var msgId = msgIdCounter.incr();
  //    var elements = f.cat(this.encodeHeader(msgId, GET_IN), this.encodeKey(k));
  //    var getEncode = f.actions(elements, totalBytes);
  //    // TODO: More aggressive byte buffer size? Buffer increase reallocation NIY
  //    var bytebuf = {buf: new Buffer(128), offset: 0};
  //    getEncode(bytebuf);
  //    return this.write(msgId, bytebuf.buf);
  //  }
  //}

  //_.extend(Client.prototype
  //    , ProtocolMixin
  //    , ConnectionMixin
  //    , PingMixin
  //    , PutMixin
  //    , GetMixin);

  exports.client = client;
  function client(port, host/*, validator */) {
    var c = new Client(host, port);
    return c.connect();
  }

}.call(this));
