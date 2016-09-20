var Jison = require("../setup").Jison,
    Lexer = require("../setup").Lexer,
    assert = require("assert");

var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};

exports["test tokens as a string"] = function () {

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
};

exports["test generator"] = function () {

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
};

exports["test extra spaces in productions"] = function () {

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
};

exports["test | separated rules"] = function () {

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
};

exports["test start symbol optional"] = function () {

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
    assert.ok(gen.startSymbol === 'A', 'The default startsymbol must match the first rule');
};

exports["test start symbol should be nonterminal"] = function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "x",
        bnf: {
            "A" :"A x | A y | "
        }
    };

    assert.throws(function () { new Jison.Generator(grammar); }, "throws error");
};

exports["test token list as string"] = function () {

    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :"A x | A y | "
        }
    };

    var gen = new Jison.Generator(grammar);
    assert.ok(gen.terminals.indexOf('x') >= 0);
};

exports["test grammar options"] = function () {

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
    assert.ok(gen.options.type === 'slr');
};

exports["test overwrite grammar options"] = function () {

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
    assert.ok(gen.options.type === 'lr0');
    assert.equal(gen.constructor, Jison.LR0Generator);
};

exports["test yy shared scope"] = function () {
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
};


exports["test parser generator selection"] = function () {

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
};


exports["test custom parse error method"] = function () {
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
        throw str;
    };

    assert.throws(function () { parser.parse("aga"); });
    assert.strictEqual(result.text, "a", "parse error text should equal b");
    assert.strictEqual(typeof result.token, 'string', "parse error token should be a string");
    assert.strictEqual(result.line, 0, "hash should include line number");
};

exports["test jison grammar as string"] = function () {

    var grammar = "%% A : A x | A y | ;"

    var parser = new Jison.Generator(grammar).createParser();
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
};

exports["test no default resolve"] = function () {
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
    parser.lexer = new Lexer(lexData);

    assert.ok(gen.table.length === 4, "table has 4 states");
    assert.ok(gen.conflicts === 2, "encountered 2 conflicts");
    assert.throws(function () { parser.parse("xx"); }, "throws parse error for multiple actions");
};


