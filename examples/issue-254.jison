
%ebnf

%lex

%%
\s+                   /* skip whitespace */
[a-zA-Z]+             return 'IDENTIFIER';
"("                   return '(';
")"                   return ')';
","                   return ',';
\w+                   return 'WORD';


/lex

%start function_call

%%

function_call
    : IDENTIFIER ("(" (expression[e1] ("," expression[e2])* )? ")")
        {
            console.log($1);
            console.log($3);
            console.log($e1);
            $$ = $IDENTIFIER + ':' + $e1;
            try {
                if ($5) {
                    console.log($5);
                }
                if ($e2) {
                    console.log($e2);
                }
                $$ += ':' + $e2;
            } catch (e) {
                console.log("exception");
            }
        }
    ;

expression
    : WORD
    | IDENTIFIER
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
    var rv = parser.parse("a(b, c)");
    console.log("a(b, c) ==> ", rv);
    var rv = parser.parse("a(b)");
    console.log("a(b) ==> ", rv);

    assert.equal(rv, "a(a(a))");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

