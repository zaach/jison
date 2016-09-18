var Jison = require("../setup").Jison,
    Lexer = require("../setup").Lexer,
    assert = require("assert");

var fs = require('fs');
var path = require('path');

exports["test amd module generator"] = function() {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var input = "xyxxxy";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateAMDModule();
    var parser = null,
        define = function(deps, callback) {
            // temporary AMD-style define function, for testing.
            if (!callback) {
                // no deps array:
                parser = deps();
            } else {
                parser = callback();
            }
        };
    eval(parserSource);

    assert.ok(parser.parse(input));
};

exports["test commonjs module generator"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var input = "xyxxxy";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateCommonJSModule();
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
    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var input = "xyxxxy";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateModule();
    eval(parserSource);

    assert.ok(parser.parse(input));
};

exports["test module generator with module name"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var input = "xyxxxy";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generate({moduleType: "js", moduleName: "parsey"});
    eval(parserSource);

    assert.ok(parsey.parse(input));
};

exports["test module generator with namespaced module name"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        tokens: "x y",
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
        }
    };

    var compiler = {};

    var input = "xyxxxy";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generate({moduleName: "compiler.parser"});
    eval(parserSource);

    assert.ok(compiler.parser.parse(input));
};

exports["test module include"] = function () {
    var grammar = {
    "comment": "ECMA-262 5th Edition, 15.12.1 The JSON Grammar. (Incomplete implementation)",
    "author": "Zach Carter",

    "lex": {
        "macros": {
            "digit": "[0-9]",
            "exp": "([eE][-+]?{digit}+)"
        },
        "rules": [
            ["\\s+", "/* skip whitespace */"],
            ["-?{digit}+(\\.{digit}+)?{exp}?", "return 'NUMBER';"],
            ["\"[^\"]*", function(){
                if(yytext.charAt(yyleng-1) == '\\') {
                    // remove escape
                    yytext = yytext.substr(0,yyleng-2);
                    this.more();
                } else {
                    yytext = yytext.substr(1); // swallow start quote
                    this.input(); // swallow end quote
                    return "STRING";
                }
            }],
            ["\\{", "return '{'"],
            ["\\}", "return '}'"],
            ["\\[", "return '['"],
            ["\\]", "return ']'"],
            [",", "return ','"],
            [":", "return ':'"],
            ["true\\b", "return 'TRUE'"],
            ["false\\b", "return 'FALSE'"],
            ["null\\b", "return 'NULL'"]
        ]
    },

    "tokens": "STRING NUMBER { } [ ] , : TRUE FALSE NULL",
    "start": "JSONText",

    "bnf": {
        "JSONString": [ "STRING" ],

        "JSONNumber": [ "NUMBER" ],

        "JSONBooleanLiteral": [ "TRUE", "FALSE" ],


        "JSONText": [ "JSONValue" ],

        "JSONValue": [ "JSONNullLiteral",
                       "JSONBooleanLiteral",
                       "JSONString",
                       "JSONNumber",
                       "JSONObject",
                       "JSONArray" ],

        "JSONObject": [ "{ }",
                        "{ JSONMemberList }" ],

        "JSONMember": [ "JSONString : JSONValue" ],

        "JSONMemberList": [ "JSONMember",
                              "JSONMemberList , JSONMember" ],

        "JSONArray": [ "[ ]",
                       "[ JSONElementList ]" ],

        "JSONElementList": [ "JSONValue",
                             "JSONElementList , JSONValue" ]
    }
};

    var gen = new Jison.Generator(grammar);

    var parserSource = gen.generateModule();
    eval(parserSource);

    assert.ok(parser.parse(JSON.stringify(grammar.bnf)));
};

