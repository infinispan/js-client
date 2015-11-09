var _ = require('underscore');
var f = require('../lib/functional');

function div(n, d) { return n / d }

describe('Partial function application', function() {
  it('works with 2 parameters', function() {
    var div10By2 = f.partial2(div, 10, 2);
    expect(div10By2()).toBe(5);
  });
});

describe('Curried function application', function() {
  it('works with 2 parameters', function() {
    var div10By2 = f.curry2(div)(2)(10);
    expect(div10By2).toBe(5);
  });
});

function sqr(n) { return n * n; }
var mSqr  = f.lift(sqr);

var push = f.lift(function(stack, e) { return f.construct(e, stack) });
var pop = f.lift(_.first, _.rest);

describe('State-bearing action pipeline', function() {
  it('can pipeline calculating square twice', function() {
    var doubleSqr = f.actions([mSqr(), mSqr()],
        function(_, state) {
          return state;
        });
    expect(doubleSqr(10)).toBe(10000); // 10 * 10 -> 100; 100 * 100 -> 10000
  });
  it('can pipeline queue push and pop functions', function() {
    var stackAction = f.actions([push(1), push(2), pop()],
        function(values, state) {
          return values;
        });
    expect(stackAction([])).toEqual([[1], [2, 1], 2]);
  });
});

describe('Partial functions', function() {
  it('can be used to run preconditions for functions', function() {
    var sqrPre = f.condition1(
        f.validator('arg must be a number', _.isNumber));
    function uncheckedSqr(n) { return n * n }
    var checkedSqr = f.partial1(sqrPre, uncheckedSqr);
    expect(checkedSqr(10)).toBe(100);
  });
});

describe('Array concatenation', function() {
  it('can be used to concatenate arrays', function() {
    var a1 = [1,2,3];
    var a2 = [4,5,6];
    expect(f.cat(a1, a2)).toEqual([1,2,3,4,5,6]);
  });
});
