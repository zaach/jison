

%lex

%%

\s+                   /* skip whitespace */
a                     return 'PREFIX1';
b                     return 'PREFIX2';
A                     return 'SUFFIX1';
B                     return 'SUFFIX2';
.                     return 'ERROR';

/lex




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

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

