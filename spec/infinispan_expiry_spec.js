var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client working with expiry operations', function() {
  var client = t.client(t.local, t.authOpts);
  var client1 = t.client(t.cluster1, t.authOpts);
  var client2 = t.client(t.cluster2, t.authOpts);
  var client3 = t.client(t.cluster3, t.authOpts);

  beforeEach(function(done) {
    Promise.all([
      client.then(t.assert(t.clear())),
      client1.then(t.assert(t.clear()))
    ]).then(function() { done(); }, t.failed(done));
  });

  it('can validate incorrect duration definitions', function(done) { client
    .then(assertError(t.put('_', '_', {lifespan: '1z'}), t.toContain('Unknown duration unit')))
    .then(assertError(t.putIfAbsent('_', '_', {lifespan: 'aa'}), t.toContain('Unknown duration format')))
    .then(assertError(t.replace('_', '_', {lifespan: 1}), t.toContain('Positive duration provided without time unit')))
    .then(assertError(t.putAll([{key: '_', value: '_'}], {lifespan: '1z'}), t.toContain('Unknown duration unit')))
    .then(assertError(t.replaceV('_', '_', '_', {lifespan: 1}), t.toContain('Positive duration provided without time unit')))
    .then(function() { done(); }, t.failed(done));
  });
  it('removes keys when their lifespan has expired', function(done) { client
    .then(t.assert(t.put('life', 'value', {lifespan: '100ms'})))
    .then(t.assert(t.containsKey('life'), t.toBeTruthy))
    .then(waitLifespanExpire('life', 1000))
    .then(t.assert(t.putIfAbsent('life-absent', 'value', {lifespan: '100000μs'})))
    .then(t.assert(t.containsKey('life-absent'), t.toBeTruthy))
    .then(waitLifespanExpire('life-absent', 1000))
    .then(t.assert(t.putIfAbsent('life-replace', 'v0')))
    .then(t.assert(t.get('life-replace'), t.toBe('v0')))
    .then(t.assert(t.replace('life-replace', 'v1', {lifespan: '100000000ns'})))
    .then(t.assert(t.get('life-replace'), t.toBe('v1')))
    .then(waitLifespanExpire('life-replace', 1000))
    .then(function() { done(); }, t.failed(done));
  });
  xit('removes keys when their lifespan has expired in cluster', function(done) { client1
      .then(t.assert(t.put('life', 'value', {lifespan: '100ms'})))
      .then(t.assert(t.containsKey('life'), t.toBeTruthy))
      .then(function(client) {
          return client2
              .then(t.assert(t.containsKey('life'), t.toBeTruthy))
              .then(waitLifespanExpire('life', 1000))
              .then(t.assert(t.putIfAbsent('life-absent', 'value', {lifespan: '100000μs'})))
              .then(t.assert(t.containsKey('life-absent'), t.toBeTruthy))
              .then(function() {
                return client;
              });
      })
      .then(function(client){
        return client3
            .then(t.assert(t.get('life-absent'), t.toBe('value')))
            .then(waitLifespanExpire('life-absent', 1000))
            .then(t.assert(t.putIfAbsent('life-replace', 'v0')))
            .then(t.assert(t.get('life-replace'), t.toBe('v0')))
            .then(t.assert(t.replace('life-replace', 'v1', {lifespan: '100000000ns'})))
            .then(function() {
              return client;
            });
      })
      .then(t.assert(t.get('life-replace'), t.toBe('v1')))
      .then(waitLifespanExpire('life-replace', 1000))
      .then(function() { done(); }, t.failed(done));
  });
  it('removes keys when their max idle time has expired', function(done) {
    var pairs = [{key: 'idle-multi1', value: 'v1'}, {key: 'idle-multi2', value: 'v2'}];
    client
        .then(t.assert(t.put('idle-replace', 'v0')))
        .then(t.assert(t.conditional(t.replaceV, t.getM, 'idle-replace', 'v0', 'v1', {maxIdle: '100ms'}), t.toBeTruthy))
        .then(t.assert(t.get('idle-replace'), t.toBe('v1')))
        .then(waitIdleTimeExpire('idle-replace', 1000))
        .then(t.assert(t.putAll(pairs, {maxIdle: '100000μs'}), t.toBeUndefined))
        .then(t.assert(t.containsKey('idle-multi1'), t.toBeTruthy))
        .then(t.assert(t.containsKey('idle-multi2'), t.toBeTruthy))
        .then(waitIdleTimeExpire('idle-multi1', 1000))
        .then(waitIdleTimeExpire('idle-multi2', 1000))
        .then(function() { done(); }, t.failed(done));
  });
  it('removes keys when their max idle time has expired in cluster', function(done) {
    var pairs = [{key: 'idle-multi1', value: 'v1'}, {key: 'idle-multi2', value: 'v2'}];
    client1
      .then(t.assert(t.put('idle-replace', 'v0')))
      .then(t.assert(t.conditional(t.replaceV, t.getM, 'idle-replace', 'v0', 'v1', {maxIdle: '100ms'}), t.toBeTruthy))
      .then(t.assert(t.get('idle-replace'), t.toBe('v1')))
      .then(function(client) {
        return client2
            .then(t.assert(t.get('idle-replace'), t.toBe('v1')))
            .then(waitIdleTimeExpire('idle-replace', 1000))
            .then(t.assert(t.containsKey('idle-replace'), t.toBeFalsy))
            .then(t.assert(t.putAll(pairs, {maxIdle: '100000μs'}), t.toBeUndefined))
            .then(function() {
              return client;
            });
      })
      .then(function(client) {
        return client3
            .then(t.assert(t.containsKey('idle-multi2'), t.toBeTruthy))
            .then(waitIdleTimeExpire('idle-multi2', 1000))
            .then(t.assert(t.containsKey('idle-multi2'), t.toBeFalsy))
            .then(function() {
              return client;
            });
      })
      .then(t.assert(t.containsKey('idle-multi2'), t.toBeFalsy))
      .then(function() { done(); }, t.failed(done));
  });
  it('can listen for expired events', function(done) { client
    .then(t.on('expiry', t.expectEvent('listen-expiry', done, true)))
    .then(t.assert(t.putIfAbsent('listen-expiry', 'value', {lifespan: '100ms'})))
    .then(waitForExpiryEvent('listen-expiry'))
    .catch(t.failed(done));
  });

  it('can listen for custom expired events', function(done) {
    var expected = 'KeyValueWithPrevious{key=listen-expiry, value=value, prev=null}';
    var opts = { converterFactory : { name: 'key-value-with-previous-converter-factory' } };
    client.then(t.on('expiry', t.expectCustomEvent(expected, done), opts))
        .then(t.assert(t.putIfAbsent('listen-expiry', 'value', {lifespan: '100ms'})))
        .then(waitForExpiryEvent('listen-expiry'))
        .catch(t.failed(done));
  });

  it('can listen for expired events in cluster', function(done) { client1
      .then(t.on('expiry', t.expectEvent('listen-expiry', done, true)))
      .then(t.assert(t.putIfAbsent('listen-expiry', 'value', {lifespan: '100ms'})))
      .then(function(client) {
        return client2
            .then(t.assert(t.containsKey('listen-expiry'), t.toBeTruthy))
            .then(waitForExpiryEvent('listen-expiry'))
            .then(function() {
              return client;
            });
      })
      .then(t.assert(t.containsKey('listen-expiry'), t.toBeFalsy))
      .catch(t.failed(done));
  });

});

