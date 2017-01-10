var _ = require('underscore');

var Promise = require('promise');
var util = require('util');

var t = require('./utils/testing'); // Testing dependency
var tests = require('./tests'); // Shared tests

describe('Infinispan xsite cluster client', function() {

  // Since Jasmine 1.3 does not have beforeAll callback, execute
  // any cleanup as first test so that it only gets executed once.
  it('start sites', function(done) {
    var earth1 = t.startAndWaitView('server-earth-one', 1);
    var moon1 = t.startAndWaitView('server-moon-one', 1);
    Promise.all([earth1(), moon1()]).catch(t.failed(done)).finally(done);
  }, 15000);

  it('can manually switch and fail over sites', function(done) {
    siteClients().then(function(cs) {
      expect(cs[0].getTopologyInfo().getMembers()).toEqual([t.earth1]);
      expect(cs[1].getTopologyInfo().getMembers()).toEqual([t.moon1]);
      return cs[0].getTopologyInfo().switchToCluster('site-moon')
        .then(function() {
          expect(cs[0].getTopologyInfo().getMembers()).toEqual([t.moon1]);
          return cs[0].getTopologyInfo().switchToDefaultCluster();
        })
        .then(function() {
          expect(cs[0].getTopologyInfo().getMembers()).toEqual([t.earth1]);
          return cs[0].put('xsite-key', 'xsite-value');
        })
        .then(assertGet('xsite-key', 'xsite-value', cs[0]))
        .then(assertGet('xsite-key', 'xsite-value', cs[1]))
        .then(t.stopClusterNode('server-earth-one', true))
        // Client connected to surviving site should find data
        .then(assertGet('xsite-key', 'xsite-value', cs[1]))
        // Client connected to crashed site should failover
        .then(assertGet('xsite-key', 'xsite-value', cs[0]))
        // Double check both clients' topologies point to the same server
        .then(function() {
          expect(cs[0].getTopologyInfo().getMembers()).toEqual([t.moon1]);
          expect(cs[1].getTopologyInfo().getMembers()).toEqual([t.moon1]);
        })
        // Re-launch site stopped site and stop alive site
        .then(t.startAndWaitView('server-earth-one', 1))
        .then(t.stopClusterNode('server-moon-one', true))
        // Client connected to failed over site should come back to original site
        .then(assertGet('xsite-key', undefined, cs[0]))
        .then(function() {
          expect(cs[0].getTopologyInfo().getMembers()).toEqual([t.earth1]);
        })
        .then(function() {
          return cs[0].put('xsite-key-2', 'xsite-value-2');
        })
        .then(assertGet('xsite-key-2', 'xsite-value-2', cs[0]))
        .finally(function() {
          return Promise.all(_.map(cs, function(c) { return c.disconnect(); }));
        });
    })
    .catch(t.failed(done)).finally(done);
  }, 15000);

});

function assertGet(k, expected, client) {
  return function() {
    return client.get(k)
      .then(function(v) {
        expect(v).toBe(expected);
      })
  }
}

function clusterSiteMoon() {
  return {
    cacheName: t.xsiteCacheName,
    clusters: [
      {
        name: 'site-moon',
        servers: [t.moon1]
      }
    ]
  };
}

function siteClients() {
  return Promise.all([
    t.client(t.earth1, clusterSiteMoon()),
    t.client(t.moon1, {cacheName: t.xsiteCacheName})
  ]);
}
