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

test("Left associative rule", function(){

  var grammer = {
    tokens: [ "x", "+", "EOF" ],
    startSymbol: "S",
    operators: [
                ["left", "+"]
                ],
    bnf: {
            "S" :[ [ 'E EOF',   "return $1;" ] ],
            "E" :[ [ "E + E",   "$$ = ['+', $1, $3];" ],
                   [ "x",       "$$ = ['x'];"] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);
  var expectedAST = ["+", ["+", ["x"], ["x"]], ["x"]];

  var r = Parser.parse(['x','+','x','+','x','EOF']);
  same(r, expectedAST);
});

test("Right associative rule", function(){

  var grammer = {
    tokens: [ "x", "+", "EOF" ],
    startSymbol: "S",
    operators: [
                ["right", "+"]
                ],
    bnf: {
            "S" :[ [ "E EOF",   "return $1;"          ] ],
            "E" :[ [ "E + E",   "$$ = ['+', $1, $3];" ],
                   [ "x",       "$$ = ['x'];"         ] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);
  var expectedAST = ["+", ["x"], ["+", ["x"], ["x"]]];

  var r = Parser.parse(['x','+','x','+','x','EOF']);
  same(r, expectedAST);
});

test("Multiple precedence operators", function(){

  var grammer = {
    tokens: [ "x", "+", "*", "EOF" ],
    startSymbol: "S",
    operators: [
                ["left", "+"],
                ["left", "*"]
                ],
    bnf: {
            "S" :[ [ "E EOF",   "return $1;"          ] ],
            "E" :[ [ "E + E",   "$$ = ['+', $1, $3];" ],
                   [ "E * E",   "$$ = ['*', $1, $3];" ],
                   [ "x",       "$$ = ['x'];"         ] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);
  var expectedAST = ["+", ["*", ["x"], ["x"]], ["x"]];

  var r = Parser.parse(['x','*','x','+','x','EOF']);
  same(r, expectedAST);
});

test("Multiple precedence operators", function(){

  var grammer = {
    tokens: [ "x", "+", "*", "EOF" ],
    startSymbol: "S",
    operators: [
                ["left", "+"],
                ["left", "*"]
                ],
    bnf: {
            "S" :[ [ "E EOF",   "return $1;"          ] ],
            "E" :[ [ "E + E",   "$$ = [$1,'+', $3];" ],
                   [ "E * E",   "$$ = [$1, '*', $3];" ],
                   [ "x",       "$$ = ['x'];"         ] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);
  var expectedAST = [["x"], "+", [["x"], "*", ["x"]]];

  var r = Parser.parse(['x','+','x','*','x','EOF']);
  same(r, expectedAST);
});
