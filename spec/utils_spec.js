var utils = require("../lib/utils");

// TODO: Sort out once counter has been constructed
describe("A counter", function() {
  it("can be incremented", function() {
    var counter = utils.counter(0);
    var incremented = utils.incr(counter);
    //console.log("Incremented: " + incremented);
    //console.log("Incremented: " + counter._incr());
    console.log(counter._value);
    counter._value = 5;
    //console.log("Incremented: " + utils.incr(counter));
    //console.log("Incremented: " + utils.update(counter));
    //console.log("Incremented: " + counter.update(function (n) { return n + 1 }));
  });
});