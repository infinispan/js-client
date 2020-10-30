#!/usr/bin/env bash

# Stop if any errors found
set -e

node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js --captureExceptions

#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/small_local_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/* --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_failover_listener_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_cluster_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_xsite_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_expiry_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_failover_spec.js --captureExceptions
#node --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_ssl_spec.js --captureExceptions
