
var util = require('util')
var Q = require('q')
var typeforce = require('typeforce')
var Offline = require('offline-keeper')
var Client = require('bitkeeper-client-js')

util.inherits(Keeper, Offline)
module.exports = Keeper

function Keeper (options) {
  var self = this

  typeforce({
    fallbacks: typeforce.maybe(typeforce.arrayOf('String')),
    publish: '?Boolean'
  }, options)

  Offline.call(this, options)

  if (!options.fallbacks) return

  this._fallbacks = options.fallbacks.map(function (url) {
    return new Client(url)
  })

  var getOne = this.getOne
  this.getOne = function (key) {
    return getOne.apply(this, arguments)
      .catch(function (err) {
        return self._fetch(key)
      })
  }

  if (options.publish) {
    var put = this.putOne
    this.put =
    this.putOne = function (key, value) {
      return put.apply(this, arguments)
        .then(self._publish)
    }
  }
}

Keeper.prototype._publish = function (key, value) {
  return this._normalizeKeyValue(key, value)
    .then(function (obj) {
      return Q.allSettled(self._fallbacks.map(function (client) {
        return client.put(obj.key, obj.value)
      }))
    })
}

Keeper.prototype._fetch = function (key) {
  var self = this
  var i = 0

  return tryNext()

  function tryNext () {
    if (i === self._fallbacks.length) {
      return Q.reject('not found')
    }

    return self._fallbacks[i++]
      .getOne(key)
      .then(function (val) {
        return self._validate(key, val)
          .then(function () {
            return val
          })
      })
      .catch(tryNext)
  }
}
