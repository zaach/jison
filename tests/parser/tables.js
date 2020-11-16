var assert = require("chai").assert;
var Jison = require("../setup").Jison;


var lexData = {
    rules: [
       ["a", "return 'a';"],
       ["b", "return 'b';"],
       ["c", "return 'c';"],
       ["d", "return 'd';"],
       ["e", "return 'e';"],
       ["x", "return 'x';"],
       ["y", "return 'y';"],
       ["z", "return 'z';"]
    ]
};

describe("Parser Tables", function () {
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
    var gen2 = new Jison.Generator(grammar, {type: "lalr"});

    assert.equal(gen.table.length, 4, "table has 4 states");
    assert.equal(gen.nullable('A'), true, "A is nullable");
    assert.equal(gen.conflicts, 0, "should have no conflict");
    assert.deepEqual(gen.table, gen2.table, "should have identical tables");
  });

  it("test slr lalr lr tables are equal", function () {
    var grammar = {
        tokens: [ "ZERO", "PLUS"],
        startSymbol: "E",
        bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "slr"});
    var gen2 = new Jison.Generator(grammar, {type: "lalr"});
    var gen3 = new Jison.Generator(grammar, {type: "lr"});

    assert.deepEqual(gen.table, gen2.table, "slr lalr should have identical tables");
    assert.deepEqual(gen2.table, gen3.table, "lalr lr should have identical tables");
  });

  it("test LL parse table", function () {
    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                   ''      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "ll"});

    assert.deepEqual(gen.table, {$accept:{x:[0], $end:[0]}, A:{x:[1], $end:[2]}}, "ll table has 2 states");
  });

  it("test LL parse table with conflict", function () {

    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "L",
        bnf: {
            "L" :[ 'T L T',
                   ''      ],
            "T" :[ "x" ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "ll"});
    assert.equal(gen.conflicts, 1, "should have 1 conflict");
  });

  it("test Ambigous grammar", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'A B A',
                   'x'      ],
            "B" :[ '',
                   'y'      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lr"});
    assert.equal(gen.conflicts, 2, "should have 2 conflict");
  });

  // for Minimal LR testing. Not there yet.
  it("test Spector grammar G1", function () {
    var grammar = {
        "tokens": "z d b c a",
        "startSymbol": "S",
        "bnf": {
            "S" :[ "a A c",
                   "a B d",
                   "b A d",
                   "b B c"],
            "A" :[ "z" ],
            "B" :[ "z" ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lalr", debug: false});
    assert.ok(!gen.DEBUG, "should have DEBUG *DIS*abled");
    assert.strictEqual(gen.conflicts, 2, "should have 2 conflicts");

    var parser = gen.createParser();
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = gen.createLexer(lexData);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

    assert.ok(parser.parse("azc"), "parse 'azc'");

    // The if(0)'d checks are the ones you would expect to work if this 
    // was an LALR(2) or LR(2) parser, which would have reported ZERO CONFLICTS:

    if (0) {
      assert.ok(parser.parse("azd"), "parse 'azd'");
    } else { 
      assert.throws(function () {
        parser.parse("azd");
      }, JisonParserError, /Parse error on line[^]*?got unexpected "d"/);
    }
    if (0) {
      assert.ok(parser.parse("bzc"), "parse 'bzc'");
    } else {
      assert.throws(function () {
        parser.parse("bzc");
      }, JisonParserError, /Parse error on line[^]*?got unexpected "c"/);
    }
    assert.ok(parser.parse("bzd"), "parse 'bzd'");
  });

  it("test De Remer G4", function () {
    var grammar = {
        "tokens": "z d b c a",
        "startSymbol": "S",
        "bnf": {
            "S" : "a A d | b A c | b B d",
            "A" : "e A | e",
            "B" : "e B | e"
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lalr", debug: false});
    assert.strictEqual(gen.conflicts, 0, "should have no conflict");

    var parser = gen.createParser();
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = gen.createLexer(lexData);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

    assert.ok(parser.parse("aed"), "parse 'aed'");
    assert.ok(parser.parse("bec"), "parse 'bec'");
    assert.ok(parser.parse("bed"), "parse 'bed'");
    assert.ok(parser.parse("beec"), "parse 'beec'");
    assert.ok(parser.parse("beed"), "parse 'beed'");
  });
});
