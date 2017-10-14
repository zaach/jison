var assert = require("chai").assert;
// NodeJS doesn't support ES2015 import statements yet, so we must use the compiled/rollup-ed version instead:
var helpers = require('../dist/helpers-lib-cjs');

// TODO real tests

describe("helpers API", function () {
  it("camelCase", function () {
    assert.strictEqual(helpers.camelCase("abc"), "abc");
    assert.strictEqual(helpers.camelCase("abc-def-ghi"), "abcDefGhi");

    assert.strictEqual(helpers.camelCase("1abc"), "1abc");
    assert.strictEqual(helpers.camelCase(" abc"), " abc");
    assert.strictEqual(helpers.camelCase("abc_def_ghi"), "abc_def_ghi");
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

