var _ = require('underscore');
var infinispan = require('../lib/infinispan');

var heapdump = require('heapdump');

var connected = infinispan.client({port: 11222, host: '127.0.0.1'},{cacheName: 'namedCache'});
console.log("Connected to JDG server");
connected.then(function (client) {
  var key = "memory-one-get";
  var put = client.put(key, "test");

  var afterPut = put.then(function() {
    //console.log("After put, heapUsed: "+process.memoryUsage().heapUsed);

    heapdump.writeSnapshot('/tmp/' + Date.now() + '.heapsnapshot');
  });

  var get1 = afterPut.then(function test_get1() {
    return client.get(key);
  });

  var logGet1 = get1.then(function test_log_get1(value) {
    console.log("[get1] value: " + value);
  });

  var dumpAfterGet1 = logGet1.then(function test_dump_after_get1() {
    global.gc();
    //console.log("After get1, heapUsed: "+process.memoryUsage().heapUsed);

    heapdump.writeSnapshot('/tmp/' + Date.now() + '.heapsnapshot');
  });

  var get2 = dumpAfterGet1.then(function test_get2() {
    return client.get(key);
  });

  var logGet2 = get2.then(function test_log_get2(value) {
    console.log("[get2] value: " + value);
  });

  var dumpAfterGet2 = logGet2.then(function test_dump_after_get2() {
    global.gc();
    //console.log("After get2, heapUsed: "+process.memoryUsage().heapUsed);

    heapdump.writeSnapshot('/tmp/' + Date.now() + '.heapsnapshot');
  });

  return dumpAfterGet2.then(function test_disconnect() {
    return client.disconnect();
  });

}).catch(function(err) {
  console.log("connect error", err);
});
