var _ = require('underscore');

var util = require('util');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan TLS/SSL client', function() {

  it('can operate on data via trusted encrypted transport',
     testSsl('trust', t.ssl, sslTrust())
  );

  it('can operate on data via crypto store trusted encrypted transport',
     testSsl('trust-cryptostore', t.ssl, sslTrustCryptoStore())
  );

  it('can operate on data via authenticated encrypted transport',
     testSsl('auth', t.ssl, sslAuth())
  );

  it('can operate on data via SNI trusted encrypted transport',
     testSsl('sni-trusted', t.ssl, sslSniTrusted())
  );

  it('can operate on data via SNI trusted encrypted transport while having multiple identities',
      testSsl('sni-trusted', t.ssl, sslSniTrustedInCaseOfMultipleTrustedSni())
  );

  it('fails to operate if default server name (SNI) does not match default server realm',
     testError(expectContainsAnyErrors(['self signed certificate in certificate chain', 'self-signed certificate in certificate chain']),
               sslSniDefault())
  );

  it('fails to operate if server name (SNI) and trusted certificate are incorrect',
     testError(
       expectAnyExactErrors(
         ['CERT_SIGNATURE_FAILURE'
           , 'certificate signature failure'
           , 'self signed certificate in certificate chain'
           , 'self-signed certificate in certificate chain'
         ])
       , sslSniUntrusted()
     )
  );

  it('fails to operate if no passphrase provided for crypto store',
     testError(expectAnyExactErrors(['No passphrase defined for crypto store']),
               sslStoreNoPassphrase())
  );

  it('fails to operate if no path provided for crypto store',
     testError(expectAnyExactErrors(['No path defined for crypto store']),
               sslStoreNoPath())
  );

  it('fails to operate if no encrypted transport is provided',
      testError(expectAnyExactErrors(['self signed certificate in certificate chain',  'self-signed certificate in certificate chain']),
                sslStoreNoCryptoStore())
  );

  // it('fails to operate if key for authenticated encrypted transport is missing',
  //     testError(expectAnyExactErrors(['CERT_SIGNATURE_FAILURE', 'self signed certificate']),
  //               sslAuthWithMissingKey())
  // );
  //
  // it('fails to operate if passphrase for authenticated encrypted transport is missing',
  //     testError(expectAnyExactErrors(['CERT_SIGNATURE_FAILURE', 'self signed certificate']),
  //               sslAuthWithMissingPassphrase())
  // );

  // it('fails to operate if cert path for authenticated encrypted transport is missing',
  //     testError(expectAnyExactErrors(['CERT_SIGNATURE_FAILURE', 'self signed certificate']),
  //               sslAuthWithMissingCert())
  // );

  // it('fails to operate if authenticated encrypted transport is missing',
  //     testError(expectAnyExactErrors(['CERT_SIGNATURE_FAILURE', 'self signed certificate']),
  //               sslAuthWithMissingInfo())
  // );

  it('fails to operate if trusted certificate is missing for authenticated encrypted transport',
      testError(expectAnyExactErrors(['self signed certificate in certificate chain', 'self-signed certificate in certificate chain']),
                sslAuthWithMissingTrustCertificate())
  );

  /**
   * Creates a test function that connects via SSL, puts/gets a value, and disconnects.
   * @param {string} infix - Key infix used to generate unique key/value pairs.
   * @param {object} addr - Server address to connect to.
   * @param {object} sslOpts - SSL and authentication connection options.
   * @returns {Function} Jasmine async test function.
   */
  function testSsl(infix, addr, sslOpts) {
    var k = util.format('ssl-%s-key', infix);
    var v = util.format('ssl-%s-value', infix);
    return function(done) {
      t.client(addr, sslOpts)
        .then(t.assert(t.put(k, v)))
        .then(t.assert(t.get(k), t.toBe(v)))
        .then(t.disconnect())
        .then(function() { done(); }, t.failed(done));
    };
  }

  /**
   * Creates SSL options using a trusted CA certificate.
   * @returns {object} Connection options with SSL trust and PLAIN authentication.
   */
  function sslTrust() {
    return {
      ssl: {
        enabled: true,
        secureProtocol: 'TLS_client_method',
        trustCerts: ['out/ssl/ca/ca.pem']
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options using a PKCS12 crypto store for trust.
   * @returns {object} Connection options with crypto store SSL and PLAIN authentication.
   */
  function sslTrustCryptoStore() {
    return {
      ssl: {
        enabled: true,
        secureProtocol: 'TLS_client_method',
        cryptoStore: {
          path: 'out/ssl/client/client.p12',
          passphrase: 'secret'
        }
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with client certificate authentication.
   * @returns {object} Connection options with SSL client auth and PLAIN authentication.
   */
  function sslAuth() {
    return {
        ssl: {
          enabled: true,
          trustCerts: ['out/ssl/ca/ca.pem'],
          clientAuth: {
            key: 'out/ssl/client/client.pk',
            passphrase: 'secret',
            cert: 'out/ssl/client/client.pem'
          }
        },
        authentication: {
          enabled: true,
          saslMechanism: 'PLAIN',
          userName: 'admin',
          password: 'pass'
        }
    };
  }

  /**
   * Creates SSL options with SNI hostname set to a trusted server name.
   * @returns {object} Connection options with SNI trust and PLAIN authentication.
   */
  function sslSniTrusted() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/ca/ca.pem'],
        sniHostName: 'localhost'
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options for SNI trust when multiple trusted SNI identities exist.
   * @returns {object} Connection options with SNI trust and PLAIN authentication.
   */
  function sslSniTrustedInCaseOfMultipleTrustedSni() {
    return {
        ssl: {
          enabled: true,
          trustCerts: ['out/ssl/ca/ca.pem'],
          sniHostName: 'localhost'
        },
        authentication: {
          enabled: true,
          saslMechanism: 'PLAIN',
          userName: 'admin',
          password: 'pass'
        }
    };
  }

  /**
   * Creates SSL options with a default SNI hostname that does not match the server realm.
   * @returns {object} Connection options with untrusted SNI and PLAIN authentication.
   */
  function sslSniDefault() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/untrust-ca/untrust-ca.pem'],
        sniHostName: 'trustfail'
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with a trusted certificate but no explicit SNI hostname.
   * @returns {object} Connection options with SSL trust and PLAIN authentication.
   */
  function sslSniDefaultWithTrustedCertificate() { // eslint-disable-line no-unused-vars
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/ca/ca.pem'],
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with an untrusted SNI hostname and untrusted CA certificate.
   * @returns {object} Connection options with untrusted SNI and PLAIN authentication.
   */
  function sslSniUntrusted() {
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/untrust-ca/untrust-ca.pem'],
        sniHostName: 'untrust'
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates a test function that expects an SSL connection to fail with an error.
   * @param {Function} errF - Error assertion function receiving done callback.
   * @param {object} sslOpts - SSL and authentication connection options.
   * @returns {Function} Jasmine async test function.
   */
  function testError(errF, sslOpts) {
    return function(done) {
      t.client(t.ssl, sslOpts)
        .then(shouldFail())
        .then(function() { done(); }, errF(done));
    };
  }

  /**
   * Returns a handler that disconnects the client and throws, indicating unexpected success.
   * @returns {Function} Handler that rejects with an error after disconnecting.
   */
  function shouldFail() {
    return function(client) {
      var disconnect = client.disconnect();
      return disconnect.finally(function() {
        throw Error('Expected operation to fail');
      });
    };
  }

  /**
   * Creates an assertion function that checks an error message matches exactly.
   * @param {string} msg - Expected error message.
   * @returns {Function} Assertion function receiving an error.
   */
  function expectError(msg) { // eslint-disable-line no-unused-vars
    return function(err) {
      expect(err.message).toBe(msg);
    };
  }

  /**
   * Creates an error handler that asserts the error message contains any of the expected strings.
   * @param {Array<string>} msg - Array of expected substrings.
   * @returns {Function} Curried function receiving done callback then error.
   */
  function expectContainsAnyErrors(msg) {
    return function(done) {
      return function(err) {
        toContainAnyOf(msg, err, done);
      };
    };
  }

  /**
   * Creates an error handler that asserts the error message matches any of the expected values.
   * @param {Array<string>} msgs - Array of expected error messages.
   * @returns {Function} Curried function receiving done callback then error.
   */
  function expectAnyExactErrors(msgs) {
    return function(done) {
      return function(err) {
        toBeAnyOf(msgs, err, done);
      };
    };
  }

  /**
   * Creates SSL options with a crypto store but no passphrase, expected to fail.
   * @returns {object} Connection options with incomplete crypto store configuration.
   */
  function sslStoreNoPassphrase() {
    return {
      ssl: {
        enabled: true,
        cryptoStore: {
          path: 'out/ssl/client/client.p12'
        }
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with an empty crypto store (no path), expected to fail.
   * @returns {object} Connection options with incomplete crypto store configuration.
   */
  function sslStoreNoPath() {
    return {
      ssl: {
        enabled: true,
        cryptoStore: {}
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with SSL enabled but no crypto store or trust certs, expected to fail.
   * @returns {object} Connection options with minimal SSL configuration.
   */
  function sslStoreNoCryptoStore() {
    return {
      ssl: {
        enabled: true
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with SNI hostname but no trust certificate.
   * @returns {object} Connection options with SNI but no trust certs.
   */
  function sslSniWithNoCert() { // eslint-disable-line no-unused-vars
    return {
      ssl: {
        enabled: true,
        sniHostName: 'untrust'
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with client auth but missing the private key.
   * @returns {object} Connection options with incomplete client auth configuration.
   */
  function sslAuthWithMissingKey() { // eslint-disable-line no-unused-vars
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/ca/ca.pem'],
        clientAuth: {
          passphrase: 'secret',
          cert: 'out/ssl/client/client.pem'
        },
        authentication: {
          enabled: true,
          saslMechanism: 'PLAIN',
          userName: 'admin',
          password: 'pass'
        }
      }
    };
  }

  /**
   * Creates SSL options with client auth but missing the passphrase.
   * @returns {object} Connection options with incomplete client auth configuration.
   */
  function sslAuthWithMissingPassphrase() { // eslint-disable-line no-unused-vars
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/ca/ca.pem'],
        clientAuth: {
          key: 'out/ssl/client/client.pk',
          cert: 'out/ssl/client/client.pem'
        },
        authentication: {
          enabled: true,
          saslMechanism: 'PLAIN',
          userName: 'admin',
          password: 'pass'
        }
      }
    };
  }

  /**
   * Creates SSL options with client auth but missing the client certificate.
   * @returns {object} Connection options with incomplete client auth configuration.
   */
  function sslAuthWithMissingCert() { // eslint-disable-line no-unused-vars
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/ca/ca.pem'],
        clientAuth: {
          key: 'out/ssl/client/client.pk',
          passphrase: 'secret'
        }
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with client auth but missing all auth details.
   * @returns {object} Connection options with empty client auth configuration.
   */
  function sslAuthWithMissingInfo() { // eslint-disable-line no-unused-vars
    return {
      ssl: {
        enabled: true,
        trustCerts: ['out/ssl/ca/ca.pem'],
        clientAuth: {}
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Creates SSL options with client auth but missing the trusted CA certificate.
   * @returns {object} Connection options without trust certs.
   */
  function sslAuthWithMissingTrustCertificate() {
    return {
      ssl: {
        enabled: true,
        clientAuth: {
          key: 'out/ssl/client/client.pk',
          passphrase: 'secret',
          cert: 'out/ssl/client/client.pem'
        }
      },
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
  }

  /**
   * Asserts that the actual error message matches any of the expected values.
   * @param {Array<string>} expecteds - Array of acceptable error messages.
   * @param {Error} actual - The actual error object.
   * @param {Function} done - Jasmine done callback, called with error on failure.
   * @returns {void}
   */
  function toBeAnyOf(expecteds, actual, done) {
    for (var i = 0, l = expecteds.length; i < l; i++) {
      if (_.isEqual(actual.message, expecteds[i]))
        return;
    }
    done(new Error(`[${  actual.message  }] is not any of: [${  expecteds  }]`));
  }

  /**
   * Asserts that the actual error message contains any of the expected substrings.
   * @param {Array<string>} expecteds - Array of acceptable substrings.
   * @param {Error} actual - The actual error object.
   * @param {Function} done - Jasmine done callback, called with error on failure.
   * @returns {void}
   */
  function toContainAnyOf(expecteds, actual, done) {
    for (var i = 0, l = expecteds.length; i < l; i++) {
      if (actual.message.includes(expecteds[i]))
        return;
    }
    done(new Error(`[${  actual.message  }] does not contain any of: [${  expecteds  }]`));
  }

});
