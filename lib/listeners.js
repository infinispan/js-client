'use strict';

(function() {

  var _ = require('underscore');
  var f = require('./functional');
  var u = require('./utils');

  var codec = require('./codec');

  var events = require('events');

  var CQ_FACTORY = 'continuous-query-filter-converter-factory';

  module.exports = listeners;

  /**
   * Creates the listener management subsystem for a protocol instance.
   * @param {Object} protocol Protocol instance with encode/decode methods.
   * @returns {Object} Listener manager with add, remove, find, and dispatch methods.
   */
  function listeners(protocol) {
    var logger = u.logger('listeners');
    var listeners = u.keyValueMap();

    /**
     * Sends a request with a pre-write hook executed before sending.
     * @param {Object} transport Transport instance.
     * @param {Object} ctx Request context.
     * @param {number} op Operation code.
     * @param {Function} body Body encoder function.
     * @param {Function} decoder Response decoder function.
     * @param {Object} opts Operation options.
     * @param {Function} preWrite Hook function called before writing.
     * @returns {Promise} Promise resolved with the decoded response.
     */
    function futurePreWrite(transport, ctx, op, body, decoder, opts, preWrite) {
      f.actions(protocol.stepsHeaderBody(ctx, op, body, opts), codec.bytesEncoded)(ctx);
      return transport.writeCommand(ctx, decoder, preWrite);
    }

    /**
     * Creates a pre-write hook that registers a listener before sending the add request.
     * @param {string} event Event type name.
     * @param {Function} listener Callback function for the event.
     * @param {string} listenerId Listener identifier.
     * @returns {Function} Pre-write hook function accepting a connection.
     */
    function preWriteAddListener(event, listener, listenerId) {
      return function(conn) {
        // Listener needs to be registered in advance since events might come
        // before reply from server to add listener, e.g. when include state
        // is enabled. To avoid leaking listeners, remove listener if there's
        // any problem.
        emitterAddListener(event, listener, listenerId, conn);
      };
    }

    /**
     * Creates a new event emitter and registers it in the listeners map.
     * @param {string} listenerId Listener identifier.
     * @param {Object} conn Connection associated with this listener.
     * @param {string} event Event type name.
     * @param {Function} callback Callback function for the event.
     * @returns {EventEmitter} Newly created event emitter.
     */
    function createEmitter(listenerId, conn, event, callback) {
      var emitter = new events.EventEmitter();
      logger.tracef('Create listener emitter for connection %s and listener with listenerId=%s', conn, listenerId);
      listeners.put(listenerId, {id: listenerId, emitter: emitter, conn: conn, event: event, callback: callback});
      return emitter;
    }

    /**
     * Adds a listener callback to an existing or new emitter for the given listener id.
     * @param {string} event Event type name.
     * @param {Function} callback Callback function for the event.
     * @param {string} listenerId Listener identifier.
     * @param {Object} [conn] Connection associated with this listener.
     * @returns {void}
     */
    function emitterAddListener(event, callback, listenerId, conn) {
      var l = listeners.get(listenerId);
      var emitter = f.existy(l) ? l.emitter : createEmitter(listenerId, conn, event, callback);
      emitter.addListener(event, callback);
    }

    var listen = {
      removeListeners: function(listenerId) {
        var l = listeners.get(listenerId);
        if (f.existy(l)) {
          l.emitter.removeAllListeners();
          listeners.remove(listenerId);
        }
      },
      findConnectionListener: function(listenerId) {
        var l = listeners.get(listenerId);
        return f.existy(l) ? l.conn : undefined;
      },
      addRemoteListener: function (transport, ctx, event, listener, opts) {
        var listenerId = _.uniqueId('listener_');
        logger.debugl(function() {
          return ['Invoke addListener(msgId=%d,event=%s,listenerId=%s,opts=%s) remotely',
                  ctx.id, event, listenerId, JSON.stringify(opts)]; });

        var encodeListenerAddCommon = protocol.encodeListenerAdd(listenerId, opts)();
        var encodeListenerAddInterests = protocol.encodeListenerInterests(opts);
        var encodeListenerAdd = function() {
          return f.cat(encodeListenerAddCommon, encodeListenerAddInterests);
        };

        var remote = futurePreWrite(transport, ctx, 0x25
          , encodeListenerAdd, protocol.complete(protocol.hasSuccess)
          , opts, preWriteAddListener(event, listener, listenerId));

        return remote
          .then(function(success) {
            return success ? listenerId : protocol.removeListeners(listenerId);
          })
          .catch(function() {
            protocol.removeListeners(listenerId);
          });
      },
      addLocalListener: function (ctx, event, listener, opts) {
        logger.debugl(function() {
          return ['Invoke addListener(msgId=%d,event=%s,opts=%s) locally',
                  ctx.id, event, JSON.stringify(opts)]; });

        return new Promise(function (fulfill) {
          emitterAddListener(event, listener, opts.listenerId);
          fulfill(opts.listenerId);
        });
      },
      dispatchEvent: function(event, listenerId, bytebuf, emitFunc) {
        return function() {
          var l = listeners.get(listenerId);
          if (f.existy(l)) {
            var emit = l.cqEmit || emitFunc;
            return emit(event, l.emitter, bytebuf, listenerId);
          }

          logger.error('No emitter exists for listener %s', listenerId);
          return true;
        };
      },
      getListenersAt: function (addr) {
        return _.filter(listeners.values(), function(listener) {
          return _.isEqual(addr, listener.conn.getAddress());
        });
      },
      /**
       * Replaces the protocol instance used by the listener subsystem.
       * @param {Object} newProtocol Replacement protocol instance.
       * @returns {void}
       */
      setProtocol: function(newProtocol) {
        protocol = newProtocol;
      },
      /**
       * Register a continuous query listener.
       * @param {Object} transport Transport instance.
       * @param {Object} ctx Request context.
       * @param {string} queryString Ickle query string.
       * @param {Object} [opts] Options with optional params map.
       * @returns {Promise<Object>} ContinuousQuery handle.
       */
      addContinuousQueryListener: function(transport, ctx, queryString, opts) {
        opts = opts || {};
        var listenerId = _.uniqueId('cq_');
        logger.debugl(function() {
          return ['Invoke addContinuousQueryListener(msgId=%d,query=%s,listenerId=%s)',
                  ctx.id, queryString, listenerId]; });

        var cqParams = buildCQParams(queryString, opts.params);

        var listenerOpts = {
          includeState: true,
          useRawData: true,
          filterFactory: { name: CQ_FACTORY, params: cqParams },
          converterFactory: { name: CQ_FACTORY, params: cqParams }
        };

        var encodeListenerAddCommon = protocol.encodeListenerAdd(listenerId, listenerOpts)();
        var encodeListenerAddInterests = protocol.encodeListenerInterests(listenerOpts);
        var encodeListenerAdd = function() {
          return f.cat(encodeListenerAddCommon, encodeListenerAddInterests);
        };

        var cqEmitFn = function(event, emitter, bytebuf) {
          var payloadLength = codec.decodeVariableBytes()(bytebuf);
          if (!f.existy(payloadLength) || !f.existy(payloadLength.answer))
            return false;
          var payload = payloadLength.answer;
          var wrapped = codec.decodeWrappedMessage(payload);
          if (!f.existy(wrapped) || !f.existy(wrapped.wrappedMessage))
            return true;
          var cqResult = codec.decodeContinuousQueryResult(wrapped.wrappedMessage);
          emitter.emit(cqResult.resultType, cqResult.key, cqResult.value, cqResult.projection);
          return true;
        };

        var preWrite = function(conn) {
          var emitter = new events.EventEmitter();
          listeners.put(listenerId, {
            id: listenerId,
            emitter: emitter,
            conn: conn,
            cqEmit: cqEmitFn
          });
        };

        var remote = futurePreWrite(transport, ctx, 0x25
          , encodeListenerAdd, protocol.complete(protocol.hasSuccess)
          , listenerOpts, preWrite);

        return remote
          .then(function(success) {
            if (success) {
              var l = listeners.get(listenerId);
              var emitter = l.emitter;
              return {
                on: function(event, callback) { emitter.on(event, callback); return this; },
                getListenerId: function() { return listenerId; }
              };
            }
            listen.removeListeners(listenerId);
            return undefined;
          })
          .catch(function() {
            listen.removeListeners(listenerId);
          });
      },
    };

    /**
     * Build CQ factory params from query and named params.
     * @param {string} queryString Ickle query.
     * @param {Object} [params] Named parameter map.
     * @returns {Buffer[]} Array of wrapped param byte arrays.
     */
    function buildCQParams(queryString, params) {
      var result = [codec.wrapScalar(queryString)];
      if (f.existy(params)) {
        _.each(params, function(value, name) {
          result.push(codec.wrapScalar(name));
          result.push(codec.wrapScalar(value));
        });
      }
      return result;
    }

    return listen;
  }

}.call(this));
