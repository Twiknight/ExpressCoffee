(function() {
  var Layer, debug, hasOwnProperty, pathRegexp;

  pathRegexp = require('path-to-regexp');

  debug = require('debug')('express:router:layer');

  hasOwnProperty = Object.prototype.hasOwnProperty;

  Layer = (function() {
    var decode_param;

    decode_param = function(v) {
      var e;
      if (typeof v !== 'string' || v.length === 0) {
        return v;
      }
      try {
        return decodeURIComponent(v);
      } catch (_error) {
        e = _error;
        if (e instanceof URIError) {
          e.message = 'Failed to decode param \'' + v + '\'';
          e.status = e.statusCode = 400;
        }
        throw e;
      }
    };

    function Layer(path, options, fn) {
      var opts;
      if (!(this instanceof Layer)) {
        return new Layer(path, options, fn);
      }
      debug('new %s', path);
      opts = options || {};
      this.handle = fn;
      this.name = fn.name || '<anonymous>';
      this.params = void 0;
      this.path = void 0;
      this.regexp = pathRegexp(path, this.keys = [], opts);
      if (path === '/' && opts.end === false) {
        this.regexp.fast_slash = true;
      }
    }

    Layer.prototype.handle_error = function(error, req, res, next) {
      var fn;
      fn = this.handle;
      if (fn.length !== 4) {
        return next(error);
      }
      try {
        fn(error, req, res, next);
      } catch (_error) {
        next(_error);
      }
    };

    Layer.prototype.handle_request = function(req, res, next) {
      var fn;
      fn = this.handle;
      if (fn.length > 3) {
        return next();
      }
      try {
        fn(req, res, next);
      } catch (_error) {
        next(_error);
      }
    };

    Layer.prototype.match = function(path) {
      var i, key, keys, m, params, prop, val;
      if (path === null) {
        this.params = void 0;
        this.path = void 0;
        return false;
      }
      if (this.regexp.fast_slash) {
        this.params = {};
        this.path = '';
        return true;
      }
      m = this.regexp.exec(path);
      if (!m) {
        this.params = void 0;
        this.path = void 0;
        return false;
      }
      this.params = {};
      this.path = m[0];
      keys = this.keys;
      params = this.params;
      i = 1;
      while (true) {
        if (i >= m.length) {
          break;
        }
        key = keys[i - 1];
        prop = key.name;
        val = decode_param(m[i]);
        if (val !== void 0 || !hasOwnProperty.call(params, prop)) {
          params[prop] = val;
        }
        i += 1;
      }
      return true;
    };

    return Layer;

  })();

  module.exports = Layer;

}).call(this);
