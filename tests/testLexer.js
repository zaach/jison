#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;
var JSLex = require("./setup").JSLex;
var QUnit = require("./setup").QUnit;

var test = QUnit.test;
var ok = QUnit.ok;
var equals = QUnit.equals;
var same = QUnit.same;

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


