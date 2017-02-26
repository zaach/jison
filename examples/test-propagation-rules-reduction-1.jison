//
// Show that jison optimizes out any rules which do nothing but
// 'propagate' another rule, e.g. a rule like
//
//   A : B ;
//
// should not add additional parser states, because a match on B
// (and its consequent reduction) immediately implies a match on A
// (and the consequent reduction of A), where the "reduction of A"
// is really a no-op or rather a (default) action of:
//
//   $A = $B; @A = @B;
//
// (Note: this is not true when the 'default action' of `$$ = $1` is
// turned OFF via grammar options!)
//

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

// a 'transport rule' which is a optimization candidate as it does
// nothing in terms of useful parser state activity.
e
    : WORD
    ;

// and this really is another candidate as it's yet another 'transport rule'
// of the form `A: B;`, only this time we have an explicit action block.
w
    : e
        { $$ = $e; }
    ;

r
    : w
    ;

s
    : r
    ;

// this one *looks* like it's yet another candidate for optimization, but
// this rule is special in that it's the *start* rule and therefor has
// a definite, *non-nil*, part to play in the parser state activity.
//
// However, one ultimately could pull up the action code in the `w` rule
// above and apply it here as the grammar would remain identical to the
// non-optimized grammar.
expressions
    : s
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
    console.log("a ==> ", rv);

    assert.equal(rv, "a");

    console.log("parser table lengths ==> ", {
        states: parser.table.length,
        default_actions: Object.keys(parser.defaultActions).length,
        productions: parser.productions_.length
    });

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

