// Commons functions

var _ = require('underscore');

var log4js = require('log4js');
var Promise = require('promise');
var readFile = Promise.denodeify(require('fs').readFile);
var httpRequest = require('request');
var util = require('util');

var f = require('../../lib/functional');
var ispn = require('../../lib/infinispan');
var u = require('../../lib/utils');
var protocols = require('../../lib/protocols');

exports.local = {port: 11222, host: '127.0.0.1'};

exports.cluster1 = {port: 11322, host: '127.0.0.1'};
exports.cluster2 = {port: 11332, host: '127.0.0.1'};
exports.cluster3 = {port: 11342, host: '127.0.0.1'};
exports.cluster = [exports.cluster1, exports.cluster2, exports.cluster3];

exports.failover1 = {port: 11422, host: '127.0.0.1'};
exports.failover2 = {port: 11432, host: '127.0.0.1'};
exports.failover3 = {port: 11442, host: '127.0.0.1'};

// All ssl invocations needs to be directed to localhost instead of 127.0.0.1
// because Node.js uses `localhost` as default server name if none provided.
exports.sslTrust = {port: 11232, host: 'localhost'};
exports.sslAuth = {port: 11242, host: 'localhost'};
exports.sslSni = {port: 11252, host: 'localhost'};

exports.xsiteCacheName = 'xsiteCache';
exports.earth1 = {port: 11522, host: '127.0.0.1'};
exports.moon1 = {port: 11532, host: '127.0.0.1'};

var CLUSTER_NODES = ['server-one', 'server-two', 'server-three'];

var MAX_WAIT = 7500;

var logger = u.logger('testing');

