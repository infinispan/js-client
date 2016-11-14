var t = require('./utils/testing'); // Testing dependency

describe('Infinispan TLS/SSL client', function() {
  var client = t.client(t.ssl, t.sslOpts('spec/ssl/chain.pem'));

  it('can operate on data via encrypted transport', function(done) { client
    .then(t.assert(t.put('key', 'value')))
    .then(t.assert(t.get('key'), t.toBe('value')))
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
