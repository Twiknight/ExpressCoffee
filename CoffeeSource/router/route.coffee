debug = require('debug')('express:router:route')
flatten = require 'array-flatten'
Layer = require './layer'
methods = require 'methods'

slice = Array.prototype.slice
toString = Object.prototype.toString


class Route
  constructor : (path)->
    @path = path
    @stack = []

    debug 'new %s', path

    @methods = {}
  _handles_method :(method)->
    if @methods._all
      true

    name = method.toLowerCase()

    if name = 'head' && !@methods['head']
      name = 'get'

    return Boolean(this.methods[name])


  _options:()->
    methods = Object.keys @methods

    if @methods.get && !@methods.head
      methods.push 'head'

    for m in methods
      m = m.toUpperCase()

    return methods


  dispatch:(req, res, done)->
    idx = 0
    stack = @stack
    next = (err)->
      if err && err == 'route'
        return done()

      layer = stack[idx++]
      unless layer
        return done err

      if layer.method && layer.method != method
        return next err

      if err
        layer.handle_error err, req, res, next
      else
        layer.handle_request req, res, next
      return

    if stack.length == 0
      done()

    method = req.method.toLowerCase()
    if method == 'head' && !@methods['head']
      method = 'get'

    req.route = @

    next()
    return

  all :()->
    handles = flatten slice.call(arguments)

    for handle in handles
      unless typeof handle == 'function'
        type = toString.call handle
        msg = 'Route.all() requires callback functions bug got a' + type
        throw new TypeError msg

      layer = Layer '/',{},handle
      layer.method = undefined

      @methods._all = true
      @stack.push layer

    return @

  methods.forEach (method)->
    Route.prototype[method] = ()->
      handles = flatten slice.call(arguments)

      for handle in handles
        unless typeof handle == 'function'
          type = toString.call handle
          msg = 'Route.'+method+'() requires callback functions but got a '+type
          throw new Error msg

        debug "%s %s", method, @path

        layer = Layer '/', {}, handle
        layer.method = method

        @methods[method] = true
        @stack.push layer

      return @


module.exports = Route
