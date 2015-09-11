(function() {
  var Router, View, app, compileETag, compileQueryParser, compileTrust, debug, deprecate, exports, finalhandler, flatten, http, logerror, merge, methods, middleware, query, resolve, slice, trustProxyDefaultSymbol, tryRender;

  finalhandler = require('finalhandler');

  Router = require('./router');

  methods = require('methods');

  middleware = require('./middleware/init');

  query = require('./middleware/query');

  debug = require('debug')('express: application');

  View = require('./view');

  http = require('http');

  compileETag = require('./utils').compileETag;

  compileQueryParser = require('./utils').compileQueryParser;

  compileTrust = require('./utils').compileTrust;

  deprecate = require('depd')('express');

  flatten = require('array-flatten');

  merge = require('utils-merge');

  resolve = require('path').resolve;

  slice = Array.prototype.slice;

  app = exports = module.exports = {};

  trustProxyDefaultSymbol = '@@symbol:trust_proxy_default';

  logerror = function(err) {
    if (this.get('env') !== 'test') {
      console.error(err.stack || err.toString());
    }
  };

  tryRender = function(view, options, callback) {
    var error;
    try {
      view.render(options, callback);
    } catch (_error) {
      error = _error;
      callback(error);
    }
  };

  app.init = function() {
    this.cache = {};
    this.engines = {};
    this.settings = {};
    this.defaultConfiguration();
  };

  app.defaultConfiguration = function() {
    var env;
    env = process.env.NODE_ENV || 'development';
    this.enable('x-powered-by');
    this.set('etag', 'weak');
    this.set('env', env);
    this.set('query parser', 'extended');
    this.set('subdomain offset', 2);
    this.set('trust proxy', false);
    Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
      configurable: true,
      value: true
    });
    debug('booting in %s mode', env);
    this.on('mount', function(parent) {
      if (this.settings[trustProxyDefaultSymbol] === true && typeof parent.settings['trust proxy fn'] === 'function') {
        delete this.settings['trust proxy'];
        delete this.settings['trust proxy fn'];
      }
      this.request.__proto__ = parent.request;
      this.response.__proto__ = parent.response;
      this.engines.__proto__ = parent.engines;
      return this.settings.__proto__ = parent.settings;
    });
    this.locals = Object.create(null);
    this.mountpath = '/';
    this.locals.settings = this.settings;
    this.set('view', View);
    this.set('views', resolve('views'));
    this.set('jsonp callback name', 'callback');
    if (env === 'production') {
      this.enable('view cache');
    }
    Object.defineProperty(this, 'router', {
      get: function() {
        throw new Error('\'app.router\' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app.');
      }
    });
  };

  app.lazyrouter = function() {
    if (!this._router) {
      this._router = new Router({
        caseSensitive: this.enabled('case sensitive routing'),
        strict: this.enabled('strict routing')
      });
      this._router.use(query(this.get('query parser fn')));
      this._router.use(middleware.init(this));
    }
  };

  app.handle = function(req, res, callback) {
    var done, router;
    router = this._router;
    done = callback || finalhandler(req, res, {
      env: this.get('env'),
      onerror: logerror.bind(this)
    });
    if (!router) {
      debug('no routes defined on app');
      done();
      return;
    }
    router.handle(req, res, done);
  };

  app.use = function(fn) {
    var arg, fns, offset, path, router;
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
    fns = flatten(slice.call(arguments, offset));
    if (fns.length === 0) {
      throw new TypeError('app.use() requires middleware functions');
    }
    this.lazyrouter();
    router = this._router;
    fns.forEach(function(fn) {
      if (!fn || !fn.handle || !fn.set) {
        return router.use(path, fn);
      }
      debug('.use app under %s', path);
      fn.mountpath = path;
      fn.parent = this;
      router.use(path, function(req, res, next) {
        var orig;
        orig = req.app;
        return fn.handle(req, res, function(err) {
          req.__proto__ = orig.request;
          res.__proto__ = orig.response;
          return next(err);
        });
      });
      return fn.emit('mount', this);
    }, this);
    return this;
  };

  app.route = function(path) {
    this.lazyrouter();
    return this._router.route(path);
  };

  app.engine = function(ext, fn) {
    var extension;
    if (typeof fn !== 'function') {
      throw new Error('callback function required');
    }
    extension = ext[0] !== '.' ? '.' + ext : ext;
    this.engines[extension] = fn;
    return this;
  };

  app.param = function(name, fn) {
    var i, len, nm;
    this.lazyrouter();
    if (Array.isArray(name)) {
      for (i = 0, len = name.length; i < len; i++) {
        nm = name[i];
        this.param(nm, fn);
      }
      return this;
    }
    this._router.param(name, fn);
    return this;
  };

  app.set = function(setting, val) {
    if (arguments.length === 1) {
      return this.settings[setting];
    }
    debug('set "%s" to %o', setting, val);
    this.settings[setting] = val;
    switch (setting) {
      case 'etag':
        this.set('etag fn', compileETag(val));
        break;
      case 'query parser':
        this.set('query parser fn', compileQueryParser(val));
        break;
      case 'trust proxy':
        this.set('trust proxy fn', compileTrust(val));
        Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
          configurable: true,
          value: false
        });
        break;
    }
    return this;
  };

  app.path = function() {
    if (this.parent) {
      return this.parent.path() + this.mountpath;
    } else {
      return '';
    }
  };

  app.enabled = function(setting) {
    return Boolean(this.set(setting));
  };

  app.disabled = function(setting) {
    return !this.set(setting);
  };

  app.enable = function(setting) {
    return this.set(setting, true);
  };

  app.disable = function(setting) {
    return this.set(setting, false);
  };

  methods.forEach(function(method) {
    app[method] = function(path) {
      var route;
      if (method === 'get' && arguments.length === 1) {
        return this.set(path);
      }
      this.lazyrouter();
      route = this._router.route(path);
      route[method].apply(route, slice.call(arguments, 1));
      return this;
    };
  });

  app.all = function(path) {
    var args, i, len, method, route;
    this.lazyrouter();
    route = this._router.route(path);
    args = slice.call(arguments, 1);
    for (i = 0, len = methods.length; i < len; i++) {
      method = methods[i];
      route[method].apply(route, args);
    }
    return this;
  };

  app.del = deprecate["function"](app["delete"], 'app.del: Use app.delete instead');

  app.render = function(name, options, callback) {
    var _View, cache, dirs, done, engines, err, opts, renderOptions, view;
    cache = this.cache;
    done = callback;
    engines = this.engines;
    opts = options;
    renderOptions = {};
    if (typeof options === 'function') {
      done = options;
      opts = {};
    }
    merge(renderOptions, this.locals);
    if (opts._locals) {
      merge(renderOptions, opts._locals);
    }
    merge(renderOptions, opts);
    if (renderOptions.cache == null) {
      renderOptions.cache = this.enabled('view cache');
    }
    if (renderOptions.cache) {
      view = cache[name];
    }
    if (!view) {
      _View = this.get('view');
      view = new _View(name, {
        defaultEngine: this.get('view engine'),
        root: this.get('views'),
        engines: engines
      });
      if (!view.path) {
        dirs = Array.isArray(view.root) && view.root.length > 1 ? 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"' : 'directory "' + view.root + '"';
        err = new Error('Failed to lookup view "' + name + '" in views ' + dirs);
        err.view = view;
        return done(err);
      }
      if (renderOptions.cache) {
        cache[name] = view;
      }
    }
    tryRender(view, renderOptions, done);
  };

  app.listen = function() {
    var server;
    server = http.createServer(this);
    return server.listen.apply(server, arguments);
  };

}).call(this);
