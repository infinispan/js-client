var infinispan = require('infinispan');

var connected = infinispan.client(
  [{port: 11322, host: '127.0.0.1'}, {port: 11222, host: '127.0.0.1'}]);

connected.then(function (client) {

  var members = client.getTopologyInfo().getMembers();

  // Displays all members of the {brandname} cluster.
  console.log('Connected to: ' + JSON.stringify(members));

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
