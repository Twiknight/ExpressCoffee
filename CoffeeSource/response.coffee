contentDisposition = require 'content-disposition'
deprecate = require('depd') 'express'
escapeHtml = require 'escape-html'
http = require 'http'
isAbsolute = require('./utils').isAbsolute 
onFinished = require 'on-finished'
path = require 'path'
merge = require 'utils-merge'
sign = require('cookie-signature').sign
normalizeType = require('./utils').normalizeType
normalizeTypes = require('./utils').normalizeTypes
setCharset = require('./utils').setCharset
cookie = require 'cookie'
send = require 'send'
extname = path.extname
mime = send.mime
resolve = path.resolve
vary = require 'vary'

res = module.exports =
  __proto__: http.ServerResponse.prototype

charsetRegExp = /;\s*charset\s*=/

sendfile = (res, file, options, callback) ->
  done = false
  onaborted = ()->
    if done
      return
    done = true

    err = new Error 'Request aborted'
    err.code = 'ECONNABORTED'
    callback err
    return

  ondirectory = () ->
    if done
      return
    done = true

    err = new Error 'EISDIR, read'
    err.code = 'EISDIR'
    callback err
    return

  onerror = (err) ->
    if done
      return
    done = true
    callback err
    return

  onend = () ->
    if done
      return
    done = true
    callback()
    return

  onfile = ()->
    if done
      return
    done = true
    callback()
    return

  onfile = () ->
    streaming = false;
    return

  onfinish = (err)->
    if err && err.code is 'ECONNRESET'
      return onaborted()
    if err
      return onerror err
    if done
      return

    setImmediate () ->
      if streaming isnt false && !done
        onaborted()
        return

      if done
        return
        done = true
        callback()

  onstream = () ->
    streaming = true
    return

  file.on 'directory', ondirectory
  file.on 'end', onend
  file.on 'error', onerror
  file.on 'file', onfile
  file.on 'stream', onstream
  onfinished res, onfinished

  if options.headers
    file.on 'headers', (res) ->
      obj = options.headers
      keys = Object.keys obj

      for key in keys
        res.setHeader key, obj[key]

  file.pipe res
  return















res.status = (code) ->
  @statusCode = code
  return @

res.links = (links) ->
  link = @get 'Link'
  if link
    link += ', '
  return @set 'Link', link + Object.keys(links).map((rel) ->
    return '<' + links[rel] + '>; rel="'+rel+'"'
  ).join(', ')

res.send = (body) ->
  chunck = body
  req = @req
  app =@app

  if arguments.length is 2
    if typeof arguments[0] isnt 'number' &&
    typeof arguments[1] is 'number'
      deprecate 'res.send(body, status): Use res.status(status).send(body) instead'
      @statusCode = arguments[1]
    else
      deprecate 'res.send(status,body): Use res.status(status).send(body) instead'
      @statusCode = arguments[0]
      chunck = arguments[1]

    if typeof chunck is 'number' && arguments.length is 1
      if !@get 'Content-Type'
        @type 'txt'
      deprecate 'res.send(status): Use res.sendStatus(status) instead'
      @statusCode = chunck
      chunck = statusCodes[chunck]

    switch typeof chunck
      when 'string'
        unless @get 'Content-Type'
          @type 'html'
        break
      when 'boolean','number','object'
        if chunck is null
          chunck = ''
        else if Buffer.isBuffer chunck
          unless @get 'Content-Type'
            @type 'bin'
        else
          return @json chunck
        break

    if typeof chunck is 'string'
      encoding = 'utf8'
      type = @get 'Content-Type'

      if typeof type is 'string'
        @set 'Content-Type', setCharset(type, 'utf-8')

    if chunck isnt undefined
      unless Buffer.isBuffer chunck
        chunck = new Buffer(chunck, encoding)
        encoding = undefined

      len = chunck.length
      @set 'Content-Length', len

    generateETag = len isnt undefined && app.get 'etag fn'
    if typeof generateETag is 'function' && @get('ETag')
      if (etag = generateETag chunck,encoding)
        @set "ETag",etag

    if req.fresh
      @statusCode  =304

    if 204 is @statusCode || 304 is @statusCode
      @removeHeader 'Content-Type'
      @removeHeader 'Content-Length'
      @removeHeader 'Transfer-Encoding'
      chunck = ''

    if req.method is 'HEAD'
      @end()
    else
      @end(chunck,encoding)

    return @


res.json = (obj) ->
  val = obj

  if arguments.length is 2
    if typeof arguments[1] is number
      deprecate 'res.json(obj, status): Use res.status(status).json(obj) instead'
      @statusCode = arguments[1]
    else
      deprecate 'res.json(status, obj): Use res.status(status).json(obj) instead'
      @statusCode = arguments[0]
      val = arguments[1]

  app = @app
  replacer = app.get 'json replacer'
  spaces = app.get 'json spaces'
  body = JSON.stringify val, replacer, spaces

  unless @get 'Content-Type'
    @set 'Content-Type','application/json'

  return @send body

res.jsonp = (obj) ->
  val = obj

  if arguments.length is 2
    if typeof arguments[1] is 'number'
      deprecate 'res.jsonp(obj, status): Use res.status(status).json(obj) insetead'
      @statusCode = arguments[1]
    else
      deprecate 'res.jsonp(obj, status): Use res.status(status).json(obj) insetead'
      @statusCode = arguments[0]
      val = arguments[1]

  app = @app
  replacer = app.get 'json replacer'
  spaces = app.get 'json spaces'
  body = JSON.stringify val,replacer,spaces
  callback = @req.query[app.get('jsonp callback name')]

  unless @get 'Content-Type'
    @set 'X-Content-Type-Options', 'nosniff'
    @set 'Content-Type', 'application/json'

  if Array.isArray callback
    callback = callback[0]

  body = body
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

  body = '/**/ typeof ' + callback + ' === \'function\' && ' + callback + '(' + body + ');'
  @send body

