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
JSParse.parse(grammer, tokenStream);

assert.equal(2,2);
