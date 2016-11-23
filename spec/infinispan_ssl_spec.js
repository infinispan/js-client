var util = require('util');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan TLS/SSL client', function() {

  // All invocations needs to be directed to localhost instead of 127.0.0.1
  // because Node.js uses `localhost` as default server name if none provided.

  it('can operate on data via trusted encrypted transport',
     testSsl('trust', 11422, sslTrust())
  );

  it('can operate on data via crypto store trusted encrypted transport',
     testSsl('trust-cryptostore', 11422, sslTrustCryptoStore())
  );

  it('can operate on data via authenticated encrypted transport',
     testSsl('auth', 11432, sslAuth())
  );

  it('can operate on data via SNI trusted encrypted transport',
     testSsl('sni-trusted', 11442, sslSniTrusted())
  );

  it('fails to operate if default server name (SNI) does not match default server realm',
     testError("Hostname/IP doesn't match certificate's altnames", sslSniDefault())
  );

  it('fails to operate if server name (SNI) and trusted certificate are incorrect',
     testError('CERT_SIGNATURE_FAILURE', sslSniUntrusted())
  );

  it('fails to operate if no passphrase provided for crypto store',
     testError('No passphrase defined for crypto store', sslStoreNoPassphrase())
  );

  it('fails to operate if no path provided for crypto store',
     testError('No path defined for crypto store', sslStoreNoPath())
  );

  function testSsl(infix, port, sslOpts) {
    var k = util.format('ssl-%s-key', infix);
    var v = util.format('ssl-%s-value', infix);
    return function(done) {
      t.client({port: port, host: 'localhost'}, sslOpts)
        .then(t.assert(t.put(k, v)))
        .then(t.assert(t.get(k), t.toBe(v)))
        .then(t.disconnect())
        .catch(t.failed(done))
        .finally(done);
    }
  }

  function sslTrust() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/trust/client/my-root-ca.crt.pem']
      }
    }
  }

  function sslTrustCryptoStore() {
    return {
      ssl: {
        enabled: true,
        cryptoStore: {
          path: 'spec/ssl/trust/p12/truststore_client.p12',
          passphrase: 'secret'
        }
      }
    }
  }

  function sslAuth() {
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

  function sslSniTrusted() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/trusted/client/trusted-root-ca.crt.pem'],
        sniHostName: 'trusted.acme'
      }
    }
  }

  function sslSniDefault() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/untrusted/client/untrusted-root-ca.crt.pem']
      }
    }
  }

  function sslSniUntrusted() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/untrusted/client/untrusted-root-ca.crt.pem'],
        sniHostName: "untrusted.acme"
      }
    }
  }

  function testError(err, sslOpts) {
    return function(done) {
      t.client({port: 11442, host: 'localhost'}, sslOpts)
        .then(shouldFail())
        .catch(expectError(err))
        .finally(done);
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

  function sslStoreNoPassphrase() {
    return {
      ssl: {
        enabled: true,
        cryptoStore: {
          path: 'spec/ssl/trust/p12/truststore_client.p12'
        }
      }
    }
  }

  function sslStoreNoPath() {
    return {
      ssl: {
        enabled: true,
        cryptoStore: {}
      }
    }
  }

});
