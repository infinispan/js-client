var _ = require('underscore');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan clustered clients', function() {
  t.configureLogging();

  // Since Jasmine 1.3 does not have beforeAll callback, execute
  // any cleanup as first test so that it only gets executed once.
  it('cleanup', function(done) {
    var stop2 = t.stopClusterNode('server-failover-two', false);
    var start1 = t.startAndWaitView('server-failover-one', 1);
    Promise.all([stop2(), start1()]).catch(t.failed(done)).finally(done);
  });

  it('can failover when nodes crash', function(done) {
    var keys = ['before-failover-listener', 'middle-failover-listener', 'after-failover-listener'];
    t.client(t.failover1)
      .then(t.assert(t.getMembers(), t.toContain([t.failover1])))
      .then(t.assert(t.clear()))
      .then(t.on('create', t.expectEvents(keys, done, true)))
      .then(t.assert(t.putIfAbsent(keys[0], 'value'), t.toBeTruthy))
      .then(withAll(t.startAndWaitView('server-failover-two', 2)))
      .then(expectClientView([t.failover1, t.failover2]))
      .then(t.assert(t.putIfAbsent(keys[1], 'value'), t.toBeTruthy))
      .then(withAll(t.stopAndWaitView('server-failover-one', 1, 'server-failover-two')))
      .then(expectClientView([t.failover2]))
      .then(t.assert(t.putIfAbsent(keys[2], 'value'), t.toBeTruthy))
      .catch(t.failed(done));
  }, 20000);

});

function keyGen(addrs) {
  return function(cl) { return [cl, t.findKeyForServers(cl, addrs)]; }
}

function withFirst(fun) {
  return function(params) {
    return fun(params[0]).then(function() { return params; })
  }
}

function withAll(fun) {
  return function(param) {
    return fun(param).then(function() { return param; })
  }
}

function keyPut(value) {
  return function(params) { return params[0].put(params[1], value) }
}

function keyGet(expectFun) {
  return function(params) {
    return params[0].get(params[1]).then(function(v) { expectFun(v); })
  }
}

function expectClientView(members) {
  return function(client) {
    return t.assert(t.ping(), t.toBeUndefined)(client)
      .then(t.assert(t.getMembers(), t.toContain(members)))
  }
}
