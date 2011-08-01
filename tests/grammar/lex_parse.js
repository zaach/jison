var assert = require("assert"),
    lex = require("../../lib/jison/jisonlex");

function read () {
    var IO = require('../../lib/jison/util/io');
    try {
        return IO.read(IO.join.apply(IO,[__dirname].concat([].slice.call(arguments,0))));
    } catch(e) {
        var fs = require("file");
        return fs.path(fs.dirname(module.id)).join.apply(fs.path(fs.dirname(module.id)),arguments)
            .read({charset: "utf-8"});
    }
}

exports["test lex grammar with macros"] = function () {
    var lexgrammar = 'D [0-9]\nID [a-zA-Z][a-zA-Z0-9]+\n%%\n\n{D}"ohhai" {print(9);}\n"{" {return \'{\';}';
    var expected = {
        macros: {"D": "[0-9]", "ID": "[a-zA-Z][a-zA-Z0-9]+"},
        rules: [
            ["{D}ohhai\\b", "print(9);"],
            ["\\{", "return '{';"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test escaped chars"] = function () {
    var lexgrammar = '%%\n"\\n"+ {return \'NL\';}\n\\n+ {return \'NL2\';}\n\\s+ {/* skip */}';
    var expected = {
        rules: [
            ["\\\\n+", "return 'NL';"],
            ["\\n+", "return 'NL2';"],
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

exports["test [^\]]"] = function () {
    var lexgrammar = '%%\n"["[^\\]]"]" {return true;}\n\'f"oo\\\'bar\'  {return \'baz2\';}\n"fo\\"obar"  {return \'baz\';}\n';
    var expected = {
        rules: [
            ["\\[[^\\]]\\]", "return true;"],
            ["f\"oo'bar\\b", "return 'baz2';"],
            ['fo"obar\\b', "return 'baz';"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test multiline action"] = function () {
    var lexgrammar = '%%\n"["[^\\]]"]" %{\nreturn true;\n%}\n';
    var expected = {
        rules: [
            ["\\[[^\\]]\\]", "\nreturn true;\n"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test include"] = function () {
    var lexgrammar = '\nRULE [0-9]\n\n%{\n hi <stuff> \n%}\n%%\n"["[^\\]]"]" %{\nreturn true;\n%}\n';
    var expected = {
        macros: {"RULE": "[0-9]"},
        actionInclude: "\n hi <stuff> \n",
        rules: [
            ["\\[[^\\]]\\]", "\nreturn true;\n"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test bnf lex grammar"] = function () {
    var lexgrammar = lex.parse(read('lex', 'bnf.jisonlex'));
    var expected = JSON.parse(read('lex', 'bnf.lex.json'));

    assert.deepEqual(lexgrammar, expected, "grammar should be parsed correctly");
};

exports["test lex grammar bootstrap"] = function () {
    var lexgrammar = lex.parse(read('lex', 'lex_grammar.jisonlex'));
    var expected = JSON.parse(read('lex', 'lex_grammar.lex.json'));

    assert.deepEqual(lexgrammar, expected, "grammar should be parsed correctly");
};

exports["test ANSI C lexical grammar"] = function () {
    var lexgrammar = lex.parse(read('lex','ansic.jisonlex'));

    assert.ok(lexgrammar, "grammar should be parsed correctly");
};

exports["test advanced"] = function () {
    var lexgrammar = '%%\n"stuff"*/!("{"|";") {/* ok */}\n';
    var expected = {
        rules: [
            ["stuff*(?!(\\{|;))", "/* ok */"],
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test start conditions"] = function () {
    var lexgrammar = '%s TEST TEST2\n%x EAT\n%%\n'+
                     '"enter-test" {this.begin(\'TEST\');}\n'+
                     '<TEST,EAT>"x" {return \'T\';}\n'+
                     '<*>"z" {return \'Z\';}\n'+
                     '<TEST>"y" {this.begin(\'INITIAL\'); return \'TY\';}';
    var expected = {
        startConditions: {
            "TEST": 0,
            "TEST2": 0,
            "EAT": 1,
        },
        rules: [
            ["enter-test\\b", "this.begin('TEST');" ],
            [["TEST","EAT"], "x\\b", "return 'T';" ],
            [["*"], "z\\b", "return 'Z';" ],
            [["TEST"], "y\\b", "this.begin('INITIAL'); return 'TY';" ]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test no brace action"] = function () {
    var lexgrammar = '%%\n"["[^\\]]"]" return true;\n"x" return 1;';
    var expected = {
        rules: [
            ["\\[[^\\]]\\]", "return true;"],
            ["x\\b", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test quote escape"] = function () {
    var lexgrammar = '%%\n\\"\\\'"x" return 1;';
    var expected = {
        rules: [
            ["\"'x\\b", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test escape things"] = function () {
    var lexgrammar = '%%\n\\"\\\'\\\\\\*\\i return 1;\n"a"\\b return 2;\n\\cA {}\n\\012 {}\n\\xFF {}';
    var expected = {
        rules: [
            ["\"'\\\\\\*i\\b", "return 1;"],
            ["a\\b", "return 2;"],
            ["\\cA", ""],
            ["\\012", ""],
            ["\\xFF", ""]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test unicode encoding"] = function () {
    var lexgrammar = '%%\n"\\u03c0" return 1;';
    var expected = {
        rules: [
            ["\\u03c0", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test unicode"] = function () {
    var lexgrammar = '%%\n"π" return 1;';
    var expected = {
        rules: [
            ["π", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
}

exports["test bugs"] = function () {
    var lexgrammar = '%%\n\\\'([^\\\\\']+|\\\\(\\n|.))*?\\\' return 1;';
    var expected = {
        rules: [
            ["'([^\\\\']+|\\\\(\\n|.))*?'", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
}

exports["test special groupings"] = function () {
    var lexgrammar = '%%\n(?:"foo"|"bar")\\(\\) return 1;';
    var expected = {
        rules: [
            ["(?:foo|bar)\\(\\)", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
}

exports["test trailing code include"] = function () {
    var lexgrammar = '%%"foo"  {return bar;}\n%% var bar = 1;';
    var expected = {
        rules: [
            ['foo\\b', "return bar;"]
        ],
        moduleInclude: " var bar = 1;"
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
};

exports["test empty or regex"] = function () {
    var lexgrammar = '%%\n(|"bar")("foo"|)(|) return 1;';
    var expected = {
        rules: [
            ["(|bar)(foo|)(|)", "return 1;"]
        ]
    };

    assert.deepEqual(lex.parse(lexgrammar), expected, "grammar should be parsed correctly");
}
