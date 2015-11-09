var utils = require('../lib/utils');

// TODO: Sort out once counter has been constructed
describe('A counter', function() {
  it('can be incremented', function() {
    var counter = utils.counter(0);
    expect(counter.incr()).toBe(1);
    expect(counter.incr()).toBe(2);
    expect(counter.incr()).toBe(3);
  });
});