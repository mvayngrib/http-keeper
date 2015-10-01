
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
    fallbacks: typeforce.maybe(typeforce.arrayOf('String'))
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

  var putOne = this.putOne
  this.put =
  this.putOne = function (options) {
    return putOne.apply(this, arguments)
      .then(function () {
        if (options.push) {
          return self.push(options)
        }
      })
  }
}

// Keeper.prototype.publish = function (key, value) {
//   return this._normalizeKeyValue(key, value)
//     .then(function (obj) {
//       return Q.allSettled(self._fallbacks.map(function (client) {
//         return client.put(obj.key, obj.value)
//       }))
//     })
// }

Keeper.prototype.push = function (options) {
  var self = this
  return this._normalizeOptions(options)
    .then(function (options) {
      return Q.allSettled(self._fallbacks.map(function (c) {
        return c.put(options.key, options.value)
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
