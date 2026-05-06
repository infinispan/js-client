'use strict';

var uri = require('../lib/uri');

describe('isHotrodURI', function() {
  it('returns true for hotrod:// URIs', function() {
    expect(uri.isHotrodURI('hotrod://localhost')).toBe(true);
    expect(uri.isHotrodURI('hotrod://admin:pass@localhost:11222')).toBe(true);
  });

  it('returns true for hotrods:// URIs', function() {
    expect(uri.isHotrodURI('hotrods://localhost')).toBe(true);
    expect(uri.isHotrodURI('hotrods://admin:pass@localhost:11222')).toBe(true);
  });

  it('returns false for non-URI values', function() {
    expect(uri.isHotrodURI('http://localhost')).toBe(false);
    expect(uri.isHotrodURI({host: 'localhost', port: 11222})).toBe(false);
    expect(uri.isHotrodURI([{host: 'localhost', port: 11222}])).toBe(false);
    expect(uri.isHotrodURI(undefined)).toBe(false);
    expect(uri.isHotrodURI(null)).toBe(false);
    expect(uri.isHotrodURI(42)).toBe(false);
    expect(uri.isHotrodURI('')).toBe(false);
  });
});

describe('parseHotrodURI', function() {

  describe('basic parsing', function() {
    it('parses a simple hotrod URI with default port', function() {
      var result = uri.parseHotrodURI('hotrod://localhost');
      expect(result.servers).toEqual([{host: 'localhost', port: 11222}]);
      expect(result.options.ssl).toBeUndefined();
      expect(result.options.authentication).toBeUndefined();
    });

    it('parses a URI with explicit port', function() {
      var result = uri.parseHotrodURI('hotrod://myhost:9999');
      expect(result.servers).toEqual([{host: 'myhost', port: 9999}]);
    });

    it('enables TLS for hotrods:// scheme', function() {
      var result = uri.parseHotrodURI('hotrods://secure.example.com');
      expect(result.servers).toEqual([{host: 'secure.example.com', port: 11222}]);
      expect(result.options.ssl.enabled).toBe(true);
    });

    it('enables TLS for hotrods:// with port', function() {
      var result = uri.parseHotrodURI('hotrods://secure.example.com:11322');
      expect(result.servers).toEqual([{host: 'secure.example.com', port: 11322}]);
      expect(result.options.ssl.enabled).toBe(true);
    });
  });

  describe('credentials', function() {
    it('parses username and password', function() {
      var result = uri.parseHotrodURI('hotrod://admin:secret@localhost:11222');
      expect(result.servers).toEqual([{host: 'localhost', port: 11222}]);
      expect(result.options.authentication.enabled).toBe(true);
      expect(result.options.authentication.userName).toBe('admin');
      expect(result.options.authentication.password).toBe('secret');
      expect(result.options.authentication.saslMechanism).toBe('PLAIN');
    });

    it('parses username without password', function() {
      var result = uri.parseHotrodURI('hotrod://admin@localhost');
      expect(result.options.authentication.enabled).toBe(true);
      expect(result.options.authentication.userName).toBe('admin');
      expect(result.options.authentication.password).toBeUndefined();
    });

    it('decodes URL-encoded credentials', function() {
      var result = uri.parseHotrodURI('hotrod://user%40domain:p%40ss%3Aword@localhost');
      expect(result.options.authentication.userName).toBe('user@domain');
      expect(result.options.authentication.password).toBe('p@ss:word');
    });

    it('handles password containing @', function() {
      var result = uri.parseHotrodURI('hotrod://admin:p%40ssword@localhost:11222');
      expect(result.options.authentication.userName).toBe('admin');
      expect(result.options.authentication.password).toBe('p@ssword');
      expect(result.servers).toEqual([{host: 'localhost', port: 11222}]);
    });
  });

  describe('multi-host', function() {
    it('parses multiple hosts', function() {
      var result = uri.parseHotrodURI('hotrod://host1:11222,host2:11322');
      expect(result.servers).toEqual([
        {host: 'host1', port: 11222},
        {host: 'host2', port: 11322}
      ]);
    });

    it('parses multiple hosts with default ports', function() {
      var result = uri.parseHotrodURI('hotrod://host1,host2,host3');
      expect(result.servers).toEqual([
        {host: 'host1', port: 11222},
        {host: 'host2', port: 11222},
        {host: 'host3', port: 11222}
      ]);
    });

    it('parses multiple hosts with credentials', function() {
      var result = uri.parseHotrodURI('hotrod://admin:pass@h1:11222,h2:11322,h3');
      expect(result.servers.length).toBe(3);
      expect(result.servers[0]).toEqual({host: 'h1', port: 11222});
      expect(result.servers[1]).toEqual({host: 'h2', port: 11322});
      expect(result.servers[2]).toEqual({host: 'h3', port: 11222});
      expect(result.options.authentication.userName).toBe('admin');
    });

    it('skips empty host segments from trailing comma', function() {
      var result = uri.parseHotrodURI('hotrod://host1:11222,');
      expect(result.servers).toEqual([{host: 'host1', port: 11222}]);
    });
  });

  describe('IPv6', function() {
    it('parses IPv6 address with port', function() {
      var result = uri.parseHotrodURI('hotrod://[::1]:11222');
      expect(result.servers).toEqual([{host: '::1', port: 11222}]);
    });

    it('parses IPv6 address without port', function() {
      var result = uri.parseHotrodURI('hotrod://[::1]');
      expect(result.servers).toEqual([{host: '::1', port: 11222}]);
    });

    it('parses IPv6 with credentials', function() {
      var result = uri.parseHotrodURI('hotrod://admin:pass@[::1]:9999');
      expect(result.servers).toEqual([{host: '::1', port: 9999}]);
      expect(result.options.authentication.userName).toBe('admin');
    });
  });

  describe('query parameters', function() {
    it('parses sasl_mechanism', function() {
      var result = uri.parseHotrodURI('hotrod://admin:pass@localhost?sasl_mechanism=SCRAM-SHA-256');
      expect(result.options.authentication.saslMechanism).toBe('SCRAM-SHA-256');
    });

    it('parses max_retries', function() {
      var result = uri.parseHotrodURI('hotrod://localhost?max_retries=5');
      expect(result.options.maxRetries).toBe(5);
    });

    it('parses cache_name', function() {
      var result = uri.parseHotrodURI('hotrod://localhost?cache_name=myCache');
      expect(result.options.cacheName).toBe('myCache');
    });

    it('parses trust_store_file_name', function() {
      var result = uri.parseHotrodURI('hotrods://localhost?trust_store_file_name=/path/to/ca.pem');
      expect(result.options.ssl.trustCerts).toEqual(['/path/to/ca.pem']);
    });

    it('parses trust_ca alias', function() {
      var result = uri.parseHotrodURI('hotrods://localhost?trust_ca=/path/to/ca.pem');
      expect(result.options.ssl.trustCerts).toEqual(['/path/to/ca.pem']);
    });

    it('parses client_cert and client_key', function() {
      var result = uri.parseHotrodURI('hotrods://localhost?client_cert=/cert.pem&client_key=/key.pem');
      expect(result.options.ssl.clientAuth.cert).toBe('/cert.pem');
      expect(result.options.ssl.clientAuth.key).toBe('/key.pem');
    });

    it('parses key_store_file_name and key_store_password aliases', function() {
      var result = uri.parseHotrodURI('hotrods://localhost?key_store_file_name=/cert.pem&key_store_password=/key.pem');
      expect(result.options.ssl.clientAuth.cert).toBe('/cert.pem');
      expect(result.options.ssl.clientAuth.key).toBe('/key.pem');
    });

    it('parses sni_host_name', function() {
      var result = uri.parseHotrodURI('hotrods://localhost?sni_host_name=myserver');
      expect(result.options.ssl.sniHostName).toBe('myserver');
    });

    it('parses sni_host alias', function() {
      var result = uri.parseHotrodURI('hotrods://localhost?sni_host=myserver');
      expect(result.options.ssl.sniHostName).toBe('myserver');
    });

    it('parses multiple parameters', function() {
      var result = uri.parseHotrodURI(
        'hotrod://admin:pass@localhost:11222?sasl_mechanism=SCRAM-SHA-256&max_retries=10&cache_name=test'
      );
      expect(result.options.authentication.saslMechanism).toBe('SCRAM-SHA-256');
      expect(result.options.maxRetries).toBe(10);
      expect(result.options.cacheName).toBe('test');
    });

    it('combines TLS scheme with query params', function() {
      var result = uri.parseHotrodURI(
        'hotrods://admin:pass@localhost?trust_ca=/ca.pem&sni_host=myhost'
      );
      expect(result.options.ssl.enabled).toBe(true);
      expect(result.options.ssl.trustCerts).toEqual(['/ca.pem']);
      expect(result.options.ssl.sniHostName).toBe('myhost');
      expect(result.options.authentication.enabled).toBe(true);
    });
  });

  describe('error cases', function() {
    it('throws on invalid scheme', function() {
      expect(function() { uri.parseHotrodURI('http://localhost'); })
        .toThrowError(/Invalid URI scheme/);
    });

    it('throws on empty host', function() {
      expect(function() { uri.parseHotrodURI('hotrod://'); })
        .toThrowError(/No host specified/);
    });

    it('throws on unknown query parameter', function() {
      expect(function() { uri.parseHotrodURI('hotrod://localhost?bogus=1'); })
        .toThrowError(/Unknown URI parameter: bogus/);
    });

    it('throws on invalid integer parameter', function() {
      expect(function() { uri.parseHotrodURI('hotrod://localhost?max_retries=abc'); })
        .toThrowError(/Invalid integer value for max_retries/);
    });

    it('throws on invalid port', function() {
      expect(function() { uri.parseHotrodURI('hotrod://localhost:abc'); })
        .toThrowError(/Invalid port/);
    });

    it('throws on unclosed IPv6 bracket', function() {
      expect(function() { uri.parseHotrodURI('hotrod://[::1'); })
        .toThrowError(/missing closing bracket/);
    });
  });
});
