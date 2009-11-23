var Jison = require("../setup").Jison,
    Lex = require("../setup").Lex,
    assert = require("assert");

exports["test left-recursive nullable grammer"] = function() {

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'A x',
                   ''      ]
          }
  };

  var Parser = new Jison.Parser(grammer, {type: "lr0"});

  assert.ok(Parser.parse(['x','x','x']), "parse 3 x's");
  assert.ok(Parser.parse(["x"]),         "parse single x");
  assert.throws(function(){Parser.parse(["PLUS"])},  "throws parse error on unrecognized");
};

exports["test right-recursive nullable grammer"] = function() {

  var grammer = {
    tokens: [ 'x' ],
    startSymbol: "A",
    bnf: {
            "A" :[ 'x A',
                   ''      ]
          }
  };

  var Parser = new Jison.Parser(grammer, {type: "lr0"});

  assert.ok(Parser.table.length == 4, "table has 4 states");
  assert.ok(Parser.conflicts == 2, "encountered 2 conflicts");
};
