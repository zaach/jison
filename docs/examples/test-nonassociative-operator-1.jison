//
// `%nonassoc` is not playing a role (i.e. is DISREGARDED) because the rules as such already are unambiguous 
// (and happen to specify a *right-associative treatment* instead!)
//
// This example serves as a lesson about writing (LA)LR grammars without regard for the intricacies of the
// (LA)LR system.
//
//
// This example is identical to test-nonassociative-operator-2 except now we encode the '=' rule as
// *right associative* instead!
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

"="                   {
                        parser.push_marker('o');
                        return '=';
                      }

/lex

%nonassoc '='
%token WORD

%start expressions

%%

e
    : WORD[e1] '='[eq] e[e2]
        { $$ = parser.pop_all_markers() + ' ' + $e1 + ' :' + $eq + ' ( ' + $e2 + ' )'; }
    | WORD
        { $$ = parser.pop_all_markers() + $WORD; }
    | WORD[e1] error e[e2]
        { $$ = parser.pop_all_markers() + $e1 + ' ERR2: ' + $error + ' CONT: ' + $e2; }
    | error
        { $$ = parser.pop_all_markers() + ' ERR1: ' + $error; }
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
    var rv = parser.parse("a = a");
    console.log("(reduce epsilon rules as early as possible)\n\n  a = a ==> ", rv);

    assert.equal(rv, "εε a := ( w_o_wa )");

    rv = parser.parse("a = a = a");
    console.log("\n\n  a = a = a ==> ", rv);

    assert.equal(rv, "εε a := (  a := ( w_o_w_o_wa ) )");
    // read as:
    // - reduce epsilon,
    // - reduce epsilon,
    // - fetch lexer tokens while shifting until we match `e: WORD`
    // - now reduce until done as we've got all the look-ahead we need
    //   to reduce all shifted tokens! 

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

