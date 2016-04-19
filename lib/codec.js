(function() {

  var MSB = 0x80
      , REST = 0x7F
      , MSBALL = ~REST
      , INT = Math.pow(2, 31);

  var _ = require('underscore');
  var f = require('./functional');
  var utils = require('./utils');

  var logger = utils.logger('codec');

  exports.encodeUByte = f.lift(doEncodeUByte, _.identity);
  exports.encodeVInt = f.lift(doEncodeVInt, _.identity);
  exports.encodeVLong = f.lift(doEncodeVLong, _.identity);
  exports.encodeObject = f.lift(doEncodeObject, _.identity);
  exports.encodeBytes = f.lift(doEncodeBytes, _.identity);
  exports.encodeString = f.lift(doEncodeString, _.identity);
  exports.encodeSignedInt = f.lift(doEncodeSignedInt, _.identity);

  exports.decodeUByte = f.lift(doDecodeUByte, _.identity);
  exports.decodeVInt = f.lift(doDecodeVInt, _.identity);
  exports.decodeLong = f.lift(doDecodeLong, _.identity);
  exports.decodeVLong = f.lift(doDecodeVLong, _.identity);
  exports.decodeObject = f.lift(doDecodeObject, _.identity);
  exports.decodeFixedBytes = f.lift(doDecodeFixedBytes, _.identity);
  exports.decodeString = f.lift(doDecodeString, _.identity);
  exports.decodeSignedInt = f.lift(doDecodeSignedInt, _.identity);
  exports.decodeVariableBytes = f.lift(doDecodeVariableBytes, _.identity);
  exports.decodeShort = f.lift(doDecodeShort, _.identity);

  // JBoss Marshalling encoding requirements
  exports.encodeJBossString = function(str) {
    var header = [exports.encodeUByte(0x03)];
    var len = encodeJBossStringLength(str);
    return f.cat(header, len, [encodeNakedString(str)]);
  };

  var encodeShort = f.lift(doEncodeShort, _.identity);
  var encodeInt = f.lift(doEncodeInt, _.identity);
  var encodeNakedString = f.lift(doEncodeNakedString, _.identity);

  function encodeJBossStringLength(str) {
    var len = Buffer.byteLength(str);
    return len <= 0x100 ? [exports.encodeUByte(0x3e), exports.encodeUByte(len)]
         : len <= 0x10000 ? [exports.encodeUByte(0x3f), encodeShort(len)]
         : [exports.encodeUByte(0x40), encodeInt(len)];
  }

  exports.lastDecoded = function(values, state) {
    return values[0];
  };

  exports.allDecoded = function(values, state) {
    return values;
  };

  exports.bytesEncoded = function(values, state) {
    // If buffer is too big, slice it up so that it can be sent
    // immediately without any further modifications.
    var bytes = values[values.length - 1];
    if (bytes < state.buf.length)
      state.buf = state.buf.slice(0, bytes);

    return bytes;
  };

  function doEncodeUByte(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteUByte(bytebuf))(num);
  }

  function doEncodeVInt(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteVInt(bytebuf))(num);
  }

  function doEncodeVLong(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteVLong(bytebuf))(num);
  }

  function doEncodeObject(bytebuf, obj) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteObject(bytebuf))(obj);
  }

  function doEncodeString(bytebuf, obj) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteString(bytebuf))(obj);
  }

  function doEncodeBytes(bytebuf, bytes) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteBytes(bytebuf))(bytes);
  }

  function doEncodeSignedInt(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteSignedInt(bytebuf), zigZag)(num);
  }

  function doEncodeInt(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteInt(bytebuf))(num);
  }

  function doEncodeShort(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteShort(bytebuf))(num);
  }

  function doEncodeNakedString(bytebuf, obj) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteNakedString(bytebuf))(obj);
  }

  function zigZag(num) {
    return (num << 1) ^ (num >> 31);
  }

  var nullCheck = f.validator('must not be null', f.existy);
  var number = f.validator('must be a number', _.isNumber);
  var positiveOrZero = f.validator('must be >= 0', f.greaterThan(-1));
  var intTooBig = f.validator('must be less than 2^31', f.lessThan(Math.pow(2, 31)));
  var shortTooBig = f.validator('must be less than 2^15', f.lessThan(Math.pow(2, 15)));
  var longTooBig = f.validator('must be less than 2^53 (javascript safe integer limitation)',
                               f.lessThan(Math.pow(2, 53)));
  var stringOrNullCheck = f.validator('must be a String or null', stringOrNull);

  function stringOrNull(x) {
    return !f.existy(x) || _.isString(x);
  }

  function checkedWriteUByte(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero), uncheckedWriteUByte(bytebuf));
  }

  function checkedWriteVInt(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero, intTooBig), uncheckedWriteVNum(bytebuf));
  }

  function checkedWriteVLong(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero, longTooBig), uncheckedWriteVNum(bytebuf));
  }

  function checkedWriteObject(bytebuf) {
    return f.partial1(f.condition1(nullCheck), uncheckedWriteObject(bytebuf));
  }

  function checkedWriteString(bytebuf) {
    return f.partial1(f.condition1(stringOrNullCheck), uncheckedWriteString(bytebuf));
  }

  function checkedWriteBytes(bytebuf) {
    return f.partial1(f.condition1(nullCheck), uncheckedWriteBytes(bytebuf));
  }

  function checkedWriteSignedInt(bytebuf) {
    return f.partial1(f.condition1(number, intTooBig), uncheckedWriteVNum(bytebuf));
  }

  function checkedWriteInt(bytebuf) {
    return f.partial1(f.condition1(number, intTooBig), uncheckedWriteInt(bytebuf));
  }

  function checkedWriteShort(bytebuf) {
    return f.partial1(f.condition1(number, shortTooBig), uncheckedWriteShort(bytebuf));
  }

  function checkedWriteNakedString(bytebuf) {
    return f.partial1(f.condition1(stringOrNullCheck), uncheckedWriteNakedString(bytebuf));
  }

  function updateEncOffset(bytebuf) {
    return function(offset) {
      bytebuf.offset = offset;
      return offset;
    }
  }

  function uncheckedWriteUByte(bytebuf) {
    return function(byte) {
      bytebuf = bytebufOverflowProtect(bytebuf, 1);
      // TODO: We can better control validation, e.g. no boundary check but double size, so try passing noAssert=true
      bytebuf.buf.writeUInt8(byte, bytebuf.offset);
      return bytebuf.offset + 1;
    }
  }

  // TODO: Should create an ByteBuf type and move this logic there
  function bytebufOverflowProtect(bytebuf, maxSize) {
    if (bytebuf.offset + maxSize > bytebuf.buf.length) {
      var length = bytebuf.buf.length * 2;
      while (length < bytebuf.offset + maxSize)
        length = length * 2;

      var tmp = new Buffer(length);
      bytebuf.buf.copy(tmp, 0, 0, bytebuf.buf.length);
      bytebuf.buf = tmp;
      return bytebuf;
    }
    return bytebuf;
  }

  function uncheckedWriteVNum(bytebuf) {
    return function(num) {
      // Resize if not enough space to fit the biggest of var nums.
      // Due to Javascript limitations, the biggest var num is 2 ^ 53 - 1,
      // so at most 8 bytes will be needed.
      bytebuf = bytebufOverflowProtect(bytebuf, 8);

      var localOffset = bytebuf.offset;

      while(num >= INT) {
        bytebuf.buf.writeUInt8((num & 0xFF) | MSB, localOffset++);
        num /= 128
      }
      while(num & MSBALL) {
        bytebuf.buf.writeUInt8((num & 0xFF) | MSB, localOffset++);
        num >>>= 7
      }
      bytebuf.buf.writeUInt8(num | 0, localOffset);

      return localOffset + 1;
    }
  }

  function uncheckedWriteObject(bytebuf) {
    return function(obj) {
      if (_.isString(obj)) {
        return uncheckedWriteString(bytebuf)(obj);
      } else if (Buffer.isBuffer(obj)) {
        return uncheckedWriteBuffer(bytebuf)(obj);
      } else {
        throw new Error('Not handled yet: ' + obj);
      }
    }
  }

  function uncheckedWriteBuffer(bytebuf) {
    return function(obj) {
      var offsetAfterBytes = uncheckedWriteVNum(bytebuf)(obj.length);
      bytebuf = bytebufOverflowProtect(bytebuf, obj.length);
      return obj.copy(bytebuf.buf, offsetAfterBytes) + offsetAfterBytes;
    }
  }

  function uncheckedWriteString(bytebuf) {
    return function(obj) {
      var stringNumBytes = f.existy(obj) ? Buffer.byteLength(obj) : 0;
      var offsetAfterBytes = uncheckedWriteVNum(bytebuf)(stringNumBytes);
      if (stringNumBytes > 0) {
        bytebuf = bytebufOverflowProtect(bytebuf, stringNumBytes);
        return bytebuf.buf.write(obj, offsetAfterBytes) + offsetAfterBytes;
      }
      return offsetAfterBytes;
    }
  }

  function uncheckedWriteBytes(bytebuf) {
    return function(bytes) {
      bytebuf = bytebufOverflowProtect(bytebuf, bytes.length);
      var targetStart = bytebuf.offset;
      bytes.copy(bytebuf.buf, targetStart);
      return targetStart + bytes.length;
    }
  }

  function uncheckedWriteInt(bytebuf) {
    return function(num) {
      // Resize if not enough space to fit the biggest of ints.
      bytebuf = bytebufOverflowProtect(bytebuf, 4);
      bytebuf.buf.writeInt32BE(num, bytebuf.offset);
      return bytebuf.offset + 4;
    }
  }

  function uncheckedWriteShort(bytebuf) {
    return function(num) {
      // Resize if not enough space to fit the biggest of shorts.
      bytebuf = bytebufOverflowProtect(bytebuf, 2);
      bytebuf.buf.writeInt16BE(num, bytebuf.offset);
      return bytebuf.offset + 2;
    }
  }

  function uncheckedWriteNakedString(bytebuf) {
    return function(str) {
      var stringNumBytes = f.existy(str) ? Buffer.byteLength(str) : 0;
      bytebuf = bytebufOverflowProtect(bytebuf, stringNumBytes);
      return bytebuf.buf.write(str, bytebuf.offset) + bytebuf.offset;
    }
  }

  function doDecodeUByte(bytebuf) {
    return uncheckedReadUByte(bytebuf)();
  }

  function doDecodeVInt(bytebuf) {
    return uncheckedReadVNum(bytebuf)();
  }

  function doDecodeVLong(bytebuf) {
    return uncheckedReadVNum(bytebuf)();
  }

  function doDecodeLong(bytebuf) {
    return uncheckedReadLong(bytebuf)();
  }

  function doDecodeObject(bytebuf) {
    return uncheckedReadObject(bytebuf)();
  }

  function doDecodeFixedBytes(bytebuf, num) {
    return uncheckedReadBytes(bytebuf)(num);
  }

  function doDecodeString(bytebuf) {
    return uncheckedReadString(bytebuf)();
  }

  function doDecodeSignedInt(bytebuf) {
    var num = uncheckedReadVNum(bytebuf)();
    return (num & 1) == 0 ? num >>> 1 : ~(num >>> 1);
  }

  function doDecodeVariableBytes(bytebuf) {
    return _.compose(uncheckedReadBytes(bytebuf), uncheckedReadVNum(bytebuf))();
  }

  function doDecodeShort(bytebuf) {
    return uncheckedReadShort(bytebuf)();
  }

  function uncheckedReadUByte(bytebuf) {
    return function() {
      return bytebuf.buf.readUInt8(bytebuf.offset++);
    }
  }

  function uncheckedReadVNum(bytebuf) {
    return function() {
      var res = 0, shift  = 0, b;

      do {
        b = bytebuf.buf.readUInt8(bytebuf.offset++);
        res += shift < 28
            ? (b & REST) << shift
            : (b & REST) * Math.pow(2, shift);
        shift += 7;
      } while (b >= MSB);

      return res
    }
  }

  function uncheckedReadLong(bytebuf) {
    return function() {
      var low = bytebuf.buf.readInt32BE(bytebuf.offset + 4);
      var n = bytebuf.buf.readInt32BE(bytebuf.offset) * 4294967296.0 + low;
      if (low < 0) n += 4294967296;
      bytebuf.offset = bytebuf.offset + 8;
      return n;
    }
  }

  function uncheckedReadBytes(bytebuf) {
    return function(num) {
      var end = bytebuf.offset + num;
      var bytes = bytebuf.buf.slice(bytebuf.offset, end);
      bytebuf.offset = end;
      return bytes;
    }
  }

  function uncheckedReadObject(bytebuf) {
    return function() {
      return uncheckedReadString(bytebuf)();
    }
  }

  function uncheckedReadString(bytebuf) {
    return function() {
      var numBytes = uncheckedReadVNum(bytebuf)();
      if (numBytes > bytebuf.buf.length - bytebuf.offset) {
        logger.tracef('Can not fully read object with %d bytes (buffer size is %d, buffer offset %d)',
                      numBytes, bytebuf.buf.length, bytebuf.offset);
        return undefined;
      }

      var obj = bytebuf.buf.toString(undefined, bytebuf.offset, bytebuf.offset + numBytes);
      bytebuf.offset = bytebuf.offset + numBytes;
      return obj;
    }
  }

  function uncheckedReadShort(bytebuf) {
    return function() {
      var numBytes = bytebuf.buf.readUInt16BE(bytebuf.offset);
      bytebuf.offset = bytebuf.offset + 2;
      return numBytes;
    }
  }

}.call(this));
