var _ = require("underscore");
var f = require("../lib/functional");
var codec = require("../lib/codec");

// Test functions

// TODO: Duplicate
function totalBytes(values, state) {
  // If buffer is too big, slice it up so that it can be sent
  // immediately without any further modifications.
  var bytes = values[values.length - 1];
  if (bytes < state.buf.length)
    state.buf = state.buf.slice(0, bytes);

  return bytes;
}

// TODO: Duplicate
function decodedValues(values, state) {
  return values;
}

var singleByteEncode = f.actions([codec.mEncodeUByte(0xA0)], totalBytes);
var multiByteEncode = f.actions([codec.mEncodeUByte(0xA0), codec.mEncodeUByte(0xA1)], totalBytes);

var singleByteDecode = f.actions([codec.mDecodeUByte()], decodedValues);
var multiByteDecode = f.actions([codec.mDecodeUByte(), codec.mDecodeUByte()], decodedValues);
var singleVLongDecode = f.actions([codec.mDecodeVLong()], decodedValues);
var multiVNumDecode = f.actions([codec.mDecodeVInt(), codec.mDecodeVLong()], decodedValues);
var singleObjectDecode = f.actions([codec.mDecodeObject()], decodedValues);

//var multiByteEncodeInter = f.actions([mEncodeUByte(0xA0), mEncodeUByte(0xA1)], identityValues);

// Tests

describe("Variable number encode/decode", function() {
  it("can encode a String", function() {
    var stringEncode = f.actions([codec.mEncodeObject("one")], totalBytes);
    var bytebuf = assertEncode(newByteBuf(), stringEncode, Buffer.byteLength("one") + 1);
    expect(singleObjectDecode({buf: bytebuf.buf, offset: 0})).toEqual(["one"]);
  });
});

describe("Variable number encode/decode", function() {
  it("can encode 0", function() {
    encodeDecodeVNum(0, 1);
  });
  it("can encode 2^7 - 1", function() {
    encodeDecodeVNum(Math.pow(2, 7) - 1, 1);
  });
  it("can encode 2^7", function() {
    encodeDecodeVNum(Math.pow(2, 7), 2);
  });
  it("can encode 2^14 - 1", function() {
    encodeDecodeVNum(Math.pow(2, 14) - 1, 2);
  });
  it("can encode 2^14", function() {
    encodeDecodeVNum(Math.pow(2, 14), 3);
  });
  it("can encode 2^21 - 1", function() {
    encodeDecodeVNum(Math.pow(2, 21) - 1, 3);
  });
  it("can encode 2^21", function() {
    encodeDecodeVNum(Math.pow(2, 21), 4);
  });
  it("can encode 2^28 - 1", function() {
    encodeDecodeVNum(Math.pow(2, 28) - 1, 4);
  });
  it("can encode 2^28", function() {
    encodeDecodeVNum(Math.pow(2, 28), 5);
  });
  it("can encode 2^31 - 1", function() {
    encodeDecodeVNum(Math.pow(2, 31) - 1, 5);
  });
  it("fails to encode 2^31 as a VInt because it is out of bounds", function() {
    var encode = f.actions([codec.mEncodeVInt(Math.pow(2, 31))], totalBytes);
    expect(function() { encode(newByteBuf()) }).toThrow("must be less than 2^31");
  });
  it("can encode 2^31", function() {
    encodeDecodeVLong(Math.pow(2, 31), 5);
  });
  it("can encode 2^35 - 1", function() {
    encodeDecodeVLong(Math.pow(2, 35) - 1, 5);
  });
  it("can encode 2^35", function() {
    encodeDecodeVLong(Math.pow(2, 35), 6);
  });
  it("can encode 2^42 - 1", function() {
    encodeDecodeVLong(Math.pow(2, 42) - 1, 6);
  });
  it("can encode 2^42", function() {
    encodeDecodeVLong(Math.pow(2, 42), 7);
  });
  it("can encode 2^49 - 1", function() {
    encodeDecodeVLong(Math.pow(2, 49 - 1), 7);
  });
  it("can encode 2^49", function() {
    encodeDecodeVLong(Math.pow(2, 49), 8);
  });
  it("can encode 2^53 - 1", function() {
    encodeDecodeVLong(Math.pow(2, 53) - 1, 8);
  });
  it("fails to encode 2^53 as a VLong because it is out of bounds", function() {
    var encode = f.actions([codec.mEncodeVLong(Math.pow(2, 53))], totalBytes);
    expect(function() { encode(newByteBuf()) })
        .toThrow("must be less than 2^53 (javascript safe integer limitation)");
  });
  it("fails to encode a number when it's not a number", function() {
    var encode = f.actions([codec.mEncodeVInt("blah")], totalBytes);
    expect(function() { encode(newByteBuf()) })
        .toThrow("must be a number, must be >= 0, must be less than 2^31");
  });
  it("fails to encode a number when it's negative", function() {
    var encode = f.actions([codec.mEncodeVInt(-1)], totalBytes);
    expect(function() { encode(newByteBuf()) }).toThrow("must be >= 0");
  });
});

