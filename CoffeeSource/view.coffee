debug = require('debug') 'express: view'
path =  require 'path'
fs = require 'fs'
utils = require './utils'

dirname = path.dirname
basename = path.basename
extname = path.extname
join = path.join
resolve = path.resolve

class View
  tryStat = (path) ->
    debug 'stat "%s"', path
    try
      return fs.statSync path
    catch
      return undefined

  constructor: (name, options) ->
    opts = options || {}
    @defaultEngine = opts.defaultEngine
    @ext = extname name
    @root = opts.root

    if !@ext && !@defaultEngine
      throw new Error 'No default engine was specified and no extension was provided.'

    fileName = name

    if !@ext
      @ext =
      if this.defaultEngine[0] != '.'
      then '.'+@defaultEngine
      else @defaultEngine

      fileName += @ext

    if !opts.engines[@ext]
      opts.engines[@ext] = require(@ext.substr(1)).__express

    @engine = opts.engines[@ext]
    @path = @lookup fileName

  lookup: (name) ->
    roots = [].concat @root
    path = ''
    debug 'lookup "%s"', name

    for root in roots when !path

      loc = resolve root,name
      dir = dirname loc
      file = basename loc

      path = @resolve dir,file

    return path

  render: (options, callback) ->
    debug 'render "%s"', @path
    @engine @path, options, callback
    return

  resolve: (dir, file) ->
    ext = @ext
    path = join dir, file
    stat = tryStat path

    if stat && stat.isFile()
      return path

    path = join dir, basename(file, ext), 'index'+ext
    stat = tryStat path

    if stat && stat.isFile()
      return path

    return

module.exports = View
