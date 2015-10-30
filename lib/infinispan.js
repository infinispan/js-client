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
    this.init(val);
  }

  Container.prototype.init = _.identity;

  //var c = new Container(42);
  //console.log(c);
//=> {_value: 42}

// The mixin protocol specification for HoleMixin is as follows:
//  Extension protocol: Must provide notify, validate and init methods
//  Interface protocol: Constructor and setValue
  var ClientMixin = {
    setValue: function(newValue) {
      var oldVal  = this._value;

      this.validate(newValue);
      this._value = newValue;
      this.notify(oldVal, newValue);
      return this._value;
    },
  };

  var Client = function(val) {
    // The use of the Container.call method taking the Hole instance’s this
    // pointer ensures that what‐ ever Container does on construction will
    // occur in the context of the Hole instance
    Container.call(this, val);
  };

  //logError(function () { new Hole(42) } );
//TypeError: Object [object Object] has no method 'init'

  var ObserverMixin = (function() {
    var _watchers = [];

    return {
      watch: function(fun) {
        _watchers.push(fun);
        return _.size(_watchers);
      },
      notify: function(oldVal, newVal) {
        _.each(_watchers, function(watcher) {
          watcher.call(this, oldVal, newVal);
        });

        return _.size(_watchers);
      }
    };
  }());

  //function existy(x) { return x != null }

  var ValidateMixin = {
    addValidator: function(fun) {
      this._validator = fun;
    },
    init: function(val) {
      this.validate(val);
    },
    validate: function(val) {
      if (f.existy(this._validator) &&
          !this._validator(val))
        fail("Attempted to set invalid value " + polyToString(val));
    }
  };

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
            //console.log('Received: ' + data);
            //var magic = data.readUInt8(0);
            //console.log("Magic respose: 0x" + magic.toString(16).toUpperCase());
            //var msgId = data.readUInt8(1);
            //console.log("Msg id: " + msgId);
            //var op = data.readUInt8(2);
            //console.log("Op: 0x" + op.toString(16).toUpperCase());
            //var status = data.readUInt8(3);
            //console.log("Status: " + status);
            //var topologyId = data.readUInt8(4);
            //console.log("Topology id: " + topologyId);
            //console.log("--");

            //console.log();
            //
            //console.log(_reqResMap[msgId]);

          })
        });
      },
      write: function(id, buffer) {
        //console.log("write buffer: " + buffer);
        //console.log("write msg id: " + id);
        //console.log("write to: " + _client);
        //_client.write(buffer);
        return new Promise(function (fulfill, reject) {
          _client.write(buffer);
          _reqResMap[id] = {success: fulfill, fail: reject};
        });
      }
    };
  }());

  //_.extend(Client.prototype
  //    , ClientMixin
  //    , ConnectionMixin
  //    , ValidateMixin
  //    , ObserverMixin);

// After mixins have been plugged in, it works
//  var h = new Hole(42);
//  console.log(h);
//
//  h.addValidator(always(false));

  //logError(function () { h.setValue(9) });
// Error: Attempted to set invalid value 9

  //var h = new Hole(42);
  //h.addValidator(isEven);

  //logError(function () { h.setValue(9) });
// Error: Attempted to set invalid value 9

  //console.log(h.setValue(108)); //=> 108
  //
  //console.log(h);
//=> {_validator: function isEven(n) {...}, // _value: 108}


//  console.log(h.watch(function(old, nu) {
//    note(["Changing", old, "to", nu].join(' '));
//  }));
////=> 1
//
//  console.log(h.setValue(42));
//// NOTE: Changing 108 to 42
//// => 42
//
//  console.log(h.watch(function(old, nu) {
//    note(["Veranderende", old, "tot", nu].join(' '));
//  }));
////=> 2
//
//  console.log(h.setValue(36));
// NOTE: Changing 42 to 36
// NOTE: Veranderende 42 tot 36 //=> 36

// The mixin protocol specification for SwapMixin is as follows:
//  Extension protocol: Must provide a setValue method and a _value property
//  Interface protocol: The swap method
  var SwapMixin = {
    swap: function(fun /* , args... */) {
      var args = _.rest(arguments)
      var newValue = fun.apply(this, f.construct(this._value, args));

      return this.setValue(newValue);
    }
  };

//// I can actually test the SwapMixin in isolation:
//  var o = {_value: 0, setValue: _.identity};
//  _.extend(o, SwapMixin);
//  console.log(o.swap(f.construct, [1,2,3])); //=> [0, 1, 2, 3]

// Offers a way to safely grab the value in the Hole instance:
  var SnapshotMixin = {
    snapshot: function() {
      //return deepClone(this._value);
      return this._value;
    }
  };

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
      , ClientMixin
      , ValidateMixin
      , ObserverMixin
      , SwapMixin
      , SnapshotMixin
      , ProtocolMixin
      , ConnectionMixin
      , PingMixin
      , PutMixin
      , GetMixin);

  //var h = new Hole(42);
  //console.log(h.snapshot()); //=> 42
  //console.log(h.swap(always(99))); //=> 99
  //console.log(h.snapshot()); //=> 99

  var CAS = function(val) {
    Client.call(this, val);
  };

  var CASMixin = {
    swap: function(oldVal, f) {
      if (this._value === oldVal) {
        this.setValue(f(this._value));
        return this._value;
      }
      else {
        return undefined;
      }
    }
  };

