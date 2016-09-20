var Jison = require("../setup").Jison;
var Lexer = require("../setup").Lexer;
var glob = require("glob");
var fs = require('fs');
var assert = require("assert");


var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};




const test_list = [
  {
    name: 'issue-254',
  },
  {
    name: 'issue-293',
  },
  {
    name: 'issue-289',
    __ignore__: true,
  },
  {
    name: 'error-handling-and-yyclearin',
    inputs: [
      'A\nB A\nA\nA\n'
    ],
  },
  {
    name: 'error-handling-and-yyerrok-loopfix',
  },
  {
    name: 'error-handling-and-yyerrok-looping1',
  },
  {
    name: 'error-handling-and-yyerrok-looping2',
  },
  {
    name: 'error-handling-and-yyerrok-macro',
    inputs: [
      'A\nB A\nA\nA\n'
    ],
  },
  {
    name: 'error-handling-and-yyerrok-part1',
  },
  {
    name: 'error-handling-and-yyerrok-part2',
  },
  {
    name: 'error-handling-and-yyerrok-part3',
    inputs: [
      '    zz ;'      +
      '    ( zz ) ;'  +
      '    ( zz ;'    +
      '    zz ;'      +
      '    zz ;'      +
      '    zz );'     +
      '    zz ;' 
    ],
  },
  {
    name: 'error-handling-and-yyerrok-part4a',
  },
  {
    name: 'error-handling-and-yyerrok-part4b',
  },
  {
    name: 'error-handling-and-yyerrok-part5',
  },
  {
    name: 'error-recognition-actions',
    inputs: [
      'A\nB A\nA\nA\n'
    ],
  },
  {
    name: 'no-prec-hack-needed',
    __ignore__: true,
  },
  {
    name: 'yacc-error-recovery',
    __ignore__: true,
  },
  {
    name: 'with_custom_lexer',
    __ignore__: true,
  },
  {
    name: 'with_includes',
  },
  {
    name: 'klammergebirge',
  },
  {
    name: 'parser-to-lexer-communication-test--profiling',
    type: 'lr',
  },
  {
    name: 'parser-to-lexer-communication-test',
    type: 'lr',
    __ignore__: true,
  },
  {
    name: 'faking-multiple-start-rules',
    __ignore__: true,
  },
  {
    name: 'faking-multiple-start-rules-alt',
    __ignore__: true,
  },
  {
    name: 'lalr-but-not-slr',
    type: 'lalr',
  },
  {
    name: 'lr-but-not-lalr',
    type: 'lr',
  },
  {
    name: 'theory-left-recurs-01',
  },
];

console.log('exec glob....', __dirname);
var testset = glob.sync(__dirname + "/../../examples/*.jison");
testset = testset.sort().map(function (filepath) {
  for (var j = 0, lj = test_list.length; j < lj; j++) {
    var fstr = test_list[j].name;
    var pos = filepath.indexOf(fstr);
    // console.log('pos: ', pos, filepath, fstr);
    if (pos > 0) {
      return {
        path: filepath,
        type: test_list[j].type,

        inputs: test_list[j].inputs,

        __ignore__: test_list[j].__ignore__,
      };
    }
  }
  return false;
})
.filter(function (t) {
  return !!t;
});
// console.log('testset....', testset);

