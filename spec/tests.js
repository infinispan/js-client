var t = require('./utils/testing'); // Testing dependency

exports.execPutGet = function(prefix, client) {
  return function(done) {
    var scriptName = prefix + '-typed-put-get.js';
    var params = {k: prefix + '-typed-key', v: prefix + '-typed-value'};
    client
      .then(t.loadAndExec('spec/utils/typed-put-get.js', scriptName))
      .then(t.assert(t.exec(scriptName, params), t.toBe(prefix + '-typed-value')))
      .catch(t.failed(done)).finally(done);
  }
};
