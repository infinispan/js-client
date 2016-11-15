var t = require('./utils/testing'); // Testing dependency

describe('Infinispan TLS/SSL client', function() {

  it('can operate on data via trusted encrypted transport', function(done) {
    t.client(t.sslTrust, sslTrustOpts())
      .then(t.assert(t.put('ssl-trust-key', 'ssl-trust-value')))
      .then(t.assert(t.get('ssl-trust-key'), t.toBe('ssl-trust-value')))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  it('can operate on data via authenticated encrypted transport', function(done) {
    t.client(t.sslAuth, sslAuthOpts())
      .then(t.assert(t.put('ssl-auth-key', 'ssl-auth-value')))
      .then(t.assert(t.get('ssl-auth-key'), t.toBe('ssl-auth-value')))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  function sslTrustOpts() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/trust/client/my-root-ca.crt.pem']
      }
    }
  }

  function sslAuthOpts() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/auth/client/my-root-ca.crt.pem'],
        clientAuth: {
          key: 'spec/ssl/auth/client/privkey.pem',
          passphrase: 'secret',
          cert: 'spec/ssl/auth/client/cert.pem'
        }
      }
    }
  }

});
