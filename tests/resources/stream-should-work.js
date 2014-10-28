require('../../')

var assert = require('assert');
var data = [];
require('./stream.noda').on('data', function (chunk) {
  data.push(chunk);
}).on('end', function () {
  assert.equal('# read\n', data.join(''));
});
