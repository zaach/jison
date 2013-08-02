#!/usr/bin/env node

var jison      = require('./jison.js');
var nomnom     = require('nomnom');
var fs         = require('fs');
var path       = require('path');
var ebnfParser = require('ebnf-parser');
var lexParser  = require('lex-parser');
var cjson      = require('cjson');

var version = require('../package.json').version;

var opts = require("nomnom")
  .script('jison')
  .option('file', {
    flag: true,
    position: 0,
    help: 'file containing a grammar'
  })
  .option('lexfile', {
    flag: true,
    position: 1,
    help: 'file containing a lexical grammar'
  })
  .option('json', {
    abbr: 'j',
    flag: true,
    help: 'force jison to expect a grammar in JSON format'
  })
  .option('outfile', {
    abbr: 'o',
    metavar: 'FILE',
    help: 'Filename and base module name of the generated parser'
  })
  .option('debug', {
    abbr: 't',
    flag: true,
    default: false,
    help: 'Debug mode'
  })
  .option('module-type', {
    abbr: 'm',
    default: 'commonjs',
    metavar: 'TYPE',
    help: 'The type of module to generate (commonjs, amd, js)'
  })
  .option('parser-type', {
    abbr: 'p',
    default: 'lalr',
    metavar: 'TYPE',
    help: 'The type of algorithm to use for the parser (lr0, slr, lalr, lr)'
  })
  .option('version', {
    abbr: 'V',
    flag: true,
    help: 'print version and exit',
    callback: function() {
       return version;
    }
  })
  .parse();


exports.main = function () {
    if (opts.file) {
        var raw = fs.readFileSync(path.normalize(opts.file), 'utf8');
        var jsonMode = path.extname(opts.file) === '.json' || opts.json;
        var name = path.basename((opts.outfile||opts.file)).replace(/\..*$/g,'');
        var lex;

        if (opts.lexfile) {
            lex = fs.readFileSync(path.normalize(opts.lexfile), 'utf8');
        }

        fs.writeFileSync(opts.outfile||(name + '.js'), processGrammar(raw, lex, name, jsonMode));
    } else {
        readin(function (raw) {
            console.log(processGrammar(raw, null, null, opts.json));
        });
    }
};

function processGrammar (file, lexFile, name, jsonMode) {
    var grammar;
    if (jsonMode) {
        grammar = cjson.parse(file);
    } else {
        // otherwise, attempt to parse jison format
        // fallback to JSON
        try {
            grammar = ebnfParser.parse(file);
        } catch (e) {
            try {
                grammar = cjson.parse(file);
            } catch (e2) {
                throw e;
            }
        }
    }

    var settings = grammar.options || {};

    if (opts['parser-type']) settings.type = opts['parser-type'];
    if (lexFile) grammar.lex = lexParser.parse(lexFile);
    settings.debug = opts.debug;
    if (!settings.moduleType) settings.moduleType = opts['module-type'];
    if (!settings.moduleName && name) {
        settings.moduleName = name.replace(/-\w/g,
            function (match){
                return match.charAt(1).toUpperCase();
            });
    }

    var generator = new jison.Generator(grammar, settings);
    return generator.generate(settings);
}

function readin (cb) {
    var stdin = process.openStdin(),
        data = '';

    stdin.setEncoding('utf8');
    stdin.addListener('data', function (chunk) {
        data += chunk;
    });
    stdin.addListener('end', function () {
        cb(data);
    });
}

if (require.main === module)
    exports.main();

