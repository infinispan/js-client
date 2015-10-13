var vnum = require("../lib/vnum");
var f = require("../lib/functional");

describe("Unchecked variable number encoder", function() {
  it("can encode positive numbers", function() {
    var buf = new Buffer(1);
    var result = vnum.encode(buf)(0, 0);
    expect(result.offset).toBe(1);
    expect(result.buffer.readUInt8()).toBe(0);
  });
  it("can encode using pipeline", function() {
    var encBuf = vnum.encode(new Buffer(1));
    var result = f.pipeline(encBuf(0, 0));
    expect(result.offset).toBe(1);
    expect(result.buffer.readUInt8()).toBe(0);
  });

  it("can encode2 positive numbers", function() {
    var buf = new Buffer(1);
    var result = vnum.encode2(buf, 0)(0);
    expect(result.offset).toBe(1);
    expect(result.buffer.readUInt8()).toBe(0);
  });
  it("can encode2 a single number using pipeline", function() {
    var encBuf = vnum.encode2(new Buffer(1), 0);
    var result = f.pipeline(encBuf(0));
    expect(result.offset).toBe(1);
    expect(result.buffer.readUInt8()).toBe(0);
  });
  it("can encode2 multiple numbers using pipeline", function() {
    var encBuf = vnum.encode2(new Buffer(1), 0);
    var result = f.pipeline(encBuf(0), encBuf(0));
    expect(result.offset).toBe(1);
    expect(result.buffer.readUInt8()).toBe(0);
  });

  //it("can encode using pipeline", function() {
  //  var enc0off0 = f.partial2(vnum.encode, 0, 0);
  //  var result = f.pipeline(new Buffer(1), enc0off0);
  //  expect(result.offset).toBe(1);
  //  expect(result.buffer.readUInt8()).toBe(0);
  //});
});

describe("A suite", function() {
  it("contains spec with an expectation", function() {
    expect(true).toBe(true);
  });
});