exports["test module include code"] = function () {
    var lexData = {
        rules: [
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        bnf: {
            "E"   :[ ["E y", "return test();"],
                     "" ]
        },
        moduleInclude: "function test(val) { return 1; }"
    };

    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateCommonJSModule();
    var exports = {};
    eval(parserSource);

    assert.equal(parser.parse('y'), 1, "semantic action");
};

exports["test lexer module include code"] = function () {
    var lexData = {
        rules: [
           ["y", "return test();"]
        ],
        moduleInclude: "function test() { return 1; }"
    };
    var grammar = {
        bnf: {
            "E"   :[ ["E y", "return $2;"],
                     "" ]
        }
    };

    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateCommonJSModule();
    var exports = {};
    eval(parserSource);

    assert.equal(parser.parse('y'), 1, "semantic action");
};

exports["test generated parser instance creation"] = function () {
    var grammar = {
        lex: {
            rules: [
               ["y", "return 'y'"]
            ]
        },
        bnf: {
            "E"   :[ ["E y", "return $2;"],
                     "" ]
        }
    };

    var gen = new Jison.Generator(grammar);

    var parserSource = gen.generateModule();
    eval(parserSource);

    var p = new parser.Parser;

    assert.equal(p.parse('y'), 'y', "semantic action");

    parser.blah = true;

    assert.notEqual(parser.blah, p.blah, "shouldn't inherit props");
};

exports["test module include code using generator from parser"] = function () {
    var lexData = {
        rules: [
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        bnf: {
            "E"   :[ ["E y", "return test();"],
                     "" ]
        },
        moduleInclude: "function test(val) { return 1; }"
    };

    var gen = new Jison.Parser(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateCommonJSModule();
    var exports = {};
    eval(parserSource);

    assert.equal(parser.parse('y'), 1, "semantic action");
};

exports["test module include with each generator type"] = function () {
    var lexData = {
        rules: [
           ["y", "return 'y';"]
        ]
    };
    var grammar = {
        bnf: {
            "E"   :[ ["E y", "return test();"],
                     "" ]
        },
        moduleInclude: "var TEST_VAR;"
    };

    var gen = new Jison.Parser(grammar);
    gen.lexer = new Lexer(lexData);
    ['generateModule', 'generateAMDModule', 'generateCommonJSModule']
    .map(function(type) {
      var source = gen[type]();
      assert.ok(/TEST_VAR/.test(source), type + " supports module include");
    });
};

// test for issue #246
exports["test compiling a parser/lexer"] = function () {
    var grammar =
      '// Simple "happy happy joy joy" parser, written by Nolan Lawson\n' +
      '// Based on the song of the same name.\n\n' +
      '%lex\n%%\n\n\\s+                   /* skip whitespace */\n' +
      '("happy")             return \'happy\'\n' +
      '("joy")               return \'joy\'\n' +
      '<<EOF>>               return \'EOF\'\n\n' +
      '/lex\n\n%start expressions\n\n' +
      '%ebnf\n\n%%\n\n' +
      'expressions\n    : e EOF\n        {return $1;}\n    ;\n\n' +
      'e\n    : phrase+ \'joy\'? -> $1 + \' \' + yytext \n    ;\n\n' +
      'phrase\n    : \'happy\' \'happy\' \'joy\' \'joy\' ' +
      ' -> [$1, $2, $3, $4].join(\' \'); \n    ;';

    var parser = new Jison.Parser(grammar);
    var generated = parser.generate();

    var tmpFile = path.resolve(__dirname, 'tmp-parser.js');
    fs.writeFileSync(tmpFile, generated);
    var parser2 = require('./tmp-parser');

    assert.ok(parser.parse('happy happy joy joy joy') === 'happy happy joy joy joy',
      'original parser works');
    assert.ok(parser2.parse('happy happy joy joy joy') === 'happy happy joy joy joy',
      'generated parser works');
    fs.unlinkSync(tmpFile);
};

exports["test 'comment token' edge case which could break the parser generator"] = function() {
    var lexData = {
        rules: [
           ["\\*\\/", "return '*/';"],
           ["'*/'", "return '*/';"],
        ]
    };
    var grammar = {
        startSymbol: "A",
        bnf: {
            "A" :[ ['A \'*/\'', '$$ = 1;'],
                   ['', '$$ = 0;'] ]
        }
    };

    var input = "*/*/*/";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateAMDModule();
    var parser = null,
        define = function(deps, callback) {
            // temporary AMD-style define function, for testing.
            if (!callback) {
                // no deps array:
                parser = deps();
            } else {
                parser = callback();
            }
        };
    eval(parserSource);

    assert.ok(parser.parse(input));
};

exports["test 'semantic whitespace' edge case which could break the parser generator"] = function() {
    var lexData = {
        rules: [
           ["\\ ", "return ' ';"],
           ["' '", "return ' ';"],
           ["x", "yytext = 7; return 'x';"],
        ]
    };
    var grammar = {
        startSymbol: "G",
        // a literal whitespace in the rules could potentially damage the generated output as the
        // productions are re-assembled into strings before being ferried off to `buildProductions()`,
        // which would then call `string.split(' ')` on them before we introduced the new
        // `splitStringIntoSymbols()` splitter in there.
        //
        // Of course it's rather odd to have rules parsed, then reassembled and then, in a sense,
        // parsed *again*, but alas, that's how it is. Probably done this way to have automatic
        // JSON input support alongside the JISON feed which I (GerHobbelt) normally use.
        //
        // Anyway, this grammar is crafted as a minimum sample which can potentially break the parser
        // and is included in these tests to prevent nasty regressions: when things go pear-shaped
        // you won't notice much, apart from maybe, after pulling all your hair, that the
        // generated `$N` references are off by at least one(1).
        //
        // Pumping this through the EBNF parser also can help to break things around there;
        // **TODO** is pumping this in various incantations through both raw BNF and EBNF
        // parsers to see who will falter, today.
        ebnf: {
            "G" :[ ['A', 'return $A;'] ],
            "A" :[ ['A ( \' \' )+ x', '$$ = $1 + $x + $2.join(\' \').length;'],
                   ['', '$$ = 0;'] ]
        }
    };

    var input = " x  x x x x";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateAMDModule();
    var parser = null,
        define = function(deps, callback) {
            // temporary AMD-style define function, for testing.
            if (!callback) {
                // no deps array:
                parser = deps();
            } else {
                parser = callback();
            }
        };
    //console.log('source: ', parserSource);
    eval(parserSource);

    var rv = parser.parse(input);
    assert.equal(rv, 42);
};

// same as previous test, only now all single quotes are swapped for double quotes:
exports["test quotes around 'semantic whitespace'"] = function() {
    var lexData = {
        rules: [
           ["\\ ", "return ' ';"],
           ['" "', "return ' ';"],
           ["x", "yytext = 7; return 'x';"],
        ]
    };
    var grammar = {
        startSymbol: "G",
        ebnf: {
            "G" :[ ['A', 'return $A;'] ],
            "A" :[ ['A ( " " )+ x', '$$ = $1 + $x + $2.join(" ").length;'],
                   ['', '$$ = 0;'] ]
        }
    };

    var input = " x  x x x x";
    var gen = new Jison.Generator(grammar);
    gen.lexer = new Lexer(lexData);

    var parserSource = gen.generateAMDModule();
    var parser = null,
        define = function(deps, callback) {
            // temporary AMD-style define function, for testing.
            if (!callback) {
                // no deps array:
                parser = deps();
            } else {
                parser = callback();
            }
        };
    //console.log('source: ', parserSource);
    eval(parserSource);

    var rv = parser.parse(input);
    assert.equal(rv, 42);
};

// test `%import symbols` functionality
exports["test %import statement"] = function () {
    var grammar =
      '%lex\n%%\n\n\\s+      /* skip whitespace */\n' +
      'x                     return \'x\';\n' +
      '<<EOF>>               return \'EOF\'\n\n' +
      '/lex\n\n%start expressions\n\n' +
      '%import bugger boo\n\n' +
      '%import "kwik kwak" "diddle doo"\n\n%%\n\n' +
      'expressions\n    : e EOF\n        {return $1;}\n    ;\n\n' +
      'e\n    : x -> $1\n    ;';

    var gen = new Jison.Generator(grammar);
    console.log('generator: ', gen.grammar.imports);
    assert.ok(gen.grammar.imports.length === 2, '%imports detected');
    assert.ok(gen.grammar.imports[0].name === 'bugger', '%import name works');
    assert.ok(gen.grammar.imports[0].path === 'boo', '%import path works');
    assert.ok(gen.grammar.imports[1].name === 'kwik kwak', '%import name works');
    assert.ok(gen.grammar.imports[1].path === 'diddle doo', '%import path works');

    var parser = new Jison.Parser(grammar);
    var generated = parser.generate();

    var tmpFile = path.resolve(__dirname, 'tmp-imports-parser.js');
    fs.writeFileSync(tmpFile, generated);
    var parser2 = require('./tmp-imports-parser');

    assert.ok(parser.parse('x') === 'x',
      'original parser works');
    assert.ok(parser2.parse('x') === 'x',
      'generated parser works');
    fs.unlinkSync(tmpFile);
};

// test advanced `%import symbols` functionality
exports["test %import statement in second grammar picks up symbols from first grammar"] = function () {
    var grammar =
      '%lex\n%%\n\n\\s+      /* skip whitespace */\n' +
      'yy                     return \'y\';\n' +
      'xx                     return \'x\';\n' +
      '<<EOF>>               return \'EOF\'\n\n' +
      '/lex\n\n%start expressions\n\n' +
      '%%\n\n' +
      'expressions\n    : e EOF\n        {return $1;}\n    ;\n\n' +
      'e\n    : x y -> $x + $y\n    ;';

    var parser = new Jison.Parser(grammar);
    var generated = parser.generate();

    var tmpFile = path.resolve(__dirname, 'tmp-imports-parser2.js');
    fs.writeFileSync(tmpFile, generated);

    var grammar2 =
      '%lex\n%%\n\n\\s+      /* skip whitespace */\n' +
      'xx                     return \'x\';\n' +
      '<<EOF>>               return \'EOF\'\n\n' +
      '/lex\n\n%start expressions\n\n' +
      '%import symbols "' + __dirname + '/tmp-imports-parser2.js"\n\n' +
      '%%\n\n' +
      'expressions\n    : e EOF\n        {return $1;}\n    ;\n\n' +
      'e\n    : x -> $1\n    ;';

    var parser2 = new Jison.Parser(grammar2);
    var generated2 = parser2.generate();

    var tmpFile2 = path.resolve(__dirname, 'tmp-imports-parser3.js');
    fs.writeFileSync(tmpFile2, generated2);

    // both files should carry the exact same symbol table:
    var re = /[\r\n]\s*symbols_:\s*(\{[\s\S]*?\}),\s*[\r\n]/;
    var m1 = re.exec(generated);
    var m2 = re.exec(generated2);

    assert.ok(m1[1] === m2[1], 'both grammars\' symbol tables match');

    fs.unlinkSync(tmpFile);
    fs.unlinkSync(tmpFile2);
};