res.sendStatus = (statusCode) ->
  body = statusCodes[statusCode] || String(statusCode)

  @statusCode = statusCode
  @type 'txt'
  @send body

res.sendFile = (path, options, callback) ->
  done = callback
  req = @req
  res = @
  next = req.next
  opts = options || {}

  unless path
    throw new TypeError 'path argument is require to res.sendFile'

  if typeof options is 'function'
    done = options
    opts = {}

  if !opts.root && !isAbsolute path
    throw new TypeError 'path must be absolute or specify root to res.sendFile'

  pathname = encodeURI path
  file = send req, path, opts

  sendfile res, file, opts (err) ->
    if done
      return done err
    if err && err.code is 'EISDIR'
      return next()

    if err && err.code isnt 'ECONNABORTED' && err.syscall isnt 'write'
      next err
      return

res.sendfile = (path, options, callback) ->
  done = callback
  req = @req
  res = @
  next = req.next
  opts = options || {}

  if typeof options is 'function'
    done = options
    opts = {}

  file = send req, pathname, opts

  sendfile res,file,opts, (err) ->
    if done
      return done err
    if err && err.code is 'EISDIR'
      return next()

    if err && err.code isnt 'ECONNABORTED' && err.syscall isnt 'write'
      next(err)
    return

res.sendfile = deprecate.function res.sendfile,
'res.sendfile: Use res.sendFile instead'

res.download = (path, filename, callback) ->
  done = callback
  name = filename

  if typeof filename is 'function'
    done = filename
    name = null

  headers =
    'Content-Dispositon': contentDisposition(name||path)

  fullpath = resolve path
  return @sendFile fullpath, {headers: headers}, done

res.contentType =
  res.type = (type) ->
    ct =
      if type.indexOf('/') is -1
      then mime.lookup type
      else type

    return @set 'Content-Type', ct

res.format = (obj) ->
  req = @req
  next = req.next

  fn = obj.default
  if fn
    delete obj.default
  keys = Object.keys obj
  key =
    if keys.length > 0
    then req.accepts keys
    else false

  @vary 'Accept'
  if key
    @set 'Content-Type',normalizeType(key).value
    obj[key] req, @, next
  else if fn
    fn()
  else
    err = Error 'Not Acceptable'
    err.status = err.statusCode = 406
    err.types = normalizeTypes(key).map((o) ->
      return o.value
    )

  return @

res.attachment = (filename) ->
  if filename
    @type extname(filename)
  @set 'Content-Dispositon', contentDisposition(filename)

  return @

res.append =(field, val) ->
  prev = @get field
  value = val

  if prev
    value =
    if Array.isArray prev
    then prev.concat val
    else
      if Array.isArray val
      then [prev].concat val
      else [prev, val]

  return @set field, value

res.set =
  res.header = (field, val) ->
    if arguments.length is 2
      value =
      if Array.isArray val
      then val.map String
      else String val

      if field.toLowerCase() is 'content-type' && !charsetRegExp.test value
        charset = mime.charset.lookup value.split(';')[0]
        if charset
          value += '; charset' + charset.toLowerCase()

      @setHeader field, value
    else
      for key in field
        @set key, field[key]
    return @

res.get = (field) ->
  return @getHeader field

res.clearCookie = (name, options) ->
  otps = merge {expires: new Date(1), path:'/'}, options
  return @cookie name, '', opts

res.cookie = (name, value, options) ->
  opts = merge {},options
  secret = @req.secret
  signed = opts.signed

  if signed = opts.signed
    throw New Error 'cookieParser("secret") required for signed cookie'

  val =
  if typeof value is 'object'
  then 'j:' + JSON.stringify value
  else String value

  if signed
    val = 's:' + sign val, secret

  if 'maxAge' in opts
    opts.expires = new Date(Date.now() + opts.maxAge)
    opts.maxAge /= 1000;

  if opts.path is null
    opts.path = '/'

  @append 'Set-cookie',cookie.serialize name, String(val), opts
  return @

res.location = (url) ->
  loc = url

  if url is 'back'
    loc = @req.get 'Refferrer' || '/'

  @set 'Location', loc
  return @

res.redirect = (url) ->
  address = url
  status = 302

  if arguments.length is 2
    if typeof arguments[0] is 'number'
      status = arguments[0]
      address = arguments[1]
    else
      deprecate 'res.redirect(url, status): Use res.redirect(status, url) instead'
      status = arguments[1]

  @location address
  address = @get 'Location'

  @format {
    text: () ->
      body = statusCode[status]+ '. Redirecting to '+ encodeURI(address)
      return
    html:() ->
      u = escapeHtml(address)
      body = '<p>' + statusCodes[status] + '. Redirecting to <a href="' + u + '">' + u + '</a></p>'
      return
    default: () ->
      body = ''
      return
  }

  @statusCode = status
  @set 'Content-Length', Buffer.byteLength(body)

  if @req.method is 'HEAD'
    @end()
  else
    @end(body)
  return

res.vary = (field) ->
  if !field || Array.isArray(field) && !fiedl.length
    deprecate 'res.vary(): Provide a field name'
    return @

  vary @, field
  return @

res.render = (view, options, callback) ->
  app = @req.app
  done = callback
  opts = options || {}
  req = @req
  self = @

  if typeof options is 'function'
    done = options
    opts = {}

  opts._locals = self.locals
  done = done || (err, str) ->
    if err
      return req.next err
    self.send str
    return
  app.render view, opts, done
