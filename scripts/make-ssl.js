#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'out');
const PASS = 'secret';

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

function keytool(args) {
  run(`keytool ${args}`);
}

function createKeystore(alias, dname, dir, keystore) {
  keytool(`-genkeypair -alias ${alias} -dname "${dname}" -keystore ${dir}/${keystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -keyalg RSA -keysize 2048 -storetype JKS`);
}

function createSignRequest(alias, dname, dir, keystore, csr) {
  keytool(`-certreq -alias ${alias} -dname "${dname}" -keystore ${dir}/${keystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -file ${dir}/${csr}`);
}

function signCertificate(ca, dir, csr, cer) {
  var caAlias = `infinispan-${ca}`;
  var caDir = `${ROOT}/ssl/${ca}`;
  var caKeystore = `${ca}.jks`;
  keytool(`-gencert -alias ${caAlias} -keystore ${caDir}/${caKeystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -infile ${dir}/${csr} -outfile ${dir}/${cer}`);
}

function importCA(ca, dir, keystore) {
  var caAlias = `infinispan-${ca}`;
  var caDir = `${ROOT}/ssl/${ca}`;
  var caKeystore = `${ca}.jks`;
  keytool(`-importkeystore -srcalias ${caAlias} -srcstorepass ${PASS} ` +
    `-srckeystore ${caDir}/${caKeystore} -deststorepass ${PASS} -destkeystore ${dir}/${keystore}`);
}

function importCertificate(alias, dir, keystore, cer) {
  keytool(`-importcert -alias ${alias} -keystore ${dir}/${keystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -file ${dir}/${cer}`);
}

function keystoreToP12(dir, keystore, p12store) {
  keytool(`-importkeystore -srckeystore ${dir}/${keystore} -destkeystore ${dir}/${p12store} ` +
    `-srcstoretype jks -deststoretype pkcs12 -srcstorepass ${PASS} -deststorepass ${PASS}`);
}

function extractPemCertificate(dir, p12store, pem) {
  run(`openssl pkcs12 -in ${dir}/${p12store} -passin pass:${PASS} -passout pass:${PASS} ` +
    `-nokeys -clcerts | awk '/-BEGIN CERTIFICATE-/{a=1};a;/-END CERTIFICATE-/{exit}' > ${dir}/${pem}`);
}

function makeCA(name) {
  var dir = `${ROOT}/ssl/${name}`;
  var alias = `infinispan-${name}`;
  var dname = 'CN=CA,OU=Infinispan,O=JBoss,L=RedHat';
  var keystore = `${name}.jks`;
  var p12store = `${name}.p12`;
  var pem = `${name}.pem`;

  fs.mkdirSync(dir, { recursive: true });

  keytool(`-genkeypair -alias ${alias} -dname "${dname}" -keystore ${dir}/${keystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -keyalg RSA -keysize 2048 -storetype JKS -ext bc:c`);

  keystoreToP12(dir, keystore, p12store);

  run(`openssl pkcs12 -in ${dir}/${p12store} -out ${dir}/${pem} ` +
    `-passin pass:${PASS} -passout pass:${PASS} -nokeys`);
}

function makeServerKeystore(ca) {
  var dir = `${ROOT}/ssl/server`;
  var alias = 'server';
  var dname = 'CN=localhost,OU=Infinispan,O=JBoss,L=RedHat';
  var keystore = 'server.jks';
  var p12store = 'server.p12';
  var csr = 'server.csr';
  var cer = 'server.cer';
  var caDir = `${ROOT}/ssl/${ca}`;
  var caKeystore = `${ca}.jks`;
  var caAlias = `infinispan-${ca}`;

  fs.mkdirSync(dir, { recursive: true });

  createKeystore(alias, dname, dir, keystore);

  keytool(`-certreq -alias ${alias} -dname "${dname}" -keystore ${dir}/${keystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -file ${dir}/${csr}`);

  keytool(`-gencert -alias ${caAlias} -keystore ${caDir}/${caKeystore} ` +
    `-storepass ${PASS} -keypass ${PASS} -infile ${dir}/${csr} -outfile ${dir}/${cer}`);

  keytool(`-importkeystore -srcalias ${caAlias} -srcstorepass ${PASS} ` +
    `-srckeystore ${caDir}/${caKeystore} -deststorepass ${PASS} -destkeystore ${dir}/${keystore}`);

  importCertificate(alias, dir, keystore, cer);
  keystoreToP12(dir, keystore, p12store);
}

function makeClientKeystore(ca) {
  var dir = `${ROOT}/ssl/client`;
  var alias = 'client';
  var dname = 'CN=localhost,OU=Infinispan,O=JBoss,L=RedHat';
  var keystore = 'client.jks';
  var p12store = 'client.p12';
  var csr = 'client.csr';
  var cer = 'client.cer';
  var pem = 'client.pem';
  var privkey = 'client.pk';

  fs.mkdirSync(dir, { recursive: true });

  createKeystore(alias, dname, dir, keystore);
  createSignRequest(alias, dname, dir, keystore, csr);
  signCertificate(ca, dir, csr, cer);
  importCA(ca, dir, keystore);
  importCertificate(alias, dir, keystore, cer);
  keystoreToP12(dir, keystore, p12store);
  extractPemCertificate(dir, p12store, pem);

  run(`openssl pkcs12 -in ${dir}/${p12store} -passin pass:${PASS} -passout pass:${PASS} ` +
    `-nocerts -nodes | awk '/-BEGIN PRIVATE KEY-/{a=1};a;/-END PRIVATE KEY-/{exit}' > ${dir}/${privkey}`);
}

function makeSNI(ca, host) {
  var dir = `${ROOT}/ssl/sni-${host}`;
  var alias = host;
  var dname = `CN=${host},OU=Infinispan,O=JBoss,L=RedHat`;
  var keystore = `${host}.jks`;
  var p12store = `${host}.p12`;
  var csr = `${host}.csr`;
  var cer = `${host}.cer`;
  var pem = `${host}.pem`;

  fs.mkdirSync(dir, { recursive: true });

  createKeystore(alias, dname, dir, keystore);
  createSignRequest(alias, dname, dir, keystore, csr);
  signCertificate(ca, dir, csr, cer);
  importCA(ca, dir, keystore);
  importCertificate(alias, dir, keystore, cer);
  keystoreToP12(dir, keystore, p12store);
  extractPemCertificate(dir, p12store, pem);
}

// Remove any previous certificates
fs.rmSync(`${ROOT}/ssl`, { recursive: true, force: true });

console.log('Generating SSL certificates...');
makeCA('ca');
makeServerKeystore('ca');
makeClientKeystore('ca');
makeSNI('ca', 'trust1');
makeSNI('ca', 'trust2');
makeCA('untrust-ca');
makeSNI('untrust-ca', 'untrust');
console.log('SSL certificates generated in out/ssl/');
