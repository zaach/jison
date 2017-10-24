/*
 * From http://stackoverflow.com/questions/6487588/example-for-ll1-grammer-which-is-not-lalr :
 * 
 * From "Modern Compiler Implementation in C":
 * 
 * >
 * > Some googling brings up this example for a non-LALR(1) grammar, which is LL(1):
 * > 
 * > ``` 
 * > S ::= '(' X 
 * >     | E ']' 
 * >     | F ')'
 * > X ::= E ')' 
 * >     | F ']'
 * > E ::= A
 * > F ::= A
 * > A ::= ε
 * > ``` 
 * > 
 * > The LALR(1) construction fails, because there is a reduce-reduce conflict 
 * > between E and F. In the set of LR(0) states, there is a state made up of
 * > 
 * > ``` 
 * > E ::= A . ;
 * > F ::= A . ;
 * > ``` 
 * > 
 * > which is needed for both S and X contexts. The LALR(1) lookahead sets for 
 * > these items thus mix up tokens originating from the S and X productions. 
 * > This is different for LR(1), where there are different states for these cases.
 * > 
 * > With LL(1), decisions are made by looking at FIRST sets of the alternatives, 
 * > where ')' and ']' always occur in different alternatives.
 * >
 */



%options module-name=bison_bugger


%lex

%options ranges

%%

\s+                   /* skip whitespace */
[a-z]                 return 'ID';
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




%token ID

%%

S : 
      '(' X 
    | E ']' 
    | F ')'
    ;

X :
      E ')' 
    | F ']'
    ;

E : A;

F : A;

A : ε;

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

