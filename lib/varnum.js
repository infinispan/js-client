
(function() {

  var MSB = 0x80
      , REST = 0x7F
      , MSBALL = ~REST
      , INT = Math.pow(2, 31);

  function encode(buf, num, offset) {
    return function(num, offset) {
      var oldOffset = offset;

      // TODO: Check if enough space...
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
