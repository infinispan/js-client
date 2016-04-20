var _ = require('underscore');
var Promise = require('promise');
var readFile = Promise.denodeify(require('fs').readFile);

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client', function() {
  var client = t.client(t.local);

  beforeEach(function(done) { client
      .then(t.assert(t.clear()))
      .catch(t.failed(done)).finally(done);
  });

  it('can put -> get -> remove a key/value pair', function(done) { client
    .then(t.assert(t.size(), t.toBe(0)))
    .then(t.assert(t.put('key', 'value')))
    .then(t.assert(t.size(), t.toBe(1)))
    .then(t.assert(t.get('key'), t.toBe('value')))
    .then(t.assert(t.containsKey('key'), t.toBeTruthy))
    .then(t.assert(t.remove('key'), t.toBeTruthy))
    .then(t.assert(t.get('key'), t.toBeUndefined))
    .then(t.assert(t.containsKey('key'), t.toBeFalsy))
    .then(t.assert(t.remove('key'), t.toBeFalsy))
    .then(t.assert(t.size(), t.toBe(0)))
    .catch(t.failed(done))
    .finally(done);
  });
  it('can use conditional operations on a key/value pair', function(done) { client
    .then(t.assert(t.putIfAbsent('cond', 'v0'), t.toBeTruthy))
    .then(t.assert(t.putIfAbsent('cond', 'v1'), t.toBeFalsy))
    .then(t.assert(t.get('cond'), t.toBe('v0')))
    .then(t.assert(t.replace('cond', 'v1'), t.toBeTruthy))
    .then(t.assert(t.replace('other', 'v1'), t.toBeFalsy))
    .then(t.assert(t.get('cond'), t.toBe('v1')))
    .then(t.assert(t.conditional(t.replaceV, t.getV, 'cond', 'v1', 'v2'), t.toBeTruthy))
    .then(t.assert(t.get('cond'), t.toBe('v2')))
    .then(t.assert(t.notReplaceWithVersion('_'), t.toBeFalsy)) // key not found
    .then(t.assert(t.notReplaceWithVersion('cond'), t.toBeFalsy)) // key found but invalid version
    .then(t.assert(t.get('cond'), t.toBe('v2')))
    .then(t.assert(t.notRemoveWithVersion('_'), t.toBeFalsy))
    .then(t.assert(t.notRemoveWithVersion('cond'), t.toBeFalsy))
    .then(t.assert(t.get('cond'), t.toBe('v2')))
    .then(t.assert(t.conditional(t.removeWithVersion, t.getV, 'cond', 'v2'), t.toBeTruthy))
    .then(t.assert(t.get('cond'), t.toBeUndefined))
    .catch(t.failed(done))
    .finally(done);
  });
  it('can return previous values', function(done) { client
    .then(t.assert(t.putIfAbsent('prev', 'v0', t.prev()), t.toBeUndefined))
    .then(t.assert(t.putIfAbsent('prev', 'v1', t.prev()), t.toBe('v0')))
    .then(t.assert(t.remove('prev', t.prev()), t.toBe('v0')))
    .then(t.assert(t.remove('prev', t.prev()), t.toBeUndefined))
    .then(t.assert(t.put('prev', 'v1', t.prev()), t.toBeUndefined))
    .then(t.assert(t.put('prev', 'v2', t.prev()), t.toBe('v1')))
    .then(t.assert(t.replace('prev', 'v3', t.prev()), t.toBe('v2')))
    .then(t.assert(t.replace('_', 'v3', t.prev()), t.toBeUndefined))
    .then(t.assert(t.conditional(t.replaceV, t.getV, 'prev', 'v3', 'v4', t.prev()), t.toBe('v3')))
    .then(t.assert(t.notReplaceWithVersion('_', t.prev()), t.toBeUndefined)) // key not found
    .then(t.assert(t.notReplaceWithVersion('prev', t.prev()), t.toBe('v4'))) // key found but invalid version
    .then(t.assert(t.notRemoveWithVersion('_', t.prev()), t.toBeUndefined)) // key not found
    .then(t.assert(t.notRemoveWithVersion('prev', t.prev()), t.toBe('v4'))) // key found but invalid version
    .then(t.assert(t.conditional(t.removeWithVersion, t.getV, 'prev', 'v4', t.prev()), t.toBe('v4')))
    .catch(t.failed(done))
    .finally(done);
  });
  it('can use multi-key operations', function(done) {
    var pairs = [{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}, {key: 'multi3', value: 'v3'}];
    var keys = ['multi1', 'multi2'];
    client
      .then(t.assert(t.putAll(pairs), t.toBeUndefined))
      .then(t.assert(t.size(), t.toBe(3)))
      .then(t.assert(t.getAll(keys), t.toEqualPairs([{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}])))
      .then(t.assert(t.getAll(['_']), t.toEqual([])))
      .then(t.assert(t.getBulk(), t.toEqualPairs(pairs)))
      .then(t.assert(t.getBulk(3), t.toEqualPairs(pairs)))
      .then(t.assert(t.getBulkKeys(), t.toEqualPairs(['multi1', 'multi2', 'multi3'])))
      .then(t.assert(t.getBulkKeys(3), t.toEqualPairs(['multi1', 'multi2', 'multi3'])))
      .catch(t.failed(done))
      .finally(done);
  });
  it('can ping a server', function(done) { client
    .then(t.assert(t.ping(), t.toBeUndefined))
    .catch(t.failed(done))
    .finally(done);
  });
  it('can put -> get a big value', function(done) {
    var value = t.randomStr(128);
    client
      .then(t.assert(t.put('key', value)))
      .then(t.assert(t.get('key'), t.toEqual(value)))
      .catch(t.failed(done))
      .finally(done);
  });
  it('can put -> get a really big value', function(done) {
    var value = t.randomStr(1024 * 1024);
    client
      .then(t.assert(t.put('key', value)))
      .then(t.assert(t.get('key'), t.toEqual(value)))
      .catch(t.failed(done))
      .finally(done);
  });
  it('can put -> get -> remove a key/value pair on a named cache', function(done) {
    t.client(t.local, 'namedCache')
      .then(t.assert(t.put('key', 'value')))
      .then(t.assert(t.get('key'), t.toBe('value')))
      .then(t.assert(t.remove('key'), t.toBeTruthy))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });
  it('can get key/value pairs with their immortal metadata', function(done) {
    var immortal = { created : -1, lifespan: -1, lastUsed: -1, maxIdle: -1 };
    client
      .then(t.assert(t.put('meta', 'v0')))
      .then(t.assert(t.getM('meta'), t.toContain(f.merge({ value: 'v0' }, immortal))))
      .then(t.assert(t.conditional(t.replaceV, t.getM, 'meta', 'v0', 'v1'), t.toBeTruthy))
      .then(t.assert(t.getM('meta'), t.toContain(f.merge({ value: 'v1' }, immortal))))
      .catch(t.failed(done))
      .finally(done);
  });
  it('can get key/value pairs with their expirable metadata', function(done) { client
      .then(t.assert(t.put('life-meta', 'value', {lifespan: '60s'})))
      .then(t.assert(t.getM('life-meta'), t.toContain({ value: 'value', lifespan : 60})))
      .then(t.assert(t.putIfAbsent('cond-exp-meta', 'v0', {maxIdle: '45m'})))
      .then(t.assert(t.getM('cond-exp-meta'), t.toContain({ value: 'v0', maxIdle : 2700})))
      .then(t.assert(t.replace('cond-exp-meta', 'v1', {lifespan: '1d', maxIdle: '1h'})))
      .then(t.assert(t.getM('cond-exp-meta'), t.toContain({ value: 'v1', lifespan: 86400, maxIdle : 3600})))
      .catch(t.failed(done))
      .finally(done);
  });
  it('can listen for only create events', function(done) { client
      .then(t.assert(t.on('create', t.expectEvent('listen-create', 'value', t.removeListener(done)))))
      .then(t.assert(t.putIfAbsent('listen-create', 'value'), t.toBeTruthy))
      .catch(t.failed(done));
  });
  it('can listen for only modified events', function(done) { client
      .then(t.assert(t.on('modify', t.expectEvent('listen-modify', 'v1', t.removeListener(done)))))
      .then(t.assert(t.putIfAbsent('listen-modify', 'v0'), t.toBeTruthy))
      .then(t.assert(t.replace('listen-modify', 'v1'), t.toBeTruthy))
      .catch(t.failed(done));
  });
  it('can listen for only removed events', function(done) { client
      .then(t.assert(t.on('remove', t.expectEvent('listen-remove', undefined, t.removeListener(done)))))
      .then(t.assert(t.putIfAbsent('listen-remove', 'v0'), t.toBeTruthy))
      .then(t.assert(t.replace('listen-remove', 'v1'), t.toBeTruthy))
      .then(t.assert(t.remove('listen-remove'), t.toBeTruthy))
      .catch(t.failed(done));
  });
  it('can listen for create/modified/remove events in distinct listeners', function(done) { client
      .then(t.assert(t.on('create', t.expectEvent('listen-distinct', 'v0', t.removeListener()))))
      .then(t.assert(t.putIfAbsent('listen-distinct', 'v0'), t.toBeTruthy))
      .then(t.assert(t.on('modify', t.expectEvent('listen-distinct', 'v1', t.removeListener()))))
      .then(t.assert(t.replace('listen-distinct', 'v1'), t.toBeTruthy))
      .then(t.assert(t.on('remove', t.expectEvent('listen-distinct', undefined, t.removeListener(done)))))
      .then(t.assert(t.remove('listen-distinct'), t.toBeTruthy))
      .catch(t.failed(done));
  });
  it('can listen for create/modified/remove events in same listener', function(done) { client
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
  it('can listen for state events when adding listener to non-empty cache', function(done) { client
      .then(t.assert(t.putIfAbsent('listen-state-0', 'v0'), t.toBeTruthy))
      .then(t.assert(t.putIfAbsent('listen-state-1', 'v1'), t.toBeTruthy))
      .then(t.assert(t.putIfAbsent('listen-state-2', 'v2'), t.toBeTruthy))
      .then(t.assert(t.on('create', t.expectEvents(
          ['listen-state-0', 'listen-state-1', 'listen-state-2'], t.removeListener(done)),
          {'includeState' : true})))
      .catch(t.failed(done));
  });

  if (process.env.protocol == null || process.env.protocol == '2.5') {
    it('can iterate over entries', function (done) {
      var pairs = [
        {key: 'it1', value: 'v1', done: false},
        {key: 'it2', value: 'v2', done: false},
        {key: 'it3', value: 'v3', done: false}];
      client
          .then(t.assert(t.putAll(pairs), t.toBeUndefined))
          .then(t.parIterator(1, pairs)) // Iterate all data, 1 element at time, parallel
          .then(t.seqIterator(3, pairs)) // Iterate all data, 3 elements at time, sequential
          .catch(t.failed(done))
          .finally(done);
    });
    it('can iterate over entries getting their expirable metadata', function (done) {
      var pairs = [{key: 'it-exp-1', value: 'v1'}, {key: 'it-exp-2', value: 'v2'}];
      var expected = _.map(pairs, function (pair) {
        return f.merge(pair, {done: false, lifespan: 86400, maxIdle: 3600});
      });
      client
          .then(t.assert(t.putAll(pairs, {lifespan: '1d', maxIdle: '1h'}), t.toBeUndefined))
          .then(t.parIterator(1, expected, {metadata: true})) // Iterate all data, 1 element at time, parallel
          .then(t.seqIterator(3, expected, {metadata: true})) // Iterate all data, 3 elements at time, sequential
          .catch(t.failed(done))
          .finally(done);
    });
  }

  it('can failover to a secondary node if first node is not available', function(done) {
    t.client([{port: 1234, host: '127.0.0.1'}, t.local])
        .then(t.assert(t.ping(), t.toBeUndefined))
        .then(t.disconnect())
        .catch(t.failed(done))
        .finally(done);
  });
  it('can query statistic values', function(done) { client
      .then(t.assertStats(t.put('stats-key', 'stats-value'), t.toBeStatIncr('stores')))
      .then(t.assertStats(t.get('stats-key'), t.toBeStatIncr('hits')))
      .then(t.assertStats(t.get('stats-miss-key'), t.toBeStatIncr('misses')))
      .then(t.assertStats(t.remove('stats-miss-key'), t.toBeStatIncr('removeMisses')))
      .then(t.assertStats(t.remove('stats-key'), t.toBeStatIncr('removeHits')))
      .catch(t.failed(done)).finally(done);
  });
  it('can retrieve topology information', function(done) { client
    .then(t.assert(t.getTopologyId(), t.toBe(0)))
    .then(t.assert(t.getMembers(), t.toEqual([{host: '127.0.0.1', port: 11222}])))
    .catch(t.failed(done)).finally(done);
  });
  it('can execute a script remotely to store and retrieve data', function(done) {
    Promise.all([client, readFile('spec/utils/typed-put-get.js')])
        .then(function(vals) {
          var c = vals[0];
          return c.addScript('typed-put-get.js', vals[1].toString())
              .then(function() { return c; } );
        })
        .then(t.assert(t.exec('typed-put-get.js', {k: 'typed-key', v: 'typed-value'}),
                       t.toBe('typed-value')))
        .catch(t.failed(done)).finally(done);
  });
  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) { client
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

});
