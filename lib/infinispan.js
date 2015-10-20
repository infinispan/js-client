(function() {

  var net = require('net');

  var client = new net.Socket();

  exports.start = function() {
    client.connect(11222, '127.0.0.1', function() {
      console.log('Connected');
      //client.write('Hello, server! Love, Client.');
    });

    client.on('data', function(data) {
      //console.log('Received: ' + data);
      var magic = data.readUInt8(0);
      console.log("Magic respose: 0x" + magic.toString(16).toUpperCase());
      var msgId = data.readUInt8(1);
      console.log("Msg id: " + msgId);
      var op = data.readUInt8(2);
      console.log("Op: 0x" + op.toString(16).toUpperCase());
      var status = data.readUInt8(3);
      console.log("Status: " + status);
      var topologyId = data.readUInt8(4);
      console.log("Topology id: " + topologyId);
    });

    client.on('end',function(){
      console.log("Reading end");
    });

    client.on('error', function(err){
      console.log("Error: "+err.message);
    })
  };

  exports.ping = function() {
    // Buffer size needs to be precise, otherwise if bigger
    // it starts consuming next request from that
    var buf = new Buffer(8);
    buf.fill(0); // to avoid garbage
    buf.writeUInt8(0xA0, 0); // magic - byte
    buf.writeUInt8(0, 1); // msg id - vlong
    buf.writeUInt8(24, 2); // version
    buf.writeUInt8(0x17, 3); // ping op
    buf.writeUInt8(0, 4); // cache name length
    buf.writeUInt8(0, 5); // flags
    buf.writeUInt8(1, 6); // basic client intelligence
    buf.writeUInt8(0, 7); // client topology id
    client.write(buf); // write buffer
  }

}.call(this));