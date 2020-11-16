// see https://github.com/BNFC/bnfc/pull/132
// related to https://github.com/zaach/jison/issues/205
//
// reduce/reduce conflict in jison, not in bison...

%lex

%%
\s+                   /* skip whitespace */
foo                   return 'foo';
bar                   return 'bar';

/lex

%start BAR

%%

BAR : FOO "bar" | ;
FOO : | "foo" ;

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
    var rv = parser.parse("a(b, c)");
    console.log("a(b, c) ==> ", rv);
    assert.equal(rv, "a:([\"b\",[[\",\",\"c\"]]])");

    var rv = parser.parse("a(b)");
    console.log("a(b) ==> ", rv);
    assert.equal(rv, "a:([\"b\",[]])");


    // if you get past the assert(), you're good.
    console.log("tested OK");
};

