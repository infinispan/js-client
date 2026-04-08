var t = require('./utils/testing');

describe('Infinispan near cache', function() {
  var ncOpts = {
    authentication: t.authOpts.authentication,
    nearCache: {maxEntries: 16}
  };
  var client = t.client(t.local, ncOpts);

  beforeEach(function(done) {
    client
      .then(t.assert(t.clear()))
      .then(function() { done(); }, t.failed(done));
  });

  it('should cache get results in the near cache', function(done) {
    client
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.put('nc-key', 'nc-value')))
      .then(t.assert(t.get('nc-key'), t.toBe('nc-value')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      // Second get should be served from near cache
      .then(t.assert(t.get('nc-key'), t.toBe('nc-value')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(function() { done(); }, t.failed(done));
  });

  it('should invalidate near cache on put', function(done) {
    client
      .then(t.assert(t.put('nc-put', 'v1')))
      .then(t.assert(t.get('nc-put'), t.toBe('v1')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(t.assert(t.put('nc-put', 'v2')))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.get('nc-put'), t.toBe('v2')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(function() { done(); }, t.failed(done));
  });

  it('should invalidate near cache on remove', function(done) {
    client
      .then(t.assert(t.put('nc-rm', 'v1')))
      .then(t.assert(t.get('nc-rm'), t.toBe('v1')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(t.assert(t.remove('nc-rm'), t.toBeTruthy))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.get('nc-rm'), t.toBeUndefined))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(function() { done(); }, t.failed(done));
  });

  it('should invalidate near cache on replace', function(done) {
    client
      .then(t.assert(t.put('nc-rep', 'v1')))
      .then(t.assert(t.get('nc-rep'), t.toBe('v1')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(t.assert(t.replace('nc-rep', 'v2')))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.get('nc-rep'), t.toBe('v2')))
      .then(function() { done(); }, t.failed(done));
  });

  it('should invalidate near cache on putIfAbsent', function(done) {
    client
      .then(t.assert(t.put('nc-pia', 'v1')))
      .then(t.assert(t.get('nc-pia'), t.toBe('v1')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(t.assert(t.putIfAbsent('nc-pia', 'v2')))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(function() { done(); }, t.failed(done));
  });

  it('should clear near cache on clear', function(done) {
    client
      .then(t.assert(t.put('nc-c1', 'v1')))
      .then(t.assert(t.put('nc-c2', 'v2')))
      .then(t.assert(t.get('nc-c1'), t.toBe('v1')))
      .then(t.assert(t.get('nc-c2'), t.toBe('v2')))
      .then(t.assert(t.nearCacheSize(), t.toBe(2)))
      .then(t.assert(t.clear()))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(function() { done(); }, t.failed(done));
  });

  it('should populate near cache from getWithMetadata', function(done) {
    client
      .then(t.assert(t.put('nc-meta', 'v1')))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.getM('nc-meta'), t.toContain({value: 'v1'})))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      // Subsequent get should hit near cache
      .then(t.assert(t.get('nc-meta'), t.toBe('v1')))
      .then(function() { done(); }, t.failed(done));
  });

  it('should invalidate near cache on putAll', function(done) {
    client
      .then(t.assert(t.put('nc-pa1', 'v1')))
      .then(t.assert(t.put('nc-pa2', 'v2')))
      .then(t.assert(t.get('nc-pa1'), t.toBe('v1')))
      .then(t.assert(t.get('nc-pa2'), t.toBe('v2')))
      .then(t.assert(t.nearCacheSize(), t.toBe(2)))
      .then(t.assert(t.putAll([{key: 'nc-pa1', value: 'v1-new'}, {key: 'nc-pa2', value: 'v2-new'}])))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.get('nc-pa1'), t.toBe('v1-new')))
      .then(t.assert(t.get('nc-pa2'), t.toBe('v2-new')))
      .then(function() { done(); }, t.failed(done));
  });

  it('should evict oldest entries when near cache exceeds maxEntries', function(done) {
    var smallNcOpts = {
      authentication: t.authOpts.authentication,
      nearCache: {maxEntries: 3}
    };
    var smallClient = t.client(t.local, smallNcOpts);

    smallClient
      .then(t.assert(t.clear()))
      .then(t.assert(t.put('evict-1', 'v1')))
      .then(t.assert(t.put('evict-2', 'v2')))
      .then(t.assert(t.put('evict-3', 'v3')))
      .then(t.assert(t.put('evict-4', 'v4')))
      .then(t.assert(t.get('evict-1'), t.toBe('v1')))
      .then(t.assert(t.get('evict-2'), t.toBe('v2')))
      .then(t.assert(t.get('evict-3'), t.toBe('v3')))
      .then(t.assert(t.get('evict-4'), t.toBe('v4')))
      // Near cache should have at most 3 entries
      .then(t.assert(t.nearCacheSize(), t.toBe(3)))
      .then(t.assert(t.disconnect()))
      .then(function() { done(); }, t.failed(done));
  });

  it('should invalidate near cache on replaceWithVersion', function(done) {
    client
      .then(t.assert(t.put('nc-rwv', 'v1')))
      .then(t.assert(t.get('nc-rwv'), t.toBe('v1')))
      .then(t.assert(t.nearCacheSize(), t.toBe(1)))
      .then(t.assert(t.conditional(t.replaceV, t.getM, 'nc-rwv', 'v1', 'v2'), t.toBeTruthy))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(t.assert(t.get('nc-rwv'), t.toBe('v2')))
      .then(function() { done(); }, t.failed(done));
  });

  it('should not cache undefined values', function(done) {
    client
      .then(t.assert(t.get('nonexistent'), t.toBeUndefined))
      .then(t.assert(t.nearCacheSize(), t.toBe(0)))
      .then(function() { done(); }, t.failed(done));
  });

  afterAll(function(done) {
    client
      .then(t.assert(t.disconnect()))
      .then(function() { done(); }, t.failed(done));
  });
});
