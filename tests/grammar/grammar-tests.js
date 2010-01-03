#!/usr/bin/env narwhal

exports.testBNF = require("./bnf");
exports.testParse = require("./parse");

if (require.main === module.id)
    require("os").exit(require("test").run(exports)); 
