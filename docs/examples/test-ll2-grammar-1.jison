/*
 * From "Modern Compiler Implementation in C":
 * 
 * > ### Exercise 3.7: 
 * > 
 * > a. Left-factor this grammar.
 * > 
 * > b. Show that the resulting grammar is LL(2). You can do this by constructing
 * >   FIRST sets (etc.) containing two-symbol strings; but it is simpler to construct an LL(1)
 * >   parsing table and then argue convincingly that any conflicts can be resolved by
 * >   looking ahead one more symbol. 
 * > c. Show how the tok variable and advance function should be altered for
 * >   recursive-descent parsing with two-symbol lookahead.
 * > d. Use the grammar class hierarchy (Figure 3.29) to show that the (left factored)
 * >   grammar is LR(2).
 * > e. Prove that no string has two parse trees according to this (left-factored)
 * >   grammar. 
 * > 
 */



%options module-name=bison_bugger


%lex

%options ranges

%%

\s+                   /* skip whitespace */
[a-z]                 return 'id';
';'                   return ';';
':'                   return ':';
','                   return ',';
'+'                   return '+';
'-'                   return '-';
'='                   return '=';
'('                   return '(';
')'                   return ')';
'['                   return '[';
']'                   return ']';
.                     return 'ERROR';

/lex




%token id

%%

S → G;

G → P
  | P G;

P → id ':' R;

R → %empty
  | id R;


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
    var rv = parser.parse('a+b');
    console.log("test #1: 'a+b' ==> ", rv, parser.yy);
    assert.equal(rv, '+aDabX:a');

    rv = parser.parse('a-b');
    console.log("test #2: 'a-b' ==> ", rv);
    assert.equal(rv, 'XE');

    console.log("\nAnd now the failing inputs: even these deliver a result:\n");

    // set up an aborting error handler which does not throw an exception
    // but returns a special parse 'result' instead:
    var errmsg = null;
    var errReturnValue = '@@@';
    parser.yy.parseError = function (msg, hash) {
        errmsg = msg;
        return errReturnValue + (hash.parser ? hash.value_stack.slice(0, hash.stack_pointer).join('.') : '???');
    };

    rv = parser.parse('aa');
    console.log("test #3: 'aa' ==> ", rv);
    assert.equal(rv, '@@@.T.a');

    rv = parser.parse('a');
    console.log("test #4: 'a' ==> ", rv);
    assert.equal(rv, '@@@.a');

    rv = parser.parse(';');
    console.log("test #5: ';' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('?');
    console.log("test #6: '?' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('a?');
    console.log("test #7: 'a?' ==> ", rv);
    assert.equal(rv, '@@@.a');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

