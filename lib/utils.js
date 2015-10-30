(function() {

  var _ = require("underscore");
  var f = require("./functional");

  function Container(val) {
    this._value = val;
  }

  //var IncrementMixin = {
  //  update: function (fun /*, args */) {
  //    var args = _.rest(arguments);
  //    var oldValue = this._value;
  //    this._value = fun.apply(this, f.construct(oldValue, args));
  //    return this._value;
  //  },
  //  _incr: function () {
  //    return this.update(function (n) { return n + 1 });
  //  }
  //};

  var IncrementMixin = (function() {
    function update(obj, fun /*, args */) {
      var args = _.rest(arguments);
      var oldValue = obj._value;
      obj._value = fun.apply(obj, f.construct(oldValue, args));
      return obj._value;
    }

    return {
      _incr: function () {
        return update(this, function (n) { return n + 1 });
      }
    };
  }());

  //var Counter = function(val) {
  //  // The use of the Container.call method taking the Hole instance’s this
  //  // pointer ensures that what‐ ever Container does on construction will
  //  // occur in the context of the Hole instance
  //  Container.call(this, val);
  //};

  _.extend(Container.prototype
      , IncrementMixin);

  exports.counter = counter;
  function counter(value) {
    return new Container(value);
  }

  exports.incr = f.invoker('_incr', Container.prototype._incr);
  //exports.update = f.invoker('update', Container.prototype.update);

}.call(this));