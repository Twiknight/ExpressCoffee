accepts = require 'accepts'
deprecate = require('depd') 'express'
isIP = require('net').isIP
typeis = require 'type-is'
http = require 'http'
fresh = require 'fresh'
parseRange = require 'range-parser'
parse = require 'parseurl'
proxyaddr = require 'proxy-addr'

req = exports = module.exports =
  __proto__: http.IncomingMessage.prototype

req.get =
req.header = (name) ->
  lc = name.toLowerCase()

  switch lc
    when 'referer','referrer'
      return @headers.referrer || @headers.referer
    else
      return @headers[lc]

req.accepts = () ->
  accept = accepts @
  return accept.types.apply accept, arguments

req.acceptsEncodings = () ->
  accept = accepts @
  return accept.encodings.apply accept, arguments

req.acceptsEncoding =
  deprecate.function req.acceptsEncodings, 'req.acceptsEncodings: Use acceptsEncodings instead'

req.acceptCharsets = () ->
  accept = accepts @
  return accept.charsets.apply accept,arguments

req.acceptsCharset =
  deprecate.function req.acceptCharsets, 'req.acceptsCharset: Use acceptsCharsets instead'

req.acceptsLanguages = ()->
  accept = accepts @
  return accept.languages.apply accept, arguments

req.acceptsLanguage =
  deprecate.function req.acceptsLanguages, 'req.acceptsLanguage: Use acceptsLanguages instead'

req.range = (size) ->
  range = @get 'Range'
  unless range
    return
  return parseRange size,range

req.param = (name, defaultValue) ->
  params = @params || {}
  body = @body || {}
  query = @query || {}

  args = if arguments.length == 1 then 'name' else 'name, default'

  deprecate 'req.param(' + args + '): Use req.params, req.body, or req.query instead'

  if null != params[name] && params.hasOwnProperty(name)
    return params[name]
  if null != body[name]
    return body[name]
  if null != query[name]
    return query[name]

  return defaultValue

req.is = (types) ->
  arr = types
  unless Array.isArray types
    arr = new Array arguments.length
    for arg,idx in arguments
      arr[idx] = arg

  return typeis @, arr

defineGetter = (obj, name, getter) ->
  Object.defineProperty obj,name,{
    configurable: true
    enumerable: true
    get: getter
  }
  return

defineGetter req, 'protocol', ()->
  proto = if @connection.encrypted then 'https' else 'http'
  trust = @app.get 'trust proxy fn'
  unless trust @connection.remoteAddress, 0
    return proto

  proto = @get('X-Forwarded-Proto') || proto
  return proto.split(/\s*,\s*/)[0]

defineGetter req, 'secure', () ->
  return @protocol == 'https'

defineGetter req, 'ip', () ->
  trust = @app.get 'trust proxy fn'
  return proxyaddr @,trust

defineGetter req, 'ips', () ->
  trust = @app.get 'trust proxy fn'
  addrs = proxyaddr.all @,trust
  return addrs.slice(1).reverse()

defineGetter req, 'subdomains', () ->
  hostname = @hostname
  unless hostname
    return []

  offset = @app.get 'subdomain offset'
  subdomains =
    if isIP(hostname)
    then hostname.split('.').reverse()
    else [hostname]

defineGetter req, 'path', () ->
  return parse(@).pathname

defineGetter req, 'hostname', () ->
  trust = @app.get 'trust proxy fn'
  host = @get 'X-Forwarded-Host'

  if !host || !trust @connection.remoteAddress, 0
    host = @get 'Host'

  if !host
    return

  offset =
    if host[0] == '['
    then host.indexOf(']')+1
    else 0
  index = host.indexOf ':', offset

  return if index != -1 then host.substring(0,index) else host

defineGetter req, 'host', deprecate.function(()->
  return @hostname
,'req.host: Use req.hostname instead')


defineGetter req, 'fresh', () ->
  method = @method
  s = @res.statusCode

  if 'GET' != method && 'HEAD' != method
    return false
  if (s>=200 && s < 300) || 304 == s
    return fresh @headers, @res._headers|| {}
  return false

defineGetter req, 'stale', () ->
  return !@frseh

defineGetter req, 'xhr', () ->
  v = @get('X-Requested-With') || {}
  return v.toLowerCase() == 'xmlhttprequest'
