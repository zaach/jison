//
// Show that jison lexer will recognize the <<EOF>> as a special 
// language token rather than a string literal.
//

%lex

%%

'x'         return 'X';

<<EOF>>     return 'BUGGY';

.           return yytext;

/lex

%start expressions

%%

expressions
    : X BUGGY EOF
        { $$ = $X + $BUGGY + $EOF; }
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
    var rv = parser.parse("x<<EOF>>x");
    console.log("test 1: x<<EOF>>x input:\n\n  x<<EOF>>x ==> ", rv);

    assert.equal(rv, "εεaε");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

