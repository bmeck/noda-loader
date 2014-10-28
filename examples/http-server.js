//require('../');
var server = require('./http-server-0.7.2.noda').createServer();
server.server.listen(process.env.PORT);
console.log('Server listening on ', server.server.address());
