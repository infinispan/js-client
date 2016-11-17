var t = require('./utils/testing'); // Testing dependency

describe('Infinispan TLS/SSL client', function() {

  // All invocations needs to be directed to localhost instead of 127.0.0.1
  // because Node.js uses `localhost` as default server name if none provided.

  it('can operate on data via trusted encrypted transport', function(done) {
    t.client({port: 11422, host: 'localhost'}, sslTrustOpts())
      .then(t.assert(t.put('ssl-trust-key', 'ssl-trust-value')))
      .then(t.assert(t.get('ssl-trust-key'), t.toBe('ssl-trust-value')))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  it('can operate on data via authenticated encrypted transport', function(done) {
    t.client({port: 11432, host: 'localhost'}, sslAuthOpts())
      .then(t.assert(t.put('ssl-auth-key', 'ssl-auth-value')))
      .then(t.assert(t.get('ssl-auth-key'), t.toBe('ssl-auth-value')))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  it('can operate on data via SNI trusted encrypted transport', function(done) {
    t.client({port: 11442, host: 'localhost'}, sslSniTrustedOpts())
      .then(t.assert(t.put('ssl-sni-trusted-key', 'ssl-sni-trusted-value')))
      .then(t.assert(t.get('ssl-sni-trusted-key'), t.toBe('ssl-sni-trusted-value')))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
  });

  it('fails to operate if default server name (SNI) does not match default server realm', function(done) {
    t.client({port: 11442, host: 'localhost'}, sslSniDefaultOpts())
      .then(shouldFail())
      .catch(expectError("Hostname/IP doesn't match certificate's altnames"))
      .finally(done);
  });

  it('fails to operate if server name (SNI) and trusted certificate are incorrect', function(done) {
    t.client({port: 11442, host: 'localhost'}, sslSniUntrustedOpts())
      .then(shouldFail())
      .catch(expectError('CERT_SIGNATURE_FAILURE'))
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

  function sslSniTrustedOpts() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/trusted/client/trusted-root-ca.crt.pem'],
        sniHostName: 'trusted.acme'
      }
    }
  }

  function sslSniDefaultOpts() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/untrusted/client/untrusted-root-ca.crt.pem']
      }
    }
  }

  function sslSniUntrustedOpts() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/untrusted/client/untrusted-root-ca.crt.pem'],
        sniHostName: "untrusted.acme"
      }
    }
  }

  function shouldFail() {
    return function(client) {
      var disconnect = client.disconnect();
      return disconnect.finally(function() {
        throw Error("Expected operation to fail");
      });
    }
  }

  function expectError(msg) {
    return function(err) {
      expect(err.message).toBe(msg);
    }
  }

});