// I could simply leave out the SwapMixin on the extension and use the
// CASMixin instead, since I know that the swap method is the only replacement.
// However, I will instead use ordering to _.extend to take care of the override:
  _.extend(CAS.prototype
      , ClientMixin
      , ValidateMixin
      , ObserverMixin
      , SwapMixin
      , CASMixin
      , SnapshotMixin);

  //var c = new CAS(42); c.swap(42, always(-1));
  //console.log(c); //=> -1
  //console.log(c.snapshot()); //=> -1
  //console.log(c.swap('not the value', always(100000))); //=> undefined
  //console.log(c.snapshot()); //=> -1

// That the types created in the previous sections are object/method-centric
// is a technical detail that need not leak into a functional API.
  function contain(value) {
    return new Container(value);
  }

  exports.contain = contain;

// If I were providing a container library, then I would offer the contain
// function as the user-facing API:
//  console.log(contain(42));
//=> {_value: 42} (of type Container, but who cares?)

// For developers, I might additionally provide the mixin definitions for
// extension purposes:
  function client(port, host/*, validator */) {
    var c = new Client();
    //var v = _.toArray(arguments)[1];
    //
    //if (v) c.addValidator(v);
    //
    //c.setValue(val);

    return c.connect(port, host);
  }

  exports.client = client;

// I’ve managed to encapsulate a lot of the logic of validation within the
// confines of the hole function. This is ideal because I can compose the
// underlying methods in any way that I want. The usage contract of the hole
// function is much simpler than the combined use of the Hole constructor and
// the addValidator method.

  //logError(function() { hole(42, always(false)) });
// Error: Attempted to set invalid value 42

// Although setValue is a method on the type, there is no reason to expose it
// functionally. Instead, I can expose just the swap and snapshot functions
// instead:
  var swap = f.invoker('swap', Client.prototype.swap);

  //var x = hole(42);
  //console.log(swap(x, sqr));
//=> 1764

// Exposing the functionality of the CAS type is very similar to Hole:
  function cas(val /*, args */) {
    var h = client.apply(this, arguments);
    var c = new CAS(val);
    c._validator = h._validator;

    return c;
  }

// I’m using (abusing) private details of the Hole type to implement most of
// the capability of the cas function, but since I control the code to both
// types, I can justify the coupling. In general, I would avoid that,
// especially if the abused type is not under my immediate control.

  var compareAndSwap = f.invoker('swap', CAS.prototype.swap);

  //function snapshot(o) { return o.snapshot() }
  //exports.snapshot = snapshot;

  function ping(o) { return o.ping() }
  exports.ping = ping;

  function put(o, k, v) { return o.put(k, v) }
  exports.put = put;

  function addWatcher(o, fun) { o.watch(fun) }

  //var x = hole(42);
  //addWatcher(x, note);
  //console.log(swap(x, sqr));
// NOTE: 42
// => 1764
//  var y = cas(9, isOdd);
//  console.log(compareAndSwap(y, 9, always(1)));
////=> 1
//  console.log(snapshot(y)); //=> 1

}.call(this));

//(function() {
//
//  var net = require('net');
//
//  var client = new net.Socket();
//
//  exports.start = function() {
//    client.connect(11222, '127.0.0.1', function() {
//      console.log('Connected');
//      //client.write('Hello, server! Love, Client.');
//    });
//
//    client.on('data', function(data) {
//      //console.log('Received: ' + data);
//      var magic = data.readUInt8(0);
//      console.log("Magic respose: 0x" + magic.toString(16).toUpperCase());
//      var msgId = data.readUInt8(1);
//      console.log("Msg id: " + msgId);
//      var op = data.readUInt8(2);
//      console.log("Op: 0x" + op.toString(16).toUpperCase());
//      var status = data.readUInt8(3);
//      console.log("Status: " + status);
//      var topologyId = data.readUInt8(4);
//      console.log("Topology id: " + topologyId);
//    });
//
//    client.on('end',function(){
//      console.log("Reading end");
//    });
//
//    client.on('error', function(err){
//      console.log("Error: "+err.message);
//    })
//  };
//
//  exports.ping = function() {
//    // Buffer size needs to be precise, otherwise if bigger
//    // it starts consuming next request from that
//    var buf = new Buffer(8);
//    buf.fill(0); // to avoid garbage
//    buf.writeUInt8(0xA0, 0); // magic - byte
//    buf.writeUInt8(0, 1); // msg id - vlong
//    buf.writeUInt8(24, 2); // version
//    buf.writeUInt8(0x17, 3); // ping op
//    buf.writeUInt8(0, 4); // cache name length
//    buf.writeUInt8(0, 5); // flags
//    buf.writeUInt8(1, 6); // basic client intelligence
//    buf.writeUInt8(0, 7); // client topology id
//    client.write(buf); // write buffer
//  }
//
//}.call(this));