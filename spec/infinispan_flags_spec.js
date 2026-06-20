var t = require('./utils/testing');
var infinispan = require('../lib/infinispan');

describe('Infinispan Hot Rod flags', function() {
  var client = t.client(t.local, t.authOpts);

  beforeEach(function(done) {
    client.then(t.assert(t.clear()))
      .then(function() { done(); }, t.failed(done));
  });

  it('can put with SKIP_CACHE_LOAD flag', function(done) {
    client
      .then(t.assert(t.put('flag-key', 'v1', { flags: infinispan.flags.SKIP_CACHE_LOAD })))
      .then(t.assert(t.get('flag-key'), t.toBe('v1')))
      .then(function() { done(); }, t.failed(done));
  });

  it('can put with SKIP_INDEXING flag', function(done) {
    client
      .then(t.assert(t.put('flag-key', 'v1', { flags: infinispan.flags.SKIP_INDEXING })))
      .then(t.assert(t.get('flag-key'), t.toBe('v1')))
      .then(function() { done(); }, t.failed(done));
  });

  it('can put with combined flags', function(done) {
    var combined = infinispan.flags.SKIP_CACHE_LOAD | infinispan.flags.SKIP_INDEXING;
    client
      .then(t.assert(t.put('flag-key', 'v1', { flags: combined })))
      .then(t.assert(t.get('flag-key'), t.toBe('v1')))
      .then(function() { done(); }, t.failed(done));
  });

  it('opts.previous still works without opts.flags', function(done) {
    client
      .then(t.assert(t.put('flag-key', 'v1', t.prev()), t.toBeUndefined))
      .then(t.assert(t.put('flag-key', 'v2', t.prev()), t.toBePrevOf('v1')))
      .then(function() { done(); }, t.failed(done));
  });

  it('opts.previous and opts.flags work together', function(done) {
    client
      .then(t.assert(t.put('flag-key', 'v1')))
      .then(t.assert(t.put('flag-key', 'v2', {
        previous: true,
        flags: infinispan.flags.SKIP_CACHE_LOAD
      }), t.toBePrevOf('v1')))
      .then(function() { done(); }, t.failed(done));
  });

  it('SKIP_LISTENER_NOTIFICATION suppresses listener events', function(done) {
    client.then(function(client) {
      var eventReceived = false;
      return client.addListener('create', function() { eventReceived = true; })
        .then(function(listenerId) {
          return client.put('silent-key', 'v1', { flags: infinispan.flags.SKIP_LISTENER_NOTIFICATION })
            .then(function() {
              return new Promise(function(resolve) { setTimeout(resolve, 500); });
            })
            .then(function() {
              expect(eventReceived).toBe(false);
              return client.removeListener(listenerId);
            });
        })
        .then(function() { return client; });
    }).then(function() { done(); }, t.failed(done));
  });

  it('can remove with SKIP_LISTENER_NOTIFICATION flag', function(done) {
    client
      .then(t.assert(t.put('flag-key', 'v1')))
      .then(t.assert(t.remove('flag-key', { flags: infinispan.flags.SKIP_LISTENER_NOTIFICATION }), t.toBeTruthy))
      .then(t.assert(t.get('flag-key'), t.toBeUndefined))
      .then(function() { done(); }, t.failed(done));
  });

  it('exposes all six flag constants', function(done) {
    expect(infinispan.flags.FORCE_RETURN_VALUE).toBe(0x0001);
    expect(infinispan.flags.DEFAULT_LIFESPAN).toBe(0x0002);
    expect(infinispan.flags.DEFAULT_MAXIDLE).toBe(0x0004);
    expect(infinispan.flags.SKIP_CACHE_LOAD).toBe(0x0008);
    expect(infinispan.flags.SKIP_INDEXING).toBe(0x0010);
    expect(infinispan.flags.SKIP_LISTENER_NOTIFICATION).toBe(0x0020);
    done();
  });
});
