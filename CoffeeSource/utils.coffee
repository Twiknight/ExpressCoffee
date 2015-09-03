contentDisposition = require 'content-disposition'
contetType = require 'content-type'
deprecate = require 'deprecate'
flatten = require 'flatten'
mime = require 'mime'
basename = require('path').basename
etag = require 'etag'
proxyaddr = require 'proxy-addr'
qs = require 'qs'
querystring = require 'querystring'

acceptParams = (str, index) ->
  parts = str.split(/ *; */)
  ret =
    value: parts[0]
    quality: 1
    params: {}
    orignalIndex: index

  for part in parts
    pms = part.split(/ *= */)
    if pms[0] is 'q'
      ret.quality = parseFloat pms[1]
    else
      ret.params[pms[0]] = pms[1]

  return ret

parseExtendedQueryString = (str) ->
  return qs.parse str,{
    allowDots: flase
    allowPrototypes: true
  }

newObject = () ->
  {}

exports.etag = (body, encoding) ->
  buf =
  if !Buffer.isBuffer body
  then new Buffer body,encoding
  else body

  return etag buf,{weak: false}

exports.wetag = (body, encoding) ->
  buf = if !Buffer.isBuffer body
  then new Buffer body,encoding
  else body
  return etag buf, {weak:true}

exports.isAbsolute = (path) ->
  if '/' == path[0]
    return true
  if ':' == path[1] && '\\' == path[2]
    return true
  if '\\\\' == path.substring 0,2
    return true
  return false

exports.flatten = deprecate.function flatten,
'utils.flatten: use array-flatten npm module instead'

exports.normalizeType = (type) ->
  return if ~type.indexOf '/'
  then acceptParams type
  else {value:mime.lookup type, params:{}}

exports.normalizeTypes = (types) ->
  ret = []
  for type in types
    ret.push exports.normalizeType(type)
  return ret

exports.contentDisposition = deprecate.function contentDisposition,
'utils.contentDisposition: use content-disposition npm module instead'

exports.compileETag = (val) ->
  if typeof val is 'function'
    return val

  switch val
    when true
      fn = exports.wetag
      break
    when false
      break
    when 'strong'
      fn = exports.etag
      break
    when 'weak'
      fn = exports.wetag
    else
      throw new TypeError 'unknown value for etag function: '+val

  return fn

exports.compileQueryParser = (val) ->
  if typeof val is 'function'
    return val

  switch val
    when true
      fn = querystring.parse
      break
    when false
      fn = newObject
      break
    when 'extended'
      fn = parseExtendedQueryString
      break
    when 'simple'
      fn = querystring.parse
      break
    else
      throw new TypeError 'unknown value for query parser function: ' + val

  return fn

exports.compileTrust = (val) ->
  if typeof val is 'function'
    return val

  if val is true
    return () ->
      return true

  if typeof val is 'number'
    return (a, i) ->
      return i < val

  if typeof val is 'string'
    val = val.split(/ *; */)

  return proxyaddr.compile(val||[])

exports.setCharset = (type, charset) ->
  if !type || !charset
    return type

  parsed = contetType.parse type
  parsed.parameters.charset = charset

  return contetType.format parsed
