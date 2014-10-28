require('../../')

var assert = require('assert');

try {
  require('./relative-require.noda');
}
catch (e) {
  assert.equal(e.code, 'ENOENT');
}
