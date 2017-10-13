var assert = require("chai").assert;
var bnf = require("../dist/ebnf-parser-cjs-es5");


function parser_reset() {
    if (bnf.bnf_parser.parser.yy) {
        var y = bnf.bnf_parser.parser.yy;
        if (y.parser) {
            delete y.parser;
        }
        if (y.lexer) {
            delete y.lexer;
        }
    }

    //bnf.bnf_parser.parser.yy = {};

    var debug = 0;

    if (!debug) {
        // silence warn+log messages from the test internals:
        bnf.bnf_parser.parser.warn = function bnf_warn() {
            // console.warn("TEST WARNING: ", arguments);
        };

        bnf.bnf_parser.parser.log = function bnf_log() {
            // console.warn("TEST LOG: ", arguments);
        };
    }
}


describe("BNF parser", function () {
  beforeEach(function beforeEachTest() {
    parser_reset();
  });

  it("test basic grammar", function () {
    var grammar = "%% test: foo bar | baz ; hello: world ;";
    var expected = {bnf: {test: ["foo bar", "baz"], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test multiple same rule", function () {
    var grammar = "%% test: foo bar | baz ; test: world ;";
    var expected = {bnf: {test: ["foo bar", "baz", "world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test classy grammar", function () {
    var grammar = "%%\n\npgm \n: cdl MAIN LBRACE vdl el RBRACE ENDOFFILE \n; cdl \n: c cdl \n| \n;";
    var expected = {bnf: {pgm: ["cdl MAIN LBRACE vdl el RBRACE ENDOFFILE"], cdl: ["c cdl", ""]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test advanced grammar", function () {
    var grammar = "%% test: foo bar {action} | baz ; hello: world %prec UMINUS ;extra: foo %prec '-' {action} ;";
    var expected = {bnf: {test: [["foo bar", "action" ], "baz"], hello: [[ "world", {prec:"UMINUS"} ]], extra: [[ "foo", "action", {prec: "-"} ]]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test nullable rule", function () {
    var grammar = "%% test: foo bar | ; hello: world ;";
    var expected = {bnf: {test: ["foo bar", ""], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test nullable rule with action", function () {
    var grammar = "%% test: foo bar | {action}; hello: world ;";
    var expected = {bnf: {test: ["foo bar", [ "", "action" ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test nullable rule with %{ %} delimited action", function () {
    var grammar = "%% test: foo bar | %{action={}%}; hello: world ;";
    var expected = {bnf: {test: ["foo bar", [ "", "action={}" ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test nullable rule with {{ }} delimited action", function () {
    var grammar = "%% test: foo bar | {{action={};}}; hello: world ;";
    var expected = {bnf: {test: ["foo bar", [ "", "action={};" ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test rule with {{ }} delimited action", function () {
    var grammar = "%% test: foo bar {{ node({}, node({})); }}; hello: world ;";
    var expected = {bnf: {test: [["foo bar"," node({}, node({})); " ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test comment", function () {
    var grammar = "/* comment */ %% hello: world ;";
    var expected = {bnf: {hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test multi-line comment", function () {
    var grammar = "/* comment\n comment\n comment */ %% hello: world ;";
    var expected = {bnf: {hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test single line comment", function () {
    var grammar = "//comment \n %% hello: world ;";
    var expected = {bnf: {hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parse comment");
  });

  it("test comment with nested *", function () {
    var grammar = "/* comment * not done */ %% hello: /* oh hai */ world ;";
    var expected = {bnf: {hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test comment with nested //", function () {
    var grammar = "/* comment // nested ** not done */ %% hello: /* oh hai */ world ;";
    var expected = {bnf: {hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");

    var grammar2 = "/* comment \n// nested ** not done */ %% hello: /* oh hai */ world ;";

    assert.deepEqual(bnf.parse(grammar2), expected, "grammar should be parsed correctly");
  });

  it("test token", function () {
    var grammar = "%token blah\n%% test: foo bar | baz ; hello: world ;";
    var expected = {bnf: {test: ["foo bar", "baz"], hello: ["world"]},
                    extra_tokens: [{id: "blah"}]};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test token with type", function () {
    var grammar = "%type <type> blah\n%% test: foo bar | baz ; hello: world ;";
    var expected = {bnf: {test: ["foo bar", "baz"], hello: ["world"]}, unknownDecls: [['type', '<type> blah']]};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test embedded lexical block", function () {
    var grammar = "%lex \n%%\n'foo' return 'foo';\n'bar' {return 'bar';}\n'baz' {return 'baz';}\n'world' {return 'world';}\n/lex\
                   %% test: foo bar | baz ; hello: world ;";
    var expected = {
                        lex: {
                            macros: {},
                            rules: [
                               ["foo", "return 'foo';"],
                               ["bar", "return 'bar';"],
                               ["baz", "return 'baz';"],
                               ["world", "return 'world';"]
                            ],
                            startConditions: {},
                            unknownDecls: []
                        },
                        bnf: {test: ["foo bar", "baz"], hello: ["world"]}
                    };

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test lexer %options easy_keyword_rules", function () {
    var grammar = "%lex \n%options easy_keyword_rules\n%%\n'foo' return 'foo';\n'bar' {return 'bar';}\n'baz' {return 'baz';}\n'world' {return 'world';}\n/lex\
                   %% test: foo bar | baz ; hello: world ;";
    var expected = {
                        lex: {
                            macros: {},
                            rules: [
                               ["foo\\b", "return 'foo';"],
                               ["bar\\b", "return 'bar';"],
                               ["baz\\b", "return 'baz';"],
                               ["world\\b", "return 'world';"]
                            ],
                            options: {
                                easy_keyword_rules: true
                            },
                            startConditions: {},
                            unknownDecls: []
                        },
                        bnf: {test: ["foo bar", "baz"], hello: ["world"]}
                    };

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test balanced braces", function () {
    var grammar = "%% test: foo bar { node({}, node({foo:'bar'})); }; hello: world ;";
    var expected = {bnf: {test: [["foo bar"," node({}, node({foo:'bar'})); " ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test brace within a multi-line comment", function () {
    var grammar = "%% test: foo bar { node({}, 3 / 4); /* { */ }; hello: world ;";
    var expected = {bnf: {test: [["foo bar"," node({}, 3 / 4); /* { */ " ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test brace within a single-line comment", function () {
    var grammar = "%% test: foo bar { node({}); // {\n }; hello: world ;";
    var expected = {bnf: {test: [["foo bar"," node({}); // {\n " ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test brace within a string", function () {
    var grammar = "%% test: foo bar { node({}, 3 / 4, '{'); /* { */ }; hello: world ;";
    var expected = {bnf: {test: [["foo bar"," node({}, 3 / 4, '{'); /* { */ " ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test brace within a string with double quotes", function () {
    var grammar = "%% test: foo bar { node({}, 3 / 4, \"{\"); /* { */ }; hello: world ;";
    var expected = {bnf: {test: [["foo bar"," node({}, 3 / 4, \"{\"); /* { */ " ]], hello: ["world"]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test uneven braces and quotes within regex", function () {
    var grammar = "%% test: foo bar { node({}, 3 / 4, \"{\"); /{'\"/g; 1 / 2; }; hello: world { blah / bah };";
    var expected = {bnf: {test: [["foo bar"," node({}, 3 / 4, \"{\"); /{'\"/g; 1 / 2; " ]], hello: [["world", " blah / bah "]]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test code declaration", function () {
    var grammar = "%{var foo = 'bar';%}\n%%hello: world;";
    var expected = {bnf: {hello: ["world"]}, moduleInclude: "var foo = 'bar';"};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test remainder code", function () {
    var grammar = "%%hello: world;%%var foo = 'bar';";
    var expected = {bnf: {hello: ["world"]}, moduleInclude: "var foo = 'bar';"};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test remainder and declarations code", function () {
    var grammar = "%{test;%}\n%%hello: world;%%var foo = 'bar';";
    var expected = {bnf: {hello: ["world"]}, moduleInclude: "test;var foo = 'bar';"};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test expression action", function () {
    var grammar = "%% test: foo bar -> $foo\n;";
    var expected = {bnf: {test: [["foo bar","$$ = $foo"]]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test quote in rule", function () {
    var grammar = "%lex\n%%\n\\' return \"'\"\n/lex\n%% test: foo bar \"'\";";
    var expected = {lex: {
      macros: {},
      rules: [
        ["'", "return \"'\""]
      ],
      startConditions: {},
      unknownDecls: []
    },
    bnf: {test: ["foo bar \"'\""]}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test windows line endings", function () {
    var grammar = "%{baz\r\n%}%% test: foo bar | {\r\naction;\r\nhi};\r\nhello: world ;%%foo;\r\nbar;";
    var expected = {bnf: {test: ["foo bar", [ "", "\r\naction;\r\nhi" ]], hello: ["world"]}, moduleInclude: 'baz\r\nfoo;\r\nbar;'};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test parse params", function () {
    var grammar = "%parse-param first second\n%%hello: world;%%";
    var expected = {bnf: {hello: ["world"]}, parseParams: ["first", "second"]};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test boolean options", function () {
    var grammar = "%options one two\n%%hello: world;%%";
    var expected = {bnf: {hello: ["world"]}, options: {one: true, two: true}};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test if %options names with a hyphen are correctly recognized", function () {
    var grammar = '%options bug-a-boo\n%%hello: world;%%';
    var expected = {
        bnf: {
            hello: ["world"]
        }, 
        options: {
            "bug-a-boo": true
        }
    };

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test options with values", function () {
    var grammar = '%options ping=666 bla=blub bool1 s1="s1value" s2=\'s2value\' s3=false s4="false"\n%%hello: world;%%';
    var expected = {
        bnf: {
            hello: ["world"]
        }, 
        options: {
            ping: 666,
            bla: "blub",
            bool1: true,
            s1: "s1value",
            s2: "s2value",
            s3: false,
            s4: "false"
        }
    };

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test options spread across multiple lines", function () {
    var grammar = '%options ping=666\n  bla=blub\n  bool1\n  s1="s1value"\n  s2=\'s2value\'\n  s3=false\n  s4="false"\n%%hello: world;%%';
    var expected = {
        bnf: {
            hello: ["world"]
        }, 
        options: {
            ping: 666,
            bla: "blub",
            bool1: true,
            s1: "s1value",
            s2: "s2value",
            s3: false,
            s4: "false"
        }
    };

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test options with string values which have embedded quotes", function () {
    var grammar = '%options s1="s1\\"val\'ue" s2=\'s2\\\\x\\\'val\"ue\'\n%%\nhello: world;\n%%';
    var expected = {
        bnf: {
            hello: ["world"]
        }, 
        options: {
            s1: "s1\"val'ue",
            s2: "s2\\\\x'val\"ue"
        }
    };

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });

  it("test unknown decls", function () {
    var grammar = "%foo bar\n%foo baz\n%qux { fizzle }\n%%hello: world;%%";
    var expected = {bnf: {hello: ["world"]}, unknownDecls: [['foo', 'bar'], ['foo', 'baz'], ['qux', '{ fizzle }']]};

    assert.deepEqual(bnf.parse(grammar), expected, "grammar should be parsed correctly");
  });
});
