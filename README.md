# Hot Rod JS Client

[![npm version](https://img.shields.io/npm/v/infinispan)](https://www.npmjs.com/package/infinispan)
[![License](https://img.shields.io/npm/l/infinispan)](https://github.com/infinispan/js-client/blob/main/LICENSE)
[![CI](https://github.com/infinispan/js-client/actions/workflows/ci.yml/badge.svg)](https://github.com/infinispan/js-client/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/infinispan)](https://www.npmjs.com/package/infinispan)
[![npm downloads](https://img.shields.io/npm/dm/infinispan)](https://www.npmjs.com/package/infinispan)

`infinispan` is an asynchronous event-driven Infinispan client for Node.js.
The results of the asynchronous operations are represented using
[Promise](https://www.promisejs.org) instances. Amongst many advantages,
promises make it easy to transform/chain multiple asynchronous invocations
and they improve error handling by making it easy to centralise it.

Here's a summary of its current capabilities:

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
* Clients can connect using encryption with the server via SSL/TLS with optional TLS/SNI support.
* Clients can talk to clusters of Infinispan Server instances, using
Consistent-Hash based algorithms to route key-based operations.
* Multi-key or key-less operations are routed in round-robin fashion.
* Clients only need to be configure with a single node's address and from
that node the rest of the cluster topology can be discovered. As nodes are
added or destroyed, clients get notified of changes in the cluster topology
dynamically.
* Clients can talk to multiple clusters that are separated into different site clusters.
The client is normally connected to one of the sites, but if its members fail to respond, it will automatically switch to an alternative site to which it can connect.
* Clients have methods, such as `switchToCluster(clusterName)` and `switchToDefaultCluster` that allows users to manually change to which site cluster to connect.
* Finally, clients can stop communication with the server(s) using the
`disconnect` method.

# Hot Rod JS client documentation

Find installation, configuration, and example usage in the Hot Rod JS Client Guide at [infinispan.org/documentation](https://infinispan.org/documentation/).

You can also build the Hot Rod JS Client Guide locally:

```bash
npm run docs:user
```

Open `out/docs/index.html` in any browser.

# API docs

Review [Hot Rod JS client API documentation](http://docs.jboss.org/infinispan/hotrod-clients/javascript/1.0/apidocs/module-infinispan.html).

To generate API docs locally:

```bash
npm run docs:api
```

Open `out/index.html` in any browser.

# Testing

Tests run against Infinispan Server instances in Docker containers.

## Prerequisites

- Docker and Docker Compose
- Java (for SSL certificate generation via `keytool`)
- Node.js 24+

## Running tests

```bash
npm install
npm run test:docker
```

This starts all required containers, generates SSL certificates if needed,
waits for the cluster to form, runs the full test suite, and tears down
the containers on exit.

To test against a specific Infinispan version:

```bash
INFINISPAN_VERSION=16.1.3 npm run test:docker
```

### Manual container lifecycle

For iterative development, start containers once and run tests repeatedly:

```bash
npm run docker:up
npm test
# ... make changes ...
npm test
npm run docker:down
```

### Individual tests

With containers running:

```bash
npx jasmine spec/infinispan_local_spec.js
```

### SSL certificates

Certificates are generated automatically on first test run. To regenerate:

```bash
npm run ssl:generate
```

## Manual stress tests

The testsuite contains manual stress tests that take several minutes to run.
To run these tests, execute:

```bash
npx jasmine spec-manual/*_spec.js
```

## Memory profiling

The source code comes with some programs that allow the client's memory consumption to be profiled.
Those programs rely on having access to the global garbage collector.
So, to run them you must pass `--expose-gc` command line parameter.
Example:

```bash
node --expose-gc memory-profiling/infinispan_memory_many_get.js
```

Some programs might only report the memory usage before/after.
Others might generate heap dumps which can be visualized using Google Chrome.
Within Chrome, the Developer Tools UI contains a `Memory` tab where heap dumps can be loaded.

## Debugging

To debug tests with IDE:

```bash
node --inspect-brk node_modules/.bin/jasmine spec/codec_spec.js
```

And then start a remote Node.js debugger from IDE on port 9229.

# Reporting an issue

Report issues via [GitHub Issues](https://github.com/infinispan/js-client/issues).
