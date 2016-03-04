var _ = require('underscore');
var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var Promise = require('promise');

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

  it('can load balance key-less operations in round-robin fashion', function(done) { client
      .then(assertRoundRobin())
      .catch(t.failed(done)).finally(done);
  });

  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) { client
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  function assertRoundRobin() {
    // Key-less operations should be executed in round-robin fashion.
    // This test verifies that if two putAll operations are executed,
    // these calls end up in different nodes by checking that each only
    // affects one node's statistics
    return function(client) {
      var before0 = client.stats().then(function(before) {return before});
      var before1 = client.stats().then(function(before) {return before});
      var storesBefore = Promise.all([before0, before1]).then(function(stats) {
        expect(stats[0].stores).toBe(stats[1].stores);
        return stats[0].stores;
      });
      var pairs0 = [{key: 'rr00', value: '00'}, {key: 'rr01', value: '01'}];
      var pairs1 = [{key: 'rr10', value: '10'}, {key: 'rr11', value: '11'}];
      var putAll0 = storesBefore.then(function() { return client.putAll(pairs0); });
      var putAll1 = storesBefore.then(function() { return client.putAll(pairs1); });
      var allPuts = Promise.all([putAll0, putAll1]);
      var after0 = allPuts.then(function() { return client.stats(); });
      var after1 = allPuts.then(function() { return client.stats(); });
      return Promise.all([storesBefore, after0, after1]).then(function(stats) {
        var prevStores = stats[0];
        expect(stats[1].stores).toBe(prevStores + 2);
        expect(stats[2].stores).toBe(prevStores + 2);
        return client;
      });
    }
  }

});
