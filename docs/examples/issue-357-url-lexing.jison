
%lex

%%

// You can either encapsulate literal ':' colons in quotes or doublequotes, but another way is to
// wrap these in a regex set: `[:]` as shown below:
(ftp|http|https)[:]\/\/(\w+[:]{0,1}\w*@)?(\S+)([:][0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?        return 'URL';


\s+                   /* skip whitespace */
[a-zA-Z]+             return 'ID';
[^a-zA-Z\s\r\n]+      return 'OTHER';
.                     return 'MISC';


/lex




%token URL
%token ID
%token OTHER
%token MISC


%ebnf


%%

start
    : init count_terms
        {
            $$ = {
                counts: yy.counts,
                collected_tokens: yy.collected_tokens
            };
        }
    ;

init
    : %epsilon
        { 
            yy.counts = {
                url: 0,
                id: 0,
                other: 0,
                misc: 0
            };
            yy.collected_tokens = {
                url: [],
                id: [],
                other: [],
                misc: []
            };
        }
    ;

count_terms
    : term*
    ;

term
    : URL
        {
            yy.counts.url++;
            yy.collected_tokens.url.push($URL);
        }
    | ID
        {
            yy.counts.id++;
            yy.collected_tokens.id.push($ID);
        }
    | OTHER
        {
            yy.counts.other++;
            yy.collected_tokens.other.push($OTHER);
        }
    | MISC
        {
            yy.counts.misc++;
            yy.collected_tokens.url.push($MISC);
        }
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
    var rv = parser.parse('a+b');
    console.log("test #1: 'a+b' ==> ", rv, parser.yy);
    // assert.equal(rv, '+aDabX:a');

    rv = parser.parse('a-b');
    console.log("test #2: 'a-b' ==> ", rv);
    // assert.equal(rv, 'XE');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

