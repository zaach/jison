/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
x                     return 'x'
y                     return 'y'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */

%start A


%% /* language grammar */


A : x A
  | B    %{ return @B; %}
  | %empty
  ;

B : y
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
    var rv = parser.parse('xxxy');
    console.log("test #1: 'xxxy' ==> ", rv, parser.yy);
    assert.deepStrictEqual(rv, {
      first_column: 3,
      first_line: 1,
      last_column: 4,
      last_line: 1,
      range: [
        3,
        4
      ]
    });

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

