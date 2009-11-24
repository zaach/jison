var Jison = require("../setup").Jison,
    Lex = require("../setup").Lex,
    assert = require("assert");

var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};
var lexData2 = {
    rules: [
       ["0", "return 'ZERO';"],
       ["\\+", "return 'PLUS';"]
    ]
};

exports["test 0+0 grammer"] = function () {

    var grammer = {
        tokens: [ "ZERO", "PLUS"],
        startSymbol: "E",
        bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new Lex.Lexer_(lexData2);

    assert.ok(parser.parse("0+0+0"), "parse");
    assert.ok(parser.parse("0"), "parse single 0");

    assert.throws(function () {parser.parse("+")}, "throws parse error on invalid");
};

exports["test xx nullable grammer"] = function () {

    var grammer = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new Lex.Lexer_(lexData);

    assert.ok(parser.parse("xxx"), "parse");
    assert.ok(parser.parse("x"), "parse single x");
    assert.throws(function (){parser.parse("+");}, "throws parse error on invalid");
};

exports["test LR parse"] = function () {
    var grammer = {
        tokens: [ "ZERO", "PLUS"],
        startSymbol: "E",
        bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
        }
    };
    var parser = new Jison.Parser(grammer, {type: "lr"});
    parser.lexer = new Lex.Lexer_(lexData2);

    assert.ok(parser.parse("0+0+0"), "parse");
};

