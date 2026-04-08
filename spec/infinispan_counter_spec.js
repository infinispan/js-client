var t = require('./utils/testing'); // Testing dependency

describe('Infinispan distributed counters', function() {
  var client = t.client(t.local, t.authOpts);

  it('can create and get a strong unbounded counter', function(done) {
    var name = `strong-unbounded-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 10}), t.toBeTruthy))
      .then(t.assert(t.counterGet(name), t.toBe(10)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can create and get a strong bounded counter', function(done) {
    var name = `strong-bounded-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {
        type: 'strong', initialValue: 5, lowerBound: 0, upperBound: 100
      }), t.toBeTruthy))
      .then(t.assert(t.counterGet(name), t.toBe(5)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can create and get a weak counter', function(done) {
    var name = `weak-counter-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'weak', initialValue: 0, concurrencyLevel: 4}), t.toBeTruthy))
      .then(t.assert(t.counterGet(name), t.toBe(0)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('returns false when creating an already existing counter', function(done) {
    var name = `dup-counter-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 0}), t.toBeTruthy))
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 0}), t.toBeFalsy))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can add-and-get on a strong counter', function(done) {
    var name = `add-get-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 0}), t.toBeTruthy))
      .then(t.assert(t.counterAddAndGet(name, 5), t.toBe(5)))
      .then(t.assert(t.counterAddAndGet(name, 3), t.toBe(8)))
      .then(t.assert(t.counterAddAndGet(name, -2), t.toBe(6)))
      .then(t.assert(t.counterGet(name), t.toBe(6)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can reset a counter to its initial value', function(done) {
    var name = `reset-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 42}), t.toBeTruthy))
      .then(t.assert(t.counterAddAndGet(name, 10), t.toBe(52)))
      .then(t.assert(t.counterReset(name), t.toBeTruthy))
      .then(t.assert(t.counterGet(name), t.toBe(42)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can compare-and-swap on a strong counter', function(done) {
    var name = `cas-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 10}), t.toBeTruthy))
      .then(t.assert(t.counterCompareAndSwap(name, 10, 20), t.toBe(10)))
      .then(t.assert(t.counterGet(name), t.toBe(20)))
      // CAS with wrong expected value should return current value
      .then(t.assert(t.counterCompareAndSwap(name, 999, 30), t.toBe(20)))
      .then(t.assert(t.counterGet(name), t.toBe(20)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can check if a counter is defined', function(done) {
    var name = `defined-${Date.now()}`;
    client
      .then(t.assert(t.counterIsDefined(name), t.toBeFalsy))
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 0}), t.toBeTruthy))
      .then(t.assert(t.counterIsDefined(name), t.toBeTruthy))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can get counter configuration', function(done) {
    var name = `get-config-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 7}), t.toBeTruthy))
      .then(function(cl) {
        return cl.counterGetConfiguration(name).then(function(config) {
          expect(config).toBeDefined();
          expect(config.type).toBe('strong');
          expect(config.initialValue).toBe(7);
          return cl;
        });
      })
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can get-and-set on a strong counter', function(done) {
    var name = `get-set-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 100}), t.toBeTruthy))
      .then(t.assert(t.counterGetAndSet(name, 200), t.toBe(100)))
      .then(t.assert(t.counterGet(name), t.toBe(200)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can remove a counter', function(done) {
    var name = `remove-counter-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {type: 'strong', initialValue: 50}), t.toBeTruthy))
      .then(t.assert(t.counterGet(name), t.toBe(50)))
      .then(t.assert(t.counterRemove(name), t.toBeTruthy))
      // After removal, counter is reset to initial value if re-accessed
      .then(t.assert(t.counterGet(name), t.toBe(50)))
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  it('can create a persistent strong counter', function(done) {
    var name = `persistent-${Date.now()}`;
    client
      .then(t.assert(t.counterCreate(name, {
        type: 'strong', initialValue: 0, storage: 'persistent'
      }), t.toBeTruthy))
      .then(function(cl) {
        return cl.counterGetConfiguration(name).then(function(config) {
          expect(config).toBeDefined();
          expect(config.storage).toBe('persistent');
          return cl;
        });
      })
      .then(t.assert(t.counterRemove(name)))
      .then(function() { done(); }, t.failed(done));
  });

  // Since Jasmine 1.3 does not have afterAll callback, this disconnect test must be last
  it('disconnects client', function(done) {
    client
      .then(t.disconnect())
      .then(function() { done(); }, t.failed(done));
  });
});
