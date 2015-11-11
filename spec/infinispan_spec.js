var _ = require('underscore');
var f = require('../lib/functional');
var ispn = require('../lib/infinispan');
var Promise = require('promise');

describe('Infinispan client', function() {
  var client = ispn.client(11222, '127.0.0.1');

  beforeEach(function() {
    client.then(assert(clear()));
  });

  var prev = function() {
    return { previous: true };
  };

  it('can put -> get -> remove a key/value pair', function(done) { client
    .then(assert(put('key', 'value')))
    .then(assert(get('key'), toBe('value')))
    .then(assert(containsKey('key'), toBeTruthy))
    .then(assert(remove('key'), toBeTruthy))
    .then(assert(get('key'), toBeUndefined))
    .then(assert(containsKey('key'), toBeFalsy))
    .then(assert(remove('key'), toBeFalsy))
    .catch(failed(done))
    .finally(done);
  });
  it('can use conditional operations on a key/value pair', function(done) { client
    .then(assert(putIfAbsent('cond', 'v0'), toBeTruthy))
    .then(assert(putIfAbsent('cond', 'v1'), toBeFalsy))
    .then(assert(get('cond'), toBe('v0')))
    .then(assert(replace('cond', 'v1'), toBeTruthy))
    .then(assert(replace('other', 'v1'), toBeFalsy))
    .then(assert(get('cond'), toBe('v1')))
    .then(assert(conditional(replaceWithVersion, 'cond', 'v1', 'v2'), toBeTruthy))
    .then(assert(get('cond'), toBe('v2')))
    .then(assert(notReplaceWithVersion('_'), toBeFalsy)) // key not found
    .then(assert(notReplaceWithVersion('cond'), toBeFalsy)) // key found but invalid version
    .then(assert(get('cond'), toBe('v2')))
    .then(assert(notRemoveWithVersion('_'), toBeFalsy))
    .then(assert(notRemoveWithVersion('cond'), toBeFalsy))
    .then(assert(get('cond'), toBe('v2')))
    .then(assert(conditional(removeWithVersion, 'cond', 'v2'), toBeTruthy))
    .then(assert(get('cond'), toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
  it('can return previous values', function(done) { client
    .then(assert(putIfAbsent('prev', 'v0', prev()), toBeUndefined))
    .then(assert(putIfAbsent('prev', 'v1', prev()), toBe('v0')))
    .then(assert(remove('prev', prev()), toBe('v0')))
    .then(assert(remove('prev', prev()), toBeUndefined))
    .then(assert(put('prev', 'v1', prev()), toBeUndefined))
    .then(assert(put('prev', 'v2', prev()), toBe('v1')))
    .then(assert(replace('prev', 'v3', prev()), toBe('v2')))
    .then(assert(replace('_', 'v3', prev()), toBeUndefined))
    .then(assert(conditional(replaceWithVersion, 'prev', 'v3', 'v4', prev()), toBe('v3')))
    .then(assert(notReplaceWithVersion('_', prev()), toBeUndefined)) // key not found
    .then(assert(notReplaceWithVersion('prev', prev()), toBeUndefined)) // key found but invalid version
    .then(assert(notRemoveWithVersion('_', prev()), toBeUndefined)) // key not found
    .then(assert(notRemoveWithVersion('prev', prev()), toBeUndefined)) // key found but invalid version
    .then(assert(conditional(removeWithVersion, 'prev', 'v4', prev()), toBe('v4')))
    .catch(failed(done))
    .finally(done);
  });
  it('can use multi-key operations', function(done) {
    var pairs = [{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}, {key: 'multi3', value: 'v3'}];
    var keys = ['multi1', 'multi2'];
    client
      .then(assert(putAll(pairs), toBeUndefined))
      .then(assert(getAll(keys), toContainAll([{key: 'multi1', value: 'v1'}, {key: 'multi2', value: 'v2'}])))
      .then(assert(getAll(['_']), toEqual([])))
      .catch(failed(done))
      .finally(done);
  });
  it('can ping a server', function(done) { client
    .then(assert(ping(), toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
});

function put(k, v, opts) {
  return function(client) {
    return client.put(k, v, opts);
  }
}

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

function containsKey(k) {
  return function(client) {
    return client.containsKey(k);
  }
}

function remove(k, opts) {
  return function(client) {
    return client.remove(k, opts);
  }
}

function putIfAbsent(k, v, opts) {
  return function(client) {
    return client.putIfAbsent(k, v, opts);
  }
}

function replace(k, v, opts) {
  return function(client) {
    return client.replace(k, v, opts);
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

function assert(fun, expectFun) {
  if (f.existy(expectFun)) {
    return function(client) {
      return fun(client).then(function(value) {
        expectFun(value);
        return client;
      });
    }
  }
  return function(client) {
    return fun(client).then(function() {
      return client;
    });
  }
}

var failed = function(done) {
  return function(error) {
    done(error);
  };
};
