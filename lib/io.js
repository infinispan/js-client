'use strict';

(function() {

  var _ = require('underscore');
  var net = require('net');
  var Promise = require('promise');

  var u = require('./utils');

  exports.router = function(addrs, protocol) {
    return new Router(addrs, protocol);
  };

  var Connection = function(host, port, protocol, rpcMap) {
    var logger = u.logger('connection');
    var sock = new net.Socket();
    var replayable = u.replayableBuffer();

    function onConnect(fulfill, conn) {
      return function() {
        logger.debugf('Connected to %s:%d', host, port);
        fulfill(conn);
      }
    }

    function onError(reject) {
      return function(err) {
        logger.error('Error from %s:%d: %s', host, port, err.message);
        reject(err);
      }
    }

    function onEnd() {
      logger.debugf('Disconnected from %s:%d', host, port);
    }

    function onData(data) {
      replayable.append(data);
      var canDecodeMore = true;
      while (!replayable.isEmpty() && canDecodeMore) {
        var bytebuf = replayable.mark();
        var header = protocol.decodeHeader(bytebuf);
        var isEvent = protocol.isEvent(header);
        canDecodeMore = isEvent
            ? protocol.decodeEvent(header, bytebuf)
            : protocol.decodeBody(rpcMap.find(header.msgId), header, bytebuf);

        if (!canDecodeMore) {
          logger.tracef("Incomplete response or event, rewind buffer and wait more data");
          replayable.rewind();
        } else {
          logger.tracef("After decoding request(msgId=%d), buffer size is %d, and offset %d",
                        header.msgId, bytebuf.buf.length, bytebuf.offset);
          replayable.trim(bytebuf);
          if (!isEvent)
            rpcMap.remove(header.msgId);
        }
      }
    }

    return {
      connect: function() {
        var conn = this;
        return new Promise(function (fulfill, reject) {
          logger.debugf('Connecting to %s:%d', host, port);
          sock.connect(port, host, onConnect(fulfill, conn));
          sock.on('error', onError(reject));
          sock.on('end', onEnd);
          sock.on('data', onData);
        });
      },
      disconnect: function() {
        return new Promise(function (fulfill, reject) {
          sock.end();
          fulfill();
        });
      },
      write: function(buffer) {
        sock.write(buffer);
      }
    };
  };

  var RpcMap = function() {
    var promiseMap = u.keyValueMap();

    return {
      put: function(id, value) {
        promiseMap.put(id, value);
      },
      find: function(id) {
        return promiseMap.get(id);
      },
      remove: function(id) {
        promiseMap.remove(id);
      }
    }
  };

  var Router = function(addrs, protocol) {
    var logger = u.logger('router');
    var rpcMap = new RpcMap();
    var conns = [];

    return {
      connect: function() {
        // Convert to lazy connections
        var lazyConns = _.map(addrs, function(addr) {
          return function() {
            var conn = new Connection(addr.host, addr.port, protocol, rpcMap);
            return conn.connect();
          }
        });

        // Fold over the lazy connections, only triggering connections if failure
        return _.foldl(lazyConns, function(state, f) {
          return state
            .catch(function(error) { return f(); } ) // if fails, try next
            .then(function(conn) { conns.push(conn); })
        }, Promise.reject(new Error()));
      },
      disconnect: function() {
        return conns[0].disconnect();
      },
      write: function(id, buffer, decoder) {
        return new Promise(function (fulfill, reject) {
          logger.tracef('Write buffer(msgId=%d)', id);
          conns[0].write(buffer);
          rpcMap.put(id, {success: fulfill, fail: reject, decoder: decoder});
        });
      }
    };
  }

}.call(this));
