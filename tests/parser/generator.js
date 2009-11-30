var Jison = require("../setup").Jison,
    Lexer = require("../setup").Lexer,
    assert = require("assert");



exports["test commonjs module generator"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammer = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var input = "xyxxxy";
    var parser_ = new Jison.Parser(grammer);
    parser_.lexer = new Lexer(lexData);

    var parserSource = parser_.generateCommonJSModule();
    var exports = {};
    eval(parserSource);

    assert.ok(exports.parse(input));
};

exports["test module generator"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammer = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var input = "xyxxxy";
    var parser_ = new Jison.Parser(grammer);
    parser_.lexer = new Lexer(lexData);

    var parserSource = parser_.generateModule();
    eval(parserSource);

    assert.ok(parser.parse(input));
};
