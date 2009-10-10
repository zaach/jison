load('assert.js');
load('parse.js');

var grammer = {
  tokens: [ 'ZERO', 'PLUS', 'ENDOFFILE' ],
  bnf: {
          "S" :[ 'E ENDOFFILE' ],
          "E" :[ 'E PLUS T',
                 'T'      ],
          "T" :[ 'ZERO' ]
        }
};

var tokenStream = ['ZERO', 'PLUS', 'ZERO', 'PLUS', 'ZERO', 'ENDOFFILE'];

var Parser = new JSParse.Parser(grammer);

assert.equal(4,Parser.rules.size());
assert.equal(2,Parser._nonterms['E'].length);
assert.equal("S",Parser.startSymbol);
assert.equal("ENDOFFILE",Parser.EOF);

Parser.parse(tokenStream);

var grammer2 = {
  tokens: [ 'X', 'ENDOFFILE' ],
  bnf: {
          "S" :[ 'A ENDOFFILE' ],
          "A" :[ 'A x',
                 ''      ]
        }
};

var tokenStream2 = ['x','x','x', 'ENDOFFILE'];

var Parser2 = new JSParse.Parser(grammer2);

assert.equal(3,Parser2.rules.size());
assert.equal(2,Parser2._nonterms['A'].length);

Parser2.parse(tokenStream2);

assert.done();
