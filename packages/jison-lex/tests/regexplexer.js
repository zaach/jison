var assert = require("chai").assert;
var RegExpLexer = require("../dist/regexp-lexer-cjs-es5");
var XRegExp = require("@gerhobbelt/xregexp");

function re2set(re) {
  var xr = new XRegExp(re);
  var xs = '' +  xr;
  return xs.substr(2, xs.length - 4);   // strip off the wrapping: /[...]/
}


describe("Lexer Kernel", function () {
  it("test basic matchers", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  // Before we go and test the API any further, we must make sure 
  // the used lex grammar parser delivers as expected:
  describe("Parsed Lexer Grammar", function () {
    it("parses special character escapes correctly", function () {
      var dict = [
        "%%",
        "'x'     {return 'X';}",
        "\\n     {return 'NL';}",
        "\\r     {return 'R';}",
        "\\v     {return 'V';}",
        "\\a     {return 'A';}",
        "\\f     {return 'F';}",
        "\\b     {return 'B';}",
        "\\x42     {return 'C';}",
        "\\u0043     {return 'D';}",
        "\\      {return 'E';}",
        "[^]     {return this.ERROR;}",
      ].join('\n');

      var lexer = new RegExpLexer(dict);
      var JisonLexerError = lexer.JisonLexerError; 
      assert(JisonLexerError);

      var input = "x\nx\rx\vx\ax\fx\bx\x42x\u0043x xxx\\nx\\rx\\vx\\ax\\fx\\bx\\x42x\\u0043x\\ ";

      // help us monitor/debug lexer output:
      var old_lex_f = lexer.lex;
      lexer.lex = function () {
        try {
          var rv = old_lex_f.call(this);
          return rv;
        } catch (ex) {
          //console.error("lex() ERROR EX:", ex.message, ex.stack);
          throw ex;
        }
      };

      lexer.setInput(input);
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'NL');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'R');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'V');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'A');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'F');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), lexer.ERROR);     // `\b` is a regex edge marker special, not string value '\b'!
      assert.equal(lexer.lex(), 'X');

      // As the `\b` rule comes before the 'C' rule, it will match at the start-of-word boundary...
      assert.equal(lexer.lex(), 'B');             
      // ...and since this lexer rule doesn't consume anything at all, it will match indefinitely... 
      for (var cnt = 42; cnt > 0; cnt--) {
        assert.equal(lexer.lex(), 'B');
      }

      // ...until we manually NUKE that rule:
      for (var i = 0, len = lexer.rules.length; i < len; i++) {
        // find the lexer rule which matches the word boundary:
        if (lexer.rules[i].test('k') && String(lexer.rules[i]).indexOf('\\b') >= 0) {
          lexer.rules[i] = /MMMMMMMMM/;
        }
      }

      // and verify that our lexer decompression/ruleset-caching results 
      // in the above action not having any effect until we NUKE the
      // same regex in the condition cache:
      for (var cnt = 42; cnt > 0; cnt--) {
        assert.equal(lexer.lex(), 'B');
      }

      var cond_rules = lexer.__currentRuleSet__.__rule_regexes;
      for (var i = 0, len = cond_rules.length; i < len; i++) {
        // find the lexer rule which matches the word boundary:
        if (cond_rules[i] && cond_rules[i].test('k') && String(cond_rules[i]).indexOf('\\b') >= 0) {
          cond_rules[i] = /MMMMMMMMM/;
        }
      }

      // **POSTSCRIPT**
      // 
      // Regrettably I don't know of a way to check for this type of lexer regex rule
      // anomaly in a generic way: the lexer rule may be a compound one, hiding the 
      // non-consuming `\b` in there, while there are other regex constructs 
      // imaginable which share the same problem with this `\b` lexer rule: a rexexp
      // match which matches a boundary, hence **an empty string** without the
      // grammar designer **intentionally** doing this. 

      assert.equal(lexer.lex(), 'C');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'D');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'E');

      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'X');

      // \\n
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\r
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\v
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\a
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'A');
      assert.equal(lexer.lex(), 'X');
      // \\f
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\b
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\x42
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\u0043
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \\_
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'E');

      assert.equal(lexer.lex(), lexer.EOF);
    });

    it("parses literal rule strings with escapes correctly", function () {
      var dict = [
        "%%",
        "'x'     {return 'X';}",
        "'\\n'     {return 'SN';}",
        "'\\r'     {return 'SR';}",
        "'\\v'     {return 'SV';}",
        "'\\a'     {return 'SA';}",
        "'\\f'     {return 'SF';}",
        "'\\b'     {return 'SB';}",
        "'\\x42'     {return 'SC';}",
        "'\\u0043'     {return 'SD';}",
        "'\\ '     {return 'SE';}",
        "[^]       {return this.ERROR;}",
      ].join('\n');

      var lexer = new RegExpLexer(dict);
      var JisonLexerError = lexer.JisonLexerError; 
      assert(JisonLexerError);

      var input = "x\nx\rx\vx\ax\fx\bx\x42x\u0043x xxx\\nx\\rx\\vx\\ax\\fx\\bx\\x42x\\u0043x\\ ";

      // help us monitor/debug lexer output:
      var old_lex_f = lexer.lex;
      lexer.lex = function () {
        try {
          var rv = old_lex_f.call(this);
          return rv;
        } catch (ex) {
          //console.error("lex() ERROR EX:", ex.message, ex.stack);
          throw ex;
        }
      };

      lexer.setInput(input);
      assert.equal(lexer.lex(), 'X');

      // \n
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \r
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \v
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \a
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \f
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \b
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \x42
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      // \u0043
      assert.equal(lexer.lex(), 'SD');
      assert.equal(lexer.lex(), 'X');
      // \_
      assert.equal(lexer.lex(), lexer.ERROR);

      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'X');

      assert.equal(lexer.lex(), 'SN');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SR');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SV');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SA');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SF');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SB');
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SC');
      assert.equal(lexer.lex(), 'X');
      // \\u0043
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), lexer.ERROR);
      assert.equal(lexer.lex(), 'X');
      assert.equal(lexer.lex(), 'SE');

      assert.equal(lexer.lex(), lexer.EOF);
    });
  });

  it("lexer comes with its own JisonLexerError exception/error class", function () {
    var dict = [
      "%%",
      "'x'     {return 'X';}",
    ].join('\n');

    var lexer = new RegExpLexer(dict);
    var JisonLexerError = lexer.JisonLexerError; 
    assert(JisonLexerError);

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
  });

  it("lexer errors are thrown using its own JisonLexerError exception/error class", function () {
    var dict = [
      "%%",
      "'x'     {return 'X';}",
    ].join('\n');

    var lexer = new RegExpLexer(dict);
    var JisonLexerError = lexer.JisonLexerError; 
    assert(JisonLexerError);

    var input = "xxyx";

    lexer.setInput(input);
    assert.equal(lexer.lex(), 'X');
    assert.equal(lexer.lex(), 'X');
    var ex1 = null;
    try {
      lexer.lex();
      assert(false, "should never get here!");
    } catch (ex) {
      assert(ex instanceof Error);
      assert(ex instanceof JisonLexerError);
      assert(/JisonLexerError:[^]*?Unrecognized text\./.test(ex));
      assert(ex.hash);
      assert.equal(typeof ex.hash.errStr, 'string');
      assert.equal(typeof ex.message, 'string');
      ex1 = ex;
    }
    // since the lexer has been using the standard parseError method, 
    // which throws an exception **AND DOES NOT MOVE THE READ CURSOR FORWARD**,
    // we WILL observe the same error again on the next invocation:
    try {
      lexer.lex();
      assert(false, "should never get here!");
    } catch (ex) {
      assert(ex instanceof Error);
      assert(ex instanceof JisonLexerError);
      assert(/JisonLexerError:[^]*?Unrecognized text\./.test(ex));
      assert(ex.hash);
      assert.equal(typeof ex.hash.errStr, 'string');
      assert.equal(typeof ex.message, 'string');

      assert.strictEqual(ex.message, ex1.message);
      var check_items = ['text', 'line', 'loc', 'errStr'];
      check_items.forEach(function (item) {
        assert.deepEqual(ex[item], ex1[item], "both exceptions should have a matching member '" + item + "'");
      });
    }
    // however, when we apply a non-throwing parseError, we MUST shift one character 
    // forward on error:
    lexer.parseError = function (str, hash) {
      assert(hash);
      assert(str);
      // and make sure the `this` reference points right back at the current *lexer* instance!
      assert.equal(this, lexer);
    };
    assert.equal(lexer.lex(), lexer.ERROR);
    assert.equal(lexer.yytext, "y");          // the one character shifted on error should end up in the lexer "value", i.e. `yytext`!

    assert.equal(lexer.lex(), 'X');
    assert.equal(lexer.yytext, "x");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("lexer run-time errors include a display of the erroneous input context", function () {
    var dict = [
      "%%",
      "'x'     {return 'X';}",
      "\\n     {return 'NL';}",
    ].join('\n');

    var lexer = new RegExpLexer(dict);
    var JisonLexerError = lexer.JisonLexerError; 
    assert(JisonLexerError);

    var input = "x\nx\nxyzx\nx\ny\nz";

    // help us monitor/debug lexer output:
    var old_lex_f = lexer.lex;
    lexer.lex = function () {
      try {
        var rv = old_lex_f.call(this);
        return rv;
      } catch (ex) {
        //console.error("lex() ERROR EX:", ex.message, ex.stack);
        throw ex;
      }
    };

    lexer.setInput(input);
    assert.equal(lexer.lex(), 'X');
    assert.equal(lexer.lex(), 'NL');
    assert.equal(lexer.lex(), 'X');

    var lastErrorMsg;
    var lastErrorHash;
    lexer.parseError = function (str, hash) {
      assert(hash);
      assert(str);
      // and make sure the `this` reference points right back at the current *lexer* instance!
      assert.equal(this, lexer);
      lastErrorHash = hash;
      lastErrorMsg = str;

      //hash.lexer = null;                // nuke the lexer class in `yy` to keep the debug output leaner and cleaner     
      //console.error("error: fix?", {
      //  str, 
      //  hash, 
      //  matched: this.matched, 
      //  match: this.match,
      //  matches: this.matches,
      //  yytext: this.yytext
      //});

      // consume at least one character of input as if everything was hunky-dory:
      if (!this.matches) {
        assert.strictEqual(this.yytext, '');
        this.input();
        assert.ok(this.yytext.length > 0);
      } else {
        assert.ok(this.yytext.length > 0);
      }
      return 'FIX_' + String(this.yytext).toUpperCase();
    };

    assert.equal(lexer.lex(), 'NL');
    assert.equal(lexer.lex(), 'X');
    assert.equal(lexer.lex(), 'FIX_Y');
    assert.equal(lexer.lex(), 'FIX_Z');
    assert.equal(lexer.lex(), 'X');
    assert.equal(lexer.lex(), 'NL');
    assert.equal(lexer.lex(), 'X');
    assert.equal(lexer.lex(), 'NL');
    assert.equal(lexer.lex(), 'FIX_Y');
    assert.equal(lexer.lex(), 'NL');
    assert.equal(lexer.lex(), 'FIX_Z');
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test set yy", function() {
    var dict = {
        rules: [
           ["x", "return yy.x;" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input, { x: 'EX' });
    assert.equal(lexer.lex(), 'EX');
    assert.equal(lexer.lex(), 'EX');
    assert.equal(lexer.lex(), 'Y');
    assert.equal(lexer.lex(), 'EX');
    assert.equal(lexer.lex(), 'EOF');
  });

  it("test set input after", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test unrecognized char", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xa";

    var lexer = new RegExpLexer(dict, input);
    var JisonLexerError = lexer.JisonLexerError; 
    assert(JisonLexerError);

    assert.equal(lexer.lex(), "X");
    assert.throws(function () { 
        lexer.lex(); 
      }, 
      JisonLexerError,
      /Lexical error on line \d+[^]*?Unrecognized text/, "bad char"
    );
  });

  it("test if lexer continues correctly after having encountered an unrecognized char", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xa";
    var err = 0;

    var lexer = new RegExpLexer(dict, input);
    lexer.parseError = function (str) {
      err++;
    };
    assert.equal(lexer.lex(), "X");
    assert.equal(err, 0);
    assert.equal(lexer.lex(), lexer.ERROR /* 2 */);
    assert.equal(err, 1);
    assert.equal(lexer.lex(), "EOF");
  });

  it("test macro", function() {
    var dict = {
        macros: {
            "digit": "[0-9]"
        },
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["{digit}+", "return 'NAT';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "x12234y42";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "NAT");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "NAT");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test macro precedence", function() {
    var dict = {
        macros: {
            "hex": "[0-9]|[a-f]"
        },
        rules: [
           ["-", "return '-';" ],
           ["{hex}+", "return 'HEX';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "129-abfe-42dc-ea12";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "-");
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "-");
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "-");
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test nested macros", function () {
    var dict = {
        macros: {
            "digit": "[0-9]",
            "2digit": "{digit}{digit}",
            "3digit": "{2digit}{digit}"
        },
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["{3digit}", "return 'NNN';" ],
           ["{2digit}", "return 'NN';" ],
           ["{digit}", "return 'N';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "x1y42y123";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "N");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "NN");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "NNN");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test nested macro precedence", function() {
    var dict = {
        macros: {
            "hex": "[0-9]|[a-f]",
            "col": "#{hex}+"
        },
        rules: [
           ["-", "return '-';" ],
           ["{col}", "return 'HEX';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "#129-#abfe-#42dc-#ea12";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "-");
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "-");
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "-");
    assert.equal(lexer.lex(), "HEX");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test action include", function() {
    var dict = {
        rules: [
           ["x", "return included ? 'Y' : 'N';" ],
           ["$", "return 'EOF';" ]
       ],
       actionInclude: "var included = true;"
    };

    var input = "x";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test ignored", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["\\s+", "/* skip whitespace */" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "x x   y x";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test disambiguate", function() {
    var dict = {
        rules: [
           ["for\\b", "return 'FOR';" ],
           ["if\\b", "return 'IF';" ],
           ["[a-z]+", "return 'IDENTIFIER';" ],
           ["\\s+", "/* skip whitespace */" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "if forever for for";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "IF");
    assert.equal(lexer.lex(), "IDENTIFIER");
    assert.equal(lexer.lex(), "FOR");
    assert.equal(lexer.lex(), "FOR");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test yytext overwrite", function() {
    var dict = {
        rules: [
           ["x", "yytext = 'hi der'; return 'X';" ]
       ]
    };

    var input = "x";

    var lexer = new RegExpLexer(dict, input);
    lexer.lex();
    assert.equal(lexer.yytext, "hi der");
  });

  it("test yylineno with test_match", function() {
    var dict = {
        rules: [
           ["\\s+", "/* skip whitespace */" ],
           ["x", "return 'x';" ],
           ["y", "return 'y';" ]
       ]
    };

    var input = "x\nxy\n\n\nx";
    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.yylineno, 0);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yylineno, 1);
    assert.equal(lexer.lex(), "y");
    assert.equal(lexer.yylineno, 1);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yylineno, 4);
  });

  it("test yylineno with input", function() {
    var dict = {
        rules: [
           ["\\s+", "/* skip whitespace */" ],
           ["x", "return 'x';" ],
           ["y", "return 'y';" ]
       ]
    };

    // windows style
    var input = "a\r\nb";
    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.yylineno, 0);
    assert.equal(lexer.input(), "a");
    assert.equal(lexer.input(), "\r\n");
    assert.equal(lexer.yylineno, 1);
    assert.equal(lexer.input(), "b");
    assert.equal(lexer.yylineno, 1);

    // linux style
    var input = "a\nb";
    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.yylineno, 0);
    assert.equal(lexer.input(), "a");
    assert.equal(lexer.input(), "\n");
    assert.equal(lexer.yylineno, 1);
    assert.equal(lexer.input(), "b");
    assert.equal(lexer.yylineno, 1);

    // mac style
    var input = "a\rb";
    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.yylineno, 0);
    assert.equal(lexer.input(), "a");
    assert.equal(lexer.input(), "\r");
    assert.equal(lexer.yylineno, 1);
    assert.equal(lexer.input(), "b");
    assert.equal(lexer.yylineno, 1);
  });


  it("test yylloc, yyleng, and other lexer token parameters", function() {
    var dict = {
        rules: [
           ["\\s+", "/* skip whitespace */" ],
           ["x+", "return 'x';" ],
           ["y+", "return 'y';" ]
       ]
    };

    var input = "x\nxy\n\n\nx\nyyyy";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yytext, "x", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 1, "offset");
    assert.equal(lexer.match, "x", "match");
    assert.equal(lexer.matched, "x", "matched");
    assert.equal(lexer.yylloc.first_line, 1);
    assert.equal(lexer.yylloc.last_line, 1);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 1);
    //assert.ok(lexer.yylloc.range === undefined);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yytext, "x", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 3, "offset");
    assert.equal(lexer.match, "x", "match");
    assert.equal(lexer.matched, "x\nx", "matched");
    assert.equal(lexer.yylloc.first_line, 2);
    assert.equal(lexer.yylloc.last_line, 2);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 1);
    assert.equal(lexer.lex(), "y");
    assert.equal(lexer.yytext, "y", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 4, "offset");
    assert.equal(lexer.match, "y", "match");
    assert.equal(lexer.matched, "x\nxy", "matched");
    assert.equal(lexer.yylloc.first_line, 2);
    assert.equal(lexer.yylloc.last_line, 2);
    assert.equal(lexer.yylloc.first_column, 1);
    assert.equal(lexer.yylloc.last_column, 2);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yytext, "x", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 8, "offset");
    assert.equal(lexer.match, "x", "match");
    assert.equal(lexer.matched, "x\nxy\n\n\nx", "matched");
    assert.equal(lexer.yylloc.first_line, 5);
    assert.equal(lexer.yylloc.last_line, 5);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 1);
    assert.equal(lexer.lex(), "y");
    assert.equal(lexer.yytext, "yyyy", "yytext");
    assert.equal(lexer.yyleng, 4, "yyleng");
    assert.equal(lexer.offset, 13, "offset");
    assert.equal(lexer.match, "yyyy", "match");
    assert.equal(lexer.matched, "x\nxy\n\n\nx\nyyyy", "matched");
    assert.equal(lexer.yylloc.first_line, 6);
    assert.equal(lexer.yylloc.last_line, 6);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 4);
  });

  it("test yylloc with %options ranges", function() {
    var dict = {
        options: {
          ranges: true
        },
        rules: [
           ["\\s+", "/* skip whitespace */" ],
           ["x+", "return 'x';" ],
           ["y+", "return 'y';" ]
       ]
    };

    var input = "x\nxy\n\n\nx\nyyyy";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yytext, "x", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 1, "offset");
    assert.equal(lexer.match, "x", "match");
    assert.equal(lexer.matched, "x", "matched");
    assert.equal(lexer.yylloc.first_line, 1);
    assert.equal(lexer.yylloc.last_line, 1);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 1);
    assert.ok(lexer.yylloc.range != null);
    assert.equal(lexer.yylloc.range[0], 0);
    assert.equal(lexer.yylloc.range[1], 1);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yytext, "x", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 3, "offset");
    assert.equal(lexer.match, "x", "match");
    assert.equal(lexer.matched, "x\nx", "matched");
    assert.equal(lexer.yylloc.first_line, 2);
    assert.equal(lexer.yylloc.last_line, 2);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 1);
    assert.equal(lexer.yylloc.range[0], 2);
    assert.equal(lexer.yylloc.range[1], 3);
    assert.equal(lexer.lex(), "y");
    assert.equal(lexer.yytext, "y", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 4, "offset");
    assert.equal(lexer.match, "y", "match");
    assert.equal(lexer.matched, "x\nxy", "matched");
    assert.equal(lexer.yylloc.first_line, 2);
    assert.equal(lexer.yylloc.last_line, 2);
    assert.equal(lexer.yylloc.first_column, 1);
    assert.equal(lexer.yylloc.last_column, 2);
    assert.equal(lexer.yylloc.range[0], 3);
    assert.equal(lexer.yylloc.range[1], 4);
    assert.equal(lexer.lex(), "x");
    assert.equal(lexer.yytext, "x", "yytext");
    assert.equal(lexer.yyleng, 1, "yyleng");
    assert.equal(lexer.offset, 8, "offset");
    assert.equal(lexer.match, "x", "match");
    assert.equal(lexer.matched, "x\nxy\n\n\nx", "matched");
    assert.equal(lexer.yylloc.first_line, 5);
    assert.equal(lexer.yylloc.last_line, 5);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 1);
    assert.equal(lexer.yylloc.range[0], 7);
    assert.equal(lexer.yylloc.range[1], 8);
    assert.equal(lexer.lex(), "y");
    assert.equal(lexer.yytext, "yyyy", "yytext");
    assert.equal(lexer.yyleng, 4, "yyleng");
    assert.equal(lexer.offset, 13, "offset");
    assert.equal(lexer.match, "yyyy", "match");
    assert.equal(lexer.matched, "x\nxy\n\n\nx\nyyyy", "matched");
    assert.equal(lexer.yylloc.first_line, 6);
    assert.equal(lexer.yylloc.last_line, 6);
    assert.equal(lexer.yylloc.first_column, 0);
    assert.equal(lexer.yylloc.last_column, 4);
    assert.equal(lexer.yylloc.range[0], 9);
    assert.equal(lexer.yylloc.range[1], 13);
  });

  it("test more()", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ['"[^"]*', function () {
               if (yytext.charAt(yyleng - 1) === '\\') {
                   this.more();
               } else {
                   yytext += this.input(); // swallow end quote
                   return "STRING";
               }
            } ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = 'x"fgjdrtj\\"sdfsdf"x';

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "STRING");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test defined token returns", function() {
    var tokens = {"2":"X", "3":"Y", "4":"EOF"};
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict, input, tokens);

    assert.equal(lexer.lex(), 2);
    assert.equal(lexer.lex(), 2);
    assert.equal(lexer.lex(), 3);
    assert.equal(lexer.lex(), 2);
    assert.equal(lexer.lex(), 4);
  });

  it("test module generator from constructor", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexerSource = RegExpLexer.generate(dict);
    eval(lexerSource);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test module generator", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateModule();
    eval(lexerSource);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test generator with more complex lexer", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ['"[^"]*', function () {
               if (yytext.charAt(yyleng - 1) === '\\') {
                   this.more();
               } else {
                   yytext += this.input(); // swallow end quote
                   return "STRING";
               }
            } ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = 'x"fgjdrtj\\"sdfsdf"x';

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateModule();
    eval(lexerSource);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "STRING");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test commonjs module generator", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateCommonJSModule();
    var exports = {};
    eval(lexerSource);
    exports.lexer.setInput(input);

    assert.equal(exports.lex(), "X");
    assert.equal(exports.lex(), "X");
    assert.equal(exports.lex(), "Y");
    assert.equal(exports.lex(), "X");
    assert.equal(exports.lex(), "EOF");
  });

  it("test amd module generator", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateAMDModule();

    var lexer;
    var define = function (_, fn) {
      lexer = fn();
    };

    eval(lexerSource);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test DJ lexer", function() {
    var dict = {
      "lex": {
        "macros": {
            "digit": "[0-9]",
            "id": "[a-zA-Z_][a-zA-Z0-9_]*"
        },

        "rules": [
            ["\\/\\/.*",       "/* ignore comment */"],
            ["main\\b",     "return 'MAIN';"],
            ["class\\b",    "return 'CLASS';"],
            ["extends\\b",  "return 'EXTENDS';"],
            ["nat\\b",      "return 'NATTYPE';"],
            ["if\\b",       "return 'IF';"],
            ["else\\b",     "return 'ELSE';"],
            ["for\\b",      "return 'FOR';"],
            ["printNat\\b", "return 'PRINTNAT';"],
            ["readNat\\b",  "return 'READNAT';"],
            ["this\\b",     "return 'THIS';"],
            ["new\\b",      "return 'NEW';"],
            ["var\\b",      "return 'VAR';"],
            ["null\\b",     "return 'NUL';"],
            ["{digit}+",   "return 'NATLITERAL';"],
            ["{id}",       "return 'ID';"],
            ["==",         "return 'EQUALITY';"],
            ["=",          "return 'ASSIGN';"],
            ["\\+",        "return 'PLUS';"],
            ["-",          "return 'MINUS';"],
            ["\\*",        "return 'TIMES';"],
            [">",          "return 'GREATER';"],
            ["\\|\\|",     "return 'OR';"],
            ["!",          "return 'NOT';"],
            ["\\.",        "return 'DOT';"],
            ["\\{",        "return 'LBRACE';"],
            ["\\}",        "return 'RBRACE';"],
            ["\\(",        "return 'LPAREN';"],
            ["\\)",        "return 'RPAREN';"],
            [";",          "return 'SEMICOLON';"],
            ["\\s+",       "/* skip whitespace */"],
            [".",          "print('Illegal character'); throw 'Illegal character';"],
            ["$",          "return 'ENDOFFILE';"]
        ]
      }
    };

    var input = "class Node extends Object { \
                      var nat value    var nat value;\
                      var Node next;\
                      var nat index;\
                    }\
\
                    class List extends Object {\
                      var Node start;\
\
                      Node prepend(Node startNode) {\
                        startNode.next = start;\
                        start = startNode;\
                      }\
\
                      nat find(nat index) {\
                        var nat value;\
                        var Node node;\
\
                        for(node = start;!(node == null);node = node.next){\
                          if(node.index == index){\
                            value = node.value;\
                          } else { 0; };\
                        };\
\
                        value;\
                      }\
                    }\
\
                    main {\
                      var nat index;\
                      var nat value;\
                      var List list;\
                      var Node startNode;\
\
                      index = readNat();\
                      list = new List;\
\
                      for(0;!(index==0);0){\
                        value = readNat();\
                        startNode = new Node;\
                        startNode.index = index;\
                        startNode.value = value;\
                        list.prepend(startNode);\
                        index = readNat();\
                      };\
\
                      index = readNat();\
\
                      for(0;!(index==0);0){\
                        printNat(list.find(index));\
                        index = readNat();\
                      };\
                    }";

    var lexer = new RegExpLexer(dict.lex);
    lexer.setInput(input);
    var tok;
    while (tok = lexer.lex(), tok !== 1) {
        assert.equal(typeof tok, "string");
    }
  });

  it("test instantiation from string", function() {
    var dict = "%%\n'x' {return 'X';}\n'y' {return 'Y';}\n<<EOF>> {return 'EOF';}";

    var input = "x";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test inclusive start conditions", function() {
    var dict = {
        startConditions: {
            "TEST": 0,
        },
        rules: [
            ["enter-test", "this.begin('TEST');" ],
            [["TEST"], "x", "return 'T';" ],
            [["TEST"], "y", "this.begin('INITIAL'); return 'TY';" ],
            ["x", "return 'X';" ],
            ["y", "return 'Y';" ],
            ["$", "return 'EOF';" ]
        ]
    };
    var input = "xenter-testxyy";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "T");
    assert.equal(lexer.lex(), "TY");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test exclusive start conditions", function() {
    var dict = {
        startConditions: {
            "EAT": 1,
        },
        rules: [
            ["\\/\\/", "this.begin('EAT');" ],
            [["EAT"], ".", "" ],
            [["EAT"], "\\n", "this.begin('INITIAL');" ],
            ["x", "return 'X';" ],
            ["y", "return 'Y';" ],
            ["$", "return 'EOF';" ]
        ]
    };
    var input = "xy//yxteadh//ste\ny";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test pop start condition stack", function() {
    var dict = {
        startConditions: {
            "EAT": 1,
        },
        rules: [
            ["\\/\\/", "this.begin('EAT');" ],
            [["EAT"], ".", "" ],
            [["EAT"], "\\n", "this.popState();" ],
            ["x", "return 'X';" ],
            ["y", "return 'Y';" ],
            ["$", "return 'EOF';" ]
        ]
    };
    var input = "xy//yxteadh//ste\ny";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "EOF");
  });


  it("test star start condition", function() {
    var dict = {
        startConditions: {
            "EAT": 1,
        },
        rules: [
            ["\\/\\/", "this.begin('EAT');" ],
            [["EAT"], ".", "" ],
            ["x", "return 'X';" ],
            ["y", "return 'Y';" ],
            [["*"], "$", "return 'EOF';" ]
        ]
    };
    var input = "xy//yxteadh//stey";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test start condition constants", function() {
    var dict = {
        startConditions: {
            "EAT": 1,
        },
        rules: [
            ["\\/\\/", "this.begin('EAT');" ],
            [["EAT"], ".", "if (YYSTATE === 'EAT') return 'E';" ],
            ["x", "if (YY_START === 'INITIAL') return 'X';" ],
            ["y", "return 'Y';" ],
            [["*"], "$", "return 'EOF';" ]
        ]
    };
    var input = "xy//y";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "E");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test start condition & warning", function() {
    var dict = {
        startConditions: {
            "INITIAL": 0,
        },
        rules: [
            ["\\/\\/", "this.begin('EAT');" ],
            [["EAT"], ".", "if (YYSTATE === 'EAT') return 'E';" ],
            ["x", "if (YY_START === 'INITIAL') return 'X';" ],
            ["y", "return 'Y';" ],
            [["*"], "$", "return 'EOF';" ]
        ]
    };
    var input = "xy//y";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "E");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test unicode encoding", function() {
    var dict = {
        rules: [
            ["\\u2713", "return 'CHECK';" ],
            ["\\u03c0", "return 'PI';" ],
            ["y", "return 'Y';" ]
        ]
    };
    var input = "\u2713\u03c0y";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "CHECK");
    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
  });

  it("test unicode", function() {
    var dict = {
        rules: [
            ["π", "return 'PI';" ],
            ["y", "return 'Y';" ]
        ]
    };
    var input = "πy";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
  });

  it("test longest match returns", function() {
    var dict = {
        rules: [
            [".", "return 'DOT';" ],
            ["cat", "return 'CAT';" ]
        ],
        options: {flex: true}
    };
    var input = "cat!";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "CAT");
    assert.equal(lexer.lex(), "DOT");
  });

  it("test case insensitivity", function() {
    var dict = {
        rules: [
            ["cat", "return 'CAT';" ]
        ],
        options: {'case-insensitive': true}
    };
    var input = "Cat";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "CAT");
  });

  it("test camelCased json options", function() {
    var dict = {
        rules: [
            ["cat", "return 'CAT';" ]
        ],
        options: {
          caseInsensitive: true
        }
    };
    var input = "Cat";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "CAT");
  });

  it("test less", function() {
    var dict = {
        rules: [
            ["cat", "this.less(2); return 'CAT';" ],
            ["t", "return 'T';" ]
        ],
    };
    var input = "cat";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "CAT");
    assert.equal(lexer.lex(), "T");
  });

  it("test EOF unput", function() {
    var dict = {
        startConditions: {
            "UN": 1,
        },
        rules: [
            ["U", "this.begin('UN');return 'U';" ],
            [["UN"], "$", "this.unput('X')" ],
            [["UN"], "X", "this.popState();return 'X';" ],
            ["$", "return 'EOF'" ]
        ]
    };
    var input = "U";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "U");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test flex mode default rule", function() {
    var dict = {
        rules: [
            ["x", "return 'X';" ]
        ],
        options: {flex: true}
    };
    var input = "xyx";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
  });

  it("test pipe precedence", function() {
    var dict = {
        rules: [
            ["x|y", "return 'X_Y';" ],
            [".",   "return 'N';"]
        ]
    };
    var input = "xny";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X_Y");
    assert.equal(lexer.lex(), "N");
    assert.equal(lexer.lex(), "X_Y");
  });

  it("test ranges", function() {
    var dict = {
        rules: [
            ["x+", "return 'X';" ],
            [".",   "return 'N';"]
        ],
        options: {ranges: true}
    };
    var input = "xxxyy";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.deepEqual(lexer.yylloc.range, [0, 3]);
  });

  it("test unput location", function() {
    var dict = {
        rules: [
            ["x+", "return 'X';" ],
            ["y\\n", "this.unput('\\n'); return 'Y';" ],
            ["\\ny", "this.unput('y'); return 'BR';" ],
            ["y", "return 'Y';" ],
            [".",   "return 'N';"]
        ],
        options: {ranges: true}
    };
    var input = "xxxy\ny";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.next(), "X");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [0, 3]});
    assert.equal(lexer.next(), "Y");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 3,
                                    last_line: 1,
                                    last_column: 4,
                                    range: [3, 4]});
    assert.equal(lexer.next(), "BR");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 4,
                                    last_line: 2,
                                    last_column: 0,
                                    range: [4, 5]});
    assert.equal(lexer.next(), "Y");
    assert.deepEqual(lexer.yylloc, {first_line: 2,
                                    first_column: 0,
                                    last_line: 2,
                                    last_column: 1,
                                    range: [5, 6]});

  });

  it("test unput location again", function() {
    var dict = {
        rules: [
            ["x+", "return 'X';" ],
            ["y\\ny\\n", "this.unput('\\n'); return 'YY';" ],
            ["\\ny", "this.unput('y'); return 'BR';" ],
            ["y", "return 'Y';" ],
            [".",   "return 'N';"]
        ],
        options: {ranges: true}
    };
    var input = "xxxy\ny\ny";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.next(), "X");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [0, 3]});
    assert.equal(lexer.next(), "YY");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 3,
                                    last_line: 2,
                                    last_column: 1,
                                    range: [3, 6]});
    assert.equal(lexer.next(), "BR");
    assert.deepEqual(lexer.yylloc, {first_line: 2,
                                    first_column: 1,
                                    last_line: 3,
                                    last_column: 0,
                                    range: [6, 7]});
    assert.equal(lexer.next(), "Y");
    assert.deepEqual(lexer.yylloc, {first_line: 3,
                                    first_column: 0,
                                    last_line: 3,
                                    last_column: 1,
                                    range: [7, 8]});

  });

  it("test backtracking lexer reject() method", function() {
    var dict = {
        rules: [
            ["[A-Z]+([0-9]+)", "if (this.matches[1].length) this.reject(); else return 'ID';" ],
            ["[A-Z]+", "return 'WORD';" ],
            ["[0-9]+", "return 'NUM';" ]
        ],
        options: {backtrack_lexer: true}
    };
    var input = "A5";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "WORD");
    assert.equal(lexer.lex(), "NUM");
  });

  it("test lexer reject() exception when not in backtracking mode", function() {
    var dict = {
        rules: [
            ["[A-Z]+([0-9]+)", "if (this.matches[1].length) this.reject(); else return 'ID';" ],
            ["[A-Z]+", "return 'WORD';" ],
            ["[0-9]+", "return 'NUM';" ]
        ],
        options: {backtrack_lexer: false}
    };
    var input = "A5";

    var lexer = new RegExpLexer(dict);
    var JisonLexerError = lexer.JisonLexerError; 
    assert(JisonLexerError);

    lexer.setInput(input);

    assert.throws(function() {
        lexer.lex();
      },
      JisonLexerError,
      /Lexical error on line \d+[^]*?You can only invoke reject\(\) in the lexer when the lexer is of the backtracking persuasion/
    );
  });

  it("test yytext state after unput", function() {
    var dict = {
        rules: [
            ["cat4", "this.unput('4'); return 'CAT';" ],
            ["4", "return 'NUMBER';" ],
            ["$", "return 'EOF';"]
        ]
    };

    var input = "cat4";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);
    assert.equal(lexer.lex(), "CAT");
    /*the yytext should be 'cat' since we unput '4' from 'cat4' */
    assert.equal(lexer.yytext, "cat");
    assert.equal(lexer.lex(), "NUMBER");
    assert.equal(lexer.lex(), "EOF");
  });

  it("test not blowing up on a sequence of ignored tokens the size of the maximum callstack size", function() {
    var dict = {
        rules: [
            ["#", "// ignored" ],
            ["$", "return 'EOF';"]
        ]
    };

    /**
     * Crafts a src string of `#`s for our rules the size of the current maximum callstack.
     * The lexer used to blow up with a stack overflow error in this case.
     */
    var makeStackBlowingHashes = function() {
        try {
            return "#" + makeStackBlowingHashes();
        } catch (e) {
            return "#";
        }
    };

    var input = makeStackBlowingHashes();

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "EOF");
  });

  it("test custom parseError handler", function() {
    var dict = {
        rules: [
           ["x", "return 't';" ]
       ]
    };

    var input = "xyz ?";

    var counter = 0;

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input, {
      parser: {
        parseError: function (str, hash) {
          counter++;
        }
      }
    });
    assert.equal(lexer.lex(), "t");
    assert.equal(lexer.yytext, "x");
    assert.equal(lexer.lex(), lexer.ERROR);
    assert.equal(counter, 1);
    assert.equal(lexer.yytext, "y");
    assert.equal(lexer.lex(), lexer.ERROR);
    assert.equal(counter, 2);
    assert.equal(lexer.yytext, "z");
    assert.equal(lexer.lex(), lexer.ERROR);
    assert.equal(counter, 3);
    assert.equal(lexer.yytext, " ");
    assert.equal(lexer.lex(), lexer.ERROR);
    assert.equal(counter, 4);
    assert.equal(lexer.yytext, "?");
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    // and then the lexer keeps on spitting out EOF tokens ad nauseam:
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
  });

  it("test custom parseError handler which produces a replacement token", function() {
    var dict = {
        rules: [
           ["x", "return 't';" ]
       ]
    };

    var input = "xyz ?";

    var counter = 0;
    var c1, c2;

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input, {
      parser: {
        parseError: function (str, hash) {
          counter++;
          assert.ok(hash.lexer);
          // eat two more characters
          c1 = hash.lexer.input();
          c2 = hash.lexer.input();
          return 'alt';
        }
      }
    });
    assert.equal(lexer.lex(), "t");
    assert.equal(lexer.yytext, "x");
    assert.equal(lexer.lex(), 'alt');
    assert.equal(counter, 1);
    assert.equal(c1, "y");
    assert.equal(c2, "z");
    assert.equal(lexer.yytext, "yz");
    assert.equal(lexer.lex(), 'alt');
    assert.equal(counter, 2);
    assert.equal(c1, " ");
    assert.equal(c2, "?");
    assert.equal(lexer.yytext, " ?");
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    // and then the lexer keeps on spitting out EOF tokens ad nauseam:
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
  });

  it("test custom pre and post handlers", function() {
    var dict = {
        options: {
          pre_lex: function () {
            counter += 1;
            if (counter % 2 === 1) {
              return 'PRE';
            }
          },
          post_lex: function (tok) {
            counter += 2;
            return 'a:' + tok;
          }
        },
        rules: [
           ["[a-z]", "return 't';" ]
       ]
    };

    var input = "xyz";

    var counter = 0;

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);
    assert.equal(lexer.lex(), "a:PRE");
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 3);
    assert.equal(lexer.lex(), "a:t");
    assert.equal(lexer.yytext, "x");
    assert.equal(counter, 6);
    assert.equal(lexer.lex(), "a:PRE");
    // as our PRE handler causes the lexer to produce another token immediately
    // without entering the lexer proper, `yytext` et al are NOT RESET:
    assert.equal(lexer.yytext, "x");
    assert.equal(counter, 9);
    assert.equal(lexer.lex(), "a:t");
    assert.equal(lexer.yytext, "y");
    assert.equal(counter, 12);
    assert.equal(lexer.lex(), "a:PRE");
    assert.equal(lexer.yytext, "y");
    assert.equal(counter, 15);
    assert.equal(lexer.lex(), "a:t");
    assert.equal(lexer.yytext, "z");
    assert.equal(counter, 18);
    assert.equal(lexer.lex(), "a:PRE");
    assert.equal(lexer.yytext, "z");
    assert.equal(counter, 21);
    assert.equal(lexer.EOF, 1);
    assert.equal(lexer.lex(), "a:1");
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 24);
    // and then the lexer keeps on spitting out post-processed EOF tokens ad nauseam
    // interleaved with PRE tokens produced by the PRE handler:
    assert.equal(lexer.lex(), "a:PRE");
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 27);
    assert.equal(lexer.lex(), "a:1"); // EOF
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 30);
    assert.equal(lexer.lex(), "a:PRE");
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 33);
    assert.equal(lexer.lex(), "a:1");
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 36);
  });

  it("test live replacement of custom pre and post handlers", function() {
    var dict = {
        options: {
          pre_lex: function () {
            counter += 1;
            if (counter % 2 === 1) {
              return 'PRE';
            }
          },
          post_lex: function (tok) {
            counter += 2;
            return 'a:' + tok;
          }
        },
        rules: [
           ["[a-z]", "return 't';" ]
       ]
    };

    var input = "xyz";

    var counter = 0;

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);
    assert.equal(lexer.lex(), "a:PRE");
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 3);
    assert.equal(lexer.lex(), "a:t");
    assert.equal(lexer.yytext, "x");
    assert.equal(counter, 6);
    assert.equal(lexer.lex(), "a:PRE");
    // as our PRE handler causes the lexer to produce another token immediately
    // without entering the lexer proper, `yytext` et al are NOT RESET:
    assert.equal(lexer.yytext, "x");
    assert.equal(counter, 9);

    lexer.options.pre_lex = null;
    lexer.options.post_lex = function (tok) {
      counter--;
      if (tok !== lexer.EOF) {
        return 'V2:' + tok;
      }
      // default return of undefined/false/0 will have the lexer produce the raw token
    };

    assert.equal(lexer.lex(), "V2:t");
    assert.equal(lexer.yytext, "y");
    assert.equal(counter, 8);
    assert.equal(lexer.lex(), "V2:t");
    assert.equal(lexer.yytext, "z");
    assert.equal(counter, 7);
    assert.equal(lexer.EOF, 1);
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 6);
    // and then the lexer keeps on spitting out post-processed EOF tokens ad nauseam
    // interleaved with PRE tokens produced by the PRE handler:
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 5);
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 4);
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.yytext, "");
    assert.equal(counter, 3);
  });

  it("test edge case which could break documentation comments in the generated lexer", function() {
    var dict = {
        rules: [
           ["\\*\\/", "return 'X';" ],
           ["\"*/\"", "return 'Y';" ],
           ["'*/'", "return 'Z';" ]
       ]
    };

    var input = "*/";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test yylloc info object must be unique for each token", function() {
    var dict = {
        rules: [
            ["[a-z]", "return 'X';" ]
        ],
        options: {ranges: true}
    };

    var input = "xyz";
    var prevloc = null;

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 1,
                                    range: [0, 1]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), "X");
    assert.notStrictEqual(prevloc, lexer.yylloc);
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 1,
                                    last_line: 1,
                                    last_column: 2,
                                    range: [1, 2]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), "X");
    assert.notStrictEqual(prevloc, lexer.yylloc);
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 2,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [2, 3]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), lexer.EOF);
    // not so for EOF:
    if (0) {
      assert.notStrictEqual(prevloc, lexer.yylloc);
      assert.deepEqual(lexer.yylloc, {first_line: 1,
                                      first_column: 3,
                                      last_line: 1,
                                      last_column: 3,
                                      range: [3, 3]});
    }
  });

  it("test yylloc info object is not modified by subsequent lex() activity", function() {
    var dict = {
        rules: [
            ["[a-z]", "return 'X';" ]
        ],
        options: {ranges: true}
    };

    var input = "xyz";
    var prevloc = null;

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 1,
                                    range: [0, 1]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), "X");
    assert.notStrictEqual(prevloc, lexer.yylloc);
    assert.deepEqual(prevloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 1,
                                    range: [0, 1]});
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 1,
                                    last_line: 1,
                                    last_column: 2,
                                    range: [1, 2]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), "X");
    assert.notStrictEqual(prevloc, lexer.yylloc);
    assert.deepEqual(prevloc, {first_line: 1,
                                    first_column: 1,
                                    last_line: 1,
                                    last_column: 2,
                                    range: [1, 2]});
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 2,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [2, 3]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), lexer.EOF);
    // not so for EOF:
    if (0) {
      assert.notStrictEqual(prevloc, lexer.yylloc);
      assert.deepEqual(prevloc, {first_line: 1,
                                      first_column: 2,
                                      last_line: 1,
                                      last_column: 3,
                                      range: [2, 3]});
      assert.deepEqual(lexer.yylloc, {first_line: 1,
                                      first_column: 3,
                                      last_line: 1,
                                      last_column: 3,
                                      range: [3, 3]});
    }
  });

  it("test yylloc info object CAN be modified by subsequent input() activity", function() {
    var dict = {
        rules: [
            ["[a-z]", "return 'X';" ]
        ],
        options: {ranges: true}
    };

    var input = "xyz";
    var prevloc = null;

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 1,
                                    range: [0, 1]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), "X");
    assert.notStrictEqual(prevloc, lexer.yylloc);
    assert.deepEqual(prevloc, {first_line: 1,
                                    first_column: 0,
                                    last_line: 1,
                                    last_column: 1,
                                    range: [0, 1]});
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 1,
                                    last_line: 1,
                                    last_column: 2,
                                    range: [1, 2]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.input(), "z");
    // this will modify the existing yylloc:
    assert.strictEqual(prevloc, lexer.yylloc);
    assert.deepEqual(prevloc, {first_line: 1,
                                    first_column: 1,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [1, 3]});
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 1,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [1, 3]});
    prevloc = lexer.yylloc;
    assert.equal(lexer.lex(), lexer.EOF);
    // yylloc on EOF is NOT the same yylloc object as before: EOF is just another token, WITH its own yylloc info...
    assert.notStrictEqual(prevloc, lexer.yylloc);
    // and this yylloc value set is intuitive because EOF does update yylloc like any other lexed token:
    assert.deepEqual(lexer.yylloc, {first_line: 1,
                                    first_column: 3,
                                    last_line: 1,
                                    last_column: 3,
                                    range: [3, 3]});
  });

  it("test empty rule set with custom lexer", function() {
    var src = null;

    // Wrap the custom lexer code in a function so we can String()-dump it:
    function customLexerCode() {
        var input = ""; 
        var input_offset = 0; 
        var lexer = { 
            EOF: 1, 
            ERROR: 2, 
            options: {}, 
            lex: function () { 
                if (input.length > input_offset) { 
                    return "a" + input[input_offset++]; 
                } else { 
                    return this.EOF; 
                } 
            }, 
            setInput: function (inp) { 
                input = inp; 
                input_offset = 0; 
            } 
        };
    }

    var dict = {
        rules: [],
        actionInclude: String(customLexerCode).replace(/function [^\{]+\{/, '').replace(/\}$/, ''),
        moduleInclude: 'console.log("moduleInclude");',
        options: {
          foo: 'bar',
          showSource: function (lexer, source, opts) {
            src = source;
          }
        }
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "ax");
    assert.equal(lexer.lex(), "ax");
    assert.equal(lexer.lex(), "ay");
    assert.equal(lexer.lex(), "ax");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test XRegExp option support", function() {
    var dict = {
        options: {
          xregexp: true
        },
        rules: [
            ["π", "return 'PI';" ],
            ["\\p{Alphabetic}", "return 'Y';" ],
            ["[\\p{Number}]", "return 'N';" ]
        ]
    };
    var input = "πyαε";

    var lexer = new RegExpLexer(dict);

    // ensure the XRegExp class is invoked for the unicode rules; see also the compilation validation test code
    // inside the regexp-lexer.js file for the counterpart of this nasty test:
    //
    //    var __hacky_counter__ = 0;
    //    function XRegExp(re, f) {
    //      this.re = re;
    //      this.flags = f;
    //      var fake = /./;    // WARNING: this exact 'fake' is also depended upon by the xregexp unit test!
    //      __hacky_counter__++;
    //      fake.__hacky_backy__ = __hacky_counter__;
    //      return fake;
    //    }
    //
    var generated_ruleset = lexer.rules;
    assert(generated_ruleset);
    var xregexp_count = 0;
    for (var i = 0; i < generated_ruleset.length; i++) {
      var rule = generated_ruleset[i];
      assert(rule);
      if (rule.__hacky_backy__) {
        xregexp_count += rule.__hacky_backy__;
      }
    }
    assert.equal(xregexp_count, 1 + 2);

    // run the lexer and check the tokens produced by it: the faked version will be active but will deliver something
    // similar to the real XRegExp for this particular ruleset only!

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test support for basic unicode regex compilation via internal xregexp", function() {
    var dict = {
        options: {
          xregexp: false    // !!!
        },
        rules: [
            ["π", "return 'PI';" ],
            ["\\p{Alphabetic}", "return 'Y';" ],
            ["[\\p{Number}]", "return 'N';" ]
        ]
    };
    var input = "πyα1ε";

    var lexer = new RegExpLexer(dict);

    var generated_ruleset = lexer.rules;
    assert(generated_ruleset);
    var xregexp_count = 0;
    for (var i = 0; i < generated_ruleset.length; i++) {
      var rule = generated_ruleset[i];
      assert(rule);
      if (rule.__hacky_backy__) {
        xregexp_count += rule.__hacky_backy__;
      }
    }
    assert.equal(xregexp_count, 0);

    // run the lexer

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "N");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test support for unicode macro expansion via internal xregexp", function() {
    var dict = {
        options: {
          xregexp: false    // !!!
        },
        macros: {
            "DIGIT": "[\\p{Number}]"
        },
        rules: [
            ["π", "return 'PI';" ],
            ["\\p{Alphabetic}", "return 'Y';" ],
            ["{DIGIT}+", "return 'N';" ]
        ]
    };
    var input = "πyα123ε";

    var lexer = new RegExpLexer(dict);

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "N");
    assert.equal(lexer.match, "123");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.match, "ε");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test macro expansion in regex set atom", function() {
    var dict = {
        options: {
          xregexp: false    // !!!
        },
        macros: {
            "DIGIT": "[\\p{Number}]"
        },
        rules: [
            ["π", "return 'PI';" ],
            ["\\p{Alphabetic}", "return 'Y';" ],
            ["{DIGIT}+", "return 'N';" ]
        ]
    };
    var input = "πyα123ε";

    var lexer = new RegExpLexer(dict);

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "N");
    assert.equal(lexer.match, "123");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.match, "ε");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test nested macro expansion in xregexp set atoms", function() {
    var dict = {
        options: {
          xregexp: false    // !!!
        },
        macros: {
            "DIGIT": "[\\p{Number}]",
            "ALPHA": "[\\p{Alphabetic}]",
            "ALNUM": "[{DIGIT}{ALPHA}]"
        },
        rules: [
            ["π", "return 'PI';" ],
            ["[{ALNUM}]+", "return 'Y';" ],
            ["{DIGIT}+", "return 'N';" ]
        ]
    };
    var input = "πyα123ε";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    // assert.equal(expandedMacros.DIGIT.in_set, re2set('[\\p{Number}]'));
    // assert.equal(expandedMacros.ALPHA.in_set, re2set('[\\p{Alphabetic}]'));
    // assert.equal(expandedMacros.ALNUM.in_set, re2set('[\\p{Number}\\p{Alphabetic}]'));
    // assert.equal(expandedMacros.ALNUM.elsewhere, '[' + re2set('[\\p{Number}\\p{Alphabetic}]') + ']');

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.match, "yα123ε");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test macros in regex set atoms are recognized when coming from grammar string", function() {
    var dict = [
      "DIGIT [\\p{Number}]",
      "ALPHA [\\p{Alphabetic}]",
      "ALNUM [{DIGIT}{ALPHA}]",
      "",
      "%%",
      "",
      "π            return 'PI';",
      "[{ALNUM}]+   return 'Y';",
      "[{DIGIT}]+   return 'N';",
    ].join('\n');

    var input = "πyα123ε";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    // assert.equal(expandedMacros.DIGIT.in_set, re2set('[\\p{Number}]'));
    // assert.equal(expandedMacros.ALPHA.in_set, re2set('[\\p{Alphabetic}]'));
    // assert.equal(expandedMacros.ALNUM.in_set, re2set('[\\p{Number}\\p{Alphabetic}]'));
    // assert.equal(expandedMacros.ALNUM.elsewhere, '[' + re2set('[\\p{Number}\\p{Alphabetic}]') + ']');
    // assert.equal(expandedMacros.ALNUM.raw, '[{DIGIT}{ALPHA}]');

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.match, "yα123ε");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test nested macro expansion in regex set atoms", function() {
    var dict = {
        options: {
          xregexp: false
        },
        macros: {
            "DIGIT": "[0-9]",
            "ALPHA": "[a-zA-Z]",
            "ALNUM": "[{DIGIT}{ALPHA}]"
        },
        rules: [
            ["π", "return 'PI';" ],
            ["[{ALNUM}]+", "return 'Y';" ],
            ["{DIGIT}+", "return 'N';" ],
            [".", "return '?';" ]
        ]
    };
    var input = "πyα123εE";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    assert.equal(expandedMacros.DIGIT.in_set, '\\d');
    assert.equal(expandedMacros.ALPHA.in_set, 'A-Za-z');
    assert.equal(expandedMacros.ALNUM.in_set, '0-9A-Za-z');
    assert.equal(expandedMacros.ALNUM.elsewhere, '[^\\W_]');   /* [0-9A-Za-z] */

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=y");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=α");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=123");  // (!) not 'N=123' as ALNUM-based rule comes before DIGIT rule.
    assert.equal(lexer.lex() + '=' + lexer.match, "?=ε");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=E");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test nested macro expansion in regex set atoms with negating surrounding set (1 level)", function() {
    var dict = {
        options: {
          xregexp: false
        },
        macros: {
            "DIGIT": "[0-9]",
            "ALPHA": "[a-zA-Z]",
            "ALNUM": "[{DIGIT}{ALPHA}]",
            "CTRL":  "[^{ALNUM}]",
        },
        rules: [
            ["π", "return 'PI';" ],
            ["{CTRL}+", "return 'C';" ],
            ["[{ALNUM}]+", "return 'Y';" ],
            ["{DIGIT}+", "return 'N';" ],
            [".", "return '?';" ],
        ]
    };
    var input = "πyα * +123.@_[]εE";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    assert.equal(expandedMacros.DIGIT.in_set, '\\d');
    assert.equal(expandedMacros.ALPHA.in_set, 'A-Za-z');
    assert.equal(expandedMacros.ALNUM.in_set, '0-9A-Za-z');
    assert.equal(expandedMacros.ALNUM.elsewhere, '[^\\W_]');   /* [0-9A-Za-z] */
    // assert.equal(expandedMacros.CTRL.in_inv_set, '0-9A-Za-z');
    assert.equal(expandedMacros.CTRL.elsewhere, '[\\W_]');   /* [^0-9A-Za-z] */

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=y");
    assert.equal(lexer.lex() + '=' + lexer.match, "C=α * +");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=123");  // (!) not 'N=123' as ALNUM-based rule comes before DIGIT rule.
    assert.equal(lexer.lex() + '=' + lexer.match, "C=.@_[]ε");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=E");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test nested macro expansion in regex set atoms with negating inner set", function() {
    var dict = {
        options: {
          xregexp: false
        },
        macros: {
            "DIGIT": "[0-9]",
            "ALPHA": "[a-zA-Z]",
            "ALNUM": "[{DIGIT}{ALPHA}]|[{DIGIT}]",
            "CTRL":  "[^{ALNUM}]",
            "WORD":  "[BLUB:]|[^{CTRL}]",
            "WORDS": "[{WORD}]+",
            "DIGITS":"[{DIGIT}]+",
            "WS":    "[^\\S\\r\\n]",
            "NONE":  "[^\\W\\w]",
            "ANY":   "[\\W\\w]",
        },
        rules: [
            ["π", "return 'PI';" ],
            ["{CTRL}+", "return 'C';" ],
            ["[{WORD}]+", "return 'Y';" ],
            ["[{DIGIT}]+", "return 'N';" ],
            [".", "return '?';" ],
        ]
    };
    var input = "πyα * +123.@_[]εE";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    assert.equal(expandedMacros.DIGIT.in_set, '\\d');
    assert.equal(expandedMacros.ALPHA.in_set, 'A-Za-z');
    assert.equal(expandedMacros.ALNUM.in_set, '0-9A-Za-z');
    assert.equal(expandedMacros.ALNUM.elsewhere, '[^\\W_]|\\d');   /* [0-9A-Za-z]|[0-9] */
    assert.equal(expandedMacros.CTRL.in_set, '\\u0000-/:-@\\[-`{-\\uffff' /* '^0-9a-zA-Z' */ );
    assert.equal(expandedMacros.CTRL.elsewhere, '[\\W_]');  /* [^0-9A-Za-z] */
    assert.equal(expandedMacros.WORD.in_set, '0-:A-Za-z');
    assert.equal(expandedMacros.WORD.elsewhere, '[:BLU]|[^\\W_]');
    // Unicode Character 'LINE SEPARATOR' (U+2028) and Unicode Character 'PARAGRAPH SEPARATOR' (U+2029) must be explicitly encoded in \uNNNN
    // syntax to prevent crashes when the generated is compiled via `new Function()` as that one doesn't like it when you feed it
    // regexes with these two characters embedded as is! 
    assert.equal(expandedMacros.WS.in_set, '\\t\\v\\f \u00a0\u1680\u180e\u2000-\u200a\\u2028\\u2029\u202f\u205f\u3000\ufeff');
    assert.equal(expandedMacros.WS.elsewhere, '[^\\S\\n\\r]');
    assert.equal(expandedMacros.ANY.in_set, '\\S\\s');
    assert.equal(expandedMacros.ANY.elsewhere, '[\\S\\s]');
    assert.equal(expandedMacros.NONE.in_set, '^\\S\\s');
    assert.equal(expandedMacros.NONE.elsewhere, '[^\\S\\s]');
    assert.ok(expandedMacros.DIGITS.in_set instanceof Error);
    assert.equal(expandedMacros.DIGITS.elsewhere, '\\d+');
    assert.ok(expandedMacros.WORDS.in_set instanceof Error);
    assert.equal(expandedMacros.WORDS.elsewhere, '[\\d:A-Za-z]+');

    lexer.setInput(input);

    assert.equal(lexer.lex(), "PI");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=y");
    assert.equal(lexer.lex() + '=' + lexer.match, "C=α * +");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=123");  // (!) not 'N=123' as ALNUM-based rule comes before DIGIT rule.
    assert.equal(lexer.lex() + '=' + lexer.match, "C=.@_[]ε");
    assert.equal(lexer.lex() + '=' + lexer.match, "Y=E");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test Unicode Supplementary Plane detection in regex set atoms - part 1", function() {
    var dict = {
        options: {
          xregexp: false
        },
        macros: {
            "ISSUE_A":  "[\\t\\n\\r\\u0120-\\uD7FF\\uE000\\uFFFD]", // \\u10000-\\u10FFFF
            "ISSUE_B":  "[\\u001F-\\u002F]",           // side test: proper processing of 'dash' as a *character* in a set.
            "NOTISSUE": "[^{ISSUE_A}{ISSUE_B}XYZ]",    // negating the inner set means we include the U.S.P. in NOTISSUE!
            "NOTNOTISSUE": "[^{NOTISSUE}]",            // while negating the *negated set* once again *excludes* the U.S.P. in NOTNOTISSUE!
        },
        rules: [
            ["{ISSUE_A}+", "return 'A';" ],
            ["{ISSUE_B}+", "return 'B';" ],
//            ["{NOTISSUE}+", "return 'N';" ],
            ["{NOTNOTISSUE}+", "return 'C';" ],
            ["[{ISSUE_A}]+", "return 'X';" ],
            ["[{ISSUE_B}]+", "return 'Y';" ],
//            ["[{NOTISSUE}]+", "return 'W';" ],
            ["[{NOTNOTISSUE}]+", "return 'Z';" ],
            [".", "return '?';" ],
        ]
    };
    var input = "πXYZxyzα\u10000\u{0023}\u{1023}\u{10230}ε";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    
    // test the calculated regexes -- the 'sollwert' for the test takes `i2c()` encoding particulars into account:
    assert.equal(expandedMacros.ISSUE_A.in_set, '\\t\\n\\r\u0120-\uD7FF\uE000\\ufffd');
    assert.equal(expandedMacros.ISSUE_A.elsewhere, '[\\t\\n\\r\u0120-\uD7FF\uE000\\ufffd]');
    assert.equal(expandedMacros.ISSUE_B.in_set, '\\u001f-\u002F');
    assert.equal(expandedMacros.ISSUE_B.elsewhere, '[\\u001f-\u002F]');
    assert.equal(expandedMacros.NOTISSUE.in_set, '\\u0000-\\b\\v\\f\\u000e-\\u001e0-W\\[-\u011f\\ud800-\\udfff\ue001-\\ufffc\\ufffe\\uffff');
    assert.equal(expandedMacros.NOTISSUE.elsewhere, '[^\\t\\n\\r\\u001f-\u002FX-Z\u0120-\uD7FF\uE000\\ufffd]');
    assert.equal(expandedMacros.NOTNOTISSUE.in_set, '\\t\\n\\r\\u001f-\u002FX-Z\u0120-\uD7FF\uE000\\ufffd');
    assert.equal(expandedMacros.NOTNOTISSUE.elsewhere, '[\\t\\n\\r\\u001f-\u002FX-Z\u0120-\uD7FF\uE000\\ufffd]');

    lexer.setInput(input);

    assert.equal(lexer.lex() + '=' + lexer.match, "A=π");
    assert.equal(lexer.lex() + '=' + lexer.match, "C=XYZ");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=x");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=y");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=z");
    assert.equal(lexer.lex() + '=' + lexer.match, "A=α\u1000");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=0");
    assert.equal(lexer.lex() + '=' + lexer.match, "B=\u0023");
    assert.equal(lexer.lex() + '=' + lexer.match, "A=\u1023");

    // WARNING: as we don't support Extended Plane Unicode Codepoints 
    //          (i.e. any input character beyond U+FFFF), you will
    //          observe that these characters, when fed to the lexer, MAY
    //          be split up in their individual UCS2 Character Codes.
    //          In this example U+10230 === UCS 0xD800 + UCS 0xDE30 
    //          ('UTF-16' encoding of U+10230)

    //assert.equal(lexer.lex() + '=' + lexer.match, "?=\uD800\uDE30");  // U+10230
    assert.equal(lexer.lex() + '=' + lexer.match, "?=\uD800");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=\uDE30");

    assert.equal(lexer.lex() + '=' + lexer.match, "A=ε");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("test Unicode Supplementary Plane detection in regex set atoms - part 2 (XRegExp enabled)", function() {
    var dict = {
        options: {
          xregexp: true
        },
        macros: {
            "ISSUE_A":  "[\\t\\n\\r\\u0120-\\uD7FF\\uE000\\uFFFD]", // \\u10000-\\u10FFFF
            "ISSUE_B":  "[\\u001F-\\u002F]",           // side test: proper processing of 'dash' as a *character* in a set.
            "NOTISSUE": "[^{ISSUE_A}{ISSUE_B}XYZ]",    // negating the inner set means we include the U.S.P. in NOTISSUE!
            "NOTNOTISSUE": "[^{NOTISSUE}]",            // while negating the *negated set* once again *excludes* the U.S.P. in NOTNOTISSUE!
        },
        rules: [
            ["{ISSUE_A}+", "return 'A';" ],
            ["{ISSUE_B}+", "return 'B';" ],
//            ["{NOTISSUE}+", "return 'N';" ],
            ["{NOTNOTISSUE}+", "return 'C';" ],
            ["[{ISSUE_A}]+", "return 'X';" ],
            ["[{ISSUE_B}]+", "return 'Y';" ],
//            ["[{NOTISSUE}]+", "return 'W';" ],
            ["[{NOTNOTISSUE}]+", "return 'Z';" ],
            [".", "return '?';" ],
        ]
    };
    var input = "πXYZxyzα\u10000\u{0023}\u{1023}\u{10230}ε";

    var lexer = new RegExpLexer(dict);

    var expandedMacros = lexer.getExpandedMacros();
    //console.log("MACROS:::::::::::::::", expandedMacros);
    
    // test the calculated regexes -- the 'sollwert' for the test takes `i2c()` encoding particulars into account:
    assert.equal(expandedMacros.ISSUE_A.in_set, '\\t\\n\\r\u0120-\uD7FF\uE000\\ufffd');
    assert.equal(expandedMacros.ISSUE_A.elsewhere, '[\\t\\n\\r\u0120-\uD7FF\uE000\\ufffd]');
    assert.equal(expandedMacros.ISSUE_B.in_set, '\\u001f-\u002F');
    assert.equal(expandedMacros.ISSUE_B.elsewhere, '[\\u001f-\u002F]');
    assert.equal(expandedMacros.NOTISSUE.in_set, '\\u0000-\\b\\v\\f\\u000e-\\u001e0-W\\[-\u011f\\ud800-\\udfff\ue001-\\ufffc\\ufffe\\uffff');
    assert.equal(expandedMacros.NOTISSUE.elsewhere, '[^\\t\\n\\r\\u001f-\u002FX-Z\u0120-\uD7FF\uE000\\ufffd]');
    assert.equal(expandedMacros.NOTNOTISSUE.in_set, '\\t\\n\\r\\u001f-\u002FX-Z\u0120-\uD7FF\uE000\\ufffd');
    assert.equal(expandedMacros.NOTNOTISSUE.elsewhere, '[\\t\\n\\r\\u001f-\u002FX-Z\u0120-\uD7FF\uE000\\ufffd]');

    lexer.setInput(input);

    assert.equal(lexer.lex() + '=' + lexer.match, "A=π");
    assert.equal(lexer.lex() + '=' + lexer.match, "C=XYZ");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=x");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=y");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=z");
    assert.equal(lexer.lex() + '=' + lexer.match, "A=α\u1000");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=0");
    assert.equal(lexer.lex() + '=' + lexer.match, "B=\u0023");
    assert.equal(lexer.lex() + '=' + lexer.match, "A=\u1023");

    // WARNING: as we don't support Extended Plane Unicode Codepoints 
    //          (i.e. any input character beyond U+FFFF), you will
    //          observe that these characters, when fed to the lexer, MAY
    //          be split up in their individual UCS2 Character Codes.
    //          In this example U+10230 === UCS 0xD800 + UCS 0xDE30 
    //          ('UTF-16' encoding of U+10230)

    //assert.equal(lexer.lex() + '=' + lexer.match, "?=\uD800\uDE30");  // U+10230
    assert.equal(lexer.lex() + '=' + lexer.match, "?=\uD800");
    assert.equal(lexer.lex() + '=' + lexer.match, "?=\uDE30");

    assert.equal(lexer.lex() + '=' + lexer.match, "A=ε");
    assert.equal(lexer.lex(), lexer.EOF);
  });

  it("custom '<<EOF>>' lexer rule must only fire once for end-of-input", function() {
    var dict = [
      "%%",
      "'x'     {return 'X';}",
      "<<EOF>> {return 'CUSTOM_EOF';}",
      ".       {return yytext;}"
    ].join('\n');

    var input = "x<<EOF>>";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");      
    // side note: this particular input is also constructed to test/ensure
    // that the lexer does not inadvertedly match the literal '<<EOF>>'
    // input string with the *special* <<EOF>> lexer rule token!
    //
    // In other words: if this next lex() call fails, we know we have a
    // deep b0rk in the lex compiler (rule parser/recognizer)! 
    assert.equal(lexer.lex(), "<");
    assert.equal(lexer.lex(), "<");
    assert.equal(lexer.lex(), "E");
    assert.equal(lexer.lex(), "O");
    assert.equal(lexer.lex(), "F");
    assert.equal(lexer.lex(), ">");
    assert.equal(lexer.lex(), ">");
    assert.equal(lexer.lex(), "CUSTOM_EOF");
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.lex(), lexer.EOF);
    assert.equal(lexer.lex(), lexer.EOF);
  });

  // related to https://github.com/GerHobbelt/jison/issues/9
  it("test multiple independent lexer instances", function() {
    var dict1 = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var dict2 = {
        rules: [
           ["a", "return 'A';" ],
           ["b", "return 'B';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input1 = "xxyx";
    var input2 = "aaba";

    var lexer1 = new RegExpLexer(dict1, input1);
    var lexer2 = new RegExpLexer(dict2, input2);
    assert.equal(lexer1.lex(), "X");
    assert.equal(lexer2.lex(), "A");
    assert.equal(lexer1.lex(), "X");
    assert.equal(lexer2.lex(), "A");
    assert.equal(lexer1.lex(), "Y");
    assert.equal(lexer2.lex(), "B");
    assert.equal(lexer1.lex(), "X");
    assert.equal(lexer2.lex(), "A");
    assert.equal(lexer1.lex(), "EOF");
    assert.equal(lexer2.lex(), "EOF");
  });

  // related to https://github.com/GerHobbelt/jison/issues/9
  it("test cloned yet independent lexer instances", function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input1 = "xxyx";
    var input2 = "yyx";

    var lexerBase = new RegExpLexer(dict /*, input1 */);
    function MyLexerClass() {
        this.yy = {};
    }
    MyLexerClass.prototype = lexerBase;

    function mkLexer() {
        return new MyLexerClass();
    }

    var lexer1 = mkLexer();
    lexer1.setInput(input1, {
      one: true
    });

    var lexer2 = mkLexer();
    lexer2.setInput(input2, {
      two: true
    });

    assert.equal(lexer1.lex(), "X");
    assert.equal(lexer2.lex(), "Y");
    assert.equal(lexer1.lex(), "X");
    assert.equal(lexer2.lex(), "Y");
    assert.equal(lexer1.lex(), "Y");
    assert.equal(lexer2.lex(), "X");
    assert.equal(lexer1.lex(), "X");
    assert.equal(lexer2.lex(), "EOF");
    assert.equal(lexer1.lex(), "EOF");
    // once you've gone 'past' EOF, you get the EOF **ID** returned, rather than your custom EOF token.
    // 
    // The `EOF` attribute is just a handy constant defined in the lexer prototype...
    assert.equal(lexer2.lex(), lexerBase.EOF);
    assert.equal(lexer1.lex(), lexerBase.EOF);
    assert.equal(lexer1.EOF, lexerBase.EOF);
    assert.equal(lexer2.EOF, lexerBase.EOF);
  });
});

