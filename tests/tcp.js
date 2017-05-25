'use strict'

const test = require('tape')
const fs = require('fs')
const os = require('os')
const path = require('path')
const concat = require('concat-stream')
const Netcat = require('../')
const NetcatServer = Netcat.server
const NetcatClient = Netcat.client

test('Client and Server constructor', function (t) {
  t.plan(2) // plan assertions

  try {
    var nc = new NetcatServer()
    var nc2 = new NetcatClient()
    t.ok(nc, 'Server constructor')
    t.ok(nc2, 'Client constructor')
  } catch (e) {
    t.fail(e)
  }
})

test('Server basic methods', function (t) {
  t.plan(15)

  try {
    var nc = new NetcatServer()
    /* checking default values */
    t.equal(nc._port, null, 'port null by default')
    t.equal(nc._protocol, 'tcp', 'protocol is tcp by default')
    t.equal(nc._address, '0.0.0.0', '0.0.0.0 default address')
    t.equal(nc._keepalive, false, 'no keepalive')
    t.equal(Object.keys(nc._clients).length, 0, 'no clients')
    /* set methods */
    nc.udp()
    t.equal(nc._protocol, 'udp', 'setting udp as protocol')
    nc.tcp()
    t.equal(nc._protocol, 'tcp', 'setting tcp as protocol')
    nc.address('192.168.1.101')
    t.equal(nc._address, '192.168.1.101', 'setting address xxx')
    nc.addr('0.0.0.0')
    t.equal(nc._address, '0.0.0.0', 'using addr alias')
    nc.port(2389)
    t.equal(nc._port, 2389, 'setting port 2389')
    nc.keepalive()
    t.equal(nc._keepalive, true, 'set keepalive true')
    nc.k(false)
    t.equal(nc._keepalive, false, 'set keepalive false')
    nc.exec('/bin/sh')
    t.equal(nc._exec, '/bin/sh', 'setting exec to /bin/sh')
    nc.exec(null)

    nc.listen()
    t.ok(nc.server, 'server listen')
    nc.close(function () {
      t.ok(true, 'close server')
    })
  } catch (e) {
    console.log(e)
    t.fail(e)
  }
})

test('Client basic methods', function (t) {
  t.plan(15)
  t.timeoutAfter(5000)

  try {
    var srv = new NetcatServer().port(2390).listen() // server
    var nc = new NetcatClient()
    /* checking default values */
    t.equal(nc._port, null, 'port null by default')
    t.equal(nc._protocol, 'tcp', 'protocol is tcp by default')
    t.equal(nc._address, '127.0.0.1', '127.0.0.1 default address')
    t.equal(nc._interval, false, 'no interval by default')
    /* set methods */
    nc.udp()
    t.equal(nc._protocol, 'udp', 'setting udp as protocol')
    nc.tcp()
    t.equal(nc._protocol, 'tcp', 'setting tcp as protocol')
    nc.address('localhost')
    t.equal(nc._address, 'localhost', 'setting address localhost')
    nc.addr('127.0.0.1')
    t.equal(nc._address, '127.0.0.1', 'using addr alias')
    nc.port(2390)
    t.equal(nc._port, 2390, 'setting port 2390')
    nc.retry(0)
    t.equal(nc._retry, 0, 'setting retry to 0')
    nc.exec('/bin/sh')
    t.equal(nc._exec, '/bin/sh', 'setting exec to /bin/sh')
    nc.exec(null)

    nc.connect(function () {
      t.ok(nc.client, 'client connected')
      t.ok(nc.stream(), 'stream available')
      nc.close(function () {
        t.ok(true, 'close client')
        srv.close(function () {
          t.ok(true, 'close server')
        })
      })
    })
  } catch (e) {
    console.log(e)
    t.fail(e)
  }
})

test('TCP Client Server connection', function (t) {
  t.plan(4)
  t.timeoutAfter(5000)

  var nc = new NetcatServer()
  var nc2 = new NetcatClient()

  nc.port(2391).listen().on('data', function (socket, data) {
    t.ok(socket.id, 'Socket got an ID assigned')
    t.equal(data.toString(), 'Hello World', 'got expected string')
    close()
  })

  nc2.addr('127.0.0.1').port(2391).connect(function () {
    t.equal(this, nc2, 'Got client istance')
    console.log('Sending message')
    this.send('Hello World')
  })

  function close () {
    nc.close(function () {
      t.ok(true, 'close server')
    })
  }
})

test('Client: send raw buffer', function (t) {
  t.plan(4)
  t.timeoutAfter(4000)

  var nc = new NetcatServer()
  var nc2 = new NetcatClient()

  nc.port(2391).listen().on('data', function (socket, data) {
    t.ok(socket.id, 'Socket got an ID assigned')
    t.deepEqual(data, Buffer.from('hello world'), 'got expected Buffer')
    close()
  })

  nc2.addr('127.0.0.1').port(2391).connect(function () {
    t.equal(this, nc2, 'Got client istance')
    console.log('Sending Buffer')
    this.send(Buffer.from('hello world'))
  })

  function close () {
    nc.close(function () {
      t.ok(true, 'close server')
    })
  }
})

test('Transfer a file (stream)', function (t) {
  t.plan(2)
  t.timeoutAfter(4000)

  var nc = new NetcatServer()
  var testFile = path.join(__dirname, 'tcp.js')
  var inputFile = fs.readFileSync(testFile)

  var concatStream = concat(function (file) {
    t.equal(file.toString(), inputFile.toString(), 'server got expected file')
  })

  nc.port(2391).listen().pipe(concatStream).on('srvClose', function () {
    t.ok(true, 'server closed (no keepalive)')
  })

  var nc2 = new NetcatClient()
  fs.createReadStream(testFile).pipe(nc2.addr('127.0.0.1').port(2391).connect().stream())
})

