
import Jison from './jison.js';

import json5 from '@gerhobbelt/json5';
import helpers from '../packages/helpers-lib';           // jison-helpers-lib
var rmCommonWS = helpers.rmCommonWS;
var mkIdentifier = helpers.mkIdentifier;
import process from 'process';
import nomnom from '@gerhobbelt/nomnom';
import fs from 'fs';
import path from 'path';
import assert from 'assert';


assert(Jison);
assert(typeof Jison.prettyPrint === 'function');
assert(Jison.defaultJisonOptions);
assert(typeof Jison.mkStdOptions === 'function');
assert(typeof Jison.Generator === 'function');


var version = '0.6.1-214';


function getCommandlineOptions() {
    'use strict';

    var defaults = Jison.defaultJisonOptions;
    var opts = nomnom
        .script('jison')
        .unknownOptionTreatment(false)              // do not accept unknown options!
        .produceExplicitOptionsOnly(true)
        .options({
            file: {
                flag: true,
                position: 0,
                help: 'file containing a grammar.'
            },
            lexfile: {
                flag: true,
                position: 1,
                help: 'file containing a lexical grammar.'
            },
            json: {
                abbr: 'j',
                flag: true,
                default: defaults.json,
                help: 'jison will expect a grammar in either JSON/JSON5 or JISON format: the precise format is autodetected.'
            },
            outfile: {
                abbr: 'o',
                metavar: 'FILE',
                help: 'Filepath and base module name of the generated parser. When terminated with a "/" (dir separator) it is treated as the destination directory where the generated output will be stored.'
            },
            debug: {
                abbr: 't',
                flag: true,
                default: defaults.debug,
                help: 'Debug mode.'
            },
            dumpSourceCodeOnFailure: {
                full: 'dump-sourcecode-on-failure',
                flag: true,
                default: defaults.dumpSourceCodeOnFailure,
                help: 'Dump the generated source code to a special named file when the internal generator tests fail, i.e. when the generated source code does not compile in the JavaScript engine. Enabling this option helps you to diagnose/debug crashes (thrown exceptions) in the code generator due to various reasons: you can, for example, load the dumped sourcecode in another environment (e.g. NodeJS) to get more info on the precise location and cause of the compile failure.'
            },
            throwErrorOnCompileFailure: {
                full: 'throw-on-compile-failure',
                flag: true,
                default: defaults.throwErrorOnCompileFailure,
                help: 'Throw an exception when the generated source code fails to compile in the JavaScript engine. **WARNING**: Turning this feature OFF permits the code generator to produce non-working source code and treat that as SUCCESS. This MAY be desirable code generator behaviour, but only rarely.'
            },
            reportStats: {
                full: 'info',
                abbr: 'I',
                flag: true,
                default: defaults.reportStats,
                help: 'Report some statistics about the generated parser.'
            },
            moduleType: {
                full: 'module-type',
                abbr: 'm',
                default: defaults.moduleType,
                metavar: 'TYPE',
                choices: ['commonjs', 'cjs', 'amd', 'umd', 'js', 'iife', 'es'],
                help: 'The type of module to generate.'
            },
            moduleName: {
                full: 'module-name',
                abbr: 'n',
                metavar: 'NAME',
                default: defaults.defaultModuleName,
                help: 'The name of the generated parser object, namespace supported.'
            },
            parserType: {
                full: 'parser-type',
                abbr: 'p',
                default: defaults.type,
                metavar: 'TYPE',
                help: 'The type of algorithm to use for the parser. (lr0, slr, lalr, lr, ll)'
            },
            compressTables: {
                full: 'compress-tables',
                abbr: 'c',
                flag: false,
                default: defaults.compressTables,             // 0, 1, 2
                choices: [0, 1, 2],
                help: 'Output compressed parser tables in generated modules. (0 = no compression, 1 = default compression, 2 = deep compression)'
            },
            outputDebugTables: {
                full: 'output-debug-tables',
                abbr: 'T',
                flag: true,
                default: defaults.outputDebugTables,
                help: 'Output extra parser tables (rules list + look-ahead analysis) in generated modules to assist debugging / diagnostics purposes.'
            },
            hasDefaultResolve: {
                full: 'default-resolve',
                abbr: 'X',
                flag: true,
                default: !defaults.noDefaultResolve,
                help: 'Turn this OFF to make jison act another way when a conflict is found in the grammar.'
            },
            hasPartialLrUpgradeOnConflict: {
                full: 'partial-lr-upgrade-on-conflict',
                abbr: 'Z',
                flag: true,
                default: defaults.hasPartialLrUpgradeOnConflict,
                help: 'When enabled, the grammar generator attempts to resolve LALR(1) conflicts by, at least for the conflicting rules, moving towards LR(1) behaviour.'
            },
            noDefaultAction: {
                flag: false,
                callback: function () {
                    // FAIL when found:
                    return this.help;
                },
                help: 'OBSOLETED. Use \'--default-action=[for-value,for-location]\' instead. (See below in \'--help\' output.)'
            },
            defaultActionMode: {
                full: 'default-action',
                flag: false,
                default: defaults.defaultActionMode,
                callback: function (val) {
                    // split value at comma, expect zero, one or two values:
                    var v = ('' + val).split(',');
                    if (v.length > 2) {
                        return 'default-action=yyval,yylloc expects at most 2 modes! You specified ' + v.length;
                    }
                },
                transform: function (val) {
                    // split value at comma, expect zero, one or two values:
                    var option = this;
                    var def = option.default;
                    var v = ('' + val).split(',').map(function cvt_modes(mode, idx) {
                        mode = mode.trim();
                        switch (mode) {
                        case 'false':
                        case '0':
                            return "none";

                        case 'true':
                        case '1':
                        case '':
                            return def[idx];

                        default:
                            return mode;
                        }
                    });
                    if (v.length === 1) {
                        v[1] = v[0];
                    }
                    return v;
                },
                help: rmCommonWS`
                    Specify the kind of default action that jison should include for every parser rule.

                    You can specify a mode for *value handling* ("$$") and one for *location tracking* ("@$"), separated by a comma, e.g.:
                        --default-action=ast,none

                    Supported value modes:
                    - classic : generate a parser which includes the default
                                    $$ = $1;
                                action for every rule.
                    - ast     : generate a parser which produces a simple AST-like tree-of-arrays structure: every rule produces an array of its production terms' values. Otherwise it is dentical to "classic" mode.
                    - none    : JISON will produce a slightly faster parser but then you are solely responsible for propagating rule action "$$" results. The default rule value is still deterministic though as it is set to "undefined": "$$ = undefined;"
                    - skip    : same as "none" mode, except JISON does NOT INJECT a default value action ANYWHERE, hence rule results are not deterministic when you do not properly manage the "$$" value yourself!

                    Supported location modes:
                    - merge   : generate a parser which includes the default "@$ = merged(@1..@n);" location tracking action for every rule, i.e. the rule\'s production \'location\' is the range spanning its terms.
                    - classic : same as "merge" mode.
                    - ast     : ditto.
                    - none    : JISON will produce a slightly faster parser but then you are solely responsible for propagating rule action "@$" location results. The default rule location is still deterministic though, as it is set to "undefined": "@$ = undefined;"
                    - skip    : same as "none" mode, except JISON does NOT INJECT a default location action ANYWHERE, hence rule location results are not deterministic when you do not properly manage the "@$" value yourself!

                    Notes:
                    - when you do specify a value default mode, but DO NOT specify a location value mode, the latter is assumed to be the same as the former. Hence:
                          --default-action=ast
                      equals:
                          --default-action=ast,ast
                    - when you do not specify an explicit default mode or only a "true"/"1" value, the default is assumed: "ast,merge".
                    - when you specify "false"/"0" as an explicit default mode, "none,none" is assumed. This produces the fastest deterministic parser.
                `
            },
            hasTryCatch: {
                full: 'try-catch',
                flag: true,
                default: !defaults.noTryCatch,
                help: 'Generate a parser which catches exceptions from the grammar action code or parseError error reporting calls using a try/catch/finally code block. When you turn this OFF, it will produce a slightly faster parser at the cost of reduced code safety.'
            },
            errorRecoveryTokenDiscardCount: {
                full: 'error-recovery-token-discard-count',
                abbr: 'Q',
                flag: false,
                default: defaults.errorRecoveryTokenDiscardCount,
                callback: function (count) {
                    if (count != parseInt(count)) {
                        return "count must be an integer";
                    }
                    count = parseInt(count);
                    if (count < 2) {
                        return "count must be >= 2";
                    }
                },
                transform: function (val) {
                    return parseInt(val);
                },
                help: 'Specify the number of lexed tokens that may be gobbled by an error recovery process before we cry wolf.'
            },
            exportAllTables: {
                full: 'export-all-tables',
                abbr: 'E',
                flag: true,
                default: defaults.exportAllTables,
                help: 'Next to producing a grammar source file, also export the symbols, terminals, grammar and parse tables to separate JSON files for further use by other tools. The files\' names will be derived from the outputFile name by appending a suffix.'
            },
            exportAST: {
                full: 'export-ast',
                optional: true,
                metavar: 'false|true|FILE',
                default: defaults.exportAST,
                help: 'Output grammar AST to file in JSON / JSON5 format (as identified by the file extension, JSON by default).',
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
                default: defaults.prettyCfg,
                help: 'Output the generated code pretty-formatted; turning this option OFF will output the generated code as-is a.k.a. \'raw\'.',
            },
            main: {
                full: 'main',
                abbr: 'x',
                flag: true,
                default: !defaults.noMain,
                help: 'Include .main() entry point in generated commonjs module.'
            },
            moduleMain: {
                full: 'module-main',
                abbr: 'y',
                metavar: 'NAME',
                help: 'The main module function definition.'
            },
            version: {
                abbr: 'V',
                flag: true,
                help: 'Print version and exit.',
                callback: function () {
                    console.log(version);
                    process.exit(0);
                }
            }
        }).parse();

    if (opts.debug) {
        console.log("JISON CLI options:\n", opts);
    }

    return opts;
}

