//
// Show that jison reports any rules which are reachable from the start
// rule, i.e. will be *unused* in the generated parser/grammar!
//

%lex

%%
\s+                   {
                        /* skip whitespace */
                      }

\w+                   {
                        return 'WORD';
                      }

/lex

%token WORD

%start expressions

%%

e
    : WORD
    ;

epsilon:
    ε
        { $$ = 'ε'; }
    ;

expressions
    : epsilon[a] epsilon[b] e epsilon[c] 
        { $$ = $a + $b + $e + $c; }
    ;

unused_rule_1
    : epsilon WORD WORD
    ;

unused_rule_2
    : expressions WORD
    ;

unused_rule_3
    : e WORD
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
    var rv = parser.parse("a");
    console.log("(reduce epsilon rules as early as possible)\n\n  a ==> ", rv);

    assert.equal(rv, "εεaε");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

