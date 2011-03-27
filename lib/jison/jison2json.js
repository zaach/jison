#!/usr/bin/env node

// Encodes Jison formatted grammars as JSON

var JISON = require('../jison'),
    IO = require('./util/io');

exports.main = function (argv) {
    if(argv.length == 1) return;

    var args = argv.slice(1);

    if (args.length) {
        var raw = IO.read(IO.join(IO.cwd(),args[0])),
            lex;
        if (args[1]) {
            lex = IO.read(IO.join(IO.cwd(),args[1]));
        }

        IO.stdout(processGrammar(raw, lex));
    } else {
        var read = false;
        IO.stdin(function (raw) {
            read = true;
            IO.stdout(processGrammar(raw));
        });
        setTimeout(function (){if(!read)IO.exit()}, 100);
    }
}

function processGrammar (rawGrammar, lex) {
    var grammar = require("./bnf").parse(rawGrammar);
    if (lex) grammar.lex = require("./jisonlex").parse(lex);
    grammar.bnf = grammar.bnf;
    return JSON.stringify(grammar,null, '  ');
}

if (typeof process !== 'undefined' || require.main === module)
    exports.main(IO.args);

