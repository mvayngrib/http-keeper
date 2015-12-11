
var fs = require('fs')
var http = require('http')
var path = require('path')
var parseUrl = require('url').parse
var test = require('tape')
var Q = require('q')
var Keeper = require('../')
var Offline = require('@tradle/offline-keeper')
var Server = require('@tradle/bitkeeper-server')
var memdown = require('memdown')
var levelup = require('levelup')
var basePort = 53352
var counter = 0
var newDB = function () {
  return levelup('tmp' + (counter++), { db: memdown, valueEncoding: 'binary' })
}

test('invalid db encoding', function (t) {
  t.throws(function () {
    var keeper = new Keeper({
      db: levelup('tmp' + (counter++), { db: memdown })
    })
  })

  t.end()
})

test('test invalid keys', function (t) {
  t.plan(1)

  var keeper = new Keeper({
    db: newDB()
  })

  keeper.put('a', new Buffer('b'))
    .then(function () {
      t.fail()
    })
    .catch(function (err) {
      t.pass()
    })
    .finally(function () {
      return keeper.close()
    })
    .done()
})

test('put same data twice', function (t) {
  t.plan(1)

  var keeper = new Keeper({
    db: newDB()
  })

  put()
    .then(put)
    .done(t.pass)

  function put () {
    return keeper.put('64fe16cc8a0c61c06bc403e02f515ce5614a35f1', new Buffer('1'))
  }
})

test('put, get', function (t) {
  var keeper = new Keeper({
    db: newDB()
  })

  var k = [
    // infoHashes of values
    '64fe16cc8a0c61c06bc403e02f515ce5614a35f1',
    '0a745fb75a7818acf09f27de1db7a76081d22776',
    'bd45a097c00e557ea871233ea21d27a47f8f21a9'
  ]

  var v = ['1', '2', '3'].map(Buffer)
  keeper.putOne(k[0], v[0])
    .then(function () {
      return keeper.getOne(k[0])
    })
    .then(function (v0) {
      t.deepEqual(v0, v[0])
    })
    .then(function () {
      // keeper should derive key
      return keeper.putMany(v.slice(1))
    })
    .then(function () {
      return keeper.getMany(k)
    })
    .then(function (vals) {
      t.deepEqual(vals, v)
    })
    .then(function () {
      return keeper.getAllKeys()
    })
    .then(function (keys) {
      t.deepEqual(keys.sort(), k.slice().sort())
      return keeper.getAllValues()
    })
    .then(function (vals) {
      t.deepEqual(vals.sort(), v.slice().sort())
      return keeper.getAll()
    })
    .then(function (map) {
      t.deepEqual(Object.keys(map).sort(), k.slice().sort())
      var vals = Object.keys(map).map(function (key) {
        return map[key]
      })

      t.deepEqual(vals.sort(), v.slice().sort())
    })
    .done(function () {
      t.end()
    })
})

test('put, get, fallback', function (t) {
  // each server only has one value
  var map = {
    "64fe16cc8a0c61c06bc403e02f515ce5614a35f1": new Buffer('1'),
    "0a745fb75a7818acf09f27de1db7a76081d22776": new Buffer('2'),
    "bd45a097c00e557ea871233ea21d27a47f8f21a9": new Buffer('3'),
    "de1ea0a4ec16e8c7b10cb1dde3bf644be2fb5c57": new Buffer('4'),
    e: new Buffer('5') // invalid
  }

  var keys = Object.keys(map).sort(function (a, b) {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  })

  var vals = keys.map(function (k) {
    return k === 'e' ? undefined : map[k]
  })

  var togo = 0
  var serverKeepers = []
  var mkServers = keys.map(function (key, i) {
    togo++
    var serverKeeper = new Offline({
      db: newDB()
    })

    serverKeepers.push(serverKeeper)
    return serverKeeper.put(key, map[key])
      .catch(function (err) {
        // one value is invalid
      })
      .then(function () {
        return Q.ninvoke(Server, 'create', {
          keeper: serverKeeper,
          port: basePort + i
        })
      })
  })

  var servers
  var clientKeeper
  Q.all(mkServers)
    .then(function (_servers) {
      servers = _servers
      clientKeeper = new Keeper({
        storeOnFetch: true,
        db: newDB(),
        fallbacks: servers.map(function (s, i) {
          return '127.0.0.1:' + (basePort + i)
        })
      })

      return clientKeeper.getMany(keys)
    })
    .then(function (v) {
      t.deepEqual(v, vals)
    })
    .then(function () {
      servers.forEach(function (server) {
        return server.close()
      })

      // should be stored
      return clientKeeper.getMany(keys)
    })
    .then(function (v) {
      t.deepEqual(v, vals)
      return clientKeeper.close()
    })
    .done(function () {
      t.end()
    })
})

test('put upload', function (t) {
  var serverKeeper = new Offline({
    db: newDB()
  })

  var key = '64fe16cc8a0c61c06bc403e02f515ce5614a35f1'
  var val = new Buffer('1')
  var server
  var clientKeeper
  Q.ninvoke(Server, 'create', {
      keeper: serverKeeper,
      port: basePort
    })
    .then(function (_server) {
      server = _server
      clientKeeper = new Keeper({
        db: newDB(),
        fallbacks: [
          '127.0.0.1:' + basePort
        ]
      })

      return clientKeeper.putOne({
        key: key,
        value: val,
        push: true
      })
    })
    .then(function () {
      return serverKeeper.getOne(key)
    })
    .then(function (v) {
      t.deepEqual(v, val)
      t.end()
      server.close()
      return clientKeeper.close()
    })
    .done()
})
