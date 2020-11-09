var _ = require('underscore');

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var tests = require('./tests'); // Shared tests

var authLocalOpts = {
  authentication: {
    enabled: true,
    saslMechanism: 'PLAIN',
    userName: 'admin',
    password: 'pass'
  }
}

describe('Infinispan Test Auth', function() {
    it('can authenticate with PLAIN mechanism',
        testAuth('PLAIN', t.local, authLocalOpts)
    );

    // it('can raise connection error with PLAIN mechanism',
    //     testAuth('PLAIN', t.local, {authentication: {
    //             enabled: true,
    //             saslMechanism: 'PLAIN',
    //             userName: 'wrong',
    //             password: 'wrong'
    //         }})
    // );

    function testAuth(infix, addr, authOpts) {
        return function(done) {
            t.client(addr, authOpts)
                .size()
                .then(t.disconnect())
                .catch(t.failed(done))
                .finally(done);
        }
    }
});
