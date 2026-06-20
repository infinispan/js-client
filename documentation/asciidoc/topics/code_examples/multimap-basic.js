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

  // Store multiple values under the same key.
  var put = client.multimapPut('colors', 'red');
  put = put.then(function() {
    return client.multimapPut('colors', 'green');
  });
  put = put.then(function() {
    return client.multimapPut('colors', 'blue');
  });

  // Retrieve all values for a key.
  var get = put.then(function() {
    return client.multimapGet('colors');
  });
  get.then(function(values) {
    console.log('Colors: ' + values); // ['red', 'green', 'blue']
  });

  // Check if a key exists in the multimap.
  var containsKey = get.then(function() {
    return client.multimapContainsKey('colors');
  });
  containsKey.then(function(exists) {
    console.log('Contains key: ' + exists); // true
  });

  // Check if a specific value exists anywhere in the multimap.
  var containsValue = containsKey.then(function() {
    return client.multimapContainsValue('red');
  });
  containsValue.then(function(exists) {
    console.log('Contains value: ' + exists); // true
  });

  // Check if a specific key-value pair exists.
  var containsEntry = containsValue.then(function() {
    return client.multimapContainsEntry('colors', 'green');
  });
  containsEntry.then(function(exists) {
    console.log('Contains entry: ' + exists); // true
  });

  // Get the total number of entries across all keys.
  var size = containsEntry.then(function() {
    return client.multimapSize();
  });
  size.then(function(count) {
    console.log('Total entries: ' + count); // 3
  });

  // Remove a single value from a key.
  var removeEntry = size.then(function() {
    return client.multimapRemoveEntry('colors', 'red');
  });
  removeEntry.then(function(removed) {
    console.log('Removed entry: ' + removed); // true
  });

  // Remove all values for a key.
  var removeKey = removeEntry.then(function() {
    return client.multimapRemoveKey('colors');
  });
  removeKey.then(function(removed) {
    console.log('Removed key: ' + removed); // true
  });

  // Disconnect from {brandname} Server.
  return removeKey.then(function() {
    return client.disconnect();
  });

}).catch(function(error) {

  // Log any errors.
  console.log("Got error: " + error.message);

});
