#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COMPOSE_PROJECT="ispn-test"

# Always tear down on exit
cleanup() {
  echo "Tearing down Docker containers..."
  docker compose -p "$COMPOSE_PROJECT" --profile failover down --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

# ── Step 1: Generate SSL certificates if needed ─────────────────────────
if [ ! -f "out/ssl/server/server.p12" ]; then
  echo "Generating SSL certificates..."
  ./make-ssl.sh
fi

# ── Step 2: Start containers ────────────────────────────────────────────
echo "Starting Infinispan containers..."
docker compose -p "$COMPOSE_PROJECT" up -d --wait
docker compose -p "$COMPOSE_PROJECT" --profile failover create server-failover-one server-failover-two server-failover-three

# ── Step 3: Detect container IPs ────────────────────────────────────────
get_container_ip() {
  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"
}

export ISPN_LOCAL_HOST=$(get_container_ip ispn-local)
export ISPN_CLUSTER1_HOST=$(get_container_ip ispn-cluster-1)
export ISPN_CLUSTER2_HOST=$(get_container_ip ispn-cluster-2)
export ISPN_CLUSTER3_HOST=$(get_container_ip ispn-cluster-3)
export ISPN_SSL_HOST=$(get_container_ip ispn-ssl)
export ISPN_EARTH_HOST=$(get_container_ip ispn-earth)
export ISPN_MOON_HOST=$(get_container_ip ispn-moon)
export ISPN_FAILOVER1_HOST=$(get_container_ip ispn-failover-1)
export ISPN_FAILOVER2_HOST=$(get_container_ip ispn-failover-2)
export ISPN_FAILOVER3_HOST=$(get_container_ip ispn-failover-3)
export ISPN_DOCKER=true

echo "Container IPs:"
echo "  local:    $ISPN_LOCAL_HOST"
echo "  cluster:  $ISPN_CLUSTER1_HOST, $ISPN_CLUSTER2_HOST, $ISPN_CLUSTER3_HOST"
echo "  ssl:      $ISPN_SSL_HOST"
echo "  failover: $ISPN_FAILOVER1_HOST, $ISPN_FAILOVER2_HOST, $ISPN_FAILOVER3_HOST"
echo "  earth:    $ISPN_EARTH_HOST"
echo "  moon:     $ISPN_MOON_HOST"

# ── Step 4: Wait for cluster to form ────────────────────────────────────
echo "Waiting for cluster to form..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
  CLUSTER_SIZE=$(curl -sf --digest -u admin:pass "http://$ISPN_CLUSTER1_HOST:11222/rest/v2/container" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('cluster_size',0))" 2>/dev/null || echo "0")
  if [ "$CLUSTER_SIZE" = "3" ]; then
    echo "Cluster formed with 3 nodes."
    break
  fi
  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "ERROR: Cluster did not form within timeout (size=$CLUSTER_SIZE)"
    exit 1
  fi
  echo "  Cluster size: $CLUSTER_SIZE (attempt $i/$MAX_RETRIES)"
  sleep 5
done

# ── Step 5: Run tests ──────────────────────────────────────────────────
echo "Running tests..."
npx jasmine "$@"
