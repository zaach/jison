#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;
var same = QUnit.same;

QUnit.module("Simple LR parsing", {
  setup: function(){
  }
});

test("right-recursive nullable grammer", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'x A',
                   ''      ]
          }
  };

  var Parser = new JSParse.Parser(grammer, {type: "slr"});

  equals(Parser.table.length, 4, "table has 4 states");
  equals(Parser.nonterms['A'].nullable, true, "A is nullable");
  equals(Parser.conflicts, 0, "should have no conflict");
});

test("LL prase table", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'x A',
                   ''      ]
          }
  };

  var Parser = new JSParse.Parser(grammer, {type: "ll"});

  same(Parser.table, {$accept:{x:[0], $end:[0]}, A:{x:[1], $end:[2]}}, "ll table has 2 states");
});

test("LL prase table with conflict", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "L",
    bnf: {
            "L" :[ 'T L T',
                   ''      ],
            "T" :[ "x" ]
          }
  };

  var Parser = new JSParse.Parser(grammer, {type: "ll"});
  equals(Parser.conflicts, 1, "should have 1 conflict");
});

test("Ambigous grammer", function(){

  var grammer = {
    tokens: [ 'x', 'y' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'A B A',
                   'x'      ],
            "B" :[ '',
                   'y'      ]
          }
  };

  var Parser = new JSParse.Parser(grammer, {type: "lr"});
  equals(Parser.conflicts, 2, "should have 2 conflict");
});
