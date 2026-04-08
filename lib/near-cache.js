'use strict';

(function() {

  var u = require('./utils');

  module.exports = nearCache;

  /**
   * Creates a near cache with LRU eviction.
   * @param {number} maxEntries Maximum number of entries to store.
   * @returns {Object} Near cache instance with get, put, remove, clear, and size methods.
   */
  function nearCache(maxEntries) {
    var logger = u.logger('near-cache');
    var cache = new Map();

    /**
     * Moves a key to the end of the Map iteration order (most recently used).
     * @param {string} key The cache key to touch.
     * @param {*} value The cached value.
     * @returns {void}
     */
    function touch(key, value) {
      cache.delete(key);
      cache.set(key, value);
    }

    /**
     * Evicts the least recently used entry if the cache exceeds maxEntries.
     * @returns {void}
     */
    function evict() {
      while (cache.size > maxEntries) {
        var oldest = cache.keys().next().value;
        logger.tracef('Near cache evicting key=%s (size=%d, max=%d)', oldest, cache.size, maxEntries);
        cache.delete(oldest);
      }
    }

    return {
      /**
       * Get a value from the near cache.
       * @param {string} key Cache key.
       * @returns {Object|undefined} Cached entry with value (and optionally metadata), or undefined on miss.
       */
      get: function(key) {
        var entry = cache.get(key);
        if (entry !== undefined) {
          touch(key, entry);
          logger.tracef('Near cache hit for key=%s', key);
          return entry;
        }
        logger.tracef('Near cache miss for key=%s', key);
        return undefined;
      },
      /**
       * Put a value into the near cache.
       * @param {string} key Cache key.
       * @param {Object} entry Cached entry object.
       * @returns {void}
       */
      put: function(key, entry) {
        cache.set(key, entry);
        evict();
        logger.tracef('Near cache put key=%s (size=%d)', key, cache.size);
      },
      /**
       * Remove a key from the near cache.
       * @param {string} key Cache key to remove.
       * @returns {boolean} True if the key was present.
       */
      remove: function(key) {
        var removed = cache.delete(key);
        if (removed) {
          logger.tracef('Near cache invalidated key=%s', key);
        }
        return removed;
      },
      /**
       * Clear all entries from the near cache.
       * @returns {void}
       */
      clear: function() {
        var oldSize = cache.size;
        cache.clear();
        logger.tracef('Near cache cleared (%d entries removed)', oldSize);
      },
      /**
       * Get the number of entries in the near cache.
       * @returns {number} Current cache size.
       */
      size: function() {
        return cache.size;
      }
    };
  }

}.call(this));
