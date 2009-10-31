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
