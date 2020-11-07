var fs = require('fs');
var XRegExp = require('@gerhobbelt/xregexp');
var assert = require("chai").assert;
// NodeJS doesn't support ES2015 import statements yet, so we must use the compiled/rollup-ed version instead:
var helpers = require('../dist/helpers-lib-cjs-es5');

// TODO real tests

describe("helpers API", function () {
  it("camelCase", function () {
    assert.strictEqual(helpers.camelCase("abc"), "abc");
    assert.strictEqual(helpers.camelCase("abc-def-ghi"), "abcDefGhi");

    assert.strictEqual(helpers.camelCase("1abc"), "1abc");
    assert.strictEqual(helpers.camelCase(" abc"), " abc");
    assert.strictEqual(helpers.camelCase("abc_def_ghi"), "abc_def_ghi");

    assert.strictEqual(helpers.camelCase("abc___def"), "abc___def");
    assert.strictEqual(helpers.camelCase("abc--def"), "abc-Def");
    assert.strictEqual(helpers.camelCase("abc----def"), "abc---Def");
    assert.strictEqual(helpers.camelCase("1-abc-2--def"), "1Abc-2-Def");
    assert.strictEqual(helpers.camelCase("a+b+c+d+e+-Fg"), "a+b+c+d+e+Fg");
  });

  it("mkIdentifier", function () {
    assert.strictEqual(helpers.mkIdentifier("abc"), "abc");
    assert.strictEqual(helpers.mkIdentifier("abc-def-ghi"), "abcDefGhi");

    assert.strictEqual(helpers.mkIdentifier("1abc"), "_abc");
    assert.strictEqual(helpers.mkIdentifier(" abc"), "_abc");
    assert.strictEqual(helpers.mkIdentifier("abc_def_ghi"), "abc_def_ghi");

    assert.strictEqual(helpers.mkIdentifier("abc___def"), "abc_def");
    assert.strictEqual(helpers.mkIdentifier("abc--def"), "abc_Def");
    assert.strictEqual(helpers.mkIdentifier("abc----def"), "abc_Def");
    assert.strictEqual(helpers.mkIdentifier("1-abc-2--def"), "_Abc_2_Def");
    assert.strictEqual(helpers.mkIdentifier("a+b+c+d+e+-Fg"), "a_b_c_d_e_Fg");
  });

  it("dquote", function () {
    assert.strictEqual(helpers.dquote("abc"), "\"abc\"");
    assert.strictEqual(helpers.dquote("abc's"), "\"abc\'s\"");
    assert.strictEqual(helpers.dquote("\"abc"), "'\"abc'");
    assert.strictEqual(helpers.dquote("\"abc\'s\""), "\"\\\"abc\'s\\\"\"");
  });

  it("rmCommonWS", function () {
    var rmCommonWS = helpers.rmCommonWS;

    assert.strictEqual(rmCommonWS`
        abc
    `, "\nabc\n");

    function rep_da_di_da_da(s) {
      return s;
    }
    function dquote(s) {
      return '"' + s + '"';
    }
    function topState() {
      return 'TOPSTATE';
    }
    function prettyPrintRange() {
      return 'PRETTY RANGE';
    }

    var yy_ = {
      yytext: 'YYTEXT'
    };

    var rv = rep_da_di_da_da(rmCommonWS`
                                                EBNF: ignoring unsupported parser option ${dquote(yy_.yytext)}
                                                while lexing in ${dquote(topState())} state.

                                                  Erroneous area:
                                                ` + prettyPrintRange());

    assert.strictEqual(rv, '\n' +
      'EBNF: ignoring unsupported parser option "YYTEXT"\n' +
      'while lexing in "TOPSTATE" state.\n' +
      '\n' +
      '  Erroneous area:\n' +
      'PRETTY RANGE');
  });

  it ("rmCommonWS: applied to zero-indent initial line input string (bug regression check)", function () {
    var rmCommonWS = helpers.rmCommonWS;

    // the key part of the next chunk is the ZERO INDENT of the yyerror... line!
    assert.strictEqual(rmCommonWS`
yyerror(rmCommonWS\`
            There's probably an error in one or more of your lexer regex rules.
            The lexer rule spec should have this structure:

                    regex  action_code

            where 'regex' is a lex-style regex expression (see the
            jison and jison-lex documentation) which is intended to match a chunk
            of the input to lex, while the 'action_code' block is the JS code
            which will be invoked when the regex is matched. The 'action_code' block
            may be any (indented!) set of JS statements, optionally surrounded
            by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.

              Erroneous code:
            $\{yylexer.prettyPrintRange(ဩerror)}

              Technical error report:
            $\{$error.errStr}
        \`);
    `, '\n' + `
yyerror(rmCommonWS\`
            There's probably an error in one or more of your lexer regex rules.
            The lexer rule spec should have this structure:

                    regex  action_code

            where 'regex' is a lex-style regex expression (see the
            jison and jison-lex documentation) which is intended to match a chunk
            of the input to lex, while the 'action_code' block is the JS code
            which will be invoked when the regex is matched. The 'action_code' block
            may be any (indented!) set of JS statements, optionally surrounded
            by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.

              Erroneous code:
            $\{yylexer.prettyPrintRange(ဩerror)}

              Technical error report:
            $\{$error.errStr}
        \`);
    `.trim() + '\n');
  });

  it("detectIstanbulGlobal", function () {
    if (!helpers.detectIstanbulGlobal()) {
      assert.strictEqual(helpers.detectIstanbulGlobal(), false);
    } else {
      var o = helpers.detectIstanbulGlobal();
      assert.ok(o);
      assert.equal(typeof o, 'object');
      var k = Object.keys(o);
      var kp = k.filter(function pass_paths(el) {
        return el.match(/[\\\/][^\\\/]+$/);
      });
      assert.ok(k.length > 0, "expected 1 or more keys in the istanbul global");
      assert.ok(kp.length > 0, "expected 1 or more paths as keys in the istanbul global");
      var kp = k.filter(function pass_istanbul_file_objects(idx) {
        var el = o[idx];
        return el && el.hash && el.statementMap && el.path;
      });
      assert.ok(kp.length > 0, "expected 1 or more istanbul file coverage objects in the istanbul global");
    }
  });

  /* istanbul ignore next: test functions' code is injected and then crashes the test due to extra code coverage statements having been injected */ 
  it("printFunctionSourceCode (direct)", function () {
    function d(i) { /* mock for linters */ }

    if (!helpers.detectIstanbulGlobal()) {
      assert.strictEqual(helpers.printFunctionSourceCode(function a(x) { return x; }), "function a(x) { return x; }");
      assert.strictEqual(helpers.printFunctionSourceCode(function (x)  { return x; }), "function (x)  { return x; }");
      assert.strictEqual(helpers.printFunctionSourceCode((x) => { return x; }), "(x) => { return x; }");
      assert.strictEqual(helpers.printFunctionSourceCode((x) => x), "(x) => x");
      assert.strictEqual(helpers.printFunctionSourceCode((x) => (d(1), d(2), x)), "(x) => (d(1), d(2), x)");
      assert.strictEqual(helpers.printFunctionSourceCode(x => x + 7), "x => x + 7");
    } else {
      assert.strictEqual(helpers.printFunctionSourceCode(function a(x) { return x; }), "function a(x){return x;}");
      assert.strictEqual(helpers.printFunctionSourceCode(function (x)  { return x; }), "function (x){return x;}");
      assert.strictEqual(helpers.printFunctionSourceCode((x) => { return x; }), "x=>{return x;}");
      assert.strictEqual(helpers.printFunctionSourceCode((x) => x), "x=>x");
      assert.strictEqual(helpers.printFunctionSourceCode((x) => (d(1), d(2), x)), "x=>(d(1),d(2),x)");
      assert.strictEqual(helpers.printFunctionSourceCode(x => x + 7), "x=>x+7");
    }
  });

  /* istanbul ignore next: test functions' code is injected and then crashes the test due to extra code coverage statements having been injected */ 
  it("printFunctionSourceCode (indirect)", function () {
    function d(i) { /* mock for linters */ }

    var f1 = function a(x) { return x; };
    var f2 = function (x)  { return x; };
    var f3 = (x) => { return x; };
    var f4 = (x) => x;
    var f5 = (x) => (d(1), d(2), x);
    var f6 = x => x + 7;

    if (!helpers.detectIstanbulGlobal()) {
      assert.strictEqual(helpers.printFunctionSourceCode(f1), "function a(x) { return x; }");
      assert.strictEqual(helpers.printFunctionSourceCode(f2), "function (x)  { return x; }");
      assert.strictEqual(helpers.printFunctionSourceCode(f3), "(x) => { return x; }");
      assert.strictEqual(helpers.printFunctionSourceCode(f4), "(x) => x");
      assert.strictEqual(helpers.printFunctionSourceCode(f5), "(x) => (d(1), d(2), x)");
      assert.strictEqual(helpers.printFunctionSourceCode(f6), "x => x + 7");
    } else {
      assert.strictEqual(helpers.printFunctionSourceCode(f1), "function a(x){return x;}");
      assert.strictEqual(helpers.printFunctionSourceCode(f2), "function (x){return x;}");
      assert.strictEqual(helpers.printFunctionSourceCode(f3), "x=>{return x;}");
      assert.strictEqual(helpers.printFunctionSourceCode(f4), "x=>x");
      assert.strictEqual(helpers.printFunctionSourceCode(f5), "x=>(d(1),d(2),x)");
      assert.strictEqual(helpers.printFunctionSourceCode(f6), "x=>x+7");
    } 
  });

  /* istanbul ignore next: test functions' code is injected and then crashes the test due to extra code coverage statements having been injected */ 
  it("printFunctionSourceCodeContainer (direct)", function () {
    function d(i) { /* mock for linters */ }
    var x;          /* mock */
    
    if (!helpers.detectIstanbulGlobal()) {
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(function a(x) { return x; }), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(function (x)  { return x; }), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer((x) => { return x; }), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer((x) => x), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer((x) => (d(1), d(2), x)), { args: "x", code: "return (d(1), d(2), x);" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(x => x + 7), { args: "x", code: "return x + 7;" });
    } else {
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(function a(x) { return x; }), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(function (x)  { return x; }), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer((x) => { return x; }), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer((x) => x), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer((x) => (d(1), d(2), x)), { args: "x", code: "return (d(1),d(2),x);" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(x => x + 7), { args: "x", code: "return x+7;" });
    } 
  });

  /* istanbul ignore next: test functions' code is injected and then crashes the test due to extra code coverage statements having been injected */ 
  it("printFunctionSourceCodeContainer (indirect)", function () {
    function d(i) { /* mock for linters */ }
    var x;          /* mock */
    
    var f1 = function a(x) { return x; };
    var f2 = function (x)  { return x; };
    var f3 = (x) => { return x; };
    var f4 = (x) => x;
    var f5 = (x) => (d(1), d(2), x);
    var f6 = x => x + 7;

    if (!helpers.detectIstanbulGlobal()) {
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f1), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f2), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f3), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f4), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f5), { args: "x", code: "return (d(1), d(2), x);" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f6), { args: "x", code: "return x + 7;" });
    } else {
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f1), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f2), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f3), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f4), { args: "x", code: "return x;" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f5), { args: "x", code: "return (d(1),d(2),x);" });
      assert.deepEqual(helpers.printFunctionSourceCodeContainer(f6), { args: "x", code: "return x+7;" });
    } 
  });

  // remove all whitespace from input string `src`
  function rmAllWS(src) {
    return src.replace(/\s+/g, '');
  }

  it("generateMapper4JisonGrammarIdentifiers(input) picks a reasonable set of escapes to use", () => {
    let source = fs.readFileSync(__dirname + '/../../ebnf-parser/bnf.y');
    let g = helpers.generateMapper4JisonGrammarIdentifiers(source);

    function matchIdRegexBase(re) {
      //let ist = re.toString();
      //console.error('RE:', ist);
      //return /^\/#\(.+\)#\/g$/.test(ist);
      return re instanceof XRegExp;
    }

    function matchGeneralIdRe(re) {
      //let ist = re.toString();
      //return /^\/#\(.+?\)#\/g$/.test(ist);
      return re instanceof XRegExp;
    }

    assert.ok(g);
    assert.equal(typeof g, 'object');
    assert.equal(typeof g.decode, 'function');
    assert.equal(typeof g.encode, 'function');
    assert.deepEqual(g.tokenDirectIdentifierStart, 'ဩᐁ');
    assert.ok(matchIdRegexBase(g.tokenDirectIdentifierRe));
    assert.deepEqual(g.tokenValueReferenceStart, '$');
    assert.ok(matchIdRegexBase(g.tokenValueReferenceRe));
    assert.deepEqual(g.tokenLocationStart, 'ဩᑌ');
    assert.ok(matchIdRegexBase(g.tokenLocationRe));
    assert.deepEqual(g.tokenIdentifierStart, 'ဩᑫ');
    assert.ok(matchIdRegexBase(g.tokenIdentifierRe));
    assert.deepEqual(g.tokenStackIndexStart, 'ဩᔦ');
    assert.ok(matchIdRegexBase(g.tokenStackIndexRe));
    assert.deepEqual(g.tokenNegativeValueReferenceStart, 'ဩᗜ');
    assert.ok(matchIdRegexBase(g.tokenValueReferenceRe));
    assert.deepEqual(g.tokenNegativeLocationStart, 'ဩᘔ');
    assert.ok(matchIdRegexBase(g.tokenNegativeLocationRe));
    assert.deepEqual(g.tokenNegativeStackIndexStart, 'ဩᗄ');
    assert.ok(matchIdRegexBase(g.tokenNegativeStackIndexRe));
    assert.ok(matchGeneralIdRe(g.tokenDetect4EncodeRe));
    assert.ok(matchGeneralIdRe(g.tokenDetect4DecodeRe));
  });

  it("generateMapper4JisonGrammarIdentifiers(input) picks a reasonable set of escapes to use when confronted with Unicode collisions in the input", () => {
    let source = fs.readFileSync(__dirname + '/../../ebnf-parser/bnf.y', 'utf8');

    source = source
    .replace(/@/g, rmAllWS('ဩ ℹ ᐁ ᐯ ᑌ ᑍ ᑎ ᑏ ᔦ ᔧ ᔨ ᔩ ᔪ ᔫ ᔬ ᔭ ᔮ'))
    .replace(/$$/g, rmAllWS('ℹ'))
    .replace(/$/g, rmAllWS('இ ண ஐ ᐂ  ᐃ  ᐄ  ᐅ  ᐆ  ᐇ  ᐈ  ᐉ  ᐊ  ᐋ  ᐌ  ᐍ  ᐎ  ᐏ  ᐐ  ᐑ'));

    let g = helpers.generateMapper4JisonGrammarIdentifiers(source);

    function matchIdRegexBase(re) {
      //let ist = re.toString();
      //console.error('RE:', ist);
      //return /^\/#\(.+\)#\/g$/.test(ist);
      return re instanceof XRegExp;
    }

    function matchGeneralIdRe(re) {
      //let ist = re.toString();
      //return /^\/#\(.+?\)#\/g$/.test(ist);
      return re instanceof XRegExp;
    }

    assert.ok(g);
    assert.equal(typeof g, 'object');
    assert.equal(typeof g.decode, 'function');
    assert.equal(typeof g.encode, 'function');
    assert.deepEqual(g.tokenDirectIdentifierStart, 'Ϟᐒ');
    assert.ok(matchIdRegexBase(g.tokenDirectIdentifierRe));
    assert.deepEqual(g.tokenValueReferenceStart, '$');
    assert.ok(matchIdRegexBase(g.tokenValueReferenceRe));
    assert.deepEqual(g.tokenLocationStart, 'Ϟᑐ');
    assert.ok(matchIdRegexBase(g.tokenLocationRe));
    assert.deepEqual(g.tokenIdentifierStart, 'Ϟᑫ');
    assert.ok(matchIdRegexBase(g.tokenIdentifierRe));
    assert.deepEqual(g.tokenStackIndexStart, 'Ϟᔯ');
    assert.ok(matchIdRegexBase(g.tokenStackIndexRe));
    assert.deepEqual(g.tokenNegativeValueReferenceStart, 'Ϟᗜ');
    assert.ok(matchIdRegexBase(g.tokenValueReferenceRe));
    assert.deepEqual(g.tokenNegativeLocationStart, 'Ϟᘔ');
    assert.ok(matchIdRegexBase(g.tokenNegativeLocationRe));
    assert.deepEqual(g.tokenNegativeStackIndexStart, 'Ϟᗄ');
    assert.ok(matchIdRegexBase(g.tokenNegativeStackIndexRe));
    assert.ok(matchGeneralIdRe(g.tokenDetect4EncodeRe));
    assert.ok(matchGeneralIdRe(g.tokenDetect4DecodeRe));
  });

  it("generateMapper4JisonGrammarIdentifiers(input) properly encodes and decodes jison variables (1)", () => {
    let source = fs.readFileSync(__dirname + '/fixtures/Mapper4JisonGrammarIdentifiers.sample.txt', 'utf8');
    let g = helpers.generateMapper4JisonGrammarIdentifiers(source);

    assert.ok(g);
    assert.equal(typeof g, 'object');
    assert.equal(typeof g.decode, 'function');
    assert.equal(typeof g.encode, 'function');

    let im = g.encode(source);
    assert.notEqual(im, source);
    let cvt = g.decode(im);
    assert.deepEqual(cvt, source);
  });

  xit("generateMapper4JisonGrammarIdentifiers(input) properly encodes and decodes jison variables (2)", () => {
    let source = fs.readFileSync(__dirname + '/../../ebnf-parser/bnf.y', 'utf8');
    let g = helpers.generateMapper4JisonGrammarIdentifiers(source);

    assert.ok(g);
    assert.equal(typeof g, 'object');
    assert.equal(typeof g.decode, 'function');
    assert.equal(typeof g.encode, 'function');

    let im = g.encode(source);
    let cvt = g.decode(im);
    assert.deepEqual(cvt, source);
  });

  // auto-init the Unicode mapper:
  var mapper;
  function autoInitUnicodeMapper() {
    return {
      encode: function (source) {
        if (!mapper) {
          mapper = helpers.generateMapper4JisonGrammarIdentifiers(source);
        }
        return mapper.encode(source);
      },
      decode: function (source) {
        return mapper.decode(source);
      }
    }
  }
  
  it("parseCodeChunkToAST + prettyPrintAST", function () {
    var rmCommonWS = helpers.rmCommonWS;

    var options = { 
      mapper4JisonGrammarIdentifiers: autoInitUnicodeMapper() 
    };

    var ast = helpers.parseCodeChunkToAST(`
        for (var i = 0, len = 10; i < len; i++) {
            console.log(i);
        }
    `, options);
    var rv = helpers.prettyPrintAST(ast, options);
    var sollwert_src = rmCommonWS`
        for (var i = 0, len = 10; i < len; i++) {
          console.log(i);
        }
    `;
    assert.strictEqual(rv, sollwert_src.trim());
  });

  it("parseCodeChunkToAST + prettyPrintAST backticked code snippets with Unicode variable", function () {
    var rmCommonWS = helpers.rmCommonWS;

    var options = { 
      mapper4JisonGrammarIdentifiers: autoInitUnicodeMapper() 
    };

    let src = rmCommonWS`
yyerror(rmCommonWS\`
            There's probably an error in one or more of your lexer regex rules.
            The lexer rule spec should have this structure:

                    regex  action_code

            where 'regex' is a lex-style regex expression (see the
            jison and jison-lex documentation) which is intended to match a chunk
            of the input to lex, while the 'action_code' block is the JS code
            which will be invoked when the regex is matched. The 'action_code' block
            may be any (indented!) set of JS statements, optionally surrounded
            by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.

              Erroneous code:
            $\{yylexer.prettyPrintRange(ဩerror)}

              Technical error report:
            $\{$error.errStr}
        \`);
    `;

    var ast = helpers.parseCodeChunkToAST(src, options);
    var rv = helpers.prettyPrintAST(ast, options);
    var sollwert_src = src;
    assert.strictEqual(rv, sollwert_src.trim());
  });

  // regression test: recast-0.15.1-32 is boogered and MUST NOT be used!
  it("parseCodeChunkToAST must parse valid jison action code correctly (or your babel/recast version(s) will be boogered!)", function () {
    var rmCommonWS = helpers.rmCommonWS;

    var options = { 
      mapper4JisonGrammarIdentifiers: autoInitUnicodeMapper() 
    };

    let src = rmCommonWS`
yyerror(rmCommonWS\`
            There's probably an error in one or more of your lexer regex rules.
            The lexer rule spec should have this structure:

                    regex  action_code

            where 'regex' is a lex-style regex expression (see the
            jison and jison-lex documentation) which is intended to match a chunk
            of the input to lex, while the 'action_code' block is the JS code
            which will be invoked when the regex is matched. The 'action_code' block
            may be any (indented!) set of JS statements, optionally surrounded
            by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.

              Erroneous code:
            $\{yylexer.prettyPrintRange(@error)}

              Technical error report:
            $\{$error.errStr}
        \`);
    `;;

    var ast = helpers.parseCodeChunkToAST(src, options);
    var rv = helpers.prettyPrintAST(ast, options);
    var sollwert_src = src;
    assert.strictEqual(rv.replace(/\s+/g, ' '), sollwert_src.trim().replace(/\s+/g, ' '));
  });

  it("exec: **TBD**", function () {
    assert.ok(typeof helpers.exec === 'function');
  });

  it("dump: **TBD**", function () {
    assert.ok(typeof helpers.dump === 'function');
  });

  it("isLegalIdentifierInput: **TBD**", function () {
    assert.ok(typeof helpers.isLegalIdentifierInput === 'function');
  });

  it("scanRegExp: **TBD**", function () {
    assert.ok(typeof helpers.scanRegExp === 'function');
  });

  it("trimErrorForTestReporting: **TBD**", function () {
    assert.ok(typeof helpers.trimErrorForTestReporting === 'function');
  });

  it("checkRegExp: **TBD**", function () {
    assert.ok(typeof helpers.checkRegExp === 'function');
  });

  it("getRegExpInfo: **TBD**", function () {
    assert.ok(typeof helpers.getRegExpInfo === 'function');
  });

  it("checkActionBlock: **TBD**", function () {
    assert.ok(typeof helpers.checkActionBlock === 'function');
  });

  it("trimActionCode: **TBD**", function () {
    assert.ok(typeof helpers.trimActionCode === 'function');
  });

  it("compileCodeToES5: test default configuration", function () {
    assert.ok(typeof helpers.compileCodeToES5 === 'function');
    var rv = helpers.compileCodeToES5('console.log("hello");');
    assert.equal(typeof rv.code, 'string');
  });
});

