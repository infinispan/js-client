var infinispan = require('infinispan');

// Use hotrods:// for TLS connections with certificate verification
var connected = infinispan.client(
  'hotrods://admin:password@127.0.0.1:11222?trust_ca=/path/to/ca.pem&sni_host=myserver'
);

connected.then(function (client) {

  console.log('Connected to Infinispan via TLS URI.');

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
