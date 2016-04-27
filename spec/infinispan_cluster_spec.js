var _ = require('underscore');
var Promise = require('promise');

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var tests = require('./tests'); // Shared tests

describe('Infinispan cluster client', function() {
  var client = t.client(t.cluster1);

  // Since Jasmine 1.3 does not have beforeAll callback and stats resets is a
  // bit slow, execute it as first test so that it only gets executed once.
  it('resets statistics', function(done) { client
      .then(t.resetStats)
      .then(t.assert(t.clear()))
      .catch(t.failed(done)).finally(done);
  });

  it('can get cluster topology from a server node', function(done) { client
      .then(t.assert(t.getMembers(), t.toContain(
          [{host: '127.0.0.1', port: 11322}, {host: '127.0.0.1', port: 11422}])))
      .catch(t.failed(done)).finally(done);
  });

  it('can use consistent hashing to direct key-based ops to owner nodes', function(done) { client
      .then(routeConsistentHash())
      .then(t.assert(t.clear()))
      .catch(t.failed(done)).finally(done);
  });

  it('can load balance key-less operations in round-robin fashion', function(done) { client
      .then(routeRoundRobin())
      .then(t.assert(t.clear()))
      .catch(t.failed(done)).finally(done);
  });

  it('can iterate over entries in a cluster',
     tests.iterateEntries('cluster', client)
  );

  xit('can listen for create/modified/remove events in distinct listeners', function(done) { client
      .then(t.assert(t.clear()))
      .then(t.assert(t.on('create', t.expectEvent('listen-distinct', 'v0', t.removeListener()))))
      .then(t.assert(t.putIfAbsent('listen-distinct', 'v0'), t.toBeTruthy))
      .then(t.assert(t.on('modify', t.expectEvent('listen-distinct', 'v1', t.removeListener()))))
      .then(t.assert(t.replace('listen-distinct', 'v1'), t.toBeTruthy))
      .then(t.assert(t.on('remove', t.expectEvent('listen-distinct', undefined, t.removeListener(done)))))
      .then(t.assert(t.remove('listen-distinct'), t.toBeTruthy))
      .catch(t.failed(done));
  });
  xit('can listen for create/modified/remove events in same listener', function(done) { client
      .then(t.assert(t.clear()))
      .then(t.assert(t.onMany(
          [{event: 'create', listener: t.expectEvent('listen-same', 'v0')},
              {event: 'modify', listener: t.expectEvent('listen-same', 'v1')},
              {event: 'remove', listener: t.expectEvent('listen-same', undefined, t.removeListener(done))}
          ])))
      .then(t.assert(t.putIfAbsent('listen-same', 'v0'), t.toBeTruthy))
      .then(t.assert(t.replace('listen-same', 'v1'), t.toBeTruthy))
      .then(t.assert(t.remove('listen-same'), t.toBeTruthy))
      .catch(t.failed(done));
  });
  xit('can listen for state events when adding listener to non-empty cache', function(done) { client
      .then(t.assert(t.clear()))
      .then(t.assert(t.putIfAbsent('listen-state-0', 'v0'), t.toBeTruthy))
      .then(t.assert(t.putIfAbsent('listen-state-1', 'v1'), t.toBeTruthy))
      .then(t.assert(t.putIfAbsent('listen-state-2', 'v2'), t.toBeTruthy))
      .then(t.assert(t.on('create', t.expectEvents(
          ['listen-state-0', 'listen-state-1', 'listen-state-2'], t.removeListener(done)),
          {'includeState' : true})))
      .catch(t.failed(done));
  });
  xit('can execute a script remotely to store and retrieve data in cluster mode',
      tests.execPutGet(
        'spec/utils/typed-put-get.js', 'cluster', client, t.toBe('cluster-typed-value')
      )
  );
  it('can execute a script remotely to store and retrieve data in distributed mode',
      tests.execPutGet(
        'spec/utils/typed-put-get-dist.js', 'dist-cluster', client
        , toEqualJson(_.range(t.clusterSize())
                        .map(function() { return 'dist-cluster-typed-value'; }))
      )
  );

  function toEqualJson(value) {
    return function(actual) {
      expect(JSON.parse(actual)).toEqual(value);
    }
  }

  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) { client
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  function routeRoundRobin() {
    // Key-less operations should be executed in round-robin fashion.
    // This test verifies that if two putAll operations are executed,
    // these calls end up in different nodes by checking that each only
    // affects one node's statistics
    return function(client) {
      var statsBefore = getStats(client, t.cluster);

      var data = _.map(_.range(t.clusterSize()), function(i) {
        return [{key: 'round-robin-' + i + '0', value: i + '0'},
                {key: 'round-robin-' + i + '1', value: i + '1'}]
      });

      var puts = statsBefore.then(function() {
        return pmap(data, function(pairs) {
          return client.putAll(pairs);
        });
      });

      var statsAfter = _.map(_.range(t.clusterSize()), function() {
        return puts.then(function() { return client.stats(); });
      });

      return Promise.all(f.cat([statsBefore], statsAfter)).then(function(stats) {
        _.forEach(_.tail(stats), function(stat) {
          expect(stat.stores).toBe(stats[0].stores + 2);
        });
        return client;
      });
    }
  }

  function routeConsistentHash() {
    return function(client) {
      var ownerPairs = [[t.cluster1, t.cluster2], [t.cluster2, t.cluster3], [t.cluster3, t.cluster1]];
      var keys = _.map(ownerPairs, function(pair) {
        return t.findKeyForServers(client, pair);
      });

      var statsBefore = getStats(client, t.cluster);

      var puts = statsBefore.then(function() {
        return pmap(keys, function(key) {
          return client.put(key, "value");
        });
      });

      var statsAfter = _.map(t.cluster, function() {
        return puts.then(function() { return client.stats(); });
      });

      return Promise.all(f.cat([statsBefore], statsAfter)).then(function(stats) {
        _.forEach(_.tail(stats), function(stat) {
          expect(stat.stores).toBe(stats[0].stores + 1);
          expect(stat.currentNumberOfEntries).toBe(2 * (stats[0].stores + 1));
        });
        return client;
      });
    }
  }

  function getStats(c, cluster) {
    var stats = pmap(cluster, function() { return c.stats(); });
    return stats.then(function(stats) {
      _.forEach(stats, function(stat) {
        expect(stat.stores).toBe(stats[0].stores);
      });
      return stats[0];
    });
  }

  function pmap(obj, iteratee, context) {
    return Promise.all(_.map(obj, iteratee, context));
  }

});
