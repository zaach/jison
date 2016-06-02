//
// parse the left-recursive grammar:
//
//     A → αAB; α → ε
//

%lex

%%

\s+                 /* whitespace */
[a-zA-Z]+           return 'ID';
\"[^\"\n]*\"        return 'STR';
"("                 return '(';
")"                 return ')';
"["                 return '[';
"]"                 return ']';
","                 return ',';
<<EOF>>             return 'EOF';

/lex


%%

A
	: B 						{$$ = [$B];}
	;

α
	: ε 							{$$ = 'αε';}
	;

B
	: ID
	;


// ----------------------------------------------------------------------------------------

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
    var rv = parser.parse('ab');
    console.log("ab ==> ", rv);
    assert.equal(rv, ["a", ["b"]]);


    // if you get past the assert(), you're good.
    console.log("tested OK");
};

