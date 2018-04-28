//'use strict';

var _ = require('underscore');
var f = require('../lib/functional');
var codec = require('../lib/codec');

var t = require('./utils/testing'); // Testing dependency

// Test functions

var multiByteEncode = [codec.encodeUByte(0xA0), codec.encodeUByte(0xA1)];
var multiByteDecode = [codec.decodeUByte(), codec.decodeUByte()];
var multiBytes = [0xA0, 0xA1];

var singleVIntEncode = function(num) { return codec.encodeVInt(num); };
var singleVIntDecode = [codec.decodeVInt()];

var singleVLongEncode = function(num) { return codec.encodeVLong(num); };
var singleVLongDecode = [codec.decodeVLong()];

var multiVNumEncode = function(num) { return [codec.encodeVInt(num), codec.encodeVLong(num)]; };
var multiVNumDecode = [codec.decodeVInt(), codec.decodeVLong()];

// Tests

describe('JBoss String encode/decode', function() {
  it('can encode a 128 char String as JBoss String', function() {
    assertJBossString(t.randomStr(128), 131, [3, 62, -128]);
  });
  it('can encode a 127 char String as JBoss String', function() {
    assertJBossString(t.randomStr(127), 130, [3, 62, 127]);
  });
  it('can encode a 1 char String as JBoss String', function() {
    assertJBossString('a', 4, [3, 62, 1]);
  });
  it('can encode a unicode String as JBoss String', function() {
    assertJBossString('բարեվ', 13, [3, 62, 5]);
  });
});

describe('Variable bytes decode', function() {
  it('can decode a variable sized byte array', function() {
    var bytes = new Buffer([3, 49, 50, 51]);
    var actual = encodeDecode(4, codec.encodeBytes(bytes), codec.decodeVariableBytes(), 1);
    t.expectToBeBuffer(actual[0], new Buffer([49, 50, 51]));
  });
});

describe('Signed number encode/decode', function() {
  it('can encode a negative numbers as positive ones', function() {
    assert(-2147483648, 5, codec.encodeSignedInt(-2147483648), codec.decodeSignedInt());
    assert(2147483647, 5, codec.encodeSignedInt(2147483647), codec.decodeSignedInt());
    assert(-2, 1, codec.encodeSignedInt(-2), codec.decodeSignedInt());
    assert(-1, 1, codec.encodeSignedInt(-1), codec.decodeSignedInt());
    assert(1, 1, codec.encodeSignedInt(1), codec.decodeSignedInt());
    assert(0, 1, codec.encodeSignedInt(0), codec.decodeSignedInt());
  });
});

describe('String encode/decode', function() {
  it('can encode a String', function() {
    assert('one', strSize('one'), codec.encodeString('one'), codec.decodeObject());
  });
  it('can encode an undefined String with 0 length', function() {
    assert(0, 1, codec.encodeString(undefined), codec.decodeUByte());
  });
  it('can encode a String that fits exactly within buffer', function() {
    var str = t.randomStr(31);
    assert(str, 32, codec.encodeString(str), codec.decodeObject(), 32);
  });
  it('can encode a String that needs expanding to include length', function() {
    // Length of String needs to be bigger than 8 bytes for expansion at String
    var str = t.randomStr(32);
    assert(str, 33, codec.encodeString(str), codec.decodeObject(), 32);
  });
});

describe('Bytes encode/decode', function() {
  it('can resize buffer when encoding a number of Bytes', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8, codec.encodeBytes(bytes), codec.decodeFixedBytes(8), 1);
    t.expectToBeBuffer(actual[0], bytes);
  });
  it('can encode a number of Bytes', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8, codec.encodeBytes(bytes), codec.decodeFixedBytes(8));
    t.expectToBeBuffer(actual[0], bytes);
  });
  it('can encode Object + Bytes + Object', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(strSize('one') + 8 + strSize('one'),
        [codec.encodeObject('one'), codec.encodeBytes(bytes), codec.encodeObject('two')],
        [codec.decodeObject(), codec.decodeFixedBytes(8), codec.decodeObject()]);
    expect(actual[0]).toBe('one');
    t.expectToBeBuffer(actual[1], bytes);
    expect(actual[2]).toBe('two');
  });
  it('can encode a chain of Bytes => Object', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8 + strSize('one'),
        [codec.encodeBytes(bytes), codec.encodeObject('one')],
        [codec.decodeFixedBytes(8), codec.decodeObject()]);
    t.expectToBeBuffer(actual[0], bytes);
    expect(actual[1]).toBe('one');
  });
  it('can encode a chain of Object => Bytes', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8 + strSize('one'),
        [codec.encodeObject('one'), codec.encodeBytes(bytes)],
        [codec.decodeObject(), codec.decodeFixedBytes(8)]);
    expect(actual[0]).toBe('one');
    t.expectToBeBuffer(actual[1], bytes);
  });
});

