var t = require('./utils/testing'); // Testing dependency

describe('Protocol 4.0 previous values with metadata', function() {
  t.configureLogging();

  // Force protocol 4.0 to ensure metadata is returned
  var scramAuth = {
    enabled: true,
    saslMechanism: 'SCRAM-SHA-256',
    userName: 'admin',
    password: 'pass'
  };
  var clientOpts = {version: '4.0', authentication: scramAuth};
  var client = t.client(t.local, clientOpts);

  beforeEach(function(done) {
    client
      .then(t.assert(t.clear()))
      .then(function() { done(); }, t.failed(done));
  });

  it('put returns previous value with metadata', function(done) {
    client
      .then(t.assert(t.put('meta-key', 'v0')))
      .then(t.assert(t.put('meta-key', 'v1', t.prev()), t.prevWithMeta(function(prev) {
        expect(prev.value).toBe('v0');
      })))
      .then(function() { done(); }, t.failed(done));
  });

  it('putIfAbsent returns previous value with metadata', function(done) {
    client
      .then(t.assert(t.put('meta-key', 'v0')))
      .then(t.assert(t.putIfAbsent('meta-key', 'v1', t.prev()), t.prevWithMeta(function(prev) {
        expect(prev.value).toBe('v0');
      })))
      .then(function() { done(); }, t.failed(done));
  });

  it('replace returns previous value with metadata', function(done) {
    client
      .then(t.assert(t.put('meta-key', 'v0')))
      .then(t.assert(t.replace('meta-key', 'v1', t.prev()), t.prevWithMeta(function(prev) {
        expect(prev.value).toBe('v0');
      })))
      .then(function() { done(); }, t.failed(done));
  });

  it('remove returns previous value with metadata', function(done) {
    client
      .then(t.assert(t.put('meta-key', 'v0')))
      .then(t.assert(t.remove('meta-key', t.prev()), t.prevWithMeta(function(prev) {
        expect(prev.value).toBe('v0');
      })))
      .then(function() { done(); }, t.failed(done));
  });

  it('replaceWithVersion returns previous value with metadata', function(done) {
    client
      .then(t.assert(t.put('meta-key', 'v0')))
      .then(t.assert(t.conditional(t.replaceV, t.getM, 'meta-key', 'v0', 'v1', t.prev()),
        t.prevWithMeta(function(prev) {
          expect(prev.value).toBe('v0');
        })))
      .then(function() { done(); }, t.failed(done));
  });

  it('removeWithVersion returns previous value with metadata', function(done) {
    client
      .then(t.assert(t.put('meta-key', 'v0')))
      .then(t.assert(t.conditional(t.removeWithVersion, t.getM, 'meta-key', 'v0', t.prev()),
        t.prevWithMeta(function(prev) {
          expect(prev.value).toBe('v0');
        })))
      .then(function() { done(); }, t.failed(done));
  });

  it('previous value metadata includes expiry when set', function(done) {
    client
      .then(t.assert(t.put('meta-exp', 'v0', {lifespan: '1h', maxIdle: '30m'})))
      .then(t.assert(t.put('meta-exp', 'v1', t.prev()), t.prevWithMeta(function(prev) {
        expect(prev.value).toBe('v0');
        expect(prev.lifespan).toBe(3600);
        expect(prev.maxIdle).toBe(1800);
        expect(prev.created).toBeDefined();
        expect(prev.lastUsed).toBeDefined();
      })))
      .then(function() { done(); }, t.failed(done));
  });

  it('returns undefined previous when key does not exist', function(done) {
    client
      .then(t.assert(t.put('no-prev', 'v0', t.prev()), t.toBeUndefined))
      .then(t.assert(t.remove('no-exist', t.prev()), t.toBeUndefined))
      .then(t.assert(t.replace('no-exist', 'v0', t.prev()), t.toBeUndefined))
      .then(function() { done(); }, t.failed(done));
  });
});
