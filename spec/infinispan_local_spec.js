var _ = require('underscore');
var f = require('../lib/functional');
var Promise = require('promise');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client', function() {
  var client = t.client();

  beforeEach(function() {
    client.then(t.assert(clear()));
  });

  var prev = function() {
    return { previous: true };
  };

  it('can put -> get -> remove a key/value pair', function(done) { client
    .then(t.assert(t.put('key', 'value')))
    .then(t.assert(t.get('key'), t.toBe('value')))
    .then(t.assert(t.containsKey('key'), t.toBeTruthy))
    .then(t.assert(remove('key'), t.toBeTruthy))
    .then(t.assert(t.get('key'), t.toBeUndefined))
    .then(t.assert(t.containsKey('key'), t.toBeFalsy))
    .then(t.assert(remove('key'), t.toBeFalsy))
    .catch(failed(done))
    .finally(done);
  });
  it('can use conditional operations on a key/value pair', function(done) { client
    .then(t.assert(t.putIfAbsent('cond', 'v0'), t.toBeTruthy))
    .then(t.assert(t.putIfAbsent('cond', 'v1'), t.toBeFalsy))
    .then(t.assert(t.get('cond'), t.toBe('v0')))
    .then(t.assert(t.replace('cond', 'v1'), t.toBeTruthy))
    .then(t.assert(t.replace('other', 'v1'), t.toBeFalsy))
    .then(t.assert(t.get('cond'), t.toBe('v1')))
    .then(t.assert(t.conditional(t.replaceV, 'cond', 'v1', 'v2'), t.toBeTruthy))
    .then(t.assert(t.get('cond'), t.toBe('v2')))
    .then(t.assert(notReplaceWithVersion('_'), t.toBeFalsy)) // key not found
    .then(t.assert(notReplaceWithVersion('cond'), t.toBeFalsy)) // key found but invalid version
    .then(t.assert(t.get('cond'), t.toBe('v2')))
    .then(t.assert(notRemoveWithVersion('_'), t.toBeFalsy))
    .then(t.assert(notRemoveWithVersion('cond'), t.toBeFalsy))
    .then(t.assert(t.get('cond'), t.toBe('v2')))
    .then(t.assert(t.conditional(removeWithVersion, 'cond', 'v2'), t.toBeTruthy))
    .then(t.assert(t.get('cond'), t.toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
  it('can return previous values', function(done) { client
    .then(t.assert(t.putIfAbsent('prev', 'v0', prev()), t.toBeUndefined))
    .then(t.assert(t.putIfAbsent('prev', 'v1', prev()), t.toBe('v0')))
    .then(t.assert(remove('prev', prev()), t.toBe('v0')))
    .then(t.assert(remove('prev', prev()), t.toBeUndefined))
    .then(t.assert(t.put('prev', 'v1', prev()), t.toBeUndefined))
    .then(t.assert(t.put('prev', 'v2', prev()), t.toBe('v1')))
    .then(t.assert(t.replace('prev', 'v3', prev()), t.toBe('v2')))
    .then(t.assert(t.replace('_', 'v3', prev()), t.toBeUndefined))
    .then(t.assert(t.conditional(t.replaceV, 'prev', 'v3', 'v4', prev()), t.toBe('v3')))
    .then(t.assert(notReplaceWithVersion('_', prev()), t.toBeUndefined)) // key not found
    .then(t.assert(notReplaceWithVersion('prev', prev()), t.toBeUndefined)) // key found but invalid version
    .then(t.assert(notRemoveWithVersion('_', prev()), t.toBeUndefined)) // key not found
    .then(t.assert(notRemoveWithVersion('prev', prev()), t.toBeUndefined)) // key found but invalid version
    .then(t.assert(t.conditional(removeWithVersion, 'prev', 'v4', prev()), t.toBe('v4')))
    .catch(failed(done))
    .finally(done);
  });
  it('can use multi-key operations', function(done) {
    var pairs = [{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}, {key: 'multi3', value: 'v3'}];
    var keys = ['multi1', 'multi2'];
    client
      .then(t.assert(t.putAll(pairs), t.toBeUndefined))
      .then(t.assert(getAll(keys), toContainAll([{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}])))
      .then(t.assert(getAll(['_']), toEqual([])))
      .catch(failed(done))
      .finally(done);
  });
  it('can ping a server', function(done) { client
    .then(t.assert(ping(), t.toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
});

function getAll(keys) {
  return function(client) {
    return client.getAll(keys);
  }
}

function remove(k, opts) {
  return function(client) {
    return client.remove(k, opts);
  }
}

function clear() {
  return function(client) {
    return client.clear();
  }
}

function ping() {
  return function(client) {
    return client.ping();
  }
}

var invalidVersion = function() {
  return new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
};

function notReplaceWithVersion(k, opts) {
  return function(client) {
    return client.replaceWithVersion(k, 'ignore', invalidVersion(), opts);
  }
}

function removeWithVersion(k, version, opts) {
  return function(client) {
    return client.removeWithVersion(k, version, opts);
  }
}

function notRemoveWithVersion(k, opts) {
  return function(client) {
    return client.removeWithVersion(k, invalidVersion(), opts);
  }
}

function toEqual(value) {
  return function(actual) {
    expect(actual).toEqual(value);
  }
}

function toContainAll(value) {
  return function(actual) {
    expect(_.sortBy(actual, 'key')).toEqual(value);
  }
}

var failed = function(done) {
  return function(error) {
    done(error);
  };
};
