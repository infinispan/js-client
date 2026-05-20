'use strict';

(function() {

  var crypto = require('crypto');

  var FORMAT_ID = 0x48525458;
  var NOT_READ = 0x1, NON_EXISTING = 0x2, REMOVE_OP = 0x4;
  var XA_OK = 0, XA_RDONLY = 3;

  function generateXid() {
    return {
      formatId: FORMAT_ID,
      globalTxId: crypto.randomBytes(16),
      branchQualifier: crypto.randomBytes(16)
    };
  }

  function TransactionContext() {
    this.xid = generateXid();
    // key (string) → { value, removed (bool), versionRead (Buffer|null), wasRead (bool), existed (bool) }
    this.entries = new Map();
    this.active = true;
  }

  TransactionContext.prototype.trackPut = function(key, value) {
    var entry = this.entries.get(key);
    if (entry) {
      entry.value = value;
      entry.removed = false;
    } else {
      this.entries.set(key, {
        value: value,
        removed: false,
        versionRead: null,
        wasRead: false,
        existed: false
      });
    }
  };

  TransactionContext.prototype.trackRemove = function(key) {
    var entry = this.entries.get(key);
    if (entry) {
      entry.removed = true;
      entry.value = undefined;
    } else {
      this.entries.set(key, {
        value: undefined,
        removed: true,
        versionRead: null,
        wasRead: false,
        existed: false
      });
    }
  };

  TransactionContext.prototype.trackRead = function(key, meta) {
    var entry = this.entries.get(key);
    var version = meta ? meta.version : null;
    var existed = meta !== undefined;
    if (entry) {
      if (!entry.wasRead) {
        entry.wasRead = true;
        entry.versionRead = version;
        entry.existed = existed;
      }
    } else {
      this.entries.set(key, {
        value: meta ? meta.value : undefined,
        removed: false,
        versionRead: version,
        wasRead: true,
        existed: existed
      });
    }
  };

  TransactionContext.prototype.getLocalValue = function(key) {
    var entry = this.entries.get(key);
    if (!entry) return { found: false };
    if (entry.removed) return { found: true, value: undefined };
    if (entry.value !== undefined) return { found: true, value: entry.value };
    return { found: false };
  };

  TransactionContext.prototype.computeControlByte = function(entry) {
    var control = 0;
    if (!entry.wasRead) {
      control |= NOT_READ;
    } else if (!entry.existed) {
      control |= NON_EXISTING;
    }
    if (entry.removed) {
      control |= REMOVE_OP;
    }
    return control;
  };

  TransactionContext.prototype.getModifications = function() {
    var mods = [];
    this.entries.forEach(function(entry, key) {
      var control = this.computeControlByte(entry);
      mods.push({
        key: key,
        controlByte: control,
        versionRead: entry.versionRead,
        value: entry.value
      });
    }.bind(this));
    return mods;
  };

  exports.TransactionContext = TransactionContext;
  exports.generateXid = generateXid;
  exports.FORMAT_ID = FORMAT_ID;
  exports.NOT_READ = NOT_READ;
  exports.NON_EXISTING = NON_EXISTING;
  exports.REMOVE_OP = REMOVE_OP;
  exports.XA_OK = XA_OK;
  exports.XA_RDONLY = XA_RDONLY;

}.call(this));
