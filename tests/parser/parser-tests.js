#!/usr/bin/env narwhal

exports.testAPI = require("./api");
exports.testLR0 = require("./lr0");
exports.testSLR = require("./slr");
exports.testLALR = require("./lalr");
exports.testAST = require("./ast");
exports.testTables = require("./tables");
exports.testPrecedence = require("./precedence");

if (require.main === module.id)
    require("os").exit(require("test").run(exports)); 
