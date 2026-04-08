(function() {

  var _ = require('underscore');

  /**
   * Checks whether a value exists (is not null or undefined).
   * @param {*} x Value to check.
   * @returns {boolean} True if the value is not null or undefined.
   */
  function existy(x) { return x != null; }
  exports.existy = existy;

  /**
   * Concatenates multiple arrays into a single array.
   * @param {...Array} arguments Arrays to concatenate.
   * @returns {Array} Concatenated array.
   */
  function cat() {
    var head = _.first(arguments);
    if (existy(head))
      return head.concat.apply(head, _.rest(arguments));
    else
      return [];
  }
  exports.cat = cat;

  /**
   * Prepends a head element to a tail collection, returning a new array.
   * @param {*} head Element to prepend.
   * @param {Array|Arguments} tail Collection to append after head.
   * @returns {Array} New array with head followed by tail elements.
   */
  function construct(head, tail) {
    return cat([head], _.toArray(tail));
  }
  exports.construct = construct;

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

  exports.greaterThan = exports.curry2(function (lhs, rhs) { return lhs > rhs; });
  exports.lessThan = exports.curry2(function (lhs, rhs) { return lhs < rhs; });

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

  // TODO: Optimizations opportunity: actually, just use pipelining for this!
  // If needed, provide actions that do not produce intermediate results to
  // reduce cost of method. This would work potentially in the buffer + offset
  // case, by directly updating the offset instead of returning the new offset.

  exports.actions = function actions(acts, done) {
    return function (seed) {
      var init = { values: [], state: seed };

      var intermediate = _.reduce(acts, function (stateObj, action) {
        var result = action(stateObj.state);
        var values = exports.cat(stateObj.values, [result.answer]);
        return {values: values, state: result.state};
      }, init);

      var keep = _.filter(intermediate.values, existy);

      return done(keep, intermediate.state);
    };
  };

  /**
   * Maps a function over a collection and concatenates the results.
   * @param {Function} fun Mapping function returning arrays.
   * @param {Array} coll Collection to map over.
   * @returns {Array} Concatenated results.
   */
  function mapcat(fun, coll) {
    return cat.apply(null, _.map(coll, fun));
  }

  exports.condition1 = function condition1(/* validators */) {
    var validators = _.toArray(arguments);

    return function(fun, arg) {
      var errors = mapcat(function(isValid) {
        return isValid(arg) ? []
          : [_.isFunction(isValid.message) ? isValid.message.apply(arg) : isValid.message];
      }, validators);

      if (!_.isEmpty(errors))
        throw new Error(errors.join(', '));

      return fun(arg);
    };
  };

  exports.validator = function validator(message, fun) {
    var f = function(/* args */) {
      return fun.apply(fun, arguments);
    };

    f['message'] = message;
    return f;
  };

  exports.truthy = truthy;
  /**
   * Checks whether a value is truthy (not false, null, or undefined).
   * @param {*} x Value to check.
   * @returns {boolean} True if the value is truthy.
   */
  function truthy(x) { return (x !== false) && existy(x); }

  /**
   * Executes an action if the condition is truthy, otherwise returns undefined.
   * @param {*} cond Condition to evaluate.
   * @param {Function} action Function to invoke if condition is truthy.
   * @returns {*} Result of action if condition is truthy, undefined otherwise.
   */
  function doWhen(cond, action) {
    if(truthy(cond))
      return action();
    else
      return undefined;
  }

  exports.invoker = function invoker (NAME, METHOD) {
    return function(target /* args ... */) {
      if (!existy(target)) throw new Error('Must provide a target');

      var targetMethod = target[NAME];
      var args = _.rest(arguments);

      return doWhen((existy(targetMethod) && METHOD === targetMethod), function() {
        return targetMethod.apply(target, args);
      });
    };
  };

  // Merge converts _.extend into a pure function. Instead of using the first
  // argument as the target object, it instead sticks a local empty object
  // into the front of _.extend’s arguments and mutate that instead.
  exports.merge = function(/*args*/) {
    return _.extend.apply(null, construct({}, arguments));
  };

  exports.dispatch = function(/* funs */) {
    var funs = _.toArray(arguments);
    var size = funs.length;

    return function(target /*, args */) {
      var ret;
      var args = _.rest(arguments);

      for (var funIndex = 0; funIndex < size; funIndex++) {
        var fun = funs[funIndex];
        ret = fun.apply(fun, construct(target, args));

        if (existy(ret)) return ret;
      }

      return ret;
    };
  };

  exports.isa = function(type, action) {
    return function(obj) {
      if (type === obj)
        return action(obj);
    };
  };

}.call(this));
