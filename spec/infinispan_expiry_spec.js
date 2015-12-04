var _ = require('underscore');
var f = require('../lib/functional');
var Promise = require('promise');

var t = require('./utils/testing'); // Testing dependency

describe('Infinispan local client working with expiry operations', function() {
  var client = t.client();

  //it('can validate incorrect duration definitions', function(done) { client
  //  .then(assertError(t.put('_', '_', {lifespan: '1z'}), toContain('Unknown duration unit')))
  //  .then(assertError(t.putIfAbsent('_', '_', {lifespan: 'aa'}), toContain('Unknown duration format')))
  //  .then(assertError(t.replace('_', '_', {lifespan: 1}), toContain('Positive duration provided without time unit')))
  //  .catch(failed(done))
  //  .finally(done);
  //});

  it('removes keys when their lifespan has expired', function(done) { client
    .then(t.assert(t.put('expiry', 'value', {lifespan: '100ms'})))
    .then(t.assert(t.containsKey('expiry'), toBeTruthy))
    .then(waitToExpire('expiry'))
    //.then(t.assert(t.putIfAbsent('expiryIfAbsent', 'value', {lifespan: '1000000μs'})))
    //.then(t.assert(t.containsKey('expiryIfAbsent'), toBeTruthy))
    //.then(waitToExpire('expiryIfAbsent'))
    .catch(failed(done))
    .finally(done);
  });

});


function sleepFor(sleepDuration){
  var now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
}

function waitToExpire(key) {
  return function(client) {
    var contains = true;
    waitsFor(function() {
      client.containsKey(key).done(function(success) {
        contains = success;
      });

      return !contains;
    }, '`' + key + '` key should be expired', 150);

    return client;
    //sleepFor(2000);
    //return client.containsKey(key).done(function(success) {
    //  console.log("containsKey? " + success);
    //});

    //return waitsFor(function() {
    //  var contains = true;
    //  console.log('Call containsKey: ' + key);
    //  client.containsKey(key)
    //    //.then(function(success) {
    //    //  console.log('containsKey is: ' + contains);
    //    //  contains = success;
    //    //})
    //    .done(function(success) {
    //      console.log('containsKey is: ' + contains);
    //      contains = success;
    //    }); // wait for contains to return
    //  console.log('Wait finished');
    //  console.log('Contains? ' + contains);
    //  return !contains;
    //}, '`' + key + '` key should be expired', 2000)
  }
}

function assertError(fun, expectErrorFun) {
  return function(client) {
    var failed = false;
    try {
      fun(client);
    } catch(error) {
      failed = true;
      expectErrorFun(error.message);
    }

    if (!failed)
      throw new Error('Expected function to fail');

    return client;
  }
}

// DUP
function toBe(value) {
  return function(actual) {
    expect(actual).toBe(value);
  }
}

function toContain(value) {
  return function(actual) {
    expect(actual).toContain(value);
  }
}

function toBeTruthy(actual) {
  expect(actual).toBeTruthy();
}

function toBeFalsy(actual) {
  expect(actual).toBeFalsy();
}

// DUP
var failed = function(done) {
  return function(error) {
    done(error);
  };
};


