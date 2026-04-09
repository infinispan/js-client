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

  // Create a strong counter with an initial value of 0.
  var create = client.counterCreate('my-counter', {
    type: 'strong',
    storage: 'PERSISTENT',
    initialValue: 0
  });

  // Get the current counter value.
  var get = create.then(function() {
    return client.counterGet('my-counter');
  });
  get.then(function(value) {
    console.log('Counter value: ' + value); // 0
  });

  // Add a value and return the new counter value.
  var addAndGet = get.then(function() {
    return client.counterAddAndGet('my-counter', 5);
  });
  addAndGet.then(function(value) {
    console.log('After add: ' + value); // 5
  });

  // Set a value and return the previous counter value.
  var getAndSet = addAndGet.then(function() {
    return client.counterGetAndSet('my-counter', 10);
  });
  getAndSet.then(function(previous) {
    console.log('Previous value: ' + previous); // 5
  });

  // Compare and swap: update only if the current value matches.
  var cas = getAndSet.then(function() {
    return client.counterCompareAndSwap('my-counter', 10, 20);
  });
  cas.then(function(value) {
    console.log('After CAS: ' + value); // 20
  });

  // Reset the counter to its initial value.
  var reset = cas.then(function() {
    return client.counterReset('my-counter');
  });

  // Check if a counter is defined.
  var isDefined = reset.then(function() {
    return client.counterIsDefined('my-counter');
  });
  isDefined.then(function(defined) {
    console.log('Is defined: ' + defined); // true
  });

  // Retrieve the counter configuration.
  var getConfig = isDefined.then(function() {
    return client.counterGetConfiguration('my-counter');
  });
  getConfig.then(function(config) {
    console.log('Counter type: ' + config.type); // strong
  });

  // Remove the counter.
  var remove = getConfig.then(function() {
    return client.counterRemove('my-counter');
  });

  // Disconnect from {brandname} Server.
  return remove.then(function() {
    return client.disconnect();
  });

}).catch(function(error) {

  // Log any errors.
  console.log("Got error: " + error.message);

});
