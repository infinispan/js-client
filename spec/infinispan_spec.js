var f = require("../lib/functional");
var ispn = require("../lib/infinispan");
var Promise = require('promise');

describe("Infinispan client", function() {
  it("can put -> get -> remove a key/value pair", function(done) {
    ispn.client(11222, "127.0.0.1")
      .then(assert(put("key", "value")))
      .then(assert(get("key"), toBe("value")))
      .then(assert(remove("key"), toBeTruthy))
      .then(assert(get("key"), toBeUndefined))
      .then(assert(remove("key"), toBeFalsy))
      .catch(failed(done))
      .finally(done);
  });
  it("can use conditional operations on a key/value pair", function(done) {
    ispn.client(11222, "127.0.0.1")
      .then(assert(putIfAbsent("cond", "v0"), toBeTruthy))
      .then(assert(putIfAbsent("cond", "v1"), toBeFalsy))
      .then(assert(get("cond"), toBe("v0")))
      //.then(assertGetFound("key", "value"))
      //.then(assertRemoveFound("key"))
      //.then(assertGetNotFound("key"))
      //.then(assertRemoveNotFound("key"))
      .catch(failed(done))
      .finally(done);
  });
  //it("can ping server", function(done) {
  //  ispn.client(11222, "127.0.0.1").then(function(client) {
  //      client.ping().then(success);
  //    })
  //  .catch(failed)
  //  .finally(done);
  //});
});

function put(k, v) {
  return function(client) {
    return client.put(k, v);
  }
}

function get(k) {
  return function(client) {
    return client.get(k);
  }
}

function remove(k) {
  return function(client) {
    return client.remove(k);
  }
}

function putIfAbsent(k, v) {
  return function(client) {
    return client.putIfAbsent(k, v);
  }
}

function toBe(value) {
  return function(expect) {
    expect.toBe(value);
  }
}

function toBeUndefined(expect) {
  expect.toBeUndefined();
}

function toBeTruthy(expect) {
  expect.toBeTruthy();
}

function toBeFalsy(expect) {
  expect.toBeFalsy();
}

function assert(fun, expectFun) {
  if (f.existy(expectFun)) {
    return function(client) {
      return fun(client).then(function(value) {
        expectFun(expect(value));
        return client;
      });
    }
  } else {
    return function(client) {
      return fun(client).then(function() {
        return client;
      });
    }
  }
}

var failed = function(done) {
  return function(error) {
    done(error);
  };
};
