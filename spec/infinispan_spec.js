//var f = require("../lib/functional");
var ispn = require("../lib/infinispan");
var Promise = require('promise');

describe("Infinispan client", function() {
  it("can put/replace/remove a key/value pair", function(done) {
    ispn.client(11222, "127.0.0.1")
        .then(assertPut)
        .then(assertGet)


    //ispn.client(11222, "127.0.0.1").then(function(client) {
    //  client.put("key", "value")
    //      .then(success)
    //      .then(function() {
    //        client.get("key").then(function(value) {
    //          console.log("Get completed");
    //          expect(value).toBe("value");
    //        })
    //       })

      //function () {
      //  console.log("Put completed");
      //      .catch(failed)
      //})
      //    .catch(failed);

        //client.put("key", "value").then(function () {
        //  console.log("Put completed");
        //  client.get("key").then(function(value) {
        //    console.log("Get completed");
        //    expect(value).toBe("value");
        //  })
        //  .catch(failed)
        //})
        //.catch(failed)
    //})
    .catch(failed)
    .finally(done);
  });
  //it("can ping server", function(done) {
  //  ispn.client(11222, "127.0.0.1").then(function(client) {
  //      //client.ping().then(success)
  //      ispn.ping(client).then(success)
  //    })
  //  .catch(failed)
  //  .finally(done);
  //});
});

function assertPut(client) {
  client.put("key", "value").then(success);
  return client
}

function assertGet(client) {
  client.get("key").then(function(value) {
    expect(value).toBe("value");
  });
  return client
}

var success = function() {};
var failed = function(error) {
  expect(error.message).toBeUndefined();
};