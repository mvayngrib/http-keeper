'use strict';

var util = require('util');
var typeforce = require('typeforce');
var debug = require('debug')('http-keeper');
var Offline = require('@tradle/offline-keeper');
var Client = require('@tradle/bitkeeper-client');

util.inherits(Keeper, Offline);
module.exports = Keeper;

function Keeper(options) {
  var self = this;

  typeforce({
    fallbacks: typeforce.maybe(typeforce.arrayOf('String')),
    storeOnFetch: '?Boolean'
  }, options);

  Offline.call(this, options);

  if (!options.fallbacks) return;

  this._storeOnFetch = options.storeOnFetch;
  this._fallbacks = options.fallbacks.map(function (url) {
    return new Client(url);
  });

  var getOne = this.getOne;
  this.getOne = function (key) {
    return getOne.apply(this, arguments).catch(function (err) {
      return self._fetch(key);
    });
  };

  var putOne = this.putOne;
  this.put = this.putOne = function (options) {
    return putOne.apply(this, arguments).then(function () {
      if (options.push) {
        return self.push(options);
      }
    });
  };
}

// Keeper.prototype.publish = function (key, value) {
//   return this._normalizeKeyValue(key, value)
//     .then(function (obj) {
//       return Q.allSettled(self._fallbacks.map(function (client) {
//         return client.put(obj.key, obj.value)
//       }))
//     })
// }

Keeper.prototype.push = function _callee(options) {
  var self, i, c;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) switch (_context.prev = _context.next) {
      case 0:
        self = this;
        _context.next = 3;
        return regeneratorRuntime.awrap(this._normalizeOptions(options));

      case 3:
        options = _context.sent;
        i = 0;

      case 5:
        if (!(i < this._fallbacks.length)) {
          _context.next = 18;
          break;
        }

        c = this._fallbacks[i];
        _context.prev = 7;
        _context.next = 10;
        return regeneratorRuntime.awrap(c.put(options.key, options.value));

      case 10:
        _context.next = 15;
        break;

      case 12:
        _context.prev = 12;
        _context.t0 = _context['catch'](7);

        debug('push failed', c.baseUrl(), _context.t0);

      case 15:
        i++;
        _context.next = 5;
        break;

      case 18:
      case 'end':
        return _context.stop();
    }
  }, null, this, [[7, 12]]);
};

Keeper.prototype._fetch = function _callee2(key) {
  var self, val, i, client;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) switch (_context2.prev = _context2.next) {
      case 0:
        self = this;
        i = 0;

      case 2:
        if (!(i < this._fallbacks.length)) {
          _context2.next = 21;
          break;
        }

        client = this._fallbacks[i];
        _context2.prev = 4;
        _context2.next = 7;
        return regeneratorRuntime.awrap(client.getOne(key));

      case 7:
        val = _context2.sent;
        _context2.next = 14;
        break;

      case 10:
        _context2.prev = 10;
        _context2.t0 = _context2['catch'](4);

        debug('fetch ' + key + ' from ' + client.baseUrl() + ' failed');
        return _context2.abrupt('continue', 18);

      case 14:
        if (!this._storeOnFetch) {
          _context2.next = 17;
          break;
        }

        _context2.next = 17;
        return regeneratorRuntime.awrap(this.putOne(key, val));

      case 17:
        return _context2.abrupt('return', val);

      case 18:
        i++;
        _context2.next = 2;
        break;

      case 21:
        throw new Error('not found');

      case 22:
      case 'end':
        return _context2.stop();
    }
  }, null, this, [[4, 10]]);
};