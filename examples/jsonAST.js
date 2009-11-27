// Parses and reconstructs JSON
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
            ["null\\b", "return 'NULL'"],
            ["$", "return 'EOF';"]
        ]
    },
    "tokens": "STRING NUMBER { } [ ] , : TRUE FALSE NULL EOF",
    "bnf": {
        "Json": [ ["JsonThing EOF", "return $1;"] ],

        "JsonThing": [ ["JsonObject", "$$ = $1"],
                       ["JsonArray", "$$ = $1"] ],

        "JsonObject": [ ["{ JsonPropertyList }", "$$ = $2"] ],

        "JsonPropertyList": [ ["JsonProperty", "$$ = {};$$[$1[0]] = $1[1];"],
                              ["JsonPropertyList , JsonProperty", "$$ = $1; $1[$3[0]] = $3[1];"] ],

        "JsonProperty": [ ["StringLiteral : JsonValue", "$$ = [$1, $3];"] ],

        "JsonArray": [ ["[ JsonValueList ]", "$$ = $2;"] ],

        "JsonValueList": [ ["JsonValue", "$$ = [$1];"],
                           ["JsonValueList , JsonValue", "$$ = $1; $1.push($3);"] ],

        "JsonValue": [ ["StringLiteral", "$$ = $1;"],
                       ["NumericalLiteral", "$$ = $1;"],
                       ["JsonObject", "$$ = $1;"],
                       ["JsonArray", "$$ = $1;"],
                       ["TRUE", "$$ = true;"],
                       ["FALSE", "$$ = false;"],
                       ["NULL", "$$ = null;"] ],

        "StringLiteral": [ ["STRING", "$$ = yytext;" ] ],

        "NumericalLiteral": [ ["NUMBER", "$$ = Number(yytext);" ] ]
    },
};

var source = '{"foo": "Bar", "hi": 42, "array": [1,2,3.004,4], "false": false, "true":true, "null": null, "obj": {"ha":"ho"}, "string": "string\\"sgfg" }';

var parser = new jison.Parser(grammer, {type: 'lalr'});

var result = parser.parse(source);