exports.client = function(args, opts) {
  try {
    log4js.configure('spec/utils/test-log4js.json');
  } catch (error) {
    // In case running specs from IDEs
    log4js.configure('utils/test-log4js.json');
  }

  if (!f.existy(opts) || !f.existy(opts.version)) {
    var version = exports.getHotrodProtocolVersion();
    if (f.existy(version)) {
      opts.version = version;
    }
  }

  return ispn.client(args, opts);
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

exports.putIfAbsent = function(k, v, opts) {
  return function(client) { return client.putIfAbsent(k, v, opts); }
};

exports.replace = function(k, v, opts) {
  return function(client) { return client.replace(k, v, opts); }
};

exports.remove = function(k, opts) {
  return function(client) { return client.remove(k, opts);  }
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

exports.size = function() {
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

exports.ping = function() {
  return function(client) {
    return client.ping();
  }
};

exports.disconnect = function() {
  return function(client) {
    return client.disconnect();
  }
};

exports.on = function(event, listener, opts) {
  return function(client) {
    return client.addListener(event, listener(client), opts)
      .then(function() { return client; });
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

      return Promise.all(promises)
        .then(function(listenerIds) {
          _.map(listenerIds, function(lid) { expect(lid).toBe(listenerId); });
          return client;
        })
    });
  };
};

exports.exec = function(scriptName, params) {
  return function(client) {
    return client.execute(scriptName, params);
  }
};

exports.loadAndExec = function(path, name) {
  return function(client) {
    return Promise.all([client, readFile(path)])
      .then(function(vals) {
        var c = vals[0];
        var scriptName = f.existy(name) ? name : path.split('/').pop();
        return c.addScript(scriptName, vals[1].toString())
          .then(function() { return c; } );
      })
  }
};

exports.getTopologyId = function() {
  return function(client) {
    return Promise.resolve(client.getTopologyInfo().getTopologyId());
  }
};

exports.getMembers = function() {
  return function(client) {
    return Promise.resolve(
        _.sortBy(client.getTopologyInfo().getMembers(), 'port'));
  }
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

exports.resetStats = function(client) {
  var resets = _.map(CLUSTER_NODES, function(nodeName) {
    var op = {
      operation: 'reset-statistics',
      address: [
        { host : 'master'},
        { server : nodeName},
        { subsystem : 'datagrid-infinispan'},
        { 'cache-container' : 'clustered' },
        { 'distributed-cache' : 'default' }
      ]
    };

    return invokeDmrHttp(op);
  });
  return Promise.all(resets).then(function() { return client; });
};

exports.clusterSize = function() { return exports.cluster.length; };

exports.toBe = function(value) {
  return function(actual) { expect(actual).toBe(value); }
};

exports.toEqual = function(value) {
  return function(actual) { expect(actual).toEqual(value); }
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

exports.toBeUndefinedVersioned = function(actual) {
  expect(actual.value).toBeUndefined();
  expectToBeBuffer(actual.version, new Buffer());
};

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

exports.expectEvent = function(key, done, removeAfterEvent, value) {
  return function(client) {
    if (f.existy(value)) {
      return function(eventKey, eventVersion, listenerId) {
        expect(eventKey).toBe(key);
        assertListenerVersioned(key, value, eventVersion)(client)
          .then(function() {
            removeListener(client, listenerId, removeAfterEvent, done);
          })
          .catch(function(err) {
            client.removeListener(listenerId)
              .finally(exports.failed(done)(err));
          });
      }
    } else {
      return function(eventKey, listenerId) {
        expect(eventKey).toBe(key);
        removeListener(client, listenerId, removeAfterEvent, done);
      }
    }
  }
};

function removeListener(client, listenerId, removeAfterEvent, done) {
  if (removeAfterEvent)
    return client.removeListener(listenerId)
      .then(function() { done(); })
      .catch(function(err) { done(err); });
  else
    return client.removeListener(listenerId);
}

function assertListenerVersioned(key, value, version) {
  return function(client) {
    return client.getWithMetadata(key)
      .then(function(getM) {
        expect(getM.value).toBe(value);
        expectToBeBuffer(getM.version, version);
      })
  }
}

exports.expectEvents = function(keys, done) {
  return function(client) {
    var remain = keys;
    return function(eventKey, eventVersion, listenerId) {
      var match = _.filter(remain, function(k) {
        return _.isEqual(k, eventKey);
      });
      expect(match.length).toBe(1);
      remain = _.without(remain, eventKey);
      if (_.isEmpty(remain))
        removeListener(client, listenerId, true, done);
    }
  }
};

exports.failed = function(done) {
  return function(error) {
    done(error);
  };
};

exports.randomStr = function(size) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < size; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
};

exports.findKeyForServers = function(client, addrs) {
  var attempts = 1000;
  var key;
  do {
    key = exports.randomStr(8);
    var owners = client.getTopologyInfo().findOwners(key);
    attempts--;
  } while (!_.isEqual(addrs, owners) && attempts >= 0);

  if (attempts < 0)
    throw new Error("Could not find any key owned by: " + addrs);

  logger.debugf("Generated key=%s hashing to %s", key, u.showArrayAddress(addrs));
  return key;
};

exports.getAll = function(keys) {
  return function(client) {
    return client.getAll(keys);
  }
};

exports.invalidVersion = function() {
  return new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
};

exports.notReplaceWithVersion = function(k, opts) {
  return function(client) {
    return client.replaceWithVersion(k, 'ignore', exports.invalidVersion(), opts);
  }
};

exports.removeWithVersion = function(k, version, opts) {
  return function(client) {
    return client.removeWithVersion(k, version, opts);
  }
};

exports.notRemoveWithVersion = function(k, opts) {
  return function(client) {
    return client.removeWithVersion(k, exports.invalidVersion(), opts);
  }
};

exports.expectIteratorDone = function(it) {
  return function() {
    return it.next().then(function(entry) {
      expect(entry.done).toBeTruthy();
    })
  }
};

exports.parIterator = function(batchSize, expected, opts) {
  return function(client) {
    return client.iterator(batchSize, opts).then(function(it) {
      var promises = _.map(_.range(expected.length), function() {
        return it.next().then(function(entry) { return entry; })
      });
      return Promise.all(promises)
          .then(function(actual) {
            exports.toContainAllEntries(expected)(actual);
          })
          .then(exports.expectIteratorDone(it))
          .then(exports.expectIteratorDone(it)) // Second time should not go remote
          .then(function() { return it.close(); }) // Close iterator
          .then(function() { return client; });
    })
  }
};

exports.seqIterator = function(batchSize, expected, opts) {
  return function(client) {
    return client.iterator(batchSize, opts).then(function(it) {
      var p = _.foldl(_.range(expected.length),
          function(p) {
            return p.then(function(array) {
              return it.next().then(function(entry) {
                array.push(entry);
                return array;
              })
            });
          }, Promise.resolve([]));

      return p
          .then(function(array) { exports.toContainAllEntries(expected)(array); })
          .then(function() { return it.close(); }) // Close iterator
          .then(function() { return client; });
    })
  }
};

exports.toEqual = function(value) {
  return function(actual) {
    expect(actual).toEqual(value);
  }
};

exports.toEqualPairs = function(value) {
  return function(actual) {
    if (_.isObject(actual[0])) {
      expect(_.sortBy(actual, 'key')).toEqual(value);
    } else {
      expect(actual.sort()).toEqual(value);
    }
  }
};

exports.toContainAllEntries = function(expected) {
  return function(actual) {
    var sorted = _.sortBy(actual, 'key');
    return exports.toContainAll(expected)(sorted);
  }
};

exports.toContainAll = function(expected) {
  return function(actual) {
    var zipped = _.zip(actual, expected);
    _.map(zipped, function(e) {
      var actualEntry = e[0];
      var expectedEntry = e[1];
      exports.toContain(expectedEntry)(actualEntry);
    });
  }
};

exports.toBeStatIncr = function(stat) {
  return function(before, after) {
    expect(after[stat]).toBe(before[stat] + 1);
  }
};

exports.prev = function() {
  return { previous: true };
};

exports.expectToThrow = function(func, errorMessage, done) {
  expect(func).toThrow(errorMessage);
  if (f.existy(done)) done();
};

exports.getHotrodProtocolVersion = function() {
  var version;
  if (f.existy(process.env.protocol)) {
     version = process.env.protocol;
  }

  return version;
};

exports.startAndWaitView = function(nodeName, expectNumMembers) {
  return function() {
    var op = {
      operation: 'start',
      address: [
        { host : 'master'},
        { 'server-config' : nodeName}
      ]
    };

    return invokeDmrHttp(op)
      .then(function() { return waitUntilView(expectNumMembers, nodeName); });
  }
};

exports.stopClusterNode = function(nodeName, waitStop) {
  return function() {
    var op = {
      operation: 'stop',
      address: [
        { host : 'master'},
        { 'server-config' : nodeName}
      ]
    };

    if (waitStop) {
      return invokeDmrHttp(op).then(function() {
        return waitUntilStopped(nodeName);
      });
    }

    return invokeDmrHttp(op);
  }
};

function waitUntilStopped(nodeName) {
  return waitUntil(
    function(resp) { expect(resp.result).toEqual('DISABLED'); },
    function(resp) { return _.isEqual(resp.result, 'DISABLED') },
    getServerStatus(nodeName)
  );
}

function getServerStatus(nodeName) {
  return function() {
    var op = {
      operation : 'read-attribute',
      name : 'status',
      address : [
        { host : 'master' },
        { 'server-config' : nodeName }
      ]
    };
    return invokeDmrHttp(op);
  }
}

exports.stopAndWaitView = function(nodeStop, expectNumMembers, nodeView) {
  return function() {
    return exports.stopClusterNode(nodeStop, false)()
      .then(function() { return waitUntilView(expectNumMembers, nodeView); });
  }
};

function waitUntilView(expectNumMembers, nodeName) {
  return waitUntil(
    function(members) { expect(members.length).toEqual(expectNumMembers); },
    function(members) { return _.isEqual(expectNumMembers, members.length); },
    getClusterMembers(nodeName)
  );
}

function waitUntil(expectF, cond, op) {
  var now = new Date().getTime();

  function done(actual) {
    return cond(actual)
      && new Date().getTime() < now + MAX_WAIT;
  }

  function loop(promise) {
    exports.sleepFor(100); // brief sleep

    // Simple recursive loop until condition has been met
    return promise
      .then(function(response) {
        return !done(response)
          ? loop(op())
          : response;
      })
      .catch(function() {
        return loop(op());
      });
  }

  return loop(op())
    .then(function(actual) {
      expectF(actual);
    });
}

exports.sleepFor = function(sleepDuration) {
  var now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
};

function getClusterMembers(nodeName) {
  return function() {
    var op = {
      operation : 'read-attribute',
      name : 'members',
      address : [
        { host : 'master' },
        { server : nodeName },
        { subsystem : 'datagrid-infinispan' },
        { 'cache-container' : 'clustered' }
      ]
    };

    return invokeDmrHttp(op)
      .then(function(response) {
        var members = response.result
          .replace('[', '').replace(']', '').split(/[\s,]+/);
        return _.sortBy(members, function (m) { return m; });
      });
  }
}

function invokeDmrHttp(op) {
  return new Promise(function(fulfil, reject) {
    httpRequest({
      method: 'POST',
      url: 'http://localhost:9990/management',
      auth: {
        user: 'admin',
        pass: 'mypassword',
        sendImmediately: false
      },
      headers: {
        'Content-Type' : 'application/json'
      },
      body: JSON.stringify(op)
    }, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        fulfil(JSON.parse(body));
      } else {
        reject(util.format('Error (%s), body (%s), response(%s)',
          error, body, JSON.stringify(response)));
      }
    });
  });
}
