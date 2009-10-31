#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;
var same = QUnit.same;

QUnit.module("Test AST building", {
  setup: function(){
  }
});

test("left-recursive nullable grammer", function(){

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

