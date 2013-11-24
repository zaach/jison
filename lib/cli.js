#!/usr/bin/env node
/*jslint
    white: true,
    vars: true,
    stupid: true,
    node: true
*/

/**
 * jison's cli
 * @fileoverview The cli for jison
 */

/**
 * Container for cli related functions.
 * @namespace Container for cli related functions.
 */
var cli = exports;
/**
 * Generates a parser and writes it to a file.
 * @param {Object} [opts = {}]
 *  Options object.
 * @param {String} [opts.file = null]
 *  Path to a file containing a grammar. If no file is specified input will be
 *  read from stdin.
 * @param {String} [opts.lexfile = null]
 *  Path to a file containing a lexical grammar.
 * @param {String} [opts.outfile = opts.file.replace(/\.[^.]*$/, ".js")]
 *  The path and filename where the parser should be written to. Defaults to the
 *  path and filename given for <code>file</code> with the file extension
 *  replaced by <code>js</code>.
 * @param {Boolean} [opts.json = false]
 *  Set to true if `file` is in json format.
 * @param {String} [opts.moduleName = "parser"]
 *  The internal name for your module in the generated parser.
 * @param {Boolean} [opts.debug = false] Debug mode.
 * @param {String} [opts['module-type'] = "commonjs"]
 *  The module type of the generated parser. Options are: <code>commonjs</code>,
 *  <code>amd</code>, <code>and</code> <code>js</code>.
 * @param {String} [opts['parser-type'] = "lalr"]
 *  The type of parser to generate. Options are: <code>lr0</code>,
 *  <code>slr</code>, <code>lalr</code>, and <code>lr</code>.
 * @example
 *  // grammar to process is not json and contains grammars for lexer and
 *  // parser.
 *  var jisonCli = require('./node_modules/jison/lib/cli.js');
 *  var options = {
 *      file : "myfile.jison",
 *      moduleName : "myModule"
 *  };
 *  jisonCli.main(options);
 * @example
 *  // grammar to process is not json and is divided into two files containing
 *  // the grammars for the lexer and parser seperately.
 *  var jisonCli = require('./node_modules/jison/lib/cli.js');
 *  var options = {
 *      file : "myfile.y",
 *      lexfile : "myfile.l",
 *      moduleName : "myModule"
 *  };
 *  jisonCli.main(options);
 * @example
 *  // grammar to process is in json format, desired module type is amd, and
 *  // desired parser type is lr0.
 *  var jisonCli = require('./node_modules/jison/lib/cli.js');
 *  var options = {
 *      file : "myfile.json",
 *      moduleName : "myModule",
 *      json : true,
 *      "module-type" : "amd",
 *      "parser-type" : "lr0"
 *  };
 *  jisonCli.main(options);
 */
cli.main = function cli_main(opts) {
    "use strict";
    opts = opts || {};
    /**
     * Generates a parser as a string.
     * @param {String} raw Contents of the file named in <code>opts.file</code>
     *  argument of {@link cli.main}
     * @param {String} lex Contents of the file named in <code>opts.lexfile</code>
     *  argument of {@link cli.main}
     * @param {Object} Options object supplied to {@link cli.main}
     * @private
     */
    function processGrammar(raw, lex, opts) {
        var grammar,
        parser;
        if (!opts.json) {
            grammar = cli.processGrammars(raw, lex, opts.json);
        }
        parser = cli.generateParserString(opts, grammar);
        return parser;
    }
    /**
     * Processes input from a file.
     * @private
     * @requires <a href="http://nodejs.org/api/fs.html">fs</a>
     * @requires <a href="http://nodejs.org/api/path.html">path</a>
     */
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
        /*jslint regexp: true */
        name = name.replace(/\..*$/g, '');
        /*jslint regexp: false */
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
    /**
     * Reads from stdin and calls the callback on the data received.
     * @param {Function} cb The callback function to execute on the received
     *  data.
     * @private
     */
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
    /**
     * Processes input from stdin.
     * @private
     */
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
/**
 * Generates a parser and returns it as a string.
 * @param {Object} [opts = {}]
 *  An options object.
 * @param {Boolean} [opts.json]
 *  See the description in {@link cli.main}
 * @param {String} [opts.moduleName]
 *  See the description in {@link cli.main}
 * @param {Object} [opts.debug]
 *  See the description in {@link cli.main}
 * @param {Object} [opts['parser-type']]
 *  See the description in {@link cli.main}
 * @param {Object} [opts['module-type']]
 *  See the description in {@link cli.main}
 * @param {String|Object} grammar The grammar to generate a parser from.
 * @returns {String} Returns the generated parser as a string.
 * @requires <a href="https://npmjs.org/package/jison/">jison</a>
 */
cli.generateParserString = function generateParserString(opts, grammar) {
    "use strict";
    opts = opts || {};
    var jison = require('./jison.js');

    var settings = grammar.options || {};

    if (opts['parser-type']) {
        settings.type = opts['parser-type'];
    }
    settings.debug = opts.debug;
    if (!settings.moduleType) {
        settings.moduleType = opts['module-type'];
    }

    var generator = new jison.Generator(grammar, settings);
    return generator.generate(settings);
};
/**
 * Processes grammar files of various format.
 * @param {String} file Contents of a jison grammar file.
 * @param {String} [lexFile] Contents of a lexer grammar file.
 * @param {Boolean} [jsonMode = false] Set to true if <code>file</code> is in
 *  json format.
 * @returns {Object} Returns the parsed grammar object.
 * @requires <a href="https://npmjs.org/package/ebnf-parser">ebnf-parser</a>
 * @requires <a href="https://npmjs.org/package/cjson">cjson</a>
 * @requires <a href="https://npmjs.org/package/lex-parser">lex-parser</a>
 */
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
/**
 * Initialization function, grabs commandline arguments and passes them to
 *  {@link cli.main} if this script was called from the commandline.
 * @private
 * @methodOf cli
 * @requires <a href="https://npmjs.org/package/nomnom">nomnom</a>
 */
function cli_init () {
    "use strict";
    /**
     * Gets options from the commandline.
     * @private
     * @requires <a href="https://npmjs.org/package/nomnom">nomnom</a>
     */
    function getCommandlineOptions () {
        var version = require('../package.json').version;
        var opts = require("nomnom")
            .script('jison')
            .option('file', {
                flag : true,
                position : 0,
                help : 'file containing a grammar'
            })
            .option('lexfile', {
                flag : true,
                position : 1,
                help : 'file containing a lexical grammar'
            })
            .option('json', {
                abbr : 'j',
                flag : true,
                help : 'force jison to expect a grammar in JSON format'
            })
            .option('outfile', {
                abbr : 'o',
                metavar : 'FILE',
                help : 'Filename and base module name of the generated parser'
            })
            .option('debug', {
                abbr : 't',
                flag : true,
            default:
                false,
                help : 'Debug mode'
            })
            .option('module-type', {
                abbr : 'm',
            default:
                'commonjs',
                metavar : 'TYPE',
                help : 'The type of module to generate (commonjs, amd, js)'
            })
            .option('parser-type', {
                abbr : 'p',
            default:
                'lalr',
                metavar : 'TYPE',
                help : 'The type of algorithm to use for the parser (lr0, slr,' +
                    'lalr, lr)'
            })
            .option('version', {
                abbr : 'V',
                flag : true,
                help : 'print version and exit',
                callback : function () {
                    return version;
                }
            }).parse();
            
        return opts;
    } // end of getCommandlineOptions

    if (require.main === module) {
        var opts = getCommandlineOptions();
        cli.main(opts);
    }
}

cli_init();
