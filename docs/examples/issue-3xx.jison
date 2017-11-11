// Test if we support any 'literal whitespace token' in the grammar; 
// vanilla jison does not, or at least incorrectly as it doesn't quote 
// the space again when rewriting the grammar rules!

%ebnf

%lex

%%
\s+                   return ' ';
[a-zA-Z]+             return 'IDENTIFIER';
"("                   return '(';
")"                   return ')';
","                   return ',';
\w+                   return 'WORD';


/lex

%start test

%%

test
    : function_call
        {
            //console.log("result: ", $function_call);
            return $function_call;
        }
    ;


function_call
    : IDENTIFIER  "("[lb]  " "  (expression[e1]  (","  " "  expression[e2])* )?[args]  " "  ")"[rb]
        {
            console.log($1);
            console.log($4);
            // unreachable; injected a dot to prevent the action inspector from still seeing this one: 
            //console.log($.e1);
            //$$ = $IDENTIFIER + ':' + $.e1;
            //try {
            //    if ($.7) {
            //        console.log($.7);
            //    }
            //    if ($.e2) {
            //        console.log($.e2);
            //    }
            //    $$ += ':' + $.e2;
            //} catch (e) {
            //    console.log("exception");
            //}

            // new code:
            //
            //   IDENTIFIER "(" ' ' q_container ' ' ")"
            //       1       2   3       4       5   6     
            $$ = $IDENTIFIER + ':' + $lb + JSON.stringify($args) + '@' + JSON.stringify(@args) + $rb);
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
    assert.equal(rv, "a:([\"b\",[[\",\",\"c\"]]])");

    var rv = parser.parse("a(b)");
    console.log("a(b) ==> ", rv);
    assert.equal(rv, "a:([\"b\",[]])");


    // if you get past the assert(), you're good.
    console.log("tested OK");
};

