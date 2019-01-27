var assert = require("chai").assert;
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var yaml = require('@gerhobbelt/js-yaml');
var JSON5 = require('@gerhobbelt/json5');
var globby = require('globby');
var bnf = require("../dist/ebnf-parser-cjs-es5");
var ebnf = bnf.ebnf_parser;





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









  console.log('exec glob....', __dirname);
  var testset = globby.sync([
    __dirname + '/specs/1*.jison',
    __dirname + '/specs/1*.bnf',
    __dirname + '/specs/1*.ebnf',
    __dirname + '/specs/1*.json5',
    '!'+ __dirname + '/specs/1*-ref.json5',
    __dirname + '/specs/1*.js',
  ]);
  var original_cwd = process.cwd();

  testset = testset.sort();

  testset = testset.map(function (filepath) {
    // Get document, or throw exception on error
    try {
      console.log('Parser Spec file:', filepath.replace(/^.*?\/specs\//, ''));
      var spec;
      var header;
      var extra;
      var grammar;

      if (filepath.match(/\.js$/)) {
        spec = require(filepath);

        var hdrspec = fs.readFileSync(filepath, 'utf8').replace(/\r\n|\r/g, '\n');

        // extract the top comment, which carries the title, etc. metadata:
        header = hdrspec.substr(0, hdrspec.indexOf('\n\n') + 1);
        
        grammar = spec;
      } else {
        spec = fs.readFileSync(filepath, 'utf8').replace(/\r\n|\r/g, '\n');

        // extract the top comment, which carries the title, etc. metadata:
        header = spec.substr(0, spec.indexOf('\n\n') + 1);

        // extract the grammar to test:
        grammar = spec.substr(spec.indexOf('\n\n') + 2);
      }

      // then strip off the comment prefix for every line:
      header = header.replace(/^\/\/ ?/gm, '').replace(/\n...\n[^]*$/, function (m) {
        extra = m;
        return '';
      });

      var doc = yaml.safeLoad(header, {
        filename: filepath,
      });

      if (doc.crlf && typeof grammar === 'string') {
        grammar = grammar.replace(/\n/g, "\r\n");
      }

      var refOutFilePath = path.normalize(path.dirname(filepath) + '/reference-output/' + path.basename(filepath) + '-ref.json5');
      var testOutFilePath = path.normalize(path.dirname(filepath) + '/output/' + path.basename(filepath) + '-ref.json5');
      var lexerRefFilePath = path.normalize(path.dirname(filepath) + '/reference-output/' + path.basename(filepath) + '-lex.json5');
      var lexerOutFilePath = path.normalize(path.dirname(filepath) + '/output/' + path.basename(filepath) + '-lex.json5');
      mkdirp(path.dirname(refOutFilePath));
      mkdirp(path.dirname(testOutFilePath));

      var refOut;
      try {
        var soll = fs.readFileSync(refOutFilePath, 'utf8').replace(/\r\n|\r/g, '\n');
        if (doc.crlf) {
          soll = soll.replace(/\n/g, "\r\n");
        }
        refOut = JSON5.parse(soll);
      } catch (ex) {
        refOut = null;
      }

      var lexerRefOut;
      try {
        var soll = fs.readFileSync(lexerRefFilePath, 'utf8').replace(/\r\n|\r/g, '\n');
        if (doc.crlf) {
          soll = soll.replace(/\n/g, "\r\n");
        }
        lexerRefOut = JSON5.parse(soll);
      } catch (ex) {
        lexerRefOut = null;
      }

      return {
        path: filepath,
        outputRefPath: refOutFilePath,
        outputOutPath: testOutFilePath,
        lexerRefPath: lexerRefFilePath,
        lexerOutPath: lexerOutFilePath,
        spec: spec,
        grammar: grammar,
        meta: doc,
        metaExtra: extra,
        lexerRef: lexerRefOut,
        ref: refOut
      };
    } catch (ex) {
      console.log(ex);
      throw ex;
    }
    return false;
  })
  .filter(function (info) {
    return !!info;
  });

  var original_cwd = process.cwd();

  function stripErrorStackPaths(msg) {
    // strip away devbox-specific paths in error stack traces in the output:
    msg = msg.replace(/\bat ([^\r\n(\\\/]*?)\([^)]+?([\\\/][a-z0-9_-]+\.js:[0-9]+:[0-9]+)\)/gi, 'at $1($2)');
    msg = msg.replace(/\bat [^\r\n ]+?([\\\/][a-z0-9_-]+\.js:[0-9]+:[0-9]+)/gi, 'at $1');
    return msg;
  }

  function testrig_JSON5circularRefHandler(obj, circusPos, objStack, keyStack, key, err) {
    // and produce an alternative structure to JSON-ify:
    return {
      circularReference: true,
      // ex: {
      //   message: err.message,
      //   type: err.name
      // },
      index: circusPos,
      parentDepth: objStack.length - circusPos - 1,
      key: key,
      keyStack: keyStack,    // stack & keyStack have already been snapshotted by the JSON5 library itself so passing a direct ref is fine here!
    };
  }

  function reduceWhitespace(src) {
    // replace tabs with space, clean out multiple spaces and kill trailing spaces:
    return src
      .replace(/\r\n|\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ $/gm, '');
  }










describe("EBNF lexer", function () {
  beforeEach(function beforeEachTest() {
    parser_reset();
  });

  testset.forEach(function (filespec) {
    // process this file:
    var title = (filespec.meta ? filespec.meta.title : null);

    // and create a test for it:
    it('test: ' + filespec.path.replace(/^.*?\/specs\//, '') + (title ? ' :: ' + title : ''), function testEachParserExample() {
      var err, ast, grammar;
      var tokens = [];
      var lexer = bnf.bnf_parser.parser.lexer;

      try {
        // Change CWD to the directory where the source grammar resides: this helps us properly
        // %include any files mentioned in the grammar with relative paths:
        process.chdir(path.dirname(filespec.path));

        grammar = filespec.grammar; // "%% test: foo bar | baz ; hello: world ;";

        ast = lexer.setInput(grammar);
        ast.__original_input__ = grammar;

        var countDown = 4;
        for (var i = 0; i < 1000; i++) {
          var tok = lexer.lex();
          tokens.push({
            id: tok,
            token: bnf.bnf_parser.parser.describeSymbol(tok),
            yytext: lexer.yytext,
            yylloc: lexer.yylloc
          });
          if (tok === lexer.EOF) {
            // and make sure EOF stays EOF, i.e. continued invocation of `lex()` will only
            // produce more EOF tokens at the same location:
            countDown--;
            if (countDown <= 0) {
              break;
            }
          }
        }
      } catch (ex) {
        // save the error:
        tokens.push(-1);
        err = ex;
        tokens.push({
          fail: 1,
          message: ex.message,
          name: ex.name,
          stack: ex.stack,
          meta: filespec.spec.meta, 
          ex: ex,
        });
        // and make sure ast !== undefined:
        ast = { fail: 1 };
      } finally {
        process.chdir(original_cwd);
      }
      // also store the number of tokens we received:
      tokens.unshift(i);
      // if (lexerSourceCode) {
      //   tokens.push(lexerSourceCode);
      // }

      // either we check/test the correctness of the collected input, iff there's
      // a reference provided, OR we create the reference file for future use:
      var refOut = JSON5.stringify(tokens, {
        space: 2,
        circularRefHandler: testrig_JSON5circularRefHandler
      });
      // strip away devbox-specific paths in error stack traces in the output:
      refOut = stripErrorStackPaths(refOut);
      // and convert it back so we have a `tokens` set that's cleaned up
      // and potentially matching the stored reference set:
      tokens = JSON5.parse(refOut);
      if (filespec.lexerRef) {
        // Perform the validations only AFTER we've written the files to output:
        // several tests produce very large outputs, which we shouldn't let assert() process
        // for diff reporting as that takes bloody ages:
        //assert.deepEqual(ast, filespec.ref);
      } else {
        fs.writeFileSync(filespec.lexerRefPath, refOut, 'utf8');
        filespec.lexerRef = refOut;
      }
      fs.writeFileSync(filespec.lexerOutPath, refOut, 'utf8');

      // now that we have saved all data, perform the validation checks:
      assert.deepEqual(tokens, filespec.lexerRef, "grammar should be lexed correctly");
    });
  });
});











describe("EBNF parser", function () {
  beforeEach(function beforeEachTest() {
    parser_reset();
  });

  testset.forEach(function (filespec) {
    // process this file:
    var title = (filespec.meta ? filespec.meta.title : null);

    // and create a test for it:

    it('test: ' + filespec.path.replace(/^.*?\/specs\//, '') + (title ? ' :: ' + title : ''), function testEachParserExample() {
      var err, ast, grammar;

      try {
        // Change CWD to the directory where the source grammar resides: this helps us properly
        // %include any files mentioned in the grammar with relative paths:
        process.chdir(path.dirname(filespec.path));

        grammar = filespec.grammar; // "%% test: foo bar | baz ; hello: world ;";

        ast = bnf.parse(grammar);
        ast.__original_input__ = grammar;
      } catch (ex) {
        // save the error:
        err = ex;
        // and make sure ast !== undefined:
        ast = { fail: 1, spec: filespec.grammar, err: err };
      } finally {
        process.chdir(original_cwd);
      }

      // either we check/test the correctness of the collected input, iff there's
      // a reference provided, OR we create the reference file for future use:
      var refOut = JSON5.stringify(ast, {
        space: 2,
        circularRefHandler: testrig_JSON5circularRefHandler
      });
      // strip away devbox-specific paths in error stack traces in the output:
      refOut = stripErrorStackPaths(refOut);
      // and convert it back so we have a `tokens` set that's cleaned up
      // and potentially matching the stored reference set:
      ast = JSON5.parse(refOut);
      if (filespec.ref) {
        // Perform the validations only AFTER we've written the files to output:
        // several tests produce very large outputs, which we shouldn't let assert() process
        // for diff reporting as that takes bloody ages:
        //assert.deepEqual(ast, filespec.ref);
      } else {
        fs.writeFileSync(filespec.outputRefPath, refOut, 'utf8');
        filespec.ref = refOut;
      }
      fs.writeFileSync(filespec.outputOutPath, refOut, 'utf8');

      // now that we have saved all data, perform the validation checks:
      assert.deepEqual(ast, filespec.ref, "grammar should be parsed correctly");
    });
  });
});

