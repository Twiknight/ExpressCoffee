finalhandler = require 'finalhandler'
Router = require './router'
methods = require 'methods'
middleware = require './middleware/init'
query = require './middleware/query'
debug = require('debug') 'express: application'
View = require './view'
http = require 'http'
compileETag = require('./utils').compileETag
compileQueryParser = require('./utils').compileQueryParser
compileTrust = require('./utils').compileTrust
deprecate = require('depd') 'express'
flatten = require 'array-flatten'
merge = require 'utils-merge'
resolve = require('path').resolve
slice = Array.prototype.slice

app = exports = module.exports ={}

trustProxyDefaultSymbol = '@@symbol:trust_proxy_default'

logerror = (err) ->
  if @get('env') != 'test'
    console.error err.stack || err.toString()
  return

tryRender = (view, options, callback) ->
  try
    view.render options, callback
    return
  catch error
    callback error
    return

app.init = () ->
  @cache = {}
  @engines = {}
  @settings = {}
  @defaultConfiguration()
  return

app.defaultConfiguration = () ->
  env = process.env.NODE_ENV || 'development'

  @enable 'x-powered-by'
  @set 'etag', 'weak'
  @set 'env', env
  @set 'query parser', 'extended'
  @set 'subdomain offset', 2
  @set 'trust proxy', false

  Object.defineProperty @settings, trustProxyDefaultSymbol, {
    configurable: true
    value: true
  }

  debug 'booting in %s mode', env

  @on 'mount', (parent) ->
    if @settings[trustProxyDefaultSymbol] == true && typeof parent.settings['trust proxy fn']=='function'
      delete @settings['trust proxy']
      delete @settings['trust proxy fn']

    @request.__proto__ = parent.request
    @response.__proto__ = parent.response
    @engines.__proto__ = parent.engines
    @settings.__proto__ = parent.settings

  @locals = Object.create null

  @mountpath = '/'

  @locals.settings = @settings

  @set 'view', View
  @set 'views', resolve('views')
  @set 'jsonp callback name', 'callback'

  if env is 'production'
    @enable 'view cache'

  Object.defineProperty @, 'router', {
    get: () ->
      throw new Error '\'app.router\' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app.'
  }
  return

app.lazyrouter = () ->
  unless @_router
    @_router = new Router {
      caseSensitive: @enabled 'case sensitive routing'
      strict: @enabled 'strict routing'
    }
    @_router.use query(@get('query parser fn'))
    @_router.use middleware.init(@)
  return

app.handle = (req, res, callback) ->
  router = @_router
  done = callback || finalhandler(req, res, {
    env: @get 'env'
    onerror: logerror.bind @
    })

  unless router
    debug 'no routes defined on app'
    done()
    return

  router.handle req, res, done
  return

app.use = (fn) ->
  offset = 0
  path = '/'

  if typeof fn != 'function'
    arg = fn

    while Array.isArray(arg) && arg.length != 0
      arg = arg[0]

    if typeof arg != 'function'
      offset = 1
      path = fn

  fns = flatten slice.call(arguments, offset)

  if fns.length == 0
    throw new TypeError 'app.use() requires middleware functions'

  @lazyrouter()
  router = @_router

  fns.forEach (fn)->
    if !fn || !fn.handle || !fn.set
      return router.use path, fn
    debug '.use app under %s', path
    fn.mountpath = path
    fn.parent = @

    router.use path, (req, res, next) ->
      orig = req.app
      fn.handle req, res, (err) ->
        req.__proto__ = orig.request
        res.__proto__ = orig.response
        next err
    fn.emit 'mount',@
  ,@
  return @

app.route = (path) ->
  @lazyrouter()
  return @_router.route path

app.engine = (ext, fn) ->
  if typeof fn != 'function'
    throw new Error 'callback function required'
  extension =
    if ext[0] != '.'
    then '.'+ext
    else ext
  @engines[extension] = fn
  return @

app.param = (name, fn) ->
  @lazyrouter()

  if Array.isArray name
    for nm in name
      @param nm, fn
    return @
  @_router.param name,fn
  return @

app.set = (setting, val) ->
  if arguments.length == 1
    return @settings[setting]
  debug 'set "%s" to %o', setting, val

  @settings[setting] = val

  switch setting
    when 'etag'
      @set 'etag fn', compileETag(val)
      break
    when 'query parser'
      @set 'query parser fn', compileQueryParser(val)
      break
    when 'trust proxy'
      @set 'trust proxy fn', compileTrust(val)
      Object.defineProperty @settings, trustProxyDefaultSymbol, {
        configurable: true
        value: false
        }
      break
  return @

app.path = () ->
  return if @parent then @parent.path() + @mountpath else ''

app.enabled = (setting) ->
  return Boolean @set(setting)

app.disabled = (setting) ->
  return !@set setting

app.enable = (setting) ->
  return @set setting, true

app.disable = (setting) ->
  return @set setting,false

methods.forEach (method) ->
  app[method] = (path) ->
    if method == 'get' && arguments.length == 1
      return @set path

    @lazyrouter()

    route = @_router.route path
    route[method].apply route, slice.call(arguments, 1)
    return @
  return

app.all = (path) ->
  @lazyrouter()
  route = @_router.route path
  args = slice.call arguments,1

  for method in methods
    route[method].apply route, args

  return @

app.del = deprecate.function app.delete, 'app.del: Use app.delete instead'

app.render = (name, options, callback) ->
  cache = @cache
  done = callback
  engines = @engines
  opts = options
  renderOptions = {}

  if typeof options == 'function'
    done = options
    opts = {}

  merge renderOptions, @locals

  if opts._locals
    merge renderOptions, opts._locals

  merge renderOptions, opts

  unless renderOptions.cache?
    renderOptions.cache = @enabled 'view cache'

  if renderOptions.cache
    view = cache[name]

  unless view
    _View  = @get 'view'
    view = new _View name, {
      defaultEngine: @get 'view engine'
      root: @get 'views'
      engines: engines
    }

    unless view.path
      dirs =
      if Array.isArray(view.root) && view.root.length >1
      then 'directories "' + view.root.slice(0, -1).join('", "') + '" or "' + view.root[view.root.length - 1] + '"'
      else 'directory "' + view.root + '"'
      err = new Error 'Failed to lookup view "' + name + '" in views ' + dirs
      err.view = view
      return done err

    if renderOptions.cache
      cache[name] = view

  tryRender view, renderOptions, done
  return

app.listen = () ->
  server = http.createServer @
  return server.listen.apply server, arguments
