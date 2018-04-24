#!/usr/bin/env node

function getCommandlineOptions () {
    "use strict";
    var version = require('../package.json').version;
    var program = require("commander");

    program
        .version(version)
        .command('jison <file> <lexfile>', {isDefault: true})
        .option('-j, --json', 'force jison to expect a grammar in JSON format')
        .option('-o, --outfile <FILE>', 'Filename and base module name of the generated parser')
        .option('-t, --debug', 'Debug mode')
        .option('-m, --module-type <TYPE>', 'The type of module to generate (commonjs, amd, js)')
        .option('-p, --parser-type <TYPE>', 'The type of algorithm to use for the parser (lr0, slr, lalr, lr)')
        .option('-V, --version', 'print version and exit')

    return program.parse(process.argv);
}

var cli = module.exports;

cli.main = function cliMain(opts) {
    "use strict";
    opts = opts || {};

    function processGrammar(raw, lex, opts) {
        var grammar,
        parser;
        grammar = cli.processGrammars(raw, lex, opts.json);
        parser = cli.generateParserString(opts, grammar);
        return parser;
    }

    function processInputFile () {
        var fs = require('fs');
        var path = require('path');

        // getting raw files
        var lex;
        if (opts.lexfile) {
            lex = fs.readFileSync(path.normalize(opts.lexfile), 'utf8');
        }
        var raw = fs.readFileSync(path.normalize(opts.file), 'utf8');

        // making best guess at json mode
        opts.json = path.extname(opts.file) === '.json' || opts.json;

        // setting output file name and module name based on input file name
        // if they aren't specified.
        var name = path.basename((opts.outfile || opts.file));

        name = name.replace(/\..*$/g, '');

        opts.outfile = opts.outfile || (name + '.js');
        if (!opts.moduleName && name) {
            opts.moduleName = name.replace(/-\w/g,
                    function (match) {
                    return match.charAt(1).toUpperCase();
                });
        }

        var parser = processGrammar(raw, lex, opts);
        fs.writeFileSync(opts.outfile, parser);
    }

    function readin(cb) {
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

    function processStdin () {
        readin(function (raw) {
            console.log(processGrammar(raw, null, opts));
        });
    }

    // if an input file wasn't given, assume input on stdin
    if (opts.file) {
        processInputFile();
    } else {
        processStdin();
    }
};

cli.generateParserString = function generateParserString(opts, grammar) {
    "use strict";
    opts = opts || {};
    var jison = require('./jison.js');

    var settings = grammar.options || {};

    if (opts['parser-type']) {
        settings.type = opts['parser-type'] || 'lalr';
    }
    if (opts.moduleName) {
        settings.moduleName = opts.moduleName;
    }
    settings.debug = opts.debug;
    if (!settings.moduleType) {
        settings.moduleType = opts['module-type'] || 'commonjs';
    }

    var generator = new jison.Generator(grammar, settings);
    return generator.generate(settings);
};

cli.processGrammars = function processGrammars(file, lexFile, jsonMode) {
    "use strict";
    lexFile = lexFile || false;
    jsonMode = jsonMode || false;
    var ebnfParser = require('ebnf-parser');
    var cjson = require('cjson');
    var grammar;
    try {
        if (jsonMode) {
            grammar = cjson.parse(file);
        } else {
            grammar = ebnfParser.parse(file);
        }
    } catch (e) {
        throw new Error('Could not parse jison grammar');
    }
    try {
        if (lexFile) {
            grammar.lex = require('lex-parser').parse(lexFile);
        }
    } catch (e) {
        throw new Error('Could not parse lex grammar');
    }
    return grammar;
};


if (require.main === module) {
    var opts = getCommandlineOptions();
    cli.main(opts);
}
