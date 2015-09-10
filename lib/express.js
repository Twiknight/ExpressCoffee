(function() {
  var EventEmitter, Route, Router, createApplication, exports, mixin, proto, req, res;

  EventEmitter = require('events').EventEmitter;

  mixin = require('merge-descriptors');

  proto = require('./application');

  Route = require('./router/route');

  Router = require('./router');

  req = require('./request');

  res = require('./response');

  createApplication = function() {
    var app;
    app = function(req, res, next) {
      app.handle(req, res, next);
    };
    mixin(app, EventEmitter.prototype, false);
    mixin(app, proto, false);
    app.request = {
      __proto__: req,
      app: app
    };
    app.response = {
      __proto__: res,
      app: app
    };
    app.init();
    return app;
  };

  exports = module.exports = createApplication;

  exports.application = proto;

  exports.request = req;

  exports.response = res;

  exports.Route = Route;

  exports.Router = Router;

  exports.query = require('./middleware/query');

  exports["static"] = require('serve-static');

  ['json', 'urlencoded', 'bodyParser', 'compress', 'cookieSession', 'session', 'logger', 'cookieParser', 'favicon', 'responseTime', 'errorHandler', 'timeout', 'methodOverride', 'vhost', 'csrf', 'directory', 'limit', 'multipart', 'staticCache'].forEach(function(name) {
    return Object.defineProperty(exports, name, {
      get: function() {
        throw new Error('Most middleware (like ' + name + ') is no longer bundled with Express and must be installed separately. Please see https://github.com/senchalabs/connect#middleware.');
      },
      configurable: true
    });
  });

}).call(this);
