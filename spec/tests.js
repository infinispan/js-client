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

exports.iterateEntries = function(prefix, client) {
  return function(done) {
    var pairs = [
      {key: prefix + '-it1', value: 'v1', done: false},
      {key: prefix + '-it2', value: 'v2', done: false},
      {key: prefix + '-it3', value: 'v3', done: false}];
    client
      .then(t.assert(t.putAll(pairs), t.toBeUndefined))
      .then(t.parIterator(1, pairs)) // Iterate all data, 1 element at time, parallel
      .then(t.seqIterator(3, pairs)) // Iterate all data, 3 elements at time, sequential
      .catch(t.failed(done))
      .finally(done);
  }
};
