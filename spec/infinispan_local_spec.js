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
    .then(t.assert(get('key'), toBe('value')))
    .then(t.assert(t.containsKey('key'), toBeTruthy))
    .then(t.assert(remove('key'), toBeTruthy))
    .then(t.assert(get('key'), toBeUndefined))
    .then(t.assert(t.containsKey('key'), toBeFalsy))
    .then(t.assert(remove('key'), toBeFalsy))
    .catch(failed(done))
    .finally(done);
  });
  it('can use conditional operations on a key/value pair', function(done) { client
    .then(t.assert(t.putIfAbsent('cond', 'v0'), toBeTruthy))
    .then(t.assert(t.putIfAbsent('cond', 'v1'), toBeFalsy))
    .then(t.assert(get('cond'), toBe('v0')))
    .then(t.assert(t.replace('cond', 'v1'), toBeTruthy))
    .then(t.assert(t.replace('other', 'v1'), toBeFalsy))
    .then(t.assert(get('cond'), toBe('v1')))
    .then(t.assert(conditional(replaceWithVersion, 'cond', 'v1', 'v2'), toBeTruthy))
    .then(t.assert(get('cond'), toBe('v2')))
    .then(t.assert(notReplaceWithVersion('_'), toBeFalsy)) // key not found
    .then(t.assert(notReplaceWithVersion('cond'), toBeFalsy)) // key found but invalid version
    .then(t.assert(get('cond'), toBe('v2')))
    .then(t.assert(notRemoveWithVersion('_'), toBeFalsy))
    .then(t.assert(notRemoveWithVersion('cond'), toBeFalsy))
    .then(t.assert(get('cond'), toBe('v2')))
    .then(t.assert(conditional(removeWithVersion, 'cond', 'v2'), toBeTruthy))
    .then(t.assert(get('cond'), toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
  it('can return previous values', function(done) { client
    .then(t.assert(t.putIfAbsent('prev', 'v0', prev()), toBeUndefined))
    .then(t.assert(t.putIfAbsent('prev', 'v1', prev()), toBe('v0')))
    .then(t.assert(remove('prev', prev()), toBe('v0')))
    .then(t.assert(remove('prev', prev()), toBeUndefined))
    .then(t.assert(t.put('prev', 'v1', prev()), toBeUndefined))
    .then(t.assert(t.put('prev', 'v2', prev()), toBe('v1')))
    .then(t.assert(t.replace('prev', 'v3', prev()), toBe('v2')))
    .then(t.assert(t.replace('_', 'v3', prev()), toBeUndefined))
    .then(t.assert(conditional(replaceWithVersion, 'prev', 'v3', 'v4', prev()), toBe('v3')))
    .then(t.assert(notReplaceWithVersion('_', prev()), toBeUndefined)) // key not found
    .then(t.assert(notReplaceWithVersion('prev', prev()), toBeUndefined)) // key found but invalid version
    .then(t.assert(notRemoveWithVersion('_', prev()), toBeUndefined)) // key not found
    .then(t.assert(notRemoveWithVersion('prev', prev()), toBeUndefined)) // key found but invalid version
    .then(t.assert(conditional(removeWithVersion, 'prev', 'v4', prev()), toBe('v4')))
    .catch(failed(done))
    .finally(done);
  });
  it('can use multi-key operations', function(done) {
    var pairs = [{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}, {key: 'multi3', value: 'v3'}];
    var keys = ['multi1', 'multi2'];
    client
      .then(t.assert(putAll(pairs), toBeUndefined))
      .then(t.assert(getAll(keys), toContainAll([{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}])))
      .then(t.assert(getAll(['_']), toEqual([])))
      .catch(failed(done))
      .finally(done);
  });
  it('can ping a server', function(done) { client
    .then(t.assert(ping(), toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
});

function getAll(keys) {
  return function(client) {
    return client.getAll(keys);
  }
}

function putAll(pairs, opts) {
  return function(client) {
    return client.putAll(pairs, opts);
  }
}

function get(k) {
  return function(client) {
    return client.get(k);
  }
}

//function containsKey(k) {
//  return function(client) {
//    return client.containsKey(k);
//  }
//}

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

function conditional(writeFun, k, old, v, opts) {
  return function(client) {
    return client.getVersioned(k).then(function(versioned) {
      expect(versioned.value).toBe(old);
      expect(versioned.version).toBeDefined();
      return writeFun(client, k, versioned.version, v, opts);
    });
  }
}

var invalidVersion = function() {
  return new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
};

function replaceWithVersion(client, k, version, v, opts) {
  return client.replaceWithVersion(k, v, version, opts);
}

function notReplaceWithVersion(k, opts) {
  return function(client) {
    return client.replaceWithVersion(k, 'ignore', invalidVersion(), opts);
  }
}

function removeWithVersion(client, k, version, opts) {
  return client.removeWithVersion(k, version, opts);
}

function notRemoveWithVersion(k, opts) {
  return function(client) {
    return client.removeWithVersion(k, invalidVersion(), opts);
  }
}

function toBe(value) {
  return function(actual) {
    expect(actual).toBe(value);
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

function toBeUndefined(actual) {
  expect(actual).toBeUndefined();
}

function toBeTruthy(actual) {
  expect(actual).toBeTruthy();
}

function toBeFalsy(actual) {
  expect(actual).toBeFalsy();
}

var failed = function(done) {
  return function(error) {
    done(error);
  };
};
