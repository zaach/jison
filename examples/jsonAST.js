var Jison = require("jison").Jison;
var system = require("system");

exports.grammar = {
    "comment": "ECMA-262 5th Edition, 15.12.1 The JSON Grammar. (Incomplete implementation)",
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
    "start": "JSONText",

    "bnf": {
        "JSONString": [[ "STRING", "$$ = yytext;" ]],

        "JSONNumber": [[ "NUMBER", "$$ = Number(yytext);" ]],

        "JSONNullLiteral": [[ "NULL", "$$ = null;" ]],

        "JSONBooleanLiteral": [[ "TRUE", "$$ = true;" ],
                               [ "FALSE", "$$ = false;" ]],


        "JSONText": [[ "JSONValue", "return $$ = $1;" ]],

        "JSONValue": [[ "JSONNullLiteral",    "$$ = $1;" ],
                      [ "JSONBooleanLiteral", "$$ = $1;" ],
                      [ "JSONString",         "$$ = $1;" ],
                      [ "JSONNumber",         "$$ = $1;" ],
                      [ "JSONObject",         "$$ = $1;" ],
                      [ "JSONArray",          "$$ = $1;" ]],

        "JSONObject": [[ "{ }", "$$ = {};" ],
                       [ "{ JSONMemberList }", "$$ = $2;" ]],

        "JSONMember": [[ "JSONString : JSONValue", "$$ = [$1, $3];" ]],

        "JSONMemberList": [[ "JSONMember", "$$ = {}; $$[$1[0]] = $1[1];" ],
                           [ "JSONMemberList , JSONMember", "$$ = $1; $1[$3[0]] = $3[1];" ]],

        "JSONArray": [[ "[ ]", "$$ = [];" ],
                      [ "[ JSONElementList ]", "$$ = $2;" ]],

        "JSONElementList": [[ "JSONValue", "$$ = [$1];" ],
                            [ "JSONElementList , JSONValue", "$$ = $1; $1.push($3);" ]]
    }
};

var options = {type: "slr", moduleType: "commonjs"};

exports.main = function main (args) {
    var source = new Jison.Parser(exports.grammar, options).generate();
    print(source);
};

if (require.main === module)
    exports.main(system.args);

