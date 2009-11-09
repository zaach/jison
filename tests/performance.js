#!/usr/bin/env narwhal

var JSParse = require("./setup").JSParse;

var i = 100;

  var grammer = {
    tokens: [ "x", "+", "*", "EOF" ],
    startSymbol: "S",
    operators: [
                ["left", "+"],
                ["left", "*"]
                ],
    bnf: {
            "S" :[ "E EOF" ],
            "E" :[ "E T" ],
            "T" :[ "G" ],
            "G" :[ "x | + | *" ]
          }
  };

for(var j=0;j<i;j++){
  var Parser = new JSParse.Parser(grammer);
  //var r = Parser.parse(['x','*','x','+','x','EOF']);
}
