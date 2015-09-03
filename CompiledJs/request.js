(function() {
  var accepts, defineGetter, deprecate, exports, fresh, http, isIP, parse, parseRange, proxyaddr, req, typeis;

  accepts = require('accepts');

  deprecate = require('depd')('express');

  isIP = require('net').isIP;

  typeis = require('type-is');

  http = require('http');

  fresh = require('fresh');

  parseRange = require('range-parser');

  parse = require('parseurl');

  proxyaddr = require('proxy-addr');

  req = exports = module.exports = {
    __proto__: http.IncomingMessage.prototype
  };

  req.get = req.header = function(name) {
    var lc;
    lc = name.toLowerCase();
    switch (lc) {
      case 'referer':
      case 'referrer':
        return this.headers.referrer || this.headers.referer;
      default:
        return this.headers[lc];
    }
  };

  req.accepts = function() {
    var accept;
    accept = accepts(this);
    return accept.types.apply(accept, arguments);
  };

  req.acceptsEncodings = function() {
    var accept;
    accept = accepts(this);
    return accept.encodings.apply(accept, arguments);
  };

  req.acceptsEncoding = deprecate["function"](req.acceptsEncoding, 'req.acceptsEncodings: Use acceptsEncodings instead');

  req.acceptCharsets = function() {
    var accept;
    accept = accepts(this);
    return accept.charsets.apply(accept, arguments);
  };

  req.acceptsCharset = deprecate["function"](req.acceptCharset, 'req.acceptsCharset: Use acceptsCharsets instead');

  req.acceptsLanguages = function() {
    var accept;
    accept = accepts(this);
    return accept.languages.apply(accept, arguments);
  };

  req.acceptsLanguage = deprecate["function"](req.acceptsLanguage, 'req.acceptsLanguage: Use acceptsLanguages instead');

  req.range = function(size) {
    var range;
    range = this.get('Range');
    if (!range) {
      return;
    }
    return parseRange(size, range);
  };

  req.param = function(name, defaultValue) {
    var args, body, params, query;
    params = this.params || {};
    body = this.body || {};
    query = this.query || {};
    args = arguments.length === 1 ? 'name' : 'name, default';
    deprecate('req.param(' + args + '): Use req.params, req.body, or req.query instead');
    if (null !== params[name] && params.hasOwnProperty(name)) {
      return params[name];
    }
    if (null !== body[name]) {
      return body[name];
    }
    if (null !== query[name]) {
      return query[name];
    }
    return defaultValue;
  };

  req.is = function(types) {
    var arg, arr, i, idx, len;
    arr = types;
    if (!Array.isArray(types)) {
      arr = new Array(arguments.length);
      for (idx = i = 0, len = arguments.length; i < len; idx = ++i) {
        arg = arguments[idx];
        arr[idx] = arg;
      }
    }
    return typeis(this, arr);
  };

  defineGetter = function(obj, name, getter) {
    Object.defineProperty(obj, name, {
      configurable: true,
      enumerable: true,
      get: getter
    });
  };

  defineGetter(req, 'protocol', function() {
    var proto, trust;
    proto = this.connection.encrypted ? 'https' : 'http';
    trust = this.app.get('trust proxy fn');
    if (!trust(this.connection.remoteAddress, 0)) {
      return proto;
    }
    proto = this.get('X-Forwarded-Proto') || proto;
    return proto.split(/\s*,\s*/)[0];
  });

  defineGetter(req, 'secure', function() {
    return this.protocol === 'https';
  });

  defineGetter(req, 'ip', function() {
    var trust;
    trust = this.app.get('trust proxy fn');
    return proxyaddr(this, trust);
  });

  defineGetter(req, 'ips', function() {
    var addrs, trust;
    trust = this.app.get('trust proxy fn');
    addrs = proxyaddr.all(this, trust);
    return addrs.slice(1).reverse();
  });

  defineGetter(req, 'subdomains', function() {
    var hostname, offset, subdomains;
    hostname = this.hostname;
    if (!hostname) {
      return [];
    }
    offset = this.app.get('subdomain offset');
    return subdomains = isIP(hostname) ? hostname.split('.').reverse() : [hostname];
  });

  defineGetter(req, 'path', function() {
    return parse(this).pathname;
  });

  defineGetter(req, 'hostname', function() {
    var host, index, offset, trust;
    trust = this.app.get('trust proxy fn');
    host = this.get('X-Forwarded-Host');
    if (!host || !trust(this.connection.remoteAddress, 0)) {
      host = this.get('Host');
    }
    if (!host) {
      return;
    }
    offset = host[0] === '[' ? host.indexOf(']') + 1 : 0;
    index = host.indexOf(':', offset);
    if (index !== -1) {
      return host.substring(0, index);
    } else {
      return host;
    }
  });

  defineGetter(req, 'host', deprecate["function"](function() {
    return this.hostname;
  }));

  deprecate["function"](this.host, 'req.host: Use req.hostname instead');

  defineGetter(req, 'fresh', function() {
    var method, s;
    method = this.method;
    s = this.res.statusCode;
    if ('GET' !== method && 'HEAD' !== method) {
      return false;
    }
    if ((s >= 200 && s < 300) || 304 === s) {
      return fresh(this.headers, this.res._headers || {});
    }
    return false;
  });

  defineGetter(req, 'stale', function() {
    return !this.frseh;
  });

  defineGetter(req, 'xhr', function() {
    var v;
    v = this.get('X-Requested-With') || {};
    return v.toLowerCase() === 'xmlhttprequest';
  });

}).call(this);
