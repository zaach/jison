var assert = require("assert"),
    lex = require("../../lib/jison/jilex");

exports["test lex grammar with macros"] = function () {
    var lexgrammar = 'D [0-9]\nID [a-zA-Z][a-zA-Z0-9]+\n%%\n\n{D}"ohhai" {print(9);}\n"{" {return \'{\';}';
    var expected = {
        macros: [["D", "[0-9]"], ["ID", "[a-zA-Z][a-zA-Z0-9]+"]],
        rules: [
            ["{D}ohhai\\b", "print(9);"],
            ["\\{", "return '{';"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test excaped chars"] = function () {
    var lexgrammar = '%%\n"\\n"+ {return \'NL\';}\n"\\s"+ {/* skip */}';
    var expected = {
        rules: [
            ["\\n+", "return 'NL';"],
            ["\\s+", "/* skip */"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test advanced"] = function () {
    var lexgrammar = '%%\n$ {return \'EOF\';}\n. {/* skip */}\n"stuff"*/("{"|";") {/* ok */}\n(.+)[a-z]{1,2}"hi"*? {/* skip */}\n';
    var expected = {
        rules: [
            ["$", "return 'EOF';"],
            [".", "/* skip */"],
            ["stuff*(?=(\\{|;))", "/* ok */"],
            ["(.+)[a-z]{1,2}hi*?", "/* skip */"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test bnf lex grammar"] = function () {
    var fs = require("file");

    var lexgrammar = lex.parse(fs.path(fs.dirname(module.id))
            .join('bnf.jilex')
            .read({charset: "utf-8"}));

    var expected = JSON.parse(fs.path(fs.dirname(module.id))
            .join('bnf.lex.json')
            .read({charset: "utf-8"}));

    assert.deepEqual(lexgrammar, expected, "grammar should be parsed correctly");
};
