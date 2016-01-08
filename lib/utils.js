(function() {

  var _ = require('underscore');
  var log4js = require('log4js');

  exports.counter = function(value) { return new Counter(value); };
  exports.keyValueMap = function() { return new KeyValueMap(); };
  exports.logger = function(name) { return new ClientLogger(name); };
  exports.replayableBuffer = function() { return new ReplayableBuffer(); };

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
      tracef: function() { logger.trace.apply(logger, arguments); },
      error: function() { logger.error.apply(logger, arguments); }
    }
  }

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
      trim: function() {
        if (buf.length >= offset) {
          buf = buf.slice(offset);
          offset = 0;
        }
      },
      isEmpty: function() {
        return buf.length == offset;
      },
      mark: function() {
        mark = offset;
      },
      rewind: function() {
        offset = mark;
      },

      asBuffer: function() {
        var b = new Buffer(buf.length);
        buf.copy(b);
        return b;
      },

      asByteBuf: function() { // TODO: Temporary function
        return {buf: buf, offset: offset};
      },
      fromByteBuf: function(bytebuf) { // TODO: Temporary function
        buf = bytebuf.buf;
        offset = bytebuf.offset;
      }
    }
  }

}.call(this));
