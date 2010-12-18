 
var IO = require("../lib/jison/util/io");

var path = IO.cwd();

function generate () {
    var bundler = require("./cjs-bundler"),
        script = bundler.bundle([
        { id : "jison", path : IO.join(path, "lib", "jison.js") },
        { id : "jison/lexer", path : IO.join(path, "lib", "jison", "lexer.js") },
        { id : "jison/bnf", path : IO.join(path, "lib", "jison", "bnf.js") },
        { id : "jison/jisonlex", path : IO.join(path, "lib", "jison", "jisonlex.js") },
        //{ id : "jison/json2jison", path : IO.join(path, "lib", "jison", "json2jison.js") },
        { id : "jison/util/set", path : IO.join(path, "lib", "jison", "util", "set.js") },
        { id : "jison/util/typal", path : IO.join(path, "lib", "jison", "util", "typal.js") },
        { id : "jison/util/bnf-parser", path : IO.join(path, "lib", "jison", "util", "bnf-parser.js") },
        { id : "jison/util/lex-parser", path : IO.join(path, "lib", "jison", "util", "lex-parser.js") }
    ]);

    var out = "var require = (function() {\n" + script + ";\nreturn require;\n})();";
    IO.p(out);
}
 
generate();
