var infinispan = require('infinispan');

var connected = infinispan.client(
  {port: 11222, host: '127.0.0.1'},
  {
    authentication: {
      enabled: true,
      saslMechanism: 'SCRAM-SHA-256',
      userName: 'admin',
      password: 'changeme'
    }
  }
);

connected.then(function (client) {

  // Create a cache with a JSON configuration.
  var cacheConfig = JSON.stringify({
    'local-cache': {
      encoding: { 'media-type': 'text/plain' }
    }
  });
  var create = client.admin.createCache('myNewCache', cacheConfig);

  // Get or create a cache (creates if it does not exist).
  var getOrCreate = create.then(function() {
    return client.admin.getOrCreateCache('myNewCache', cacheConfig);
  });

  // List all cache names.
  var listNames = getOrCreate.then(function() {
    return client.admin.cacheNames();
  });
  listNames.then(function(names) {
    console.log('Cache names: ' + JSON.stringify(names));
  });

  // Remove a cache.
  var remove = listNames.then(function() {
    return client.admin.removeCache('myNewCache');
  });

  // Register a Protobuf schema.
  var registerSchema = remove.then(function() {
    return client.admin.registerSchema('person.proto',
      'package example;\n' +
      'message Person {\n' +
      '  required string name = 1;\n' +
      '}\n');
  });

  // Remove a Protobuf schema.
  var removeSchema = registerSchema.then(function() {
    return client.admin.removeSchema('person.proto');
  });

  // Disconnect from {brandname} Server.
  return removeSchema.then(function() {
    return client.disconnect();
  });

}).catch(function(error) {

  // Log any errors.
  console.log("Got error: " + error.message);

});
