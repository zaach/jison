var assert = require("chai").assert;
var Jison = require("../setup").Jison;
var Lexer = require("../setup").Lexer;


var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};


describe("SLR", function () {
  it("test left-recursive nullable grammar", function () {

    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   ''      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "slr"});

    assert.equal(gen.table.length, 3, "table has 3 states");
    assert.equal(gen.conflicts, 0, "no conflicts");

    var parser = gen.createParser();
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = new Lexer(lexData);
    assert(parser.lexer);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

    assert.equal(gen.nullable('A'), true, "A is nullable");

    assert.ok(parser.parse("xxx"), "parse 3 x's");
    assert.ok(parser.parse("x"),   "parse single x");
    assert.ok(parser.parse(""),    "parse zero x");

    // also test the two different types of errors a parser can produce:

    assert.throws(function () {
      parser.parse("y");
    }, JisonParserError, /Parse error on line[^]*?got unexpected y/);

    assert.throws(function () {
      parser.parse("+");
    }, JisonLexerError, /Lexical error on line[^]*?Unrecognized text/);

    assert.strictEqual(gen.conflicts, 0, "no conflicts");

    // parsers generated 'live' have a few extra members copied over from
    // the JISON parser generator engine itself: 
    // - conflicts (count)
    // - productions (rule set)
    // - unused_productions (rule set)
    // which is a feature we employ here to check no conflicts have been
    // reported during grammar compilation:
    assert.strictEqual(parser.conflicts, 0, "no conflicts");
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

    var gen = new Jison.Generator(grammar, {type: "slr"});

    assert.equal(gen.table.length, 4, "table has 4 states");
    assert.equal(gen.conflicts, 0, "no conflicts");

    var parser = gen.createParser();
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = new Lexer(lexData);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

    assert.ok(parser.parse("xxx"), "parse 3 x's");
    assert.ok(parser.parse("x"),   "parse single x");
    assert.ok(parser.parse(""),    "parse zero x");

    assert.equal(gen.nullable('A'), true, "A is nullable");

    // also test the two different types of errors a parser can produce:

    assert.throws(function () {
      parser.parse("y");
    }, JisonParserError, /Parse error on line[^]*?got unexpected y/);

    assert.throws(function () {
      parser.parse("+");
    }, JisonLexerError, /Lexical error on line[^]*?Unrecognized text/);
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

    var parser = new Jison.Parser(grammar, {type: "slr"});
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = new Lexer(lexData2);

    assert.ok(parser.parse("0+0+0"), "parse");
    assert.ok(parser.parse("0"), "parse single 0");

    assert.throws(function () {
      parser.parse("+");
    }, JisonParserError, /Parse error on line \d+[^]*?Expecting "ZERO", "E", "T", got unexpected "PLUS"/);
  });
});
