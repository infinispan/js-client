var utils = require('../lib/utils');

var t = require('./utils/testing'); // Testing dependency

describe('A replayable buffer', function() {
  it('can have byte buffers appended to it', function() {
    var data = utils.replayableBuffer(0);
    data.append(new Buffer([48, 49, 50]));
    t.expectToBeBuffer(data.asBuffer(), new Buffer([48, 49, 50]));
  });
  it('can have byte buffers appended to it beyond its initial size', function() {
    var data = utils.replayableBuffer(0);
    data.append(new Buffer([48, 49, 50]));
    t.expectToBeBuffer(data.asBuffer(), new Buffer([48, 49, 50]));
  });
  it('can be appended multiple times without reading', function() {
    var data = utils.replayableBuffer(0);
    data.append(new Buffer([48, 49, 50]));
    data.append(new Buffer([51, 52, 53]));
    t.expectToBeBuffer(data.asBuffer(), new Buffer([48, 49, 50, 51, 52, 53]));
  });
});

describe('Address normalizer', function() {
  it('can normalize a single address', function() {
    var single = {port: 1234, host: '1.1.1.1'};
    var addr = utils.normalizeAddresses(single);
    expect(addr).toEqual([single]);
  });
  it('can normalize multiple address', function() {
    var multi = [{port: 1234, host: '1.1.1.1'}, {port: 2345, host: '2.2.2.2'}];
    var addrs = utils.normalizeAddresses(multi);
    expect(addrs).toEqual(multi);
  });
  it('can normalize when no addresses provided', function() {
    var local = {port: 11222, host: '127.0.0.1'};
    var addr = utils.normalizeAddresses();
    expect(addr).toEqual([local]);
  });
  it('throws an error when giving something unexpected', function() {
    expect(function() { return utils.normalizeAddresses('blah'); })
        .toThrow('Unknown server addresses: blah');
  });
});