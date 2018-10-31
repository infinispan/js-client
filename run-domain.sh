#!/usr/bin/env bash

set -e

if [[ $1 = "--ci" ]]; then
  echo "Launch script finished"
else
  trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT
fi


SERVER_VERSION="9.4.0.Final"
SERVER_HOME=server/infinispan-server-$SERVER_VERSION
CLUSTER_SIZE_MAIN="/host=master/server=server-three/subsystem=datagrid-infinispan/cache-container=clustered:read-attribute(name=cluster-size)"
ZIP_ROOT="http://downloads.jboss.org/infinispan"

function waitForClusters()
{
  MEMBERS_MAIN=''
  while [ "$MEMBERS_MAIN" != \"3\" ];
  do
    MEMBERS_MAIN=$($SERVER_HOME/bin/ispn-cli.sh -c $CLUSTER_SIZE_MAIN | grep result | tr -d '\r' | awk '{print $3}')
    echo "Waiting for clusters to form (main: $MEMBERS_MAIN)"
    sleep 3
  done
}

if [ ! -f server/infinispan-server-$SERVER_VERSION.zip ]; then
    cd server
    wget $ZIP_ROOT/$SERVER_VERSION/infinispan-server-$SERVER_VERSION.zip
    unzip infinispan-server-$SERVER_VERSION.zip
    cd ..
fi


if [[ $1 = "--ci" ]]; then
    SERVER_TMP=server/infinispan-server-$SERVER_VERSION
    echo "Use server in directory: $SERVER_TMP"
else
    rm -drf $TMPDIR/infinispan-js-domain*
    SERVER_TMP=`mktemp -d -t 'infinispan-js-domain.XXX' || mktemp -d 2>/dev/null`
    echo "Created temporary directory: $SERVER_TMP"

    cp -r server/infinispan-server-$SERVER_VERSION/* $SERVER_TMP
    echo "Server copied to temporary directory."
fi


cp spec/configs/domain.xml $SERVER_TMP/domain/configuration
cp spec/configs/host.xml $SERVER_TMP/domain/configuration
echo "Domain configuration files copied to temporary server."

./make-ssl.sh
echo "Generate TLS/SSL certificates"

cp out/ssl/ca/ca.jks $SERVER_TMP/domain/configuration
cp out/ssl/server/server.jks $SERVER_TMP/domain/configuration
cp out/ssl/sni-trust1/trust1.jks $SERVER_TMP/domain/configuration
cp out/ssl/sni-trust2/trust2.jks $SERVER_TMP/domain/configuration
cp out/ssl/sni-untrust/untrust.jks $SERVER_TMP/domain/configuration
echo "Security key and trust stores copied to temporary server."


$SERVER_TMP/bin/add-user.sh -u admin -p 'mypassword'
echo "Admin user added."


if [[ $1 = "--ci" ]]; then
  nohup $SERVER_TMP/bin/domain.sh &
else
  $SERVER_TMP/bin/domain.sh &
fi


waitForClusters
echo "Infinispan test domain started."


if [[ $1 = "--ci" ]]; then
  echo "Launch script finished"
else
  # Wait until script stopped
  while :
  do
    sleep 5
  done
fi
