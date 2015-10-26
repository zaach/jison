#!/usr/bin/env node

function getCommandlineOptions () {
    "use strict";
    var version = require('../package.json').version;
    var opts = require('nomnom')
        .script('jison')
        .options({
            file: {
                flag: true,
                position: 0,
                help: 'file containing a grammar'
            },
            lexfile: {
                flag: true,
                position: 1,
                help: 'file containing a lexical grammar'
            },
            json: {
                abbr: 'j',
                flag: true,
                help: 'force jison to expect a grammar in JSON format'
            },
            outfile: {
                abbr: 'o',
                metavar: 'FILE',
                help : 'Filepath and base module name of the generated parser;\nwhen terminated with a / (dir separator) it is treated as the destination directory where the generated output will be stored'
            },
            debug: {
                abbr: 't',
                flag: true,
                default: false,
                help: 'Debug mode'
            },
            moduleType: {
                full: 'module-type',
                abbr: 'm',
                default: 'commonjs',
                metavar: 'TYPE',
                choices: ['commonjs', 'amd', 'js'],
                help: 'The type of module to generate (commonjs, amd, js)'
            },
            moduleName: {
                full: 'module-name',
            	abbr: 'n',
            	metavar: 'NAME',
            	help: 'The name of the generated parser object, namespace supported'
            },
            parserType: {
                full: 'parser-type',
                abbr: 'p',
                default: 'lalr',
                metavar: 'TYPE',
                help: 'The type of algorithm to use for the parser (lr0, slr, lalr, lr, ll)'
            },
            main: {
                full: 'main',
                flag: true,
                default: false,
                help: 'Include .main() entry point in generated commonjs module'
            },
            version: {
                abbr: 'V',
                flag: true,
                help: 'print version and exit',
                callback: function () {
                    return version;
                }
            }
        }).parse();

    return opts;
}

var cli = module.exports;

cli.main = function cliMain(opts) {
    "use strict";
    opts = opts || {};

    var fs = require('fs');
    var path = require('path');

    function isDirectory(fp) {
        try {
            return fs.lstatSync(fp).isDirectory();
        } catch (e) {
            return false;
        }
    }

    function mkdirp(fp) {
        if (!fp || fp === '.' || fp.length === 0) {
            return false;
        }
        try {
            fs.mkdirSync(fp);
            return true;
        } catch (e) {
            if (e.code === 'ENOENT') {
                var parent = path.dirname(fp);
                // Did we hit the root directory by now? If so, abort!
                // Else, create the parent; iff that fails, we fail too...
                if (parent !== fp && mkdirp(parent)) {
                    try {
                        // Retry creating the original directory: it should succeed now
                        fs.mkdirSync(fp);
                        return true;
                    } catch (e) {
                        return false;
                    }
                }
            }
        }
        return false;
    }

    function processGrammar(raw, lex, opts) {
        var grammar = cli.processGrammars(raw, lex, opts.json);
        var parser = cli.generateParserString(opts, grammar);
        return parser;
    }

    function processInputFile () {
        // getting raw files
        var lex;
        if (opts.lexfile) {
            lex = fs.readFileSync(path.normalize(opts.lexfile), 'utf8');
        }
        var raw = fs.readFileSync(path.normalize(opts.file), 'utf8');

        // making best guess at json mode
        opts.json = path.extname(opts.file) === '.json' || opts.json;

        // When only the directory part of the output path was specified, then we
        // do NOT have the target module name in there as well!
        var outpath = opts.outfile;
        if (/[\\\/]$/.test(outpath) || isDirectory(outpath)) {
            opts.outfile = null;
            outpath = outpath.replace(/[\\\/]$/, '');
        }
        if (outpath && outpath.length > 0) {
            outpath += '/';
        } else {
            outpath = '';
        }

        // setting output file name and module name based on input file name
        // if they aren't specified.
        var name = path.basename((opts.outfile || opts.file));

        // get the base name (i.e. the file name without extension)
        // i.e. strip off only the extension and keep any other dots in the filename
        name = path.basename(name, path.extname(name));

        opts.outfile = opts.outfile || (outpath + name + '.js');
        if (!opts.moduleName && name) {
            opts.moduleName = name.replace(/-\w/g,
                function (match) {
                    return match.charAt(1).toUpperCase();
                });
        }

        var parser = processGrammar(raw, lex, opts);
        mkdirp(path.dirname(opts.outfile));
        fs.writeFileSync(opts.outfile, parser);
        console.log('JISON output for module [' + opts.moduleName + '] has been written to file:', opts.outfile);
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

    var settings = grammar.options || opts;

    if (opts.parserType) {
        settings.type = opts.parserType;
    }
    settings.debug = opts.debug;
    settings.noMain = !opts.main;
    if (!settings.moduleType) {
        settings.moduleType = opts.moduleType;
    }
    if (!settings.moduleName) {
        settings.moduleName = opts.moduleName;
    }

    var generator = new jison.Generator(grammar, settings);
    return generator.generate(settings);
};

cli.processGrammars = function processGrammars(file, lexFile, jsonMode) {
    "use strict";

    lexFile = lexFile || false;
    jsonMode = jsonMode || false;
    // use the local versions of these packages at all times as those are sure to be up-to-date in all environments (production, development)
    var ebnfParser = require('./util/ebnf-parser');
    var cjson = require('cjson');
    var grammar;
    try {
        if (jsonMode) {
            grammar = cjson.parse(file);
        } else {
            grammar = ebnfParser.parse(file);
        }
    } catch (e) {
        var err = new Error('Could not parse jison grammar\nError: ' + e.message);
        err.stack = e.stack;
        throw err;
    }
    try {
        if (lexFile) {
            grammar.lex = require('./util/lex-parser').parse(lexFile);
        }
    } catch (e) {
        var err = new Error('Could not parse lex grammar\nError: ' + e.message);
        err.stack = e.stack;
        throw err;
    }
    return grammar;
};


if (require.main === module) {
    var opts = getCommandlineOptions();
    cli.main(opts);
}
