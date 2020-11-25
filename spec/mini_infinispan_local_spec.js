var _ = require('underscore');

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var tests = require('./tests'); // Shared tests

describe('Infinispan local client', function() {
  var client = t.client(t.local, t.authOpts);

  it('can put -> get -> remove a key/value pair', function(done) {
    client.then(t.assert(t.size(), t.toBe(0)))
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

  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) { client
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });
});
