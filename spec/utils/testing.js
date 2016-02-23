// Commons functions

var _ = require('underscore');

var log4js = require('log4js');
var Promise = require('promise');

var f = require('../../lib/functional');
var ispn = require('../../lib/infinispan');
var protocols = require('../../lib/protocols');

exports.local = {port: 11222, host: '127.0.0.1'};

exports.client = function(args, cacheName) {
  log4js.configure('spec/utils/test-log4js.json');
  return ispn.client(args, {cacheName: cacheName});
};

exports.protocol = function() { return protocols.version25(); };

exports.put = function(k, v, opts) {
  return function(client) { return client.put(k, v, opts); }
};

exports.get = function(k) {
  return function(client) { return client.get(k); }
};

exports.getM = function(k) {
  return function(client) { return client.getWithMetadata(k); }
};

exports.getV = function(k) {
  return function(client) { return client.getVersioned(k); }
};

exports.putIfAbsent = function(k, v, opts) {
  return function(client) { return client.putIfAbsent(k, v, opts); }
};

exports.replace = function(k, v, opts) {
  return function(client) { return client.replace(k, v, opts); }
};

exports.containsKey = function(k) {
  return function(client) { return client.containsKey(k); }
};

exports.conditional = function(writeFun, getFun, k, old, v, opts) {
  return function(client) {
    return getFun(k)(client).then(function(versioned) {
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

exports.size = function(k) {
  return function(client) { return client.size(); }
};

exports.stats = function() {
  return function(client) { return client.stats(); }
};

exports.clear = function() {
  return function(client) {
    return client.clear();
  }
};

exports.disconnect = function() {
  return function(client) {
    return client.disconnect();
  }
};

exports.on = function(event, listener, opts) {
  return function(client) {
    return client.addListener(event, listener(client), opts);
  }
};

exports.onMany = function(eventListeners) {
  return function(client) {
    var head = _.head(eventListeners);
    var tail = _.tail(eventListeners);
    return client.addListener(head.event, head.listener).then(function(listenerId) {
      var promises = _.map(tail, function(e) {
        return client.addListener(e.event, e.listener(client), {'listenerId' : listenerId });
      });

      var all = Promise.all(promises);
      return all.then(function(listenerIds) {
        _.map(listenerIds, function(lid) { expect(lid).toBe(listenerId); });
      })
    });
  };
};

exports.removeListener = function(done) {
  return function(client, listenerId) {
    client.removeListener(listenerId).then(function() {
      if (f.existy(done)) done();
    });
  };
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

exports.assertStats = function(fun, statsFun) {
  return function(client) {
    var before = client.stats().then(function(before) {return before});
    var put = before.then(function() { return fun(client); });
    var after = put.then(function() { return client.stats(); });
    return Promise.all([before, after]).then(function(stats) {
      statsFun(stats[0], stats[1]);
      return client;
    });
  }
};

exports.toBe = function(value) {
  return function(actual) { expect(actual).toBe(value); }
};

exports.toContain = function(value) {
  return function(actual) {
    if (_.isObject(value)) expect(actual).toEqual(jasmine.objectContaining(value));
    else expect(actual).toContain(value);
  }
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

exports.expectToBeBuffer = expectToBeBuffer;
function expectToBeBuffer(actual, expected) {
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
}

exports.expectEvent = function(expectedKey, expectedValue, eventDone) {
  return function(client) {
    if (f.existy(expectedValue)) {
      return function(eventKey, eventVersion, listenerId) {
        expect(eventKey).toBe(expectedKey);
        return client.getVersioned(expectedKey).then(function(versioned) {
          expect(versioned.value).toBe(expectedValue);
          expectToBeBuffer(versioned.version, eventVersion);
          if (f.existy(eventDone)) eventDone(client, listenerId);
        });
      }
    } else {
      return function(eventKey, listenerId) {
        expect(eventKey).toBe(expectedKey);
        if (f.existy(eventDone)) eventDone(client, listenerId);
      }
    }
  }
};

exports.expectEvents = function(keys, eventDone) {
  return function(client) {
    var remain = keys;
    return function(eventKey, eventVersion, listenerId) {
      var match = _.filter(remain, function(k) {
        return _.isEqual(k, eventKey);
      });
      expect(match.length).toBe(1);
      remain = _.without(remain, eventKey);
      if (_.isEmpty(remain) && f.existy(eventDone))
        eventDone(client, listenerId);
    }
  }
};
