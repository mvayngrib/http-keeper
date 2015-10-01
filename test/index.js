
var http = require('http')
var path = require('path')
var parseUrl = require('url').parse
var test = require('tape')
var Q = require('q')
var rimraf = require('rimraf')
var Keeper = require('../')
var Offline = require('offline-keeper')
var Server = require('bitkeeper-server-js')
var testDir = path.resolve('./tmp')

rimraf.sync(testDir)

test('test invalid keys', function (t) {
  t.plan(1)

  var keeper = new Keeper({
    storage: testDir
  })

  keeper.put('a', new Buffer('b'))
    .then(function () {
      t.fail()
    })
    .catch(function (err) {
      t.pass()
    })
    .done()
})

test('put, get', function (t) {
  t.plan(2)

  var keeper = new Keeper({
    storage: testDir
  })

  var k = [
    // infoHashes of values
    '64fe16cc8a0c61c06bc403e02f515ce5614a35f1',
    '0a745fb75a7818acf09f27de1db7a76081d22776'
  ]

  var v = ['1', '2'].map(Buffer)
  keeper.putOne(k[0], v[0])
    .then(function () {
      return keeper.getOne(k[0])
    })
    .then(function (v0) {
      t.deepEqual(v0, v[0])
    })
    .then(function () {
      // keeper should derive key
      return keeper.putOne(v[1])
    })
    .then(function () {
      return keeper.getMany(k)
    })
    .then(function (vals) {
      t.deepEqual(vals, v)
      rimraf.sync(testDir)
    })
    .done()
})

test('put, get, fallback', function (t) {
  // each server only has one value
  var basePort = 53352
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
      storage: testDir + '/offline/' + i
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
        storage: testDir,
        fallbacks: servers.map(function (s, i) {
          return '127.0.0.1:' + (basePort + i)
        })
      })

      return clientKeeper.getMany(keys)
    })
    .then(function (v) {
      t.deepEqual(v, vals)
      t.end()
    })
    .then(function () {
      servers.forEach(function (server) {
        return server.close()
      })

      return clientKeeper.close()
    })
    .done(function () {
      setInterval(function () {
        console.log(process._getActiveHandles())
      }, 1000).unref()
    })
})
