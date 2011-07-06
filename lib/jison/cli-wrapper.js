#!/usr/bin/env node

var JISON = require('../jison'),
    IO = require('./util/io'),
    nomnom = require('nomnom');

var opts = [
  { name: 'file',
    position: 0,
    help: 'Grammar file'
  },
  { name: 'lexfile',
    position: 1,
    help: 'Lexical grammar file (optional)'
  },
  { name: 'outfile',
    string: '-o FILE, --output-file=FILE',
    help: 'Filename and base module name of the generated parser'
  },
  { name: 'debug',
    string: '-t, --debug',
    "default": false,
    help: 'Use debug mode'
  },
  { name: 'version',
    string: '-V, --version',
    help: 'Version number'
  }
];

var args;
exports.main = function (argv) {
    argv.shift();
    args = nomnom.parseArgs(opts, {script: 'jison', printFunc: function (s) {IO.p(s); IO.exit(0);}}, argv);

    if (args.version) {
        IO.p(readVersion());
        IO.exit(0);
    }

    if (args.file) {
        var raw = IO.read(IO.join(IO.cwd(),args.file)),
            name = IO.basename((args.outfile||args.file)).replace(/\..*$/g,''),
            lex;
        if (args.lexfile) {
            lex = IO.read(IO.join(IO.cwd(),args.lexfile));
        }
        IO.write(args.outfile||(name+'.js'), processGrammar(raw, lex, name));
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
    var grammar = require("./bnf").parse(rawGrammar);
    var opt = grammar.options || {};
    if (lex) grammar.lex = require("./jisonlex").parse(lex);
    opt.debug = args.debug;
    if (!opt.moduleType) opt.moduleType = "commonjs";
    if (!opt.moduleName && name) opt.moduleName = name.replace(/-\w/g, function (match){ return match.charAt(1).toUpperCase(); });

    var generator = new JISON.Generator(grammar, opt);
    return generator.generate(opt);
}

if (typeof process !== 'undefined' || require.main === module)
    exports.main(IO.args);
