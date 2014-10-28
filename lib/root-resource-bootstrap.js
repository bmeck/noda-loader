var path = require('path');
var fs = require('fs');
var existsSync = fs.existsSync || path.existsSync;
var exists= fs.exists || path.exists;
module.exports = function bootstrap(require, filename) {
  require.resourceExistsSync = function listResources(resourcePath) {
    return existsSync(path.resolve(path.dirname(filename), resourcePath));
  }
  require.resourceExists = function readResource(resourcePath, opts, cb) {
    exists(path.resolve(path.dirname(filename), resourcePath), cb);
  }
  require.listResources = function listResources(resourcePath) {
    return fs.readdirSync(path.resolve(path.dirname(filename), resourcePath));
  }
  require.readResource = function readResource(resourcePath, opts) {
    return fs.readFileSync(path.resolve(path.dirname(filename), resourcePath), opts); 
  }
  require.listResources = function listResources(resourcePath, cb) {
    fs.readdir(path.resolve(path.dirname(filename), resourcePath), cb);
  }
  require.readResource = function readResource(resourcePath, opts, cb) {
    fs.readFile(path.resolve(path.dirname(filename), resourcePath), opts, cb); 
  }
  require.createResourceReadStream = function createResourceReadStream(resourcePath, opts, cb) {
    return fs.createReadStream(path.resolve(path.dirname(filename), resourcePath), opts); 
  }
}
