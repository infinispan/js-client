var _ = require('underscore');

var t = require('./utils/testing'); // Testing dependency
var tests = require('./tests'); // Shared tests

describe('Infinispan cluster client', function() {
  var client = t.client(t.cluster1, t.authOpts);

  // Since Jasmine 1.3 does not have beforeAll callback and stats resets is a
  // bit slow, execute it as first test so that it only gets executed once.
  // @TODO Uncomment and fix this method when ISPN-10777 is implemented and available in JDG server.
  /*it('resets statistics', function(done) { client
      .then(t.resetStats)
      .then(t.assert(t.clear()))
      .then(function() { done(); }, t.failed(done));
  });*/

  it('can get cluster topology from a server node', function(done) { client
      .then(t.assert(t.getMembers(), t.toContain(t.cluster)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can use consistent hashing to direct key-based ops to owner nodes', function(done) { client
      .then(routeConsistentHash())
      .then(function() { done(); }, t.failed(done));
  });


  it('can load balance key-less operations in round-robin fashion', function(done) { client
      .then(routeRoundRobin())
      .then(t.assert(t.clear()))
      .then(function() { done(); }, t.failed(done));
  });

  it('can iterate over entries in a cluster, one entry at the time',
     tests.iterateEntries('cluster', 1, client)
  );

  it('can iterate over entries in a cluster, more than one entry at the time',
    tests.iterateEntries('cluster', 3, client)
  );

  it('can remove listener in cluster', function(done) { client
      .then(t.assert(t.clear()))
      .then(t.on('create', t.expectEvent('listen-distinct-1', done, false, 'v1')))
      .then(t.assert(t.putIfAbsent('listen-distinct-1', 'v1'), t.toBeTruthy))
      .then(t.on('create', t.expectEvent('listen-distinct-2', done, true, 'v2')))
      .then(t.assert(t.putIfAbsent('listen-distinct-2', 'v2'), t.toBeTruthy))
      .catch(t.failed(done));
  });

  it('can execute a script remotely to store and retrieve data in cluster mode',
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
  it('can execute a distributed script remotely that returns undefined', function(done) {
    client
      .then(t.loadAndExec('spec/utils/typed-null-return-dist.js'))
      .then(t.assert(t.exec('typed-null-return-dist.js'),
                     toEqualJson(_.range(t.clusterSize())
                                   .map(function() { return ''; }))))
      .then(function() { done(); }, t.failed(done));
  });

  it('can get ignore topology updates with client configuration', function(done) {
    t.client(t.cluster1, {topologyUpdates: false})
      .then(t.assert(t.getMembers(), t.toEqual([t.cluster1])))
      .then(t.disconnect())
      .then(function() { done(); }, t.failed(done));
  });

  /**
   * Creates an assertion function that parses the actual value as JSON and compares it.
   * @param {*} value - Expected value to compare against after JSON parsing.
   * @returns {Function} Assertion function receiving the actual JSON string.
   */
  function toEqualJson(value) {
    return function(actual) {
      expect(JSON.parse(actual)).toEqual(value);
    };
  }

  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) { client
      .then(t.disconnect())
      .then(function() { done(); }, t.failed(done));
  });

  /**
   * Returns a client handler that verifies round-robin load balancing for key-less operations.
   * @returns {Function} Handler that performs putAll operations and checks distribution stats.
   */
  function routeRoundRobin() {
    // Key-less operations should be executed in round-robin fashion.
    // This test verifies that if two putAll operations are executed,
    // these calls end up in different nodes by checking that each only
    // affects one node's statistics
    return function(client) {
      var data = _.map(_.range(t.clusterSize()), function(i) {
        return [{key: `round-robin-${  i  }0`, value: `${i  }0`},
                {key: `round-robin-${  i  }1`, value: `${i  }1`}];
      });

      return getStats(client, t.cluster).then(function(before) {
        return pmap(data, function(pairs) {
          return client.putAll(pairs);
        }).then(function() {
          return getStats(client, t.cluster);
        }).then(function(after) {
          _.forEach(_.zip(before, after), function(pair) {
            expect(pair[1].stores - pair[0].stores).toBe(2);
          });
          return client;
        });
      });
    };
  }

  /**
   * Returns a client handler that verifies consistent hashing routes puts to owner nodes.
   * @returns {Function} Handler that puts keys and checks store stats per node.
   */
  function routeConsistentHash() {
    return function(client) {
      var members = client.getTopologyInfo().getMembers();
      var ownerPairs = members.map(function (member, index) {
          if(index == members.length - 1)
            return [members[index], members[0]];
          return [members[index], members[index+1]];
      });
      var keys = _.map(ownerPairs, function(pair) {
        return t.findKeyForServers(client, pair);
      });

      return getStats(client, t.cluster).then(function(before) {
        return pmap(keys, function(key) {
          return client.put(key, 'value');
        }).then(function() {
          return getStats(client, t.cluster);
        }).then(function(after) {
          _.forEach(_.zip(before, after), function(pair) {
            expect(pair[1].stores - pair[0].stores).toBe(1);
            expect(pair[1].currentNumberOfEntries - pair[0].currentNumberOfEntries).toBe(2);
          });
          return client;
        });
      });
    };
  }

  /**
   * Retrieves stats from all cluster nodes and asserts they are consistent.
   * @param {object} c - Infinispan client instance.
   * @param {Array<object>} cluster - Array of cluster member addresses.
   * @returns {Promise<object>} Promise resolving to the first node's stats.
   */
  function getStats(c, cluster) {
    return pmap(cluster, function() {
      return c.stats();
    });
  }

  /**
   * Maps over a collection with an async iteratee and returns a Promise of all results.
   * @param {Array|object} obj - Collection to map over.
   * @param {Function} iteratee - Async function to apply to each element.
   * @param {*} [context] - Optional context for the iteratee.
   * @returns {Promise<Array>} Promise resolving to an array of results.
   */
  function pmap(obj, iteratee, context) {
    return Promise.all(_.map(obj, iteratee, context));
  }

});
