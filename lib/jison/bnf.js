var parser = require("./util/bnf-parser").parser;

// adds a declaration to the grammar
parser.yy.addDeclaration = function (grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start
    }
    if (decl.operator) {
        if (!grammar.operators) {
            grammar.operators = [];
        }
        grammar.operators.push(decl.operator);
    }

};

// helps tokenize comments
parser.yy.lexComment = function (lexer) {
    var ch = lexer.input();
    if (ch === '/') {
        lexer.yytext = lexer.yytext.replace(/\*(.|\s)\/\*/, '*$1');
        return;
    } else {
        lexer.unput('/*');
        lexer.more();
    }
}

// helps tokenize actions
parser.yy.lexAction = function (lexer) {
    var ch = lexer.input();
    if (ch === '}') {
        lexer.yytext = lexer.yytext.substr(2, lexer.yyleng-4).replace(/\}(.|\s)\{\{/, '}$1');
        return 'ACTION';
    } else {
        lexer.unput('{{');
        lexer.more();
    }
}

exports.parse = function parse () { return parser.parse.apply(parser, arguments) };
