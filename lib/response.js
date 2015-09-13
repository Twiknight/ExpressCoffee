(function() {
  var charsetRegExp, contentDisposition, cookie, deprecate, escapeHtml, extname, http, isAbsolute, merge, mime, normalizeType, normalizeTypes, onFinished, path, res, resolve, send, sendfile, setCharset, sign, statusCodes, vary,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  contentDisposition = require('content-disposition');

  deprecate = require('depd')('express');

  escapeHtml = require('escape-html');

  http = require('http');

  isAbsolute = require('./utils').isAbsolute;

  onFinished = require('on-finished');

  path = require('path');

  merge = require('utils-merge');

  sign = require('cookie-signature').sign;

  normalizeType = require('./utils').normalizeType;

  normalizeTypes = require('./utils').normalizeTypes;

  setCharset = require('./utils').setCharset;

  statusCodes = http.STATUS_CODES;

  cookie = require('cookie');

  send = require('send');

  extname = path.extname;

  mime = send.mime;

  resolve = path.resolve;

  vary = require('vary');

  res = module.exports = {
    __proto__: http.ServerResponse.prototype
  };

  charsetRegExp = /;\s*charset\s*=/;

  sendfile = function(res, file, options, callback) {
    var done, onaborted, ondirectory, onend, onerror, onfile, onfinish, onstream, streaming;
    done = false;
    streaming = void 0;
    onaborted = function() {
      var err;
      if (done) {
        return;
      }
      done = true;
      err = new Error('Request aborted');
      err.code = 'ECONNABORTED';
      callback(err);
    };
    ondirectory = function() {
      var err;
      if (done) {
        return;
      }
      done = true;
      err = new Error('EISDIR, read');
      err.code = 'EISDIR';
      callback(err);
    };
    onerror = function(err) {
      if (done) {
        return;
      }
      done = true;
      callback(err);
    };
    onend = function() {
      if (done) {
        return;
      }
      done = true;
      callback();
    };
    onfile = function() {
      streaming = false;
    };
    onfinish = function(err) {
      if (err && err.code === 'ECONNRESET') {
        return onaborted();
      }
      if (err) {
        return onerror(err);
      }
      if (done) {
        return;
      }
      setImmediate(function() {
        if (streaming !== false && !done) {
          onaborted();
          return;
        }
        if (done) {
          return;
        }
        done = true;
        return callback();
      });
    };
    onstream = function() {
      streaming = true;
    };
    file.on('directory', ondirectory);
    file.on('end', onend);
    file.on('error', onerror);
    file.on('file', onfile);
    file.on('stream', onstream);
    onFinished(res, onfinish);
    if (options.headers) {
      file.on('headers', function(res) {
        var i, key, keys, len1, obj;
        obj = options.headers;
        keys = Object.keys(obj);
        for (i = 0, len1 = keys.length; i < len1; i++) {
          key = keys[i];
          res.setHeader(key, obj[key]);
        }
      });
    }
    file.pipe(res);
  };

  res.status = function(code) {
    this.statusCode = code;
    return this;
  };

  res.links = function(links) {
    var link;
    link = this.get('Link') || '';
    if (link) {
      link += ', ';
    }
    return this.set('Link', link + Object.keys(links).map(function(rel) {
      return '<' + links[rel] + '>; rel="' + rel + '"';
    }).join(', '));
  };

  res.send = function(body) {
    var app, chunck, encoding, etag, generateETag, len, req, type;
    chunck = body;
    req = this.req;
    app = this.app;
    if (arguments.length === 2) {
      if (typeof arguments[0] !== 'number' && typeof arguments[1] === 'number') {
        deprecate('res.send(body, status): Use res.status(status).send(body) instead');
        this.statusCode = arguments[1];
      } else {
        deprecate('res.send(status,body): Use res.status(status).send(body) instead');
        this.statusCode = arguments[0];
        chunck = arguments[1];
      }
    }
    if (typeof chunck === 'number' && arguments.length === 1) {
      if (!this.get('Content-Type')) {
        this.type('txt');
      }
      deprecate('res.send(status): Use res.sendStatus(status) instead');
      this.statusCode = chunck;
      chunck = statusCodes[chunck];
    }
    switch (typeof chunck) {
      case 'string':
        if (!this.get('Content-Type')) {
          this.type('html');
        }
        break;
      case 'boolean':
      case 'number':
      case 'object':
        if (chunck === null) {
          chunck = '';
        } else if (Buffer.isBuffer(chunck)) {
          if (!this.get('Content-Type')) {
            this.type('bin');
          }
        } else {
          return this.json(chunck);
        }
        break;
    }
    if (typeof chunck === 'string') {
      encoding = 'utf8';
      type = this.get('Content-Type');
      if (typeof type === 'string') {
        this.set('Content-Type', setCharset(type, 'utf-8'));
      }
    }
    if (chunck !== void 0) {
      if (!Buffer.isBuffer(chunck)) {
        chunck = new Buffer(chunck, encoding);
        encoding = void 0;
      }
      len = chunck.length;
      this.set('Content-Length', len);
    }
    generateETag = len !== void 0 && app.get('etag fn');
    if (typeof generateETag === 'function' && !this.get('ETag')) {
      if ((etag = generateETag(chunck, encoding))) {
        this.set("ETag", etag);
      }
    }
    if (req.fresh) {
      this.statusCode = 304;
    }
    if (204 === this.statusCode || 304 === this.statusCode) {
      this.removeHeader('Content-Type');
      this.removeHeader('Content-Length');
      this.removeHeader('Transfer-Encoding');
      chunck = '';
    }
    if (req.method === 'HEAD') {
      this.end();
    } else {
      this.end(chunck, encoding);
    }
    return this;
  };

  res.json = function(obj) {
    var app, body, replacer, spaces, val;
    val = obj;
    if (arguments.length === 2) {
      if (typeof arguments[1] === 'number') {
        deprecate('res.json(obj, status): Use res.status(status).json(obj) instead');
        this.statusCode = arguments[1];
      } else {
        deprecate('res.json(status, obj): Use res.status(status).json(obj) instead');
        this.statusCode = arguments[0];
        val = arguments[1];
      }
    }
    app = this.app;
    replacer = app.get('json replacer');
    spaces = app.get('json spaces');
    body = JSON.stringify(val, replacer, spaces);
    if (!this.get('Content-Type')) {
      this.set('Content-Type', 'application/json');
    }
    return this.send(body);
  };

  res.jsonp = function(obj) {
    var app, body, callback, replacer, spaces, val;
    val = obj;
    if (arguments.length === 2) {
      if (typeof arguments[1] === 'number') {
        deprecate('res.jsonp(obj, status): Use res.status(status).json(obj) insetead');
        this.statusCode = arguments[1];
      } else {
        deprecate('res.jsonp(obj, status): Use res.status(status).json(obj) insetead');
        this.statusCode = arguments[0];
        val = arguments[1];
      }
    }
    app = this.app;
    replacer = app.get('json replacer');
    spaces = app.get('json spaces');
    body = JSON.stringify(val, replacer, spaces);
    callback = this.req.query[app.get('jsonp callback name')];
    if (!this.get('Content-Type')) {
      this.set('X-Content-Type-Options', 'nosniff');
      this.set('Content-Type', 'application/json');
    }
    if (Array.isArray(callback)) {
      callback = callback[0];
    }
    if (typeof callback === 'string' && callback.length !== 0) {
      this.charset = 'utf-8';
      this.set('X-Content-Type-Options', 'nosniff');
      this.set('Content-Type', 'text/javascript');
      callback = callback.replace(/[^\[\]\w$.]/g, '');
      body = body.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      body = '/**/ typeof ' + callback + ' === \'function\' && ' + callback + '(' + body + ');';
    }
    return this.send(body);
  };

  res.sendStatus = function(statusCode) {
    var body;
    body = statusCodes[statusCode] || String(statusCode);
    this.statusCode = statusCode;
    this.type('txt');
    return this.send(body);
  };

  res.sendFile = function(path, options, callback) {
    var done, file, next, opts, pathname, req;
    done = callback;
    req = this.req;
    res = this;
    next = req.next;
    opts = options || {};
    if (!path) {
      throw new TypeError('path argument is required to res.sendFile');
    }
    if (typeof options === 'function') {
      done = options;
      opts = {};
    }
    if (!opts.root && !isAbsolute(path)) {
      throw new TypeError('path must be absolute or specify root to res.sendFile');
    }
    pathname = encodeURI(path);
    file = send(req, pathname, opts);
    sendfile(res, file, opts, function(err) {
      if (done) {
        return done(err);
      }
      if (err && err.code === 'EISDIR') {
        return next();
      }
      if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write') {
        next(err);
      }
    });
  };

  res.sendfile = function(path, options, callback) {
    var done, file, next, opts, req;
    done = callback;
    req = this.req;
    res = this;
    next = req.next;
    opts = options || {};
    if (typeof options === 'function') {
      done = options;
      opts = {};
    }
    file = send(req, path, opts);
    return sendfile(res, file, opts, function(err) {
      if (done) {
        return done(err);
      }
      if (err && err.code === 'EISDIR') {
        return next();
      }
      if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write') {
        next(err);
      }
    });
  };

  res.sendfile = deprecate["function"](res.sendfile, 'res.sendfile: Use res.sendFile instead');

  res.download = function(path, filename, callback) {
    var done, fullpath, headers, name;
    done = callback;
    name = filename;
    if (typeof filename === 'function') {
      done = filename;
      name = null;
    }
    headers = {
      'Content-Disposition': contentDisposition(name || path)
    };
    fullpath = resolve(path);
    return this.sendFile(fullpath, {
      headers: headers
    }, done);
  };

  res.contentType = res.type = function(type) {
    var ct;
    ct = type.indexOf('/') === -1 ? mime.lookup(type) : type;
    return this.set('Content-Type', ct);
  };

  res.format = function(obj) {
    var err, fn, key, keys, next, req;
    req = this.req;
    next = req.next;
    fn = obj["default"];
    if (fn) {
      delete obj["default"];
    }
    keys = Object.keys(obj);
    key = keys.length > 0 ? req.accepts(keys) : false;
    this.vary('Accept');
    if (key) {
      this.set('Content-Type', normalizeType(key).value);
      obj[key](req, this, next);
    } else if (fn) {
      fn();
    } else {
      err = new Error('Not Acceptable');
      err.status = err.statusCode = 406;
      err.types = normalizeTypes(keys).map(function(o) {
        return o.value;
      });
      next(err);
    }
    return this;
  };

  res.attachment = function(filename) {
    if (filename) {
      this.type(extname(filename));
    }
    this.set('Content-Disposition', contentDisposition(filename));
    return this;
  };

  res.append = function(field, val) {
    var prev, value;
    prev = this.get(field);
    value = val;
    if (prev) {
      value = Array.isArray(prev) ? prev.concat(val) : Array.isArray(val) ? [prev].concat(val) : [prev, val];
    }
    return this.set(field, value);
  };

  res.set = res.header = function(field, val) {
    var charset, key, value;
    if (arguments.length === 2) {
      value = Array.isArray(val) ? val.map(String) : String(val);
      if (field.toLowerCase() === 'content-type' && !charsetRegExp.test(value)) {
        charset = mime.charsets.lookup(value.split(';')[0]);
        if (charset) {
          value += '; charset=' + charset.toLowerCase();
        }
      }
      this.setHeader(field, value);
    } else {
      for (key in field) {
        this.set(key, field[key]);
      }
    }
    return this;
  };

  res.get = function(field) {
    return this.getHeader(field);
  };

  res.clearCookie = function(name, options) {
    var opts;
    opts = merge({
      expires: new Date(1),
      path: '/'
    }, options);
    return this.cookie(name, '', opts);
  };

  res.cookie = function(name, value, options) {
    var opts, secret, signed, val;
    opts = merge({}, options);
    secret = this.req.secret;
    signed = opts.signed;
    if (signed && !secret) {
      throw New(Error('cookieParser("secret") required for signed cookie'));
    }
    val = typeof value === 'object' ? 'j:' + JSON.stringify(value) : String(value);
    if (signed) {
      val = 's:' + sign(val, secret);
    }
    if (indexOf.call(opts, 'maxAge') >= 0) {
      opts.expires = new Date(Date.now() + opts.maxAge);
      opts.maxAge /= 1000;
    }
    if (opts.path == null) {
      opts.path = '/';
    }
    this.append('Set-cookie', cookie.serialize(name, String(val), opts));
    return this;
  };

  res.location = function(url) {
    var loc;
    loc = url;
    if (url === 'back') {
      loc = this.req.get('Referrer') || '/';
    }
    this.set('Location', loc);
    return this;
  };

  res.redirect = function(url) {
    var address, body, status;
    address = url;
    status = 302;
    body = void 0;
    if (arguments.length === 2) {
      if (typeof arguments[0] === 'number') {
        status = arguments[0];
        address = arguments[1];
      } else {
        deprecate('res.redirect(url, status): Use res.redirect(status, url) instead');
        status = arguments[1];
      }
    }
    this.location(address);
    address = this.get('Location');
    this.format({
      text: function() {
        body = statusCodes[status] + '. Redirecting to ' + encodeURI(address);
      },
      html: function() {
        var u;
        u = escapeHtml(address);
        body = '<p>' + statusCodes[status] + '. Redirecting to <a href="' + u + '">' + u + '</a></p>';
      },
      "default": function() {
        body = '';
      }
    });
    this.statusCode = status;
    this.set('Content-Length', Buffer.byteLength(body));
    if (this.req.method === 'HEAD') {
      this.end();
    } else {
      this.end(body);
    }
  };

  res.vary = function(field) {
    if (!field || Array.isArray(field) && !field.length) {
      deprecate('res.vary(): Provide a field name');
      return this;
    }
    vary(this, field);
    return this;
  };

  res.render = function(view, options, callback) {
    var app, done, opts, req, self;
    app = this.req.app;
    done = callback;
    opts = options || {};
    req = this.req;
    self = this;
    if (typeof options === 'function') {
      done = options;
      opts = {};
    }
    opts._locals = self.locals;
    done = done || function(err, str) {
      if (err) {
        return req.next(err);
      }
      self.send(str);
    };
    return app.render(view, opts, done);
  };

}).call(this);
