#!/usr/bin/env node

var Jison = require('./jison.js');

var json5 = require('@gerhobbelt/json5');


function getCommandlineOptions() {
    'use strict';

    var version = require('../package.json').version;
    var opts = require('@gerhobbelt/nomnom')
        .script('jison')
        .unknownOptionTreatment(false)              // do not accept unknown options!
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
                default: false,
                help: 'jison will expect a grammar in either JSON/JSON5 or JISON format: the precise format is autodetected'
            },
            outfile: {
                abbr: 'o',
                metavar: 'FILE',
                help: 'Filepath and base module name of the generated parser;\nwhen terminated with a / (dir separator) it is treated as the destination directory where the generated output will be stored'
            },
            debug: {
                abbr: 't',
                flag: true,
                default: false,
                help: 'Debug mode'
            },
            dumpSourceCodeOnFailure: {
                full: 'dump-sourcecode-on-failure',
                flag: true,
                default: true,
                help: 'Dump the generated source code to a special named file when the internal generator tests fail, i.e. when the generated source code does not compile in the JavaScript engine. Enabling this option helps you to diagnose/debug crashes (thrown exceptions) in the code generator due to various reasons: you can, for example, load the dumped sourcecode in another environment (e.g. NodeJS) to get more info on the precise location and cause of the compile failure.'
            },
            throwErrorOnCompileFailure: {
                full: 'throw-on-compile-failure',
                flag: true,
                default: true,
                help: 'Throw an exception when the generated source code fails to compile in the JavaScript engine. **WARNING**: Turning this feature OFF permits the code generator to produce non-working source code and treat that as SUCCESS. This MAY be desirable code generator behaviour, but only rarely.'
            },
            reportStats: {
                full: 'info',
                abbr: 'I',
                flag: true,
                default: false,
                help: 'Report some statistics about the generated parser'
            },
            moduleType: {
                full: 'module-type',
                abbr: 'm',
                default: 'commonjs',
                metavar: 'TYPE',
                choices: ['commonjs', 'amd', 'js', 'es'],
                help: 'The type of module to generate (commonjs, amd, es, js)'
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
            compressTables: {
                full: 'compress-tables',
                abbr: 'c',
                flag: false,
                default: 2,             // 0, 1, 2
                choices: [0, 1, 2],
                help: 'Output compressed parser tables in generated modules (0 = no compression, 1 = default compression, 2 = deep compression)'
            },
            outputDebugTables: {
                full: 'output-debug-tables',
                abbr: 'T',
                flag: true,
                default: false,
                help: 'Output extra parser tables (rules list + look-ahead analysis) in generated modules to assist debugging / diagnostics purposes'
            },
            hasDefaultResolve: {
                full: 'default-resolve',
                abbr: 'X',
                flag: true,
                default: true,
                help: 'Turn this OFF to make jison act another way when a conflict is found in the grammar'
            },
            hasPartialLrUpgradeOnConflict: {
                full: 'partial-lr-upgrade-on-conflict',
                abbr: 'Z',
                flag: true,
                default: true,
                help: 'When enabled, the grammar generator attempts to resolve LALR(1) conflicts by, at least for the conflicting rules, moving towards LR(1) behaviour'
            },
            hasDefaultAction: {
                full: 'default-action',
                flag: true,
                default: true,
                help: 'Generate a parser which includes the default "$$ = $1" action for every rule. When you turn this OFF, it will produce a slightly faster parser but then you are solely responsible for propagating rule action "$$" results.'
            },
            hasTryCatch: {
                full: 'try-catch',
                flag: true,
                default: true,
                help: 'Generate a parser which catches exceptions from the grammar action code or parseError error reporting calls using a try/catch/finally code block. When you turn this OFF, it will produce a slightly faster parser at the cost of reduced code safety.'
            },
            errorRecoveryTokenDiscardCount: {
                full: 'error-recovery-token-discard-count',
                abbr: 'Q',
                flag: false,
                default: 3,
                callback: function (count) {
                    if (count != parseInt(count)) {
                        return "count must be an integer";
                    }
                    count = parseInt(count);
                    if (count < 2) {
                        return "count must be >= 2";
                    }
                },
                help: 'Specify the number of lexed tokens that may be gobbled by an error recovery process before we cry wolf'
            },
            exportAllTables: {
                full: 'export-all-tables',
                abbr: 'E',
                flag: true,
                default: false,
                help: 'Next to producing a grammar source file, also export the symbols, terminals, grammar and parse tables to separate JSON files for further use by other tools. The files\' names will be derived from the outputFile name by appending a suffix.'
            },
            exportAST: {
                full: 'export-ast',
                metavar: 'false|true|FILE',
                help: 'Output grammar AST to file in JSON / JSON5 format (as identified by the file extension, JSON by default)',
                transform: function (val) {
                    switch (val) {
                    case 'false':
                    case '0':
                        return false;

                    case 'true':
                    case '1':
                        return true;

                    default:
                        return val;
                    }
                }
            },
            prettyCfg: {
                full: 'pretty',
                flag: true,
                metavar: 'false|true|CFGFILE',
                default: true,
                help: 'Output the generated code pretty-formatted; turning this option OFF will output the generated code as-is a.k.a. \'raw\'',
            }, 
            main: {
                full: 'main',
                abbr: 'x',
                flag: true,
                default: false,
                help: 'Include .main() entry point in generated commonjs module'
            },
            moduleMain: {
                full: 'module-main',
                abbr: 'y',
                metavar: 'NAME',
                help: 'The main module function definition'
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
    'use strict';

    opts = Jison.mkStdOptions(opts);

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

    function processInputFile() {
        // getting raw files
        var lex;
        var original_cwd = process.cwd();

        if (opts.lexfile) {
            lex = fs.readFileSync(path.normalize(opts.lexfile), 'utf8');
        }
        var raw = fs.readFileSync(path.normalize(opts.file), 'utf8');

        // making best guess at json mode
        opts.json = path.extname(opts.file) === '.json' || opts.json;

        // When only the directory part of the output path was specified, then we
        // do NOT have the target module name in there as well!
        var outpath = opts.outfile;
        if (typeof outpath === 'string') {
            if (/[\\\/]$/.test(outpath) || isDirectory(outpath)) {
                opts.outfile = null;
                outpath = outpath.replace(/[\\\/]$/, '');
            } else {
                outpath = path.dirname(outpath);
            }
        } else {
            outpath = null;
        }
        if (outpath && outpath.length > 0) {
            outpath += '/';
        } else {
            outpath = '';
        }

        // setting output file name and module name based on input file name
        // if they aren't specified.
        var name = path.basename(opts.outfile || opts.file);

        // get the base name (i.e. the file name without extension)
        // i.e. strip off only the extension and keep any other dots in the filename
        name = path.basename(name, path.extname(name));

        opts.outfile = opts.outfile || (outpath + name + '.js');
        if (!opts.moduleName && name) {
            opts.moduleName = opts.defaultModuleName = name.replace(/-\w/g,
                function (match) {
                    return match.charAt(1).toUpperCase();
                });
        }

        if (opts.exportAST) {
            // When only the directory part of the AST output path was specified, then we
            // still need to construct the JSON AST output file name!
            var astpath, astname, ext;

            astpath = opts.exportAST;
            if (typeof astpath === 'string') {
                if (/[\\\/]$/.test(astpath) || isDirectory(astpath)) {
                    opts.exportAST = null;
                    astpath = astpath.replace(/[\\\/]$/, '');
                } else {
                    astpath = path.dirname(astpath);
                }
            } else {
                astpath = null;
            }
            if (astpath && astpath.length > 0) {
                astpath += '/';
            } else {
                astpath = '';
            }

            // setting AST output file name and module name based on input file name
            // if they aren't specified.
            if (typeof opts.exportAST === 'string') {
                astname = path.basename(opts.exportAST);
                ext = path.extname(astname);

                // get the base name (i.e. the file name without extension)
                // i.e. strip off only the extension and keep any other dots in the filename.
                astname = path.basename(astname, ext);
            } else {
                astname = path.basename(opts.file);
                ext = path.extname(astname);

                // get the base name (i.e. the file name without extension)
                // i.e. strip off only the extension and keep any other dots in the filename.
                //
                // Then add the name postfix '-AST' to ensure we won't collide with the input file.
                astname = path.basename(astname, ext) + '-AST';
            }
            if (ext !== '.json5') {
                ext = '.json';
            }

            opts.exportAST = astpath + astname + ext;
        }

        // Change CWD to the directory where the source grammar resides: this helps us properly
        // %include any files mentioned in the grammar with relative paths:
        var new_cwd = path.dirname(path.normalize(opts.file));
        process.chdir(new_cwd);

        var parser = cli.generateParserString(raw, lex, opts);

        // and change back to the CWD we started out with:
        process.chdir(original_cwd);

        mkdirp(path.dirname(opts.outfile));
        fs.writeFileSync(opts.outfile, parser);
        console.log('JISON output', 'for module [' + opts.moduleName + '] has been written to file:', opts.outfile);

        if (opts.exportAllTables) {
            // Determine the output file path 'template' for use by the exportAllTables
            // functionality:
            var out_ext = path.extname(opts.outfile);
            var out_re = new RegExp(out_ext.replace(/\./g, '\\.') + '$');           // re = /\.<ext>$/
            //opts.outfiletemplate = opts.outfile.replace(out_re, '@@');

            var t = opts.exportAllTables;

            for (var id in t) {
                if (t.hasOwnProperty(id) && id !== 'enabled') {
                    var content = t[id];
                    if (content) {
                        var fname = opts.outfile.replace(out_re, '.' + id.replace(/[^a-zA-Z0-9_]/g, '_') + '.json');
                        fs.writeFileSync(fname, JSON.stringify(content, null, 2));
                        console.log('JISON table export', 'for [' + id + '] has been written to file:', fname);
                    }
                }
            }
        }

        if (opts.exportAST) {
            var content = opts.exportedAST;
            var fname = opts.exportAST;

            if (/.json5$/.test(fname)) {
                content = json5.stringify(content, null, 2);
            } else {
                content = JSON.stringify(content, null, 2);
            }
            fs.writeFileSync(fname, content);
            console.log('Grammar AST export', 'for module [' + opts.moduleName + '] has been written to file:', fname);
        }
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

    function processStdin() {
        readin(function processStdinReadInCallback(raw) {
            console.log('', cli.generateParserString(raw, null, opts));
        });
    }

    // if an input file wasn't given, assume input on stdin
    if (opts.file) {
        processInputFile();
    } else {
        processStdin();
    }
};

cli.generateParserString = function generateParserString(grammar, optionalLexSection, opts) {
    'use strict';

    var settings = Jison.mkStdOptions(opts);

    var generator = new Jison.Generator(grammar, optionalLexSection, settings);
    var srcCode = generator.generate(settings);
    generator.reportGrammarInformation();

    // as `settings` is cloned inside `generator.generate()`, we need to fetch
    // the extra exported tables from the `options` member of the generator
    // itself:
    opts.exportAllTables = generator.options.exportAllTables;
    opts.exportedAST = generator.grammar;

    return srcCode;
};


if (require.main === module) {
    var opts = getCommandlineOptions();
    cli.main(opts);
}

