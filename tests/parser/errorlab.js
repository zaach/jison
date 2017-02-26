var assert = require("chai").assert;
var Jison = require("../setup").Jison;
var Lexer = require("../setup").Lexer;


describe("Error Recovery/Handling", function () {
  it("test error caught", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           [".", "return 'ERR';"]
        ]
    };
    var grammar = {
        bnf: {
            "A" :['A x',
                  'A y',
                  [ 'A error', "return 'caught';" ],
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xxy'), "should parse");
    assert.equal(parser.parse('xyg'), "caught", "should return 'caught'");
  });

  it("test error recovery", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           [".", "return 'ERR';"]
        ]
    };
    var grammar = {
        bnf: {
            "A" :['A x',
                  ['A y', "return 'recovery'"],
                  'A error',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    assert.equal(parser.parse('xxgy'), "recovery", "should return 'recovery'");
  });

  it("test deep error recovery", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           ["g", "return 'g';"],
           [";", "return ';';"],
           [".", "return 'ERR';"]
        ]
    };
    var grammar = {
        bnf: {
            "S" :['g A ;',
                  ['g error ;', 'return "nested"']
                      ],
            "A" :['A x',
                  'x' ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('gxxx;'), "should parse");
    assert.equal(parser.parse('gxxg;'), "nested", "should return 'nested'");
  });

  it("test no recovery", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           [".", "return 'ERR';"]
        ]
    };
    var grammar = {
        bnf: {
            "A" :['A x',
                  ['A y', "return 'recovery'"],
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    assert.throws(function () { 
      parser.parse('xxgy'); 
    }, Error, /JisonParserError:[^]*?got unexpected ERR/);
  });

  it("test error after error recovery", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           ["g", "return 'g';"],
           [".", "return 'ERR';"]
        ]
    };
    var grammar = {
        bnf: {
            "S" :['g A y',
                  ['g error y', 'return "nested"']
                      ],
            "A" :['A x',
                  'x' ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    assert.throws(function () { 
      parser.parse('gxxx;'); 
    }, Error, /JisonParserError: Parsing halted while starting to recover from another error/);
  });

// WARNING: the actual test in here differs from what it says on the tin, as we differ from jison in error recovery behaviour in this regard:
  it("test throws error despite recovery rule", function() {
    var lexData2 = {
        rules: [
           ["0", "return 'ZERO';"],
           ["\\+", "return 'PLUS';"],
           [";", "return ';';"],
           [".", "return 'INVALID'"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammar = {
        bnf: {
            "S" :[ [ "Exp EOF",    "return $1" ]],
            "Exp" :[ [ "E ;",    "$$ = $1;" ],
                     [ "E error", "$$ = $1;" ]],
            "E" :[ [ "E PLUS T", "$$ = ['+',$1,$3]" ],
                   [ "T",        "$$ = $1" ] ],
            "T" :[ [ "ZERO",     "$$ = [0]" ] ]
        }
    };

    var parser = new Jison.Parser(grammar /*, {debug: true} */);
    parser.lexer = new Lexer(lexData2);

    var expectedAST = ["+", ["+", [0], [0]], [0]];

    assert.doesNotThrow(function () { parser.parse("0+0+0>"); });     // here we expect behaviour different from vanilla jison as our error recovery handling is a bit more sophisticated and this error is coped with
  });

  it("test error recovery rule on replacement error", function() {
    var lexData2 = {
        rules: [
           ["0", "return 'ZERO';"],
           ["\\+", "return 'PLUS';"],
           [";", "return ';';"],
           [".", "return 'INVALID'"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammar = {
        bnf: {
            "S" :[ [ "Exp EOF",    "return $1" ]],
            "Exp" :[ [ "E ;",    "$$ = $1;" ],
                   [ "E error",    "$$ = [$1, 'E']" ],
                   [ "E error PLUS E",    "$$ = [$1, 'E-plus', $E2]" ],
                   [ "E error E",    "$$ = [$E1, 'E-duo', $E2]" ]],
            "E" :[ [ "E PLUS T", "$$ = ['+',$1,$3]" ],
                   [ "T",        "$$ = $1" ] ],
            "T" :[ [ "ZERO",     "$$ = [0]" ] ]
        }
    };

    var parser = new Jison.Parser(grammar /*, {debug: true} */);
    parser.lexer = new Lexer(lexData2);

    var expectedAST1 = [["+", ["+", [0], [0]], [0]], 'E'];
    var expectedAST2 = [["+", [0], [0]], 'E-duo', ["+", [0], [0]]];
    var expectedAST3 = [["+", [0], [0]], 'E-plus', [0]];
    var expectedAST4 = [[0], 'E-duo', ["+", [0], [0]]];
    var expectedAST5 = [[0], 'E-plus', [0]];

    // here we expect behaviour **different** from vanilla jison 
    // as our error recovery handling is a bit more sophisticated
    // (we don't have to restart with the original error-triggering token once recovery has completed:
    // we check if that is feasible and if not, we skip that token as well as part of the recovery process)
    assert.doesNotThrow(function () { parser.parse("0+0+0>"); }, 'round 1');     
    assert.doesNotThrow(function () { parser.parse("0+0>0+0"); }, 'round 2');  // 'replacement error'
    assert.doesNotThrow(function () { parser.parse("0+0>+0"); }, 'round 3');   // 'insertion error'
    assert.doesNotThrow(function () { parser.parse("0+>0+0"); }, 'round 4');  // 'insertion error'
    assert.doesNotThrow(function () { parser.parse("0+>+0"); }, 'round 5');   // 'replacement error'

    assert.deepEqual(parser.parse("0+0+0>"), expectedAST1, 'round 1');
    assert.deepEqual(parser.parse("0+0>0+0"), expectedAST2, 'round 2');
    assert.deepEqual(parser.parse("0+0>+0"), expectedAST3, 'round 3');
    assert.deepEqual(parser.parse("0+>0+0"), expectedAST4, 'round 4');
    assert.deepEqual(parser.parse("0+>+0"), expectedAST5, 'round 5');
  });

  it("test correct AST after error recovery abrupt end", function() {
    var lexData2 = {
        rules: [
           ["0", "return 'ZERO';"],
           ["\\+", "return 'PLUS';"],
           [";", "return ';';"],
           ["$", "return 'EOF';"],
           [".", "return 'INVALID';"]
        ]
    };
    var grammar = {
        bnf: {
            "S" :[ [ "Exp EOF",    "return $1" ]],
            "Exp" :[ [ "E ;",    "$$ = $1;" ],
                     [ "E error", "$$ = $1;" ]],
            "E" :[ [ "E PLUS T", "$$ = ['+',$1,$3]"  ],
                   [ "T",        "$$ = $1" ]  ],
            "T" :[ [ "ZERO",     "$$ = [0]" ] ]
        }
    };

    var parser = new Jison.Parser(grammar /*, {debug: true} */);
    parser.lexer = new Lexer(lexData2);

    var expectedAST = ["+", ["+", [0], [0]], [0]];

    assert.deepEqual(parser.parse("0+0+0"), expectedAST);
  });


  it("test bison error recovery example", function() {
    var lexData2 = {
        rules: [
           ["0", "return 'ZERO';"],
           ["\\+", "return 'PLUS';"],
           [";", "return ';';"],
           ["$", "return 'EOF';"],
           [".", "return 'INVALID';"]
        ]
    };
    var grammar = {
        bnf: {
            "S" :[ [ "stmt stmt EOF",    "return $1" ]],
            "stmt" :[ [ "E ;",    "$$ = $1;" ],
                     [ "error ;", "$$ = $1;" ]],
            "E" :[ [ "E PLUS T", "$$ = ['+',$1,$3]"  ],
                   [ "T",        "$$ = $1" ]  ],
            "T" :[ [ "ZERO",     "$$ = [0]" ] ]
        }
    };

    var parser = new Jison.Parser(grammar /*, {debug: true} */);
    parser.lexer = new Lexer(lexData2);

    assert.ok(parser.parse("0+0++++>;0;"), "should recover");
  });


  it("test parse error exception class API", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           [".", "return 'ERR';"]
        ]
    };
    var grammar = {
        bnf: {
            "A" :['A x',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    try {
      parser.parse('xxy'); // must fail with exception being thrown of specific type!
      assert(false, "exception should have been thrown on parse error!");
    } catch (ex) {
      var JisonParserError = parser.JisonParserError;
      assert(JisonParserError);

      assert(ex instanceof Error);
      assert(ex instanceof JisonParserError);
      assert(ex.hash);
      assert(ex.message);

      // test API
      var t = new JisonParserError('test', 42);
      assert(t instanceof Error);
      assert(t instanceof JisonParserError);
      assert(t.hash === 42);
      assert(t.message === 'test');
      assert(t.toString() === 'JisonParserError: test');

      var t2 = new Error('a');
      var t3 = new JisonParserError('test', { exception: t2 });
      assert(t2 instanceof Error);
      assert(!(t2 instanceof JisonParserError));
      assert(t3 instanceof Error);
      assert(t3 instanceof JisonParserError);
      assert(!t2.hash);
      assert(t3.hash);
      assert(t3.hash.exception);
      assert(t2.message === 'a');
      assert(t3.message === 'a');
      assert(t2.toString() === 'Error: a');
      assert(t3.toString() === 'JisonParserError: a');

    }                    
  });

  it("test lex error exception class API", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"]
        ]
    };
    var grammar = {
        bnf: {
            "A" :['A x',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    try {
      parser.parse('xxy'); // must fail with exception being thrown of specific type!
      assert(false, "exception should have been thrown on lex error!");
    } catch (ex) {
      var JisonParserError = parser.JisonParserError;
      assert(JisonParserError);

      assert(ex instanceof Error);
      assert(ex instanceof JisonParserError);
      assert(ex.hash);
      assert(ex.message);

      assert(parser.lexer);
      var JisonLexerError = parser.lexer.JisonLexerError;
      assert(JisonLexerError);

      var ex_l = ex.hash.exception;
      assert(ex_l);
      assert(ex_l instanceof Error);
      assert(ex_l instanceof JisonLexerError);
      assert(ex_l.hash);
      assert(ex_l.message);


      // test API
      var t = new JisonLexerError('test', 42);
      assert(t instanceof Error);
      assert(t instanceof JisonLexerError);
      assert(t.hash === 42);
      assert(t.message === 'test');
      assert(t.toString() === 'JisonLexerError: test');

      var t2 = new Error('a');
      var t3 = new JisonLexerError('test', { exception: t2 });
      assert(t2 instanceof Error);
      assert(!(t2 instanceof JisonLexerError));
      assert(t3 instanceof Error);
      assert(t3 instanceof JisonLexerError);
      assert(!t2.hash);
      assert(t3.hash);
      assert(t3.hash.exception);
      assert(t2.message === 'a');
      assert(t3.message === 'a');
      assert(t2.toString() === 'Error: a');
      assert(t3.toString() === 'JisonLexerError: a');
    }                    
  });
});



