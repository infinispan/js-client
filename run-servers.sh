#!/usr/bin/env bash

set -e

if [[ $1 = "--ci" ]]; then
  echo "Launch script finished"
else
  trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT
fi


SERVER_VERSION="10.1.5.Final"
SERVER_HOME=server/infinispan-server-$SERVER_VERSION
CLUSTER_SIZE_MAIN="$SERVER_HOME/bin/cli.sh -c localhost:11322 -f batch "
ZIP_ROOT="http://downloads.jboss.org/infinispan"

CONF_DIR_TO_COPY_FROM="spec/configs/"
IS_SSL_PROCESSED=0
SERVER_DIR="infinispan-server"

function waitForClusters()
{
cat > batch<<EOF
describe
disconnect
EOF

  MEMBERS_MAIN=''
  while [ "$MEMBERS_MAIN" != '3' ];
  do
    MEMBERS_MAIN=$($CLUSTER_SIZE_MAIN | grep cluster_size | cut -d':' -f2 | sed 's/.$//' | sed -e 's/^[[:space:]]*//')
    echo "Waiting for clusters to form (main: $MEMBERS_MAIN)"
    sleep 20
  done
}

function prepareServerDir()
{
    local isCi=$1
    local confPath=$2
    local isSsl=$3
    local dirName=${4}

    if [ ! -f server/infinispan-server-$SERVER_VERSION.zip ]; then
        cd server
        wget $ZIP_ROOT/$SERVER_VERSION/infinispan-server-$SERVER_VERSION.zip
        unzip  infinispan-server-$SERVER_VERSION.zip
        cd ..
    fi

    if [[ -z "${SERVER_TMP}" ]]; then
         SERVER_TMP=server/${SERVER_DIR}
         mkdir ${SERVER_TMP} 2>/dev/null
         echo "Created temporary directory: $SERVER_TMP"

         cp -r ${SERVER_HOME}/* $SERVER_TMP
         echo "Server copied to temporary directory."

         $SERVER_TMP/bin/user-tool.sh -u admin -p 'mypassword'
         echo "Admin user added."
    fi

    cp -r ${SERVER_HOME}/server ${SERVER_TMP}/${dirName}


    cp "${CONF_DIR_TO_COPY_FROM}/${confPath}" ${SERVER_TMP}/${dirName}/conf
    echo "Infinispan configuration file ${confPath} copied to server ${dirName}."

    if [[ ${isSsl} = "true" && ${IS_SSL_PROCESSED} = 0 ]]; then
        ./make-ssl.sh
        echo "Generate TLS/SSL certificates"

        IS_SSL_PROCESSED=1
    fi

    if [[ ${isSsl} = "true" ]]; then
        cp out/ssl/ca/ca.jks $SERVER_TMP/${dirName}/conf
        cp out/ssl/server/server.jks $SERVER_TMP/${dirName}/conf
        cp out/ssl/sni-trust1/trust1.jks $SERVER_TMP/${dirName}/conf
        cp out/ssl/sni-trust2/trust2.jks $SERVER_TMP/${dirName}/conf
        cp out/ssl/sni-untrust/untrust.jks $SERVER_TMP/${dirName}/conf
        echo "Security key and trust stores copied to temporary server."
    fi
    export SERVER_TMP=${SERVER_TMP}
}

function startServer()
{
    local isCi=$1
    local confPath=$2
    local isSsl=$3
    local port=${4}
    local nodeName=${5}
    local jvmParam=${6}

    prepareServerDir "${isCi}" ${confPath} ${isSsl} ${nodeName}

    if [[ ! -z ${port} ]]; then
        portStr="-p ${port}"
    fi


    if [[ ${isCi} = "--ci" ]]; then
      nohup $SERVER_TMP/bin/server.sh -Djavax.net.debug -Dorg.infinispan.openssl=false -c ${confPath} -s ${SERVER_TMP}/${nodeName} ${portStr:-""}  --node-name=${nodeName} ${jvmParam:-} &
    else
      ${SERVER_TMP}/bin/server.sh -Djavax.net.debug -Dorg.infinispan.openssl=false -c ${confPath} -s ${SERVER_TMP}/${nodeName} ${portStr:-} --node-name=${nodeName} ${jvmParam:-} &
    fi
}

#deleting the testable server directory
rm -drf server/${SERVER_DIR}

export JAVA_OPTS="-Xms512m -Xmx1024m -XX:MetaspaceSize=128M -XX:MaxMetaspaceSize=512m"

startServer "$1" infinispan.xml false 11222 "server-local"
startServer "$1" infinispan-clustered.xml false 11322 "server-one"
startServer "$1" infinispan-clustered.xml false 11332 "server-two"
startServer "$1" infinispan-clustered.xml false 11342 "server-three"
startServer "$1" infinispan-ssl.xml true 11622 "server-ssl"
startServer "$1" infinispan-ssl1.xml true 11632 "server-ssl1"
startServer "$1" infinispan-ssl2.xml true 11642 "server-ssl2"

#Preparing server dirs for failover tests (3 servers)
prepareServerDir "$1" infinispan-clustered.xml false "server-failover-one"
prepareServerDir "$1" infinispan-clustered.xml false "server-failover-two"
prepareServerDir "$1" infinispan-clustered.xml false "server-failover-three"

#Preparing server dirs for xsite tests (2 servers)
prepareServerDir "$1" infinispan-xsite-EARTH.xml false "server-earth"
prepareServerDir "$1" infinispan-xsite-MOON.xml false "server-moon"

waitForClusters
echo "Infinispan test server started."


if [[ $1 = "--ci" ]]; then
  echo "Launch script finished"
else
  # Wait until script stopped
  while :
  do
    sleep 5
  done
fi
