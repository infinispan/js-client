(function() {

  var _ = require('underscore');

  exports.counter = counter;
  exports.keyValueMap = keyValueMap;

  function counter(value) {
    return new Counter(value);
  }

  var Counter = function(val) {
    var _value = val;

    return {
      incr: function() {
        _value = _value + 1;
        return _value;
      }
    };
  };

  function keyValueMap() {
    return new KeyValueMap();
  }

  var KeyValueMap = function() {
    var _map = Object.create(null);

    return {
      put: function(k, v) {
        _map[k] = v;
      },
      get: function(k) { // TODO: Return an Option or similar?
        return _map[k];
      },
      remove: function(k) {
        delete _map[k];
      }
    };
  }

}.call(this));