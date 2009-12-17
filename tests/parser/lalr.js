var Jison = require("../setup").Jison,
    Lexer = require("../setup").Lexer,
    assert = require("assert");

exports["test 0+0 grammar"] = function () {
    var lexData2 = {
        rules: [
           ["0", "return 'ZERO';"],
           ["\\+", "return 'PLUS';"]
        ]
    };
    var grammar = {
        tokens: [ "ZERO", "PLUS"],
        startSymbol: "E",
        bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lalr"});
    parser.lexer = new Lexer(lexData2);

    assert.ok(parser.parse("0+0+0"), "parse");
    assert.ok(parser.parse("0"), "parse single 0");

    assert.throws(function () {parser.parse("+")}, "throws parse error on invalid");
};

exports["test xx nullable grammar"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"]
        ]
    };
    var grammar = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'A x',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lalr"});
    parser.lexer = new Lexer(lexData);

    assert.ok(parser.parse("xxx"), "parse");
    assert.ok(parser.parse("x"), "parse single x");
    assert.throws(function (){parser.parse("+");}, "throws parse error on invalid");
};

exports["test xx nullable grammar slalr"] = function () {
    var lexData = {
        rules: [
           ["a", "return 'a';"],
           ["b", "return 'b';"],
           ["c", "return 'c';"],
           ["d", "return 'd';"],
           ["g", "return 'g';"]
        ]
    };
    var grammar = {
        "tokens": "a b c d g",
        "startSymbol": "S",
        "bnf": {
            "S" :[ "a g d",
                   "a A c",
                   "b A d",
                   "b g c" ],
            "A" :[ "B" ],
            "B" :[ "g" ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lalr"});
    parser.lexer = new Lexer(lexData);
    assert.ok(parser.parse("agd"), "parse");
};

exports["test basic JSON grammar"] = function () {
    var grammar = {
        "lex": {
            "macros": {
                "digit": "[0-9]"
            },
            "rules": [
                ["\\s+", "/* skip whitespace */"],
                ["{digit}+(\\.{digit}+)?", "return 'NUMBER';"],
                ["\"[^\"]*", function(){
                    if(this.yytext.charAt(this.yyleng-1) == '\\') {
                        // remove escape
                        this.yytext = this.yytext.substr(0,this.yyleng-2);
                        this.more();
                    } else {
                        this.yytext = this.yytext.substr(1); // swallow start quote
                        this.input(); // swallow end quote
                        return "STRING";
                    }
                }],
                ["\\{", "return '{'"],
                ["\\}", "return '}'"],
                ["\\[", "return '['"],
                ["\\]", "return ']'"],
                [",", "return ','"],
                [":", "return ':'"],
                ["true\\b", "return 'TRUE'"],
                ["false\\b", "return 'FALSE'"],
                ["null\\b", "return 'NULL'"]
            ]
        },

        "tokens": "STRING NUMBER { } [ ] , : TRUE FALSE NULL",
        "bnf": {
            "JsonThing": [ "JsonObject",
                           "JsonArray" ],

            "JsonObject": [ "{ JsonPropertyList }" ],

            "JsonPropertyList": [ "JsonProperty",
                                  "JsonPropertyList , JsonProperty" ],

            "JsonProperty": [ "StringLiteral : JsonValue" ],

            "JsonArray": [ "[ JsonValueList ]" ],

            "JsonValueList": [ "JsonValue",
                               "JsonValueList , JsonValue" ],

            "JsonValue": [ "StringLiteral",
                           "NumericalLiteral",
                           "JsonObject",
                           "JsonArray",
                           "TRUE",
                           "FALSE",
                           "NULL" ],

            "StringLiteral": [ "STRING" ],

            "NumericalLiteral": [ "NUMBER" ]
        },
    };

    var source = '{"foo": "Bar", "hi": 42, "array": [1,2,3.004,4], "false": false, "true":true, "null": null, "obj": {"ha":"ho"}, "string": "string\\"sgfg" }';

    var parser = new Jison.Parser(grammar, {type: "lalr"});
    var parser2 = new Jison.Parser(grammar, {type: "slr"});
    assert.deepEqual(parser.table, parser2.table, "SLR(1) and LALR(1) tables should be equal");
    assert.ok(parser.parse(source));
}

exports["test LR(1) grammar"] = function () {
    var grammar = {
        "comment": "Produces a reduce-reduce conflict unless using LR(1).",
        "tokens": "z d b c a",
        "start": "S",
        "bnf": {
            "S" :[ "a A c",
                   "a B d",
                   "b A d",
                   "b B c"],
            "A" :[ "z" ],
            "B" :[ "z" ]
        }
    };

    var parser = new Jison.Parser(grammar, {type: "lalr"});
    assert.equal(parser.conflicts, 2);
}
