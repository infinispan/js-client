var _ = require('underscore');

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
    .then(t.assert(notReplaceWithVersion('prev', prev()), t.toBe('v4'))) // key found but invalid version
    .then(t.assert(notRemoveWithVersion('_', prev()), t.toBeUndefined)) // key not found
    .then(t.assert(notRemoveWithVersion('prev', prev()), t.toBe('v4'))) // key found but invalid version
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
      .then(t.assert(getBulk(), toContainAll(pairs)))
      .then(t.assert(getBulk(3), toContainAll(pairs)))
      .catch(failed(done))
      .finally(done);
  });
  it('can ping a server', function(done) { client
    .then(t.assert(ping(), t.toBeUndefined))
    .catch(failed(done))
    .finally(done);
  });
  it('can put -> get a big value', function(done) {
    var value = randomStr(128);
    client
      .then(t.assert(t.put('key', value)))
      .then(t.assert(t.get('key'), toEqual(value)))
      .catch(failed(done))
      .finally(done);
  });
  it('can put -> get a really big value', function(done) {
    var value = randomStr(1024 * 1024);
    client
      .then(t.assert(t.put('key', value)))
      .then(t.assert(t.get('key'), toEqual(value)))
      .catch(failed(done))
      .finally(done);
  });
  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) {
    client.then(t.disconnect())
      .catch(failed(done))
      .finally(done);
  })
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

function getBulk(count) {
  return function(client) {
    return client.getBulk(count);
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

function randomStr(size)  {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < size; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
