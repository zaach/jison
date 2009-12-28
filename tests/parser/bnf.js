var Jison = require("../setup").Jison,
    Lexer = require("../setup").Lexer,
    assert = require("assert");

exports["test BNF parser"] = function () {
    var grammar = {
        "lex": {
            "rules": [
              ["\\s+", "/* skip whitespace */"],
              ["[a-zA-Z][a-zA-Z0-9]*", "return 'ID';"],
              [":", "return ':';"],
              [";", "return ';';"],
              ["\\|", "return '|';"],
              ["$", "return 'EOF';"]
            ]
        },
        "bnf": {
            "grammar" :[ "production_list EOF" ],
            "production_list" :[ "production_list production", "production" ],
            "production" :[ "id : handle_list ;" ],
            "handle_list" :[ "handle_list | handle",  "handle"],
            "handle" :[ "handle id", "id", ""],
            "id" :[ "ID" ]
        }
    };

    var parser = new Jison.Parser(grammar);
    assert.ok(parser.parse('foo : bar baz blitz | bar | ;\nbar: ;\nbaz: | foo ;'), "parse bnf production");
};

