
import bnf from "./parser";
import transform from "./ebnf-transform";
import jisonlex from "../lex-parser";

var version = '0.6.5-222';                              // require('./package.json').version;

function parse(grammar) {
    return bnf.parser.parse(grammar);
}

// adds a declaration to the grammar
bnf.parser.yy.addDeclaration = function bnfAddDeclaration(grammar, decl) {
    if (!decl) {
        return;
    }

    if (decl.start) {
        grammar.start = decl.start;
    }
    if (decl.lex) {
        grammar.lex = parseLex(decl.lex.text, decl.lex.position);
    }
    if (decl.grammar) {
        grammar.grammar = decl.grammar;
    }
    if (decl.ebnf) {
        grammar.ebnf = decl.ebnf;
    }
    if (decl.bnf) {
        grammar.bnf = decl.bnf;
    }
    if (decl.operator) {
        if (!grammar.operators) grammar.operators = [];
        grammar.operators.push(decl.operator);
    }
    if (decl.token) {
        if (!grammar.extra_tokens) grammar.extra_tokens = [];
        grammar.extra_tokens.push(decl.token);
    }
    if (decl.token_list) {
        if (!grammar.extra_tokens) grammar.extra_tokens = [];
        decl.token_list.forEach(function (tok) {
            grammar.extra_tokens.push(tok);
        });
    }
    if (decl.parseParams) {
        if (!grammar.parseParams) grammar.parseParams = [];
        grammar.parseParams = grammar.parseParams.concat(decl.parseParams);
    }
    if (decl.parserType) {
        if (!grammar.options) grammar.options = {};
        grammar.options.type = decl.parserType;
    }
    if (decl.include) {
        if (!grammar.moduleInclude) {
            grammar.moduleInclude = decl.include;
        } else {
            grammar.moduleInclude += '\n\n' + decl.include;
        }
    }
    if (decl.actionInclude) {
        if (!grammar.actionInclude) {
            grammar.actionInclude = decl.actionInclude;
        } else {
            grammar.actionInclude += '\n\n' + decl.actionInclude;
        }
    }
    if (decl.options) {
        if (!grammar.options) grammar.options = {};
        // last occurrence of `%options` wins:
        for (var i = 0; i < decl.options.length; i++) {
            grammar.options[decl.options[i][0]] = decl.options[i][1];
        }
    }
    if (decl.unknownDecl) {
        if (!grammar.unknownDecls) grammar.unknownDecls = [];         // [ array of {name,value} pairs ]
        grammar.unknownDecls.push(decl.unknownDecl);
    }
    if (decl.imports) {
        if (!grammar.imports) grammar.imports = [];                   // [ array of {name,path} pairs ]
        grammar.imports.push(decl.imports);
    }
    if (decl.codeSection) {
        if (!grammar.moduleInit) {
            grammar.moduleInit = [];
        }
        grammar.moduleInit.push(decl.codeSection);                    // {qualifier: <name>, include: <source code chunk>}
    }
    if (decl.onErrorRecovery) {
        if (!grammar.errorRecoveryActions) {
            grammar.errorRecoveryActions = [];
        }
        grammar.errorRecoveryActions.push(decl.onErrorRecovery);      // {qualifier: <name>, include: <source code chunk>}
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

