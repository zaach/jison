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
        { $$ = $X + 'B:' + $BUGGY + 'E:' + $EOF; }
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
    var rv;

    try {
      rv = parser.parse("x<<EOF>>x");
      console.log("test 1: x<<EOF>>x input:\n\n  x<<EOF>>x ==> ", rv);
    } catch (ex) {
      rv = ex;
      console.log("test 1: x<<EOF>>x input threw exception:\n\n  x<<EOF>>x ==> ", rv.message);
    }

    try {
      rv = parser.parse("x");
      console.log("test 2: x input:\n\n  x ==> ", rv);
    } catch (ex) {
      rv = ex;
      console.log("test 2: x input threw exception:\n\n  x ==> ", rv);
    }

    assert.equal(rv, "xB:E:");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

