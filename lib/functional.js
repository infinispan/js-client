(function() {

  var _ = require("underscore");

  function cat() {
    var head = _.first(arguments);
    if (existy(head))
      return head.concat.apply(head, _.rest(arguments));
    else
      return [];
  }

  function construct(head, tail) {
    return cat([head], _.toArray(tail));
  }

  exports.partial1 = function partial1(fun, arg1) {
    return function(/* args */) {
      var args = construct(arg1, arguments);
      return fun.apply(fun, args);
    };
  };

  exports.partial2 = function _partial2(fun, arg1, arg2) {
    return function(/* args */) {
      var args = exports.cat([arg1, arg2], arguments);
      return fun.apply(fun, args);
    };
  };

  exports.partial3 = function _partial3(fun, arg1, arg2, arg3) {
    return function(/* args */) {
      var args = exports.cat([arg1, arg2, arg3], arguments);
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

  exports.greaterThan = module.exports.curry2(function (lhs, rhs) { return lhs > rhs });
  exports.lessThan = module.exports.curry2(function (lhs, rhs) { return lhs < rhs });

  exports.lift = function lift(answerFun, stateFun) {
    return function(/* args */) {
      var args = _.toArray(arguments);

      return function(state) {
        var ans = answerFun.apply(null, exports.construct(state, args));
        var s = stateFun ? stateFun(state) : ans;

        return {answer: ans, state: s};
      };
    };
  };

  // If needed, provide actions that do not produce intermediate results to
  // reduce cost of method. This would work potentially in the buffer + offset
  // case, by directly updating the offset instead of returning the new offset.

  exports.actions = function actions(acts, done) {
    return function (seed) {
      var init = { values: [], state: seed };

      var intermediate = _.reduce(acts, function (stateObj, action) {
        //console.log("stateObj before");
        //console.log(stateObj);
        var result = action(stateObj.state);
        //console.log("stateObj after:");
        //console.log(stateObj);

        //console.log("result.answer:");
        //console.log(result.answer);
        //console.log("stateObj.values:");
        //console.log(stateObj.values);
        var values = exports.cat(stateObj.values, [result.answer]);
        //console.log("Values");
        //console.log(values);
        //console.log("Answer");
        //console.log(result.answer)
        var ret = {values: values, state: result.state};
        //console.log("ret:");
        //console.log(ret);
        return ret;
      }, init);

      var keep = _.filter(intermediate.values, existy);

      return done(keep, intermediate.state);
    };
  };

  exports.construct = function construct(head, tail) {
    return exports.cat([head], _.toArray(tail));
  };

  function existy(x) { return x != null }

  exports.cat = function cat() {
    var head = _.first(arguments);
    if (existy(head))
      return head.concat.apply(head, _.rest(arguments));
    else
      return [];
  }

  function mapcat(fun, coll) {
    return cat.apply(null, _.map(coll, fun));
  }

  exports.condition1 = function condition1(/* validators */) {
    var validators = _.toArray(arguments);

    return function(fun, arg) {
      var errors = mapcat(function(isValid) {
        return isValid(arg) ? [] : [isValid.message];
      }, validators);

      if (!_.isEmpty(errors))
        throw new Error(errors.join(", "));

      return fun(arg);
    };
  };

  exports.validator = function validator(message, fun) {
    var f = function(/* args */) {
      return fun.apply(fun, arguments);
    };

    f['message'] = message;
    return f;
  }

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


