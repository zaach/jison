#!/usr/bin/env narwhal

// TODO: ...should probably have some real performance tests.

var Jison = require("./setup").Jison;

var i = 1;

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

for (var j=0;j<i;j++) {
  var parser = new Jison.Parser(grammer, {type: 'slr'});
  //var r = parser.parse(['x','*','x','+','x','EOF']);
}
