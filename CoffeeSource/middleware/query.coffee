parseUrl = require 'parseurl'
qs = require 'qs'

query = (options)->
  opts = Object.create options||null
  queryparse = qs.parse

  if typeof options == 'function'
    queryparse = options
    opts = undefined

  if opts != undefined
    if opts.allowDots == undefined
      otps.allowDots = false

    if opts.allowPrototypes == undefined
      opts.allowPrototypes = true

  query = (req, res, next)->
    unless req.query
      tmp_value = parseUrl(req).query
      req.query = queryparse tmp_value, opts

      next()
      return

  return query


module.exports = query
