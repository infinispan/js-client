//var f = require("../lib/functional");
var ispn = require("../lib/infinispan");
var Promise = require('promise');

var success = function() {
  console.log("Success!")
};
var failed = function(error) {
  console.log("Error is: " + error);
  //fail(error);
  expect(error).toBeUndefined();
};

describe("Infinispan client", function() {
  it("can ping server", function(done) {
    ispn.client(11222, "127.0.0.1").then(function(client) {
        ispn.ping(client).then(success)
      })
    .catch(failed)
    .finally(done);

    //var p1 = new Promise(function(resolve, reject) {
    //  resolve("Success");
    //});
    //
    //p1.then(function(value) {
    //  console.log(value); // "Success!"
    //  throw "oh, no!";
    //}).catch(function(e) {
    //  console.log(e); // "oh, no!"
    //}).finally(done);

    //var p0 = ispn.client(11222, "127.0.0.1");
    //p0.then(function(value) {
    //  console.log(value); // "Success!"
    //  throw "oh, no!";
    //}).catch(function(e) {
    //  console.log(e); // "oh, no!"
    //}).finally(function() {
    //  console.log("Completed");
    //});


    //ispn.client(11222, "127.0.0.1")
    //    .then(
    //      function(client) {
    //        expect("Boo").toBeUndefined();
    //        ispn.ping(client).then(emptySuccess).catch(failTest);
    //      })
    //    .catch(failTest)
    //    .finally(done);

    //console.log(ispn.contain(39));
    //var connected = ispn.client(39);
    //connected.then(function(client) {
    //  console.log("Promise: Connected");
    //  return client;
    //}, function(error) {
    //  console.log("Promise: Error " + error);
    //}).then(function(client) {
    //  var pinged = ispn.ping(client);
    //  pinged.then(function() {
    //    console.log("Promise: Pinged!");
    //  })
    //});

    //console.log(contained);
    //console.log(client);
    //console.log(client.ping());
    //console.log(Infinispan.ping(client));
    //var client = new Infinispan.InfinispanClient('127.0.0.1');
    //client.connect().then(function() {
    //  console.log("Connected");
    //}, function(error) {
    //  console.log("Error connecting: " + error);
    //})
    //var client = new Client('127.0.0.1');
    //client.connect().then(console.log('Connected'));
    //client.start();
    //client.ping();
    //expect(true).toBe(true);
  });
});

//describe("A suite", function() {
//  it("contains spec with an expectation", function() {
//    expect(true).toBe(true);
//  });
//});