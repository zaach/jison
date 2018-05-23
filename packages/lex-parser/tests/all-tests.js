var assert = require("chai").assert;
var lex    = require("../dist/lex-parser-cjs-es5");
var fs     = require('fs');
var path   = require('path');

function read (p, file) {
    return fs.readFileSync(path.join(__dirname, p, file), "utf8");
}

const expectedEmptyBase = {
    macros: {},           // { hash table }
    startConditions: {},  // { hash table }
    codeSections: [],     // [ array of {qualifier,include} pairs ]
    importDecls: [],      // [ array of {name,path} pairs ]
    unknownDecls: []      // [ array of {name,value} pairs ]
};

function mixExpected(o) {
    var rv = {};
    for (var key in expectedEmptyBase) {
        rv[key] = expectedEmptyBase[key];
    }
    for (key in o) {
        rv[key] = o[key];
    }
    return rv;
}

function lexer_reset() {
    if (lex.parser.yy) {
        var y = lex.parser.yy;
        if (y.parser) {
            delete y.parser;
        }
        if (y.lexer) {
            delete y.lexer;
        }
    }

    lex.parser.yy = {};

    var debug = 0;

    if (!debug) {
        // silence warn+log messages from the test internals:
        lex.warn = function tl_warn() {
            // console.warn("TEST WARNING: ", arguments);
        };

        lex.log = function tl_log() {
            // console.warn("TEST LOG: ", arguments);
        };

        lex.parser.warn = function tl_warn() {
            // console.warn("TEST WARNING: ", arguments);
        };

        lex.parser.log = function tl_log() {
            // console.warn("TEST LOG: ", arguments);
        };
    }
}

