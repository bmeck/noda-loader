#! /usr/bin/env bash
echo ';(function (_require, _process) {'
browserify --bare -t single-binary-transform -e main.js
echo '})(require, process);'
