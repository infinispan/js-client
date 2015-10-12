describe("Variable number encoding", function() {
  it("to encode 0", function() {
    var buf = new Buffer(1);
    var result = encode(buf)(0, 0);
    expect(result.offset).toBe(1);
    expect(result.buffer.readUInt8).toBe(0);
    //expect(true).toBe(true);
  });
});

describe("A suite", function() {
  it("contains spec with an expectation", function() {
    expect(true).toBe(true);
  });
});