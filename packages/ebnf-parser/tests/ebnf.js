var assert = require("chai").assert;
var bnf = require("../dist/ebnf-parser-cjs-es5");
var ebnf = bnf.ebnf_parser;
var Jison = require('../../../../jison/');  // jison-gho
var Parser = Jison.Parser;

function testParse(top, strings) {
    return function() {
        var grammar = {
            "lex": {
                "rules": [
                    ["\\s+", ''],
                    ["[A-Za-z]+", "return 'word';"],
                    [",", "return ',';"],
                    ["\"'", "return \"\\\"'\";"],
                    ["'", "return \"'\";"],
                    ['"', "return '\"';"],
                    ["$", "return 'EOF';"]
                ]
            },
            "start": "top",
            "ebnf": {"top": [top]},
            "bnf": ebnf.transform({"top": [top]})
        };
        strings = (typeof(strings) === 'string' ? [strings] : strings);
        strings.forEach(function(string) {
            assert.ok(new Parser(grammar).parse(string));
        });
    };
}

function testBadParse(top, strings) {
    return function() {
        var grammar = {
            "lex": {
                "rules": [
                    ["\\s+", ''],
                    ["[A-Za-z]+", "return 'word';"],
                    [",", "return ',';"],
                    ["$", "return 'EOF';"]
                ]
            },
            "start": "top",
            "ebnf": {"top": [top]}
        };
        strings = (typeof(strings) === 'string' ? [strings] : strings);
        strings.forEach(function(string) {
            assert.throws(function () {
                new Parser(grammar).parse(string);
            });
        });
    };
}

function testAlias(top, obj, str) {
    return function() {
        var grammar = {
            "lex": {
                "rules": [
                    ["\\s+", ''],
                    ["[A-Za-z]+", "return 'word';"],
                    [",", "return ',';"],
                    ["$", "return 'EOF';"]
                ]
            },
            "start": "top",
            "ebnf": {"top": [top]},
            "bnf": ebnf.transform({"top": [top]})
        };
        assert.deepEqual(grammar['bnf'], obj);
        assert.ok(new Parser(grammar).parse(str));
    };
}

