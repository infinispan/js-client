var f = require("../lib/functional");
var ispn = require("../lib/infinispan");
var Promise = require('promise');

describe("Infinispan client", function() {
  var client = ispn.client(11222, "127.0.0.1");

  beforeEach(function() {
    client.then(assert(clear()));
  });

  var invalidVersion = function() {
    return new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
  };

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
    .then(assert(replaceWithVersion("cond", "v1", "v2"), toBeTruthy))
    .then(assert(get("cond"), toBe("v2")))
    .then(assert(replaceWithVersion("other"), toBeFalsy))
    .then(assert(replaceWithVersion("cond", "v2", "v3", invalidVersion()), toBeFalsy))
    .then(assert(get("cond"), toBe("v2")))
    .then(assert(removeWithVersion("other"), toBeFalsy))
    .then(assert(removeWithVersion("cond", "v2", invalidVersion()), toBeFalsy))
    .then(assert(get("cond"), toBe("v2")))
    .then(assert(removeWithVersion("cond", "v2"), toBeTruthy))
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

function replaceWithVersion(k, old, v, version) {
  return function(client) {
    return client.getVersioned(k).then(function(versioned) {
      if (f.existy(old) && f.existy(v)) {
        expect(versioned.value).toBe(old);
        expect(versioned.version).toBeDefined();
        if (f.existy(version)) // Optional method call provided version
          return client.replaceWithVersion(k, v, version);

        return client.replaceWithVersion(k, v, versioned.version);
      } else {
        expect(versioned).toBeUndefined();
      }
    });
  }
}

function removeWithVersion(k, old, version) {
  return function(client) {
    return client.getVersioned(k).then(function(versioned) {
      if (f.existy(old)) {
        expect(versioned.value).toBe(old);
        expect(versioned.version).toBeDefined();
        if (f.existy(version)) // Optional method call provided version
          return client.removeWithVersion(k, version);

        return client.removeWithVersion(k, versioned.version);
      } else {
        expect(versioned).toBeUndefined();
      }
    });
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
