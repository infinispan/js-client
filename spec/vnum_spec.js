var _ = require("underscore");
var vnum = require("../lib/vnum");
var f = require("../lib/functional");

// Temporary functions - to be moved

function encodeUByte(bytebuf, byte) {
  var newOffset = bytebuf.buf.writeUInt8(byte, bytebuf.offset);
  return {buf: bytebuf.buf, offset: newOffset};
}

var mEncodeUByte = f.lift(encodeUByte);

// Test functions

function identityState(_, state) { return state; }

//function identityValues(values, _) { return values; }
//function logState(elem) {
//  console.log(elem.buf.toJSON());
//  console.log(elem.offset);
//}

var singleByteEncode = f.actions([mEncodeUByte(0xA0)], identityState);
var multiByteEncode = f.actions([mEncodeUByte(0xA0), mEncodeUByte(0xA1)], identityState);

//var multiByteEncodeInter = f.actions([mEncodeUByte(0xA0), mEncodeUByte(0xA1)], identityValues);

// Tests

describe("Encoder", function() {
  //it("can encode a multiple bytes with pipeline logging intermediate state", function() {
  //  var stackAction = f.actions([mEncodeUByte(0xA0), mEncodeUByte(0xA1)],
  //      function(values, state) {
  //        return values;
  //      });
  //  var ret = stackAction({buf: new Buffer(2), offset: 0});
  //  console.log("Final");
  //  console.log(ret)
  //});
  //it("can encode a multiple bytes with pipeline logging intermediate state", function() {
  //  var initial = {buf: new Buffer(2), offset: 0};
  //  var result = f.pipeline(initial, multiByteEncodeInter, _.chain).each(logState);
  //  console.log(result)
  //  expect(result.buf.readUInt8(0)).toBe(0xA0);
  //  expect(result.buf.readUInt8(1)).toBe(0xA1);
  //  expect(result.offset).toBe(2);
  //});
  it("can encode a multiple bytes with actions", function() {
    var initial = {buf: new Buffer(2), offset: 0};
    var result = multiByteEncode(initial);
    expect(result.buf.readUInt8(0)).toBe(0xA0);
    expect(result.buf.readUInt8(1)).toBe(0xA1);
    expect(result.offset).toBe(2);
  });
  it("can encode a single byte with actions", function() {
    var initial = {buf: new Buffer(1), offset: 0};
    var result = singleByteEncode(initial);
    expect(result.buf.readUInt8()).toBe(0xA0);
    expect(result.offset).toBe(1);
  });
  it("can encode a single byte", function() {
    var initial = {buf: new Buffer(1), offset: 0};
    var result = encodeUByte(initial, 0xA0);
    expect(result.buf.readUInt8()).toBe(0xA0);
    expect(result.offset).toBe(1);
  })
});

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