#!/usr/bin/env bash

# Stop if any errors found
set -e

./node_modules/.bin/jasmine-node spec --captureExceptions
