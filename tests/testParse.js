#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;

QUnit.module("LR parsing", {
  setup: function(){
  }
});

test("0+0 grammer", function(){

  var grammer = {
    tokens: [ "ZERO", "PLUS"],
    startSymbol: "E",
    bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  ok(Parser.parse(["ZERO", "PLUS", "ZERO", "PLUS", "ZERO"]), "parse");
  ok(Parser.parse(["ZERO"]), "parse single 0");
  var thrown = false;
  try{
    Parser.parse(["PLUS"]);
  }catch(e){
    thrown = true;
  }
  ok(thrown, "throws parse error on invalid");
});

test("xx nullable grammer", function(){

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'A x',
                   ''      ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  ok(Parser.parse(['x','x','x']), "parse");
  ok(Parser.parse(["x"]), "parse single x");
  var thrown = false;
  try{
    Parser.parse(["PLUS"]);
  }catch(e){
    thrown = true;
  }
  ok(thrown, "throws parse error on invalid");
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

test("LR parse", function(){
  var grammer = {
    tokens: [ "ZERO", "PLUS"],
    startSymbol: "E",
    bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
          }
  };
  var Parser = new JSParse.Parser(grammer, {type: "lr"});

  ok(Parser.parse(["ZERO", "PLUS", "ZERO", "PLUS", "ZERO"]), "parse");
});
