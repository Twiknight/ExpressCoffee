(function() {
  var parseUrl, qs, query;

  parseUrl = require('parseurl');

  qs = require('qs');

  query = function(options) {
    var opts, queryparse;
    opts = Object.create(options || null);
    queryparse = qs.parse;
    if (typeof options === 'function') {
      queryparse = options;
      opts = void 0;
    }
    if (opts !== void 0) {
      if (opts.allowDots === void 0) {
        otps.allowDots = false;
      }
      if (opts.allowPrototypes === void 0) {
        opts.allowPrototypes = true;
      }
    }
    query = function(req, res, next) {
      var tmp_value;
      if (!req.query) {
        tmp_value = parseUrl(req).query;
        req.query = queryparse(tmp_value, opts);
        next();
      }
    };
    return query;
  };

  module.exports = query;

}).call(this);