exports["test EOF in 'Unexpected token' error message"] = function () {

    var grammar = {
        bnf: {
            "A" :[ 'x x y' ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    parser.lexer.showPosition = null; // needed for "Unexpected" message
    parser.yy.parseError = function (str, hash) {
        assert.ok(str.match("end of input"));
        // as we override the default parseError(),
        // the default behaviour of throwing an exception is not available now;
        // instead the parser will return our return value:
        if ('expected' in hash) {
            return 666; // parser error
        } else {
            return 7;   // lexer error
        }
    };

    assert.ok(parser.parse("xx") === 666, "on error, the parseError return value is the parse result");
};

exports["test whether default parser error handling throws an exception"] = function () {

    var grammar = {
        bnf: {
            "A" :[ 'x x y' ]
        }
    };

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
//    parser.lexer.showPosition = null; // needed for "Unexpected" message

    assert.throws(function () { parser.parse("xx"); });
};

exports["test locations"] = function () {
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
};

exports["test default location action"] = function () {
    var grammar = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                  ['y', 'return @$'],
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
};

exports["test locations by term name in action"] = function () {
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
};

exports["test lexer with no location support"] = function () {
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
    var loc = parser.parse('xx\nxy');
};

exports["test instance creation"] = function () {
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
};

exports["test reentrant parsing"] = function () {
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
};

exports["test generated parser must have working parse API method"] = function () {
    var grammar = "%% A : A x | A y | ; %%";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
};

exports["test generated parser must export added user-defined methods"] = function () {
    var grammar = "%% A : A x | A y | ; %% parser.dummy = function () { return 42; };"

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
    assert.ok(typeof parser.dummy === 'function');
    assert.ok(parser.dummy() === 42);
};

exports["test consistent behaviour across many invocations of the parse() API"] = function () {
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
};

exports["test multiple invocations of the cleanupAfterParse API should be survivable"] = function () {
    var grammar = "%options no-try-catch\n%% A : A x | A y | ;"

    // this test should catch the closure error fixed in 
    // SHA-1: 4067a2e900d1e9c3f62a969d4c9a06ce4e124628 :: fix grave bug in 
    // new kernel / APIs cleanupAfterParse et al due to closure mistake
    
    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    assert.ok(typeof parser.cleanupAfterParse !== 'function', 'API will only be present after first call to parse() API');
    assert.ok(!parser.cleanupAfterParse, 'API will only be present after first call to parse() API (null check)');
    assert.ok(parser.parse('xyx'), "parse xyx");
    assert.ok(typeof parser.cleanupAfterParse === 'function', 'API must be present after first call to parse() API');
    assert.doesNotThrow(function () { parser.cleanupAfterParse(); }, 'repetitive invocations of the cleanup API should be fine: round 1');
    assert.doesNotThrow(function () { parser.cleanupAfterParse(); }, 'repetitive invocations of the cleanup API should be fine: round 2');
    assert.doesNotThrow(function () { parser.cleanupAfterParse(); }, 'repetitive invocations of the cleanup API should be fine: round 3');

    // did cleanup reset the API properly?
    assert.ok(typeof parser.parseError === 'function');
    assert.ok(parser.parseError === parser.originalParseError);
    assert.ok(typeof parser.quoteName === 'function');
    assert.ok(parser.quoteName === parser.originalQuoteName);
};

// See if `$$` is properly returned by the grammar when there's no explicit `return` statement in the actions:
exports["test default parse value return of $$"] = function () {
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
    assert.ok(rv === 'exyx', "parse xyx");
};

exports["test YY shared state usage"] = function () {
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
    assert.ok(rv === 'exyx', "parse xyx");
    assert.ok(shared_state_base.step1 === 0, "object to initialize shared state should not be modified");
    assert.ok(shared_state_base.step2 === 0, "object to initialize shared state should not be modified");
    assert.ok(shared_state_base.step3 === 0, "object to initialize shared state should not be modified");

    assert.ok(parser.yy === shared_state_base, "yy reference of parser object points to object used to initialize shared state");

    assert.ok(work_state !== shared_state_base, "yy reference passed to parser callbacks must be the active shared state object");
    assert.ok(work_state.step1 === 2, "yy reference available in parser rule actions must be the active shared state object");
    assert.ok(work_state.step2 === 1, "yy reference available in parser rule actions must be the active shared state object");
    assert.ok(work_state.step3 === 1, "yy reference available in parser rule actions must be the active shared state object");
};

exports["test default parse exception hash object contents"] = function () {
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
    parser.lexer = new Lexer(lexData);
    parser.yy = shared_state;

    // a good run: no errors:
    var rv = parser.parse('xyx');

    assert.ok(rv === 'exy:x', "parse xyx");
    assert.ok(pre_count === 1);
    assert.ok(post_count === 1);

    // a bad run: a LEXER exception will be thrown:
    // Thanks to the parser kernel catching it and transforming it to 
    // a PARSER error, we will receive it here as a PARSER exception
    // (with a nested LEXER exception)
    rv = false;
    try {
        rv = parser.parse('xyx?');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
        assert.ok(rv.hash, "exception is supposed to be a parser/lexer exception, hence it should have a hash member");
        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert = [ 
          'action',
          'destroy',
          'errStr',
          'exception',
          'expected',
          'lexer',
          'line',
          //'loc',
          'new_state',
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
        assert.ok(kl.length === kl_sollwert.length, "the parser/lexer `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert[i], "the parser/lexer `hash` object is supposed to carry specific members");
        }

        // exception is supposed to contain a LEXER exception:
        rv = rv.hash.exception;
        assert.ok(rv.hash, "exception is supposed to be a lexer exception, hence it should have a hash member");
        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert2 = [ 
          // 'action',
          // 'destroy',
          // 'errStr',
          // 'exception',
          // 'expected',
          'lexer',
          'line',
          'loc',
          // 'new_state',
          // 'recoverable',
          // 'stack_pointer',
          // 'state',
          // 'state_stack',
          // 'symbol_stack',
          'text',
          'token',
          // 'token_id',
          // 'value',
          // 'value_stack',
          // 'yy' 
        ];
        assert.ok(kl.length === kl_sollwert2.length, "the LEXER `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert2[i], "the LEXER `hash` object is supposed to carry specific members");
        }
    }
    assert.ok(pre_count === 2, "pre_parse is invoked at the start of every parse");
    assert.ok(post_count === 2, "post_parse is invoked at the end of every parse, even the ones which throw an exception");

    // a bad run: a PARSER exception will be thrown:
    rv = false;
    try {
        rv = parser.parse('xyyx');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
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
          'new_state',
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
        assert.ok(kl.length === kl_sollwert3.length, "the PARSER `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert3[i], "the PARSER `hash` object is supposed to carry specific members");
        }
    }
    assert.ok(pre_count === 3, "pre_parse is invoked at the start of every parse");
    assert.ok(post_count === 3, "post_parse is invoked at the end of every parse, even the ones which throw an exception");
};

// a side-effect of a crash/exception thrown in a no-try-catch grammar is that the cleanup is NOT executed then,
// hence no post_parse callback invocation will occur!
//
// For the rest, this test is the same as the previous one...
exports["test %options no-try-catch"] = function () {
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

    assert.ok(rv === 'exy:x', "parse xyx");
    assert.ok(pre_count === 1);
    assert.ok(post_count === 1);

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
        assert.ok(rv.hash, "exception is supposed to be a lexer exception, hence it should have a hash member");

        assert(rv.hash.exception === undefined, "exception is NOT supposed to be nested, i.e. contain a LEXER exception");

        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert2 = [ 
          //'action',
          //'destroy',
          //'errStr',
          //'exception',
          //'expected',
          'lexer',
          'line',
          'loc',
          //'new_state',
          //'recoverable',
          //'stack_pointer',
          //'state',
          //'state_stack',
          //'symbol_stack',
          'text',
          'token',
          //'token_id',
          //'value',
          //'value_stack',
          //'yy' 
        ];
        assert.ok(kl.length === kl_sollwert2.length, "the LEXER `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert2[i], "the LEXER `hash` object is supposed to carry specific members");
        }
    }
    assert.ok(pre_count === 2, "pre_parse is invoked at the start of every parse");
    assert.ok(post_count === 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");

    // a bad run: a PARSER exception will be thrown:
    rv = false;
    try {
        rv = parser.parse('xyyx');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
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
          'new_state',
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
        assert.ok(kl.length === kl_sollwert3.length, "the PARSER `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert3[i], "the PARSER `hash` object is supposed to carry specific members");
        }
    }
    assert.ok(pre_count === 3, "pre_parse is invoked at the start of every parse");
    assert.ok(post_count === 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");
};

exports["test %options on-demand-lookahead"] = function () {
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

    assert.ok(rv === 'exy:x', "parse xyx");
    assert.ok(pre_count === 1);
    assert.ok(post_count === 1);

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
        assert.ok(rv.hash, "exception is supposed to be a lexer exception, hence it should have a hash member");

        assert(rv.hash.exception === undefined, "exception is NOT supposed to be nested, i.e. contain a LEXER exception");

        var kl = Object.keys(rv.hash).sort();
        // the `hash` object is supposed to carry all these members:
        const kl_sollwert2 = [ 
          //'action',
          //'destroy',
          //'errStr',
          //'exception',
          //'expected',
          'lexer',
          'line',
          'loc',
          //'new_state',
          //'recoverable',
          //'stack_pointer',
          //'state',
          //'state_stack',
          //'symbol_stack',
          'text',
          'token',
          //'token_id',
          //'value',
          //'value_stack',
          //'yy' 
        ];
        assert.ok(kl.length === kl_sollwert2.length, "the LEXER `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert2[i], "the LEXER `hash` object is supposed to carry specific members");
        }
    }
    assert.ok(pre_count === 2, "pre_parse is invoked at the start of every parse");
    assert.ok(post_count === 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");

    // a bad run: a PARSER exception will be thrown:
    rv = false;
    try {
        rv = parser.parse('xyyx');
        assert.ok(false, "parser run is expected to FAIL");
    } catch (ex) {
        rv = ex;
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
          'new_state',
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
        assert.ok(kl.length === kl_sollwert3.length, "the PARSER `hash` object is supposed to carry a specific member set, no more, no less");
        for (var i = 0, l = kl.length; i < l; i++) {
            assert.ok(kl[i] === kl_sollwert3[i], "the PARSER `hash` object is supposed to carry specific members");
        }
    }
    assert.ok(pre_count === 3, "pre_parse is invoked at the start of every parse");
    assert.ok(post_count === 1, "post_parse is invoked at the end of every parse, but ONLY when the parse did not fail");
};

exports["test %options no-default-action"] = function () {
    var grammar = "%options no-default-action\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var grammar2 = "/* %options no-default-action */\n" +
        "%%\n" +
        "A :\n" +
        "  x A   /* --- should have been default action --- */ \n" +
        "| y A   %{ $$ = $A + $y; %}\n" +
        "|       %{ $$ = 'e'; %}\n" +
        ";\n" +
        " %% ";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);

    var parser2 = new Jison.Parser(grammar2);
    parser2.lexer = new Lexer(lexData);

    // since the no-default-action is set for this grammar, the return value is really 
    // UNDETERMINED, but we happen to know just how the kernel and state stack work
    // internally, hence we can at least state that the 'unexpected/undetermined'
    // result of the `x A` rule will be at least reproducible, hence we can test for 
    // the (weird) return value!
    var rv = parser.parse('xyxyx');
    //console.log('rv: ', rv);

    var rv2 = parser2.parse('xyxyx');
    //console.log('rv2: ', rv2);

    assert.ok(rv === 'eyy', "parse xyxyx with no-default-action may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");
    assert.ok(rv2 === 'x', "parse xyxyx with default-action enabled may produce other insensible results when you're not careful to provide your own $$ assignment actions for every rule which is not served well by the default `$$=$1` action");

    rv = parser.parse('yyyyx');
    //console.log('rv: ', rv);

    rv2 = parser2.parse('yyyyx');
    //console.log('rv2: ', rv2);

    assert.ok(rv === 'eyyyy', "parse xyxyx with no-default-action may produce insensible results when you're not careful to provide your own $$ assignment actions for every rule");
    assert.ok(rv2 === 'xyyyy', "parse xyxyx with default-action enabled may produce other insensible results when you're not careful to provide your own $$ assignment actions for every rule which is not served well by the default `$$=$1` action");


    rv = parser.parse('yyyyyy');
    //console.log('rv: ', rv);

    rv2 = parser2.parse('yyyyyy');
    //console.log('rv2: ', rv2);

    assert.ok(rv === 'eyyyyyy', "parse xyxyx with no-default-action");
    assert.ok(rv2 === 'eyyyyyy', "parse xyxyx with default-action enabled (the default)");
};





// %options on-demand-lookahead    // camelCased: option.onDemandLookahead
// %options no-default-action      // JISON shouldn't bother injecting the default `$$ = $1` action anywhere!
// %options no-try-catch           // we assume this parser won't ever crash and we want the fastest Animal possible! So get rid of the try/catch/finally in the kernel!

// %parse-param globalSpace        // extra function parameter for the generated parse() API; we use this one to pass in a reference to our workspace for the functions to play with.


