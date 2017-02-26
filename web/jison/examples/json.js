var Parser = require("jison").Parser;
var system = require("system");
var fs = require("file");

exports.grammar = {
    "comment": "ECMA-262 5th Edition, 15.12.1 The JSON Grammar.",
    "author": "Zach Carter",

    "lex": {
        "macros": {
            "digit": "[0-9]",
            "exp": "([eE][-+]?{digit}+)"
        },
        "rules": [
            ["\\s+", "/* skip whitespace */"],
            ["-?{digit}+(\\.{digit}+)?{exp}?", "return 'NUMBER';"],
            ["\"[^\"]*", function(){
                if(yytext.charAt(yyleng-1) == '\\') {
                    // remove escape
                    yytext = yytext.substr(0,yyleng-2);
                    this.more();
                } else {
                    yytext = yytext.substr(1); // swallow start quote
                    this.input(); // swallow end quote
                    return "STRING";
                }
            }],
            ["\\{", "return '{';"],
            ["\\}", "return '}';"],
            ["\\[", "return '[';"],
            ["\\]", "return ']';"],
            [",", "return ',';"],
            [":", "return ':';"],
            ["true\\b", "return 'TRUE';"],
            ["false\\b", "return 'FALSE';"],
            ["null\\b", "return 'NULL';"]
        ]
    },

    "tokens": "STRING NUMBER { } [ ] , : TRUE FALSE NULL",
    "start": "JSONText",

    "bnf": {
        "JSONString": [ "STRING" ],

        "JSONNumber": [ "NUMBER" ],

        "JSONBooleanLiteral": [ "TRUE", "FALSE" ],


        "JSONText": [ "JSONValue" ],

        "JSONValue": [ "JSONNullLiteral",
                       "JSONBooleanLiteral",
                       "JSONString",
                       "JSONNumber",
                       "JSONObject",
                       "JSONArray" ],

        "JSONObject": [ "{ }",
                        "{ JSONMemberList }" ],

        "JSONMember": [ "JSONString : JSONValue" ],

        "JSONMemberList": [ "JSONMember",
                              "JSONMemberList , JSONMember" ],

        "JSONArray": [ "[ ]",
                       "[ JSONElementList ]" ],

        "JSONElementList": [ "JSONValue",
                             "JSONElementList , JSONValue" ]
    }
};

var options = {type: "slr", moduleType: "commonjs", moduleName: "jsoncheck"};

exports.main = function main (args) {
    var cwd = fs.path(fs.cwd()),
        code = new Parser(exports.grammar, options).generate(),
        stream = cwd.join(options.moduleName+".js").open("w");
    stream.print(code).close();
};

if (require.main === module.id)
    exports.main(system.args);

