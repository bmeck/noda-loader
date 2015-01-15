#! /usr/bin/env bash
echo ';(function (_require, _process) {'
PATH="$PATH:../node_modules/.bin" browserify --bare -t single-binary-transform -e main.js
echo '})(require, process);'