testset.forEach(function (filespec) {
  // process this file:
  exports["test example: " + filespec.path.replace(/^.*?\/examples\//, '')] = function () {
    var grammar = fs.readFileSync(filespec.path, 'utf8');

    if (filespec.__ignore__) {
      return;
    }

    var options = {};
    if (filespec.type) {
      options.type = filespec.type;
    }
    var parser = new Jison.Parser(grammar, options);

    if (typeof parser.main === 'function') {
      assert.ok(!parser.main(), "main() is supposed to produce zero ~ success");
    } else if (filespec.inputs) {
      for (var i = 0, l = filespec.inputs.length; i < l; i++) {
        var rv = parser.parse(filespec.inputs[i]);
        console.log('parse: ', filespec.inputs[i], rv);
        assert.ok(rv === true, "parser.parse() is supposed to produce TRUE");
      }
    } else {
      var rv = parser.parse('zz; yy; zz;zz ;');
      console.log('parse: ', filespec, rv);
      assert.ok(rv === true, "parser.parse() is supposed to produce TRUE");
    }
  };
});




/*

# build *AND* run the test:
issue-254:
  $(JISON) --main ./$@.jison
  node ./output/$@/$@.js

# build *AND* run the test:
issue-293:
  $(JISON) --main ./$@.jison
  node ./output/$@/$@.js

# build *AND* run the test:
issue-289:
  $(JISON) --main -t -p lalr ./$@.jison
  node ./output/$@/$@.js

json_js:
  -mkdir -p ./output/$@
  node ./json.js > ./output/$@/$@.js

json_ast_js:
  -mkdir -p ./output/$@
  node ./json_ast.js > ./output/$@/$@.js

# input test file:  ./semwhitespace_ex.src
semwhitespace:
  $(JISON) --main ./$@.jison semwhitespace_lex.jison

error-handling-and-yyclearin:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-loopfix:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-looping1:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-looping2:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-macro:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-part1:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-part2:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-part3:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-part4a:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-part4b:
  $(JISON) --main ./$@.jison

error-handling-and-yyerrok-part5:
  $(JISON) --main ./$@.jison

error-recognition-actions:
  $(JISON) --main ./$@.jison

no-prec-hack-needed:
  $(JISON) --main ./$@.jison
  node ./output/$@/$@.js

yacc-error-recovery:
  $(JISON) --main ./$@.jison

with_custom_lexer:
  $(JISON) --main ./$@.jison

klammergebirge:
  $(JISON) --main ./$@.jison

parser-to-lexer-communication-test--profiling:
  $(JISON) --main -p lr ./$@.jison
  node --prof ./output/$@/$@.js
  # and now collect the profile info and dump it to a report file:
  node --prof-process $$( ls -t isolate-*-v8.log | head -n 1 ) | sed -f ./profile-report-filter.sed > profile.$@.txt
  # and make sure the profile report is saved in a unique file which can be compared against other profile runs later on:
  cat profile.$@.txt > profile.$@.$$( date +%s%N ).txt

parser-to-lexer-communication-test:
  $(JISON) --main -p lr ./$@.jison
  node ./output/$@/$@.js

faking-multiple-start-rules:
  $(JISON) --main ./$@.jison

faking-multiple-start-rules-alt:
  $(JISON) --main ./$@.jison

# couple of examples which test theoretical grammars published in various papers about LR et al:

# build *AND* run the test:
lalr-but-not-slr:
  $(JISON) --main -p lalr ./$@.jison
  node ./output/$@/$@.js

# build *AND* run the test:
lr-but-not-lalr:
  $(JISON) --main -p lr ./$@.jison
  node ./output/$@/$@.js

# build *AND* run the test:
theory-left-recurs-01:
  $(JISON) --main ./$@.jison
  node ./output/$@/$@.js


# example of the use of the `%import symbols ...` statement: multi-phase engines
compiled_calc:
  $(JISON) ./$@_parse.jison
  # test if the generated JavaScript is viable at all:
  node output/$@/$@_parse.js
  $(JISON) ./$@_codegen.jison
  # test if the generated JavaScript is viable at all:
  node output/$@/$@_codegen.js
  $(JISON) ./$@_print.jison
  # test if the generated JavaScript is viable at all:
  node output/$@/$@_print.js
  $(JISON) ./$@_sorcerer.jison
  # test if the generated JavaScript is viable at all:
  node output/$@/$@_sorcerer.js
  $(JISON) ./$@_BURG.jison
  # test if the generated JavaScript is viable at all:
  node output/$@/$@_BURG.js
  $(JISON) ./$@_parse_for_fast_engine.jison
  # test if the generated JavaScript is viable at all:
  node output/$@/$@_parse_for_fast_engine.js
  #$(JISON) --main -t ./$@_exec.jison
  $(JISON) --main ./$@_exec.jison
  # postprocess generated source code:
  #node ./$@_const_rewrite_postprocess.js ./$@_AST_symbols.json5 output/$@/$@_exec.js 
  node ./$@_const_rewrite_postprocess.js ./output/$@/$@_parse.js ./$@_OPA_defines.json5 output/$@/$@_exec.js 
  #node ./$@_const_rewrite_postprocess.js ./output/$@/$@_parse.js output/$@/$@_exec.js 
  #node ./$@_const_rewrite_postprocess.js ./$@_OPA_defines.json5 output/$@/$@_exec.js 
  # and run it!
  node output/$@/$@_exec.js $@_input.txt



*/
