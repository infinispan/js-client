'use strict';

var t = require('./utils/testing');
var ispn = require('../lib/infinispan');
var protobuf = require('protobufjs');

var personProto = 'package tutorial;\n'
  + 'syntax = "proto3";\n'
  + '/**\n'
  + ' * @TypeId(1000042)\n'
  + ' */\n'
  + 'message Person {\n'
  + '    string firstName = 1;\n'
  + '    string lastName = 2;\n'
  + '    int32 bornYear = 3;\n'
  + '    string bornIn = 4;\n'
  + '}\n';

var root = protobuf.parse(personProto).root;
var Person = root.lookupType('.tutorial.Person');

var protoOpts = {
  authentication: t.authOpts.authentication,
  cacheName: 'protoStreamCache',
  dataFormat: {
    keyType: 'application/x-protostream',
    valueType: 'application/x-protostream'
  }
};

/**
 * @param {number} ms Milliseconds to sleep.
 * @returns {Promise} Resolves after the delay.
 */
function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

/**
 * Register the schema, connect a protostream client, run the body, then clean up.
 * @param {Function} body Async function receiving the connected client.
 * @returns {Promise} Resolves when the test is complete.
 */
async function withCQClient(body) {
  var metaClient = await ispn.client(t.local, {
    authentication: t.authOpts.authentication,
    cacheName: '___protobuf_metadata',
    dataFormat: {keyType: 'text/plain', valueType: 'text/plain'}
  });
  try {
    await metaClient.put('tutorial/Person.proto', personProto);
  } finally {
    await metaClient.disconnect();
  }

  var client = await t.client(t.local, protoOpts);
  try {
    client.registerProtostreamRoot(root);
    client.registerProtostreamType('.tutorial.Person', 1000042);
    await client.clear();
    await body(client);
  } finally {
    await client.clear();
    await client.disconnect();
  }

  var cleanup = await ispn.client(t.local, {
    authentication: t.authOpts.authentication,
    cacheName: '___protobuf_metadata',
    dataFormat: {keyType: 'text/plain', valueType: 'text/plain'}
  });
  try {
    await cleanup.remove('tutorial/Person.proto');
  } finally {
    await cleanup.disconnect();
  }
}

describe('Continuous query', function() {

  it('receives joining events for matching entries', async function() {
    await withCQClient(async function(client) {
      var events = [];
      var cq = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = \'London\''
      );
      cq.on('joining', function(key, value) {
        events.push({type: 'joining', key: key, value: value});
      });

      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'London'}));
      await client.put(1, Person.create({firstName: 'Harry', lastName: 'Potter', bornYear: 1980, bornIn: 'Godrics Hollow'}));
      await client.put(2, Person.create({firstName: 'Ron', lastName: 'Weasley', bornYear: 1980, bornIn: 'London'}));
      await sleep(1000);

      expect(events.length).toBe(2);
      events.forEach(function(e) {
        expect(e.type).toBe('joining');
        expect(e.key).toBeDefined();
        expect(e.value).toBeDefined();
      });

      await client.removeContinuousQuery(cq);
    });
  });

  it('receives leaving events when entries no longer match', async function() {
    await withCQClient(async function(client) {
      var joining = [];
      var leaving = [];
      var cq = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = \'London\''
      );
      cq.on('joining', function(key, value) {
        joining.push({key: key, value: value});
      });
      cq.on('leaving', function(key) {
        leaving.push({key: key});
      });

      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'London'}));
      await sleep(500);
      expect(joining.length).toBe(1);

      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'Paris'}));
      await sleep(500);
      expect(leaving.length).toBe(1);

      await client.removeContinuousQuery(cq);
    });
  });

  it('receives no events after removal', async function() {
    await withCQClient(async function(client) {
      var events = [];
      var cq = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = \'London\''
      );
      cq.on('joining', function() {
        events.push('joining');
      });

      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'London'}));
      await sleep(500);
      expect(events.length).toBe(1);

      await client.removeContinuousQuery(cq);

      await client.put(1, Person.create({firstName: 'Ron', lastName: 'Weasley', bornYear: 1980, bornIn: 'London'}));
      await sleep(500);
      expect(events.length).toBe(1);
    });
  });

  it('supports named parameters', async function() {
    await withCQClient(async function(client) {
      var events = [];
      var cq = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = :city',
        {params: {city: 'London'}}
      );
      cq.on('joining', function(key, value) {
        events.push({key: key, value: value});
      });

      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'London'}));
      await client.put(1, Person.create({firstName: 'Harry', lastName: 'Potter', bornYear: 1980, bornIn: 'Godrics Hollow'}));
      await sleep(1000);

      expect(events.length).toBe(1);

      await client.removeContinuousQuery(cq);
    });
  });

  it('can register multiple continuous queries simultaneously', async function() {
    await withCQClient(async function(client) {
      var londonEvents = [];
      var hollowEvents = [];

      var cq1 = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = \'London\''
      );
      cq1.on('joining', function() { londonEvents.push('joining'); });

      var cq2 = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = \'Godrics Hollow\''
      );
      cq2.on('joining', function() { hollowEvents.push('joining'); });

      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'London'}));
      await client.put(1, Person.create({firstName: 'Harry', lastName: 'Potter', bornYear: 1980, bornIn: 'Godrics Hollow'}));
      await client.put(2, Person.create({firstName: 'Ron', lastName: 'Weasley', bornYear: 1980, bornIn: 'London'}));
      await sleep(1000);

      expect(londonEvents.length).toBe(2);
      expect(hollowEvents.length).toBe(1);

      await client.removeContinuousQuery(cq1);
      await client.removeContinuousQuery(cq2);
    });
  });

  it('receives joining events for initial state when entries already exist', async function() {
    await withCQClient(async function(client) {
      await client.put(0, Person.create({firstName: 'Hermione', lastName: 'Granger', bornYear: 1979, bornIn: 'London'}));
      await client.put(1, Person.create({firstName: 'Harry', lastName: 'Potter', bornYear: 1980, bornIn: 'Godrics Hollow'}));

      var events = [];
      var cq = await client.addContinuousQuery(
        'FROM tutorial.Person p WHERE p.bornIn = \'London\''
      );
      cq.on('joining', function(key, value) {
        events.push({key: key, value: value});
      });
      await sleep(1000);

      expect(events.length).toBe(1);

      await client.removeContinuousQuery(cq);
    });
  });
});
