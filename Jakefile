#!/usr/bin/env narwhal
 
var FILE = require("file"),
    OS = require("os"),
    jake = require("jake");

jake.task("test", function () {
    OS.system(['narwhal', 'tests/all-tests.js']);
});
jake.task("test:parser", function () {
    OS.system(['narwhal', 'tests/parser/parser-tests.js']);
});
jake.task("test:lexer", function () {
    OS.system(['narwhal', 'tests/lexer/lexer-tests.js']);
});
jake.task("test:grammar", function () {
    OS.system(['narwhal', 'tests/grammar/grammar-tests.js']);
});
