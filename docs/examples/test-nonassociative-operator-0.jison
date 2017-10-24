//
// `%nonassoc` is playing a role because the rules as such are unambiguous. Compare this example with
// the other two of the same name (but numbered '-1' and '-2') to see the impact of only 'minimal' changes
// to this grammar!
//
// This example serves as a lesson about writing (LA)LR grammars without regard for the intricacies of the
// (LA)LR system: note where `%nonassoc` marks the input `a=a=a` as illegal!
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
    : e[e1] '='[eq] e[e2]
        { $$ = parser.pop_all_markers() + ' ' + $e1 + ' :' + $eq + ' ( ' + $e2 + ' )'; }
    | WORD
        { $$ = parser.pop_all_markers() + $WORD; }
    | e error e
        { $$ = parser.pop_all_markers() + $e1 + ' ERR2: ' + $error.value + ' CONT: ' + $e2; }
    | error
        { $$ = parser.pop_all_markers() + ' ERR1: ' + $error.value; }
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

    assert.equal(rv, "εε wa := ( _o_wa )");

    rv = parser.parse("a = a = a");
    console.log("\n\n  a = a = a ==> ", rv);

    assert.equal(rv, "εε wa := ( _o_wa ERR2: = CONT: _o_wa )");
    // read as:
    // - reduce epsilon,
    // - reduce epsilon,
    // - fetch lexer tokens while shifting until we match `e: WORD`
    // - now fetch/shift/reduce until done, but ho!!! Kick up a ruckus 
    //   because we run into that second (associative) '=' operator that
    //   shouldn't have been there. We find it as the look-ahead for the 
    //   next rule match so we loose the preceeding 'a' as well...
    //
    //   (That's why I've added that extra `WORD error` rule! Getting a tighter error match there!)

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

