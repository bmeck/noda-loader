require('../../')

var assert = require('assert');

assert.equal('not the main', require('./require-inside-module.noda'));
