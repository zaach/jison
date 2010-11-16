#!/usr/bin/env narwhal
 
var FILE = require("file"),
    OS = require("os"),
    jake = require("jake");

var path = FILE.path(FILE.cwd());

jake.task("build:web", function() {
    var bundler = require("cjs-bundler"),
        script = bundler.bundle([
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
