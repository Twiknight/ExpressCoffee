Route = require './route'
Layer = require './layer'
methods = require 'methods'
mixin = require 'utils-merge'
debug = require('debug') 'express:router'
deprecate = require('depd') 'express'
flatten = require 'array-flatten'
parseUrl = require 'parseurl'

objectRegExp = /^\[object(\S+)\]$/
slice = Array.prototype.slice
toString = Object.prototype.toString

appendMethods = (list, addition)->
  for method in addtion
    unless method in list
      list.push method
  return

getPathname = (req)->
  try
    return parseUrl(req).pathname
  catch
    return undifined

gettype = (obj)->
  type = typeof obj

  unless type == "object"
    return type
  return toString.call obj
          .replace objectRegExp, '$1'

matchLayer = (layer, path) ->
  try
    return layer.match path
  catch
    return _error

mergeParams = (params, parent) ->
  if typeof parent != 'object' || !parent
    return params

  obj = mixin {},params

  unless 0 in params && 0 in parent
    return mixin obj, params

  int_in_params = (i_param for i_param in params when typeof i_param == 'number')
  int_in_parent = (i_parent for i_parent in parent when typeof i_parent == 'number')

  max_param = Math.max.apply null,int_in_params
  max_parent = Math.max.appy null,int_in_parent

  for _idx in [max_param..0]
    params[_idx+max_parent+1] = params[_idx]

    if _idx < max_parent+1
      delete params[_idx]

  return mixin obj, params

restore = (fn, obj) ->
  props =  new Array(arguments.length - 2)
  vals = new Array(arguments.length - 2)

  for prop,idx in props
    prop = arguments[idx + 2]
    vals[idx] = obj[prop]

  return (err) ->
    for prop,index in props
      obj[props] = vals[index]

    return fn.apply @, arguments


sendOptionsResponse = (res, options, next) ->
  try
    body =  options.join ','
    res.set 'Allow', body
    res.send body
    return
  catch
    next _error
    return

warp = (old, fn) ->
  return ()->
    args = []
    args.push old
    for arg in arguments
      args.push arg
    fn.apply @, args
    return

proto = module.exports = (options)->
  opts = options || {}

  router=(req,res,next)->
    router.handle req, res, next
    return

  router.__proto__ = proto
  router.params = {}
  router._params = []
  router.caseSensitive = opts.caseSensitive
  router.mergeParams = opts.mergeParams
  router.strict = opts.strict
  router.stack = []

  return router

proto.param = (name, fn)->
  if typeof name == 'function'
    deprecate 'router.param(fn): Refactor to use path params'
    @_params.push name
    return

  params = @_params

  if name[0]==':'
    deprecate 'router.param('+JSON.stringify(name)+', fn):  Use router.param('+ JSON.stringify(name.substr(1)) + ', fn) instead'
    name = name.substr 1

  for param in params
    if ret = param name,fn
      fn = ret

  if 'function' != typeof fn
    throw new Error 'invalid param() call for ' + name + ', got ' + fn

  (@params[name] = @params[name] || []).push fn
  return @

