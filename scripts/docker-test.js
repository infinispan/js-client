#!/usr/bin/env node
'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT = 'ispn-test';
const ROOT = path.resolve(__dirname, '..');

process.chdir(ROOT);

function cleanup() {
  console.log('Tearing down Docker containers...');
  try {
    execSync(
      `docker compose -p ${PROJECT} --profile failover down --remove-orphans`,
      { stdio: 'inherit' }
    );
  } catch (_) { /* ignore */ }
}

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

// Step 1: Generate SSL certificates if needed
if (!fs.existsSync('out/ssl/server/server.p12')) {
  execSync('node scripts/make-ssl.js', { stdio: 'inherit' });
}

// Step 2: Start containers
console.log('Starting Infinispan containers...');
execSync(`docker compose -p ${PROJECT} up -d --wait`, { stdio: 'inherit' });
execSync(
  `docker compose -p ${PROJECT} --profile failover create server-failover-one server-failover-two server-failover-three`,
  { stdio: 'inherit' }
);

// Step 3: Detect container IPs
function getContainerIp(name) {
  try {
    var ip = execSync(
      `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${name}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return ip || '';
  } catch (_) {
    return '';
  }
}

const containers = {
  ISPN_LOCAL_HOST: 'ispn-local',
  ISPN_CLUSTER1_HOST: 'ispn-cluster-1',
  ISPN_CLUSTER2_HOST: 'ispn-cluster-2',
  ISPN_CLUSTER3_HOST: 'ispn-cluster-3',
  ISPN_SSL_HOST: 'ispn-ssl',
  ISPN_EARTH_HOST: 'ispn-earth',
  ISPN_MOON_HOST: 'ispn-moon',
  ISPN_FAILOVER1_HOST: 'ispn-failover-1',
  ISPN_FAILOVER2_HOST: 'ispn-failover-2',
  ISPN_FAILOVER3_HOST: 'ispn-failover-3',
};

for (const [envVar, container] of Object.entries(containers)) {
  process.env[envVar] = getContainerIp(container);
}
console.log('Container IPs:');
console.log(`  local:    ${process.env.ISPN_LOCAL_HOST}`);
console.log(`  cluster:  ${process.env.ISPN_CLUSTER1_HOST}, ${process.env.ISPN_CLUSTER2_HOST}, ${process.env.ISPN_CLUSTER3_HOST}`);
console.log(`  ssl:      ${process.env.ISPN_SSL_HOST}`);
console.log(`  failover: (started on demand by tests)`);
console.log(`  earth:    ${process.env.ISPN_EARTH_HOST}`);
console.log(`  moon:     ${process.env.ISPN_MOON_HOST}`);

// Step 4: Wait for cluster to form
console.log('Waiting for cluster to form...');
const MAX_RETRIES = 30;
let clusterFormed = false;

for (let i = 1; i <= MAX_RETRIES; i++) {
  try {
    const out = execSync(
      `curl -sf --digest -u admin:pass "http://${process.env.ISPN_CLUSTER1_HOST}:11222/rest/v2/container"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const size = JSON.parse(out).cluster_size || 0;
    if (size === 3) {
      console.log('Cluster formed with 3 nodes.');
      clusterFormed = true;
      break;
    }
    console.log(`  Cluster size: ${size} (attempt ${i}/${MAX_RETRIES})`);
  } catch (_) {
    console.log(`  Cluster not ready (attempt ${i}/${MAX_RETRIES})`);
  }
  spawnSync('sleep', ['5']);
}

if (!clusterFormed) {
  console.error('ERROR: Cluster did not form within timeout');
  cleanup();
  process.exit(1);
}

// Step 5: Run tests
console.log('Running tests...');
const result = spawnSync('npx', ['jasmine'].concat(process.argv.slice(2)), {
  stdio: 'inherit',
  env: process.env,
});

cleanup();
process.exit(result.status);