function encodeDecodeVNum(num, expectedBytes) {
  var numsEncode = f.actions([codec.mEncodeVInt(num), codec.mEncodeVLong(num)], totalBytes);
  var bytebuf = assertEncode(newByteBuf(), numsEncode, expectedBytes * 2);
  expect(multiVNumDecode({buf: bytebuf.buf, offset: 0})).toEqual([num, num]);
}

function encodeDecodeVLong(num, expectedBytes) {
  var bytebuf = newByteBuf();
  var encode = f.actions([codec.mEncodeVLong(num)], totalBytes);
  expect(encode(bytebuf)).toBe(expectedBytes);
  expect(singleVLongDecode({buf: bytebuf.buf, offset: 0})).toEqual([num]);
}

describe("Basic encode/decode", function() {
  it("fails to encode a byte when it's not a number", function() {
    var invalidByteEncode = f.actions([codec.mEncodeUByte("blah")], totalBytes);
    expect(function() { invalidByteEncode(newByteBuf()) })
        .toThrow("must be a number, must be >= 0");
  });
  it("fails to encode a number when it's negative", function() {
    var encode = f.actions([codec.mEncodeUByte(-1)], totalBytes);
    expect(function() { encode(newByteBuf()) }).toThrow("must be >= 0");
  });
  it("fails to encode a byte when the value is too big (256 or higher)", function() {
    var overLimitByteEncode = f.actions([codec.mEncodeUByte(0x100)], totalBytes);
    expect(function() { overLimitByteEncode(newByteBuf()) }).toThrow("value is out of bounds");
  });
  it("fails to decode if past the buffer end", function() {
    var bytebuf = newByteBuf();
    expect(function() { singleByteDecode({buf: bytebuf.buf, offset: 128}) }).toThrow("index out of range");
  });
  it("can encode a byte with limit value 255", function() {
    var limitByteEncode = f.actions([codec.mEncodeUByte(0xFF)], totalBytes);
    var bytebuf = assertEncode(newByteBuf(), limitByteEncode, 1);
    expect(singleByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xFF]);
  });
  it("can encode a multiple bytes with actions", function() {
    var bytebuf = assertEncode(newByteBuf(), multiByteEncode, 2);
    expect(multiByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0, 0xA1]);
  });
  it("can encode a single byte with actions", function() {
    var bytebuf = assertEncode(newByteBuf(), singleByteEncode, 1);
    expect(singleByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0]);
  });
  it("can encode a single byte", function() {
    var bytebuf = newByteBuf();
    expect(codec.encodeUByte(bytebuf, 0xA0)).toBe(1);
    expect(codec.decodeUByte({buf: bytebuf.buf, offset: 0})).toBe(0xA0);
  });
});

function assertEncode(bytebuf, encode, expectedBytes) {
  expect(encode(bytebuf)).toBe(expectedBytes);
  expect(bytebuf.buf.length).toBe(expectedBytes);
  return bytebuf;
}

function newByteBuf() {
  return {buf: new Buffer(128), offset: 0};
}
