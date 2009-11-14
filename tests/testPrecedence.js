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

test("Non-associative operator", function(){

  var grammer = {
    tokens: [ "x", "=", "EOF" ],
    startSymbol: "S",
    operators: [
                ["nonassoc", "="]
                ],
    bnf: {
            "S" :[ "E EOF" ],
            "E" :[ "E = E",
                   "x" ]
          }
  };

  var Parser = new JSParse.Parser(grammer);

  var thrown = false;
  try{
      Parser.parse(['x','=','x','=','x','EOF']);
  }catch(e){
    thrown = true;
  }
  ok(thrown, "throws parse error when operator used twice.");
  ok(Parser.parse(['x','=','x','EOF']), "normal use is okay.");
});

test("Context-dependent precedence", function(){

  var grammer = {
    tokens: [ "x", "-", "+", "*", "EOF" ],
    startSymbol: "S",
    operators: [
                ["left", "-", "+"],
                ["left", "*"],
                ["left", "UMINUS"]
                ],
    bnf: {
            "S" :[ [ "E EOF",   "return $1;"       ] ],
            "E" :[ [ "E - E",   "$$ = [$1,'-', $3];" ],
                   [ "E + E",   "$$ = [$1,'+', $3];" ],
                   [ "E * E",   "$$ = [$1,'*', $3];" ],
                   [ "- E",     "$$ = ['#', $2];", {prec: "UMINUS"} ],
                   [ "x",       "$$ = ['x'];"         ] ]
          }
  };

  var Parser = new JSParse.Parser(grammer);
  var expectedAST = [[[["#", ["x"]], "*", ["#", ["x"]]], "*", ["x"]], "-", ["x"]];

  var r = Parser.parse(['-','x','*','-','x','*','x','-','x','EOF']);
  same(r, expectedAST);
});
