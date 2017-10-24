// documentation :: mygenerator.js

var Parser = require("jison").Parser;

var grammar = {
    "lex": {
        "rules": [
           ["\\s+", "/* skip whitespace */"],
           ["[a-f0-9]+", "return 'HEX';"]
        ]
    },

    "bnf": {
        "hex_strings" :[ "hex_strings HEX",
                         "HEX" ]
    }
};

var parser = new Parser(grammar);

// generate source, ready to be written to disk
var parserSource = parser.generate();

// you can also use the parser directly from memory

parser.parse("adfe34bc e82a");
// returns true

parser.parse("adfe34bc zxg");
// throws lexical error

