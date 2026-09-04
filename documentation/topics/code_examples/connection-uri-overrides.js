var infinispan = require('infinispan');

// URI provides the base configuration; the options argument overrides specific fields
var connected = infinispan.client(
  'hotrod://admin:password@127.0.0.1:11222',
  {
    authentication: {
      saslMechanism: 'SCRAM-SHA-256'
    },
    nearCache: {
      maxEntries: 100
    }
  }
);

connected.then(function (client) {

  console.log('Connected with SCRAM-SHA-256 and near caching.');

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
