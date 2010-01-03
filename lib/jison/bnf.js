var parser = require("./util/bnf-parser").parser;

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

exports.parse = function parse () { return parser.parse.apply(parser, arguments) };
