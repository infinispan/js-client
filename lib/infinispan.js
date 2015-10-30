"use strict";

(function() {

  var _ = require("underscore");
  var net = require('net');
  var Promise = require('promise');

  var f = require("./functional");
  var codec = require("./codec");
  var utils = require("./utils");

  var MAGIC = 0xA0
      , PUT_IN = 0x01
      , PUT_OUT = 0x02
      , GET_IN = 0x03
      , GET_OUT = 0x04
      , SUCCESS = 0x00
      , NOT_FOUND = 0x02;

  var msgIdCounter = utils.counter(0);

  // TODO: Rename plus make it take args(main server list) and options(rest of config)
  function Container(val) {
    this._value = val;
    //this.init(val);
  }

  //Container.prototype.init = _.identity;

  var Client = function(val) {
    // The use of the Container.call method taking the Hole instance’s this
    // pointer ensures that what‐ ever Container does on construction will
    // occur in the context of the Hole instance
    Container.call(this, val);
  };

  // BOB LOOK HERE
  // I'm using mixins to add different functionality. It's neat but the
  // problem is that once you return a Client instance, all those methods
  // are available to the client. While some I do want to have them available,
  // others not. A single client instance with methods defined as private
  // methods would work alternatively. TBH, I don't really need the mixins
  // since I don't expect anyone to extend/reuse them... I'll experiment a
  // bit with the counter and see if I can get some nicely encapsulated there
  // at a smaller scale and then apply same idea here.

  var ConnectionMixin = (function() {
    var _client = new net.Socket();
    var _reqResMap = Object.create(null);

    return {
      connect: function(port, host) {
        var outer = this;
        return new Promise(function (succeed, fail) {
          _client.connect(port, host, function() {
            console.log('Connected');
            succeed(outer);
          });
          _client.on('error', function(err){
            console.log("Error: " + err.message);
            fail(err);
          });
          _client.on('data', function(data) {
            var decodeHeaderChain = f.actions(outer.decodeHeader(), decodedValues);
            var bytebuf = {buf: data, offset: 0};
            var decoded = decodeHeaderChain(bytebuf);
            var msgId = outer.extractMsgId(decoded);

            // TODO: Make this neater!
            if (outer.extractOpCode(decoded) ==  GET_OUT) {
              var status = outer.extractStatus(decoded);
              if (status == SUCCESS) {
                var decodeValueChain = f.actions(outer.decodeValue(), decodedValues);
                var decodedValue = decodeValueChain(bytebuf)[0];
                try {
                  console.log("Decoded value: " + decodedValue);
                  _reqResMap[msgId].success(decodedValue)
                } catch(ex) {
                  _reqResMap[msgId].fail(ex)
                } finally {
                  delete _reqResMap[msgId];
                }
              }
            } else {
              try {
                _reqResMap[msgId].success()
              } catch(ex) {
                _reqResMap[msgId].fail(ex)
              } finally {
                delete _reqResMap[msgId];
              }
            }
          })
        });
      },
      write: function(id, buffer) {
        return new Promise(function (fulfill, reject) {
          _client.write(buffer);
          _reqResMap[id] = {success: fulfill, fail: reject};
        });
      }
    };
  }());


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

  var ProtocolMixin = (function() {
    var _version = 23;

    return {
      encodeHeader: function(msgId, opCode) {
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
      },
      encodeKeyValue: function(k, v) {
        return [
          codec.mEncodeObject(k),     // key
          codec.mEncodeUByte(0x88),   // infinite lifespan & max idle
          codec.mEncodeObject(v)      // value
        ]
      },
      encodeKey: function(k) {
        return [codec.mEncodeObject(k)]
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
      decodeValue: function() {
        return [codec.mDecodeObject()];
      },
      extractMsgId: function(header) {
        return header[1];
      },
      extractOpCode: function(header) {
        return header[2];
      },
      extractStatus: function(header) {
        return header[3];
      }
    };
  }());

  var PingMixin = {
    ping: function() {
      console.log(msgIdCounter);
      var msgId = msgIdCounter._incr();
      console.log(msgId);
      var pingEncode = f.actions(this.encodeHeader(msgId, 0x17), totalBytes);
      // TODO: If buffer not big enough, space should be increased...
      var bytebuf = {buf: new Buffer(8), offset: 0};
      pingEncode(bytebuf);
      return this.write(msgId, bytebuf.buf);
    }
  };

  var PutMixin = {
    put: function(k, v) {
      var msgId = msgIdCounter._incr();
      var elements = f.cat(this.encodeHeader(msgId, PUT_IN), this.encodeKeyValue(k, v));
      var putEncode = f.actions(elements, totalBytes);
      // TODO: More aggressive byte buffer size? Buffer increase reallocation NIY
      var bytebuf = {buf: new Buffer(128), offset: 0};
      putEncode(bytebuf);
      return this.write(msgId, bytebuf.buf);
    }
  }

  var GetMixin = {
    get: function(k) {
      var msgId = msgIdCounter._incr();
      var elements = f.cat(this.encodeHeader(msgId, GET_IN), this.encodeKey(k));
      var getEncode = f.actions(elements, totalBytes);
      // TODO: More aggressive byte buffer size? Buffer increase reallocation NIY
      var bytebuf = {buf: new Buffer(128), offset: 0};
      getEncode(bytebuf);
      return this.write(msgId, bytebuf.buf);
    }
  }

  _.extend(Client.prototype
      , ProtocolMixin
      , ConnectionMixin
      , PingMixin
      , PutMixin
      , GetMixin);

  function client(port, host/*, validator */) {
    var c = new Client();
    return c.connect(port, host);
  }

  exports.client = client;

  function ping(o) { return o.ping() }
  exports.ping = ping;

  function put(o, k, v) { return o.put(k, v) }
  exports.put = put;

}.call(this));
