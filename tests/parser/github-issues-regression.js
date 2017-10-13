var fs = require("fs");
var path = require("path");
var assert = require("chai").assert;
var Jison = require('../setup').Jison;
var Lexer = require('../setup').Lexer;
var helpers     = require('../../modules/helpers-lib');
var code_exec   = helpers.exec;


var original_cwd = process.cwd();


describe("Regression Checks", function () {
  it("GitHub JISON issue #13: https://github.com/GerHobbelt/jison/issues/13", function () {
    // Change CWD to the directory where the source grammar resides: this helps us properly
    // %include any files mentioned in the grammar with relative paths:
    process.chdir(__dirname);

    var filespec = {
      path: "./github-issues-nr-13-gho.y"
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
      console.log("ex:" + ex + ex.stack);
      assert.ok(true);
    }
  });
});
