(function() {
  var Layer, Route, appendMethods, debug, deprecate, flatten, getPathname, gettype, matchLayer, mergeParams, methods, mixin, objectRegExp, parseUrl, proto, restore, sendOptionsResponse, slice, toString, wrap,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Route = require('./route');

  Layer = require('./layer');

  methods = require('methods');

  mixin = require('utils-merge');

  debug = require('debug')('express:router');

  deprecate = require('depd')('express');

  flatten = require('array-flatten');

  parseUrl = require('parseurl');

  objectRegExp = /^\[object (\S+)\]$/;

  slice = Array.prototype.slice;

  toString = Object.prototype.toString;

  appendMethods = function(list, addition) {
    var j, len, method;
    for (j = 0, len = addition.length; j < len; j++) {
      method = addition[j];
      if (indexOf.call(list, method) < 0) {
        list.push(method);
      }
    }
  };

  getPathname = function(req) {
    try {
      return parseUrl(req).pathname;
    } catch (_error) {
      return undifined;
    }
  };

  gettype = function(obj) {
    var type;
    type = typeof obj;
    if (type !== "object") {
      return type;
    }
    return toString.call(obj).replace(objectRegExp, '$1');
  };

  matchLayer = function(layer, path) {
    try {
      return layer.match(path);
    } catch (_error) {
      return _error;
    }
  };

  mergeParams = function(params, parent) {
    var i, o, obj;
    if (typeof parent !== 'object' || !parent) {
      return params;
    }
    obj = mixin({}, parent);
    if (!(0 in params && 0 in parent)) {
      return mixin(obj, params);
    }
    i = 0;
    o = 0;
    while (true) {
      if (i in params) {
        i += 1;
      } else {
        break;
      }
    }
    while (true) {
      if (o in parent) {
        o += 1;
      } else {
        break;
      }
    }
    i -= 1;
    while (i >= 0) {
      params[i + o] = params[i];
      if (i < o) {
        delete params[i];
      }
      i--;
    }
    return mixin(obj, params);
  };

  restore = function(fn, obj) {
    var idx, j, props, ref, vals;
    props = new Array(arguments.length - 2);
    vals = new Array(arguments.length - 2);
    for (idx = j = 0, ref = props.length; 0 <= ref ? j <= ref : j >= ref; idx = 0 <= ref ? ++j : --j) {
      props[idx] = arguments[idx + 2];
      vals[idx] = obj[props[idx]];
    }
    return function(err) {
      var index, k, ref1;
      for (index = k = 0, ref1 = props.length; 0 <= ref1 ? k <= ref1 : k >= ref1; index = 0 <= ref1 ? ++k : --k) {
        obj[props[index]] = vals[index];
      }
      return fn.apply(this, arguments);
    };
  };

  sendOptionsResponse = function(res, options, next) {
    var body;
    try {
      body = options.join(',');
      res.set('Allow', body);
      res.send(body);
    } catch (_error) {
      next(_error);
    }
  };

  wrap = function(old, fn) {
    return function() {
      var arg, args, j, len;
      args = [];
      args.push(old);
      for (j = 0, len = arguments.length; j < len; j++) {
        arg = arguments[j];
        args.push(arg);
      }
      fn.apply(this, args);
    };
  };

  proto = module.exports = function(options) {
    var opts, router;
    opts = options || {};
    router = function(req, res, next) {
      router.handle(req, res, next);
    };
    router.__proto__ = proto;
    router.params = {};
    router._params = [];
    router.caseSensitive = opts.caseSensitive;
    router.mergeParams = opts.mergeParams;
    router.strict = opts.strict;
    router.stack = [];
    return router;
  };

  proto.param = function(name, fn) {
    var j, len, param, params, ret;
    if (typeof name === 'function') {
      deprecate('router.param(fn): Refactor to use path params');
      this._params.push(name);
      return;
    }
    params = this._params;
    if (name[0] === ':') {
      deprecate('router.param(' + JSON.stringify(name) + ', fn):  Use router.param(' + JSON.stringify(name.substr(1)) + ', fn) instead');
      name = name.substr(1);
    }
    for (j = 0, len = params.length; j < len; j++) {
      param = params[j];
      if (ret = param(name, fn)) {
        fn = ret;
      }
    }
    if ('function' !== typeof fn) {
      throw new Error('invalid param() call for ' + name + ', got ' + fn);
    }
    (this.params[name] = this.params[name] || []).push(fn);
    return this;
  };

  proto.handle = function(req, res, out) {
    var done, fqdn, idx, next, options, paramcalled, parentParams, parentUrl, pathlength, protohost, removed, search, self, slashAdded, stack, trim_prefix;
    debug('dispatching %s %s', req.method, req.url);
    self = this;
    search = 1 + req.url.indexOf('?');
    pathlength = search ? search - 1 : req.url.length;
    fqdn = req.url[0] !== '/' && 1 + req.url.substr(0, pathlength).indexOf('://');
    protohost = fqdn ? req.url.substr(0, req.url.indexOf('/', 2 + fqdn)) : '';
    idx = 0;
    removed = "";
    slashAdded = false;
    paramcalled = {};
    options = [];
    stack = self.stack;
    parentParams = req.params;
    parentUrl = req.baseUrl || '';
    done = restore(out, req, 'baseUrl', 'next', 'params');
    trim_prefix = function(layer, layerError, layerPath, path) {
      var c;
      c = path[layerPath.length];
      if (c && '/' !== c && '.' !== c) {
        return next(layerError);
      }
      if (layerPath.length !== 0) {
        debug('trim prefix (%s) from url %s', layerPath, req.url);
        removed = layerPath;
        req.url = protohost + req.url.substr(protohost.length + removed.length);
        if (!fqdn && req.url[0] !== '/') {
          req.url = '/' + req.url;
          slashAdded = true;
        }
        req.baseUrl = parentUrl + (removed[removed.length - 1] === '/' ? removed.substring(0, removed.length - 1) : removed);
      }
      debug('%s %s : %s', layer.name, layerPath, req.originalUrl);
      if (layerError) {
        layer.handle_error(layerError, req, res, next);
      } else {
        layer.handle_request(req, res, next);
      }
    };
    next = function(err) {
      var has_method, layer, layerError, layerPath, match, method, path, route;
      layerError = err === 'route' ? null : err;
      if (slashAdded) {
        req.url = req.url.substr(1);
        slashAdded = false;
      }
      if (removed.length !== 0) {
        req.baseUrl = parentUrl;
        req.url = protohost + removed + req.url.substr(protohost.length);
        removed = '';
      }
      if (idx >= stack.length) {
        setImmediate(done, layerError);
        return;
      }
      path = getPathname(req);
      if (path == null) {
        return done(layerError);
      }
      while (match !== true && idx < stack.length) {
        layer = stack[idx++];
        match = matchLayer(layer, path);
        route = layer.route;
        if (typeof match !== 'boolean') {
          layerError = layerError || match;
        }
        if (match !== true) {
          continue;
        }
        if (!route) {
          continue;
        }
        if (layerError) {
          match = false;
          continue;
        }
        method = req.method;
        has_method = route._handles_method(method);
        if (!has_method && method === 'OPTIONS') {
          appendMethods(options, route._options());
        }
        if (!has_method && method !== 'HEAD') {
          match = false;
          continue;
        }
      }
      if (match !== true) {
        return done(layerError);
      }
      if (route) {
        req.route = route;
      }
      req.params = self.mergeParams ? mergeParams(layer.params, parentParams) : layer.params;
      layerPath = layer.path;
      self.process_params(layer, paramcalled, req, res, function(err) {
        if (err) {
          return next(layerError || err);
        }
        if (route) {
          return layer.handle_request(req, res, next);
        }
        trim_prefix(layer, layerError, layerPath, path);
      });
    };
    req.next = next;
    if (req.method === 'OPTIONS') {
      done = wrap(done, function(old, err) {
        if (err || options.length === 0) {
          return old(err);
        }
        sendOptionsResponse(res, options, old);
      });
    }
    req.baseUrl = parentUrl;
    req.originalUrl = req.originalUrl || req.url;
    next();
  };

  proto.process_params = function(layer, called, req, res, done) {
    var i, key, keys, name, param, paramCallback, paramCallbacks, paramCalled, paramIndex, paramVal, params;
    params = this.params;
    keys = layer.keys;
    paramCallbacks = void 0;
    paramCalled = void 0;
    paramVal = void 0;
    key = void 0;
    name = void 0;
    if (!keys || keys.length === 0) {
      return done();
    }
    i = 0;
    paramIndex = 0;
    param = function(err) {
      if (err) {
        return done(err);
      }
      if (i >= keys.length) {
        return done();
      }
      paramIndex = 0;
      key = keys[i++];
      if (!key) {
        return done();
      }
      name = key.name;
      paramVal = req.params[name];
      paramCallbacks = params[name];
      paramCalled = called[name];
      if (paramVal === void 0 || !paramCallbacks) {
        return param();
      }
      if (paramCalled && (paramCalled.match === paramVal || (paramCalled.error && paramCalled.error !== 'route'))) {
        req.params[name] = paramCalled.value;
        return param(paramCalled.error);
      }
      called[name] = paramCalled = {
        error: null,
        match: paramVal,
        value: paramVal
      };
      paramCallback();
    };
    paramCallback = function(err) {
      var error, fn;
      fn = paramCallbacks[paramIndex++];
      paramCalled.value = req.params[key.name];
      if (err) {
        paramCalled.error = err;
        param(err);
        return;
      }
      if (!fn) {
        return param();
      }
      try {
        fn(req, res, paramCallback, paramVal, key.name);
      } catch (_error) {
        error = _error;
        paramCallback(error);
      }
    };
    param();
  };

  proto.use = function(fn) {
    var arg, callbacks, cb, j, layer, len, offset, path;
    offset = 0;
    path = '/';
    if (typeof fn !== 'function') {
      arg = fn;
      while (Array.isArray(arg) && arg.length !== 0) {
        arg = arg[0];
      }
      if (typeof arg !== 'function') {
        offset = 1;
        path = fn;
      }
    }
    callbacks = flatten(slice.call(arguments, offset));
    if (callbacks.length === 0) {
      throw new TypeError('Router.use() requires middleware functions');
    }
    for (j = 0, len = callbacks.length; j < len; j++) {
      cb = callbacks[j];
      if (typeof cb !== 'function') {
        throw new TypeError('Router.use() requires middleware function but got a ' + gettype(cb));
      }
      debug('use %s %s', path, cb.name || '<anonymous>');
      layer = new Layer(path, {
        sensitive: this.caseSensitive,
        strict: false,
        end: false
      }, cb);
      layer.route = void 0;
      this.stack.push(layer);
    }
    return this;
  };

  proto.route = function(path) {
    var layer, route;
    route = new Route(path);
    layer = new Layer(path, {
      sensitive: this.caseSensitive,
      strict: this.strict,
      end: true
    }, route.dispatch.bind(route));
    layer.route = route;
    this.stack.push(layer);
    return route;
  };

  methods.concat('all').forEach(function(method) {
    proto[method] = function(path) {
      var route;
      route = this.route(path);
      route[method].apply(route, slice.call(arguments, 1));
      return this;
    };
  });

}).call(this);
