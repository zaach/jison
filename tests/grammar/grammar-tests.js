#!/usr/bin/env narwhal

exports.testBNF = require("./bnf");

if (require.main === module.id)
    require("os").exit(require("test").run(exports)); 