describe('Object encode/decode', function() {
  it('can resize buffer when encoding a String', function() {
    assert('one two three four five six', strSize('one two three four five six'),
           codec.encodeObject('one two three four five six'), codec.decodeObject(), 1);
  });
  it('can encode a String', function() {
    assert('one', strSize('one'), codec.encodeObject('one'), codec.decodeObject());
  });
  it('can encode multiple Strings', function() {
    assert(['one', 'two'], strSize('one') + strSize('two'),
           [codec.encodeObject('one'), codec.encodeObject('two')],
           [codec.decodeObject(), codec.decodeObject()]);
  });
  it('can encode a Buffer that fits exactly within buffer', function() {
    assertBuffer(t.randomStr(31), 32, 32);
  });
  it('can encode a Buffer that needs expanding to include length', function() {
    assertBuffer(t.randomStr(32), 33, 32);
  });
});

function strSize(str) {
  var len = Buffer.byteLength(str);
  return len + t.vNumSize(len);
}

describe('Variable number encode/decode', function() {
  it('can resize buffer when encoding a VInt', function() {
    assert(Math.pow(2, 31) - 1, 5, singleVIntEncode(Math.pow(2, 31) - 1), singleVIntDecode, 1);
  });
  it('can resize buffer when encoding a VLong', function() {
    assert(Math.pow(2, 53) - 1, 8, singleVLongEncode(Math.pow(2, 53) - 1), singleVLongDecode, 1);
  });
  it('can encode 0', function() { encodeDecodeVNum(0); });
  it('can encode 2^7 - 1', function() { encodeDecodeVNum(Math.pow(2, 7) - 1); });
  it('can encode 2^7', function() { encodeDecodeVNum(Math.pow(2, 7)); });
  it('can encode 2^14 - 1', function() { encodeDecodeVNum(Math.pow(2, 14) - 1); });
  it('can encode 2^14', function() { encodeDecodeVNum(Math.pow(2, 14)); });
  it('can encode 2^21 - 1', function() { encodeDecodeVNum(Math.pow(2, 21) - 1); });
  it('can encode 2^21', function() { encodeDecodeVNum(Math.pow(2, 21)); });
  it('can encode 2^28 - 1', function() { encodeDecodeVNum(Math.pow(2, 28) - 1); });
  it('can encode 2^28', function() { encodeDecodeVNum(Math.pow(2, 28)); });
  it('can encode 2^31 - 1', function() { encodeDecodeVNum(Math.pow(2, 31) - 1); });
  it('fails to encode 2^31 as a VInt because it is out of bounds', function() {
    var encode = f.actions([codec.encodeVInt(Math.pow(2, 31))], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()) }).toThrow('must be less than 2^31');
  });
  it('can encode 2^31', function() { encodeDecodeVLong(Math.pow(2, 31)); });
  it('can encode 2^35 - 1', function() { encodeDecodeVLong(Math.pow(2, 35) - 1); });
  it('can encode 2^35', function() { encodeDecodeVLong(Math.pow(2, 35)); });
  it('can encode 2^42 - 1', function() { encodeDecodeVLong(Math.pow(2, 42) - 1); });
  it('can encode 2^42', function() { encodeDecodeVLong(Math.pow(2, 42)); });
  it('can encode 2^49 - 1', function() { encodeDecodeVLong(Math.pow(2, 49 - 1)); });
  it('can encode 2^49', function() { encodeDecodeVLong(Math.pow(2, 49)); });
  it('can encode 2^53 - 1', function() { encodeDecodeVLong(Math.pow(2, 53) - 1); });
  it('fails to encode 2^53 as a VLong because it is out of bounds', function() {
    var encode = f.actions([codec.encodeVLong(Math.pow(2, 53))], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()) })
        .toThrow('must be less than 2^53 (javascript safe integer limitation)');
  });
  it('fails to encode a number when it is not a number', function() {
    var encode = f.actions([codec.encodeVInt('blah')], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()) })
        .toThrow('must be a number, must be >= 0, must be less than 2^31');
  });
  it('fails to encode a number when it is negative', function() {
    var encode = f.actions([codec.encodeVInt(-1)], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()) }).toThrow('must be >= 0');
  });

  function encodeDecodeVNum(num) {
    assert([num, num], t.vNumSize(num) * 2, multiVNumEncode(num), multiVNumDecode);
  }
  function encodeDecodeVLong(num) {
    assert(num, t.vNumSize(num), singleVLongEncode(num), singleVLongDecode);
  }
});

