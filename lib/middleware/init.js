(function() {
  exports.init = function(app) {
    var expressInit;
    expressInit = function(req, res, next) {
      if (app.enabled('x-powered-by')) {
        res.setHeader('X-Powered-By', 'Express');
      }
      req.res = res;
      res.req = req;
      req.next = next;
      req.__proto__ = app.request;
      res.__proto__ = app.response;
      res.locals = res.locals || Object.create(null);
      return next();
    };
    return expressInit;
  };

}).call(this);
