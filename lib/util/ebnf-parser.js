var bnf = require("./parser").parser,
    ebnf = require("./ebnf-transform"),
    jisonlex = require("lex-parser");

exports.parse = function parse (grammar) { return bnf.parse(grammar); };
exports.transform = ebnf.transform;

// adds a declaration to the grammar
bnf.yy.addDeclaration = function (grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start;
    }
    else if (decl.lex) {
        grammar.lex = parseLex(decl.lex);
    }
    else if (decl.operator) {
        if (!grammar.operators) {
            grammar.operators = [];
        }
        grammar.operators.push(decl.operator);
    }
    else if (decl.include) {
        if (!grammar.moduleInclude)
            grammar.moduleInclude = '';
        grammar.moduleInclude += decl.include;
    }

};

// helps tokenize comments
bnf.yy.lexComment = function (lexer) {
    var ch = lexer.input();
    if (ch === '/') {
        lexer.yytext = lexer.yytext.replace(/\*(.|\s)\/\*/, '*$1');
        return;
    } else {
        lexer.unput('/*');
        lexer.more();
    }
};

// parse an embedded lex section
var parseLex = function (text) {
    return jisonlex.parse(text.replace(/(?:^%lex)|(?:\/lex$)/g, ''));
};

