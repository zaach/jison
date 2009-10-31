#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;
var same = QUnit.same;

QUnit.module("Test Semantic Actions and AST building", {
  setup: function(){
  }
});

test("Semantic action basic return", function(){

  var grammer = {
    tokens: [ "x", "y" ],
    startSymbol: "E",
    bnf: {
            "E"   :[ ["E x", "return 0"],
                     ["E y", "return 1"],
                     "" ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  equals(Parser.parse(['x']), 0, "semantic action");
  equals(Parser.parse(['y']), 1, "semantic action");
});

test("Semantic action stack lookup", function(){

  var grammer = {
    tokens: [ "x", "y" ],
    startSymbol: "pgm",
    bnf: {
            "pgm" :[ ["E", "return $1"] ],
            "E"   :[ ["B E", "return $1+$2"],
                      ["x", "$$ = 'EX'"] ],
            "B"   :[ ["y", "$$ = 'BY'"] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  equals(Parser.parse(['x']), "EX", "return first token");
  equals(Parser.parse(['y','x']), "BYEX", "return first after reduction");
});

test("Semantic actions on nullable grammer", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "S",
    bnf: {
            "S" :[ ["A", "return $1"] ],
            "A" :[ ['x A', "$$ = $2+'x'" ],
                   ['', "$$ = '->'" ] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  equals(Parser.parse(['x','x']), "->xx", "return first after reduction");
});

test("Build AST", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "S",
    bnf: {
            "S" :[ ['A', "return $1;" ] ],
            "A" :[ ['x A', "$2.push(['ID',{value:'x'}]);\
                            $$ = $2;"],
                   ['', "$$ = ['A',{}];"] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);
  var expectedAST = ['A',{},
                      ['ID',{value:'x'}],
                      ['ID',{value:'x'}],
                      ['ID',{value:'x'}]];

  var r = Parser.parse(['x','x','x']);
  same(r, expectedAST);
});