describe("LEX Parser", function () {
  beforeEach(function beforeEachTest() {
    lexer_reset();
  });

  it("test lex grammar with macros", function () {
    var lexgrammar = `
D [0-9]
ID [a-zA-Z_][a-zA-Z0-9_]+

%%

{D}"ohhai" {print(9);}
"{" return '{';
        `;
    var expected = mixExpected({
        macros: {
            "D": "[0-9]", 
            "ID": "[a-zA-Z_][a-zA-Z0-9_]+"
        },
        rules: [
            ["{D}ohhai", "print(9)"],
            ["\\{", "return '{'"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test lex grammar with macros in regex sets", function () {
    var lexgrammar = `
D [0-9]
L [a-zA-Z]
ID [{L}_][{L}{D}_]+
%%
[{D}]"ohhai" {print(9);}
"{" return '{';
        `;
    var expected = mixExpected({
        macros: {
            "D": "[0-9]", 
            "L": "[a-zA-Z]", 
            "ID": "[{L}_][{L}{D}_]+"
        },
        rules: [
            ["[{D}]ohhai", "print(9)"],
            ["\\{", "return '{'"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test rule-less grammar", function () {
    var lexgrammar = '%export { D }\nD [0-9]';
    var expected = mixExpected({
      macros: { D: '[0-9]' },
      unknownDecls: [{
        name: 'export', 
        value: '{ D }'
      }],
      rules: []
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, 'grammar should be parsed correctly');
  });

  it("test escaped chars", function () {
    var lexgrammar = `
%%
"\\n"+ {return 'NL';}
\\n+ {return 'NL2';}
"\\\\n"+ {return 'NL3';}
\`\n\`+ {return 'NL4';}
\\s+ {/* skip */}
        `;
    var expected = mixExpected({
        rules: [
            ["\\n+", "return 'NL'"],
            ["\\n+", "return 'NL2'"],
            ["\\\\n+", "return 'NL3'"],
            ["\\n+", "return 'NL4'"],
            ["\\s+", "/* skip */"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test advanced", function () {
    var lexgrammar = `
%%
$ {return 'EOF';}
. {/* skip */}
"stuff"*/("{"|";") {/* ok */}
(.+)[a-z]{1,2}"hi"*? {/* skip */}
        `;
    var expected = mixExpected({
        rules: [
            ["$", "return 'EOF'"],
            [".", "/* skip */"],
            ["stuff*(?=(\\{|;))", "/* ok */"],
            ["(.+)[a-z]{1,2}hi*?", "/* skip */"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test [^\\]]", function () {
    var lexgrammar = `
%%
"["[^\\]]"]" {return true;}
'f"oo\\'bar'  {return 'baz2';}
"fo\\"obar"  {return 'baz';}
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "return true"],
            ["f\"oo'bar", "return 'baz2'"],
            ['fo"obar', "return 'baz'"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline action", function () {
    var lexgrammar = '%%\n"["[^\\]]"]" %{\nreturn true;\n%}\n';
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "return true"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline action with single braces", function () {
    var lexgrammar = `
%%
"["[^\\]]"]" {
var b={};
return true;
}
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "var b={};\nreturn true"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline action with brace in a multi-line-comment", function () {
    var lexgrammar = `
%%
"["[^\\]]"]" {
var b=7; /* { */ return true;
}
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "var b=7; /* { */ return true"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline action with brace in a single-line-comment", function () {
    var lexgrammar = `
%%
"["[^\\]]"]" {
var b={}; // {
return 2 / 3;
}
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "var b={}; // {\nreturn 2 / 3"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline action with braces in strings", function () {
    var lexgrammar = `
%%
"["[^\\]]"]" {
var b='{' + "{"; // {
return 2 / 3;
}
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "var b='{' + \"{\"; // {\nreturn 2 / 3"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline action with braces in regexp", function () {
    var lexgrammar = `
%%
"["[^\\]]"]" {
var b=/{/; // {
return 2 / 3;
}
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "var b=/{/; // {\nreturn 2 / 3"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test multiline (indented) action without braces", function () {
    var lexgrammar = `
%%
"["[^\\]]"]"
  var b=/{/;
  // {
  return 2 / 3;
        `;
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "var b=/{/;\n  // {\n  return 2 / 3"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test include", function () {
    var lexgrammar = '\nRULE [0-9]\n\n%{\n hi; {stuff;} \n%}\n%%\n"["[^\\]]"]" %{\nreturn true;\n%}\n';
    var expected = mixExpected({
        macros: {"RULE": "[0-9]"},
        actionInclude: "hi; {stuff;}",
        rules: [
            ["\\[[^\\]]\\]", "return true"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test bnf lex grammar", function () {
    var lexgrammar = lex.parse(read('lex', 'bnf.jisonlex'));
    var expected = mixExpected(JSON.parse(read('lex', 'bnf.lex.json')));

    assert.deepEqual(lexgrammar, expected, "grammar should be parsed correctly");
  });

  it("test lex grammar bootstrap", function () {
    var lexgrammar = lex.parse(read('lex', 'lex_grammar.jisonlex'));
    var expected = mixExpected(JSON.parse(read('lex', 'lex_grammar.lex.json')));

    assert.deepEqual(lexgrammar, expected, "grammar should be parsed correctly");
  });

  it("test ANSI C lexical grammar", function () {
    var lexgrammar = lex.parse(read('lex','ansic.jisonlex'));

    assert.ok(lexgrammar, "grammar should be parsed correctly");
  });

  it("test advanced", function () {
    var lexgrammar = '%%\n"stuff"*/!("{"|";") {/* ok */}\n';
    var expected = mixExpected({
        rules: [
            ["stuff*(?!(\\{|;))", "/* ok */"],
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test start conditions", function () {
    var lexgrammar = '%s TEST TEST2\n%x EAT\n%%\n'+
                     '"enter-test" {this.begin(\'TEST\');}\n'+
                     '<TEST,EAT>"x" {return \'T\';}\n'+
                     '<*>"z" {return \'Z\';}\n'+
                     '<TEST>"y" {this.begin(\'INITIAL\'); return \'TY\';}';
    var expected = mixExpected({
        startConditions: {
            "TEST": 0,
            "TEST2": 0,
            "EAT": 1,
        },
        rules: [
            ["enter-test", "this.begin('TEST')" ],
            [["TEST","EAT"], "x", "return 'T'" ],
            [["*"], "z", "return 'Z'" ],
            [["TEST"], "y", "this.begin('INITIAL'); return 'TY'" ]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test unknown declarations", function () {
    var lexgrammar = '%a b c\n%foo[bar] baz qux\n%a b c\n%%\n. //';
    var expected = mixExpected({
        unknownDecls: [
            { name: 'a', value: 'b c' },
            { name: 'foo', value: '[bar] baz qux' },
            { name: 'a', value: 'b c' }
        ],
        rules: [
            ['.', '//']
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "unknown declarations should be parsed correctly");
  });

  it("test %import declarations", function () {
    var lexgrammar = '%import base "./base.file"\n%import extension "/tmp/qux"\n%%\n. //';
    var expected = mixExpected({
        importDecls: [
            { name: 'base', path: './base.file' },
            { name: 'extension', path: '/tmp/qux' },
        ],
        rules: [
            ['.', '//']
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "%import declarations should be parsed correctly");
  });

  it("test no brace action", function () {
    var lexgrammar = '%%\n"["[^\\]]"]" return true;\n"x" return 1;';
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "return true"],
            ["x", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test quote escape", function () {
    var lexgrammar = '%%\n\\"\\\'"x" return 1;';
    var expected = mixExpected({
        rules: [
            ["\"'x", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test escape things", function () {
    var lexgrammar = `
%%
\\"\\\'\\\\\\*\\i return 1;
"a"\\b return 2;
\\cA {}
\\012 {}
\\xFF ;
        `;
    var expected = mixExpected({
        rules: [
            ["\"'\\\\\\*i", "return 1"],
            ["a\\b", "return 2"],
            ["\\u0001", ""],
            ["\\n", ""],
            ["\xFF", ""]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test unicode encoding", function () {
    var lexgrammar = '%%\n"\\u03c0" return 1;';
    var expected = mixExpected({
        rules: [
            ["\u03c0", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test unicode", function () {
    var lexgrammar = '%%\n"π" return 1;';
    var expected = mixExpected({
        rules: [
            ["π", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test unquoted lexer rule literals", function () {
    var lexgrammar = '%%\nπ return 1;\n-abc return 2;';
    var expected = mixExpected({
        rules: [
            ["π", "return 1"],
            ["-abc", "return 2"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test bugs", function () {
    var lexgrammar = '%%\n\\\'([^\\\\\']+|\\\\(\\n|.))*?\\\' return 1;';
    var expected = mixExpected({
        rules: [
            ["'([^\\\\']+|\\\\(\\n|.))*?'", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test special groupings", function () {
    var lexgrammar = '%%\n(?:"foo"|"bar")\\(\\) return 1;';
    var expected = mixExpected({
        rules: [
            ["(?:foo|bar)\\(\\)", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test trailing code include", function () {
    var lexgrammar = '%%"foo"  {return bar;}\n%% var bar = 1;';
    var expected = mixExpected({
        rules: [
            ['foo', "return bar"]
        ],
        moduleInclude: "var bar = 1",
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test empty or regex", function () {
    var lexgrammar = '%%\n(|"bar")("foo"|)(|) return 1;';
    var expected = mixExpected({
        rules: [
            ["(|bar)(foo|)(|)", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test options", function () {
    var lexgrammar = '%options flex\n%%\n"foo" return 1;';
    var expected = mixExpected({
        rules: [
            ["foo", "return 1"]
        ],
        options: {flex: true},
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test if %options names with a hyphen are correctly recognized", function () {
    var lexgrammar = '%options token-stack\n%%\n"foo" return 1;';
    var expected = mixExpected({
        rules: [
            ["foo", "return 1"]
        ],
        options: {
            tokenStack: true    // option name camel-casing is done very early in the game: see lex.y source code.
        },
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test options with values", function () {
    var lexgrammar = '%options ping=666 bla=blub bool1 s1="s1value" s2=\'s2value\' s3=false s4="false" a-b-c="d"\n%%\n"foo" return 1;';
    var expected = mixExpected({
        rules: [
            ["foo", "return 1"]
        ],
        options: {
            ping: 666,
            bla: "blub",
            bool1: true,
            s1: "s1value",
            s2: "s2value",
            s3: false,
            s4: "false",
            aBC: "d"            // camel-casing is done very early in the game: see lex.y source code.
        },
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test options spread across multiple lines", function () {
    var lexgrammar = '%options ping=666\n bla=blub\n bool1\n s1="s1value"\n s2=\'s2value\'\n s3=false\n s4="false"\n a-b-c="d"\n%%\n"foo" return 1;';
    var expected = mixExpected({
        rules: [
            ["foo", "return 1"]
        ],
        options: {
            ping: 666,
            bla: "blub",
            bool1: true,
            s1: "s1value",
            s2: "s2value",
            s3: false,
            s4: "false",
            aBC: "d"            // camel-casing is done very early in the game: see lex.y source code.
        },
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test options with string values which have embedded quotes", function () {
    var lexgrammar = `
%options s1="s1\\"val\'ue" s2=\'s2\\\\x\\\'val\"ue\' s3=\`s3\\\\x\\\\\'val\"ue\`
%%
"foo" return 1;
        `;
    var expected = mixExpected({
        rules: [
            ["foo", "return 1"]
        ],
        options: {
            s1: "s1\"val'ue",
            s2: "s2\\x'val\"ue",
            s3: "s3\\x\\'val\"ue",
        },
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test unquoted string rules", function () {
    var lexgrammar = "%%\nfoo* return 1";
    var expected = mixExpected({
        rules: [
            ["foo*", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test [^\\\\]", function () {
    var lexgrammar = '%%\n"["[^\\\\]"]" {return true;}\n\'f"oo\\\'bar\'  {return \'baz2\';}\n"fo\\"obar"  {return \'baz\';}\n';
    var expected = mixExpected({
        rules: [
            ["\\[[^\\\\]\\]", "return true"],
            ["f\"oo'bar", "return 'baz2'"],
            ['fo"obar', "return 'baz'"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test comments", function () {
    var lexgrammar = "/* */ // foo\n%%\nfoo* return 1";
    var expected = mixExpected({
        rules: [
            ["foo*", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test rules with trailing escapes", function () {
    var lexgrammar = '%%\n\\#[^\\n]*\\n {/* ok */}\n';
    var expected = mixExpected({
        rules: [
            ["#[^\\n]*\\n", "/* ok */"],
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test no brace action with surplus whitespace between rules", function () {
    var lexgrammar = '%%\n"a" return true;\n  \n"b" return 1;\n   \n';
    var expected = mixExpected({
        rules: [
            ["a", "return true"],
            ["b", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test macro for commit SHA-1: 1246dbb75472cee8e4e91318cc5a0d4739a8fe12", function () {
    var lexgrammar = 'BR  \\r\\n|\\n|\\r\n%%\r\n{BR} %{\r\nreturn true;\r\n%}\r\n';
    var expected = mixExpected({
        macros: {"BR": "\\r\\n|\\n|\\r"},
        rules: [
            ["{BR}", "return true"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test windows line endings", function () {
    var lexgrammar = '%%\r\n"["[^\\]]"]" %{\r\nreturn true;\r\n%}\r\n';
    var expected = mixExpected({
        rules: [
            ["\\[[^\\]]\\]", "return true"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test braced action with surplus whitespace between rules", function () {
    var lexgrammar = '%%\n"a" %{  \nreturn true;\n%}  \n  \n"b" %{    return 1;\n%}  \n   \n';
    var expected = mixExpected({
        rules: [
            ["a", "return true"],
            ["b", "return 1"]
        ],
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });

  it("test %options easy_keyword_rules", function () {
    var lexgrammar = `
%options easy_keyword_rules
%s TEST TEST2
%x EAT
%%
"enter-test" {this.begin('TEST');}
"enter_test" {this.begin('TEST');}
<TEST,EAT>"x" {return 'T';}
<*>"z" {return 'Z';}
<TEST>"y" {this.begin('INITIAL'); return 'TY';}
\\"\\'"a" return 1;
\\"\\'\\\\\\*\\i return 1;
"a"\\b return 2;
\\cA {}
\\012 {}
\\xFF {}
"["[^\\\\]"]" {return true;}
'f"oo\\'bar'  {return 'baz2';}
"fo\\"obar"  {return 'baz';}
        `;
    var expected = mixExpected({
        startConditions: {
            "TEST": 0,
            "TEST2": 0,
            "EAT": 1,
        },
        rules: [
            ["enter-test\\b", "this.begin('TEST')" ],                 // '-' dash is accepted as it's *followed* by a word, hence the *tail* is an 'easy keyword', hence it merits an automatic `\b` word-boundary check added!
            ["enter_test\\b", "this.begin('TEST')" ],
            [["TEST","EAT"], "x\\b", "return 'T'" ],
            [["*"], "z\\b", "return 'Z'" ],
            [["TEST"], "y\\b", "this.begin('INITIAL'); return 'TY'" ],
            ["\"'a\\b", "return 1"],                                  // keywords *with any non-keyword prefix*, i.e. keywords 'at the tail end', get the special 'easy keyword' treatment too!
            ["\"'\\\\\\*i\\b", "return 1"],
            ["a\\b", "return 2"],
            ["\\u0001", ""],
            ["\\n", ""],
            ["\xFF", ""],
            ["\\[[^\\\\]\\]", "return true"],
            ["f\"oo'bar\\b", "return 'baz2'"],
            ['fo"obar\\b', "return 'baz'"]
        ],
        options: {
            "easy_keyword_rules": true
        },
    });

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
  });
});

