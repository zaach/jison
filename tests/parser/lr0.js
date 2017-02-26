var assert = require("chai").assert;
var Jison = require("../setup").Jison;
var Lexer = require("../setup").Lexer;


var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};


describe("LR(0)", function () {
  it("test left-recursive nullable grammar", function () {

    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
            ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);

    assert.ok(parser.parse('xxx'), "parse 3 x's");
    assert.ok(parser.parse("x"),   "parse single x");
    assert.throws(function () {
      parser.parse("y");
    }, Error, /JisonParserError:[^]*?got unexpected y/);
  });

  it("test right-recursive nullable grammar", function () {

    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
            ''      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lr0"});

    assert.ok(gen.table.length == 4, "table has 4 states");
    assert.ok(gen.conflicts == 2, "encountered 2 conflicts");
  });

  it("test 0+0 grammar", function () {
    var lexData2 = {
        rules: [
           ["0", "return 'ZERO';"],
           ["\\+", "return 'PLUS';"]
        ]
    };
    var grammar = {
        tokens: [ "ZERO", "PLUS"],
        startSymbol: "E",
        bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData2);

    assert.ok(parser.parse("0+0+0"), "parse");
    assert.ok(parser.parse("0"), "parse single 0");

    assert.throws(function () {
      parser.parse("+");
    }, Error, /JisonParserError:[^]*?Expecting "ZERO", E, T, got unexpected "PLUS"/);
  });
});