var cli = {
    main: function cliMain(opts) {
        //opts = Jison.mkStdOptions(opts);

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
                opts.moduleName = opts.defaultModuleName = mkIdentifier(name);
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
                    astpath = path.dirname(opts.outfile);
                }
                if (astpath && astpath.length > 0) {
                    astpath = astpath.replace(/[\\\/]$/, '') + '/';
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
                    // get the base name (i.e. the file name without extension)
                    // i.e. strip off only the extension and keep any other dots in the filename.
                    astname = path.basename(opts.outfile, path.extname(opts.outfile));

                    // Then add the name postfix '-AST' to ensure we won't collide with the input file.
                    astname += '-AST';
                    ext = '.jison';
                }

                opts.exportAST = path.normalize(astpath + astname + ext);
            }

            // Change CWD to the directory where the source grammar resides: this helps us properly
            // %include any files mentioned in the grammar with relative paths:
            var new_cwd = path.dirname(path.normalize(opts.file));
            process.chdir(new_cwd);

            var parser = cli.generateParserString(raw, lex, opts);

            // and change back to the CWD we started out with:
            process.chdir(original_cwd);

            opts.outfile = path.normalize(opts.outfile);
            mkdirp(path.dirname(opts.outfile));
            fs.writeFileSync(opts.outfile, parser, 'utf8');
            console.log('JISON output', 'for module [' + opts.moduleName + '] has been written to file:', opts.outfile);

            if (opts.exportAllTables.enabled) {
                // Determine the output file path 'template' for use by the exportAllTables
                // functionality:
                var out_base_fname = path.join(path.dirname(opts.outfile), path.basename(opts.outfile, path.extname(opts.outfile)));

                var t = opts.exportAllTables;

                for (var id in t) {
                    if (t.hasOwnProperty(id) && id !== 'enabled') {
                        var content = t[id];
                        if (content) {
                            var fname = out_base_fname + '.' + id.replace(/[^a-zA-Z0-9_]/g, '_') + '.json';
                            fs.writeFileSync(fname, JSON.stringify(content, null, 2), 'utf8');
                            console.log('JISON table export', 'for [' + id + '] has been written to file:', fname);
                        }
                    }
                }
            }

            if (opts.exportAST) {
                var content = opts.exportedAST;
                var fname = opts.exportAST;

                var ext = path.extname(fname);
                switch (ext) {
                case '.json5':
                case '.jison':
                case '.y':
                case '.yacc':
                case '.l':
                case '.lex':
                    content = Jison.prettyPrint(content, {
                        format: ext.substr(1)
                    });
                    break;

                default:
                case '.json':
                    content = JSON.stringify(content, null, 2);
                    break;
                }
                mkdirp(path.dirname(fname));
                fs.writeFileSync(fname, content, 'utf8');
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
    },

    generateParserString: function generateParserString(grammar, optionalLexSection, opts) {
        'use strict';

//      var settings = Jison.mkStdOptions(opts);

        var generator = new Jison.Generator(grammar, optionalLexSection, opts);
        var srcCode = generator.generate(opts);
        generator.reportGrammarInformation();

        // as `opts` is cloned inside `generator.generate()`, we need to fetch
        // the extra exported tables from the `options` member of the generator
        // itself:
        opts.exportAllTables = generator.options.exportAllTables;
        opts.exportedAST = generator.grammar;

        return srcCode;
    }
};


export default cli;


if (require.main === module) {
    var opts = getCommandlineOptions();
    cli.main(opts);
}

