var assert = require("assert"),
    bnf = require("../../lib/jison/bnf");
    json2jison = require("../../lib/jison/json2jison");

exports["test basic grammar"] = function () {
    var grammar = "%% test: foo bar | baz ; hello: world ;";
    var expected = {bnf: {test: ["foo bar", "baz"], hello: ["world"]}};

    assert.deepEqual(json2jison.convert(bnf.parse(grammar)), json2jison.convert(expected), "grammar should be parsed correctly");
};

exports["test advanced grammar"] = function () {
    var grammar = "%start foo %% test: foo bar | baz ; hello: world %prec UM {action};";
    var expected = {start: "foo", bnf: {test: ["foo bar", "baz"], hello: [[ "world", "action", {prec: "UM"} ]]}};

    assert.deepEqual(json2jison.convert(bnf.parse(grammar)), json2jison.convert(expected), "grammar should be parsed correctly");
};

exports["test actions"] = function () {
    var grammar = "%start foo %% test: foo bar | baz ; hello: world %prec UM {{action{} }} ;";
    var expected = {start: "foo", bnf: {test: ["foo bar", "baz"], hello: [[ "world", "action{}", {prec: "UM"} ]]}};

    assert.deepEqual(json2jison.convert(bnf.parse(grammar)), json2jison.convert(expected), "grammar should be parsed correctly");
};

exports["test embedded lexical block"] = function () {
    var grammar = "%lex  \
                   %%\
                   'foo' {return 'foo';}\
                   'bar' {return 'bar';}\
                   'baz' {return 'baz';}\
                   'world' {return 'world';}\
                   /lex\
                   %% test: foo bar | baz ; hello: world ;";
    var expected = {
                        lex: {
                            rules: [
                               ["foo\\b", "return 'foo';"],
                               ["bar\\b", "return 'bar';"],
                               ["baz\\b", "return 'baz';"],
                               ["world\\b", "return 'world';"]
                            ]
                        },
                        bnf: {test: ["foo bar", "baz"], hello: ["world"]}
                    };

    assert.deepEqual(json2jison.convert(bnf.parse(grammar)), json2jison.convert(expected), "grammar should be parsed correctly");
};
