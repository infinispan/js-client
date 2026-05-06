var infinispan = require('infinispan');

// Connect to multiple servers using comma-separated hosts
var connected = infinispan.client(
  'hotrod://admin:password@server1:11222,server2:11322,server3:11422'
);

connected.then(function (client) {

  var members = client.getTopologyInfo().getMembers();
  console.log('Connected to: ' + JSON.stringify(members));

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
