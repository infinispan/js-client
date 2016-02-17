# Infinispan JS Client

`infinispan` is an asynchronous event-driven Infinispan client for Node.js.
The results of the asynchronous operations are represented using 
[Promise](https://www.promisejs.org) instances. Amongst many advantages,
promises make it easy to transform/chain multiple asynchronous invocations
and they improve error handling by making it easy to centralise it.

The client is under heavy development but here's a summary of its 
current capabilities:

* `infinispan` client can be constructed with a single server address or 
multiple servers addresses. When passing multiple addresses, it will iterate
until it finds a server to which it can connect to.
* Clients can interact with a named cache whose name is passed on client 
construction via `{cacheName: 'myCache'}` option. In the absence of any cache 
name options, the client will interact with the default cache. 
* Full CRUD operation support, e.g. `put`, `get`, `remove`, `containsKey`...etc.
* Compare-And-Swap operation support, e.g. `putIfAbsent`, 
`getWithVersion`/`getWithMetadata`, `replace`, `replaceWithVersion`, 
`removeWithVersion`..etc.
* Expiration with absolute lifespan or relative maximum idle time
is supported. This expiration parameters as passed as optional parameters
to create/update methods and they support multiple time units, e.g. 
`{lifespan: '1m', maxIdle: '1d'}`.
* Update and remove operations can optionally return previous values 
by passing in `{previous: true}` option.
* Bulk store/retrieve/delete operations are supported, e.g. `putAll`, `getAll`, 
`getBulk`, `getBulkKeys`, `clear`...etc.
* Cache contents can be iterated over using the `iterator` method.
* Cache size can be determined using the `size` method.
* Remote cache listeners can be plugged using the `addListener` method, which
takes the event type (`create`, `modify`, `remove` or `expiry`) and the 
function callback as parameter.
* Finally, clients can stop communication with the server(s) using the 
`disconnect` method.

# Requirements

`infinispan` client requires Node.js version `0.10` or higher.

It can only talk to Infinispan Server 8.x or higher versions. 

By default, Infinispan clients talk Hot Rod protocol version `2.5` which is 
supported starting with Infinispan 8.2.x. 

To talk to Infinispan Server versions 8.0.x or 8.1.x, `infinispan` should be
instructed to use Hot Rod protocol version `2.2`. To do so, `infinispan` must 
be constructed with `{version: '2.2'}` optional argument.

# Usage

Please find below some sample code on how Infinispan Javascript client can be used:

```JavaScript
var infinispan = require('infinispan');

// client() method returns a Promise that represents completion successful connection
var connected = infinispan.client({port: 11222, host: '127.0.0.1'});
connected.then(function(client) {
  console.log("Connected");
  var putGetRemove = client.put('key', 'value').then(function() {
    var p0 = client.get('key').then(function(value) {
      console.log(':get(`key`) = ' + value);
    });
    return p0.then(function() {
      return client.remove('key').then(function(success) {
        console.log(':remove(`key`) = ' + success);
      })
    });
  });

  var conditional = putGetRemove.then(function() {
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
    var p3 = p2.then(function() {
      return client.get('cond').then(function(value) {
        console.log(':get(`cond`) = ' + value);
      })
      });
    return p3.then(function() {
      return client.getVersioned('cond').then(function (versioned) {
        console.log(':getVersioned() = ' + versioned.value);
        return client.removeWithVersion('cond', versioned.version).then(function (success) {
          console.log(':removeWithVersion = ' + success);
        })
      });
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
        console.log('Entries are: ' + JSON.stringify(entries));
      });
    })
  });

  var iterated = multi.then(function() {
    return client.iterator(1).then(function(it) {
      // Simple recursive loop over iterator next() call
      function loop(promise, fn) {
        return promise.then(fn).then(function (entry) {
          return !entry.done ? loop(it.next(), fn) : entry.value;
        });
      }

      return loop(it.next(), function (entry) {
        console.log(':iterator.next = ' + JSON.stringify(entry));
        return entry;
      });
    })
  });

  var expiry = iterated.then(function() {
    return client.put('expiry', 'value', {lifespan: '1s'}).then(function() {
      return client.containsKey('expiry').then(function(found) {
        console.log(':before expiration -> containsKey(`expiry`) = ' + found);
      }).then(function() {
        return client.size().then(function(size) {
          console.log(':before expiration -> size = ' + size);
        })
      })
    });
  });

  var expired = expiry.then(function() {
    sleepFor(1100); // sleep to force expiration
    return client.containsKey('expiry').then(function(found) {
      console.log(':after expiration -> containsKey(`expiry`) = ' + found);
    }).then(function() {
      return client.size().then(function(size) {
        console.log(':after expiration -> size = ' + size);
      })
    })
  });

  var withMeta = expired.then(function() {
    return client.put('meta', 'v0', {maxIdle: '1h'}).then(function() {
      return client.getWithMetadata('meta').then(function(valueWithMeta) {
        console.log(':getWithMetadata `meta` = ' + JSON.stringify(valueWithMeta));
      })
    })
  });

  var withNamedCache = withMeta.then(function() {
    var connected = infinispan.client(
            // Accepts multiple addresses and fails over if connection not possible
            [{port: 99999, host: '127.0.0.1'}, {port: 11222, host: '127.0.0.1'}],
            {cacheName: 'namedCache'});

    return connected.then(function(namedCache) {
      console.log('Connected to cache `namedCache`');
      var addListeners = namedCache.addListener('create', function(key) {
        console.log('event -> created `' + key + '` key');
      }).then(function(listenerId) {
        // Multiple callbacks can be associated with a single client-side listener.
        // This is achieved by registering listeners with the same listener id
        // as shown in the example below.
        var onModify = namedCache.addListener('modify', function(key) {
          console.log('event -> modified `' + key + '` key');
        }, {listenerId: listenerId});
        return onModify.then(function () {
            return namedCache.addListener('remove', function (key) {
              console.log('event -> removed `' + key + '` key');
            }, {listenerId: listenerId});
          });
      });

      var crud = addListeners.then(function(listenerId) {
        var create = namedCache.putIfAbsent('named1', 'v0');
        var modify = create.then(function() {
          return namedCache.replace('named1', 'v1');
        });
        var remove = modify.then(function() {
          return namedCache.remove('named1');
        });
        return remove.then(function() {
          return namedCache.removeListener(listenerId);
        });
      });

      return crud.finally(function() {
        // Regardless of the result, disconnect client
        return namedCache.disconnect();
      });
    })
  });

  return withNamedCache.then(function() { return client.clear(); }).finally(function() {
    // Regardless of the result, disconnect client
    return client.disconnect().then(function() { console.log("Disconnected") });
  });
}).catch(function(error) {
  console.log("Got error: " + error.message);
});

function sleepFor(sleepDuration){
  var now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
}
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
