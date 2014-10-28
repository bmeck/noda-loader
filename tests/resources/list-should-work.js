require('../../')

var assert = require('assert');
require('./list.noda')(function (err, resources) {
  assert(!err);
  assert.equal(JSON.stringify(['1', 'b']), JSON.stringify(resources));
});
