



%lex

%x MLC


%%

\s+                   /* skip whitespace */
<MLC>a                return 'ID';
<INITIAL,MLC>';'      %{ 
                        this.begin("MLC"); /* corrected... */ 
                        return ';'; 
                      %}
.                     return 'ERROR';

/lex




%token ID

%%

stmt
    : ';'[a] stmt
        { $$ = $a + ':' + $stmt; }
    | ID stmt
        { $$ = $ID + '.' + $stmt; }
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
    // set up an aborting error handler which does not throw an exception
    // but returns a special parse 'result' instead:
    var errmsg = null;
    var errReturnValue = '@@@';
    parser.yy.parseError = function (msg, hash) {
        console.log("ERROR: ", msg);
        errmsg = msg;
        return errReturnValue + (hash.parser ? hash.value_stack.slice(0, hash.stack_pointer).join('.') : '???');
    };

    var rv = parser.parse(';aa;');
    console.log("test #1: ';aa;' ==> ", rv);
    assert.equal(rv, '@@@.;.a.a.;');

    rv = parser.parse(';;a;');
    console.log("test #2: ';;a;' ==> ", rv);
    assert.equal(rv, '@@@.;.;.a.;');

    console.log("\nAnd now the failing inputs: even these deliver a result:\n");

    rv = parser.parse('a;');
    console.log("test #3: 'a;' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('a');
    console.log("test #4: 'a' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('b');
    console.log("test #5: 'b' ==> ", rv);
    assert.equal(rv, '@@@');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

