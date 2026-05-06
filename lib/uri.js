'use strict';

(function() {

  var _ = require('underscore');

  var DEFAULT_PORT = 11222;

  var QUERY_PARAMS = {
    'sasl_mechanism':         { path: ['authentication', 'saslMechanism'], type: 'string' },
    'trust_store_file_name':  { path: ['ssl', 'trustCerts'], type: 'string_array' },
    'trust_ca':               { path: ['ssl', 'trustCerts'], type: 'string_array' },
    'key_store_file_name':    { path: ['ssl', 'clientAuth', 'cert'], type: 'string' },
    'client_cert':            { path: ['ssl', 'clientAuth', 'cert'], type: 'string' },
    'key_store_password':     { path: ['ssl', 'clientAuth', 'key'], type: 'string' },
    'client_key':             { path: ['ssl', 'clientAuth', 'key'], type: 'string' },
    'sni_host_name':          { path: ['ssl', 'sniHostName'], type: 'string' },
    'sni_host':               { path: ['ssl', 'sniHostName'], type: 'string' },
    'max_retries':            { path: ['maxRetries'], type: 'int' },
    'cache_name':             { path: ['cacheName'], type: 'string' }
  };

  /**
   * Checks whether the argument is a Hot Rod URI string.
   * @param {*} arg Value to check.
   * @returns {boolean} True if the argument is a hotrod:// or hotrods:// URI.
   */
  function isHotrodURI(arg) {
    return _.isString(arg) &&
      (arg.indexOf('hotrod://') === 0 || arg.indexOf('hotrods://') === 0);
  }

  /**
   * Splits a host string into host and port, handling IPv6 bracket notation.
   * @param {string} hostStr Host string like "host:port" or "[::1]:port".
   * @returns {{host: string, port: number}} Parsed host and port.
   */
  function splitHostPort(hostStr) {
    hostStr = hostStr.trim();
    if (hostStr.length === 0) {
      throw new Error('Empty host in URI');
    }

    // IPv6 bracket notation: [::1]:port
    if (hostStr.charAt(0) === '[') {
      var closeBracket = hostStr.indexOf(']');
      if (closeBracket === -1) {
        throw new Error(`Invalid IPv6 address, missing closing bracket: ${hostStr}`);
      }
      var ipv6Host = hostStr.substring(1, closeBracket);
      var afterBracket = hostStr.substring(closeBracket + 1);
      if (afterBracket.length === 0) {
        return { host: ipv6Host, port: DEFAULT_PORT };
      }
      if (afterBracket.charAt(0) === ':') {
        var ipv6Port = parseInt(afterBracket.substring(1), 10);
        if (isNaN(ipv6Port)) {
          throw new Error(`Invalid port in URI: ${afterBracket.substring(1)}`);
        }
        return { host: ipv6Host, port: ipv6Port };
      }
      throw new Error(`Invalid IPv6 host format: ${hostStr}`);
    }

    var lastColon = hostStr.lastIndexOf(':');
    if (lastColon === -1) {
      return { host: hostStr, port: DEFAULT_PORT };
    }

    var host = hostStr.substring(0, lastColon);
    var portStr = hostStr.substring(lastColon + 1);
    var port = parseInt(portStr, 10);
    if (isNaN(port)) {
      throw new Error(`Invalid port in URI: ${portStr}`);
    }
    return { host: host, port: port };
  }

  /**
   * Sets a nested value in an object given a path array.
   * @param {Object} obj Target object.
   * @param {string[]} path Array of keys.
   * @param {*} value Value to set.
   * @returns {void}
   */
  function setNested(obj, path, value) {
    var current = obj;
    for (var i = 0; i < path.length - 1; i++) {
      if (!current[path[i]] || !_.isObject(current[path[i]])) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  /**
   * Parses a Hot Rod URI string into servers and options.
   * @param {string} uriString URI in the format hotrod://[user:pass@]host1[:port1][,host2[:port2]][?params].
   * @returns {{servers: Array<{host: string, port: number}>, options: Object}} Parsed result.
   */
  function parseHotrodURI(uriString) {
    var tls = false;
    var rest;

    if (uriString.indexOf('hotrods://') === 0) {
      tls = true;
      rest = uriString.substring('hotrods://'.length);
    } else if (uriString.indexOf('hotrod://') === 0) {
      rest = uriString.substring('hotrod://'.length);
    } else {
      throw new Error('Invalid URI scheme, expected hotrod:// or hotrods://');
    }

    // Split authority from query string
    var queryString = '';
    var qIndex = rest.indexOf('?');
    var authority;
    if (qIndex !== -1) {
      authority = rest.substring(0, qIndex);
      queryString = rest.substring(qIndex + 1);
    } else {
      authority = rest;
    }

    // Split userinfo from hosts (find last @ to handle passwords with @)
    var userName, password;
    var atIndex = authority.lastIndexOf('@');
    var hostsStr;
    if (atIndex !== -1) {
      var userinfo = authority.substring(0, atIndex);
      hostsStr = authority.substring(atIndex + 1);
      var colonIndex = userinfo.indexOf(':');
      if (colonIndex !== -1) {
        userName = decodeURIComponent(userinfo.substring(0, colonIndex));
        password = decodeURIComponent(userinfo.substring(colonIndex + 1));
      } else {
        userName = decodeURIComponent(userinfo);
      }
    } else {
      hostsStr = authority;
    }

    if (hostsStr.length === 0) {
      throw new Error('No host specified in URI');
    }

    // Parse comma-separated hosts
    var hostParts = hostsStr.split(',');
    var servers = [];
    for (var i = 0; i < hostParts.length; i++) {
      if (hostParts[i].length > 0) {
        servers.push(splitHostPort(hostParts[i]));
      }
    }
    if (servers.length === 0) {
      throw new Error('No host specified in URI');
    }

    // Build options from URI components
    var options = {};

    if (tls) {
      setNested(options, ['ssl', 'enabled'], true);
    }

    if (userName !== undefined) {
      setNested(options, ['authentication', 'enabled'], true);
      setNested(options, ['authentication', 'userName'], userName);
      if (password !== undefined) {
        setNested(options, ['authentication', 'password'], password);
      }
      setNested(options, ['authentication', 'saslMechanism'], 'PLAIN');
    }

    // Parse query parameters
    if (queryString.length > 0) {
      var params = new URLSearchParams(queryString);
      params.forEach(function(value, key) {
        var mapping = QUERY_PARAMS[key];
        if (!mapping) {
          throw new Error(`Unknown URI parameter: ${key}`);
        }

        var parsed;
        if (mapping.type === 'int') {
          parsed = parseInt(value, 10);
          if (isNaN(parsed)) {
            throw new Error(`Invalid integer value for ${key}: ${value}`);
          }
        } else if (mapping.type === 'string_array') {
          parsed = [value];
        } else {
          parsed = value;
        }
        setNested(options, mapping.path, parsed);
      });
    }

    return { servers: servers, options: options };
  }

  exports.isHotrodURI = isHotrodURI;
  exports.parseHotrodURI = parseHotrodURI;

}.call(this));
