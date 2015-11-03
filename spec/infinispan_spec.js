var ispn = require("../lib/infinispan");
var Promise = require('promise');

describe("Infinispan client", function() {
  it("can put -> get -> remove a key/value pair", function(done) {
    ispn.client(11222, "127.0.0.1")
      .then(assertGetNotFound("key"))
      .then(assertRemoveNotFound("key"))
      .then(assertPut("key", "value"))
      .then(assertGetFound("key", "value"))
      .then(assertRemoveFound("key"))
      .then(assertGetNotFound("key"))
      .then(assertRemoveNotFound("key"))
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

function assertPut(k, v) {
  return function(client) {
    console.log("About to call put: " + client);
    return client.put(k, v).then(function() {
      console.log("Put returned");
      return client;
    });
    //client.put(k, v).then(success, failed);
    //return client
  }
}

function assertGetFound(k, v) {
  return function(client) {
    console.log("About to call get: " + client);
    return client.get(k).then(function(value) {
      expect(value).toBe(v);
      return client;
    });
  }
}

function assertGetNotFound(k) {
  return function(client) {
    console.log("About to call get: " + client);
    return client.get(k).then(function(value) {
      expect(value).toBeUndefined();
      return client;
    });
  }
}

function assertRemoveFound(k) {
  return function(client) {
    console.log("About to call remove: " + client);
    return client.remove(k).then(function(removed) {
      console.log("Remove returned: " + removed);
      expect(removed).toBeTruthy();
      return client;
    });
    //client.put(k, v).then(success, failed);
    //return client
  }
}

function assertRemoveNotFound(k) {
  return function(client) {
    console.log("About to call remove: " + client);
    return client.remove(k).then(function(removed) {
      console.log("Remove returned: " + removed);
      expect(removed).toBeFalsy();
      return client;
    });
    //client.put(k, v).then(success, failed);
    //return client
  }
}

var failed = function(done) {
  return function(error) {
    done(error);
  };
};

//var failed = function(error) {
//  console.log(error);
//  throw new Error(error);
//  //expect(error.message).toBeUndefined();
//};