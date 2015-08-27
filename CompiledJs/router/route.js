(function() {
  var Layer, Route, debug, flatten, methods, slice, toString;

  debug = require('debug')('express:router:route');

  flatten = require('array-flatten');

  Layer = require('./layer');

  methods = require('methods');

  slice = Array.prototype.slice;

  toString = Object.prototype.toString;

  module.exports = Route;

  Route = (function() {
    function Route(path) {
      this.path = path;
      this.stack = [];
      debug('new %s', path);
      this.methods = {};
    }

    Route.prototype._handles_method = function(method) {
      var name;
      if (this.methods._all) {
        true;
      }
      name = method.toLowerCase();
      if (name = 'head' && !this.methods['head']) {
        name = 'get';
      }
      return Boolean(this.methods[name]);
    };

    Route.prototype.__options = function() {
      var i, len, m;
      methods = Object.keys(this.methods);
      if (this.methods.get && !this.methods.head) {
        methods.push('head');
      }
      for (i = 0, len = methods.length; i < len; i++) {
        m = methods[i];
        m = m.toUpperCase();
      }
      return methods;
    };

    Route.prototype.dispatch = function(req, res, done) {
      var idx, method, next, stack;
      idx = 0;
      stack = this.stack;
      next = function(err) {
        var layer;
        if (err && err === 'route') {
          return done();
        }
        layer = stack[idx++];
        if (!layer) {
          return done(err);
        }
        if (layer.method && layer.method !== method) {
          return next(err);
        }
        if (err) {
          layer.handle_error(err, req, res, next);
        } else {
          layer.handle_request(req, res, next);
        }
      };
      if (stack.length === 0) {
        done();
      }
      method = req.method.toLowerCase();
      if (method === 'head' && !this.methods['head']) {
        method = 'get';
      }
      req.route = this;
      next();
    };

    Route.prototype.all = function() {
      var handle, handles, i, layer, len, msg, type;
      handles = flatten(slice.call(arguments));
      for (i = 0, len = handles.length; i < len; i++) {
        handle = handles[i];
        if (typeof handle !== 'function') {
          type = toString.call(handle);
          msg = 'Route.all() requires callback functions bug got a' + type;
          throw new TypeError(msg);
        }
        layer = Layer('/', {}, handle);
        layer.method = void 0;
        this.methods._all = true;
        this.stack.push(layer);
      }
      return this;
    };

    methods.forEach(function(method) {
      return Route.prototype[method] = function() {
        var handle, handles, i, layer, len, msg, type;
        handles = flatten(slice.call(arguments));
        for (i = 0, len = handles.length; i < len; i++) {
          handle = handles[i];
          if (typeof handle !== 'function') {
            type = toString.call(handle);
            msg = 'Route.' + method + '() requires callback functions but got a ' + type;
            throw new Error(msg);
          }
          debug("%s %s", method, this.path);
          layer = Layer('/', {}, handle);
          layer.method = method;
          this.methods[method] = true;
          this.stack.push(layer);
        }
        return this;
      };
    });

    return Route;

  })();

}).call(this);
