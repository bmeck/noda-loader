require('../../')

var assert = require('assert');
var path = require('path');

var abs_path = path.join(__dirname, 'package-json.noda');

assert.equal('package-json', require('./absolute-archive.noda')(abs_path));
