

%lex

%%

\s+                   /* skip whitespace */
a                     return 'PREFIX1';
b                     return 'PREFIX2';
A                     return 'SUFFIX1';
B                     return 'SUFFIX2';
.                     return 'ERROR';

/lex


%options default-action-mode=none,none no-try-catch


%token PREFIX1 PREFIX2 SUFFIX1 SUFFIX2

%%

start:
          opt_prefix1 SUFFIX1
        | opt_prefix2 SUFFIX2
        ;

opt_prefix1:
          ε                 /* empty */
        | PREFIX1
        ;

opt_prefix2:
          ε                 /* empty */
        | PREFIX2
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
    var testset_ok = ['A', 'B', 'aA', 'bB'];
    var rv;
    for (var i = 0, len = testset_ok.length; i < len; i++) {
        try {
            rv = parser.parse(testset_ok[i]);
            console.log("test #" +  i + ": '" +  testset_ok[i] + "' ==> ", rv);
            assert.equal(rv, true);
        } catch (ex) {
            console.log("test #" +  i + ": '" +  testset_ok[i] + "' ==> EXCEPTION: ", ex);
            throw ex;
        }
    }


    console.log("\nAnd now the failing inputs: even these deliver a result:\n");


    // set up an aborting error handler which does not throw an exception
    // but returns a special parse 'result' instead:
    var errmsg = null;
    var errReturnValue = '@@@';
    parser.yy.parseError = function (msg, hash) {
        errmsg = msg;
        return errReturnValue;
    };

    var testset_not_ok = ['a', 'b', 'aB', 'bA', '?', 'AA', 'BB', 'aa', 'bb', '?A', '?a'];
    var base = i;
    var rv;
    for (var i = 0, len = testset_not_ok.length; i < len; i++) {
        try {
            rv = parser.parse(testset_not_ok[i]);
            console.log("test #" +  (base + i) + ": '" +  testset_not_ok[i] + "' ==> ", rv);
            assert.strictEqual(rv, errReturnValue);
        } catch (ex) {
            console.log("test #" +  (base + i) + ": '" +  testset_not_ok[i] + "' ==> EXCEPTION: ", ex);
            throw ex;
        }
    }

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

