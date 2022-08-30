var infinispan = require('infinispan');
var protobuf = require('protobufjs');
// This example uses async/await paradigma
(async function () {
// User data protobuf definition
  var cacheValueProtoDef = `package awesomepackage;
  /**
   * @TypeId(1000044)
   */
  message AwesomeUser {
      required string name = 1;
      required int64 age = 2;
      required bool isVerified =3;
  }`
  var protoMetaClient;
  var client;
  try {
    // Creating clients for two caches:
    // - ___protobuf_metadata for registering .proto file
    // - queryCache for user data
    var connectProp = { port: 11222, host: '127.0.0.1' };
    var commonOpts = {
      version: '3.0',
      authentication: {
        enabled: true,
        saslMechanism: 'PLAIN',
        userName: 'admin',
        password: 'pass'
      }
    };
    var protoMetaClientOps = {
      cacheName: '___protobuf_metadata',
      dataFormat: { keyType: "text/plain", valueType: "text/plain" }
    }
    var clientOps = {
      dataFormat: { keyType: "text/plain", valueType: "application/x-protostream" },
      cacheName: 'queryCache'
    }
    protoMetaClient = await infinispan.client(connectProp, Object.assign(commonOpts,protoMetaClientOps));
    client = await infinispan.client(connectProp, Object.assign(commonOpts,clientOps));

    // Registering protobuf definition on server
    await protoMetaClient.put("awesomepackage/AwesomeUser.proto", cacheValueProtoDef);

    // Registering protobuf definition on protobufjs
    var root = protobuf.parse(cacheValueProtoDef).root;
    var AwesomeUser = root.lookupType(".awesomepackage.AwesomeUser");
    client.registerProtostreamRoot(root);
    client.registerProtostreamType(".awesomepackage.AwesomeUser", 1000044);
    
    // Cleanup and populating the cache
    await client.clear();
    for (let i = 0; i < 10; i++) {
      var payload = { name: "AwesomeName" + i, age: i, isVerified: (Math.random() < 0.5) };
      var message = AwesomeUser.create(payload);
      console.log("Creating entry:", message);
      await client.put(i.toString(), message)
    }
    // Run the query
    var queryStr = `select u.name,u.age from awesomepackage.AwesomeUser u where u.age<20 order by u.name asc`;
    console.log("Running query:", queryStr);
    var query = await client.query({ queryString: queryStr });
    console.log("Query result:");
    console.log(query);
  } catch (err) {
    handleError(err);
  } finally {
    if (client) {
      await client.disconnect();
    }
    if (protoMetaClient) {
      await protoMetaClient.disconnect();
    }
  }
})();

function handleError(err) {
  if (err.includes("'queryCache' not found")) {
    console.log('*** ERROR ***');
    console.log(`*** This example needs a cache 'queryCache' with the following config:
    {
      "local-cache": {
        "statistics": true,
        "encoding": {
        "key": {
          "media-type": "text/plain"
        },
        "value": {
          "media-type": "application/x-protostream"
}}}}`)
  } else {
    console.log(err);
  }
}