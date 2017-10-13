
import bnf from "./parser";
import transform from "./ebnf-transform";
import jisonlex from "../lex-parser";

var version = '0.6.0-195';                              // require('./package.json').version;

function parse(grammar) {
    return bnf.parser.parse(grammar);
}

// adds a declaration to the grammar
bnf.parser.yy.addDeclaration = function bnfAddDeclaration(grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start;
    } else if (decl.lex) {
        grammar.lex = parseLex(decl.lex.text, decl.lex.position);
    } else if (decl.operator) {
        if (!grammar.operators) grammar.operators = [];
        grammar.operators.push(decl.operator);
    } else if (decl.token) {
        if (!grammar.extra_tokens) grammar.extra_tokens = [];
        grammar.extra_tokens.push(decl.token);
    } else if (decl.token_list) {
        if (!grammar.extra_tokens) grammar.extra_tokens = [];
        decl.token_list.forEach(function (tok) {
            grammar.extra_tokens.push(tok);
        });
    } else if (decl.parseParams) {
        if (!grammar.parseParams) grammar.parseParams = [];
        grammar.parseParams = grammar.parseParams.concat(decl.parseParams);
    } else if (decl.parserType) {
        if (!grammar.options) grammar.options = {};
        grammar.options.type = decl.parserType;
    } else if (decl.include) {
        if (!grammar.moduleInclude) grammar.moduleInclude = '';
        grammar.moduleInclude += decl.include;
    } else if (decl.options) {
        if (!grammar.options) grammar.options = {};
        // last occurrence of `%options` wins:
        for (var i = 0; i < decl.options.length; i++) {
            grammar.options[decl.options[i][0]] = decl.options[i][1];
        }
    } else if (decl.unknownDecl) {
        if (!grammar.unknownDecls) grammar.unknownDecls = [];
        grammar.unknownDecls.push(decl.unknownDecl);
    } else if (decl.imports) {
        if (!grammar.imports) grammar.imports = [];
        grammar.imports.push(decl.imports);
    } else if (decl.actionInclude) {
        if (!grammar.actionInclude) {
            grammar.actionInclude = '';
        }
        grammar.actionInclude += decl.actionInclude;
    } else if (decl.initCode) {
        if (!grammar.moduleInit) {
            grammar.moduleInit = [];
        }
        grammar.moduleInit.push(decl.initCode);       // {qualifier: <name>, include: <source code chunk>}
    }
};

// parse an embedded lex section
function parseLex(text, position) {
    text = text.replace(/(?:^%lex)|(?:\/lex$)/g, '');
    // We want the lex input to start at the given 'position', if any,
    // so that error reports will produce a line number and character index
    // which matches the original input file:
    position = position || {};
    position.range = position.range || [];
    var l = position.first_line | 0;
    var c = position.range[0] | 0;
    var prelude = '';
    if (l > 1) {
        prelude += (new Array(l)).join('\n');
        c -= prelude.length;
    }
    if (c > 3) {
        prelude = '// ' + (new Array(c - 3)).join('.') + prelude;
    }
    return jisonlex.parse(prelude + text);
}

const ebnf_parser = {
    transform
};

export default {
    parse,

    transform,

    // assistant exports for debugging/testing:
    bnf_parser: bnf,
    ebnf_parser,
    bnf_lexer: jisonlex,

    version,
};

