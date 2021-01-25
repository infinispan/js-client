var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client', function() {
    it('SCRAM-SHA-512', function(done) {t.client(t.local, {authentication: {
            enabled: true,
            saslMechanism: 'SCRAM-SHA-1',
            userName: 'admin',
            password: 'pass'
        }})
      .then(t.assert(t.put('key', 'value')))
      .then(t.disconnect())
      .catch(t.failed(done))
      .finally(done);
    });

    // it('external auth is working', function(done) {t.client(t.local, {authentication: {
    //         enabled: true,
    //         saslMechanism: 'EXTERNAL',
    //     }})
    //     .then(t.assert(t.put('key', 'value')))
    //     .then(t.disconnect())
    //     .catch(t.failed(done))
    //     .finally(done);
    // });
});
