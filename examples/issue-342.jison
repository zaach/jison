
//%options on-demand-lookahead    // camelCased: option.onDemandLookahead



%lex

%%

\s+                   /* skip whitespace */
a                     return 'ID';
';'                   return ';';
.                     return 'ERROR';

/lex




%token ID

%%

stmt
    : type ID ';'
        { $$ = 'V' + $type + ':' + $ID; }
    | expr ';'
        { $$ = 'X' + $expr; }
    ;

type
    : ID
        { $$ = 'T'; }
    ;

expr
    : ID
        { $$ = 'E'; }
    ;

%%

// feature of the GH fork: specify your own main.
//
// compile with
// 
//      jison -o test.js --main that/will/be/me.jison
//
// then run
//
//      node ./test.js
//
// to see the output.

var assert = require("assert");

parser.main = function () {
    var rv = parser.parse('aa;');
    console.log("test #1: 'aa;' ==> ", rv);
    assert.equal(rv, 'VT:a');

    rv = parser.parse('a;');
    console.log("test #2: 'a;' ==> ", rv);
    assert.equal(rv, 'XE');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

