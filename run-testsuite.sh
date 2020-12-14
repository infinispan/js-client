#!/usr/bin/env bash

# Stop if any errors found
set -e

#./node_modules/.bin/jasmine-node spec --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_auth_spec.js --captureExceptions
node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_cluster_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_failover_listener_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_failover_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_ssl_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_xsite_spec.js --captureExceptions
