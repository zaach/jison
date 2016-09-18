var Jison = require("../setup").Jison;
var Lexer = require("../setup").Lexer;
var assert = require("assert");


var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["y", "return 'y';"]
    ]
};


exports["test generated parser must have working parse API method"] = function () {
    var grammar = "%% A : A x | A y | ; %%";

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
};

exports["test generated parser must export added user-defined methods"] = function () {
    var grammar = "%% A : A x | A y | ; %% parser.dummy = function () { return 42; };"

    var parser = new Jison.Parser(grammar);
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse('xyx'), "parse xyx");
    assert.ok(typeof parser.dummy === 'function');
    assert.ok(parser.dummy() === 42);
};

