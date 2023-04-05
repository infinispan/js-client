#!/usr/bin/env bash

# Stop if any errors found
set -e

node --dns-result-order=ipv4first --trace-deprecation node_modules/jasmine-node/lib/jasmine-node/cli.js spec/* --captureExceptions --forceexit --junitreport
