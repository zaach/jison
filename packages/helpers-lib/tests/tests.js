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

  it("parseCodeChunkToAST + prettyPrintAST", function () {
    var rmCommonWS = helpers.rmCommonWS;

    var ast = helpers.parseCodeChunkToAST(`
        for (var i = 0, len = 10; i < len; i++) {
            console.log(i);
        }
    `);
    var rv = helpers.prettyPrintAST(ast);
    var sollwert_src = rmCommonWS`
        for (var i = 0, len = 10; i < len; i++) {
          console.log(i);
        }
    `;
    assert.strictEqual(rv, sollwert_src.trim());
  });

  it("exec: **TBD**", function () {
    assert.ok(typeof helpers.exec === 'function');
  });

  it("dump: **TBD**", function () {
    assert.ok(typeof helpers.dump === 'function');
  });
});

