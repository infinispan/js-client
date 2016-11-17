#!/bin/bash
FQDN=$1

ROOT="out"

# Remove any previous certificate
rm -drf ${ROOT}/certs

# Make directories to work from
mkdir -p ${ROOT}/certs/{server,client,ca,tmp,java}

# Create your very own Root Certificate Authority
openssl genrsa \
  -out ${ROOT}/certs/ca/${FQDN}-root-ca.key.pem \
  2048

# Self-sign your Root Certificate Authority
# Since this is private, the details can be as bogus as you like
openssl req \
  -x509 \
  -new \
  -nodes \
  -key ${ROOT}/certs/ca/${FQDN}-root-ca.key.pem \
  -days 1024 \
  -out ${ROOT}/certs/ca/${FQDN}-root-ca.crt.pem \
  -subj "/C=US/ST=Utah/L=Provo/O=ACME Signing Authority Inc/CN=example.com"

# Create a Device Certificate for each domain,
# such as example.com, *.example.com, awesome.example.com
# NOTE: You MUST match CN to the domain name or ip address you want to use
openssl genrsa \
  -out ${ROOT}/certs/server/privkey.pem \
  2048

# Create a request from your Device, which your Root CA will sign
openssl req -new \
  -key ${ROOT}/certs/server/privkey.pem \
  -out ${ROOT}/certs/tmp/csr.pem \
  -subj "/C=US/ST=Utah/L=Provo/O=ACME Tech Inc/CN=${FQDN}"

# Sign the request from Device with your Root CA
# -CAserial certs/ca/my-root-ca.srl
openssl x509 \
  -req -in ${ROOT}/certs/tmp/csr.pem \
  -CA ${ROOT}/certs/ca/${FQDN}-root-ca.crt.pem \
  -CAkey ${ROOT}/certs/ca/${FQDN}-root-ca.key.pem \
  -CAcreateserial \
  -out ${ROOT}/certs/server/cert.pem \
  -days 500

## Create a public key, for funzies
## see https://gist.github.com/coolaj86/f6f36efce2821dfb046d
#openssl rsa \
#  -in certs/server/privkey.pem \
#  -pubout -out certs/client/pubkey.pem

# Put things in their proper place
rsync -a ${ROOT}/certs/ca/${FQDN}-root-ca.crt.pem ${ROOT}/certs/server/chain.pem
rsync -a ${ROOT}/certs/ca/${FQDN}-root-ca.crt.pem ${ROOT}/certs/client/chain.pem
cat ${ROOT}/certs/server/cert.pem ${ROOT}/certs/server/chain.pem > ${ROOT}/certs/server/fullchain.pem

# Convert full chain to P12 file
openssl pkcs12 \
  -export \
  -passout pass:secret \
  -inkey ${ROOT}/certs/server/privkey.pem \
  -in ${ROOT}/certs/server/fullchain.pem \
  -name test \
  -out ${ROOT}/certs/java/fullchain.p12

# Convert P12 file to Java Key Store for server
keytool -importkeystore \
  -srckeystore ${ROOT}/certs/java/fullchain.p12 \
  -srcstoretype pkcs12 \
  -destkeystore ${ROOT}/certs/java/keystore_${FQDN}_server.jks \
  -srcstorepass "secret" \
  -deststorepass "secret"
