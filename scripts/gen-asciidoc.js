#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
var srcDir = path.join(ROOT, 'documentation', 'asciidoc');
var outDir = path.join(ROOT, 'out', 'docs');

fs.mkdirSync(outDir, { recursive: true });

execSync([
  'asciidoctor',
  '--doctype book',
  '--backend html5',
  '--safe-mode unsafe',
  '-a idprefix=""',
  '-a idseparator="-"',
  '-a sectanchors',
  '-a toc=left',
  '-a toclevels=3',
  '-a numbered',
  '-a icons=font',
  '-a experimental',
  '-a source-highlighter=highlight.js',
  '-a highlightjs-theme=github',
  '-a imagesdir=../../topics/images',
  '-a stories=../stories',
  '-a topics=../topics',
  '-a community',
  '-a brandname=Infinispan',
  '-a fullbrandname=Infinispan',
  '-a brandshortname=infinispan',
  '-a hr_js="Hot Rod JS"',
  '-a doc_home=https://infinispan.org/documentation/',
  '-a download_url=https://infinispan.org/download/',
  '-a node_docs=https://docs.jboss.org/infinispan/hotrod-clients/javascript/1.0/apidocs/',
  '-a server_docs=https://infinispan.org/docs/stable/titles/server/server.html',
  '-a code_tutorials=https://github.com/infinispan/infinispan-simple-tutorials/',
  '-a query_docs=https://infinispan.org/docs/stable/titles/query/query.html',
  `-o "${outDir}/index.html"`,
  `"${srcDir}/titles/js_client.asciidoc"`
].join(' '), { stdio: 'inherit' });

console.log(`Documentation generated: ${outDir}/index.html`);
