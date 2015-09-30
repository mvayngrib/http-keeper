
var http = require('http')
var path = require('path')
var parseUrl = require('url').parse
var test = require('tape')
var Q = require('q')
var Keeper = require('../')
var testDir = path.resolve('./tmp')

test('put, get', function (t) {
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
      path: testDir,
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
