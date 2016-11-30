var _ = require('underscore');

var Promise = require('promise');

var exec = Promise.denodeify(require('child_process').exec);
var util = require('util');

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var u = require('../lib/utils');
var tests = require('./tests'); // Shared tests

var logger = u.logger('xsite_spec');

describe('Infinispan xsite cluster client', function() {

  // Since Jasmine 1.3 does not have beforeAll callback and stats resets is a
  // bit slow, execute it as first test so that it only gets executed once.
  it('cleanup', function(done) {
    var rmA = exec('rm -drf /tmp/site-a');
    var rmB = exec('rm -drf /tmp/site-b');
    Promise.all([rmA, rmB]).catch(t.failed(done)).finally(done);
  });

  it('can manually switch and fail over sites', function(done) {
    copyAndLaunchSite('site-a', 300, '234.110.54.14');
    copyAndLaunchSite('site-b', 310, '234.120.54.14');

    setTimeout(function() {
      siteClients()
        .then(function(cs) {
          expect(cs[0].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11522}]);
          expect(cs[1].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11532}]);
          return cs[0].getTopologyInfo().switchToCluster('site-b')
            .then(function() {
              expect(cs[0].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11532}]);
              return cs[0].getTopologyInfo().switchToDefaultCluster();
            })
            .then(function() {
              expect(cs[0].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11522}]);
              return cs[0].put('xsite-key', 'xsite-value');
            })
            .then(assertGet('xsite-key', 'xsite-value', cs[0]))
            .then(assertGet('xsite-key', 'xsite-value', cs[1]))
            .then(killClusterNode('node-site-a'))
            // Client connected to surviving site should find data
            .then(assertGet('xsite-key', 'xsite-value', cs[1]))
            // Client connected to crashed site should failover
            .then(assertGet('xsite-key', 'xsite-value', cs[0]))
            .then(function() {
              expect(cs[0].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11532}]);
              expect(cs[1].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11532}]);
            })
            .then(function() {
              return new Promise(function (fulfill, reject) {
                launchSite('site-a', 300, '234.110.54.14');
                setTimeout(function() {
                  fulfill();
                }, 10000)
              });
            })
            .then(killClusterNode('node-site-b'))
            .then(assertGet('xsite-key', undefined, cs[0]))
            .then(function() {
              expect(cs[0].getTopologyInfo().getMembers()).toEqual([{host: '127.0.0.1', port: 11522}]);
            })
            .then(function() {
              return cs[0].put('xsite-key-2', 'xsite-value-2');
            })
            .then(assertGet('xsite-key-2', 'xsite-value-2', cs[0]))
            .finally(function() {
              return Promise.all(_.map(cs, function(c) { return c.disconnect(); }));
            })
        })
        .catch(t.failed(done))
        .finally(function() { killAll().finally(done); });
    }, 12000);

  }, 40000);

});

function assertGet(k, expected, client) {
  return function() {
    return client.get(k)
      .then(function(v) {
        expect(v).toBe(expected);
      })
  }
}

function siteA() { return {port: 11522, host: '127.0.0.1'}; }
function siteB() { return {port: 11532, host: '127.0.0.1'}; }

function clusterSiteB() {
  return {
    clusters: [
      {
        name: 'site-b',
        servers: [{port: 11532, host: '127.0.0.1'}]
      }
    ]
  };
}

function siteClients() {
  return Promise.all([t.client(siteA(), clusterSiteB()), t.client(siteB())]);
}

function copyAndLaunchSite(siteName, offset, mcast) {
  var createSite = exec(util.format(
    'cp -r /opt/infinispan-server /tmp/%s', siteName
  ));

  var copySiteCfg = createSite.then(function() {
    return exec(util.format(
      'cp -r spec/configs/%s.xml /tmp/%s/standalone/configuration/%s.xml',
      siteName, siteName, siteName
    ));
  });

  copySiteCfg.then(function() {
    launchSite(siteName, offset, mcast);
  });
}

function launchSite(siteName, offset, mcast) {
  logger.tracef("Site created");
  var spawn = require('child_process').spawn;
  var standaloneShPath = util.format('/tmp/%s/bin/standalone.sh', siteName);
  var cmd = spawn(
    standaloneShPath,
    ['-c',
     util.format('%s.xml', siteName),
     util.format('-Djboss.default.multicast.address=%s', mcast),
     util.format('-Djboss.node.name=node-%s', siteName),
     util.format('-Djboss.socket.binding.port-offset=%s', offset),
     '-Djgroups.join_timeout=1000'
    ]);

  cmd.stderr.on('data', function (data) {
    logger.debugf('Stderr [%s]: %s', siteName, data);
  });

  cmd.on('exit', function (code) {
    logger.debugf('Child process exited with code %d', code);
  });
}

function killClusterNode(nodeName) {
  return function() {
    logger.debugf('Kill node: %s', nodeName);
    return exec("pkill -9 -f '.*java.*" + nodeName + " .*'")
  }
}

function killAll() {
  logger.debugf('Kill site-a');
  return exec("pkill -9 -f '.*java.*node-site-a .*'")
    .finally(function() {
      logger.debugf('Kill site-b');
      return exec("pkill -9 -f '.*java.*node-site-b .*'");
    });
}
