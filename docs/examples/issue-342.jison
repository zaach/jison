
//%options on-demand-lookahead    // camelCased: option.onDemandLookahead



%lex

%%

\s+                   /* skip whitespace */
a                     return 'ID';
';'                   return ';';
.                     return 'ERROR';

/lex




%token ID

%%

stmt
    : type ID ';'
        { $$ = 'V' + $type + ':' + $ID; }
    | expr ';'
        { $$ = 'X' + $expr; }
    ;

type
    : ID
        { $$ = 'T'; }
    ;

expr
    : ID
        { $$ = 'E'; }
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
    var rv = parser.parse('aa;');
    console.log("test #1: 'aa;' ==> ", rv);
    assert.equal(rv, 'VT:a');

    rv = parser.parse('a;');
    console.log("test #2: 'a;' ==> ", rv);
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

