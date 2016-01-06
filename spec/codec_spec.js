'use strict';

var _ = require('underscore');
var f = require('../lib/functional');
var codec = require('../lib/codec');

var t = require('./utils/testing'); // Testing dependency

// Test functions

var singleByteEncode = f.actions([codec.encodeUByte(0xA0)], codec.bytesEncoded);
var multiByteEncode = f.actions([codec.encodeUByte(0xA0), codec.encodeUByte(0xA1)], codec.bytesEncoded);

var singleByteDecode = f.actions([codec.decodeUByte()], codec.allDecoded);
var multiByteDecode = f.actions([codec.decodeUByte(), codec.decodeUByte()], codec.allDecoded);
var singleVLongDecode = f.actions([codec.decodeVLong()], codec.allDecoded);
var multiVNumDecode = f.actions([codec.decodeVInt(), codec.decodeVLong()], codec.allDecoded);
var singleObjectDecode = f.actions([codec.decodeObject()], codec.allDecoded);
var multiObjectDecode = f.actions([codec.decodeObject(), codec.decodeObject()], codec.allDecoded);

// Tests

describe('Bytes encode/decode', function() {
  it('can resize buffer when encoding a number of Bytes', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var bytesEncode = f.actions([codec.encodeBytes(bytes)], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(1), bytesEncode, 8);
    var bytesDecode = f.actions([codec.decodeBytes(8)], codec.allDecoded);
    var actual = bytesDecode({buf: bytebuf.buf, offset: 0});
    expect(JSON.stringify(actual[0])).toBe(JSON.stringify(bytes));
  });
  it('can encode a number of Bytes', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var bytesEncode = f.actions([codec.encodeBytes(bytes)], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), bytesEncode, 8);
    var bytesDecode = f.actions([codec.decodeBytes(8)], codec.allDecoded);
    var actual = bytesDecode({buf: bytebuf.buf, offset: 0});
    expect(JSON.stringify(actual[0])).toBe(JSON.stringify(bytes));
  });
  it('can encode Object + Bytes + Object', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var encodeChain = f.actions([codec.encodeObject('one'), codec.encodeBytes(bytes), codec.encodeObject('two')], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), encodeChain, strSize('one') + 8 + strSize('two'));
    var decodeChain = f.actions([codec.decodeObject(), codec.decodeBytes(8), codec.decodeObject()], codec.allDecoded);
    var actual = decodeChain({buf: bytebuf.buf, offset: 0});
    expect(actual[0]).toBe('one');
    expect(JSON.stringify(actual[1])).toBe(JSON.stringify(bytes));
    expect(actual[2]).toBe('two');
  });
  it('can encode a chain of Bytes => Object', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var encodeChain = f.actions([codec.encodeBytes(bytes), codec.encodeObject('one')], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), encodeChain, 8 + strSize('one'));
    var decodeChain = f.actions([codec.decodeBytes(8), codec.decodeObject()], codec.allDecoded);
    var actual = decodeChain({buf: bytebuf.buf, offset: 0});
    expect(JSON.stringify(actual[0])).toBe(JSON.stringify(bytes));
    expect(actual[1]).toBe('one');
  });
  it('can encode a chain of Object => Bytes', function() {
    var bytes = new Buffer([48, 49, 50, 51, 52, 53, 54, 55]);
    var encodeChain = f.actions([codec.encodeObject('one'), codec.encodeBytes(bytes)], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), encodeChain, 8 + strSize('one'));
    var decodeChain = f.actions([codec.decodeObject(), codec.decodeBytes(8)], codec.allDecoded);
    var actual = decodeChain({buf: bytebuf.buf, offset: 0});
    expect(actual[0]).toBe('one');
    expect(JSON.stringify(actual[1])).toBe(JSON.stringify(bytes));
  });
});

describe('Object encode/decode', function() {
  it('can resize buffer when encoding a String', function() {
    var stringEncode = f.actions([codec.encodeObject('one two three four five six')], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(1), stringEncode, strSize('one two three four five six'));
    expect(singleObjectDecode({buf: bytebuf.buf, offset: 0})).toEqual(['one two three four five six']);
  });
  it('can encode a String', function() {
    var stringEncode = f.actions([codec.encodeObject('one')], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), stringEncode, strSize('one'));
    expect(singleObjectDecode({buf: bytebuf.buf, offset: 0})).toEqual(['one']);
  });
  it('can encode multiple Strings', function() {
    var stringEncode = f.actions([codec.encodeObject('one'), codec.encodeObject('two')], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), stringEncode, strSize('one') + strSize('two'));
    expect(multiObjectDecode({buf: bytebuf.buf, offset: 0})).toEqual(['one', 'two']);
  });
});

function strSize(str) {
  var len = Buffer.byteLength(str);
  return len + t.vNumSize(len);
}

