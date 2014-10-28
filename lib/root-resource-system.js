var fs = require('fs');
var path = require('path');
var Module = require('module').Module;

function stripBOM(content) {
  // Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
  // because the buffer-to-string conversion in `fs.readFileSync()`
  // translates it to FEFF, the UTF-16 BOM.
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  return content;
}

function _js(module, filename) {
  var content = fs.readFileSync(filename, 'utf8');
  require('./root-resource-bootstrap.js')(require, filename);
  var true_content = stripBOM(content);
  return module._compile(true_content, filename);
}

require('module')._extensions['.js'] = _js; 
