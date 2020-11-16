
import fs from 'fs';
import path from 'path';
import nomnom from '@gerhobbelt/nomnom';

import helpers from '../helpers-lib';
var mkIdentifier = helpers.mkIdentifier;

import RegExpLexer from './regexp-lexer.js';

var version = '0.6.5-222';                              // require('./package.json').version;


function getCommandlineOptions() {
    'use strict';

    var opts = nomnom
        .script('jison-lex')
        .unknownOptionTreatment(false)              // do not accept unknown options!
        .options({
            file: {
                flag: true,
                position: 0,
                help: 'file containing a lexical grammar.'
            },
            json: {
                abbr: 'j',
                flag: true,
                default: false,
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
                default: false,
                help: 'Debug mode.'
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
                help: 'Report some statistics about the generated parser.'
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
                help: 'The name of the generated parser object, namespace supported.'
            },
            main: {
                full: 'main',
            	abbr: 'x',
                flag: true,
                default: false,
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
        console.log("JISON-LEX CLI options:\n", opts);
    }

    return opts;
}


function cliMain(opts) {

    opts = RegExpLexer.mkStdOptions(opts);

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

        // Change CWD to the directory where the source grammar resides: this helps us properly
        // %include any files mentioned in the grammar with relative paths:
        var new_cwd = path.dirname(path.normalize(opts.file));
        process.chdir(new_cwd);

        var lexer = cli.generateLexerString(raw, opts);

        // and change back to the CWD we started out with:
        process.chdir(original_cwd);

        opts.outfile = path.normalize(opts.outfile);
        mkdirp(path.dirname(opts.outfile));
        fs.writeFileSync(opts.outfile, lexer);
        console.log('JISON-LEX output for module [' + opts.moduleName + '] has been written to file:', opts.outfile);
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
            console.log(cli.generateLexerString(raw, opts));
        });
    }

    // if an input file wasn't given, assume input on stdin
    if (opts.file) {
        processInputFile();
    } else {
        processStdin();
    }
}


function generateLexerString(lexerSpec, opts) {
    'use strict';

    // var settings = RegExpLexer.mkStdOptions(opts);
    var predefined_tokens = null;

    return RegExpLexer.generate(lexerSpec, predefined_tokens, opts);
}

var cli = {
    main: cliMain,
    generateLexerString: generateLexerString
};


export default cli;


if (require.main === module) {
    var opts = getCommandlineOptions();
    cli.main(opts);
}

