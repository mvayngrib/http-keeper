
var util = require('util')
var Q = require('q')
var Offline = require('offline-keeper')
var Client = require('bitkeeper-client-js')

util.inherits(Keeper, Offline)
module.exports = Keeper

function Keeper (options) {
  var self = this

  Offline.call(this, options)

  this._fallbacks = options.fallbacks.map(function (url) {
    return new Client(url)
  })

  var getOne = this.getOne
  this.getOne = function (key) {
    return getOne.apply(this, arguments)
      .catch(function (err) {
        return self.fetch(key)
      })
  }
}

Keeper.prototype.fetch = function (key) {
  var self = this
  var i = 0

  return tryNext()

  function tryNext () {
    if (i === self._fallbacks.length) {
      return Q.reject('not found')
    }

    return self._fallbacks[i++]
      .getOne(key)
      .catch(tryNext)
  }
}
