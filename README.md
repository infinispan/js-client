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
`getWithMetadata`, `replace`, `replaceWithVersion`, 
`removeWithVersion`..etc.
* Expiration with absolute lifespan or relative maximum idle time
is supported. This expiration parameters as passed as optional parameters
to create/update methods and they support multiple time units, e.g. 
`{lifespan: '1m', maxIdle: '1d'}`.
* Update and remove operations can optionally return previous values 
by passing in `{previous: true}` option.
* Bulk store/retrieve/delete operations are supported, e.g. `putAll`, `getAll`, 
`clear`...etc.
* Cache contents can be iterated over using the `iterator` method.
* Cache size can be determined using the `size` method.
* Remote cache listeners can be plugged using the `addListener` method, which
takes the event type (`create`, `modify`, `remove` or `expiry`) and the 
function callback as parameter.
* Clients can store scripts using `addScript` and then they can be remotely
executed using the `execute` operation. Executing a script remotely 
optionally takes per-invocation parameters.
* Server-side statistics can be retrieved using the `stats` operation.
* Clients can talk to clusters of Infinispan Server instances, using 
Consistent-Hash based algorithms to route key-based operations.
* Multi-key or key-less operations are routed in round-robin fashion.
* Clients only need to be configure with a single node's address and from 
that node the rest of the cluster topology can be discovered. As nodes are 
added or destroyed, clients get notified of changes in the cluster topology
dynamically.
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

