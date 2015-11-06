var f = require("../lib/functional");
var ispn = require("../lib/infinispan");
var Promise = require('promise');

describe("Infinispan client", function() {
  var client = ispn.client(11222, "127.0.0.1");

  beforeEach(function() {
    client.then(assert(clear()));
  });

  it("can put -> get -> remove a key/value pair", function(done) { client
    .then(assert(put("key", "value")))
    .then(assert(get("key"), toBe("value")))
    .then(assert(remove("key"), toBeTruthy))
    .then(assert(get("key"), toBeUndefined))
    .then(assert(remove("key"), toBeFalsy))
    .catch(failed(done))
    .finally(done);
  });
  it("can use conditional operations on a key/value pair", function(done) { client
    .then(assert(putIfAbsent("cond", "v0"), toBeTruthy))
    .then(assert(putIfAbsent("cond", "v1"), toBeFalsy))
    .then(assert(get("cond"), toBe("v0")))
    .then(assert(replace("cond", "v1"), toBeTruthy))
    .then(assert(get("cond"), toBe("v1")))
    .then(assert(conditional(replaceWithVersion, "cond", "v1", "v2"), toBeTruthy))
    .then(assert(get("cond"), toBe("v2")))
    .then(assert(notReplaceWithVersion("other"), toBeFalsy)) // key not found
    .then(assert(notReplaceWithVersion("cond"), toBeFalsy)) // key found but invalid version
    .then(assert(get("cond"), toBe("v2")))
    .then(assert(notRemoveWithVersion("other"), toBeFalsy))
    .then(assert(notRemoveWithVersion("cond"), toBeFalsy))
    .then(assert(get("cond"), toBe("v2")))
    .then(assert(conditional(removeWithVersion, "cond", "v2"), toBeTruthy))
    .then(assert(get("cond"), toBeUndefined))
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

function replace(k, v) {
  return function(client) {
    return client.replace(k, v);
  }
}

function clear() {
  return function(client) {
    return client.clear();
  }
}

function conditional(writeFun, k, old, v) {
  return function(client) {
    return client.getVersioned(k).then(function(versioned) {
      expect(versioned.value).toBe(old);
      expect(versioned.version).toBeDefined();
      return writeFun(client, k, versioned.version, v);
    });
  }
}

var invalidVersion = function() {
  return new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
};

function replaceWithVersion(client, k, version, v) {
  return client.replace(k, v, version);
}

function notReplaceWithVersion(k) {
  return function(client) {
    return client.replace(k, "ignore", invalidVersion());
  }
}

function removeWithVersion(client, k, version) {
  return client.remove(k, version);
}

function notRemoveWithVersion(k) {
  return function(client) {
    return client.remove(k, invalidVersion());
  }
}

function toBe(value) {
  return function(actual) {
    expect(actual).toBe(value);
  }
}

function toBeUndefined(actual) {
  expect(actual).toBeUndefined();
}

function toBeTruthy(actual) {
  expect(actual).toBeTruthy();
}

function toBeFalsy(actual) {
  expect(actual).toBeFalsy();
}

function assert(fun, expectFun) {
  if (f.existy(expectFun)) {
    return function(client) {
      return fun(client).then(function(value) {
        expectFun(value);
        return client;
      });
    }
  }
  return function(client) {
    return fun(client).then(function() {
      return client;
    });
  }
}

var failed = function(done) {
  return function(error) {
    done(error);
  };
};
