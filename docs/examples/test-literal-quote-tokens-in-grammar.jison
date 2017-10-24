//
// Show that quote tokens, even the edge cases, are properly handled by
// jison these days!
//

%lex

%%

"'"                   {
                        parser.push_marker('qS');
                        return "'";
                      }

'"'                   {
                        parser.push_marker('qD');
                        return '"';
                      }

/*

"'\""                 {
                        parser.push_marker('q2Sd');
                        return "'\"";
                      }

"\"'"                 {
                        parser.push_marker('q2Ds');
                        return "\"'";
                      }

*/

"\\"                  {
                        parser.push_marker('Bs');
                        return "\\";
                      }

\s+                   {
                        parser.push_marker('_');
                        /* skip whitespace */
                      }

[^\s\'\"]+            {
                        parser.push_marker('w');
                        return 'WORD';
                      }

/lex

%token WORD

%start expressions

%%

e
    : word[e1] e[e2]
        { $$ = parser.pop_all_markers() + ' ' + $e1 + ' ( ' + $e2 + ' )'; }
    | word
        { $$ = parser.pop_all_markers() + $word; }
    ;

word
    : WORD
        { $$ = parser.pop_all_markers() + $WORD; }
    | '"'[q]  WORD  "\""[e]
        { $$ = parser.pop_all_markers() + 'DQ:' + $q + $WORD + $e; }
    | "'"[q]  WORD  '\''[e]
        { $$ = parser.pop_all_markers() + 'SQ:' + $q + $WORD + $e; }
//    | "'\""[q]  WORD  '\'\"'[e]
//        { $$ = parser.pop_all_markers() + '2Qsd:' + $q + $WORD + $e; }
//    | '"\''[q]  WORD  "\"\'"[e]
//        { $$ = parser.pop_all_markers() + '2Qds:' + $q + $WORD + $e; }
    | '\\'[q]  WORD  "\\"[e]
        { $$ = parser.pop_all_markers() + 'Bs:' + $q + $WORD + $e; }
    ;

expressions
    : e
        { $$ = parser.pop_all_markers() + $e; }
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

    assert.equal(rv, " wa ( _wa )");

    rv = parser.parse("a a a");
    console.log("\n\n  a a a ==> ", rv);

    assert.equal(rv, " wa (  _wa ( _wa ) )");
    // read as:
    // - reduce epsilon,
    // - reduce epsilon,
    // - fetch lexer tokens while shifting until we match `e: WORD`
    // - now fetch/shift/reduce until done...
    //
    // if you get past the assert(), you're good.
    console.log("tested OK");
};

