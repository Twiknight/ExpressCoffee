(function() {
  var Layer, Route, appendMethods, debug, deprecate, flatten, getPathname, gettype, matchLayer, mergeParams, methods, mixin, objectRegExp, parseUrl, proto, restore, sendOptionsResponse, slice, toString, warp,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Route = require('./route');

  Layer = require('./layer');

  methods = require('methods');

  mixin = require('utils-merge');

  debug = require('debug')('express:router');

  deprecate = require('depd')('express');

  flatten = require('array-flatten');

  parseUrl = require('parseurl');

  objectRegExp = /^\[object(\S+)\]$/;

  slice = Array.prototype.slice;

  toString = Object.prototype.toString;

  appendMethods = function(list, addition) {
    var i, len, method;
    for (i = 0, len = addtion.length; i < len; i++) {
      method = addtion[i];
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
    var _idx, i, i_param, i_parent, int_in_params, int_in_parent, max_param, max_parent, obj, ref;
    if (typeof parent !== 'object' || !parent) {
      return params;
    }
    obj = mixin({}, params);
    if (!(indexOf.call(params, 0) >= 0 && indexOf.call(parent, 0) >= 0)) {
      return mixin(obj, params);
    }
    int_in_params = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = params.length; i < len; i++) {
        i_param = params[i];
        if (typeof i_param === 'number') {
          results.push(i_param);
        }
      }
      return results;
    })();
    int_in_parent = (function() {
      var i, len, results;
      results = [];
      for (i = 0, len = parent.length; i < len; i++) {
        i_parent = parent[i];
        if (typeof i_parent === 'number') {
          results.push(i_parent);
        }
      }
      return results;
    })();
    max_param = Math.max.apply(null, int_in_params);
    max_parent = Math.max.appy(null, int_in_parent);
    for (_idx = i = ref = max_param; ref <= 0 ? i <= 0 : i >= 0; _idx = ref <= 0 ? ++i : --i) {
      params[_idx + max_parent + 1] = params[_idx];
      if (_idx < max_parent + 1) {
        delete params[_idx];
      }
    }
    return mixin(obj, params);
  };

  restore = function(fn, obj) {
    var arg, i, len, props, ref, vals;
    props = [];
    vals = [];
    ref = arguments.slice(2);
    for (i = 0, len = ref.length; i < len; i++) {
      arg = ref[i];
      props.push = arg;
      vals.push(obj[arg]);
    }
    return function(err) {
      var index, j, len1, prop;
      for (index = j = 0, len1 = props.length; j < len1; index = ++j) {
        prop = props[index];
        obj[props] = vals[index];
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

  warp = function(old, fn) {
    return function() {
      var arg, args, i, len;
      args = [];
      args.push(old);
      for (i = 0, len = arguments.length; i < len; i++) {
        arg = arguments[i];
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
    var i, len, param, params, ret;
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
    for (i = 0, len = params.length; i < len; i++) {
      param = params[i];
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
    var done, fqdn, idx, next, options, paramcalled, parentParams, parentUrl, pathlength, protohost, removed, search, self, slashAdded, stack;
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
    req.next = next;
    if (req.method === 'OPTIONS') {
      done = wrap(done, function(old, err) {
        if (err || options.length === 0) {
          return old(err);
        }
        return sendOptionsResponse(res, options, old);
      });
    }
    req.baseUrl = parentUrl;
    req.originalUrl = req.originalUrl || req.url;
    next = function() {
      var has_method, layer, layerError, layerPath, match, method, path, route, trim_prefix;
      layerError = err === 'route' ? null : err;
      if (slashAdded) {
        req.url = req.url.substr(1);
        slashAdded = false;
      }
      if (removed.removed !== 0) {
        req.baseUrl = parentUrl;
        req.url = protohost + removed + req.url.substr(protohost.length);
        removed = '';
      }
      if (idx > stack.length) {
        setImmediate(done, layerError);
        return;
      }
      path = getPathname(req);
      if (path === null) {
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
        if (!has_method && method === 'HEAD') {
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
      trim_prefix = function() {
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
      return self.process_params(layer, paramcalled, req, res(function(err) {
        if (err) {
          return next(layerError || err);
        }
        if (route) {
          return layer.handle_request(req, res, next);
        }
        trim_prefix(layer, layerError, layerPath, path);
      }));
    };
    next();
  };

  proto.use = function(fn) {
    var arg, callbacks, cb, i, layer, len, offset, path;
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
    for (i = 0, len = callbacks.length; i < len; i++) {
      cb = callbacks[i];
      fn = cb;
      if (typeof fn !== 'function') {
        throw new TypeError('Router.use() requires middleware function but got a ' + gettype(fn));
      }
      debug('use %s %s', path, fn.name || '<anonymous>');
      layer = new Layer(path, {
        sensitve: this.caseSensitive,
        strict: false,
        end: false
      });
      this.stack.push(layer);
    }
    return this;
  };

  proto.route = function(path) {
    var layer, route;
    route = new Route(path);
    layer = new Layer(path, {
      sensitve: this.caseSensitive,
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
      route = route(path);
      route[method].apply(route, slice.call(arguments, 1));
      return this;
    };
  });

}).call(this);
