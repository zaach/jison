//
// Show that jison reports any rules which are reachable from the start
// rule, i.e. will be *unused* in the generated parser/grammar!
//

// build options:
%options no-try-catch default-action-mode=none,none main


%lex

%%
\s+                   {
                        /* skip whitespace */
                      }

\w+                   {
                        return 'WORD';
                      }

/lex

%token WORD

%start expressions

%%

e
    : WORD
    ;

epsilon:
    ε
        { $$ = 'ε'; }
    ;

expressions
    : epsilon[a] epsilon[b] e epsilon[c] 
        { $$ = $a + $b + $e + $c; }
    ;

unused_rule_1
    : epsilon WORD WORD
        { $$ = $1 + $2 + $3; }
    ;

unused_rule_2
    : expressions WORD
        { $$ = $1 + $2; }
    ;

unused_rule_3
    : e WORD
        { $$ = $1 + $2; }
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
    var rv = parser.parse("a");

    //
    // BIG FAT WARNING:
    //
    // Due to `%options no-try-catch default-action-mode=none,none`, combined with the
    // *lack* of action code for the `e: WORD` grammar rule, *that* rule's
    // result `$$` will be UNDETERMINED, i.e. up for grabs, random, chaos.
    //
    // Since JISON commit 5f8e197e44b5d2526e7641c8511402c6675d25db this 
    // translates to any rule *without any action* to produce the
    // `undefined` value via the injected `$$ = undefined` action code, hence
    // the 'expected output' IS NOT `"εεaε"` but `"εεundefinedε"`! 
    //
    // Yes, *functionally* that's an ERROR/BUG for certain, but the
    // technicalities mentioned above make this the 'correct' output
    // anyway. The ACTUAL BUG in this grammar example is the `e: WORD` rule
    // **not having any action code assigning a value to `$$`** since that
    // is the only sane activity *everywhere* when you choose to compile
    // with `%options default-action-mode=none,none`.
    //
    // Aside: note that `%options no-try-catch default-action-mode=none,none` does
    // remove additional safeguards in the parser kernel code: this option
    // combo also causes code to be removed with sets `$0` and `$$` to
    // `undefined` *before* any rule's action code is executed so any
    // protection against grammar-coder mistakes such as this action code
    // chunk is removed in exchange for parser execution speed:
    //
    //     %{ $$ = Math.sin($$ /* BUG! NOT SANE TO USE `$$` or `$0` AS INPUT! */); %}
    //
    // *Caveat Emptor* i.e. when you choose Speed, you are expected to
    // be fully aware that Safety is Not An Option Any More(tm)!
    //

    console.log("(reduce epsilon rules as early as possible)\n\n  a ==> ", rv);

    assert.equal(rv, "εεundefinedε");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

