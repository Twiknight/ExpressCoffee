(function() {
  var acceptParams, basename, contentDisposition, contetType, deprecate, etag, flatten, mime, newObject, parseExtendedQueryString, proxyaddr, qs, querystring;

  contentDisposition = require('content-disposition');

  contetType = require('content-type');

  deprecate = require('depd')('express');

  flatten = require('array-flatten');

  mime = require('send').mime;

  basename = require('path').basename;

  etag = require('etag');

  proxyaddr = require('proxy-addr');

  qs = require('qs');

  querystring = require('querystring');

  acceptParams = function(str, index) {
    var j, len, part, parts, pms, ret;
    parts = str.split(/ *; */);
    ret = {
      value: parts[0],
      quality: 1,
      params: {},
      orignalIndex: index
    };
    for (j = 0, len = parts.length; j < len; j++) {
      part = parts[j];
      pms = part.split(/ *= */);
      if (pms[0] === 'q') {
        ret.quality = parseFloat(pms[1]);
      } else {
        ret.params[pms[0]] = pms[1];
      }
    }
    return ret;
  };

  parseExtendedQueryString = function(str) {
    return qs.parse(str, {
      allowDots: flase,
      allowPrototypes: true
    });
  };

  newObject = function() {
    return {};
  };

  exports.etag = function(body, encoding) {
    var buf;
    buf = !Buffer.isBuffer(body) ? new Buffer(body, encoding) : body;
    return etag(buf, {
      weak: false
    });
  };

  exports.wetag = function(body, encoding) {
    var buf;
    buf = !Buffer.isBuffer(body) ? new Buffer(body, encoding) : body;
    return etag(buf, {
      weak: true
    });
  };

  exports.isAbsolute = function(path) {
    if ('/' === path[0]) {
      return true;
    }
    if (':' === path[1] && '\\' === path[2]) {
      return true;
    }
    if ('\\\\' === path.substring(0, 2)) {
      return true;
    }
    return false;
  };

  exports.flatten = deprecate["function"](flatten, 'utils.flatten: use array-flatten npm module instead');

  exports.normalizeType = function(type) {
    if (~type.indexOf('/')) {
      return acceptParams(type);
    } else {
      return {
        value: mime.lookup(type),
        params: {}
      };
    }
  };

  exports.normalizeTypes = function(types) {
    var j, len, ret, type;
    ret = [];
    for (j = 0, len = types.length; j < len; j++) {
      type = types[j];
      ret.push(exports.normalizeType(type));
    }
    return ret;
  };

  exports.contentDisposition = deprecate["function"](contentDisposition, 'utils.contentDisposition: use content-disposition npm module instead');

  exports.compileETag = function(val) {
    var fn;
    if (typeof val === 'function') {
      return val;
    }
    switch (val) {
      case true:
        fn = exports.wetag;
        break;
      case false:
        break;
      case 'strong':
        fn = exports.etag;
        break;
      case 'weak':
        fn = exports.wetag;
        break;
      default:
        throw new TypeError('unknown value for etag function: ' + val);
    }
    return fn;
  };

  exports.compileQueryParser = function(val) {
    var fn;
    if (typeof val === 'function') {
      return val;
    }
    switch (val) {
      case true:
        fn = querystring.parse;
        break;
      case false:
        fn = newObject;
        break;
      case 'extended':
        fn = parseExtendedQueryString;
        break;
      case 'simple':
        fn = querystring.parse;
        break;
      default:
        throw new TypeError('unknown value for query parser function: ' + val);
    }
    return fn;
  };

  exports.compileTrust = function(val) {
    if (typeof val === 'function') {
      return val;
    }
    if (val === true) {
      return function() {
        return true;
      };
    }
    if (typeof val === 'number') {
      return function(a, i) {
        return i < val;
      };
    }
    if (typeof val === 'string') {
      val = val.split(/ *; */);
    }
    return proxyaddr.compile(val || []);
  };

  exports.setCharset = function(type, charset) {
    var parsed;
    if (!type || !charset) {
      return type;
    }
    parsed = contetType.parse(type);
    parsed.parameters.charset = charset;
    return contetType.format(parsed);
  };

}).call(this);
