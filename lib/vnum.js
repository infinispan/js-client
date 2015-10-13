
(function() {
  var MSB = 0x80
      , REST = 0x7F
      , MSBALL = ~REST
      , INT = Math.pow(2, 31);

  // TODO: A safe version that verifies the number is positive
  // TODO: A safe version that verifies that the buffer has sufficient space
  // TODO: Expose it as unsafe version
  // TODO: Check if enough space...
  // TODO: Deal with numbers larger than INT

  exports.encode = uncheckedEncode;
  exports.encode2 = uncheckedEncode2;

  function uncheckedEncode2(buf, offset) {
    return function(num) {
      var oldOffset = offset;

      // TODO: Deal with numbers larger than INT

      while(num & MSBALL) {
        buf.writeUInt8((num & 0xFF) | MSB, offset++);
        num >>>= 7
      }
      buf.writeUInt8(num | 0, offset);

      return {buffer: buf, offset: offset - oldOffset + 1}
    }
  }

  function uncheckedEncode(buf) {
    return function(num, offset) {
      var oldOffset = offset;

      // TODO: Deal with numbers larger than INT

      while(num & MSBALL) {
        buf.writeUInt8((num & 0xFF) | MSB, offset++);
        num >>>= 7
      }
      buf.writeUInt8(num | 0, offset);

      return {buffer: buf, offset: offset - oldOffset + 1}
    }
  }
}.call(this));
