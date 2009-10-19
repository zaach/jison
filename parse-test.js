load('assert.js');
load('parse.js');

var grammer = {
  tokens: [ 'ZERO', 'PLUS'],
  startSymbol: 'E',
  bnf: {
          "E" :[ 'E PLUS T',
                 'T'      ],
          "T" :[ 'ZERO' ]
        }
};

var tokenStream = ['ZERO', 'PLUS', 'ZERO', 'PLUS', 'ZERO'];

var Parser = new JSParse.Parser(grammer);

assert.equal(4,Parser.rules.size());
assert.equal(2,Parser._nonterms['E'].rules.size());
assert.equal("E",Parser.startSymbol);
assert.equal("$end",Parser.EOF);
print(Parser.parse(tokenStream));

//print(Parser.terminals('S'));

//Parser.test();

//Parser.parse(tokenStream);

var grammer2 = {
  tokens: [ 'x', "y" ],
  startSymbol: "A",
  bnf: {
          "A" :[ 'A x',
                 ''      ]
        }
};

var tokenStream2 = ['x','x','x'];

var Parser2 = new JSParse.Parser(grammer2);

//assert.equal(5,Parser2.rules.size());
//assert.equal(2,Parser2._nonterms['A'].length);

//Parser2.test();

//Parser2.parse(tokenStream2);
//print(Parser2.nullableSets());
//print(Parser2.firstSets());
//print(Parser2.followSets());

var grammer3 = {
  tokens: [ 'a', "b", "c", 'ENDOFFILE' ],
  bnf: {
          "S" :[ 'T ENDOFFILE' ],
          "T" :[ "R",
                 "aTc"
               ],
          "R" :[ '',
                 'RbR'      ]
        }
};


assert.done();
