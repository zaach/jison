//
// Show that epsilon rules at the start of a grammar can be evaluated *before*
// *any* lexer token is fetched!
//

%lex

%%
\s+                   {
                        parser.push_marker('_');
                        /* skip whitespace */
                      }

\w+                   {
                        parser.push_marker('w');
                        return 'WORD';
                      }

/lex

%token WORD

%start expressions

%%

e
    : WORD[e1] epsilon e[e2]
        { $$ = parser.pop_all_markers() + ' ' + $e1 + ' :' + $epsilon + ' ( ' + $e2 + ' )'; }
    | WORD
        { $$ = parser.pop_all_markers() + $WORD; }
    ;

epsilon:
    ε
        { $$ = parser.pop_all_markers() + 'ε'; }
    ;

expressions
    : epsilon[a] epsilon[b] e
        { $$ = parser.pop_all_markers() + $a + $b + $e; }
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

parser.lex_markers = '';

parser.push_marker = function (m) {
    parser.lex_markers += (m || '*');
};

parser.pop_all_markers = function () {
    var rv = parser.lex_markers;
    parser.lex_markers = '';
    return rv;
};

parser.main = function () {
    var rv = parser.parse("a a");
    console.log("(reduce epsilon rules as early as possible)\n\n  a a ==> ", rv);

    assert.equal(rv, "εε a :w_wε ( a )");

    rv = parser.parse("a a a");
    console.log("\n\n  a a a ==> ", rv);

    assert.equal(rv, "εε a :w_wε (  a :_wε ( a ) )");
    // read as:
    // - reduce epsilon,
    // - reduce epsilon,
    // - fetch lexer tokens while shifting until we match `e: WORD`
    // - now fetch/shift/reduce until done...
    //
    // if you get past the assert(), you're good.
    console.log("tested OK");
};

