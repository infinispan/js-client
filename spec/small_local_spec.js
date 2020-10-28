var _ = require('underscore');

var f = require('../lib/functional');
var t = require('./utils/testing'); // Testing dependency
var tests = require('./tests'); // Shared tests

describe('Infinispan Small Test client', function() {
  var client = t.client(t.local, t.authLocalOpts);

  it('size', function(done) { client
    .then(t.assert(t.size(), t.toBe(0)))
    .catch(t.failed(done))
    .finally(done);
  });
});
