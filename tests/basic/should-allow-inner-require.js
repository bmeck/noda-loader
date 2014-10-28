require('../../')

var assert = require('assert');

assert.equal('inner-require', require('./inner-require.noda'));
