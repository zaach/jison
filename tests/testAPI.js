#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;

QUnit.module("Test API", {
  setup: function(){
  }
});

test("tokens as a string", function(){

  var grammer = {
    tokens: "x y",
    startSymbol: "A",
    bnf: {
            "A" :[ 'A x',
                   'A y',
                   ''      ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  ok(Parser.parse(['x','y','x']), "parse 3 x's");
});

test(" | seperated rules", function(){

  var grammer = {
    tokens: "x y",
    startSymbol: "A",
    bnf: {
            "A" :"A x | A y | "
          }
  };

  var Parser = new JSParse.Parser(grammer);

  ok(Parser.parse(['x','y','x']), "parse 3 x's");
});

test("start symbol should be nonterminal", function(){

  var grammer = {
    tokens: "x y",
    startSymbol: "x",
    bnf: {
            "A" :"A x | A y | "
          }
  };

  var thrown = false;
  try{
    var Parser = new JSParse.Parser(grammer);
  }catch(e){
    thrown = true;
  }
  ok(thrown, "throws error");
});
