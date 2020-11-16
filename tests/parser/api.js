var assert = require("chai").assert;
var Jison = require("../setup").Jison;
var Lexer = require("../setup").Lexer;

var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};


describe("JISON API", function () {
  it("test tokens as a string", function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
  });

  it("test generator", function () {

    var grammar = {
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
  });

  it("test extra spaces in productions", function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x ',
                   'A y',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
  });

  it("test | separated rules", function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :"A x | A y | "
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
  });

  it("test start symbol optional", function () {

    var grammar = {
        tokens: "x y z",
        bnf: {
            "A" :"A x | A y | B",
            "B" :"z"
        }
    };

    var gen = Jison.Generator(grammar);
    var parser = gen.createParser();
    assert.ok(gen.nonterminals['A'], 'A must be identified as a non-terminal');
    assert.ok(gen.startSymbol, 'A default startsymbol must be picked by Jison');
    assert.strictEqual(gen.startSymbol, 'A', 'The default startsymbol must match the first rule');
  });

  it("test start symbol should be nonterminal", function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "x",
        bnf: {
            "A" :"A x | A y | "
        }
    };

    assert.throws(function () { 
      new Jison.Generator(grammar); 
    }, Error, /startSymbol must be a non-terminal found in your grammar/);
  });

  it("test token list as string", function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :"A x | A y | "
        }
    };

    var gen = new Jison.Generator(grammar);
    assert.ok(gen.terminals.indexOf('x') >= 0);
  });

  it("test grammar options", function () {

    var grammar = {
        options: {type: "slr"},
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var gen = new Jison.Generator(grammar);
    assert.ok(gen);
    assert.ok(gen.options);
    assert.ok(gen.options.type);
    assert.strictEqual(gen.options.type, 'slr');
  });

  it("test overwrite grammar options", function () {

    var grammar = {
        options: {type: "slr"},
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lr0"});
    assert.ok(gen);
    assert.ok(gen.options);
    assert.ok(gen.options.type);
    assert.strictEqual(gen.options.type, 'lr0');
    assert.equal(gen.constructor, Jison.LR0Generator);
  });

  it("test yy shared scope", function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return yy.xed ? 'yfoo' : 'ybar';"]
        ]
    };
    var grammar = {
        tokens: "x yfoo ybar",
        startSymbol: "A",
        bnf: {
            "A" :[[ 'A x', "yy.xed = true;" ],
                  [ 'A yfoo', " return 'foo';" ],
                  [ 'A ybar', " return 'bar';" ],
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lr0"});
    parser.lexer = new Lexer(lexData);
    assert.equal(parser.parse('y'), "bar", "should return bar");
    assert.equal(parser.parse('xxy'), "foo", "should return foo");
  });


  it("test parser generator selection", function () {

    var grammar = {
        options: {type: "slr"},
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lr0"});
    assert.equal(gen.constructor, Jison.LR0Generator);
  });


  it("test custom parse error method", function () {
    var lexData = {
        rules: [
           ["a", "return 'a';"],
           ["b", "return 'b';"],
           ["c", "return 'c';"],
           ["d", "return 'd';"],
           ["g", "return 'g';"]
        ]
    };
    var grammar = {
        "tokens": "a b c d g",
        "startSymbol": "S",
        "bnf": {
            "S" :[ "a g d",
                   "a A c",
                   "b A d",
                   "b g c" ],
            "A" :[ "B" ],
            "B" :[ "g" ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lalr"});
    parser.lexer = new Lexer(lexData);
    var result = {};
    parser.yy.parseError = function (str, hash) {
        result = hash;
        throw new Error("CUSTOM: " + str);
    };

    assert.throws(function () { 
      parser.parse("aga"); 
    }, Error, /CUSTOM: Parsing aborted due to exception\./);
    assert.strictEqual(result.text, "a", "parse error text should equal b");
    assert.strictEqual(typeof result.token, 'string', "parse error token should be a string");
    assert.strictEqual(result.line, 0, "hash should include line number");
  });

  it("test jison grammar as string", function () {

    var grammar = "%% A : A x | A y | ;"

    var parser = new Jison.Generator(grammar).createParser();
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
  });

  it("test no default resolve", function () {
    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
            ''      ]
        }
    };

    var gen = new Jison.Generator(grammar, {type: "lr0", noDefaultResolve: true});
    var parser = gen.createParser();
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = new Lexer(lexData);
    assert(parser.lexer);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

    assert.strictEqual(gen.table.length, 4, "table has 4 states");
    assert.strictEqual(gen.conflicts, 2, "encountered 2 conflicts");

    assert.throws(function () { 
      parser.parse("xx"); 
    }, JisonParserError, /multiple actions possible/);
  });


  it("test EOF in 'Unexpected token' error message", function () {

    var grammar = {
        bnf: {
            "A" :[ 'x x y' ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    parser.lexer.showPosition = null; // needed for "Unexpected" message
    parser.yy.parseError = function (str, hash) {
        assert.ok(str.match("end of input"), "expected 'end of input' but got: " + str);
        // as we override the default parseError(),
        // the default behaviour of throwing an exception is not available now;
        // instead the parser will return our return value:
        if ('expected' in hash) {
            return 666; // parser error
        } else {
            return 7;   // lexer error
        }
    };

    assert.strictEqual(parser.parse("xx"), 666, "on error, the parseError return value is the parse result");
  });

  it("test whether default parser error handling throws an exception", function () {

    var grammar = {
        bnf: {
            "A" :[ 'x x y' ]
        }
    };

    var parser = new Jison.Parser(grammar);
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = new Lexer(lexData);
    assert(parser.lexer);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

//    parser.lexer.showPosition = null; // needed for "Unexpected" message

    assert.throws(function () { 
      parser.parse("xx"); 
    }, JisonParserError, /Expecting "y", got unexpected end/);

    assert.throws(function () { 
      parser.parse("xxQ"); 
    }, JisonLexerError, /Unrecognized text/);
  });

  it("test locations", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                   ['y', 'return @1'],
            ''      ]
        }
    };

    var lexData = {
        rules: [
           ["\\s", "/*ignore*/"],
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var gen = new Jison.Generator(grammar);
    var parser = gen.createParser();
    parser.lexer = new Lexer(lexData);
    var loc = parser.parse('xx\nxy');

    assert.equal(loc.first_line, 2, 'first line correct');
    assert.equal(loc.last_line, 2, 'last line correct');
    assert.equal(loc.first_column, 1, 'first column correct');
    assert.equal(loc.last_column, 2, 'last column correct');
  });

  it("test default location action", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ [ 'x A', 'return [@1, @A]'],    // TODO: should return `@$` and jison should analyze the action code and insert the default action before the userland action code here
                   'y',     
                   '' ]
        }
    };

    var lexData = {
        rules: [
           ["\\s", "/*ignore*/"],
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var gen = new Jison.Generator(grammar /* , { debug: 1, exportAllTables: true } */ );
    var parser = gen.createParser();
    parser.lexer = new Lexer(lexData);
    var loc = parser.parse('xx\nxy');

    assert.equal(loc[0].first_line, 2, 'first line correct');
    assert.equal(loc[0].last_line, 2, 'second line correct');
    assert.equal(loc[0].first_column, 0, 'first column correct');
    assert.equal(loc[0].last_column, 1, 'second column correct');

    assert.equal(loc[1].first_line, 2, 'third line correct');
    assert.equal(loc[1].last_line, 2, 'fourth line correct');
    assert.equal(loc[1].first_column, 1, 'third column correct');
    assert.equal(loc[1].last_column, 2, 'fourth column correct');
  });

  it("test locations by term name in action", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                  ['B', 'return @B'],
            ''      ],
            "B" :[ 'y' ]
        }
    };

    var lexData = {
        rules: [
           ["\\s", "/*ignore*/"],
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var gen = new Jison.Generator(grammar);
    var parser = gen.createParser();
    parser.lexer = new Lexer(lexData);
    var loc = parser.parse('xx\nxy');

    assert.equal(loc.first_line, 2, 'first line correct');
    assert.equal(loc.last_line, 2, 'last line correct');
    assert.equal(loc.first_column, 1, 'first column correct');
    assert.equal(loc.last_column, 2, 'last column correct');
  });

  it("test default location tracking across grammar", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ [ 'B', '$$ = { value: $B, loc: @B, yytext: yytext, yylloc: yyloc, yystate: yystate, yysp: yysp, yyvstack: yyvstack, yylstack: yylstack, yystack: yystack, yysstack: yysstack }' ],
                   [ 'error', '$$ = { value: $error, loc: @error, yytext: yytext, yylloc: yyloc, yystate: yystate, yysp: yysp, yyvstack: yyvstack, yylstack: yylstack, yystack: yystack, yysstack: yysstack }' ] 
                 ],
            "B" :[   'x B',
                     'y',
                     '' ]
        }
    };

    var lexData = {
        rules: [
           ["\\s", "/*ignore*/"],
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           [".", "return 'UFO';"]
        ]
    };
    var gen = new Jison.Generator(grammar);
    var parser = gen.createParser();
    parser.lexer = new Lexer(lexData);
    var loc = parser.parse('xx\nxy');
    assert(loc);
    // assert.equal(loc[0].first_line, 2, 'first line correct');
    // assert.equal(loc[0].last_line, 2, 'second line correct');
    // assert.equal(loc[0].first_column, 0, 'first column correct');
    // assert.equal(loc[0].last_column, 1, 'second column correct');

    // assert.equal(loc[1].first_line, 2, 'third line correct');
    // assert.equal(loc[1].last_line, 2, 'fourth line correct');
    // assert.equal(loc[1].first_column, 1, 'third column correct');
    // assert.equal(loc[1].last_column, 2, 'fourth column correct');
  });

  it("test lexer with no location support", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                  ['B', 'return @B'],
            ''      ],
            "B" :[ 'y' ]
        }
    };

    var fake_loc = {
        first_line: 666,
        last_line: 999,
        first_column: 1,
        last_column: 42
    };

    var gen = new Jison.Generator(grammar);
    var parser = gen.createParser();
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = {
      toks: ['x','x','x','y'],
      lex: function () {
        return this.toks.shift();
      },
      setInput: function () {},
      // fake loc:
      yylloc: fake_loc
    };

    var loc = parser.parse('xx\nxy');

    assert.deepEqual(loc, fake_loc, "`return @B;` action code should produce the `fake_loc` value stored in the lexer");

    // when you don't have a more-or-less usable fake yylloc in your lexer 
    // when your PARSER/GRAMMAR has location tracking code, you're still 
    // not gonna crash as then a default (empty) yylloc will be assumed
    // by the parser code:
    delete parser.lexer.yylloc;
    var loc1 = parser.parse('xx\nxy');

    assert.strictEqual(loc1, true, "`return @B;` action code should produce TRUE (default parser exit value on successful parse) as the lexer-provided location would be UNDEFINED");



    // ------------------------------------------------------------------------
    //
    // However, you should be FINE when your grammar does not do anything with
    // locations:
    var grammar2 = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                  ['B', 'return #B'],   // return token ID number of `B`!
            ''      ],
            "B" :[ 'y' ]
        }
    };

    var gen2 = new Jison.Generator(grammar2);
    var parser2 = gen2.createParser();
    var JisonParserError2 = parser2.JisonParserError; 
    assert(JisonParserError2);
    assert.notEqual(JisonParserError, JisonParserError2, "JISON code generator produces a new parser error class for every generated parser");

    parser2.lexer = {
      toks: ['x','x','x','y'],
      lex: function () {
        return this.toks.shift();
      },
      setInput: function () {},
      // fake loc:
      yylloc: undefined
    };

    var loc2 = parser2.parse('xx\nxy');
    assert.equal(loc2, parser2.symbols_['B'], "grammar2's `return #B;` action code should produce the symbol ID value for grammar token `B`");
  });

  it("test instance creation", function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                  ['B', 'return @B'],
            ''      ],
            "B" :[ 'y' ]
        }
    };

    var gen = new Jison.Generator(grammar);
    var parser = gen.createParser();
    parser.lexer = {
      toks: ['x','x','x','y'],
      lex: function () {
        return this.toks.shift();
      },
      setInput: function () {}
    };
    var parser2 = new parser.Parser();
    parser2.lexer = parser.lexer;
    parser2.parse('xx\nxy');

    parser.blah = true;

    assert.notEqual(parser.blah, parser2.blah, "should not inherit");
  });

  it("test reentrant parsing", function () {
    var grammar = {
        bnf: {
            "S" :['A EOF'],
            "A" :['x A',
                  'B',
                  'C'
                 ],
            "B" :[['y', 'return "foo";']],
            "C" :[['w', 'return yy.parser.parse("xxxy") + "bar";']]
        }
    };

    var lexData = {
        rules: [
           ["\\s", "/*ignore*/"],
           ["w", "return 'w';"],
           ["x", "return 'x';"],
           ["y", "return 'y';"],
           ["$", "return 'EOF';"]
        ]
    };
    var gen = new Jison.Generator(grammar);
    var parser = gen.createParser();
    parser.lexer = new Lexer(lexData);
    var result = parser.parse('xxw');
    assert.equal(result, "foobar");
  });

  it("test generated parser must have working parse API method", function () {
    var grammar = "%% A : A x | A y | ; %%";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
  });

  it("test generated parser must export added user-defined methods", function () {
    var grammar = "%% A : A x | A y | ; %% parser.dummy = function () { return 42; };"

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
    assert.strictEqual(typeof parser.dummy, 'function');
    assert.strictEqual(parser.dummy(), 42);
  });

  it("test consistent behaviour across many invocations of the parse() API", function () {
    var grammar = "%% A : A x | A y | ;"

    // this test should catch the closure error fixed in 
    // SHA-1: 4067a2e900d1e9c3f62a969d4c9a06ce4e124628 :: fix grave bug in 
    // new kernel / APIs cleanupAfterParse et al due to closure mistake
    
    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx - round 1");
    assert.ok(parser.parse('xyx'), "parse xyx - round 2");
    assert.ok(parser.parse('xyx'), "parse xyx - round 3");
    assert.ok(parser.parse('xyx'), "parse xyx - round 4");
    assert.ok(parser.parse('xyx'), "parse xyx - round 5");
    assert.ok(parser.parse('xyx'), "parse xyx - round 6");
  });

  it("test multiple invocations of the cleanupAfterParse API should be survivable", function () {
    var grammar = "%options no-try-catch\n%% A : A x | A y | ;"

    // this test should catch the closure error fixed in 
    // SHA-1: 4067a2e900d1e9c3f62a969d4c9a06ce4e124628 :: fix grave bug in 
    // new kernel / APIs cleanupAfterParse et al due to closure mistake
    
    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    assert.notEqual(typeof parser.cleanupAfterParse, 'function', 'API will only be present after first call to parse() API');
    assert.ok(!parser.cleanupAfterParse, 'API will only be present after first call to parse() API (null check)');
    assert.ok(parser.parse('xyx'), "parse xyx");
    assert.equal(typeof parser.cleanupAfterParse, 'function', 'API must be present after first call to parse() API');
    assert.doesNotThrow(function () { parser.cleanupAfterParse(); }, 'repetitive invocations of the cleanup API should be fine: round 1');
    assert.doesNotThrow(function () { parser.cleanupAfterParse(); }, 'repetitive invocations of the cleanup API should be fine: round 2');
    assert.doesNotThrow(function () { parser.cleanupAfterParse(); }, 'repetitive invocations of the cleanup API should be fine: round 3');

    // did cleanup reset the API properly?
    assert.equal(typeof parser.parseError, 'function');
    assert.equal(parser.parseError, parser.originalParseError);
    assert.equal(typeof parser.quoteName, 'function');
    assert.equal(parser.quoteName, parser.originalQuoteName);
  });

  // See if `$$` is properly returned by the grammar when there's no explicit `return` statement in the actions:
  it("test default parse value return of $$", function () {
    var grammar = "\n" +
        "%%\n" +
        "A :\n" +
        "  A x %{ $$ = $A + $x; %}\n" +
        "| A y %{ $$ = $A + $y; %}\n" +
        "|     %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    var rv = parser.parse('xyx');
    assert.equal(rv, 'exyx', "parse xyx");
  });

  it("test YY shared state usage", function () {
    var grammar = "\n" +
        "%%\n" +
        "A :\n" +
        "  A x %{ $$ = $A + $x; yy.step1++; %}\n" +
        "| A y %{ $$ = $A + $y; yy.step2++; %}\n" +
        "|     %{ $$ = 'e';     yy.step3++; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    // this shared state object won't be changed by the parser: 
    // it only serves as the init values set.
    var shared_state_base = {
        step1: 0,
        step2: 0,
        step3: 0,

        pre_parse: function(yy) {
            // obtain and store reference to the shared state object that's actually used!
            work_state = yy; 
        }
    };
    var work_state;
    parser.yy = shared_state_base;

    var rv = parser.parse('xyx');
    //console.log('shared state = ', parser.yy, shared_state_base, work_state);
    assert.equal(rv, 'exyx', "parse xyx");
    assert  .equal(shared_state_base.step1, 0, "object to initialize shared state should not be modified");
    assert.equal(shared_state_base.step2, 0, "object to initialize shared state should not be modified");
    assert.equal(shared_state_base.step3, 0, "object to initialize shared state should not be modified");

    assert.equal(parser.yy, shared_state_base, "yy reference of parser object points to object used to initialize shared state");

    assert.notEqual(work_state, shared_state_base, "yy reference passed to parser callbacks must be the active shared state object");
    assert.equal(work_state.step1, 2, "yy reference available in parser rule actions must be the active shared state object");
    assert.equal(work_state.step2, 1, "yy reference available in parser rule actions must be the active shared state object");
    assert.equal(work_state.step3, 1, "yy reference available in parser rule actions must be the active shared state object");
  });

  it("test default parse exception hash object contents", function () {
    var grammar = "\n" +
        "%%\n" +
        "A :\n" +
        "  A x   %{ $$ = $A + $x; %}\n" +
        "| A y x %{ $$ = $A + $y + ':' + $x; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var pre_count = 0;
    var post_count = 0;
    var shared_state = {
        pre_parse: function () { 
            pre_count++;
        },
        post_parse: function () { 
            post_count++;
        }
    };

    var parser = new Jison.Parser(grammar);
    var JisonParserError = parser.JisonParserError; 
    assert(JisonParserError);

    parser.lexer = new Lexer(lexData);
    assert(parser.lexer);
    var JisonLexerError = parser.lexer.JisonLexerError; 
    assert(JisonLexerError);

    parser.yy = shared_state;

    // a good run: no errors:
    var rv = parser.parse('xyx');

    assert.equal(rv, 'exy:x', "parse xyx");
    assert.equal(pre_count, 1, "# invocations of pre_parse");
    assert.equal(post_count, 1, "# invocations of post_parse");

    // a bad run: a LEXER exception will be thrown:
    // Thanks to the parser kernel catching it and transforming it to 
    // a PARSER error, we will receive it here as a PARSER exception
    // (with a nested LEXER exception)
    rv = false;
    try {
        rv = parser.parse('xyx?');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        // exception is supposed to be a LEXER exception:
        rv = ex;
        assert.instanceOf(ex, JisonLexerError, "parse failure is expected to originate from the lexer this time");

        assert.ok(rv.hash, "exception is supposed to be a parser/lexer exception, hence it should have a hash member");
        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert = [ 
          // 'action',
          'destroy',
          'errStr',
          // 'exception',
          // 'expected',
          'lexer',
          'line',
          'loc',
          // 'new_state',
          // 'parser',
          'recoverable',
          // 'stack_pointer',
          // 'state',
          // 'state_stack',
          // 'symbol_stack',
          'text',
          'token',
          // 'token_id',
          // 'value',
          // 'value_stack',
          'yy' 
        ];
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.strictEqual(kl[i], kl_sollwert[i], "the parser/lexer `hash` object is supposed to carry specific members, but not " + kl[i]);
        }
        assert.equal(kl.length, kl_sollwert.length, "the parser/lexer `hash` object is supposed to carry a specific member set, no more, no less");

        assert.strictEqual(typeof rv.hash.exception, "undefined", "lexer exceptions don't contain inner exceptions in their `hash` property");
    }
    assert.equal(pre_count, 2, "pre_parse is invoked at the start of every parse");
    assert.equal(post_count, 2, "post_parse is invoked at the end of every parse, even the ones which throw an exception");

    // a bad run: a PARSER exception will be thrown:
    rv = false;
    try {
        rv = parser.parse('xyyx');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
        assert.instanceOf(rv, Error, "exception is supposed to be an Error subclass");
        assert.notInstanceOf(rv, parser.lexer.JisonLexerError, "exception is not supposed to be a lexer exception");
        assert.instanceOf(rv, parser.JisonParserError, "exception is supposed to be a parser exception");

        assert.ok(rv.hash, "exception is supposed to be a parser exception, hence it should have a hash member");
        var kl = Object.keys(rv.hash).sort();
        // the parser `hash` object is supposed to carry all these members:
        const kl_sollwert3 = [ 
          'action',
          'destroy',
          'errStr',
          'exception',
          'expected',
          'lexer',
          'line',
          //'loc',
          //'location_stack',
          'new_state',
          'parser',
          'recoverable',
          'stack_pointer',
          'state',
          'state_stack',
          'symbol_stack',
          'text',
          'token',
          'token_id',
          'value',
          'value_stack',
          'yy' 
        ];
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.strictEqual(kl[i], kl_sollwert3[i], "the PARSER `hash` object is supposed to carry specific members, but not " + kl[i]);
        }
        assert.strictEqual(kl.length, kl_sollwert3.length, "the PARSER `hash` object is supposed to carry a specific member set, no more, no less");
    }
    assert.strictEqual(pre_count, 3, "pre_parse is invoked at the start of every parse");
    assert.strictEqual(post_count, 3, "post_parse is invoked at the end of every parse, even the ones which throw an exception");
  });

  // a side-effect of a crash/exception thrown in a no-try-catch grammar is that the cleanup is NOT executed then,
  // hence no post_parse callback invocation will occur!
  //
  // For the rest, this test is the same as the previous one...
  it("test %options no-try-catch", function () {
    var grammar = "%options no-try-catch\n" +
        "%%\n" +
        "A :\n" +
        "  A x   %{ $$ = $A + $x; %}\n" +
        "| A y x %{ $$ = $A + $y + ':' + $x; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var pre_count = 0;
    var post_count = 0;
    var shared_state = {
        pre_parse: function () { 
            pre_count++;
        },
        post_parse: function () { 
            post_count++;
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    parser.yy = shared_state;

    // a good run: no errors:
    var rv = parser.parse('xyx');

    assert.strictEqual(rv, 'exy:x', "parse xyx");
    assert.strictEqual(pre_count, 1, "# invocations of pre_parse");
    assert.strictEqual(post_count, 1, "# invocations of post_parse");

    // a bad run: a LEXER exception will be thrown:
    //
    // The *parser* no longer has a try/catch block in its kernel, hence
    // lexer errors/exceptions will arrive here unadorned!
    //
    // I.e. the lexer exception won't be wrapped in a parser exception!
    rv = false;
    try {
        rv = parser.parse('xyx?');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
        assert.instanceOf(rv, Error, "exception is supposed to be an Error subclass");
        assert.instanceOf(rv, parser.lexer.JisonLexerError, "exception is supposed to be a lexer exception");
        assert.notInstanceOf(rv, parser.JisonParserError, "exception is not supposed to be a parser exception");

        assert.ok(rv.hash, "exception is supposed to be a lexer exception, hence it should have a hash member");

        assert.strictEqual(rv.hash.exception, undefined, "exception is NOT supposed to be nested, i.e. contain a LEXER exception");

        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert2 = [ 
          //'action',
          'destroy',
          'errStr',
          //'exception',
          //'expected',
          'lexer',
          'line',
          'loc',
          //'new_state',
          'recoverable',
          //'stack_pointer',
          //'state',
          //'state_stack',
          //'symbol_stack',
          'text',
          'token',
          //'token_id',
          //'value',
          //'value_stack',
          'yy' 
        ];
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.strictEqual(kl[i], kl_sollwert2[i], "the LEXER `hash` object is supposed to carry specific members, but not " + kl[i]);
        }
        assert.strictEqual(kl.length, kl_sollwert2.length, "the LEXER `hash` object is supposed to carry a specific member set, no more, no less");
    }
    assert.strictEqual(pre_count, 2, "pre_parse is invoked at the start of every parse");
    assert.strictEqual(post_count, 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");

    // a bad run: a PARSER exception will be thrown:
    rv = false;
    try {
        rv = parser.parse('xyyx');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
        assert.instanceOf(rv, Error, "exception is supposed to be an Error subclass");
        assert.notInstanceOf(rv, parser.lexer.JisonLexerError, "exception is not supposed to be a lexer exception");
        assert.instanceOf(rv, parser.JisonParserError, "exception is supposed to be a parser exception");

        assert.ok(rv.hash, "exception is supposed to be a parser exception, hence it should have a hash member");
        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert3 = [ 
          'action',
          'destroy',
          'errStr',
          'exception',
          'expected',
          'lexer',
          'line',
          //'loc',
          //'location_stack',
          'new_state',
          'parser',
          'recoverable',
          'stack_pointer',
          'state',
          'state_stack',
          'symbol_stack',
          'text',
          'token',
          'token_id',
          'value',
          'value_stack',
          'yy' 
        ];
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.strictEqual(kl[i], kl_sollwert3[i], "the PARSER `hash` object is supposed to carry specific members, but not " + kl[i]);
        }
        assert.strictEqual(kl.length, kl_sollwert3.length, "the PARSER `hash` object is supposed to carry a specific member set, no more, no less");
    }
    assert.strictEqual(pre_count, 3, "pre_parse is invoked at the start of every parse");
    assert.strictEqual(post_count, 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");
  });

  it("test %options on-demand-lookahead", function () {
    var grammar = "%options no-try-catch\n" +
        "%options on-demand-lookahead\n" +
        "%%\n" +
        "A :\n" +
        "  A x   %{ $$ = $A + $x; %}\n" +
        "| A y x %{ $$ = $A + $y + ':' + $x; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var pre_count = 0;
    var post_count = 0;
    var shared_state = {
        pre_parse: function () { 
            pre_count++;
        },
        post_parse: function () { 
            post_count++;
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    parser.yy = shared_state;

    // a good run: no errors:
    var rv = parser.parse('xyx');

    assert.strictEqual(rv, 'exy:x', "parse xyx");
    assert.strictEqual(pre_count, 1);
    assert.strictEqual(post_count, 1);

    // a bad run: a LEXER exception will be thrown:
    //
    // Since 2017/6/24 edition, the *parser* no longer adorns
    // lexer errors/exceptions, hence the unmodified lexer exceptions
    // arrive at userland code, so you may use `instanceof` to quickly 
    // and easily detect which type of parse error you're coping with.
    //
    // I.e. the lexer exception won't ever be wrapped in a parser exception!
    rv = false;
    try {
        rv = parser.parse('xyx?');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
        assert.instanceOf(rv, Error, "exception is supposed to be an Error subclass");
        assert.instanceOf(rv, parser.lexer.JisonLexerError, "exception is supposed to be a lexer exception");
        assert.notInstanceOf(rv, parser.JisonParserError, "exception is not supposed to be a parser exception");

        assert.ok(rv.hash, "exception is supposed to be a lexer exception, hence it should have a hash member");

        assert.strictEqual(rv.hash.exception, undefined, "exception is NOT supposed to be nested, i.e. contain a LEXER exception");

        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert2 = [ 
          //'action',
          'destroy',
          'errStr',
          //'exception',
          //'expected',
          'lexer',
          'line',
          'loc',
          //'new_state',
          'recoverable',
          //'stack_pointer',
          //'state',
          //'state_stack',
          //'symbol_stack',
          'text',
          'token',
          //'token_id',
          //'value',
          //'value_stack',
          'yy' 
        ];
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.strictEqual(kl[i], kl_sollwert2[i], "the LEXER `hash` object is supposed to carry specific members, but not " + kl[i]);
        }
        assert.strictEqual(kl.length, kl_sollwert2.length, "the LEXER `hash` object is supposed to carry a specific member set, no more, no less");
    }
    assert.strictEqual(pre_count, 2, "pre_parse is invoked at the start of every parse");
    assert.strictEqual(post_count, 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");

    // a bad run: a PARSER exception will be thrown:
    rv = false;
    try {
        rv = parser.parse('xyyx');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
        assert.instanceOf(rv, Error, "exception is supposed to be an Error subclass");
        assert.notInstanceOf(rv, parser.lexer.JisonLexerError, "exception is not supposed to be a lexer exception");
        assert.instanceOf(rv, parser.JisonParserError, "exception is supposed to be a parser exception");

        assert.ok(rv.hash, "exception is supposed to be a parser exception, hence it should have a hash member");
        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert3 = [ 
          'action',
          'destroy',
          'errStr',
          'exception',
          'expected',
          'lexer',
          'line',
          //'loc',
          //'location_stack',
          'new_state',
          'parser',
          'recoverable',
          'stack_pointer',
          'state',
          'state_stack',
          'symbol_stack',
          'text',
          'token',
          'token_id',
          'value',
          'value_stack',
          'yy' 
        ];
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.strictEqual(kl[i], kl_sollwert3[i], "the PARSER `hash` object is supposed to carry specific members, but not " + kl[i]);
        }
        assert.strictEqual(kl.length, kl_sollwert3.length, "the PARSER `hash` object is supposed to carry a specific member set, no more, no less");
    }
    assert.strictEqual(pre_count, 3, "pre_parse is invoked at the start of every parse");
    assert.strictEqual(post_count, 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");
  });

  it("test %options no-default-action", function () {
    var grammar = "%options no-default-action\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser;
    assert.throws(function () {
      parser = new Jison.Parser(grammar);
    }, Error, "has been OBSOLETED");
    //parser.lexer = new Lexer(lexData);
    //parser.parse('xyxyx');
  });

  it("test %options default-action-mode=skip", function () {
    var grammar = "%options default-action-mode=skip,skip\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    // since the default-action-mode is set to "skip" for this grammar, the return value is really 
    // UNDETERMINED, but we happen to know just how the kernel and state stack work
    // internally, hence we can at least state that the 'unexpected/undetermined'
    // result of the `x A` rule will be at least reproducible, hence we can test for 
    // the (weird) return value!
    var rv = parser.parse('xyxyx');

    assert.equal(rv, 'eyy', "parse xyxyx with default-action-mode=skip,skip may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyx');

    assert.equal(rv, 'eyyyy', "parse xyxyx with default-action-mode=skip,skip may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyyy');

    assert.equal(rv, 'eyyyyyy', "parse xyxyx with default-action-mode=skip,skip");
  });

  it("test %options default-action-mode=none", function () {
    var grammar = "%options default-action-mode=none,none\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    var rv = parser.parse('xyxyx');

    assert.equal(rv, true, "parse xyxyx with default-action-mode=classic may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyx');

    assert.equal(rv, 'undefinedyyyy', "parse xyxyx with default-action-mode=classic may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyyy');

    assert.equal(rv, 'eyyyyyy', "parse xyxyx with default-action-mode=classic");
  });

  it("test %options default-action-mode=classic", function () {
    var grammar = "%options default-action-mode=classic\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    var rv = parser.parse('xyxyx');

    assert.equal(rv, 'x', "parse xyxyx with default-action-mode=classic may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyx');

    assert.equal(rv, 'xyyyy', "parse xyxyx with default-action-mode=classic may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyyy');

    assert.equal(rv, 'eyyyyyy', "parse xyxyx with default-action-mode=classic");
  });

  it("test %options default-action-mode=ast", function () {
    var grammar = "%options default-action-mode=ast\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    var rv = parser.parse('xyxyx');

    assert.deepEqual(rv, ['x', 'x,x,eyy'], "parse xyxyx with default-action-mode=ast may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyx');

    assert.equal(rv, 'x,eyyyy', "parse xyxyx with default-action-mode=ast may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");

    rv = parser.parse('yyyyyy');

    assert.equal(rv, 'eyyyyyy', "parse xyxyx with default-action-mode=ast");
  });
});






// %parse-param globalSpace        // extra function parameter for the generated parse() API; we use this one to pass in a reference to our workspace for the functions to play with.


