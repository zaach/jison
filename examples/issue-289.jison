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

%start value

%%

value
    : STR                           {$$ = $1;}
    | '[' ']'                       {$$ = [];}
    | '[' values ']'                {$$ = $2;}
    | id '(' ')'                    {$$ = [$1, []];}
    | id '(' values ')'             {$$ = [$1, $3];}
;

id
    : ID                            {$$ = $1;}
    | STR                           {$$ = $1;}
;

values
    : value                         {$$ = [$1];}
    | values ',' value              {$$ = $1; $$.push($3);}
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
    var rv = parser.parse('a(b)');
    console.log("a(b) ==> ", rv);
    assert.equal(rv, ["a", ["b"]]);


    // if you get past the assert(), you're good.
    console.log("tested OK");
};

