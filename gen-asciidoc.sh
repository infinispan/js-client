#!/usr/bin/env bash

# Generates HTML documentation from AsciiDoc sources.
# Mirrors the asciidoctor-maven-plugin configuration used by
# the main Infinispan documentation build (documentation/pom.xml).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${SCRIPT_DIR}/documentation/asciidoc"
OUT_DIR="${SCRIPT_DIR}/out/docs"

mkdir -p "${OUT_DIR}"

asciidoctor \
  --doctype book \
  --backend html5 \
  --safe-mode unsafe \
  -a idprefix="" \
  -a idseparator="-" \
  -a sectanchors \
  -a toc=left \
  -a toclevels=3 \
  -a numbered \
  -a icons=font \
  -a experimental \
  -a source-highlighter=highlight.js \
  -a highlightjs-theme=github \
  -a imagesdir=../../topics/images \
  -a stories=../stories \
  -a topics=../topics \
  -a community \
  -a brandname=Infinispan \
  -a fullbrandname=Infinispan \
  -a brandshortname=infinispan \
  -a hr_js="Hot Rod JS" \
  -a doc_home=https://infinispan.org/documentation/ \
  -a download_url=https://infinispan.org/download/ \
  -a node_docs=https://docs.jboss.org/infinispan/hotrod-clients/javascript/1.0/apidocs/ \
  -a server_docs=https://infinispan.org/docs/stable/titles/server/server.html \
  -a code_tutorials=https://github.com/infinispan/infinispan-simple-tutorials/ \
  -a query_docs=https://infinispan.org/docs/stable/titles/query/query.html \
  -o "${OUT_DIR}/index.html" \
  "${SRC_DIR}/titles/js_client.asciidoc"

echo "Documentation generated: ${OUT_DIR}/index.html"
