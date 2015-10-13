(function() {

  var _ = require("underscore");

  exports.partial1 = function partial1(fun, arg1) {
    return function(/* args */) {
      var args = construct(arg1, arguments);
      return fun.apply(fun, args);
    };
  }

  exports.partial2 = function _partial2(fun, arg1, arg2) {
    return function(/* args */) {
      var args = cat([arg1, arg2], arguments);
      return fun.apply(fun, args);
    };
  };

  exports.partial3 = function _partial3(fun, arg1, arg2, arg3) {
    return function(/* args */) {
      var args = cat([arg1, arg2, arg3], arguments);
      return fun.apply(fun, args);
    };
  };

  exports.pipeline = function pipeline(seed /*, args */) {
    return _.reduce(_.rest(arguments),
                    function (l, r) { return r(l); },
                    seed);
  };

  exports.curry3 = function curry3(fun) {
    return function(thirdArg) {
      return function (secondArg) {
        return function (firstArg) {
          return fun(firstArg, secondArg, thirdArg);
        };
      };
    };
  };

  exports.curry2 = function curry2(fun) {
    return function(secondArg) {
      return function(firstArg) {
        return fun(firstArg, secondArg);
      };
    };
  };

  function construct(head, tail) {
    return cat([head], _.toArray(tail));
  }

  function cat() {
    var head = _.first(arguments);
    if (existy(head))
      return head.concat.apply(head, _.rest(arguments));
    else
      return [];
  }

  function existy(x) { return x != null }

}.call(this));

//var _ = require("underscore");
//
//exports.partial2 = function partial2(fun, arg1, arg2) {
//  return function(/* args */) {
//    var args = cat([arg1, arg2], arguments);
//    return fun.apply(fun, args);
//  };
//};
//
//function cat() {
//  var head = _.first(arguments);
//  if (existy(head))
//    return head.concat.apply(head, _.rest(arguments));
//  else
//    return [];
//}
//
//function existy(x) { return x != null }


