
var http = require('http')
var path = require('path')
var parseUrl = require('url').parse
var test = require('tape')
var Q = require('q')
var rimraf = require('rimraf')
var Keeper = require('../')
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
    })
    .then(function () {
      return Q.nfapply(rimraf, [testDir])
    })
    .done()
})

test('put, get, fallback', function (t) {
  // each server only has one value

  var basePort = 53352
  var map = {
    a: new Buffer('1'),
    b: new Buffer('2'),
    c: new Buffer('3'),
    d: new Buffer('4'),
    e: new Buffer('5')
  }

  var keys = Object.keys(map).sort(function (a, b) {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  })

  var vals = keys.map(function (k) {
    return map[k]
  })

  var togo = 0
  var servers = keys.map(function (key, i) {
    togo++
    var server = http.createServer(function (req, res) {
      if (req.url.slice(1) === key) {
        res.write(map[key])
        res.end()
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(basePort + i, ready)
    return server
  })

  function ready () {
    if (--togo) return

    var keeper = new Keeper({
      storage: testDir,
      fallbacks: servers.map(function (s, i) {
        return '127.0.0.1:' + (basePort + i)
      })
    })

    keeper.getMany(keys)
      .then(function (v) {
        t.deepEqual(v, vals)
        t.end()
      })
      .then(function () {
        servers.forEach(function (s) {
          s.close()
        })

        return keeper.close()
      })
      .done()
  }
})
