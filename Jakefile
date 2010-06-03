#!/usr/bin/env narwhal
 
var FILE = require("file"),
    OS = require("os"),
    bundler = require("cjs-bundler"),
    jake = require("jake");

jake.task("build", ["build:bnf", "build:lex"]);

jake.task("build:bnf", function () {
    OS.system(['./bin/jison', 'src/bnf.jison', 'src/bnf.jisonlex']);
    OS.system(['mv', 'bnf.js', 'lib/jison/util/bnf-parser.js']);
});

jake.task("build:lex", function () {
    OS.system(['./bin/jison', 'src/jisonlex.jison', 'src/jisonlex.jisonlex']);
    OS.system(['mv', 'jisonlex.js', 'lib/jison/util/lex-parser.js']);
});


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

var path = FILE.path(FILE.cwd());

jake.task("build:web", function() {
    var script = bundler.bundle([
        { id : "jison", path : path.join("lib", "jison.js") },
        { id : "jison/lexer", path : path.join("lib", "jison", "lexer.js") },
        { id : "jison/bnf", path : path.join("lib", "jison", "bnf.js") },
        { id : "jison/jisonlex", path : path.join("lib", "jison", "jisonlex.js") },
        { id : "jison/json2jison", path : path.join("lib", "jison", "json2jison.js") },
        { id : "jison/util/set", path : path.join("lib", "jison", "util", "set.js") },
        { id : "jison/util/typal", path : path.join("lib", "jison", "util", "typal.js") },
        { id : "jison/util/bnf-parser", path : path.join("lib", "jison", "util", "bnf-parser.js") },
        { id : "jison/util/lex-parser", path : path.join("lib", "jison", "util", "lex-parser.js") }
    ]);

    FILE.write("web/content/assets/js/jison.js", "var require = (function() {\n" + script + ";\nreturn require;\n})();");
    OS.system(['make', 'web']);
});
 
jake.task("preview", function () {
    OS.system(['make', 'preview']);
});
