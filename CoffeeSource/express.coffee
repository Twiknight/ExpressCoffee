EventEmitter = require('events').EventEmitter
mixin = require 'merge-descriptors'
proto = require './application'
Route = require './router/route'
Router = require './router'
req = require './request'
res = require './response'

exports = module.exports = creatApplication

creatApplication = ()->
  app = (req, res, next)->
    app.handle req,res,next
    return

  mixin app, EventEmitter.prototype, false
  mixin app, proto, false

  app.request =
    __proto__: req
    app      : app

  app.response=
    __proto__: res
    app      : app

  app.init()
  app

exports.application = proto
exports.request = req
exports.response = res

exports.Route = Route
exports.Router = Router

exports.query = require './middleware/query'
exports.static = require 'serve-static'

[
  'json',
  'urlencoded',
  'bodyParser',
  'compress',
  'cookieSession',
  'session',
  'logger',
  'cookieParser',
  'favicon',
  'responseTime',
  'errorHandler',
  'timeout',
  'methodOverride',
  'vhost',
  'csrf',
  'directory',
  'limit',
  'multipart',
  'staticCache',
].forEach((name)->
    Object.defineProperty(exports,name,{
        get: ()->
          throw new Error "Most middleware (like ' + name + ') is no longer bundled with Express and must be installed separately. Please see https://github.com/senchalabs/connect#middleware."
        configurable: true
      })
  )
