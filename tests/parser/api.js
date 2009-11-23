var Jison = require("../setup").Jison,
    Lex = require("../setup").Lex,
    assert = require("assert");

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

  var Parser = new Jison.Parser(grammer);

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

  var Parser = new Jison.Parser(grammer);

  ok(Parser.parse(['x','y','x']), "parse 3 x's");
});

test("start symbol optional", function(){

  var grammer = {
    tokens: "x y",
    bnf: {
            "A" :"A x | A y | "
          }
  };

  var thrown = false;
  try{
    var Parser = new Jison.Parser(grammer);
  }catch(e){
    thrown = true;
  }
  ok(!thrown, "no error");
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
    var Parser = new Jison.Parser(grammer);
  }catch(e){
    thrown = true;
  }
  ok(thrown, "throws error");
});

test("Test terminal list", function(){

  var grammer = {
    tokens: "x y",
    startSymbol: "A",
    bnf: {
            "A" :"A x | A y | "
          }
  };

    var Parser = new Jison.Parser(grammer);
    same(Parser.terminals, ["$end", "x", "y"]);
});