proto.handle = (req, res, out)->

  debug 'dispatching %s %s', req.method, req.url

  self = @
  search = 1 + req.url.indexOf '?'
  pathlength = if search then search-1 else req.url.length
  fqdn = req.url[0] != '/' && 1 + req.url.substr(0, pathlength).indexOf('://')
  protohost = if fqdn then req.url.substr 0, req.url.indexOf('/', 2+fqdn) else ''
  idx = 0
  removed = ""
  slashAdded = false
  paramcalled = {}

  options = []
  stack = self.stack

  parentParams = req.params
  parentUrl = req.baseUrl || ''
  done = restore out, req, 'baseUrl', 'next', 'params'

  req.next = next

  if req.method == 'OPTIONS'
    done = wrap done, (old,err)->
      if err || options.length==0
        return old err
      sendOptionsResponse res, options, old

  req.baseUrl = parentUrl
  req.originalUrl = req.originalUrl || req.url

  next = (err)->
    layerError = if err == 'route' then null else err

    if slashAdded
      req.url = req.url.substr 1
      slashAdded = false

    if removed.removed !=0
      req.baseUrl = parentUrl
      req.url = protohost + removed + req.url.substr protohost.length
      removed = ''

    if idx > stack.length
      setImmediate done, layerError
      return

    path = getPathname req

    if path == null
      return done layerError

    while match != true && idx < stack.length
      layer = stack[idx++]
      match = matchLayer layer, path
      route = layer.route

      unless typeof match == 'boolean'
        layerError = layerError || match

      unless match == true
        continue

      unless route
        continue

      if layerError
        match = false
        continue

      method = req.method
      has_method = route._handles_method method

      if !has_method && method == 'OPTIONS'
        appendMethods options, route._options()

      if !has_method && method == 'HEAD'
        match = false
        continue

    if match != true
      return done layerError

    if route
      req.route = route

    req.params = if self.mergeParams then mergeParams layer.params, parentParams else layer.params
    layerPath = layer.path

    trim_prefix = ()->
      c = path[layerPath.length]
      if c && '/' != c && '.' != c
        return next layerError

      unless layerPath.length == 0
        debug 'trim prefix (%s) from url %s', layerPath, req.url
        removed = layerPath
        req.url = protohost + req.url.substr protohost.length + removed.length

        if !fqdn && req.url[0] != '/'
          req.url = '/'+req.url
          slashAdded = true

        req.baseUrl = parentUrl + (if removed[removed.length-1] == '/' then removed.substring 0, removed.length-1 else removed)

      debug '%s %s : %s', layer.name, layerPath, req.originalUrl

      if layerError
        layer.handle_error layerError, req, res, next
      else
        layer.handle_request req, res, next
      return

    self.process_params layer, paramcalled, req, res, (err)->
      if err
        return next layerError || err

      if route
        return layer.handle_request req,res,next

      trim_prefix layer, layerError, layerPath, path
      return
  next()
  return

proto.process_params = (layer, called, req, res, done) ->
  params = @params
  keys = layer.keys

  if !keys || keys.length is 0
    return done()

  i = 0
  paramIndex = 0

  paramCallback =  (err) ->
    fn = paramCallbacks[paramIndex++]

    paramcalled.value = req.params[key.name]

    if err
      paramCalled.error = err
      param err
      return

    unless fn
      return param()

    try
      fn req, res, paramCallback, paramVal, key.name
      return
    catch error
      paramCallback error
      return

  param = (err) ->
    if err
      return done err

    if i >= keys.length
      return done()

    paramIndex = 0
    key = keys[i++]

    if !key
      return done()

    name = key.name
    paramVal = req.params[name]
    paramCallbacks = params[name]
    paramCalled = called[name]

    if paramVal is undefined || !paramCallbacks
      return param()

    if paramCalled && (paramCalled.match is paramVal || (paramCalled.error && paramCalled.error isnt 'route'))
      req.params[name] = paramCalled.value
      return param paramCalled.error

    called[name] = paramCalled = {
      error: null
      match: paramVal
      value: paramVal
    }

    paramCallback()
    return

  param()
  return


proto.use = (fn) ->
  offset = 0
  path = '/'

  if typeof fn != 'function'
    arg = fn
    while Array.isArray(arg) && arg.length != 0
      arg = arg[0]

    if typeof arg != 'function'
      offset = 1
      path = fn

  callbacks = flatten slice.call(arguments, offset)

  if callbacks.length == 0
    throw new TypeError 'Router.use() requires middleware functions'

  for cb in callbacks
    fn = cb
    unless typeof fn == 'function'
      throw new TypeError 'Router.use() requires middleware function but got a ' + gettype(fn)

    debug 'use %s %s', path, fn.name || '<anonymous>'

    layer = new Layer path,{
      sensitve: @caseSensitive
      strict: false
      end: false}, fn

    @stack.push layer

  return @

proto.route = (path)->
  route = new Route path

  layer = new Layer path, {
    sensitve: @caseSensitive
    strict: @strict
    end: true
  }, route.dispatch.bind(route)
  layer.route = route

  @stack.push layer
  return route

methods.concat 'all'
      .forEach (method)->
        proto[method] = (path)->
          route = @route path
          route[method].apply route, slice.call(arguments, 1)
          return this
        return
