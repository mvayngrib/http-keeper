
var util = require('util')
var typeforce = require('typeforce')
var debug = require('debug')
var Offline = require('@tradle/offline-keeper')
var Client = require('@tradle/bitkeeper-client')

util.inherits(Keeper, Offline)
module.exports = Keeper

function Keeper (options) {
  var self = this

  typeforce({
    fallbacks: typeforce.maybe(typeforce.arrayOf('String')),
    storeOnFetch: '?Boolean'
  }, options)

  Offline.call(this, options)

  if (!options.fallbacks) return

  this._storeOnFetch = options.storeOnFetch
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

Keeper.prototype.push = async function (options) {
  var self = this
  options = await this._normalizeOptions(options)
  this._fallbacks.forEach(async (c) => {
    try {
      await c.put(options.key, options.value)
    } catch (err) {
      debug('push failed', c.baseUrl(), err)
    }
  })
}

Keeper.prototype._fetch = async function (key) {
  var self = this
  var val
  debugger
  for (var i = 0; i < this._fallbacks.length; i++) {
    var client = this._fallbacks[i]
    try {
      val = await client.getOne(key)
    } catch (err) {
      debug(`fetch ${key} from ${client.baseUrl()} failed`)
      continue
    }

    if (this._storeOnFetch) {
      await this.putOne(key, val)
    }

    return val
  }

  throw new Error('not found')
}
