#!/usr/bin/env narwhal

exports.testBNF = require("./bnf");
exports.testParse = require("./parse");
exports.testConvert = require("./json2jison");

if (require.main === module.id)
    require("os").exit(require("test").run(exports)); 
