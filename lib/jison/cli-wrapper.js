#!/usr/bin/env node

var JISON = require('../jison'),
    IO = require('./util/io'),
    nomnom = require('nomnom');


var args;
exports.main = function (argv) {
    argv.shift();
    args = nomnom
        .script('jison')
        .options({
            'file': {
                position: 0,
                help: 'Grammar file'
            },
            'lexfile': {
                position: 1,
                help: 'Lexical grammar file (optional)'
            },
            'outfile': {
                abbr: 'o',
                full: 'output-file',
                metavar: 'FILE',
                help: 'Filename and base module name of the generated parser'
            },
            'debug': {
                abbr: 't',
                flag: true,
                "default": false,
                help: 'Use debug mode'
            },
            'moduleType': {
                abbr: 'm',
                full: 'module-type',
                "default": "commonjs",
                choices: ['commonjs', 'amd', 'js'],
                help: 'The type of module to generate (commonjs, amd, js)'
            },
            'version': {
                abbr: 'V',
                full: 'version',
                help: 'Version number'
            }
        })
        .printer(function (s) {
            IO.p(s);
            IO.exit(0);
        })
        .parse(argv);

    if (args.version) {
        IO.p(readVersion());
        IO.exit(0);
    }

    if (args.file) {
        var raw = IO.read(IO.join(IO.cwd(), args.file)),
            name = IO.basename((args.outfile || args.file)).replace(/\..*$/g,''),
            lex;
        raw = raw.replace(/\r\n/g, '\n');
        if (args.lexfile) {
            lex = IO.read(IO.join(IO.cwd(), args.lexfile));
        }
        IO.write(args.outfile || (name+'.js'), processGrammar(raw, lex, name));
    } else {
        IO.stdin(function (raw) {
            IO.stdout(processGrammar(raw));
        });
    }
}

function readVersion () {
    var pack;
    try {
        pack = IO.read(IO.join(__dirname,'..','..','package.json'));
    } catch(e) {
        var fs = require("file");
        pack = fs.path(fs.dirname(module.id)).canonical().join('..','package.json')
            .read({charset: "utf-8"});
    }
    return JSON.parse(pack).version;
}

function processGrammar (rawGrammar, lex, name) {
    var grammar;
    try {
        grammar = require("./bnf").parse(rawGrammar);
    } catch (e) {
        try {
            grammar = JSON.parse(rawGrammar);
        } catch (e2) {
            throw e;
        }
    }
    var opt = grammar.options || {};
    if (lex) grammar.lex = require("./jisonlex").parse(lex);
    opt.debug = args.debug;
    if (!opt.moduleType) opt.moduleType = args.moduleType;
    if (!opt.moduleName && name) opt.moduleName = name.replace(/-\w/g, function (match){ return match.charAt(1).toUpperCase(); });

    var generator = new JISON.Generator(grammar, opt);
    return generator.generate(opt);
}

if (typeof process !== 'undefined' || require.main === module)
    exports.main(IO.args);
