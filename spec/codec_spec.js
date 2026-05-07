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

describe('Variable bytes decode', function() {
  it('can decode a variable sized byte array', function() {
    var bytes = Buffer.from([3, 49, 50, 51]);
    var actual = encodeDecode(4, codec.encodeBytes(bytes), codec.decodeVariableBytes(), 1);
    t.expectToBeBuffer(actual[0], Buffer.from([49, 50, 51]));
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
    assert('one', strSize('one'), codec.encodeString('one'), codec.decodeString());
  });
  it('can encode an undefined String with 0 length', function() {
    assert(0, 1, codec.encodeString(undefined), codec.decodeUByte());
  });
  it('can encode a String that fits exactly within buffer', function() {
    var str = t.randomStr(31);
    assert(str, 32, codec.encodeString(str), codec.decodeString(), 32);
  });
  it('can encode a String that needs expanding to include length', function() {
    // Length of String needs to be bigger than 8 bytes for expansion at String
    var str = t.randomStr(32);
    assert(str, 33, codec.encodeString(str), codec.decodeString(), 32);
  });
});

describe('Bytes encode/decode', function() {
  it('can resize buffer when encoding a number of Bytes', function() {
    var bytes = Buffer.from([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8, codec.encodeBytes(bytes), codec.decodeFixedBytes(8), 1);
    t.expectToBeBuffer(actual[0], bytes);
  });
  it('can encode a number of Bytes', function() {
    var bytes = Buffer.from([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8, codec.encodeBytes(bytes), codec.decodeFixedBytes(8));
    t.expectToBeBuffer(actual[0], bytes);
  });
  it('can encode Object + Bytes + Object', function() {
    var bytes = Buffer.from([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(strSize('one') + 8 + strSize('one'),
        [codec.encodeString('one'), codec.encodeBytes(bytes), codec.encodeString('two')],
        [codec.decodeString(), codec.decodeFixedBytes(8), codec.decodeString()]);
    expect(actual[0]).toBe('one');
    t.expectToBeBuffer(actual[1], bytes);
    expect(actual[2]).toBe('two');
  });
  it('can encode a chain of Bytes => Object', function() {
    var bytes = Buffer.from([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8 + strSize('one'),
        [codec.encodeBytes(bytes), codec.encodeString('one')],
        [codec.decodeFixedBytes(8), codec.decodeString()]);
    t.expectToBeBuffer(actual[0], bytes);
    expect(actual[1]).toBe('one');
  });
  it('can encode a chain of Object => Bytes', function() {
    var bytes = Buffer.from([48, 49, 50, 51, 52, 53, 54, 55]);
    var actual = encodeDecode(8 + strSize('one'),
        [codec.encodeString('one'), codec.encodeBytes(bytes)],
        [codec.decodeString(), codec.decodeFixedBytes(8)]);
    expect(actual[0]).toBe('one');
    t.expectToBeBuffer(actual[1], bytes);
  });
});

describe('Object encode/decode', function() {
  it('can resize buffer when encoding a String', function() {
    assert('one two three four five six', strSize('one two three four five six'),
           codec.encodeString('one two three four five six'), codec.decodeString(), 1);
  });
  it('can encode a String', function() {
    assert('one', strSize('one'), codec.encodeString('one'), codec.decodeString());
  });
  it('can encode multiple Strings', function() {
    assert(['one', 'two'], strSize('one') + strSize('two'),
           [codec.encodeString('one'), codec.encodeString('two')],
           [codec.decodeString(), codec.decodeString()]);
  });
});

/**
 * Calculates the encoded byte size of a string including its variable-length prefix.
 * @param {string} str - The string to measure.
 * @returns {number} Total encoded size in bytes.
 */
function strSize(str) {
  var len = Buffer.byteLength(str);
  return len + t.vNumSize(len);
}

describe('Variable number encode/decode', function() {
  it('can resize buffer when encoding a VInt', function() {
    assert(Math.pow(2, 32) - 1, 5, singleVIntEncode(Math.pow(2, 32) - 1), singleVIntDecode, 1);
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
  it('can encode 2^32 - 1', function() { encodeDecodeVNum(Math.pow(2, 32) - 1); });
  it('fails to encode 2^32 as a VInt because it is out of bounds', function() {
    var encode = f.actions([codec.encodeVInt(Math.pow(2, 32))], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()); }).toThrowError('must be less than 2^32');
  });
  it('can encode 2^32', function() { encodeDecodeVLong(Math.pow(2, 32)); });
  it('can encode 2^35 - 1', function() { encodeDecodeVLong(Math.pow(2, 35) - 1); });
  it('can encode 2^35', function() { encodeDecodeVLong(Math.pow(2, 35)); });
  it('can encode 2^42 - 1', function() { encodeDecodeVLong(Math.pow(2, 42) - 1); });
  it('can encode 2^42', function() { encodeDecodeVLong(Math.pow(2, 42)); });
  it('can encode 2^49 - 1', function() { encodeDecodeVLong(Math.pow(2, 49 - 1)); });
  it('can encode 2^49', function() { encodeDecodeVLong(Math.pow(2, 49)); });
  it('can encode 2^53 - 1', function() { encodeDecodeVLong(Math.pow(2, 53) - 1); });
  it('fails to encode 2^53 as a VLong because it is out of bounds', function() {
    var encode = f.actions([codec.encodeVLong(Math.pow(2, 53))], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()); })
        .toThrowError('must be less than 2^53 (javascript safe integer limitation)');
  });
  it('fails to encode a number when it is not a number', function() {
    var encode = f.actions([codec.encodeVInt('blah')], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()); })
        .toThrowError('must be a number, must be >= 0, must be less than 2^32');
  });
  it('fails to encode a number when it is negative', function() {
    var encode = f.actions([codec.encodeVInt(-1)], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()); }).toThrowError('must be >= 0');
  });

  /**
   * Encodes and decodes a number as both VInt and VLong, asserting round-trip correctness.
   * @param {number} num - The number to encode and decode.
   * @returns {void}
   */
  function encodeDecodeVNum(num) {
    assert([num, num], t.vNumSize(num) * 2, multiVNumEncode(num), multiVNumDecode);
  }
  /**
   * Encodes and decodes a number as a VLong, asserting round-trip correctness.
   * @param {number} num - The number to encode and decode.
   * @returns {void}
   */
  function encodeDecodeVLong(num) {
    assert(num, t.vNumSize(num), singleVLongEncode(num), singleVLongDecode);
  }
});

