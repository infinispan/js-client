var t = require('./utils/testing'); // Testing dependency

describe('Infinispan admin operations', function() {
  var client = t.client(t.local, t.authOpts);

  describe('cache lifecycle', function() {
    afterEach(function(done) {
      client.then(function(c) {
        return c.admin.removeCache('admin-test-cache').catch(function() {});
      }).then(function() { done(); }, t.failed(done));
    });

    it('creates and removes a cache', function(done) {
      client
        .then(function(c) {
          return c.admin.createCache('admin-test-cache', '<local-cache/>')
            .then(function() { return c.admin.cacheNames(); })
            .then(function(names) {
              expect(names).toContain('admin-test-cache');
              return c.admin.removeCache('admin-test-cache');
            })
            .then(function() { return c.admin.cacheNames(); })
            .then(function(names) {
              expect(names).not.toContain('admin-test-cache');
            });
        })
        .then(function() { done(); }, t.failed(done));
    });

    it('creates a cache with configuration', function(done) {
      client
        .then(function(c) {
          return c.admin.createCache('admin-test-cache', '<local-cache><encoding media-type="text/plain"/></local-cache>')
            .then(function() { return c.admin.cacheNames(); })
            .then(function(names) {
              expect(names).toContain('admin-test-cache');
            });
        })
        .then(function() { done(); }, t.failed(done));
    });

    it('getOrCreateCache creates if missing', function(done) {
      client
        .then(function(c) {
          return c.admin.getOrCreateCache('admin-test-cache', '<local-cache/>')
            .then(function() { return c.admin.cacheNames(); })
            .then(function(names) {
              expect(names).toContain('admin-test-cache');
            })
            // Calling again should not fail
            .then(function() {
              return c.admin.getOrCreateCache('admin-test-cache', '<local-cache/>');
            });
        })
        .then(function() { done(); }, t.failed(done));
    });

    it('lists cache names', function(done) {
      client
        .then(function(c) {
          return c.admin.cacheNames().then(function(names) {
            expect(Array.isArray(names)).toBe(true);
            // Default cache should always exist
            expect(names).toContain('default');
          });
        })
        .then(function() { done(); }, t.failed(done));
    });
  });

  describe('schema management', function() {
    var protoSchema = 'package test;\nmessage Person {\n  required string name = 1;\n}\n';

    afterEach(function(done) {
      client.then(function(c) {
        return c.admin.removeSchema('test-person.proto').catch(function() {});
      }).then(function() { done(); }, t.failed(done));
    });

    it('registers a schema', function(done) {
      client
        .then(function(c) {
          return c.admin.registerSchema('test-person.proto', protoSchema);
        })
        .then(function() { done(); }, t.failed(done));
    });

    it('removes a schema', function(done) {
      client
        .then(function(c) {
          return c.admin.registerSchema('test-person.proto', protoSchema)
            .then(function() { return c.admin.removeSchema('test-person.proto'); });
        })
        .then(function() { done(); }, t.failed(done));
    });
  });
});
