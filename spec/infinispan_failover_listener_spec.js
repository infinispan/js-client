var t = require('./utils/testing'); // Testing dependency

describe('Infinispan clustered clients with listeners', function() {
  t.configureLogging();

  it('can failover when nodes crash', function(done) {
    var keys = ['before-failover-listener', 'middle-failover-listener', 'after-failover-listener'];
    t.launchClusterNodeAndWaitView('server-failover-one', t.failoverConfig, t.failover1, t.failoverMCastAddr, 1, t.client)
       .then(function() {
         return t.client(t.failover1, t.authOpts);
       })
      .then(t.assert(t.getMembers(), t.toContain([t.failover1])))
      .then(t.assert(t.clear()))
      .then(t.on('create', t.expectEvents(keys, done, true)))
      .then(t.assert(t.putIfAbsent(keys[0], 'value'), t.toBeTruthy))
      .then(function(client) {return t.launchClusterNodeAndWaitView('server-failover-two', t.failoverConfig, t.failover2, t.failoverMCastAddr, 2, client);}) //11432
      .then(expectClientView([t.failover1, t.failover2]))
      .then(t.assert(t.putIfAbsent(keys[1], 'value'), t.toBeTruthy))
      .then(withAll(t.stopAndWaitView(t.failover1, 1, t.failover2)))
      .then(expectClientView([t.failover2]))
      .then(t.assert(t.putIfAbsent(keys[2], 'value'), t.toBeTruthy))
      .then(withAll(t.stopClusterNode(t.failover2, true)))
      .then(withAll(t.disconnect()))
      .catch(t.failed(done));
  }, 120000);

});

/**
 * Applies a function to the parameter and preserves it after completion.
 * @param {Function} fun - Function to apply to the parameter.
 * @returns {Function} Handler that applies fun and returns the original parameter.
 */
function withAll(fun) {
  return function(param) {
    return fun(param).then(function() { return param; });
  };
}

/**
 * Returns a handler that puts a value into the cache using params[0] as client and params[1] as key.
 * @param {string} value - Value to store in the cache.
 * @returns {Function} Handler that performs the put operation.
 */
function keyPut(value) { // eslint-disable-line no-unused-vars
  return function(params) { return params[0].put(params[1], value); };
}

/**
 * Returns a handler that gets a value from the cache and asserts it with the given function.
 * @param {Function} expectFun - Assertion function called with the retrieved value.
 * @returns {Function} Handler that performs a get using params[0] as client and params[1] as key.
 */
function keyGet(expectFun) { // eslint-disable-line no-unused-vars
  return function(params) {
    return params[0].get(params[1]).then(function(v) { expectFun(v); });
  };
}

/**
 * Returns a handler that asserts the client view contains the expected cluster members.
 * @param {Array<object>} members - Expected cluster member addresses.
 * @returns {Function} Handler that pings and checks cluster membership.
 */
function expectClientView(members) {
  return function(client) {
    return t.assert(t.ping(), t.toBeUndefined)(client)
      .then(t.assert(t.getMembers(), t.toContain(members)));
  };
}
