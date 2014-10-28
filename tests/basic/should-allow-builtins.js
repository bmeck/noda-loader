require('../../')

var assert = require('assert');

var fs = require('fs');
assert.equal(JSON.stringify(fs.readdirSync(process.env.HOME)), JSON.stringify(require('./fs.noda')));
