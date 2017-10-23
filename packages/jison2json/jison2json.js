var bnfParser = require('../ebnf-parser');
var lexParser = require('../lex-parser');

function processGrammar(rawGrammar, lex) {
    var grammar = bnfParser.parse(rawGrammar);
    if (lex) {
        grammar.lex = lexParser.parse(lex);
    }

    // trick to reposition `bnf` after `lex` in serialized JSON
    grammar.bnf = grammar.bnf;

    return JSON.stringify(grammar, null, '  ');
}

exports.convert = processGrammar;

