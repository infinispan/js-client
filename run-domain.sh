#!/usr/bin/env bash

set -e
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT


SERVER_HOME=/opt/infinispan-server
CLUSTER_SIZE_MAIN="/host=master/server=server-three/subsystem=datagrid-infinispan/cache-container=clustered:read-attribute(name=cluster-size)"


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


rm -drf $TMPDIR/infinispan-js-domain*
SERVER_TMP=`mktemp -d -t 'infinispan-js-domain' || mktemp -d 2>/dev/null`
echo "Created temporary directory: $SERVER_TMP"


cp -r $SERVER_HOME/* $SERVER_TMP
echo "Server copied to temporary directory."


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


$SERVER_TMP/bin/domain.sh &


waitForClusters
echo "Infinispan test domain started."


# Wait until script stopped
while :
do
  sleep 5
done
