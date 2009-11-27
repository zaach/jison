// Parses JSON
// Based on Dave Dolan's grammer http://davedolan.com/Blog 

var jison = require("jison").Jison,
    RegExpLexer= require("jison/lex").RegExpLexer;

var grammer = {
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
            //["$", "return 'EOF';"]
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

var parser = new jison.Parser(grammer, {type: 'lalr'});

parser.parse(source);

