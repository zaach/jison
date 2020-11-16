/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
"constructor"         return 'constructor'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */

%start expressions

%% /* language grammar */

expressions
    :  "constructor" EOF
        {return "constructor";}
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
    var rv = parser.parse('constructor');
    console.log("test #1: 'constructor' ==> ", rv, parser.yy);
    assert.equal(rv, 'constructor');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

