# JS Client Code Instructions

## Tech Stack
* **Runtime:** Node.js 24 LTS
* **Language:** JavaScript (ES6+) with TypeScript definition files (`types/index.d.ts`)
* **Protocol:** Hot Rod binary protocol — versions 2.2, 2.5, 2.9, 3.0, 4.0, 4.1
* **Test framework:** Jasmine 6
* **Linting:** ESLint (ES2022, single quotes, semicolons required, JSDoc required)
* **Docs:** JSDoc for API docs, AsciiDoc for user documentation

## Project Structure

```
index.js                  # Entry point — re-exports lib/infinispan.js
lib/
  infinispan.js           # Main client API (connect, CRUD, listeners, queries, scripts)
  io.js                   # Transport layer (TCP sockets, topology, failover, consistent hashing)
  protocols.js            # Hot Rod protocol encode/decode for all supported versions
  codec.js                # Binary codec (VInt, VLong, strings, Protobuf, JSON)
  listeners.js            # Remote/local event listener management
  functional.js           # Functional combinators (lift, actions, pipeline, partial application)
  utils.js                # Logging, MurmurHash3, ReplayableBuffer, address normalization
  uri.js                  # Hot Rod URI parsing (hotrod:// and hotrods:// schemes)
  sasl/                   # SASL authentication mechanisms
    factory.js            #   Mechanism registry and negotiation
    plain.js              #   PLAIN
    digest.js             #   DIGEST-MD5
    scram.js              #   SCRAM-SHA-1/256/384/512
    external.js           #   EXTERNAL (TLS cert)
    oauthbearer.js        #   OAUTHBEARER
spec/                     # Tests
  *_spec.js               #   Test suites
  utils/testing.js        #   Shared test utilities and assertion helpers
  configs/                #   Infinispan server XML configurations for test scenarios
types/                    # TypeScript type definitions
documentation/            # AsciiDoc user documentation
scripts/                  # Build and test tooling
```

## Build and Test Commands
* **Install dependencies:** `npm install`
* **Lint:** `npm run lint`
* **Run tests (with containers):** `npm run test:docker`
* **Run tests (containers already running):** `npm test`
* **Start test containers:** `npm run docker:up`
* **Stop test containers:** `npm run docker:down`
* **Run a single spec:** `npx jasmine spec/infinispan_local_spec.js`
* **Generate SSL certificates:** `npm run ssl:generate`
* **Generate API docs:** `npm run docs:api`
* **Override server version:** `INFINISPAN_VERSION=16.1.3 npm run test:docker`

## Architecture Notes

* **Consistent hashing:** Keys are routed to owning servers using MurmurHash3. Topology updates from the server adjust the hash ring automatically.
* **Multiplexing:** Multiple in-flight requests share a single TCP connection per server, routed by message ID.
* **State threading in codec:** The codec layer uses a functional "lift" pattern where encode/decode functions return `{answer, state}` tuples for immutable state management through the pipeline.
* **Failover:** Automatic retry with round-robin fallback to other cluster members. Cross-site failover supported via `clusters` option and `switchToCluster()`.

## Development Standards
* **Style:** Use `var` for variable declarations (not `const`/`let`) to match existing codebase.
* **Module pattern:** All modules wrap code in an IIFE: `(function() { ... }.call(this));`
* **JSDoc:** Required for all public functions. Use `@param`, `@returns`, `@since` tags.
* **Testing:** Tests use Promise chains with `spec/utils/testing.js` helpers. Follow the pattern:
  ```javascript
  var t = require('./utils/testing');
  it('should do something', function(done) {
    t.client(t.local, t.authOpts)
      .then(t.assert(t.put('key', 'value')))
      .then(t.assert(t.get('key'), t.toBe('value')))
      .then(t.assert(t.disconnect()))
      .then(function() { done(); }, t.failed(done));
  });
  ```
* **Commit logs:** Commit logs must always start with `[#nnnnn] Summary`.
* **Git branches:** Branches should be named `issueid/issue_summary` and use `origin/main` as the upstream.

## Development Platform
* **Repository:** https://github.com/infinispan/js-client
* **Issues:** Use GitHub Issues with appropriate labels.
* **License:** Apache-2.0

## Related Projects

* **Infinispan server:** The Infinispan server source code is in ../infinispan
* **Operator:** The Infinispan Operator source code is in ../infinispan-operator
* **Console:** The Infinispan Console source code is in ../infinispan-console
