// title: Simple lexer example - a lexer spec without any errors
// test_input: "ftp://example.com/ :: A = B × C"
// ...
//  


%%

// You can either encapsulate literal ':' colons in quotes or doublequotes, but another way is to
// wrap these in a regex set: `[:]` as shown below:
(ftp|http|https)[:]\/\/(\w+[:]{0,1}\w*@)?(\S+)([:][0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?        return 'URL';


\s+                   /* skip whitespace */
[a-zA-Z]+             return 'ID';
[^a-zA-Z\s\r\n]+      return 'OTHER';
.                     return 'MISC';




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
    // assert.equal(rv, '+aDabX:a');

    rv = parser.parse('a-b');
    console.log("test #2: 'a-b' ==> ", rv);
    // assert.equal(rv, 'XE');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

