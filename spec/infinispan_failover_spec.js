var Promise = require('promise');

var exec = Promise.denodeify(require('child_process').exec);

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var u = require('../lib/utils');
var tests = require('./tests'); // Shared tests

var logger = u.logger('failover_spec');

describe('Infinispan cluster client', function() {

  // Since Jasmine 1.3 does not have beforeAll callback and stats resets is a
  // bit slow, execute it as first test so that it only gets executed once.
  it('cleanup', function(done) {
    var rm4 = exec('rm -drf /tmp/node4');
    var rm5 = exec('rm -drf /tmp/node5');
    var rm6 = exec('rm -drf /tmp/node6');
    Promise.all([rm4, rm5, rm6]).catch(t.failed(done)).finally(done);
  });

  it('can failover when nodes crash', function(done) {
    var cluster4 = {port: 11622, host: '127.0.0.1'};
    var cluster5 = {port: 11722, host: '127.0.0.1'};
    var cluster6 = {port: 11822, host: '127.0.0.1'};

    launchClusterNode('node4', 400);
    launchClusterNode('node5', 500);
    launchClusterNode('node6', 600);

    setTimeout(function() {
      t.getClusterMembers(10590)
        .then(function(ms) { t.toContainAll(['node4', 'node5', 'node6'])(ms); })
        .then(function() { return t.client(cluster4); })
        .then(t.assert(t.getMembers(), t.toContain([cluster4, cluster5, cluster6])))
        .then(keyGen([cluster4, cluster5])) // force key ownership
        .then(withDynKey(dynKeyPut('failover-value')))
        .then(withDynKey(dynKeyGet(t.toBe('failover-value'))))
        .then(killClusterNode('node4'))
        .then(withDynKey(dynKeyGet(t.toBe('failover-value'))))
        .then(killClusterNode('node5'))
        .then(withDynKey(dynKeyGet(t.toBeUndefined)))
        .then(killClusterNode('node6'))
        .then(withDynKey(dynKeyGetFail))
        .catch(t.failed(done)).finally(done);
    }, 12000);

  }, 40000);

});

function keyGen(addrs) {
  return function(cl) { return [cl, t.findKeyForServers(cl, addrs)]; }
}

function withDynKey(fun) {
  return function(params) {
    return fun(params).then(function() { return params; })
  }
}

function dynKeyPut(value) {
  return function(params) { return params[0].put(params[1], value) }
}

function dynKeyGet(expectFun) {
  return function(params) {
    return params[0].get(params[1]).then(function(v) { expectFun(v); })
  }
}

function dynKeyGetFail(params) {
  return params[0].get(params[1])
    .then(function() { throw new Error('Expected the operation to fail'); })
    .catch(function(error) {
      expect(error).toBe('No connections left to try');
    })
}

function launchClusterNode(nodeName, offset) {
  var createClusterNode = exec('cp -r /opt/infinispan-server /tmp/' + nodeName);

  createClusterNode.then(function() {
    logger.debugf("Cluster node created");
    var util  = require('util');
    var spawn = require('child_process').spawn;
    var standaloneShPath = '/tmp/' + nodeName + '/bin/standalone.sh';
    var cmd = spawn(
        standaloneShPath,
        ['-c', 'clustered.xml',
         '-Djboss.default.multicast.address=234.100.54.14',
         '-Djboss.node.name=' + nodeName,
         '-Djboss.socket.binding.port-offset=' + offset,
         '-Djgroups.join_timeout=1000'
        ]);

    cmd.stderr.on('data', function (data) {
      logger.debugf('Stderr [%s]: %s', nodeName, data);
    });

    cmd.on('exit', function (code) {
      logger.debugf('Child process exited with code %d', code);
    });
  });
}

function killClusterNode(nodeName) {
  return function(client) {
    logger.debugf('Kill node: %s', nodeName);
    return exec("pkill -9 -f '.*java.*" + nodeName + " .*'")
      .then(function() { return client; });
  }
}
