%lex

%%
\s+                   /* skip whitespace */
\w+                   return 'WORD';

/lex

// The Bad Precedence Hack
//
// The trick is to specify an extra token for precedence, because precedence is *relative*, i.e.
// compared to *another* token, so you need at least *two* of them:
%left HACK

%left WORD

%start expressions

%%
e
    : e[e1] e[e2]                                 %prec HACK
        { $$ = $e1 + '(' + $e2 + ')'; }
    | WORD
        { $$ = $WORD; }
    ;

expressions
    : e
        { return $e; }
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
    var rv = parser.parse("a a a");
    console.log("(bad hack in grammar to resolve ambiguity)\n\n  tripple A ==> ", rv);

    assert.equal(rv, "a(a(a))");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

