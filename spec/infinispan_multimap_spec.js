var _ = require('underscore');
var t = require('./utils/testing');

describe('Infinispan multimap', function() {
  var client = t.client(t.local, t.authOpts);

  afterEach(function(done) {
    client.then(t.clear()).then(function() { done(); }, t.failed(done));
  });

  it('can put and get multiple values for a key', function(done) {
    client
      .then(t.assert(t.multimapPut('colors', 'red')))
      .then(t.assert(t.multimapPut('colors', 'green')))
      .then(t.assert(t.multimapPut('colors', 'blue')))
      .then(t.assert(t.multimapGet('colors'), function(values) {
        expect(_.sortBy(values)).toEqual(['blue', 'green', 'red']);
      }))
      .then(function() { done(); }, t.failed(done));
  });

  it('returns empty array for non-existent key', function(done) {
    client
      .then(t.assert(t.multimapGet('missing'), function(values) {
        expect(values).toEqual([]);
      }))
      .then(function() { done(); }, t.failed(done));
  });

  it('deduplicates values in set mode', function(done) {
    client
      .then(t.assert(t.multimapPut('key', 'val')))
      .then(t.assert(t.multimapPut('key', 'val')))
      .then(t.assert(t.multimapGet('key'), function(values) {
        expect(values).toEqual(['val']);
      }))
      .then(function() { done(); }, t.failed(done));
  });

  it('can check if a key exists with containsKey', function(done) {
    client
      .then(t.assert(t.multimapContainsKey('k'), t.toBeFalsy))
      .then(t.assert(t.multimapPut('k', 'v')))
      .then(t.assert(t.multimapContainsKey('k'), t.toBeTruthy))
      .then(function() { done(); }, t.failed(done));
  });

  it('can check if a value exists with containsValue', function(done) {
    client
      .then(t.assert(t.multimapContainsValue('v'), t.toBeFalsy))
      .then(t.assert(t.multimapPut('k', 'v')))
      .then(t.assert(t.multimapContainsValue('v'), t.toBeTruthy))
      .then(t.assert(t.multimapContainsValue('other'), t.toBeFalsy))
      .then(function() { done(); }, t.failed(done));
  });

  it('can check if an entry exists with containsEntry', function(done) {
    client
      .then(t.assert(t.multimapPut('k', 'v1')))
      .then(t.assert(t.multimapPut('k', 'v2')))
      .then(t.assert(t.multimapContainsEntry('k', 'v1'), t.toBeTruthy))
      .then(t.assert(t.multimapContainsEntry('k', 'v2'), t.toBeTruthy))
      .then(t.assert(t.multimapContainsEntry('k', 'v3'), t.toBeFalsy))
      .then(function() { done(); }, t.failed(done));
  });

  it('can remove a specific entry', function(done) {
    client
      .then(t.assert(t.multimapPut('k', 'v1')))
      .then(t.assert(t.multimapPut('k', 'v2')))
      .then(t.assert(t.multimapRemoveEntry('k', 'v1'), t.toBeTruthy))
      .then(t.assert(t.multimapGet('k'), function(values) {
        expect(values).toEqual(['v2']);
      }))
      .then(function() { done(); }, t.failed(done));
  });

  it('can remove all values for a key', function(done) {
    client
      .then(t.assert(t.multimapPut('k', 'v1')))
      .then(t.assert(t.multimapPut('k', 'v2')))
      .then(t.assert(t.multimapRemoveKey('k'), t.toBeTruthy))
      .then(t.assert(t.multimapGet('k'), function(values) {
        expect(values).toEqual([]);
      }))
      .then(function() { done(); }, t.failed(done));
  });

  it('returns false when removing a non-existent key', function(done) {
    client
      .then(t.assert(t.multimapRemoveKey('missing'), t.toBeFalsy))
      .then(function() { done(); }, t.failed(done));
  });

  it('can get the total size of the multimap', function(done) {
    client
      .then(t.assert(t.multimapSize(), t.toBe(0)))
      .then(t.assert(t.multimapPut('k1', 'v1')))
      .then(t.assert(t.multimapPut('k1', 'v2')))
      .then(t.assert(t.multimapPut('k2', 'v3')))
      .then(t.assert(t.multimapSize(), t.toBe(3)))
      .then(function() { done(); }, t.failed(done));
  });
});
