var _ = require('underscore');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan clustered clients', function() {

  // Since Jasmine 1.3 does not have beforeAll callback, execute
  // any cleanup as first test so that it only gets executed once.
  it('cleanup', function(done) {
    var stop2 = t.stopClusterNode('server-failover-two', false);
    var stop3 = t.stopClusterNode('server-failover-three', false);
    Promise.all([stop2(), stop3()]).catch(t.failed(done)).finally(done);
  });

  it('can failover when nodes crash', function(done) {
    t.client(t.failover1)
      .then(t.assert(t.getMembers(), t.toContain([t.failover1])))
      .then(withAll(t.startAndWaitView('server-failover-two', 2)))
      .then(expectClientView([t.failover1, t.failover2]))
      .then(withAll(t.startAndWaitView('server-failover-three', 3)))
      .then(expectClientView([t.failover1, t.failover2, t.failover3]))
      .then(keyGen([t.failover2, t.failover3]))
      .then(withAll(keyPut('failover-value')))
      .then(withAll(keyGet(t.toBe('failover-value'))))
      .then(withFirst(t.stopAndWaitView('server-failover-three', 2, 'server-failover-one')))
      .then(withFirst(expectClientView([t.failover1, t.failover2])))
      .then(withAll(keyGet(t.toBe('failover-value'))))
      .then(withFirst(t.stopAndWaitView('server-failover-two', 1, 'server-failover-one')))
      .then(withFirst(expectClientView([t.failover1])))
      .then(withAll(keyGet(t.toBe('failover-value'))))
      .then(withFirst(t.disconnect()))
      .catch(t.failed(done)).finally(done);
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
