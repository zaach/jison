// 'Klammergebirge' sample LR grammar from Heilbrunner, 1995

%lex

%%

\s+                 /* whitespace */
"<"                 return '<';
">"                 return '>';
<<EOF>>             return 'EOF';

/lex



%start S

%%

S   :   A 
    ;

A   :   B 
    |   A B                 -> $A + $B 
    ;

B   :   '<' '>'             -> '.'
    |   '<' A '>'           -> '+' + $A + ($A.indexOf('.') === -1 ? '' : '_')
    ;




// ----------------------------------------------------------------------------------------

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
    var rv = parser.parse('<<<><><>><>><>');
    console.log("<<<><><>><>><> ==> ", rv);
    assert.equal(rv, '++..._._.');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

