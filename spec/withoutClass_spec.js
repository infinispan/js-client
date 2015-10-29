var woClass = require("../lib/withoutClass");

describe("Without class", function() {
  it("can expose operations", function() {
    console.log(woClass.contain(42));
  });
});
