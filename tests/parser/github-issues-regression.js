var fs = require("fs");
var path = require("path");
var assert = require("chai").assert;
var Jison = require('../setup').Jison;
var Lexer = require('../setup').Lexer;
var helpers     = require('../../modules/helpers-lib');
var code_exec   = helpers.exec;


describe("Regression Checks", function () {
  it("GitHub JISON issue #13: https://github.com/GerHobbelt/jison/issues/13", function () {
    var filespec = {
      path: "tests/parser/github-issues-nr-13-gho.y"
    };
    var grammar = fs.readFileSync(filespec.path, "utf8");

    var options = {
      noMain: false,
    };
    //options.exportSourceCode = {};
    options.file = filespec.path;
    try {
      var parser = new Jison.Parser(grammar, options);

      assert.ok(false, "should never get here");
    } catch (ex) {
      console.log("ex:", ex);
      assert.ok(false);
    }
    code_exec(String(parser.parse), function test_exec() {
      if (typeof parser.main === 'function') {
        assert.ok(!parser.main(), 'main() is supposed to produce zero ~ success');
      } else if (filespec.inputs) {
        for (var i = 0, l = filespec.inputs.length; i < l; i++) {
          rv = parser.parse(filespec.inputs[i]);
          console.log('parse A: ', filespec.inputs[i], rv);
          assert.strictEqual(rv, true, 'parser.parse() is supposed to produce TRUE');
        }
      } else {
        rv = parser.parse('zz; yy; zz;zz ;');
        console.log('parse B: ', path.basename(filespec.path), rv);
        assert.strictEqual(rv, true, 'parser.parse() is supposed to produce TRUE');
      }
    }, {
      dumpSourceCodeOnFailure: true,
      throwErrorOnCompileFailure: true,
    }, "test");

    if (filespec.__check__) {
      filespec.__check__(parser, filespec, rv, options.exportAllTables);
    }
  });
});
