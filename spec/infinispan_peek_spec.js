var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client working with peek operations', function() {
  var client = t.client(t.local, t.authOpts);

  beforeEach(function(done) {
    client.then(t.assert(t.clear()))
      .then(function() { done(); }, t.failed(done));
  });

  it('peek returns value and metadata', function(done) { client
    .then(t.assert(t.put('peek-key', 'value', {lifespan: '10m', maxIdle: '5m'})))
    .then(t.assert(t.peek('peek-key'), function(meta) {
      expect(meta).toBeDefined();
      expect(meta.value).toBe('value');
      expect(meta.lifespan).toBe(600);
      expect(meta.maxIdle).toBe(300);
    }))
    .then(function() { done(); }, t.failed(done));
  });

  it('peek returns undefined for non-existent key', function(done) { client
    .then(t.assert(t.peek('no-such-key'), t.toBeUndefined))
    .then(function() { done(); }, t.failed(done));
  });

  it('peek does not reset max idle', function(done) { client
    .then(t.assert(t.put('peeked', 'value', {maxIdle: '2s'})))
    .then(t.assert(t.put('accessed', 'value', {maxIdle: '2s'})))
    .then(function(client) { return t.sleepFor(1000).then(function() { return client; }); })
    .then(t.assert(t.peek('peeked'), function(meta) {
      expect(meta).toBeDefined();
      expect(meta.value).toBe('value');
    }))
    .then(t.assert(t.get('accessed'), t.toBe('value')))
    .then(function(client) { return t.sleepFor(1600).then(function() { return client; }); })
    .then(t.assert(t.get('peeked'), t.toBeUndefined))
    .then(t.assert(t.get('accessed'), t.toBe('value')))
    .then(function() { done(); }, t.failed(done));
  });
});
