'use strict';

(function() {

  var net = require('net');
  var Promise = require('promise');

  var u = require('./utils');

  exports.router = function(host, port, protocol) {
    return new Router(host, port, protocol);
  };

  var Connection = function(host, port, protocol, rpcMap) {
    var logger = u.logger('connection');
    var sock = new net.Socket();
    var replayable = u.replayableBuffer();

    function onConnect(fulfill, client) {
      return function() {
        logger.debugf('Connect to %s:%d', host, port);
        fulfill(client);
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
      connect: function(client) {
        return new Promise(function (fulfill, reject) {
          sock.connect(port, host, onConnect(fulfill, client));
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

  // TODO: Receive list of servers instead
  var Router = function(host, port, protocol) {
    var logger = u.logger('router');

    // TODO: Move to multi-connections
    var rpcMap = new RpcMap();
    var conn = new Connection(host, port, protocol, rpcMap);

    return {
      connect: function(client) {
        return conn.connect(client);
      },
      disconnect: function() {
        return conn.disconnect();
      },
      write: function(id, buffer, decoder) {
        return new Promise(function (fulfill, reject) {
          logger.tracef('Write buffer(msgId=%d)', id);
          conn.write(buffer);
          rpcMap.put(id, {success: fulfill, fail: reject, decoder: decoder});
        });
      }
    };
  }

}.call(this));
