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

%left WORD

%start expressions

%%

e
    : WORD[e1] epsilon e[e2]
        { $$ = parser.pop_all_markers() + $e1 + ':' + $epsilon + '(' + $e2 + ')'; }
    | WORD
        { $$ = parser.pop_all_markers() + $WORD; }
    ;

epsilon:
    ε
        { $$ = parser.pop_all_markers() + 'x'; }
    ;

expressions
    : epsilon[a] epsilon[b] e
        { $$ = $a + $b + $e; }
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
    var rv = parser.parse("a a a");
    console.log("(reduce epsilon rules as early as possible)\n\n  tripple A ==> ", rv);

    assert.equal(rv, "wxxa:_wx(a):_wx(a:_wx(a))");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

