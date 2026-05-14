var infinispan = require('infinispan');

// Connect using a Hot Rod URI
var connected = infinispan.client(
  'hotrod://admin:password@127.0.0.1:11222'
);

connected.then(function (client) {

  console.log('Connected to Infinispan via URI.');

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
