#!/usr/bin/env bash

rm -drf tmp-tests.log

npx jasmine \
  --filter="codec_spec|functional_spec|infinispan_auth_spec|infinispan_cluster_spec|infinispan_expiry_spec|infinispan_json_spec|infinispan_local_spec|infinispan_ssl_spec|infinispan_stress_spec|protocols_spec|protostream_spec|utils_spec"
