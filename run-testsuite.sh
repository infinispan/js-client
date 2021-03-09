#!/usr/bin/env bash

# Stop if any errors found
set -e

#node node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_failover_spec.js --captureExceptions
#node node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_failover_listener_spec.js --captureExceptions
node node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_xsite_spec.js --captureExceptions
