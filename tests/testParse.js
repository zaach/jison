#!/usr/bin/env narwhal

var JSParse = require("../parse").JSParse;

var QUnit = require("qunit").QUnit;
var test = require("qunit").test;
var ok = require("qunit").ok;
var equals = require("qunit").equals;

QUnit.log = function (r, msg){
  print('  ',r, msg);
};
QUnit.done = function (fails, total){
  print('failures:',fails,', total:', total);
};
QUnit.moduleStart = print;
QUnit.testStart = print;

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
    startSymbol: "pgm",
    bnf: {
            "pgm" :[ ["E", "return 0"] ],
            "E"   :[ ["E x", "return 1"],
                     "y" ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  equals(Parser.parse(['y']), 0, "semantic action");
  equals(Parser.parse(['y','x']), 1, "semantic action");
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
