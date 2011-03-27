#!/usr/bin/env node

// converts json grammar format to Jison grammar format

var IO = require('./util/io');

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

    for (key in grammar) if (grammar.hasOwnProperty(key)) {
        if (key === 'start') {
            s += "\n%start "+grammar.start+"\n\n";
        }
        else if (key === 'author') {
            s += "\n/* author: "+grammar.author+" */\n\n";
        }
        else if (key === 'comment') {
            s += "\n/* description: "+grammar.comment+" */\n\n";
        }
        else if (key === 'lex') {
            s += "%lex\n"+genLex(grammar.lex)+"/lex\n\n";
        }
        else if (key === 'operators') {
            for (var i=0; i<grammar.operators.length; i++) {
                s += "%"+grammar.operators[i][0]+' '+quoteSymbols(grammar.operators[i].slice(1).join(' '))+"\n";
            }
            s += "\n";
        }
    }

    return s;
}

function genBNF (bnf, options) {
    var s = "%%\n",
        sym;

    for (sym in bnf) if (bnf.hasOwnProperty(sym)) {
        s += ["\n",sym,'\n    : ', genHandles(bnf[sym], options),"\n    ;\n"].join("");
    }

    return s;
}

function genHandles (handle, options) {
    if (typeof handle === 'string') {
        return handle;
    } else { //array
        var s = "";
        for (var i=0; i< handle.length;i++) {
            if (typeof handle[i] === 'string' && handle[i]) {
                s += quoteSymbols(handle[i]);
            } else if (handle[i] instanceof Array) {
                s += (handle[i][0] && quoteSymbols(handle[i][0]));
                if (typeof handle[i][1] === 'string') {
                    if (!options.stripActions) {
                        s += handle[i][1].match(/\}/) ? 
                            "\n        {{"+handle[i][1]+(handle[i][1].match(/\}$/) ? ' ' : '')+"}}" :
                            "\n        {"+handle[i][1]+"}";
                    }
                    if (handle[i][2] && handle[i][2].prec) {
                        s += " %prec "+handle[i][2].prec;
                    }
                } else if (handle[i][1].prec) {
                    s += " %prec "+handle[i][1].prec;
                }
            }
            if (typeof handle[i+1] !== 'undefined')
                s += "\n    | ";
        }
        return s;
    }
}

function quoteSymbols (rhs) {
    rhs = rhs.split(' ');

    for (var i=0; i<rhs.length; i++) {
        rhs[i] = quoteSymbol(rhs[i]);
    }
    return rhs.join(' ');
}

function quoteSymbol (sym) {
    if (!/[a-zA-Z][a-zA-Z0-9_-]*/.test(sym)) {
        var quote = /'/.test(sym) ? '"' : "'";
        sym = quote+sym+quote;
    }
    return sym;
}


// Generate lex format from lex JSON

function genLex (lex) {
    var s = [];
    var indent = 28;

    if ('macros' in lex) {
        for (var macro in lex.macros) {
            s.push(macro, new Array(indent-macro.length+1).join(' '),lex.macros[macro], '\n');
        }
    }
    if ('startConditions' in lex) {
        var ps = [];
        var px = [];
        for (var st in lex.startConditions) {
            if (lex.startConditions[st])
                px.push(st);
            else
                ps.push(st);
        }
        if (ps.length) s.push('%s ', ps.join(' '));
        if (px.length) s.push('%x ', px.join(' '));
    }
    if ('actionInclude' in lex) {
        s.push('\n%{\n', lex.actionInclude, '\n%}\n');
    }
    s.push('\n%%\n');
    if ('rules' in lex) {
        for (var rule;rule=lex.rules.shift();) {
            if (rule.length > 2) s.push('<'+rule.shift().join(',')+'>');
            var reg = genLexRegex(rule[0]); 
            s.push(reg, new Array(indent-reg.length+1).join(' '), genLexRule(rule[1]), '\n');
        }
    }
    s.push('\n');

    return s.join('');
}
function genLexRegex (regex) {
    var matcher = regex.replace(/^([a-zA-Z0-9]+)\\b$/, "\"$1\"")
                       .replace(/\\([.*+?^${}()|[\]\/\\])/g,"$1")
                       .replace(/^\$$/,"<<EOF>>")
                       .replace(/^([.*+?^${}()|[\]\/\\\-;=,><!@#%&]+)$/,"\"$1\"")
    return matcher;
}
function genLexRule (rule) {
    return rule.match(/\n/) ? '%{'+rule+'%}' : rule;
}

exports.json2jison = json2jison;
exports.convert = json2jison;

exports.main = function main (args) {
    if(args.length == 1) return;

    var raw = IO.read(IO.join(IO.cwd(),args[1]));
    var name = IO.basename(args[1]).replace(/\..*$/g,'');
    var grammar = JSON.parse(raw);

    if ('bnf' in grammar || 'lex' in grammar) {
        IO.write(IO.join(IO.cwd(),name+".jison"), json2jison(grammar));
    }
};


if (typeof process !== 'undefined' || require.main === module)
    exports.main(IO.args);