describe('Basic encode/decode', function() {
  it('can resize buffer multiple times to write numbers', function() {
    var numbers = [0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9];
    var encoders = _.map(numbers, function (num) { return codec.encodeUByte(num); });
    var decoders = _.map(numbers, function () { return codec.decodeUByte(); });
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
    expect(function() { invalidByteEncode(t.newByteBuf()); })
        .toThrowError('must be a number, must be >= 0');
  });
  it('fails to encode a number when it is negative', function() {
    var encode = f.actions([codec.encodeUByte(-1)], codec.bytesEncoded);
    expect(function() { encode(t.newByteBuf()); }).toThrowError('must be >= 0');
  });
  it('fails to encode a byte when the value is too big (256 or higher)', function() {
    var overLimitByteEncode = f.actions([codec.encodeUByte(0x100)], codec.bytesEncoded);
    expect(function() { overLimitByteEncode(t.newByteBuf()); }).toThrowError();
  });
  it('fails to decode if past the buffer end', function() {
    t.newByteBuf();
    expect(function() { f.actions([codec.decodeUByte()])(t.newByteBuf()); }).toThrowError();
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

/**
 * Encodes and decodes a value, asserting the result matches the expected output.
 * @param {*} expected - Expected decoded value or array of values.
 * @param {number} size - Expected encoded byte size.
 * @param {Function|Array<Function>} encoder - Encoder action(s).
 * @param {Function|Array<Function>} decoder - Decoder action(s).
 * @param {number} [bufferSize] - Optional initial buffer size.
 * @returns {void}
 */
function assert(expected, size, encoder, decoder, bufferSize) {
  var ret = encodeDecode(size, encoder, decoder, bufferSize);
  expect(ret).toEqual(_.isArray(expected) ? expected : [expected]);
}

/**
 * Encodes data into a buffer and decodes it back, returning the decoded values.
 * @param {number} size - Expected encoded byte size.
 * @param {Function|Array<Function>} encoder - Encoder action(s).
 * @param {Function|Array<Function>} decoder - Decoder action(s).
 * @param {number} [bufferSize] - Optional initial buffer size.
 * @returns {Array<*>} Array of decoded values.
 */
function encodeDecode(size, encoder, decoder, bufferSize) {
  var enc = f.actions(_.isArray(encoder) ? encoder : [encoder], codec.bytesEncoded);
  var bytebuf = t.assertEncode(t.newByteBuf(bufferSize), enc, size);
  var dec = f.actions(_.isArray(decoder) ? decoder : [decoder], codec.allDecoded(decoder.length));
  return dec({buf: bytebuf.buf, offset: 0});
}

var protobuf = require('protobufjs');
var path = require('path');

describe('wrapScalar', function() {
  var WrappedMessage;
  beforeAll(function() {
    var root = protobuf.loadSync(path.join(__dirname, '..', 'lib', 'protostream', 'message-wrapping.proto'));
    WrappedMessage = root.lookupType('org.infinispan.protostream.WrappedMessage');
  });

  it('wraps a string value', function() {
    var bytes = codec.wrapScalar('hello');
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(0);
    var decoded = WrappedMessage.decode(bytes);
    expect(decoded.wrappedString).toBe('hello');
  });

  it('wraps a number value', function() {
    var bytes = codec.wrapScalar(42.5);
    expect(bytes).toBeDefined();
    var decoded = WrappedMessage.decode(bytes);
    expect(decoded.wrappedDouble).toBe(42.5);
  });

  it('wraps a boolean value', function() {
    var bytes = codec.wrapScalar(true);
    expect(bytes).toBeDefined();
    var decoded = WrappedMessage.decode(bytes);
    expect(decoded.wrappedBool).toBe(true);
  });
});

describe('decodeContinuousQueryResult', function() {
  var ContinuousQueryResult;
  beforeAll(function() {
    var root = protobuf.loadSync(path.join(__dirname, '..', 'lib', 'protostream', 'query.proto'));
    protobuf.loadSync(path.join(__dirname, '..', 'lib', 'protostream', 'message-wrapping.proto'), root);
    ContinuousQueryResult = root.lookupType('org.infinispan.query.remote.client.ContinuousQueryResult');
  });

  it('decodes a JOINING result', function() {
    var keyBytes = Buffer.from('my-key');
    var valueBytes = Buffer.from('my-value');
    var msg = ContinuousQueryResult.create({resultType: 1, key: keyBytes, value: valueBytes});
    var encoded = ContinuousQueryResult.encode(msg).finish();
    var result = codec.decodeContinuousQueryResult(encoded);
    expect(result.resultType).toBe('joining');
    expect(Buffer.from(result.key)).toEqual(keyBytes);
    expect(Buffer.from(result.value)).toEqual(valueBytes);
  });

  it('decodes a LEAVING result', function() {
    var keyBytes = Buffer.from('my-key');
    var msg = ContinuousQueryResult.create({resultType: 0, key: keyBytes});
    var encoded = ContinuousQueryResult.encode(msg).finish();
    var result = codec.decodeContinuousQueryResult(encoded);
    expect(result.resultType).toBe('leaving');
    expect(Buffer.from(result.key)).toEqual(keyBytes);
  });

  it('decodes an UPDATED result', function() {
    var keyBytes = Buffer.from('my-key');
    var valueBytes = Buffer.from('new-value');
    var msg = ContinuousQueryResult.create({resultType: 2, key: keyBytes, value: valueBytes});
    var encoded = ContinuousQueryResult.encode(msg).finish();
    var result = codec.decodeContinuousQueryResult(encoded);
    expect(result.resultType).toBe('updated');
    expect(Buffer.from(result.key)).toEqual(keyBytes);
    expect(Buffer.from(result.value)).toEqual(valueBytes);
  });
});

describe('decodeWrappedMessage', function() {
  it('decodes a WrappedMessage with wrappedMessage field', function() {
    var inner = Buffer.from([0x0a, 0x05, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    var wmRoot = protobuf.loadSync(path.join(__dirname, '..', 'lib', 'protostream', 'message-wrapping.proto'));
    var WM = wmRoot.lookupType('org.infinispan.protostream.WrappedMessage');
    var msg = WM.create({wrappedMessage: inner, wrappedTypeId: 4403});
    var encoded = WM.encode(msg).finish();
    var decoded = codec.decodeWrappedMessage(encoded);
    expect(decoded.wrappedTypeId).toBe(4403);
    expect(Buffer.from(decoded.wrappedMessage)).toEqual(inner);
  });
});