test('Serving a file with serve()', function (t) {
  t.plan(2)
  t.timeoutAfter(4000)

  var testFile = path.join(__dirname, 'tcp.js')
  var inputFile = fs.readFileSync(testFile)

  var nc = new NetcatServer()
  nc.port(2392).listen().serve(testFile).on('srvClose', function () {
    t.ok(true, 'server closed (no keepalive)')
  })

  var concatStream = concat(function (file) {
    t.equal(file.toString(), inputFile.toString(), 'client got expected file')
  })

  var nc2 = new NetcatClient()
  nc2.addr('127.0.0.1').port(2392).connect().pipe(concatStream)
})

test('Serving a file using keepalive to multiple clients', function (t) {
  var nClients = 10 // 10 clients
  t.plan(nClients + 1)
  t.timeoutAfter(5000)
  var k = 0

  var testFile = path.join(__dirname, 'tcp.js')
  var inputFile = fs.readFileSync(testFile)

  var nc = new NetcatServer()
  nc.port(2393).keepalive().listen().serve(testFile)

  var NCs = {}
  for (var i = 0; i < nClients; i++) {
    NCs[i] = new NetcatClient()
    NCs[i].addr('127.0.0.1').port(2393).connect().pipe(concat(function (file) {
      t.equal(file.toString(), inputFile.toString(), 'client got expected file')
      if (++k === nClients) {
        nc.close(function () {
          t.ok(true, 'server closed')
        })
      }
    }))
  }
})

test('Serving an istance of stream', function (t) {
  t.plan(2)
  t.timeoutAfter(4000)

  var testFile = path.join(__dirname, 'tcp.js')
  var inputFile = fs.readFileSync(testFile)
  var inputStream = fs.createReadStream(testFile)

  var nc = new NetcatServer()
  nc.port(2392).listen().serve(inputStream).on('srvClose', function () {
    t.ok(true, 'server closed (no keepalive)')
  })

  var concatStream = concat(function (file) {
    t.equal(file.toString(), inputFile.toString(), 'client got expected stream')
  })

  var nc2 = new NetcatClient()
  nc2.addr('127.0.0.1').port(2392).connect().pipe(concatStream)
})

test('Serving a stream using keepalive to multiple clients', function (t) {
  var nClients = 10 // 10 clients
  t.plan(nClients + 1)
  t.timeoutAfter(5000)
  var k = 0

  var testFile = path.join(__dirname, 'tcp.js')
  var inputFile = fs.readFileSync(testFile)
  var inputStream = fs.createReadStream(testFile)

  var nc = new NetcatServer()
  nc.port(2394).k().listen().serve(inputStream)

  var NCs = {}
  for (var i = 0; i < nClients; i++) {
    NCs[i] = new NetcatClient()
    NCs[i].addr('127.0.0.1').port(2394).connect().pipe(concat(function (file) {
      t.equal(file.toString(), inputFile.toString(), 'client got expected file')
      if (++k === nClients) {
        nc.close(function () {
          t.ok(true, 'server closed')
        })
      }
    }))
  }
})

test('Serving a raw Buffer', function (t) {
  t.plan(2)
  t.timeoutAfter(4000)

  var nc = new NetcatServer()
  nc.port(2392).listen().serve(Buffer.from('Hello World')).on('srvClose', function () {
    t.ok(true, 'server closed (no keepalive)')
  })

  var concatStream = concat(function (buf) {
    t.equal(buf.toString(), 'Hello World', 'client got expected Buffer')
  })

  var nc2 = new NetcatClient()
  nc2.addr('127.0.0.1').port(2392).connect().pipe(concatStream)
})

test('Server exec()', function (t) {
  t.plan(3)
  t.timeoutAfter(5000)

  var cmd = (os.platform() === 'win32') ? 'type' : 'cat'

  var nc = new NetcatServer()
  nc.port(2400).listen()
  .exec(cmd)
  .on('srvClose', function () {
    t.ok(true, 'server closed (no keepalive)')
  })
  t.equal(nc._exec, cmd, 'spawning process')

  var nc2 = new NetcatClient()
  nc2.port(2400).connect(function () {
    var self = this
    setTimeout(function () {
      self.send('Hello World')
    }, 1000)
  }).on('data', function (buf) { // one chunk
    t.equal(buf.toString(), 'Hello World', 'got expected stdout')
    nc2.close()
  })
})

test('Client exec()', function (t) {
  t.plan(5)
  t.timeoutAfter(5000)

  var cmd = (os.platform() === 'win32') ? 'type' : 'cat'

  var nc = new NetcatServer()
  nc.port(2401).listen()
  .once('connection', function(socket){
    t.ok(socket, 'client connected')
    socket.write('Hello World')
  })
  .once('data', function (sock, buf) { // one chunk
    t.ok(sock, 'got socket istance')
    t.equal(buf.toString(), 'Hello World', 'got expected stdout')
    nc.close()
  })
  .once('srvClose', function () {
    t.ok(true, 'server closed (no keepalive)')
  })

  var nc2 = new NetcatClient()
  nc2.port(2401).exec(cmd).connect()
  t.equal(nc2._exec, cmd, 'exec set')

})
