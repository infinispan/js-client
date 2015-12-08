(function() {

  var _ = require('underscore');
  var log4js = require('log4js');

  exports.counter = function(value) {
    return new Counter(value);
  };

  exports.keyValueMap = function() {
    return new KeyValueMap();
  };

  exports.logger = function(name) {
    return new ClientLogger(name);
  };

  var Counter = function(val) {
    var _value = val;

    return {
      incr: function() {
        _value = _value + 1;
        return _value;
      }
    };
  };

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

  var ClientLogger = function(name) {
    var logger = log4js.getLogger(name);

    return {
      debugl: function(fun) {
        if (logger.isDebugEnabled())
          logger.debug.apply(logger, fun());
      },
      debugf: function() { logger.debug.apply(logger, arguments); },
      tracef: function() { logger.trace.apply(logger, arguments); }
    }
  }

}.call(this));
