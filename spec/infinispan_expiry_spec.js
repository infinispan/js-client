var _ = require('underscore');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client working with expiry operations', function() {
  var client = t.client(t.local);

  beforeEach(function(done) { client
      .then(t.assert(t.clear()))
      .catch(t.failed(done)).finally(done);
  });

  it('can validate incorrect duration definitions', function(done) { client
    .then(assertError(t.put('_', '_', {lifespan: '1z'}), t.toContain('Unknown duration unit')))
    .then(assertError(t.putIfAbsent('_', '_', {lifespan: 'aa'}), t.toContain('Unknown duration format')))
    .then(assertError(t.replace('_', '_', {lifespan: 1}), t.toContain('Positive duration provided without time unit')))
    .then(assertError(t.putAll([{key: '_', value: '_'}], {lifespan: '1z'}), t.toContain('Unknown duration unit')))
    .then(assertError(t.replaceV('_', '_', '_', {lifespan: 1}), t.toContain('Positive duration provided without time unit')))
    .catch(failed(done))
    .finally(done);
  });
  it('removes keys when their lifespan has expired', function(done) { client
    .then(t.assert(t.put('life', 'value', {lifespan: '100ms'})))
    .then(t.assert(t.containsKey('life'), t.toBeTruthy))
    .then(waitLifespanExpire('life'))
    .then(t.assert(t.putIfAbsent('life-absent', 'value', {lifespan: '100000μs'})))
    .then(t.assert(t.containsKey('life-absent'), t.toBeTruthy))
    .then(waitLifespanExpire('life-absent'))
    .then(t.assert(t.putIfAbsent('life-replace', 'v0')))
    .then(t.assert(t.get('life-replace'), t.toBe('v0')))
    .then(t.assert(t.replace('life-replace', 'v1', {lifespan: '100000000ns'})))
    .then(t.assert(t.get('life-replace'), t.toBe('v1')))
    .then(waitLifespanExpire('life-replace'))
    .catch(failed(done))
    .finally(done);
  });
  it('removes keys when their max idle time has expired', function(done) {
    var pairs = [{key: 'idle-multi1', value: 'v1'}, {key: 'idle-multi2', value: 'v2'}];
    client
      .then(t.assert(t.put('idle-replace', 'v0')))
      .then(t.assert(t.conditional(t.replaceV, t.getV, 'idle-replace', 'v0', 'v1', {maxIdle: '100ms'}), t.toBeTruthy))
      .then(t.assert(t.get('idle-replace'), t.toBe('v1')))
      .then(waitIdleTimeExpire('idle-replace'))
      .then(t.assert(t.putAll(pairs, {maxIdle: '100000μs'}), t.toBeUndefined))
      .then(t.assert(t.containsKey('idle-multi2'), t.toBeTruthy))
      .then(waitIdleTimeExpire('idle-multi2'))
      .catch(failed(done))
      .finally(done);
  });
  it('can listen for expired events', function(done) { client
    .then(t.assert(t.on('expiry', t.expectEvent('listen-expiry', undefined, t.removeListener(done)))))
    .then(t.assert(t.putIfAbsent('listen-expiry', 'value', {lifespan: '100ms'})))
    .then(waitForExpiryEvent('listen-expiry'))
    .catch(failed(done));
  });
  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) {
    client.then(t.disconnect())
        .catch(failed(done))
        .finally(done);
  });

});

function waitLifespanExpire(key) {
  return function(client) {
    var contains = true;
    waitsFor(function() {
      client.containsKey(key).done(function(success) {
        contains = success;
      });

      return !contains;
    }, '`' + key + '` key should be expired', 150);

    return client;
  }
}

function waitForExpiryEvent(key) {
  return function(client) {
    sleepFor(200); // sleep required, waitFor() does not work with event
    client.containsKey(key).done(function(success) {
      expect(success).toBeFalsy();
    });
    return client;
  }
}

function sleepFor(sleepDuration){
  var now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
}

function waitIdleTimeExpire(key) {
  return function(client) {
    var contains = true;
    sleepFor(200); // sleep required
    waitsFor(function() {
      client.containsKey(key).done(function(success) {
        contains = success;
      });

      return !contains;
    }, '`' + key + '` key should be expired', 1);

    return client;
  }
}

function assertError(fun, expectErrorFun) {
  return function(client) {
    var failed = false;
    try {
      fun(client);
    } catch(error) {
      failed = true;
      expectErrorFun(error.message);
    }

    if (!failed)
      throw new Error('Expected function to fail');

    return client;
  }
}


// TODO: Duplicate
var failed = function(done) {
  return function(error) {
    done(error);
  };
};