describe('Basic encode/decode', function() {
  it('can resize buffer multiple times to write numbers', function() {
    var numbers = [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9];
    var encoders = _.map(numbers, function (num) { return codec.encodeUByte(num); });
    var decoders = _.map(numbers, function (num) { return codec.decodeUByte(); });
    var encodeActions = f.actions(encoders, codec.bytesEncoded);
    var decodeActions = f.actions(decoders, codec.allDecoded(10));
    var bytebuf = t.assertEncode(t.newByteBuf(1), encodeActions, 10);
    expect(decodeActions({buf: bytebuf.buf, offset: 0})).toEqual(numbers);
  });
  it('can resize buffer to write numbers', function() {
    assert(multiBytes, 2, multiByteEncode, multiByteDecode, 1);
  });
  it('fails to encode a byte when it is not a number', function() {
    var invalidByteEncode = f.actions([codec.encodeUByte('blah')], codec.bytesEncoded);
    expect(function() { invalidByteEncode(t.newByteBuf()) })
        .toThrow('must be a number, must be >= 0');
  });
  it('fails to encode a number when it is negative', function() {
    var encode = f.actions([codec.encodeUByte(-1)], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()) }).toThrow('must be >= 0');
  });
  it('fails to encode a byte when the value is too big (256 or higher)', function() {
    var overLimitByteEncode = f.actions([codec.encodeUByte(0x100)], codec.bytesEncoded);
    expect(function() { overLimitByteEncode(t.newByteBuf()) }).toThrow();
  });
  it('fails to decode if past the buffer end', function() {
    var bytebuf = t.newByteBuf();
    expect(function() { f.actions([codec.decodeUByte()])(t.newByteBuf()) }).toThrow();
  });
  it('can encode a byte with limit value 255', function() {
    assert(0xFF, 1, codec.encodeUByte(0xFF), codec.decodeUByte());
  });
  it('can encode a multiple bytes with actions', function() {
    assert(multiBytes, 2, multiByteEncode, multiByteDecode);
  });
  it('can encode a single byte with actions', function() {
    assert(0xA0, 1, codec.encodeUByte(0xA0), codec.decodeUByte());
  });
});

function assert(expected, size, encoder, decoder, bufferSize) {
  var ret = encodeDecode(size, encoder, decoder, bufferSize);
  expect(ret).toEqual(_.isArray(expected) ? expected : [expected]);
}

function encodeDecode(size, encoder, decoder, bufferSize) {
  var enc = f.actions(_.isArray(encoder) ? encoder : [encoder], codec.bytesEncoded);
  var bytebuf = t.assertEncode(t.newByteBuf(bufferSize), enc, size);
  var dec = f.actions(_.isArray(decoder) ? decoder : [decoder], codec.allDecoded(decoder.length));
  return dec({buf: bytebuf.buf, offset: 0});
}

function assertJBossString(str, bufferSize, header) {
  var enc = f.actions(codec.encodeJBossString(str), codec.bytesEncoded);
  var bytebuf = t.assertEncode(t.newByteBuf(1), enc, bufferSize);
  t.expectToBeBuffer(bytebuf.buf, Buffer.concat([new Buffer(header), toUTF8Bytes(str)]));
}

function assertBuffer(str, size, bufferSize) {
  var enc = codec.encodeObject(new Buffer(str));
  var dec = codec.decodeString();
  var ret = encodeDecode(size, enc, dec, bufferSize);
  expect(ret).toEqual([str]);
}

function toUTF8Bytes(str) {
  var buf = new Buffer(Buffer.byteLength(str));
  buf.write(str);
  return buf;
}
