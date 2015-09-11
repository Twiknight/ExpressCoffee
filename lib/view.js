(function() {
  var View, basename, debug, dirname, extname, fs, join, path, resolve, utils;

  debug = require('debug')('express: view');

  path = require('path');

  fs = require('fs');

  utils = require('./utils');

  dirname = path.dirname;

  basename = path.basename;

  extname = path.extname;

  join = path.join;

  resolve = path.resolve;

  View = (function() {
    var tryStat;

    tryStat = function(path) {
      debug('stat "%s"', path);
      try {
        return fs.statSync(path);
      } catch (_error) {
        return void 0;
      }
    };

    function View(name, options) {
      var fileName, opts;
      opts = options || {};
      this.defaultEngine = opts.defaultEngine;
      this.ext = extname(name);
      this.root = opts.root;
      if (!this.ext && !this.defaultEngine) {
        throw new Error('No default engine was specified and no extension was provided.');
      }
      fileName = name;
      if (!this.ext) {
        this.ext = this.defaultEngine[0] !== '.' ? '.' + this.defaultEngine : this.defaultEngine;
        fileName += this.ext;
      }
      if (!opts.engines[this.ext]) {
        opts.engines[this.ext] = require(this.ext.substr(1)).__express;
      }
      this.engine = opts.engines[this.ext];
      this.path = this.lookup(fileName);
    }

    View.prototype.lookup = function(name) {
      var _path, dir, file, i, len, loc, root, roots;
      roots = [].concat(this.root);
      debug('lookup "%s"', name);
      for (i = 0, len = roots.length; i < len; i++) {
        root = roots[i];
        if (!(!_path)) {
          continue;
        }
        loc = resolve(root, name);
        dir = dirname(loc);
        file = basename(loc);
        _path = this.resolve(dir, file);
      }
      return _path;
    };

    View.prototype.render = function(options, callback) {
      debug('render "%s"', this.path);
      this.engine(this.path, options, callback);
    };

    View.prototype.resolve = function(dir, file) {
      var ext, stat;
      ext = this.ext;
      path = join(dir, file);
      stat = tryStat(path);
      if (stat && stat.isFile()) {
        return path;
      }
      path = join(dir, basename(file, ext), 'index' + ext);
      stat = tryStat(path);
      if (stat && stat.isFile()) {
        return path;
      }
    };

    return View;

  })();

  module.exports = View;

}).call(this);