var tests = {
    "test idempotent transform": function() {
        var first = {
            "nodelist": [["", "$$ = [];"], ["nodelist node", "$1.push($2);"]]
        };
        var second = ebnf.transform(JSON.parse(JSON.stringify(first)));
        assert.deepEqual(second, first);
    },
    "test repeat (*) on empty string": testParse("word* EOF", ""),
    "test repeat (*) on single word": testParse("word* EOF", "oneword"),
    "test repeat (*) on multiple words": testParse("word* EOF", "multiple words"),
    "test repeat (+) on empty string": testBadParse("word+ EOF", ""),
    "test repeat (+) on single word": testParse("word+ EOF", "oneword"),
    "test repeat (+) on multiple words": testParse("word+ EOF", "multiple words"),
    "test option (?) on empty string": testParse("word? EOF", ""),
    "test option (?) on single word": testParse("word? EOF", "oneword"),
//    "test single quote (') tokens": testParse("'\\'' EOF", "'"),
    "test single quote (') tokens (alt.)": testParse("\"'\" EOF", "'"),
//    "test double quote (\") tokens": testParse("\"\\\"\" EOF", "\""),
    "test double quote (\") tokens (alt.)": testParse("'\"' EOF", "\""),
//    "test quoted tokens (edge case #1)": testParse("'\"\\'' EOF", "\"'"),       // a weird 'token' consisting of a single AND a double-quote: either way, one of them will end up being escaped! 
    "test quoted tokens (edge case #2)": testParse('"\\"\'" EOF', "\"'"),       // a weird 'token' consisting of a single AND a double-quote: either way, one of them will end up being escaped! 
    "test group () on simple phrase": testParse("(word word) EOF", "two words"),
    "test group () with multiple options on first option": testParse("((word word) | word) EOF", "hi there"),
    "test group () with multiple options on second option": testParse("((word word) | word) EOF", "hi"),
    "test complex expression ( *, ?, () )": testParse("(word (',' word)*)? EOF ", ["", "hi", "hi, there"]),
    "test named repeat (*)": testAlias("word*[bob] EOF",
        { top: [ 'bob EOF' ],
        bob: [ [ '', '$$ = [];' ], [ 'bob word', '$1.push($2);\n$$ = $1;' ] ] }, "word"),
    "test named repeat (+)": testAlias("word+[bob] EOF",
        { top: [ 'bob EOF' ],
        bob: [ [ 'word', '$$ = [$1];' ], [ 'bob word', '$1.push($2);\n$$ = $1;' ] ] }, "wordy word"),
    "test named group ()": testAlias("word[alice] (',' word)*[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["","$$ = [];"],["bob ',' word","$1.push([$2, $3]);\n$$ = $1;"]]},
        "one, two"),
    "test nested named groups ()": testAlias("word[alice] (',' (word word)*[uncle] )*[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["","$$ = [];"],["bob ',' uncle","$1.push([$2, $3]);\n$$ = $1;"]],"uncle":[["","$$ = [];"],["uncle word word","$1.push([$2, $3]);\n$$ = $1;"]]},
        "one, two three four five"),
    "test named group () without wildcard operator": testAlias("word[alice] (',' word)[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["',' word","$$ = [$1, $2];"]]},
        "one, two"),
    "test unnamed group () without wildcard operator": testAlias("word[alice] (',' word) EOF",
        {"top":["word[alice] ',' word EOF"]},
        "one, two"),
    "test nested unnamed groups () without wildcard operator #1": testAlias("word[alice] ( (',' word) ) EOF",
        {"top":["word[alice] ',' word EOF"]},
        "one, two"),
    "test nested unnamed groups () without wildcard operator #2": testAlias("word[alice] ( ',' ( word word) ) EOF",
        {"top":["word[alice] ',' word word EOF"]},
        "one, two three"),
    "test nested named groups () mix #1": testAlias("word[alice] (',' (word word)[uncle] )*[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["","$$ = [];"],["bob ',' uncle","$1.push([$2, $3]);\n$$ = $1;"]],"uncle":[["word word","$$ = [$1, $2];"]]},
        "one, two three, four five"),
    "test nested named groups () mix #2": testAlias("word[alice] (',' (word word) )*[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["","$$ = [];"],["bob ',' word word","$1.push([$2, $3, $4]);\n$$ = $1;"]]},
        "one, two three, four five"),
    "test nested named groups () mix #3": testAlias("word[alice] (',' (word word) (word word) )*[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["","$$ = [];"],["bob ',' word word word word","$1.push([$2, $3, $4, $5, $6]);\n$$ = $1;"]]},
        "one, two three four five, six seven eight nine"),
    "test nested named groups () mix #4": testAlias("word[alice] (',' (word)[uncle] )*[bob] EOF",
        {"top":["word[alice] bob EOF"],"bob":[["","$$ = [];"],["bob ',' uncle","$1.push([$2, $3]);\n$$ = $1;"]],"uncle":[["word","$$ = $1;"]]},
        "one, two, three, four"),
    "test named option (?)": testAlias("word[alex] word?[bob] EOF", { top: [ 'word[alex] bob EOF' ], bob: [['', '$$ = undefined;'], ['word', '$$ = $1;']] }, "oneor two"),
    "test named complex expression (())": testAlias("word[alpha] (word[alex] (word[bob] word[carol] ',')+[david] word ',')*[enoch] EOF",
        {"top":["word[alpha] enoch EOF"],"david":[["word[bob] word[carol] ','","$$ = [[$1, $2, $3]];"],["david word[bob] word[carol] ','","$1.push([$2, $3, $4]);\n$$ = $1;"]],
        "enoch":[["","$$ = [];"],["enoch word[alex] david word ','","$1.push([$2, $3, $4, $5]);\n$$ = $1;"]]},
        "one two three four, five,"
    )
};

describe("EBNF", function () {
    for (var test in tests) {
        it(test, tests[test]);
    }
});
