/**
 * Infinispan module.
 * @module
 */

'use strict';

(function() {

  var _ = require('underscore');
  var util = require('util');

  var f = require('./functional');
  var codec = require('./codec');
  var u = require('./utils');
  var protocols = require('./protocols');
  var io = require('./io');
  var listeners = require('./listeners');

  var Client = require('./client');

  /**
   * Server topology information.
   *
   * @constructs Topology
   * @since 0.3
   */
  var TopologyInfo = function(transport) {
    return {
      /**
       * Get the server topology identifier.
       *
       * @returns {Number} Topology identifier.
       * @memberof Topology#
       * @since 0.3
       */
      getTopologyId: function() {
        return transport.getTopologyId();
      },
      /**
       * Get the list of servers that the client is currently connected to.
       *
       * @return {ServerAddress[]} An array of server addresses.
       * @memberof Topology#
       * @since 0.3
       */
      getMembers: function() {
        return transport.getMembers();
      },
      /**
       * Find the list of server addresses that are owners for a given key.
       *
       * @param {(String|Object)} k Key to find owners for.
       * @return {ServerAddress[]}
       * An array of server addresses that are owners for the given key.
       * @memberof Topology#
       * @since 0.3
       */
      findOwners: function(k) {
        return transport.findOwners(k);
      },
      /**
       * Switch remote cache manager to a different cluster,
       * previously declared via configuration.
       *
       * @param clusterName name of the cluster to which to switch to
       * @return {module:promise.Promise<Boolean>}
       * A promise encapsulating a Boolean that indicates {@code true} if the
       * switch happened, or {@code false} otherwise.
       * @memberof Topology#
       * @since 0.4
       */
      switchToCluster: function(clusterName) {
        return transport.switchToCluster(clusterName);
      },
      /**
       * Switch remote cache manager to the default cluster,
       * previously declared via configuration.
       *
       * @return {module:promise.Promise<Boolean>}
       * A promise encapsulating a Boolean that indicates {@code true} if the
       * switch happened, or {@code false} otherwise.
       * @memberof Topology#
       * @since 0.4
       */
      switchToDefaultCluster: function() {
        return transport.switchToDefaultCluster();
      }
    }
  };

  /**
   * Server address.
   *
   * @typedef {Object} ServerAddress
   * @property {String} host - Server host name.
   * @property {Number} port - Server port.
   * @since 0.3
   */
  /**
   * Infinispan client constructor taking an optional initial address,
   * or multiple addresses, to which the client will try to connect to,
   * as well as optional configuration settings.
   *
   * @example
   * client({port: 11222, host: 'localhost'})
   *
   * @example
   * client([{port: 11322, host: 'node1'}, {port: 11422, host: 'node2'}])
   *
   * @example
   * client({port: 11522, host: 'myhost'}, {version: '2.2'})
   *
   * @example
   * client([{port: 11522, host: 'myhost'}, {port: 11622, host: 'myhost'}],
   *        {version: '2.2', cacheName: 'myCache'})
   *
   * @param args {(ServerAddress|ServerAddress[])}
   * Optional single or multiple addresses to which to connect. If none
   * provided, the client will connect to localhost:11222 address by default.
   * @param options {module:infinispan.ClientOptions}
   * Optional configuration settings.
   * @returns A promise that will be completed once the connection
   * has been established. The promise will be completed with a client
   * instance on which operations can invoked.
   * @constructs Client
   * @since 0.3
   */
  exports.client = function client(args, options) {
    var merged = f.merge(Client.config, options);
    var c = new Client(u.normalizeAddresses(args), merged);
    return c.connect();
  };

  /**
   * Cluster information.
   *
   * @typedef {Object} Cluster
   * @property {String} name - Cluster name.
   * @property {ServerAddress[]} servers - Cluster servers details.
   * @since 0.3
   */
  /**
   * Client configuration settings. Object instances that override
   * these configuration options can be used on client construction to tweak
   * its behaviour.
   *
   * @static
   * @typedef {Object} ClientOptions
   * @property {?(2.9|2.5|2.2)} [version=2.9] - Version of client/server protocol.
   * @property {?String} cacheName - Optional cache name.
   * @property {?Number} [maxRetries=3] - Optional number of retries for operation.
   * @property {?boolean} [ssl.enabled=false] - Optional flag to enable SSL support.
   * @property {?String} [ssl.secureProtocol=TLSv1_2_method] - Optional field with secure protocol in use.
   * @property {?String[]} ssl.trustCerts - Optional paths of trusted SSL certificates.
   * @property {?String} ssl.clientAuth.key - Optional path to client authentication key.
   * @property {?String} ssl.clientAuth.passphrase - Optional password for client key.
   * @property {?String} ssl.clientAuth.cert - Optional client certificate.
   * @property {?String} ssl.sniHostName - Optional SNI host name.
   * @property {?String} ssl.cryptoStore.path - Optional crypto store path.
   * @property {?String} ssl.cryptoStore.passphrase - Optional password for crypto store.
   * @property {?boolean} authentication.enabled - Enable authentication.
   * @property {?String} authentication.saslMechanism - Select the SASL mechanism to use. Can be one of PLAIN, DIGEST-MD5, SCRAM-SHA-1, SCRAM-SHA-256, SCRAM-SHA-384, SCRAM-SHA-512, EXTERNAL, OAUTHBEARER
   * @property {?String} authentication.userName - The authentication username. Required by the PLAIN, DIGEST and SCRAM mechanisms.
   * @property {?String} authentication.password - The authentication password. Required by the PLAIN, DIGEST and SCRAM mechanisms.
   * @property {?String} authentication.token - The OAuth token. Required by the OAUTHBEARER mechanism.
   * @property {?String} authentication.authzid - The SASL authorization ID.
   * @property {?boolean} [topologyUpdates=true] - Optional flag to controls whether the client deals with topology updates or not.
   * @property {?(text/plain|application/json)} [mediaType=text/plain] - Media type of the cache contents.
   * @property {?Cluster[]} clusters - Optional additional clusters for cross-site failovers.
   * @since 0.3
   */
  Client.config = {
    version: '2.9',         // Hot Rod protocol version
    cacheName: undefined,   // Cache name
    maxRetries: 3,           // Maximum number of retries
    authentication: {
      enabled: false,
      serverName: 'infinispan',
      saslProperties: {},
      saslMechanism: '',
      userName: '',
      password: [],
      realm: 'default',
      token: ''
    },
    ssl: {
      enabled: false,
      secureProtocol: 'TLS_client_method',
      trustCerts: [],
      clientAuth: {
        key: undefined,
        passphrase: undefined,
        cert: undefined
      },
      sniHostName: undefined,
      cryptoStore: {
        path: undefined,
        passphrase: undefined
      }
    },
    dataFormat : {
      keyType: 'text/plain',
      valueType: 'text/plain'
    },
    topologyUpdates: true,
    clusters: []
  };

}.call(this));
