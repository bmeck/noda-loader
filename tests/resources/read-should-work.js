require('../../')

var assert = require('assert');
require('./read.noda')(function (err, data) {
  assert(!err);
  assert.equal('# read\n', String(data));
});
