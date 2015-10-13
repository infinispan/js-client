var f = require("../lib/functional");

function div(n, d) { return n / d }

describe("Partial function application", function() {
  it("works with 2 parameters", function() {
    var div10By2 = f.partial2(div, 10, 2);
    expect(div10By2()).toBe(5);
  });
});

describe("Curried function application", function() {
  it("works with 2 parameters", function() {
    var div10By2 = f.curry2(div)(2)(10);
    expect(div10By2).toBe(5);
  });
});

describe("A suite", function() {
  it("contains spec with an expectation", function() {
    expect(true).toBe(true);
  });
});