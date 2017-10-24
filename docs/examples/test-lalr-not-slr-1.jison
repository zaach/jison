/*
 * From "Modern Compiler Implementation in C":
 * 
 * > ### Exercise 3.13: 
 * > 
 * > Show that this grammar is LALR(1) but not SLR:
 * > 
 */


%options module-name=bison_bugger


%lex

%options ranges

%%

\s+                   /* skip whitespace */
a                     return 'a';
b                     return 'b';
c                     return 'c';
d                     return 'd';
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




%token a b c d

%%

S : X;

X : M a
  | b M c
  | d c
  | b d a
  ;

M → d; 

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

