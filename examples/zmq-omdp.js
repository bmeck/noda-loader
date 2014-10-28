require('../');
var zmq = require('./zmq-omdp-0.0.92/');

var broker = new zmq.Broker('tcp://*:55555');
      broker.start(function () {


var worker = new zmq.Worker('tcp://localhost:55555', 'echo');

      worker.on('error', function(e) {
        console.log('ERROR', e);
      });

      worker.on('request', function(inp, rep) {
        console.error('GOT REQUEST');
        rep.end({msg:inp});
      });

      worker.start();

var client = new zmq.Client('tcp://localhost:55555');

    client.on('error', function(e) {
      console.log('ERROR', e);
    });


    client.start();

    setInterval(function () {

        var msg = new Date()+'';
        console.log('SENDING', msg);

        var req = client.request(
          'echo', msg, 
          function(err, data) {
            console.log("PARTIAL", err, data);
          },
          function(err, data) {
            console.log("END", err, data);
          }, { timeout: 60000 }
        );

    }, 5e3);
});
