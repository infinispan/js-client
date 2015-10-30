var ispn = require("../lib/infinispan");
var Promise = require('promise');

describe("Infinispan client", function() {
  it("can put/replace/remove a key/value pair", function(done) {
    ispn.client(11222, "127.0.0.1")
      .then(assertPut("key", "value"))
      .then(assertGet("key", "value"))
      .catch(failed)
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

function assertPut(k, v) {
  return function(client) {
    client.put(k, v).then(success);
    return client
  }
}
function assertGet(k, v) {
  return function(client) {
    client.get(k).then(function(value) {
      expect(value).toBe(v);
    });
    return client
  }
}

var success = function() {};
var failed = function(error) {
  expect(error.message).toBeUndefined();
};