describe('Variable number encode/decode', function() {
  it('can resize buffer when encoding a VInt', function() {
    var num = Math.pow(2, 31) - 1;
    var encode = f.actions([codec.encodeVInt(num)], codec.bytesEncoded);
    var decode = f.actions([codec.decodeVInt()], codec.allDecoded);
    var bytebuf = t.assertEncode(t.newByteBuf(1), encode, 5);
    expect(decode({buf: bytebuf.buf, offset: 0})).toEqual([num]);
  });
  it('can resize buffer when encoding a VLong', function() {
    var num = Math.pow(2, 53) - 1;
    var encode = f.actions([codec.encodeVLong(num)], codec.bytesEncoded);
    var decode = f.actions([codec.decodeVLong()], codec.allDecoded);
    var bytebuf = t.assertEncode(t.newByteBuf(1), encode, 8);
    expect(decode({buf: bytebuf.buf, offset: 0})).toEqual([num]);
  });
  it('can encode 0', function() {
    encodeDecodeVNum(0);
  });
  it('can encode 2^7 - 1', function() {
    encodeDecodeVNum(Math.pow(2, 7) - 1);
  });
  it('can encode 2^7', function() {
    encodeDecodeVNum(Math.pow(2, 7));
  });
  it('can encode 2^14 - 1', function() {
    encodeDecodeVNum(Math.pow(2, 14) - 1);
  });
  it('can encode 2^14', function() {
    encodeDecodeVNum(Math.pow(2, 14));
  });
  it('can encode 2^21 - 1', function() {
    encodeDecodeVNum(Math.pow(2, 21) - 1);
  });
  it('can encode 2^21', function() {
    encodeDecodeVNum(Math.pow(2, 21));
  });
  it('can encode 2^28 - 1', function() {
    encodeDecodeVNum(Math.pow(2, 28) - 1);
  });
  it('can encode 2^28', function() {
    encodeDecodeVNum(Math.pow(2, 28));
  });
  it('can encode 2^31 - 1', function() {
    encodeDecodeVNum(Math.pow(2, 31) - 1);
  });
  it('fails to encode 2^31 as a VInt because it is out of bounds', function() {
    var encode = f.actions([codec.encodeVInt(Math.pow(2, 31))], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()) }).toThrow('must be less than 2^31');
  });
  it('can encode 2^31', function() {
    encodeDecodeVLong(Math.pow(2, 31));
  });
  it('can encode 2^35 - 1', function() {
    encodeDecodeVLong(Math.pow(2, 35) - 1);
  });
  it('can encode 2^35', function() {
    encodeDecodeVLong(Math.pow(2, 35));
  });
  it('can encode 2^42 - 1', function() {
    encodeDecodeVLong(Math.pow(2, 42) - 1);
  });
  it('can encode 2^42', function() {
    encodeDecodeVLong(Math.pow(2, 42));
  });
  it('can encode 2^49 - 1', function() {
    encodeDecodeVLong(Math.pow(2, 49 - 1));
  });
  it('can encode 2^49', function() {
    encodeDecodeVLong(Math.pow(2, 49));
  });
  it('can encode 2^53 - 1', function() {
    encodeDecodeVLong(Math.pow(2, 53) - 1);
  });
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
});

function encodeDecodeVNum(num) {
  var expectedBytes = t.vNumSize(num);
  var numsEncode = f.actions([codec.encodeVInt(num), codec.encodeVLong(num)], codec.bytesEncoded);
  var bytebuf = t.assertEncode(t.newByteBuf(), numsEncode, expectedBytes * 2);
  expect(multiVNumDecode({buf: bytebuf.buf, offset: 0})).toEqual([num, num]);
}

function encodeDecodeVLong(num) {
  var expectedBytes = t.vNumSize(num);
  var bytebuf = t.newByteBuf();
  var encode = f.actions([codec.encodeVLong(num)], codec.bytesEncoded);
  expect(encode(bytebuf)).toBe(expectedBytes);
  expect(singleVLongDecode({buf: bytebuf.buf, offset: 0})).toEqual([num]);
}

describe('Basic encode/decode', function() {
  it('can resize buffer multiple times to write numbers', function() {
    var numbers = [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9];
    var encoders = _.map(numbers, function (num) { return codec.encodeUByte(num); });
    var decoders = _.map(numbers, function (num) { return codec.decodeUByte(); });
    var encodeActions = f.actions(encoders, codec.bytesEncoded);
    var decodeActions = f.actions(decoders, codec.allDecoded);
    var bytebuf = t.assertEncode(t.newByteBuf(1), encodeActions, 10);
    expect(decodeActions({buf: bytebuf.buf, offset: 0})).toEqual(numbers);
  });
  it('can resize buffer to write numbers', function() {
    var bytebuf = t.assertEncode(t.newByteBuf(1), multiByteEncode, 2);
    expect(multiByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0, 0xA1]);
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
    expect(function() { singleByteDecode({buf: bytebuf.buf, offset: 128}) }).toThrow();
  });
  it('can encode a byte with limit value 255', function() {
    var limitByteEncode = f.actions([codec.encodeUByte(0xFF)], codec.bytesEncoded);
    var bytebuf = t.assertEncode(t.newByteBuf(), limitByteEncode, 1);
    expect(singleByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xFF]);
  });
  it('can encode a multiple bytes with actions', function() {
    var bytebuf = t.assertEncode(t.newByteBuf(), multiByteEncode, 2);
    expect(multiByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0, 0xA1]);
  });
  it('can encode a single byte with actions', function() {
    var bytebuf = t.assertEncode(t.newByteBuf(), singleByteEncode, 1);
    expect(singleByteDecode({buf: bytebuf.buf, offset: 0})).toEqual([0xA0]);
  });
});
