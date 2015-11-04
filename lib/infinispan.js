"use strict";

(function() {

  var _ = require("underscore");
  var net = require('net');
  var Promise = require('promise');

  var f = require("./functional");
  var codec = require("./codec");
  var utils = require("./utils");

  var MAGIC = 0xA0;

  var PUT_IN = 0x01//, PUT_OUT = 0x02
    , GET_IN = 0x03, GET_OUT = 0x04
    , PUT_IF_ABSENT_IN = 0x05, PUT_IF_ABSENT_OUT = 0x06
    , REPLACE_IN = 0x07, REPLACE_OUT = 0x08
    , REPLACE_VERSIONED_IN = 0x09, REPLACE_VERSIONED_OUT = 0x0A
    , REMOVE_IN = 0x0B, REMOVE_OUT = 0x0C
    , REMOVE_VERSIONED_IN = 0x0D, REMOVE_VERSIONED_OUT = 0x0E
    , CONTAINS_KEY_IN = 0x0F, CONTAINS_KEY_OUT = 0x10
    , GET_VERSIONED_IN = 0x11, GET_VERSIONED_OUT = 0x12
    , CLEAR_IN = 0x13, CLEAR_OUT = 0x14
    , STATS_IN = 0x15, STATS_OUT = 0x16
    , PING_IN = 0x17, PING_OUT = 0x18
    , GET_BULK_IN = 0x19, GET_BULK_OUT = 0x1A
    , GET_WITH_META_IN = 0x1B, GET_WITH_META_OUT = 0x1C
    , GET_BULK_KEYS_IN = 0x1D, GET_BULK_KEYS_OUT = 0x1E
    , QUERY_IN = 0x1F, QUERY_OUT = 0x20
    , AUTH_MECH_IN = 0x21, AUTH_MECH_OUT = 0x22
    , AUTH_REQ_IN = 0x23, AUTH_REQ_OUT = 0x24
    , ADD_LISTENER_IN = 0x25, ADD_LISTENER = 0x26
    , REMOVE_LISTENER_IN = 0x27, REMOVE_LISTENER_OUT = 0x28
    , SIZE_IN = 0x29, SIZE_OUT = 0x2A
    , EXEC_IN = 0x2B, EXEC_OUT = 0x2C
    , PUT_ALL_IN = 0x2D, PUT_ALL_OUT = 0x2E
    , GET_ALL_IN = 0x2F, GET_ALL_OUT = 0x30
    , IT_START_IN = 0x31, IT_START_OUT = 0x32
    , IT_NEXT_IN = 0x33, IT_NEXT_OUT = 0x34
    , IT_END_IN = 0x35, IT_END_OUT = 0x36
    , ERROR_OUT = 0x50;

  var SUCCESS = 0x00
    , NOT_EXECUTED = 0x01
    , NOT_FOUND = 0x02;

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

  var Protocol = function() {
    var _version = 23;

    function encodeHeader(msgId, opCode) {
      return [
        codec.mEncodeUByte(MAGIC),    // magic
        codec.mEncodeVLong(msgId),    // msg id
        codec.mEncodeUByte(_version), // version
        codec.mEncodeUByte(opCode),   // op code
        codec.mEncodeVInt(0),         // cache name length
        codec.mEncodeUByte(0),        // flags
        codec.mEncodeUByte(1),        // basic client intelligence
        codec.mEncodeVInt(0)          // client topology id
      ];
    }

    function encodeKeyValue(k, v) {
      return [
        codec.mEncodeObject(k),     // key
        codec.mEncodeUByte(0x88),   // infinite lifespan & max idle
        codec.mEncodeObject(v)      // value
      ]
    }

    function encodeKey(k) {
      return [codec.mEncodeObject(k)]
    }

    function op(header) { return header[2]; }
    function status(header) { return header[3]; }

    var DECODE_OBJ_CHAIN = f.actions([codec.mDecodeObject()], decodedValues);

    function decodeError(bytebuf) {
      return new Error(DECODE_OBJ_CHAIN(bytebuf)[0]);
    }

    function decodeValue(status, bytebuf) {
      return status == SUCCESS ? DECODE_OBJ_CHAIN(bytebuf)[0] : undefined;
    }

    function isSuccess(status) {
      return status == SUCCESS;
    }

    return {
      encode: function (msgId, opCode, k, v) {
        if (f.existy(k)) {
          var encodeFun = f.existy(v) ? encodeKeyValue(k, v) : encodeKey(k);
          return f.actions(f.cat(encodeHeader(msgId, opCode), encodeFun), totalBytes);
        } else {
          return f.actions(encodeHeader(msgId, opCode), totalBytes);
        }
      },
      decodeHeader: function() {
        return [
          codec.mDecodeUByte(), // magic
          codec.mDecodeUByte(), // msg id
          codec.mDecodeUByte(), // op code
          codec.mDecodeUByte(), // status
          codec.mDecodeUByte()  // topology change marker
        ];
      },
      msgId: function(header) {
        return header[1];
      },
      decodeBody: function(header, bytebuf) {
        // Prefer switch to functional dispatch for better handling of
        // undefined return values, e.g. get() since functional dispath uses
        // undefined return of function application to try next function
        switch (op(header)) {
          case GET_OUT:
            return decodeValue(status(header), bytebuf);
          case REMOVE_OUT:
          case PUT_IF_ABSENT_OUT:
          case REPLACE_OUT:
            return isSuccess(status(header));
          case ERROR_OUT:
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
              //var opcode = header[2];
              //console.log("Op code is: " + opcode);
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

    function mkBuf(size) {
      return function() {
        return {buf: new Buffer(size), offset: 0};
      }
    }

    function write(bytebufMk, fun) {
      var msgId = _msgIdCounter.incr();
      var bytebuf = bytebufMk.apply();
      fun(msgId)(bytebuf);
      return _connect.write(msgId, bytebuf.buf);
    }

    return {
      connect: function() {
        // TODO: Avoid user calling connect by checking if connected
        return _connect.connect(this, host, port);
      },
      put: function(k, v) {
        return write(mkBuf(MEDIUM),
                     function (id) { return _proto.encode(id, PUT_IN, k, v) } );
      },
      remove: function(k) {
        return write(mkBuf(SMALL),
                     function (id) { return _proto.encode(id, REMOVE_IN, k) } );
      },
      get: function(k) {
        return write(mkBuf(SMALL),
                     function (id) { return _proto.encode(id, GET_IN, k) } );
      },
      putIfAbsent: function(k, v) {
        return write(mkBuf(MEDIUM),
                     function (id) { return _proto.encode(id, PUT_IF_ABSENT_IN, k, v) } );
      },
      replace: function(k, v) {
        return write(mkBuf(MEDIUM),
                     function (id) { return _proto.encode(id, REPLACE_IN, k, v) } );
      },
      clear: function () {
        return write(mkBuf(TINY),
                     function (id) { return _proto.encode(id, CLEAR_IN) } );
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
