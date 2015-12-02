# Requirements

Currently the Infinispan Javascript client can only talk to Infinispan Server 
8.1.x or higher versions. 

# Usage

Please find below some sample code on how Infinispan Javascript client can be used:

```JavaScript
var infinispan = require('infinispan');

// client() method returns a Promise that represents completion successful connection
var connected = infinispan.client(11222, '127.0.0.1');
connected.then(function(client) {
  console.log("Connected");
  var putGet = client.put('key', 'value').then(function() {
    return client.get('key').then(function(value) {
      console.log(':get(`key`) = ' + value);
    })
  });

  var conditional = putGet.then(function() {
    var p0 = client.putIfAbsent('cond', 'v0').then(function(success) {
      console.log(':putIfAbsent() success = ' + success);
    });
    var p1 = p0.then(function() {
      return client.replace('cond', 'v1').then(function (success) {
        console.log(':replace() success = ' + success);
      })
    });
    var p2 = p1.then(function() {
      return client.getVersioned('cond').then(function (versioned) {
        console.log(':getVersioned() = ' + versioned.value);
        return client.replaceWithVersion('cond', 'v2', versioned.version, {previous: true}).then(function (prev) {
          console.log(':replaceWithVersion previous = ' + prev)
        })
      });
    });
    return p2.then(function() {
      return client.get('cond').then(function(value) {
        console.log(":get(`cond`) = " + value);
      })
    });
  });

  var multi = conditional.then(function() {
    var data = [
      {key: 'multi1', value: 'v1'},
      {key: 'multi2', value: 'v2'},
      {key: 'multi3', value: 'v3'}];
    return client.putAll(data).then(function() {
      var keys = ['multi2', 'multi3'];
      return client.getAll(keys).then(function(entries) {
        console.log("Entries are: " + JSON.stringify(entries));
      });
    })
  });

  return multi.then(function() { return client.clear() }).finally(function() {
    // Regardless of the result, disconnect client
    return client.disconnect().then(function() { console.log("Disconnected") });
  });
}).catch(function(error) {
  console.log("Got error: " + error.message);
});
```

# Testing

To run tests continuously:

    ./node_modules/.bin/jasmine-node spec --autotest --watch lib

# Debugging

To debug tests with IDE:

    node --debug-brk node_modules/jasmine-node/lib/jasmine-node/cli.js spec/codec_spec.js

Or:

    node --debug-brk node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js

And then start a remote Node.js debugger from IDE on port 5858.
