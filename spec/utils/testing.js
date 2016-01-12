// Commons functions

var f = require('../../lib/functional');
var ispn = require('../../lib/infinispan');
var protocols = require('../../lib/protocols');
var log4js = require('log4js');

exports.client = function(cacheName) {
  log4js.configure('spec/utils/test-log4js.json');
  return ispn.client(11222, '127.0.0.1', {version : '2.2', cacheName: cacheName});
};

exports.protocol = function() { return protocols.version23(); };

exports.put = function(k, v, opts) {
  return function(client) { return client.put(k, v, opts); }
};

exports.get = function(k) {
  return function(client) { return client.get(k); }
}

exports.putIfAbsent = function(k, v, opts) {
  return function(client) { return client.putIfAbsent(k, v, opts); }
};

exports.replace = function(k, v, opts) {
  return function(client) { return client.replace(k, v, opts); }
};

exports.containsKey = function(k) {
  return function(client) { return client.containsKey(k); }
};

exports.conditional = function(writeFun, k, old, v, opts) {
  return function(client) {
    return client.getVersioned(k).then(function(versioned) {
      expect(versioned.value).toBe(old);
      expect(versioned.version).toBeDefined();
      return writeFun(k, versioned.version, v, opts)(client);
    });
  }
};

exports.replaceV = function(k, version, v, opts) {
  return function(client) {
    return client.replaceWithVersion(k, v, version, opts);
  }
};

exports.putAll = function(pairs, opts) {
  return function(client) { return client.putAll(pairs, opts); }
};

exports.assert = function(fun, expectFun) {
  if (f.existy(expectFun)) {
    return function(client) {
      return fun(client).then(function(value) {
        expectFun(value);
        return client;
      });
    }
  }
  return function(client) {
    return fun(client).then(function() { return client; });
  }
};

exports.disconnect = function() {
  return function(client) {
    return client.disconnect();
  }
};

exports.toBe = function(value) {
  return function(actual) { expect(actual).toBe(value); }
};

exports.toContain = function(value) {
  return function(actual) { expect(actual).toContain(value); }
};

exports.toBeUndefined = function(actual) { expect(actual).toBeUndefined(); };
exports.toBeTruthy = function(actual) { expect(actual).toBeTruthy(); };
exports.toBeFalsy = function(actual) { expect(actual).toBeFalsy(); };

exports.vNumSize = function(num) {
  var limits = [7,14,21,28,35,42,49,53];
  for (var i = 0; i < limits.length; i++) {
    var limit = limits[i];
    if (num < Math.pow(2, limit)) return Math.ceil(limit / 7);
  }
};

exports.newByteBuf = function(size) {
  return {buf: new Buffer(f.existy(size) ? size : 128), offset: 0};
};
exports.assertEncode = function(bytebuf, encode, expectedBytes) {
  expect(encode(bytebuf)).toBe(expectedBytes);
  expect(bytebuf.buf.length).toBe(expectedBytes);
  return bytebuf;
};

exports.assertBuffer = function(expected, actual) {
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
};
