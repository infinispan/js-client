var util = require('util');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan TLS/SSL client', function() {

  it('can operate on data via trusted encrypted transport',
     testSsl('trust', t.sslTrust, sslTrust())
  );

  it('can operate on data via crypto store trusted encrypted transport',
     testSsl('trust-cryptostore', t.sslTrust, sslTrustCryptoStore())
  );

  it('can operate on data via authenticated encrypted transport',
     testSsl('auth', t.sslAuth, sslAuth())
  );

  it('can operate on data via SNI trusted encrypted transport',
     testSsl('sni-trusted', t.sslSni, sslSniTrusted())
  );

  it('can operate on data via SNI trusted encrypted transport while having multiple identities',
      testSsl('sni-trusted', t.sslSni, sslSniTrustedInCaseOfMultipleTrustedSni())
  );

  it('fails to operate if default server name (SNI) does not match default server realm',
     testError(expectContainsError("Hostname/IP doesn't match certificate's altnames"),
               sslSniDefault())
  );

  it('fails to operate if server name (SNI) and trusted certificate are incorrect',
     testError(expectAnyExactErrors(['CERT_SIGNATURE_FAILURE', 'certificate signature failure']),
               sslSniUntrusted())
  );

  it('fails to operate if server name (SNI) is not provided, but certificate is trusted',
      testError('CERT_SIGNATURE_FAILURE', sslSniDefaultWithTrustedCertificate())
  );

  it('fails to operate if server name (SNI) has no valid certificate',
      testError('SELF_SIGNED_CERT_IN_CHAIN', sslSniWithNoCert())
  );

  it('fails to operate if no passphrase provided for crypto store',
     testError(expectError('No passphrase defined for crypto store'),
               sslStoreNoPassphrase())
  );

  it('fails to operate if no path provided for crypto store',
     testError(expectError('No path defined for crypto store'),
               sslStoreNoPath())
  );

  it('fails to operate if no encrypted transport is provided',
      testError('SELF_SIGNED_CERT_IN_CHAIN', sslStoreNoCryptoStore())
  );

  it('fails to operate if key for authenticated encrypted transport is missing',
      testError('CERT_SIGNATURE_FAILURE', sslAuthWithMissingKey())
  );

  it('fails to operate if passphrase for authenticated encrypted transport is missing',
      testError('CERT_SIGNATURE_FAILURE', sslAuthWithMissingPassphrase())
  );

  it('fails to operate if cert path for authenticated encrypted transport is missing',
      testError('CERT_SIGNATURE_FAILURE', sslAuthWithMissingCert())
  );

  it('fails to operate if authenticated encrypted transport is missing',
      testError('CERT_SIGNATURE_FAILURE', sslAuthWithMissingInfo())
  );

  it('fails to operate if trusted certificate is missing for authenticated encrypted transport',
      testError('SELF_SIGNED_CERT_IN_CHAIN', sslAuthWithMissingTrustCertificate())
  );

  function testSsl(infix, addr, sslOpts) {
    var k = util.format('ssl-%s-key', infix);
    var v = util.format('ssl-%s-value', infix);
    return function(done) {
      t.client(addr, sslOpts)
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

  function sslSniTrustedInCaseOfMultipleTrustedSni() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/trusted/client/trusted1.acme-root-ca.crt.pem'],
        sniHostName: 'trusted1.acme'
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

  function sslSniDefaultWithTrustedCertificate() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/sni/trusted/client/trusted-root-ca.crt.pem']
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

  function testError(errF, sslOpts) {
    return function(done) {
      t.client(t.sslSni, sslOpts)
        .then(shouldFail())
        .catch(errF)
        .finally(done);
    }
  }

  function shouldFail() {
    return function(client) {
      var disconnect = client.disconnect();
      return disconnect.finally(function() {
        throw Error('Expected operation to fail');
      });
    }
  }

  function expectError(msg) {
    return function(err) {
      expect(err.message).toBe(msg);
    }
  }

  function expectContainsError(msg) {
    return function(err) {
      toContainAnyOf([msg], err);
    }
  }

  function expectAnyExactErrors(msgs) {
    return function(err) {
      toBeAnyOf(msgs, err);
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

  function sslStoreNoCryptoStore() {
    return {
      ssl: {
        enabled: true
      }
    }
  }

  function sslSniWithNoCert() {
    return {
      ssl: {
        enabled: true,
        sniHostName: "untrusted.acme"
      }
    }
  }

  function sslAuthWithMissingKey() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/auth/client/my-root-ca.crt.pem'],
        clientAuth: {
          passphrase: 'secret',
          cert: 'spec/ssl/auth/client/cert.pem'
        }
      }
    }
  }

  function sslAuthWithMissingPassphrase() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/auth/client/my-root-ca.crt.pem'],
        clientAuth: {
          key: 'spec/ssl/auth/client/privkey.pem',
          cert: 'spec/ssl/auth/client/cert.pem'
        }
      }
    }
  }

  function sslAuthWithMissingCert() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/auth/client/my-root-ca.crt.pem'],
        clientAuth: {
          key: 'spec/ssl/auth/client/privkey.pem',
          passphrase: 'secret'
        }
      }
    }
  }

  function sslAuthWithMissingInfo() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['spec/ssl/auth/client/my-root-ca.crt.pem'],
        clientAuth: {}
      }
    }
  }

  function sslAuthWithMissingTrustCertificate() {
    return {
      ssl: {
        enabled: true,
        clientAuth: {
          key: 'spec/ssl/auth/client/privkey.pem',
          passphrase: 'secret',
          cert: 'spec/ssl/auth/client/cert.pem'
        }
      }
    }
  }

  function toBeAnyOf(expecteds, actual) {
    for (var i = 0, l = expecteds.length; i < l; i++) {
      if (actual === expecteds[i])
        return;
    }
    throw Error(actual + ' is not any of: ' + expecteds);
  }

  function toContainAnyOf(expecteds, actual) {
    for (var i = 0, l = expecteds.length; i < l; i++) {
      if (expecteds[i].includes(actual))
        return;
    }
    throw Error(actual + ' does not contain any of: ' + expecteds);
  }

});
