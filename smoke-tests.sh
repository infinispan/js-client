#!/usr/bin/env bash

rm -drf tmp-tests.log

node \
  --trace-deprecation \
  node_modules/jasmine-node/lib/jasmine-node/cli.js \
  spec/codec_spec.js \
  spec/infinispan_cluster_spec.js \
  spec/infinispan_local_spec.js \
  spec/infinispan_json_spec.js \
  spec/infinispan_ssl_spec.js \
  spec/protocols_spec.js \
  --captureExceptions
