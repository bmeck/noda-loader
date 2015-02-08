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

var _wrap = Module.wrap;
var bootstrap = require.resolve('./root-resource-bootstrap.js');
Module.wrap = function () {
  var src = '(function (exports, require, module, __filename, __dirname) {' +
    'if (!require.listResources){require("' + bootstrap + '")(require, __filename)}' + 
    'return ' + _wrap.apply(this, arguments).replace(/\s*;\s*$/g, '') + '.apply(this, arguments)' +
  '});';
  return src;
}

