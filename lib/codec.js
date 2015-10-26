(function() {
  var MSB = 0x80
      , REST = 0x7F
      , MSBALL = ~REST
      , INT = Math.pow(2, 31);

  var _ = require("underscore");
  var f = require("./functional");

  // TODO: A safe version that verifies the number is positive
  // TODO: A safe version that verifies that the buffer has sufficient space
  // TODO: Expose it as unsafe version
  // TODO: Check if enough space...
  // TODO: Deal with numbers larger than INT

  exports.encodeUByte = doEncodeUByte;
  exports.encodeVInt = doEncodeVInt;

  function doEncodeUByte(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteUByte(bytebuf))(num);
  }

  function doEncodeVInt(bytebuf, num) {
    return _.compose(updateEncOffset(bytebuf), checkedWriteVInt(bytebuf))(num);
  }

  var number = f.validator("must be a number", _.isNumber);
  var positiveOrZero = f.validator("must be >= 0", f.greaterThan(-1));
  var intTooBig = f.validator("must be less than 2^31", f.lessThan(Math.pow(2, 31)));

  function checkedWriteUByte(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero), uncheckedWriteUByte(bytebuf));
  }

  function checkedWriteVInt(bytebuf) {
    return f.partial1(f.condition1(number, positiveOrZero, intTooBig), uncheckedWriteVInt(bytebuf));
  }

  function updateEncOffset(bytebuf) {
    return function(offset) {
      bytebuf.offset = offset;
      return offset;
    }
  }

  function uncheckedWriteUByte(bytebuf) {
    return function(byte) {
      return bytebuf.buf.writeUInt8(byte, bytebuf.offset);
    }
  }

  function uncheckedWriteVInt(bytebuf) {
    return function(num) {
      var localOffset = bytebuf.offset;

      while(num & MSBALL) {
        bytebuf.buf.writeUInt8((num & 0xFF) | MSB, localOffset++);
        num >>>= 7
      }
      bytebuf.buf.writeUInt8(num | 0, localOffset);

      return localOffset - bytebuf.offset + 1;
    }
  }

  exports.decodeUByte = uncheckedDecodeUByte;

  function uncheckedDecodeUByte(bytebuf) {
    return _.compose(updateDecOffset(bytebuf, 1), bufferReadUByte(bytebuf))();
  }

  function updateDecOffset(bytebuf, relativeOffset) {
    return function(read) {
      bytebuf.offset = bytebuf.offset + relativeOffset;
      return read;
    }
  }

  function bufferReadUByte(bytebuf) {
    return function() {
      return bytebuf.buf.readUInt8(bytebuf.offset);
    }
  }

  //exports.encodeUByte = _.compose(setOffset, uncheckedEncodeUByte);
  //
  //function uncheckedEncodeUByte(bytebuf, byte) {
  //  console.log("ByteBuf");
  //  console.log(bytebuf);
  //  console.log(byte);
  //  return bytebuf.buf.writeUInt8(byte, bytebuf.offset);
  //}
  //
  //function setOffset(bytebuf) {
  //  return function(offset) {
  //    bytebuf.offset = offset;
  //    return offset;
  //  }
  //}

  //exports.encode = uncheckedEncode;
  //exports.encode2 = uncheckedEncode2;


  //function uncheckedEncode2(buf, offset) {
  //  return function(num) {
  //    var oldOffset = offset;
  //
  //    // TODO: Deal with numbers larger than INT
  //
  //    while(num & MSBALL) {
  //      buf.writeUInt8((num & 0xFF) | MSB, offset++);
  //      num >>>= 7
  //    }
  //    buf.writeUInt8(num | 0, offset);
  //
  //    return {buffer: buf, offset: offset - oldOffset + 1}
  //  }
  //}
  //
  //function uncheckedEncode(buf) {
  //  return function(num, offset) {
  //    var oldOffset = offset;
  //
  //    // TODO: Deal with numbers larger than INT
  //
  //    while(num & MSBALL) {
  //      buf.writeUInt8((num & 0xFF) | MSB, offset++);
  //      num >>>= 7
  //    }
  //    buf.writeUInt8(num | 0, offset);
  //
  //    return {buffer: buf, offset: offset - oldOffset + 1}
  //  }
  //}
}.call(this));
