pathRegexp = require 'path-to-regexp'
debug = require('debug') 'express:router:layer'

hasOwnProperty = Object.prototype.hasOwnProperty

class Layer
  decode_param = (v)->
    if typeof v != 'string' || v.length == 0
      return v
    try
      return decodeURIComponent v
    catch e
      if e instanceof URIError
        e.message = 'Failed to decode param \'' + v + '\''
        e.status = e.statusCode = 400
      throw e

  constructor: (path, options, fn) ->
    unless @ instanceof Layer
      return new Layer(path, options, fn)
    debug 'new %s', path
    opts = options || {}

    @handle = fn
    @name = fn.name || '<anonymous>'
    @params = undefined
    @path = undefined
    @regexp = pathRegexp path, @keys = [], opts

    if path == '/' && opts.end == false
      this.regexp.fast_slash = true

  handle_error:(error, req, res, next) ->
    fn = @handle

    if fn.length != 4
      return next error
    try
      fn error, req, res, next
      return
    catch
      next _error
      return

  handle_request:(req, res, next) ->
    fn = @handle

    if fn.length > 3
      return next()

    try
      fn req, res, next
      return
    catch
      next _error
      return

  match:(path) ->
    if path == null
      @params = undefined
      @path = undefined
      return false

    if @regexp.fast_slash
      @params = {}
      @path = ''
      return true

    m = @regexp.exec path

    unless m
      @params = undefined
      @path = undefined
      return false

    @params = {}
    @path = m[0]

    keys = @keys
    params = @params

    i =1
    loop
        if(i >= m.length)
            break
        key = keys[i-1]
        prop = key.name
        val = decode_param m[i]

        if val isnt undefined || !hasOwnProperty.call(params, prop)
            params[prop] = val
        i +=1
    return true

module.exports = Layer
