var infinispan = require('infinispan');

var connected = infinispan.client(
  {port: 11222, host: '127.0.0.1'},
  {
    authentication: {
      enabled: true,
      saslMechanism: 'SCRAM-SHA-256',
      userName: 'admin',
      password: 'changeme'
    },
    clientIntelligence: 'BASIC'
  }
);

connected.then(function (adminClient) {

  // Create a cache with transactional configuration.
  var txConfig =
    '<distributed-cache>' +
    '<encoding><key media-type="text/plain"/><value media-type="text/plain"/></encoding>' +
    '<transaction mode="NON_XA" locking="PESSIMISTIC"/>' +
    '</distributed-cache>';

  var create = adminClient.admin.getOrCreateCache('txCache', txConfig);

  return create.then(function() {
    return adminClient.disconnect();
  }).then(function() {

    // Connect to the transactional cache.
    return infinispan.client(
      {port: 11222, host: '127.0.0.1'},
      {
        authentication: {
          enabled: true,
          saslMechanism: 'SCRAM-SHA-256',
          userName: 'admin',
          password: 'changeme'
        },
        cacheName: 'txCache',
        topologyUpdates: false,
        dataFormat: {
          keyType: 'text/plain',
          valueType: 'text/plain'
        }
      }
    );

  }).then(function(client) {

    // Get the transaction manager.
    var tm = client.getTransactionManager();

    // Begin a transaction, put entries, and commit.
    var committed = tm.begin().then(function() {
      return client.put('key1', 'value1');
    }).then(function() {
      return client.put('key2', 'value2');
    }).then(function() {
      return tm.commit();
    });

    // Begin a transaction, put an entry, and roll back.
    var rolledBack = committed.then(function() {
      return tm.begin();
    }).then(function() {
      return client.put('key3', 'should-not-exist');
    }).then(function() {
      return tm.rollback();
    });

    // Read-then-write with version-based conflict detection.
    var readWrite = rolledBack.then(function() {
      return client.put('counter', '0');
    }).then(function() {
      return tm.begin();
    }).then(function() {
      return client.get('counter');
    }).then(function(current) {
      return client.put('counter', String(parseInt(current) + 1));
    }).then(function() {
      return tm.commit();
    });

    // Remove an entry within a transaction.
    var removed = readWrite.then(function() {
      return client.put('temp', 'ephemeral');
    }).then(function() {
      return tm.begin();
    }).then(function() {
      return client.remove('temp');
    }).then(function() {
      return tm.commit();
    });

    // Disconnect from {brandname} Server.
    return removed.then(function() {
      return client.disconnect();
    });

  });

}).catch(function(error) {

  // Log any errors.
  console.log("Got error: " + error.message);

});
