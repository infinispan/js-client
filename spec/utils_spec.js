var utils = require('../lib/utils');

var t = require('./utils/testing'); // Testing dependency

describe('A counter', function() {
  it('can be incremented', function() {
    var counter = utils.counter(0);
    expect(counter.incr()).toBe(1);
    expect(counter.incr()).toBe(2);
    expect(counter.incr()).toBe(3);
  });
});

describe('A replayable buffer', function() {
  it('can have byte buffers appended to it', function() {
    var data = utils.replayableBuffer(0);
    data.append(new Buffer([48, 49, 50]));
    t.assertBuffer(new Buffer([48, 49, 50]), data.asBuffer());
  });
  it('can have byte buffers appended to it beyond its initial size', function() {
    var data = utils.replayableBuffer(0);
    data.append(new Buffer([48, 49, 50]));
    t.assertBuffer(new Buffer([48, 49, 50]), data.asBuffer());
  });
  it('can be appended multiple times without reading', function() {
    var data = utils.replayableBuffer(0);
    data.append(new Buffer([48, 49, 50]));
    data.append(new Buffer([51, 52, 53]));
    t.assertBuffer(new Buffer([48, 49, 50, 51, 52, 53]), data.asBuffer());
  });
});