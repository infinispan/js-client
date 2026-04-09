var t = require('./utils/testing'); // Testing dependency

describe('Infinispan clustered clients', function() {

  it('can failover when nodes crash', function(done) {
      t.launchClusterNodeAndWaitView('server-failover-one', t.failoverConfig, t.failover1, t.failoverMCastAddr, 1)
          .then(function() {
              return t.client(t.failover1,  t.authOpts);
          })
          .then(t.assert(t.getMembers(), t.toContain([t.failover1])))
          .then(function(client) {
            return t.launchClusterNodeAndWaitView('server-failover-two', t.failoverConfig, t.failover2, t.failoverMCastAddr,  2, client);}) //11432
          .then(expectClientView([t.failover1, t.failover2]))
          .then(function(client) { return t.launchClusterNodeAndWaitView('server-failover-three', t.failoverConfig, t.failover3, t.failoverMCastAddr, 3, client); }) //11442
          .then(expectClientView([t.failover1, t.failover2, t.failover3]))
          .then(keyGen([t.failover2, t.failover3]))
          .then(withAll(keyPut('failover-value')))
          .then(withAll(keyGet(t.toBe('failover-value'))))
          .then(withFirst(t.stopAndWaitView(t.failover3, 2, t.failover1)))
          .then(withFirst(expectClientView([t.failover1, t.failover2])))
          .then(withAll(keyGet(t.toBe('failover-value'))))
          .then(withFirst(t.stopAndWaitView(t.failover2, 1, t.failover1)))
          .then(withFirst(expectClientView([t.failover1])))
          .then(withAll(keyGet(t.toBe('failover-value'))))
          .then(withFirst(t.stopClusterNode(t.failover1, false)))
          .then(withFirst(t.disconnect()))
          .then(function() { done(); }, t.failed(done));
  }, 120000);

});

/**
 * Returns a handler that finds a key owned by the given server addresses.
 * @param {Array<object>} addrs - Server addresses to find a key for.
 * @returns {Function} Handler that returns a tuple of [client, key].
 */
function keyGen(addrs) {
  return function(cl) { return [cl, t.findKeyForServers(cl, addrs)]; };
}

/**
 * Applies a function to the first element of a params tuple and preserves the tuple.
 * @param {Function} fun - Function to apply to the first element.
 * @returns {Function} Handler that applies fun to params[0] and returns params.
 */
function withFirst(fun) {
  return function(params) {
    return fun(params[0]).then(function() { return params; });
  };
}

/**
 * Applies a function to the entire params tuple and preserves it.
 * @param {Function} fun - Function to apply to the params.
 * @returns {Function} Handler that applies fun and returns the original params.
 */
function withAll(fun) {
  return function(param) {
    return fun(param).then(function() { return param; });
  };
}

/**
 * Returns a handler that puts a value into the cache using the key from the params tuple.
 * @param {string} value - Value to store in the cache.
 * @returns {Function} Handler that performs a put using params[0] as client and params[1] as key.
 */
function keyPut(value) {
  return function(params) { return params[0].put(params[1], value); };
}

/**
 * Returns a handler that gets a value from the cache and asserts it with the given function.
 * @param {Function} expectFun - Assertion function called with the retrieved value.
 * @returns {Function} Handler that performs a get using params[0] as client and params[1] as key.
 */
function keyGet(expectFun) {
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
