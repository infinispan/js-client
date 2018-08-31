#!/usr/bin/env bash

rm -drf tmp-tests.log

./node_modules/.bin/jasmine-node \
  spec/codec_spec.js \
  spec/infinispan_cluster_spec.js \
  spec/infinispan_local_spec.js \
  spec/infinispan_json_spec.js \
  spec/infinispan_ssl_spec.js \
  spec/protocols_spec.js \
  --captureExceptions
