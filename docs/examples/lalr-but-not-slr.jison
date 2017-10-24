/*
ASU 4.39 

Show that the following grammar 

S → Aa | bAc | dc | bda 
A → a 

is LALR(1) but not SLR(1). 

Answer: In addition to the rules given above, one extra rule S' → S as 
the initial item. Following the procedures for constructing the LR(1) 
parser, here is the initial state and the resulting state diagram by 
taking closure:

Based on the state diagram, we derive the LR(1) parsing table as follows: 

State Action a b c d $ S A Goto 
s3 s4 acc s5 s7 s8 r5 s10 r3r2r4 r5s9 1 2 6 

Then, the LALR(1) parsing table can be obtained by merging items with 
common first components, In this problem


ASU 4.40 

Show that the following grammar 

S → Aa | bAc | Bc | bBa 
A → d 
B → d 

is LR(1) but not LALR(1).
*/


%lex

%%

\s+                 /* whitespace */
a                   return 'a';
b                   return 'b';
c                   return 'c';
d                   return 'd';
e                   return 'e';
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

S
    : A a                       {$$ = [$A, $a];}
    | b A c                     {$$ = [$b, $A, $c];}
    | d c                       {$$ = [$d, $c];}
    | b d a                     {$$ = [$b, $d, $a];}
    ;

A
    : a                         {$$ = 'A';}
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
    var rv = parser.parse('a a');
    console.log("#1 ==> ", rv);
    assert.deepEqual(rv, ["A", "a"]);

    rv = parser.parse('b a c');
    console.log("#2 ==> ", rv);
    assert.deepEqual(rv, ["b", "A", "c"]);

    rv = parser.parse('d c');
    console.log("#3 ==> ", rv);
    assert.deepEqual(rv, ["d", "c"]);

    rv = parser.parse('b d a');
    console.log("#4 ==> ", rv);
    assert.deepEqual(rv, ["b", "d", "a"]);

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

