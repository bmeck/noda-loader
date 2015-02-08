var Module = require('module').Module;

var _wrap = Module.wrap;
Module.wrap = function () {
  var src = '(function (exports, require, module, __filename, __dirname) {' +
    'if (!require.listResources){(' + bootstrap + ')()}' +
    'return ' + _wrap.apply(this, arguments).replace(/\s*;\s*$/g, '') + '.apply(this, arguments)' +
  '});';
  return src;
}

function bootstrap() { 
  var path = require('path');
  var fs = require('fs');
  var existsSync = fs.existsSync || path.existsSync;
  var exists= fs.exists || path.exists;
  require.resourceExistsSync = function listResources(resourcePath) {
    return existsSync(path.resolve(path.dirname(__filename), resourcePath));
  }
  require.resourceExists = function readResource(resourcePath, opts, cb) {
    exists(path.resolve(path.dirname(__filename), resourcePath), cb);
  }
  require.listResources = function listResources(resourcePath) {
    return fs.readdirSync(path.resolve(path.dirname(__filename), resourcePath));
  }
  require.readResource = function readResource(resourcePath, opts, cb) {
    fs.readFile(path.resolve(path.dirname(__filename), resourcePath), opts, cb); 
  }
  require.readResourceSync = function readResource(resourcePath, opts) {
    return fs.readFileSync(path.resolve(path.dirname(__filename), resourcePath), opts); 
  }
  require.listResources = function listResources(resourcePath, cb) {
    fs.readdir(path.resolve(path.dirname(__filename), resourcePath), cb);
  }
  require.listResourcesSync = function listResources(resourcePath) {
    return fs.readdirSync(path.resolve(path.dirname(__filename), resourcePath));
  }
  require.createReadStream = function createResourceReadStream(resourcePath, opts, cb) {
    return fs.createReadStream(path.resolve(path.dirname(__filename), resourcePath), opts); 
}
}
