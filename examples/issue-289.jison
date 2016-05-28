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

// value
//     : STR                           {$$ = eval($1);}
//     | '[' ']'                       {$$ = [];}
//     | '[' values ']'                {$$ = $2;}
//     | id '(' ')'                    {$$ = [$1, []]; }
//     | id '(' values ')'             {$$ = [$1, $3];}
// ;

value : a1 | a5 ;

a1    : STR                           {$$ = eval($1);}
|  STR '(' values ')'            {$$ = [$1, $3];}
;

a2 : '[' ']'                       {$$ = [];}
;

a3 : '[' values ']'                {$$ = $2;}
;

a4 :  id '(' ')'                    {$$ = [$1, []]; }
;

a5 :  id '(' values ')'             {$$ = [$1, $3];}
;

id
    : ID                            {$$ = $1;}
;

id2
    : STR                           {$$ = eval($1);}
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

