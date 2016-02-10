(function() {

  var _ = require('underscore');
  var log4js = require('log4js');

  var f = require('./functional');

  exports.keyValueMap = function() { return new KeyValueMap(); };
  exports.logger = function(name) { return new ClientLogger(name); };
  exports.replayableBuffer = function() { return new ReplayableBuffer(); };
  exports.str = str;
  exports.normalizeAddresses = normalizeAddresses;

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
  };

  var ClientLogger = function(name) {
    var logger = log4js.getLogger(name);

    return {
      debugl: function(fun) {
        if (logger.isDebugEnabled())
          logger.debug.apply(logger, fun());
      },
      debugf: function() { logger.debug.apply(logger, arguments); },
      tracef: function() { logger.trace.apply(logger, arguments); },
      tracel: function(fun) {
        if (logger.isTraceEnabled())
          logger.trace.apply(logger, fun());
      },
      error: function() { logger.error.apply(logger, arguments); }
    }
  };

  var ReplayableBuffer = function() {
    var buf = new Buffer(0);
    var offset = 0;
    var mark = 0;

    return {
      append: function(data) {
        var b = new Buffer(buf.length + data.length);
        buf.copy(b, 0, 0, buf.length);
        data.copy(b, buf.length);
        buf = b;
      },
      trim: function(bytebuf) {
        buf = bytebuf.buf;
        offset = bytebuf.offset;
        if (buf.length >= offset) {
          buf = buf.slice(offset);
          offset = 0;
        }
      },
      isEmpty: function() {
        return buf.length == offset;
      },
      // Returns a byte buffer version
      mark: function() {
        mark = offset;
        return {buf: buf, offset: offset};
      },
      rewind: function() {
        offset = mark;
      },

      asBuffer: function() {
        var b = new Buffer(buf.length);
        buf.copy(b);
        return b;
      }
    }
  };

  var polyToString = f.dispatch(
      function(s) { return !f.existy(s) ? 'undefined' : undefined },
      function(s) { return _.isString(s) ? (s.length > 1024 ? s.substring(0, 1024) + '...' : s) : undefined},
      function(s) { return _.isArray(s) ? stringifyArray(s) : undefined },
      function(s) { return _.isObject(s) ? JSON.stringify(s) : undefined },
      function(s) { return s.toString() });

  function str(o) {
    return polyToString(o);
  }

  function stringifyArray(ary) {
    return ["[", _.map(ary, polyToString).join(","), "]"].join('');
  }

  function normalizeAddresses(args) {
    var normalizer = f.dispatch(
        function(xs) { return _.isArray(xs) ? xs : undefined },
        function(x) { return _.isObject(x) ? [x] : undefined },
        function(x) {
          if (f.existy(x)) throw new Error('Unknown server addresses: ' + x);
          return [{port: 11222, host: '127.0.0.1'}]
        });
    return normalizer(args);
  }

}.call(this));
