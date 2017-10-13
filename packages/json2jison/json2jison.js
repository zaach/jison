
// converts json grammar format to Jison grammar format
//
// Supported options:
// - stripActions
function json2jison (grammar, options) {
    options = options || {};
    var s = "";

    s += genDecls(grammar, options);
    s += genBNF(grammar.bnf, options);

    return s;
}

function genDecls (grammar, options) {
    var s = "",
        key;

    for (key in grammar) {
        if (grammar.hasOwnProperty(key)) {
            if (key === 'start') {
                s += "\n%start " + grammar.start + "\n\n";
            }
            else if (key === 'author') {
                s += "\n/* author: " + grammar.author + " */\n\n";
            }
            else if (key === 'comment') {
                s += "\n/* description: " + grammar.comment + " */\n\n";
            }
            else if (key === 'lex') {
                s += "%lex\n" + genLex(grammar.lex) + "/lex\n\n";
            }
            else if (key === 'operators') {
                for (var i = 0; i < grammar.operators.length; i++) {
                    s += "%" + grammar.operators[i][0] + ' ' + quoteSymbols(grammar.operators[i].slice(1).join(' ')) + "\n";
                }
                s += "\n";
            }
        }
    }

    return s;
}

function genBNF (bnf, options) {
    var s = "%%\n",
        sym;

    for (sym in bnf) {
        if (bnf.hasOwnProperty(sym)) {
            s += ["\n", sym, '\n    : ', genHandles(bnf[sym], options), "\n    ;\n"].join("");
        }
    }

    return s;
}

function genHandles (handle, options) {
    if (typeof handle === 'string') {
        return handle;
    } else { //array
        var s = "";
        for (var i = 0; i < handle.length; i++) {
            if (typeof handle[i] === 'string' && handle[i]) {
                s += quoteSymbols(handle[i]);
            } else if (handle[i] instanceof Array) {
                s += (handle[i][0] && quoteSymbols(handle[i][0]));
                if (typeof handle[i][1] === 'string') {
                    if (handle[i][2] && handle[i][2].prec) {
                        s += " %prec " + handle[i][2].prec;
                    }
                    if (!options.stripActions) {
                        s += "\n        {" + handle[i][1] + "}";
                    }
                } else if (handle[i][1].prec) {
                    s += " %prec " + handle[i][1].prec;
                }
            }
            if (typeof handle[i + 1] !== 'undefined') {
                s += "\n    | ";
            }
        }
        return s;
    }
}

function quoteSymbols (rhs) {
    rhs = rhs.split(' ');

    for (var i = 0; i < rhs.length; i++) {
        rhs[i] = quoteSymbol(rhs[i]);
    }
    return rhs.join(' ');
}

function quoteSymbol (sym) {
    if (!/[a-zA-Z_][a-zA-Z0-9_]*/.test(sym)) {
        var quote = /'/.test(sym) ? '"' : "'";
        sym = quote + sym + quote;
    }
    return sym;
}


// Generate lex format from lex JSON

function genLex (lex) {
    var s = [];
    var indent = 28;

    if ('macros' in lex) {
        for (var macro in lex.macros) {
            s.push(macro, new Array(indent - macro.length + 1).join(' '), lex.macros[macro], '\n');
        }
    }
    if ('startConditions' in lex) {
        var ps = [];
        var px = [];
        for (var st in lex.startConditions) {
            if (lex.startConditions[st]) {
                px.push(st);
            } else {
                ps.push(st);
            }
        }
        if (ps.length) {
            s.push('%s ', ps.join(' '));
        }
        if (px.length) {
            s.push('%x ', px.join(' '));
        }
    }
    if ('actionInclude' in lex) {
        s.push('\n%{\n', lex.actionInclude, '\n%}\n');
    }
    s.push('\n%%\n');

    var longestRule = lex.rules.reduce(function (prev, curr) { 
        return prev > curr[0].length ? prev : curr[0].length; 
    }, 0);
    if ('rules' in lex) {
        for (var rule; rule = lex.rules.shift(); ) {
            if (rule.length > 2) {
                s.push('<' + rule.shift().join(',') + '>');
            }
            var reg = genLexRegex(rule[0]);
            s.push(reg, new Array(longestRule-reg.length + 5).join(' '), genLexRule(rule[1]), '\n');
        }
    }
    s.push('\n');

    return s.join('');
}

function genLexRegex (regex) {
    var matcher = regex.replace(/^([a-zA-Z0-9_]+)$/, "\"$1\"")
                       .replace(/\\([.*+?^${}()|\[\]\/\\])/g, "$1")
                       .replace(/^\$$/, "<<EOF>>")
                       .replace(/^([.*+?^${}()|\[\]\/\\\-;=,><!@#%&]+)$/, "\"$1\"");
    return matcher;
}
function genLexRule (rule) {
    return rule.match(/\n/) ? '%{' + rule + '%}' : rule;
}

exports.convert = json2jison;

