var _ = require("underscore");
var f = require("../lib/functional");
var vnum = require("../lib/codec");

// Temporary functions - to be moved

//function encodeUByte(bytebuf, byte) {
//  //var newOffset = bytebuf.buf.writeUInt8(byte, bytebuf.offset);
//  //return {buf: bytebuf.buf, offset: newOffset};
//  var newOffset = bytebuf.buf.writeUInt8(byte, bytebuf.offset);
//  bytebuf.offset = newOffset;
//  return newOffset;
//}

var mEncodeUByte = f.lift(vnum.encodeUByte, _.identity);
var mEncodeVInt = f.lift(vnum.encodeVInt, _.identity);
var mDecodeUByte = f.lift(vnum.decodeUByte, _.identity);

// Test functions

function totalBytes(values, _) {
  return values[values.length - 1];
}

function decodedValues(values, _) {
  return values;
}

//function identityValues(values, _) { return values; }
//function logState(elem) {
//  console.log(elem.buf.toJSON());
//  console.log(elem.offset);
//}

var singleByteEncode = f.actions([mEncodeUByte(0xA0)], totalBytes);
var multiByteEncode = f.actions([mEncodeUByte(0xA0), mEncodeUByte(0xA1)], totalBytes);

var singleByteDecode = f.actions([mDecodeUByte()], decodedValues);
var multiByteDecode = f.actions([mDecodeUByte(), mDecodeUByte()], decodedValues);

//var multiByteEncodeInter = f.actions([mEncodeUByte(0xA0), mEncodeUByte(0xA1)], identityValues);

// Tests

describe("VInt encode/decode", function() {
  it("can encode 0", function() {
    encodeDecodeVInt(0, 1);
  });
  it("can encode 2^7 - 1", function() {
    encodeDecodeVInt(Math.pow(2, 7) - 1, 1);
  });
  it("can encode 2^7", function() {
    encodeDecodeVInt(Math.pow(2, 7), 2);
  });
  it("can encode 2^14 - 1", function() {
    encodeDecodeVInt(Math.pow(2, 14) - 1, 2);
  });
  it("can encode 2^14", function() {
    encodeDecodeVInt(Math.pow(2, 14), 3);
  });
  it("can encode 2^21 - 1", function() {
    encodeDecodeVInt(Math.pow(2, 21) - 1, 3);
  });
  it("can encode 2^21", function() {
    encodeDecodeVInt(Math.pow(2, 21), 4);
  });
  it("can encode 2^28 - 1", function() {
    encodeDecodeVInt(Math.pow(2, 28) - 1, 4);
  });
  it("can encode 2^28", function() {
    encodeDecodeVInt(Math.pow(2, 28), 5);
  });
  it("can encode 2^31 - 1", function() {
    encodeDecodeVInt(Math.pow(2, 31) - 1, 5);
  });
  it("fails to encode 2^31 because it is out of bounds", function() {
    var encode = f.actions([mEncodeVInt(Math.pow(2, 31))], totalBytes);
    expect(function() { encode(newByteBuf()) }).toThrow("must be less than 2^31");
  });
  it("fails to encode a number when it's not a number", function() {
    var encode = f.actions([mEncodeVInt("blah")], totalBytes);
    expect(function() { encode(newByteBuf()) })
        .toThrow("must be a number, must be >= 0, must be less than 2^31");
  });
  it("fails to encode a number when it's negative", function() {
    var encode = f.actions([mEncodeVInt(-1)], totalBytes);
    expect(function() { encode(newByteBuf()) }).toThrow("must be >= 0");
  });
});

function encodeDecodeVInt(num, expectedBytes) {
  var bytebuf = newByteBuf();
  var encode = f.actions([mEncodeVInt(num)], totalBytes);
  expect(encode(bytebuf)).toBe(expectedBytes);
  // TODO: Decode!
}

describe("Basic encode/decode", function() {
  it("fails to encode a byte when it's not a number", function() {
    var invalidByteEncode = f.actions([mEncodeUByte("blah")], totalBytes);
    expect(function() { invalidByteEncode(newByteBuf()) })
        .toThrow("must be a number, must be >= 0");
  });
  it("fails to encode a number when it's negative", function() {
    var encode = f.actions([mEncodeUByte(-1)], totalBytes);
    expect(function() { encode(newByteBuf()) }).toThrow("must be >= 0");
  });
  it("fails to encode a byte when the value is too big (256 or higher)", function() {
    var overLimitByteEncode = f.actions([mEncodeUByte(0x100)], totalBytes);
    expect(function() { overLimitByteEncode(newByteBuf()) }).toThrow("value is out of bounds");
  });
  it("can encode a byte with limit value 255", function() {
    var bytebuf = newByteBuf();
    var limitByteEncode = f.actions([mEncodeUByte(0xFF)], totalBytes);
    expect(limitByteEncode(bytebuf)).toBe(1);
    expect(singleByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xFF]);
  });
  it("can encode a multiple bytes with actions", function() {
    var bytebuf = newByteBuf();
    expect(multiByteEncode(bytebuf)).toBe(2);
    expect(multiByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0, 0xA1]);
  });
  it("can encode a single byte with actions", function() {
    var bytebuf = newByteBuf();
    expect(singleByteEncode(bytebuf)).toBe(1);
    expect(singleByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0]);
  });
  it("can encode a single byte", function() {
    var bytebuf = newByteBuf();
    expect(vnum.encodeUByte(bytebuf, 0xA0)).toBe(1);
    expect(vnum.decodeUByte({buf: bytebuf.buf, offset: 0})).toBe(0xA0);
  });
});

function newByteBuf() {
  return {buf: new Buffer(128), offset: 0};
}

//describe("Unchecked variable number encoder", function() {
//  it("can encode positive numbers", function() {
//    var buf = new Buffer(1);
//    var result = vnum.encode(buf)(0, 0);
//    expect(result.offset).toBe(1);
//    expect(result.buffer.readUInt8()).toBe(0);
//  });
//  it("can encode using pipeline", function() {
//    var encBuf = vnum.encode(new Buffer(1));
//    var result = f.pipeline(encBuf(0, 0));
//    expect(result.offset).toBe(1);
//    expect(result.buffer.readUInt8()).toBe(0);
//  });
//
//  it("can encode2 positive numbers", function() {
//    var buf = new Buffer(1);
//    var result = vnum.encode2(buf, 0)(0);
//    expect(result.offset).toBe(1);
//    expect(result.buffer.readUInt8()).toBe(0);
//  });
//  it("can encode2 a single number using pipeline", function() {
//    var encBuf = vnum.encode2(new Buffer(1), 0);
//    var result = f.pipeline(encBuf(0));
//    expect(result.offset).toBe(1);
//    expect(result.buffer.readUInt8()).toBe(0);
//  });
//  //it("can encode2 multiple numbers using pipeline", function() {
//  //  var encBuf = vnum.encode2(new Buffer(1), 0);
//  //  var result = f.pipeline(encBuf(0), encBuf(0));
//  //  expect(result.offset).toBe(1);
//  //  expect(result.buffer.readUInt8()).toBe(0);
//  //});
//
//  //it("can encode using pipeline", function() {
//  //  var enc0off0 = f.partial2(vnum.encode, 0, 0);
//  //  var result = f.pipeline(new Buffer(1), enc0off0);
//  //  expect(result.offset).toBe(1);
//  //  expect(result.buffer.readUInt8()).toBe(0);
//  //});
//});

//describe("A suite", function() {
//  it("contains spec with an expectation", function() {
//    expect(true).toBe(true);
//  });
//});