var t = require('./utils/testing'); // Testing dependency
var ispn = require('../lib/infinispan');
var protocols = require('../lib/protocols');

describe('Protocol auto-negotiation', function() {
  t.configureLogging();

  it('should negotiate a supported protocol version', function(done) {
    ispn.client(t.local, {version: 'auto', authentication: t.authOpts.authentication})
      .then(function(client) {
        var version = client.getProtocolVersion();
        expect(version).toBeDefined();
        expect(protocols.VERSION_ORDER).toContain(version);
        return client.disconnect();
      })
      .then(function() { done(); }, t.failed(done));
  });

  it('should perform basic operations after negotiation', function(done) {
    ispn.client(t.local, {version: 'auto', authentication: t.authOpts.authentication})
      .then(function(client) {
        return client.put('neg-key', 'neg-value')
          .then(function() { return client.get('neg-key'); })
          .then(function(v) {
            expect(v).toBe('neg-value');
          })
          .then(function() { return client.remove('neg-key'); })
          .then(function() { return client.disconnect(); });
      })
      .then(function() { done(); }, t.failed(done));
  });

  it('should report correct version with explicit protocol', function(done) {
    ispn.client(t.local, {version: '3.1', authentication: t.authOpts.authentication})
      .then(function(client) {
        expect(client.getProtocolVersion()).toBe('3.1');
        return client.disconnect();
      })
      .then(function() { done(); }, t.failed(done));
  });
});