Before executing these code samples, Infinispan Server must be downloaded 
from [here](http://infinispan.org/download/) and installed locally bearing 
in the support version information provided above. Unless indicated 
otherwise, the code samples below require an Infinispan Server instance 
to be started. The simplest way to do so is to execute the following script:
 
    $ [INFINISPAN_SERVER_HOME]/bin/standalone.sh

Please find below samples codes showing how the Infinispan Javascript client 
can be used:

## Working with single entries and statistics

```Javascript
var infinispan = require('infinispan');

var connected = infinispan.client({port: 11222, host: '127.0.0.1'});

connected.then(function (client) {

  var clientPut = client.put('key', 'value');

  var clientGet = clientPut.then(
      function() { return client.get('key'); });

  var showGet = clientGet.then(
      function(value) { console.log('get(key)=' + value); });

  var clientRemove = showGet.then(
      function() { return client.remove('key'); });

  var showRemove = clientRemove.then(
      function(success) { console.log('remove(key)=' + success); });

  var clientStats = showRemove.then(
    function() { return client.stats(); });

  var showStats = clientStats.then(
    function(stats) {
      console.log('Number of stores: ' + stats.stores);
      console.log('Number of cache hits: ' + stats.hits);
      console.log('All stats: ' + JSON.stringify(stats, null, " "));
    });

  return showStats.finally(
      function() { return client.disconnect(); });

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Using conditional operations

```Javascript
var infinispan = require('infinispan');

var connected = infinispan.client({port: 11222, host: '127.0.0.1'});

connected.then(function (client) {

  var clientPut = client.putIfAbsent('cond', 'v0');

  var showPut = clientPut.then(
      function(success) { console.log(':putIfAbsent(cond)=' + success); });

  var clientReplace = showPut.then(
      function() { return client.replace('cond', 'v1'); } );

  var showReplace = clientReplace.then(
      function(success) { console.log('replace(cond)=' + success); });

  var clientGetMetaForReplace = showReplace.then(
      function() { return client.getWithMetadata('cond'); });

  var clientReplaceWithVersion = clientGetMetaForReplace.then(
      function(entry) {
        console.log('getWithMetadata(cond)=' + JSON.stringify(entry));
        return client.replaceWithVersion('cond', 'v2', entry.version);
      }
  );

  var showReplaceWithVersion = clientReplaceWithVersion.then(
      function(success) { console.log('replaceWithVersion(cond)=' + success); });

  var clientGetMetaForRemove = showReplaceWithVersion.then(
      function() { return client.getWithMetadata('cond'); });

  var clientRemoveWithVersion = clientGetMetaForRemove.then(
      function(entry) {
        console.log('getWithMetadata(cond)=' + JSON.stringify(entry));
        return client.removeWithVersion('cond', entry.version);
      }
  );

  var showRemoveWithVersion = clientRemoveWithVersion.then(
      function(success) { console.log('removeWithVersion(cond)=' + success)});

  return showRemoveWithVersion.finally(
      function() { return client.disconnect(); });

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Working with multiple entries

```Javascript
var infinispan = require('infinispan');

var connected = infinispan.client({port: 11222, host: '127.0.0.1'});

connected.then(function (client) {
  var data = [
    {key: 'multi1', value: 'v1'},
    {key: 'multi2', value: 'v2'},
    {key: 'multi3', value: 'v3'}];

  var clientPutAll = client.putAll(data);

  var clientGetAll = clientPutAll.then(
    function() { return client.getAll(['multi2', 'multi3']); });

  var showGetAll = clientGetAll.then(
    function(entries) {
      console.log('getAll(multi2, multi3)=%s', JSON.stringify(entries));
    }
  );

  var clientIterator = showGetAll.then(
    function() { return client.iterator(1); });

  var showIterated = clientIterator.then(
    function(it) {
      function loop(promise, fn) {
        // Simple recursive loop over iterator's next() call
        return promise.then(fn).then(function (entry) {
          return !entry.done ? loop(it.next(), fn) : entry.value;
        });
      }

      return loop(it.next(), function (entry) {
        console.log('iterator.next()=' + JSON.stringify(entry));
        return entry;
      });
    }
  );

  var clientClear = showIterated.then(
    function() { return client.clear(); });

  return clientClear.finally(
    function() { return client.disconnect(); });

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Working with ephemeral data

```Javascript
var infinispan = require('infinispan');
var Promise = require('promise');

var connected = infinispan.client({port: 11222, host: '127.0.0.1'});

connected.then(function (client) {

  var clientPutExpiry = client.put('expiry', 'value', {lifespan: '1s'});

  var clientGetMetaAndSize = clientPutExpiry.then(
    function() {
      // Compute getWithMetadata and size in parallel
      return Promise.all([client.getWithMetadata('expiry'), client.size()]);
    });

  var showGetMetaAndSize = clientGetMetaAndSize.then(
    function(values) {
      console.log('before expiration:');
      console.log('getWithMetadata(expiry)=' + JSON.stringify(values[0]));
      console.log('size=' + values[1]);
    });

  var clientContainsAndSize = showGetMetaAndSize.then(
    function() {
      sleepFor(1100); // Sleep to force expiration
      return Promise.all([client.containsKey('expiry'), client.size()]);
    });

  var showContainsAndSize = clientContainsAndSize.then(
    function(values) {
      console.log('after expiration:');
      console.log('containsKey(expiry)=' + values[0]);
      console.log('size=' + values[1]);
    });

  return showContainsAndSize.finally(
    function() { return client.disconnect(); });

}).catch(function(error) {

  console.log("Got error: " + error.message);

});

function sleepFor(sleepDuration){
  var now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
}
```

## Interact with named caches

```Javascript
var infinispan = require('infinispan');

var connected = infinispan.client(
  {port: 11222, host: '127.0.0.1'}, {cacheName: 'namedCache'});

connected.then(function (client) {

  console.log('Connected to `namedCache`');

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Connect failover

The client can be configured with multiple server addresses and it will loop
through them until it finds a node to which it can be connected, as shown
in this example:

```Javascript
var infinispan = require('infinispan');

// Accepts multiple addresses and fails over if connection not possible
var connected = infinispan.client(
  [{port: 99999, host: '127.0.0.1'}, {port: 11222, host: '127.0.0.1'}]);

connected.then(function (client) {

  var members = client.getTopologyInfo().getMembers();

  console.log('Connected to: ' + JSON.stringify(members));

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Remote events

```Javascript
var infinispan = require('infinispan');
var Promise = require('promise');

var connected = infinispan.client({port: 11222, host: '127.0.0.1'});

connected.then(function (client) {

  var clientAddListenerCreate = client.addListener(
    'create', function(key) { console.log('[Event] Created key: ' + key); });

  var clientAddListeners = clientAddListenerCreate.then(
    function(listenerId) {
      // Multiple callbacks can be associated with a single client-side listener.
      // This is achieved by registering listeners with the same listener id
      // as shown in the example below.
      var clientAddListenerModify = client.addListener(
        'modify', function(key) { console.log('[Event] Modified key: ' + key); },
        {listenerId: listenerId});

      var clientAddListenerRemove = client.addListener(
        'remove', function(key) { console.log('[Event] Removed key: ' + key); },
        {listenerId: listenerId});

      return Promise.all([clientAddListenerModify, clientAddListenerRemove]);
    });

  var clientCreate = clientAddListeners.then(
    function() { return client.putIfAbsent('eventful', 'v0'); });

  var clientModify = clientCreate.then(
    function() { return client.replace('eventful', 'v1'); });

  var clientRemove = clientModify.then(
    function() { return client.remove('eventful'); });

  var clientRemoveListener =
        Promise.all([clientAddListenerCreate, clientRemove]).then(
          function(values) {
            var listenerId = values[0];
            return client.removeListener(listenerId);
          });

  return clientRemoveListener.finally(
    function() { return client.disconnect(); });

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Script Execution

The client has the ability to remotely execute scripts on the server. 
To do so, it must first load the script in the server and then invoke it.
So, given the following script called `sample-script.js`: 

```Javascript
// mode=local,language=javascript,parameters=[k, v],datatype='text/plain; charset=utf-8'
cache.put(k, v);
cache.get(k);
```

The Infinispan Javascript client could load and execute it using the 
following code:

```Javascript
var infinispan = require('infinispan');
var Promise = require('promise');
var readFile = Promise.denodeify(require('fs').readFile);

var connected = infinispan.client({port: 11222, host: '127.0.0.1'});

connected.then(function (client) {

  var addScriptFile = readFile('sample-script.js').then(
    function(file) {
      return client.addScript('sample-script', file.toString());
    });

  var clientExecute = addScriptFile.then(
    function() {
      return client.execute('sample-script', {k: 'exec-key', v: 'exec-value'});
    });

  var showExecute = clientExecute.then(
    function(ret) { console.log('Script execution returned: ' + ret); });

  return showExecute.finally(
    function() { return client.disconnect(); });

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Working with Clusters

All previous examples are focused on how the API behaves when working with a 
single Infinispan Server instance. Additionally, multiple Infinispan Servers
can be clustered in order to provide failover for the data and scale up.
Working with a Infinispan Server cluster is very similar to working with a 
single instance but there's a few things to bear in mind:

* No matter the size of the Infinispan Server cluster, the client only needs
to know about a server's address in order to get information about the entire
cluster topology.
* For distributed caches, key-based operations are routed in the cluster 
using the same consistent hash algorithms used by the server, so that means
that the client can locate where a particular key resides without the need
of extra network hops.
* For distributed caches, multi-key or key-less operations are routed in
round robin fashion.
* For replicated/invalidated caches, all operations are routed in round robin
fashion, regardless of whether they are key-based or multi-key/key-less.

The routing and failover is transparent to the user code, so the operations
executed against in a cluster look exactly the same as in the previous code 
examples.
 
You can run a test locally by starting multiple instances of Infinispan 
Server like this:

    $ ./bin/standalone.sh -c clustered.xml -Djboss.node.name=node0 -Djboss.socket.binding.port-offset=100
    $ ./bin/standalone.sh -c clustered.xml -Djboss.node.name=node1 -Djboss.socket.binding.port-offset=200
    $ ./bin/standalone.sh -c clustered.xml -Djboss.node.name=node2 -Djboss.socket.binding.port-offset=300

And then using this code to verify that the topology is the expected one:

```Javascript
var infinispan = require('infinispan');

var connected = infinispan.client({port: 11322, host: '127.0.0.1'});

connected.then(function (client) {

  var members = client.getTopologyInfo().getMembers();

  // Should show all expected cluster members
  console.log('Connected to: ' + JSON.stringify(members));

  // Add your own operations here...

  return client.disconnect();

}).catch(function(error) {

  console.log("Got error: " + error.message);

});
```

## Working with Sites

Multiple Infinispan Server clusters can be deployed in such way that each cluster belongs to a different site.
Such deployments are done to enable data to be backed up from one cluster to another, potentially in a different geographical location.
This Javascript client implementation not only can failover between failures in nodes within a cluster, but if the entire cluster fails to respond, it can failover to a different cluster.
If the failover succeeds, the client will remain connected to the alternative cluster until this becomes unavailable, in which case it’ll try any other clusters defined, and ultimately, it’ll try the original server settings.
To be able to failover between clusters, first and foremost Infinispan Servers have to be [configured with cross-site replication](http://infinispan.org/docs/stable/user_guide/user_guide.html#CrossSiteReplication).
Next, the client has to provide alternative `clusters` configuration with at least one host/port pair details for each of the clusters configured.
For example:

```Javascript
var connected = infinispan.client({port: 11322, host: '127.0.0.1'},
  {
    clusters: [
      {
        name: 'site-a',
        servers: [{port: 1234, host: 'hostA1'}]
      },
      {
        name: 'site-b',
        servers: [{port: 2345, host: 'hostB1'}, {port: 3456, host: 'hostB2'}]
      }
    ]
  });
```

### Manual Cluster Switch

As well as supporting automatic site cluster failover, Javascript clients can also switch between site clusters manually by calling `switchToCluster(clusterName)` and `switchToDefaultCluster()`.
Using `switchToCluster(clusterName)``, users can force a client to switch to one of the clusters pre-defined in the client configuration. To switch to the initial servers defined in the client configuration, call `switchToDefaultCluster()`.
For example:

```Javascript
var connected = infinispan.client({port: 11322, host: '127.0.0.1'},
  {
    clusters: [
      {
        name: 'site-a',
        servers: [{port: 1234, host: 'hostA1'}]
      },
      {
        name: 'site-b',
        servers: [{port: 2345, host: 'hostB1'}, {port: 3456, host: 'hostB2'}]
      }
    ]
  });

connected.then(function (client) {

  var switchToB = client.getTopologyInfo().switchToCluster('site-b');

  switchToB.then(function(switchSucceed) {

    if (switchSucceed) {
      ...
    }

    ...

    var switchToDefault = client.getTopologyInfo().switchToDefaultCluster();

    switchToDefault.then(function(switchSucceed) {

      if (switchSucceed) {
        ...
      }

    })

  })

});
```

# Testing

Before executing any tests, Infinispan Server instances need to be started 
up so that testsuite can run against those. To ease this process, a script
has been created in the root directory to start all the expected server 
instances. Before executing this script, the following installation steps 
are required:

* Install [Haskell Tool Stack](http://docs.haskellstack.org/en/stable/README)
* Install an Infinispan Server instance in `/opt/infinispan-server` folder.

Once these steps have been executed, the script to start the servers can be 
executed via:

    $ ./start.hs

To run tests continuously execute the following:

    $ ./node_modules/.bin/jasmine-node spec --autotest --watch lib --captureExceptions

To run individual tests, execute the following:

    $ node node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js --captureExceptions

# Debugging

To debug tests with IDE:

    node --debug-brk node_modules/jasmine-node/lib/jasmine-node/cli.js spec/codec_spec.js

Or:

    node --debug-brk node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js

And then start a remote Node.js debugger from IDE on port 5858.

# Generating API documentation

The client contains JSDoc formatted API docs which can be generated via:

    npm install jsdoc
    ./node_modules/.bin/jsdoc lib/*.js
    open out/index.html
