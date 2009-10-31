#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;

QUnit.module("Simple LR parsing", {
  setup: function(){
  }
});

test("left-recursive nullable grammer", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'A x',
                   ''      ]
          }
  };

  var Parser = new JSParse.Parser(grammer, {type: "slr"});
  print(uneval(Parser.table));

  ok(Parser.parse(['x','x','x']), "parse 3 x's");
  ok(Parser.parse(["x"]), "parse single x");
  var thrown = false;
  try{
    Parser.parse(["PLUS"]);
  }catch(e){
    thrown = true;
  }
  ok(thrown, "throws parse error on invalid");
  ok(Parser.conflicts == 0, "no conflicts");
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
  print(uneval(Parser.table));

  ok(Parser.parse(['x','x','x']), "parse 3 x's");
  ok(Parser.table.length == 4, "table has 4 states");
  ok(Parser.conflicts == 0, "no conflicts");
});