/**
 * Returns a promise that resolves after the specified delay.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>} Promise that resolves after the delay.
 */
function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/**
 * Polls the cache until the given key has expired or the timeout is reached.
 * @param {object} client - Infinispan client instance.
 * @param {string} key - Cache key to check for expiry.
 * @param {number} timeout - Maximum time in milliseconds to wait for expiry.
 * @returns {Promise<void>} Promise that resolves when the key has expired.
 */
function pollUntilExpired(client, key, timeout) {
  var start = Date.now();
  /**
   * Checks whether the key still exists and retries after a short delay.
   * @returns {Promise<void>} Promise that resolves when the key no longer exists.
   */
  function check() {
    if (Date.now() - start > timeout) {
      throw new Error(`\`${  key  }\` key should be expired (timed out after ${  timeout  }ms)`);
    }
    return client.containsKey(key).then(function(exists) {
      if (!exists) return;
      return delay(50).then(check);
    });
  }
  return check();
}

/**
 * Returns a client handler that waits for a key's lifespan to expire.
 * @param {string} key - Cache key to wait for expiry.
 * @param {number} timeout - Maximum time in milliseconds to wait.
 * @returns {Function} Handler function receiving and returning the client.
 */
function waitLifespanExpire(key, timeout) {
  return function(client) {
    return pollUntilExpired(client, key, timeout).then(function() {
      return client;
    });
  };
}

/**
 * Returns a client handler that waits for an expiry event and asserts the key no longer exists.
 * @param {string} key - Cache key to verify has expired.
 * @returns {Function} Handler function receiving and returning the client.
 */
function waitForExpiryEvent(key) {
  return function(client) {
    return delay(200).then(function() {
      return client.containsKey(key).then(function(success) {
        expect(success).toBeFalsy();
        return client;
      });
    });
  };
}

/**
 * Returns a client handler that waits for a key's max idle time to expire.
 * @param {string} key - Cache key to wait for expiry.
 * @param {number} timeout - Maximum time in milliseconds to wait.
 * @returns {Function} Handler function receiving and returning the client.
 */
function waitIdleTimeExpire(key, timeout) {
  return function(client) {
    return delay(200).then(function() {
      return pollUntilExpired(client, key, timeout);
    }).then(function() {
      return client;
    });
  };
}

/**
 * Returns a client handler that invokes a function and asserts it throws an expected error.
 * @param {Function} fun - Function to invoke that is expected to throw.
 * @param {Function} expectErrorFun - Assertion function called with the error message.
 * @returns {Function} Handler function receiving and returning the client.
 */
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
  };
}


