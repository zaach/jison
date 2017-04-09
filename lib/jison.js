// Jison, an LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zach@carter.name>
// MIT Licensed

var typal      = require('./util/typal').typal;
var Set        = require('./util/set').Set;
var Lexer      = require('./util/regexp-lexer.js');
var ebnfParser = require('./util/ebnf-parser.js');
var lexParser  = require('./util/lex-parser.js');
var XRegExp    = require('xregexp');
//var recast     = require('recast');
//var codeShift  = require('jscodeshift');
var json5      = require('json5');
var assert     = require('assert');


var version = require('../package.json').version;

var devDebug = 0;

var Jison = exports.Jison = exports;
Jison.version = version;

// see also ./lib/cli.js
const defaultJisonOptions = {
    moduleType: 'commonjs',
    debug: false,
    enableDebugLogs: false,
    numExpectedConflictStates: 0,
    json: false,
    type: 'lalr',                   // CLI: --parserType option
    compressTables: 2,              // 0, 1, 2
    outputDebugTables: false,
    noDefaultResolve: false,
    noDefaultAction: false,
    noTryCatch: false,
    hasPartialLrUpgradeOnConflict: true,
    errorRecoveryTokenDiscardCount: 3,
    exportAllTables: false,
    noMain: false,                  // CLI: not:(--main option)
    tokenStack: false,

    moduleName: undefined,
    defaultModuleName: 'parser',
    file: undefined,
    outfile: undefined,
    inputPath: undefined,
    inputFilename: undefined,
    lexfile: undefined,
    warn_cb: undefined,  // function(msg) | true (= use Jison.Print) | false (= throw Exception)

    parseParams: undefined,
    lexer_errors_are_recoverable: false,
    ranges: undefined,
    showSource: false,
};

Jison.defaultJisonOptions = defaultJisonOptions;

// Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
function camelCase(s) {
    // Convert first character to lowercase
    return s.replace(/^\w/, function (match) {
        return match.toLowerCase();
    })
    .replace(/-\w/g, function (match) {
        return match.charAt(1).toUpperCase();
    });
}

// Merge sets of options.
//
// Convert alternative jison option names to their base option.
//
// The *last* option set which overrides the default wins, where 'override' is
// defined as specifying a not-undefined value which is not equal to the
// default value.
//
// Return a fresh set of options.
function mkStdOptions(/*args...*/) {
    var h = Object.prototype.hasOwnProperty;

    if (devDebug > 3) {
        Jison.print('mkStdOptions:\n', arguments);
    }

    // clone defaults, so we do not modify those constants.
    var opts = {};
    var o = Jison.defaultJisonOptions;

    for (var p in o) {
        if (h.call(o, p) && typeof o[p] !== 'undefined') {
            opts[p] = o[p];
        }
    }

    for (var i = 0, len = arguments.length; i < len; i++) {
        o = arguments[i];

        // clone input (while camel-casing the options), so we do not modify those either.
        var o2 = {};

        for (var p in o) {
            if (h.call(o, p) && typeof o[p] !== 'undefined') {
                o2[camelCase(p)] = o[p];
            }
        }

        // now clean them options up:
        if (typeof o2.main !== 'undefined') {
            o2.noMain = !o2.main;
        }
        if (typeof o2.hasDefaultResolve !== 'undefined') {
            o2.noDefaultResolve = !o2.hasDefaultResolve;
        }
        if (typeof o2.hasDefaultAction !== 'undefined') {
            o2.noDefaultAction = !o2.hasDefaultAction;
        }
        if (typeof o2.hasTryCatch !== 'undefined') {
            o2.noTryCatch = !o2.hasTryCatch;
        }
        if (typeof o2.parserType !== 'undefined') {
            o2.type = o2.parserType;
        }

        delete o2.parserType;
        delete o2.main;
        delete o2.hasDefaultResolve;
        delete o2.hasDefaultAction;
        delete o2.hasTryCatch;

        // special check for `moduleName` to ensure we detect the 'default' moduleName entering from the CLI
        // NOT overriding the moduleName set in the grammar definition file via an `%options` entry:
        if (o2.moduleName === o2.defaultModuleName) {
            delete o2.moduleName;
        }

        // now see if we have an overriding option here:
        for (var p in o2) {
            if (h.call(o2, p)) {
                if (o2[p] !== undefined && o2[p] !== Jison.defaultJisonOptions[p]) {
                    opts[p] = o2[p];
                }
            }
        }
    }

    return opts;
}


// Autodetect if the input grammar and optional lexer spec is in JSON or JISON
// format when the `options.json` flag is `true`.
//
// Produce the JSON parse result when these are JSON formatted already as that
// would save us the trouble of doing this again, anywhere else in the JISON
// compiler/generator.
//
// Otherwise return the *parsed* grammar and optional lexer specs as they have
// been processed through EBNFParser and LEXParser respectively.
function autodetectAndConvertToJSONformat(grammar, optionalLexerSection, options) {
    var chk_g = null;
    var chk_l = null;
    var ex1;

    if (typeof grammar === 'string') {
      if (options.json) {
        try {
            chk_g = json5.parse(grammar);

            // When JSON5-based parsing of the grammar succeeds, this implies the grammar is specified in `JSON mode`
            // *OR* there's a JSON/JSON5 format error in the input:
        } catch (e) {
            ex1 = e;
        }
      }
      if (!chk_g) {
        try {
            chk_g = ebnfParser.parse(grammar, options);
        } catch (e) {
            if (options.json) {
                err = new Error('Could not parse jison grammar in JSON AUTODETECT mode\nError: ' + ex1.message + ' (' + e.message + ')');
                err.secondary_exception = e;
                err.stack = ex1.stack;
            } else {
                err = new Error('Could not parse jison grammar\nError: ' + e.message);
                err.stack = e.stack;
            }
            throw err;
        }
      }

      // Save time! Don't reparse the entire grammar *again* inside the code generators when that's not necessary:
      // if (chk_g) {
      //   grammar = chk_g;
      // }
    } else {
        chk_g = grammar;
    }

    // Now the same treatment for the lexer:
    if (chk_g && optionalLexerSection) {
      if (chk_g.lex) {
          throw new Error('Cannot invoke with both a lexer section in the grammar input and a separate lexer input at the same time!');
      }

      if (typeof optionalLexerSection === 'string') {
        if (options.json) {
          try {
              chk_l = json5.parse(optionalLexerSection);

              // When JSON5-based parsing of the lexer spec succeeds, this implies the lexer spec is specified in `JSON mode`
              // *OR* there's a JSON/JSON5 format error in the input:
          } catch (e) {
              ex1 = e;
          }
        }
        if (!chk_l) {
          // // WARNING: the lexer may receive options specified in the **grammar spec file**,
          // //          hence we should mix the options to ensure the lexParser always
          // //          receives the full set!
          // //
          // // make sure all options are 'standardized' before we go and mix them together:
          // options = mkStdOptions(grammar.options, options);
          try {
              chk_l = lexParser.parse(optionalLexerSection, options);
          } catch (e) {
              if (options.json) {
                  err = new Error('Could not parse lexer spec in JSON AUTODETECT mode\nError: ' + ex1.message + ' (' + e.message + ')');
                  err.secondary_exception = e;
                  err.stack = ex1.stack;
              } else {
                  err = new Error('Could not parse lexer spec\nError: ' + e.message);
                  err.stack = e.stack;
              }
              throw err;
          }
        }
      } else {
        chk_l = optionalLexerSection;
      }

      // Save time! Don't reparse the entire lexer spec *again* inside the code generators when that's not necessary:
      if (chk_l) {
        chk_g.lex = chk_l;
      }
    }

    return chk_g;
}

Jison.mkStdOptions = mkStdOptions;
Jison.camelCase = camelCase;
Jison.autodetectAndConvertToJSONformat = autodetectAndConvertToJSONformat;

// detect print
if (typeof console !== 'undefined' && console.log) {
    // wrap console.log to prevent 'Illegal Invocation' exceptions when Jison.print() is used, e.g.
    // in the web tryout pages where this code is employed.
    Jison.print = function (/* ... */) {
        var args = Array.prototype.slice.call(arguments, 0);
        console.log.apply(console, args);
    };
} else if (typeof puts !== 'undefined') {
    Jison.print = function puts_print() {
        puts([].join.call(arguments, ' '));
    };
} else if (typeof print !== 'undefined') {
    Jison.print = print;
} else {
    Jison.print = function no_op_print() {};
}

Jison.Parser = (function () {

// iterator utility
function each(obj, func) {
    if (typeof obj.forEach === 'function') {
        obj.forEach(func);
    } else {
        var p;
        for (p in obj) {
            if (obj.hasOwnProperty(p)) {
                func.call(obj, obj[p], p, obj);
            }
        }
    }
}

// This was Set.union() but it's not about *Set* at all: it is purely *Array* oriented!
function union(a, b) {
    assert(Array.isArray(a));
    assert(Array.isArray(b));
    // Naive indexOf()-based scanning delivers a faster union()
    // (which takes the brunt of the load for large grammars):
    // for examples/jscore this drops 13.2 seconds down to
    // 8.9 seconds total time spent in the generator!
    //
    // The idea there was that the FIRST/FOLLOW sets are generally
    // quite small; bad cases could run this up to > 128 entries
    // to scan through, but overall the FIRST and FOLLOW sets will
    // be a few tens of entries at best, and thus it was expected
    // that a naive scan would be faster than hash-object creation
    // and O(1) checking that hash... Turns out I was right.
    //
    // The 'arbitrary' threshold of 52 entries in the array to check
    // against is probably at or near the worst-case FIRST/FOLLOW set
    // site for this jscore grammar as the naive scan consistently
    // outperformed the old smarter hash-object code for smaller
    // thresholds (10, 20, 32, 42!)
    var k, len;

    if (a.length > 52) {
        var ar = {};
        for (k = 0, len = a.length; k < len; k++) {
            ar[a[k]] = true;
        }
        for (k = 0, len = b.length; k < len; k++) {
            if (!ar[b[k]]) {
                a.push(b[k]);
            }
        }
    } else {
        var bn = [];
        for (k = 0, len = b.length; k < len; k++) {
            if (a.indexOf(b[k]) < 0) {
                bn.push(b[k]);
            }
        }
        a = a.concat(bn);
    }
    return a;
}

// HELPER FUNCTION: print the function in source code form, properly indented.
function printFunctionSourceCode(f) {
    return String(f).replace(/^    /gm, '');
}
function printFunctionSourceCodeContainer(f) {
    return String(f).replace(/^    /gm, '').replace(/^    /gm, '').replace(/function [^\{]+\{/, '').replace(/\}$/, '');
}


var Nonterminal = typal.construct({
    constructor: function Nonterminal(symbol) {
        this.symbol = symbol;
        this.productions = new Set();
        this.first = [];
        this.follows = [];
        this.nullable = false;
    },
    toString: function Nonterminal_toString() {
        var str = this.symbol;
        var attr_str = [];

        if (this.nullable) {
            attr_str.push('nullable');
        }

        if (attr_str.length) {
            str += '        [' + attr_str.join(' ') + ']';
        }
        str += '\n  Firsts:  [' + this.first.join(']  [') + ']';
        str += '\n  Follows: [' + this.follows.join(']  [') + ']';
        str += '\n  Productions:\n    ' + this.productions.join('\n    ');

        return str;
    }
});

var Production = typal.construct({
    constructor: function Production(symbol, handle, id, handle_aliases, handle_action) {
        this.symbol = symbol;
        this.handle = handle;
        this.nullable = false;
        this.id = id;
        this.aliases = handle_aliases;
        this.action = handle_action;
        this.first = [];
        this.follows = [];
        this.precedence = 0;
        this.reachable = false;
    },
    toString: function Production_toString() {
        var str = this.symbol;

        var attr_str = [];

        if (this.nullable) {
            attr_str.push('~');
        }
        if (this.precedence) {
            attr_str.push('@' + this.precedence);
        }
        if (!this.reachable) {
            attr_str.push('*RIP*');
        }

        if (attr_str.length) {
            str += '[' + attr_str.join(' ') + ']';
        }
        str += ' -> ' + this.handle.join(' ');

        return str;
    },
    describe: function Production_describe() {
        var str = this.symbol;

        var attr_str = [];

        if (this.nullable) {
            attr_str.push('nullable');
        }
        if (this.precedence) {
            attr_str.push('precedence: ' + this.precedence);
        }

        if (attr_str.length) {
            str += '        [' + attr_str.join(' ') + ']';
        }
        str += '\n  Firsts: [' + this.first.join(']  [') + ']';
        str += '\n  -->  ' + this.handle.join(' ');

        return str;
    }
});



var generator = typal.beget();

// `optionalLexerSection` is an optional {String} argument, specifying the lexer rules.
// May only be specified when the specified `grammar` also is a yet-unparsed
// {String} defining the grammar.
//
// Hence these invocations are legal:
//
// - `Generator("String")`
//   --> `String` contains entire grammar, including
//   optional `%lex` lexer rules section
//
//
// - `Generator("String-1", "String-2")`
//   --> The `String-1` string contains grammar, *excluding* `%lex` lexer rules section,
//   while the `String-2` string contains the `%lex` lexer rules section
//
//
// - `Generator("String", {Options})`
//   --> `String` contains entire grammar, including
//   optional `%lex` lexer rules section
//
//   The `Options` object specifies the desired jison options' settings.
//
//
// - `Generator("String", NULL, {Options})`
//   --> `String` contains entire grammar, including
//   optional `%lex` lexer rules section
//
//   The `Options` object specifies the desired jison options' settings.
//
//
// - `Generator("String-1", "String-2", {Options})`
//   --> The `String-1` string contains grammar, *excluding* `%lex` lexer rules section,
//   while the `String-2` string contains the `%lex` lexer rules section
//
//   The `Options` object specifies the desired jison options' settings.
//
//
// - `Generator({Grammar})`
//   --> The `Grammar` object contains the entire grammar as an already parsed *structure*,
//   including optional `%lex` lexer rules section in its `.lex` member.
//
//
// - `Generator({Grammar}, {Options})`
//   --> The `Grammar` object contains the entire grammar as an already parsed *structure*,
//   including optional `%lex` lexer rules section in its `.lex` member.
//
//   The `Options` object specifies the desired jison options' settings.
//
//
// - `Generator({Grammar}, NULL, {Options})`
//   --> The `Grammar` object contains the entire grammar as an already parsed *structure*,
//   including optional `%lex` lexer rules section in its `.lex` member.
//
//   The `Options` object specifies the desired jison options' settings.
//
//
// - `Generator({Grammar}, "String-2")`
//   --> The `Grammar` object contains grammar, *excluding* `%lex` lexer rules section,
//   while the `String-2` string contains the `%lex` lexer rules section
//
//
// - `Generator({Grammar}, "String-2", {Options})`
//   --> The `Grammar` object contains grammar, *excluding* `%lex` lexer rules section,
//   while the `String-2` string contains the `%lex` lexer rules section
//
//   The `Options` object specifies the desired jison options' settings.
//
//
// Any other arguments / arguments' types sequence is illegal.
//
generator.constructor = function Jison_Generator(grammar, optionalLexerSection, options) {
    var err;

    // pick the correct argument for the `options` for this call:
    if (!options && optionalLexerSection && typeof optionalLexerSection !== 'string') {
      options = optionalLexerSection;
      optionalLexerSection = null;
    }
    // and standardize it:
    options = mkStdOptions(options);

    grammar = autodetectAndConvertToJSONformat(grammar, optionalLexerSection, options);

    // make sure all options are 'standardized' before we go and mix them together:
    options = mkStdOptions(grammar.options, options);

    this.terms = {};
    this.operators = {};
    this.productions = [];
    this.conflicts = 0;
    this.new_conflicts_found_this_round = 0;
    this.conflicting_states = [];
    this.resolutions = [];
    this.conflict_productions_LU = {};
    this.conflict_states_LU = {};
    this.conflict_fixing_round = false;
    this.parseParams = grammar.parseParams;
    this.yy = {}; // accessed as yy free variable in the parser/lexer actions

    // also export the grammar itself *and* the cleaned-up generator options:
    this.options = options;
    this.grammar = grammar;

    // propagate %parse-params into the lexer!
    if (grammar.lex) {
        if (!grammar.lex.options) {
            grammar.lex.options = {};
        }
        if (this.parseParams) {
            grammar.lex.options.parseParams = this.parseParams;
        }
    }

    // calculate the input path; if none is specified, it's the present working directory
    var path = require('path');
    var inpath = options.file || options.outfile || './dummy';
    inpath = path.normalize(inpath);
    options.inputPath = path.dirname(inpath);
    options.inputFilename = path.basename(inpath);

    // source included in semantic action execution scope
    if (grammar.actionInclude) {
        if (typeof grammar.actionInclude === 'function') {
            grammar.actionInclude = String(grammar.actionInclude).replace(/^\s*function \(\) \{/, '').replace(/\}\s*$/, '');
        }
        this.actionInclude = grammar.actionInclude;
    }
    this.moduleInclude = grammar.moduleInclude || '';
    this.moduleInit = grammar.moduleInit || [];
    assert(Array.isArray(this.moduleInit));

    this.DEBUG = !!this.options.debug;
    this.enableDebugLogs = options.enableDebugLogs || false;
    this.numExpectedConflictStates = options.numExpectedConflictStates || 0;

    if (this.DEBUG) {
        this.mix(generatorDebug); // mixin debug methods

        Jison.print('Grammar::OPTIONS:\n', this.options);
    }

    this.processGrammar(grammar);

    if (grammar.lex) {
        var lexer_options = {
            // include the knowledge about which parser/lexer
            // features will actually be *used* by the environment:
            //
            // (this stuff comes straight from the jison Optimization Analysis.)
            //
            parseActionsAreAllDefault: this.actionsAreAllDefault,
            parseActionsUseYYLENG: this.actionsUseYYLENG,
            parseActionsUseYYLINENO: this.actionsUseYYLINENO,
            parseActionsUseYYTEXT: this.actionsUseYYTEXT,
            parseActionsUseYYLOC: this.actionsUseYYLOC,
            parseActionsUseParseError: this.actionsUseParseError,
            parseActionsUseYYERROR: this.actionsUseYYERROR,
            parseActionsUseYYRECOVERING: this.actionsUseYYRECOVERING,
            parseActionsUseYYERROK: this.actionsUseYYERROK,
            parseActionsUseYYCLEARIN: this.actionsUseYYCLEARIN,
            parseActionsUseValueTracking: this.actionsUseValueTracking,
            parseActionsUseValueAssignment: this.actionsUseValueAssignment,
            parseActionsUseLocationTracking: this.actionsUseLocationTracking,
            parseActionsUseLocationAssignment: this.actionsUseLocationAssignment,
            parseActionsUseYYSTACK: this.actionsUseYYSTACK,
            parseActionsUseYYSSTACK: this.actionsUseYYSSTACK,
            parseActionsUseYYSTACKPOINTER: this.actionsUseYYSTACKPOINTER,
            parserHasErrorRecovery: this.hasErrorRecovery,

            // and re-use any useful options:
            moduleType: this.options.moduleType,
            debug: this.options.debug,
            json: this.options.json,
            main: false,
            moduleName: 'lexer',        // this.options.moduleName + '_Lexer',
            file: this.options.file,
            outfile: this.options.outfile,
            inputPath: this.options.inputPath,
            inputFilename: this.options.inputFilename,
            warn_cb: this.options.warn_cb,
            parseParams: this.options.parseParams,
            xregexp: this.options.xregexp,
            lexer_errors_are_recoverable: this.options.lexer_errors_are_recoverable,
            flex: this.options.flex,
            backtrack_lexer: this.options.backtrack_lexer,
            ranges: this.options.ranges,
            caseInsensitive: this.options.caseInsensitive,
            showSource: this.options.showSource,
            pre_lex: this.options.pre_lex,
            post_lex: this.options.post_lex,
        };

        this.lexer = new Lexer(grammar.lex, null, this.terminals_, lexer_options);
    }
};

generator.processGrammar = function processGrammarDef(grammar) {
    var bnf = grammar.bnf,
        tokens = grammar.tokens,
        nonterminals = this.nonterminals = {},
        productions = this.productions,
        self = this;

    if (!grammar.bnf && grammar.ebnf) {
        bnf = grammar.bnf = ebnfParser.transform(grammar.ebnf);
    }
    if (devDebug) {
        Jison.print('processGrammar: ', JSON.stringify({
            bnf: bnf,
            tokens: tokens,
            productions: productions
        }, null, 2));
    }
    if (tokens) {
        if (typeof tokens === 'string') {
            tokens = tokens.trim().split(' ');
        } else {
            tokens = tokens.slice(0);
        }
    }

    // did the grammar user also provide a predefined set of symbols to be (re)used with this grammar?
    // (This is used when you want to generate multiple lexers and parsers which share a common symbol set
    // so as to make the parsers and lexers mutually interchangeable.)
    var predefined_symbols = null;
    if (grammar.imports) {
        var symbols_import = grammar.imports.find(function (el, idx) {
            if (el.name === 'symbols') {
                return el;
            }
            return false;
        });
        if (symbols_import) {
            var fs = require('fs');
            var path = require('path');
            var filepath = path.resolve(symbols_import.path);

            var source = fs.readFileSync(filepath, 'utf8');
            // It's either a JSON file or a JISON generated output file:
            //
            //     symbols_: {
            //       "symbol": ID, ...
            //     },
            try {
                predefined_symbols = json5.parse(source);
            } catch (ex) {
                if (devDebug) {
                    console.error('%import symbols JSON fail: ', ex);
                }
                try {
                    var m = /[\r\n]\s*symbols_:\s*(\{[\s\S]*?\}),\s*[\r\n]/.exec(source);
                    if (m && m[1]) {
                        source = m[1];
                        predefined_symbols = json5.parse(source);
                    }
                } catch (ex) {
                    if (devDebug) {
                        console.error('%import symbols JISON output fail: ', ex);
                    }
                    throw new Error('Error: `%import symbols <path>` must point to either a JSON file containing a symbol table (hash table) or a previously generated JISON JavaScript file, which contains such a symbol table. Error message: ' + ex.message);
                }
            }

            if (!predefined_symbols || typeof predefined_symbols !== 'object') {
                throw new Error('Error: `%import symbols <path>` must point to either a JSON file containing a symbol table (hash table) or a previously generated JISON JavaScript file, which contains such a symbol table.');
            }

            // Make sure all predefined symbols are unique and *numeric* and do not include predefined tokens JISON already defines to a fixed ID on its own:
            delete predefined_symbols['$accept'];
            delete predefined_symbols['$end'];
            delete predefined_symbols['error'];
            delete predefined_symbols['$eof'];
            delete predefined_symbols['EOF'];

            var symdef_uniq_check = {};
            // Only these symbols are allowed to have the values 1 or 2:
            symdef_uniq_check[1] = 'EOF';
            symdef_uniq_check[2] = 'error';
            Object.keys(predefined_symbols).forEach(function cvt_symbol_id_to_numeric(sym) {
                var v = predefined_symbols[sym];

                // Symbol value may be defined as boolean TRUE, in which case we let JISON pick the value for us:
                if (v === true) return;

                // Symbol value may be defined as a one-character string:
                if (typeof v !== 'number') {
                    if (typeof v !== 'string' || v.length !== 1) {
                        throw new Error('Error: `%import symbols <path>`: symbol table contains invalid entry at key \'' + sym + '\': a non-numeric symbol ID value must be a single-character string.');
                    }
                    v = v.charCodeAt(0);
                }
                v = v | 0;
                if (!v || v < 0) {
                    throw new Error('Error: `%import symbols <path>`: symbol table contains invalid entry at key \'' + sym + '\': a symbol ID value must be an integer value, 3 or greater.');
                }
                if (symdef_uniq_check[v]) {
                    if (symdef_uniq_check[v] !== sym) {
                        throw new Error('Error: `%import symbols <path>`: symbol table contains duplicate ID values for keys \'' + sym + '\' and \'' + symdef_uniq_check[v] + '\'');
                    }
                }
                symdef_uniq_check[v] = sym;
                predefined_symbols[sym] = v;
            });
        }
    }

    var symbols = this.symbols = [];

    // calculate precedence of operators
    var operators = this.operators = processOperators(grammar.operators);

    // build productions from CFG and calculate the symbol sets (terminals and nonterminals) and their name-to-ID mappings
    this.buildProductions(bnf, productions, nonterminals, symbols, operators, predefined_symbols, grammar.extra_tokens);

    if (devDebug > 1) {
        Jison.print('terminals vs tokens: ', this.terminals.length, (tokens && tokens.length), this.terminals,
                    '\n###################################### TOKENS\n', tokens,
                    '\n###################################### EXTRA TOKENS\n', grammar.extra_tokens,
                    '\n###################################### LEX\n', grammar.lex,
                    '\n###################################### GRAMMAR\n', grammar);
    }
    if (tokens && this.terminals.length !== tokens.length) {
        self.trace('Warning: declared tokens differ from tokens found in rules.');
        self.trace('Terminals: ', this.terminals);
        self.trace('Tokens:    ', tokens);
    }

    // augment the grammar
    this.augmentGrammar(grammar);

    // detect unused productions and flag them
    this.signalUnusedProductions();

    // build production action code chunks (originally done in `buildProductions` as a side-effect)
    this.buildProductionActions();
};

generator.augmentGrammar = function augmentGrammar(grammar) {
    if (this.productions.length === 0) {
        throw new Error('Grammar error: must have at least one rule.');
    }
    // use specified start symbol, or default to first user defined production
    this.startSymbol = grammar.start || grammar.startSymbol || this.productions[0].symbol;
    if (!this.nonterminals[this.startSymbol]) {
        throw new Error('Grammar error: startSymbol must be a non-terminal found in your grammar.');
    }
    //this.EOF = '$end';       // moved to generator.buildProductions()

    // Augment the grammar:
    //
    // Add the top-most accept rule (and implicit, default, action):
    //
    //     $accept: <startSymbol> $end
    //                  %{ $$ = $1; @$ = @1; %}
    //
    // which, combined with the new parse kernel's `$accept` state behaviour will produce the
    // `$$` value output of the <startSymbol> rule as the parse result, IFF that result is
    // *not* `undefined`. (See also the parser kernel code.)
    //
    // In code:
    //
    //                  %{
    //                      @$ = @1;
    //                      if (typeof $1 !== 'undefined')
    //                          return $1;
    //                      else
    //                          return true;           // the default parse result if the rule actions don't produce anything
    //                  %}
    //
    var acceptProduction = new Production('$accept', [this.startSymbol, '$end'], 0);
    this.productions.unshift(acceptProduction);

    // prepend parser tokens       // moved to generator.buildProductions()
    //this.symbols.unshift('$accept', this.EOF);
    //this.symbols_.$accept = 0;
    //this.symbols_[this.EOF] = 1;
    //this.terminals.unshift(this.EOF);

    //this.nonterminals.$accept = new Nonterminal('$accept');

    this.nonterminals.$accept.productions.push(acceptProduction);

    // add follow $ to start symbol
    this.nonterminals[this.startSymbol].follows.push(this.EOF);
};

// Mark unused productions
generator.signalUnusedProductions = function () {
    var mark = {};

    var productions = this.productions;
    var nonterminals = this.nonterminals;
    var i, p, len, nt, sym;

    for (i = 0, len = nonterminals.length; i < len; i++) {
        nt = nonterminals[i];
        assert(nt.symbol);
        mark[nt.symbol] = false;
    }

    // scan & mark all visited productions
    function traverseGrammar(nt) {
        assert(nt);
        assert(nt.symbol);
        mark[nt.symbol] = true;

        var prods = nt.productions;
        assert(prods);
        prods.forEach(function (p) {
            assert(p.symbol === nt.symbol);
            assert(p.handle);
            var rhs = p.handle;
            if (devDebug > 0) {
                Jison.print('traverse / mark: ', nt.symbol, ' --> ', rhs);
            }

            for (var j = 0, len = rhs.length; j < len; j++) {
                var sym = rhs[j];
                assert(!sym ? !nonterminals[sym] : true);
                if (nonterminals[sym] && !mark[sym]) {
                    traverseGrammar(nonterminals[sym]);
                }
            }
        });
    }

    traverseGrammar(nonterminals['$accept' /* this.startSymbol */ ]);

    // now any production which is not yet marked is *unused*:
    for (sym in mark) {
        nt = nonterminals[sym];
        assert(nt);
        var prods = nt.productions;
        assert(prods);
        var in_use = mark[sym];
        prods.forEach(function (p) {
            assert(p);
            if (in_use) {
                p.reachable = true;
            } else {
                p.reachable = false;
            }
        });

        if (!in_use) {
            // and kill the unused nonterminals:
            delete this.nonterminals[sym];
        }
    }

    this.unused_productions = productions.filter(function (p) {
        return !p.reachable;
    });

    // and kill the unused productions:
    this.productions = productions.filter(function (p) {
        return p.reachable;
    });
};

// set precedence and associativity of operators
function processOperators(ops) {
    if (!ops) return {};
    var operators = {};
    for (var i = 0, k, prec; (prec = ops[i]); i++) {
        for (k = 1; k < prec.length; k++) {
            operators[prec[k]] = {
                precedence: i + 1,
                assoc: prec[0]
            };
        }
    }
    return operators;
}

// Detect the indentation of the given sourcecode chunk and shift the chunk to be indented the given number of spaces.
//
// Note that the first line doesn't count as the chunk is very probably trimmed!
function reindentCodeBlock(action, indent_level) {
    var width = 0;
    var lines = action
    .trim()
    .split('\n')
    // measure the indent:
    .map(function checkIndentation(line, idx) {
        if (idx === 1) {
            // first line didn't matter: reset width to help us find the block indent level:
            width = Infinity;
        }
        if (line.trim() === '') return '';

        // take out any TABs: turn them into spaces (4 per TAB)
        line = line
        .replace(/^[ \t]+/, function expandTabs(s) {
            return s.replace(/\t/g, '    ');
        });

        var m = /^[ ]+/.exec(line);
        if (m) {
            width = Math.min(m[0].length, width);
        }

        return line;
    })
    // remove/adjust the indent:
    .map(function checkIndentation(line, idx) {
        line = line
        .replace(/^[ ]*/, function adjustIndent(s) {
            var l = Math.max(s.length - width, 0) + indent_level;
            var shift = (new Array(l + 1)).join(' ');
            return shift;
        });
        return line;
    });

    return lines.join('\n');
}


generator.buildProductions = function buildProductions(bnf, productions, nonterminals, symbols, operators, predefined_symbols, descriptions) {
    var self = this;
    var prods, symbol, symId;
    var productions_ = [];
    var symbols_ = {};
    var descriptions_ = {};
    var usedSymbolIds = [/* $accept = 0 */ true, /* $end = 1 */ true, /* error = 2 */ true];
    var usedSymbolIdsLowIndex = 3;

    // set up the required symbols `$accept` and `$end` (a.k.a. EOF) and make sure they occupy the expected slots:
    this.EOF = '$end';

    symbols_.$accept = 0;
    symbols_[this.EOF] = 1;
    symbols_['$eof'] = 1;               // `$eof` is a synonym of `$end` for bison compatibility; this is the only place where two symbol names may map to a single symbol ID number!
    symbols_['EOF'] = 1;                // `EOF` is a synonym of `$end` for bison compatibility; this is the only place where two symbol names may map to a single symbol ID number!
    symbols[0] = '$accept';
    symbols[1] = this.EOF;

    nonterminals.$accept = new Nonterminal('$accept');

    // always add the error symbol; will be third symbol, or "2": ($accept, $end, error)
    symbols_.error = 2;
    symbols[2] = 'error';

    if (predefined_symbols) {
        for (symbol in predefined_symbols) {
            symId = predefined_symbols[symbol];
            if (symId === true) {
                // add symbol to queue which must be assigned a value by JISON; after all the other predefined symbols have been processed.
                continue;
            }

            // skip $accept, $end and error:
            if (symId <= 2) continue;

            // has this ID already been taken? If not, pick this ID, otherwise throw a tantrum.
            if (!usedSymbolIds[symId]) {
                usedSymbolIds[symId] = true;
                symbols_[symbol] = symId;
                symbols[symId] = symbol;
            } else {
                throw new Error('Error: Predefined symbol (imported via `%import symbols`) "' + symbol + '" has an ID ' + symId + ' which is already in use by symbol "' + symbols[symId] + '"');
            }
        }

        // preferably assign readable ASCII-range token IDs to tokens added from the predefined list
        // but only when maximum table compression isn't demanded:
        usedSymbolIdsLowIndex = ((self.options.compressTables | 0) < 2 ? 32 : 3);
        for (symbol in predefined_symbols) {
            symId = predefined_symbols[symbol];
            addSymbol(symbol);
        }

        // reset ID low water mark: nonterminals etc. can be assigned any number, preferably a small/low one!
        usedSymbolIdsLowIndex = 3;
    }

    if (descriptions) {
        self.trace('descriptions obtained from grammar: ', descriptions);
        descriptions.forEach(function (tokdef) {
            // fields: id, type, value, description
            if (tokdef.description && tokdef.id) {
                descriptions_[tokdef.id] = tokdef.description;
            }
        });
    }


    var hasErrorRecovery = false; // has error recovery

    // Produce the next available unique symbolID:
    function getNextSymbolId() {
        for (var i = usedSymbolIdsLowIndex; ; i++) {
            if (!usedSymbolIds[i]) {
                usedSymbolIds[i] = true;
                usedSymbolIdsLowIndex = i + 1;
                return i;
            }
        }
    }

    function addSymbol(s) {
        if (s && !symbols_[s]) {
            var i;

            // assign the Unicode codepoint index to single-character symbols,
            // but only when maximum table compression isn't demanded:
            if (s.length === 1 && (self.options.compressTables | 0) < 2) {
                i = s.charCodeAt(0);
                // has this ID already been taken? If not, pick this ID.
                if (i < 128 /* only allow this within the ASCII range */ && !usedSymbolIds[i]) {
                    usedSymbolIds[i] = true;
                } else {
                    i = getNextSymbolId();
                }
            } else {
                // otherwise simply obtain the next available ID number as usual.
                i = getNextSymbolId();
            }
            symbols_[s] = i;
            symbols[i] = s;
        }
        return symbols_[s] || false;
    }

    // `this` is options object with `maxTokenLength` option to guide us which literal tokens we want to process:
    function collectLiteralTokensInProduction(handle) {
        var r, rhs, i, sym;

        if (devDebug) Jison.print('\ncollectLiteralTokensInProduction: ', symbol, ':', JSON.stringify(handle, null, 2), ' @ options: ', this);

        var maxlen = this.maxTokenLength || Infinity;

        if (handle.constructor === Array) {
            var rhs_i;
            rhs = (typeof handle[0] === 'string') ?
                      splitStringIntoSymbols(handle[0]) :
                      handle[0].slice(0);

            for (i = 0; i < rhs.length; i++) {
                sym = rhs[i];
                // check for aliased names, e.g., id[alias] and strip them
                rhs_i = sym.match(new XRegExp('\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]$'));
                if (rhs_i) {
                    sym = sym.substr(0, sym.length - rhs_i[0].length);
                }

                if (!bnf[sym] && sym.length <= maxlen) {
                    addSymbol(sym);
                }
            }
        } else {
            // no action -> don't care about aliases; strip them.
            handle = handle.replace(new XRegExp('\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]', 'g'), '');
            rhs = splitStringIntoSymbols(handle);
            for (i = 0; i < rhs.length; i++) {
                sym = rhs[i];
                if (!bnf[sym] && sym.length <= maxlen) {
                    addSymbol(sym);
                }
            }
        }
    }

    // Before we go process the grammar for real, we collect the 'literal' non-terminals and add them to the symbol table
    // before all others: this way these tokens have the maximum chance to get assigned their ASCII value as symbol ID,
    // which helps debugging/diagnosis of generated grammars.
    // (This is why previously we had set `usedSymbolIdsLowIndex` to 127 instead of 3!)

    var prodsLUT = {};
    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        if (typeof bnf[symbol] === 'string') {
            prods = bnf[symbol].split(/\s*\|\s*/g);
        } else {
            prods = bnf[symbol].slice(0);
        }
        if (devDebug) Jison.print('\ngenerator.buildProductions: ', symbol, JSON.stringify(prods, null, 2));

        prodsLUT[symbol] = prods;
    }

    // First we collect all single-character literal tokens:
    for (symbol in prodsLUT) {
        if (!prodsLUT.hasOwnProperty(symbol)) continue;

        prods = prodsLUT[symbol];
        prods.forEach(collectLiteralTokensInProduction, {
            maxTokenLength: 1
        });
    }
    // Next we collect all other literal tokens:
    for (symbol in prodsLUT) {
        if (!prodsLUT.hasOwnProperty(symbol)) continue;

        prods = prodsLUT[symbol];
        prods.forEach(collectLiteralTokensInProduction, {
            maxTokenLength: Infinity
        });
    }

    // and now go and process the entire grammar:
    // first collect all nonterminals in a symbol table, then build the productions
    // for each of those: nonterminals should all have IDs assigned before they
    // should be processed as part of a *production* rule, where these MAY be
    // referenced:
    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        addSymbol(symbol);
        nonterminals[symbol] = new Nonterminal(symbol);
    }

    // now that we have collected all nonterminals in our symbol table, it's finally
    // time to process the productions:
    for (symbol in prodsLUT) {
        if (!prodsLUT.hasOwnProperty(symbol)) continue;

        prods = prodsLUT[symbol];
        prods.forEach(buildProduction);
    }

    var sym,
        terms = [],
        terms_ = {};
    each(symbols_, function (id, sym) {
        // `$eof` and `EOF` are synonyms of `$end` (`$eof` is for bison compatibility);
        // this is the only place where two symbol names may map to a single symbol ID number
        // and we do not want `$eof`/`EOF` to show up in the symbol tables of generated parsers
        // as we use `$end` for that one!
        if (!nonterminals[sym] && sym !== '$eof') {
            terms.push(sym);
            terms_[id] = sym;
        }
    });

    this.hasErrorRecovery = hasErrorRecovery;

    this.terminals = terms;
    this.terminals_ = terms_;
    this.symbols_ = symbols_;
    this.descriptions_ = descriptions_;

    this.productions_ = productions_;
    assert(this.productions === productions);


    // Cope with literal symbols in the string, including *significant whitespace* tokens
    // as used in a rule like this: `rule: A ' ' B;` which should produce 3 tokens for the
    // rhs: ['A', ' ', 'B']
    function splitStringIntoSymbols(rhs) {
        // when there's no literal tokens in there, we can fast-track this baby:
        rhs = rhs.trim();
        var pos1 = rhs.indexOf("'");
        var pos2 = rhs.indexOf('"');
        if (pos1 < 0 && pos2 < 0) {
            return rhs.split(' ');
        }
        // else:
        //
        // rhs has at least one literal: we will need to parse the rhs into tokens
        // with a little more effort now.
        var tokens = [];
        while (pos1 >= 0 || pos2 >= 0) {
            var pos = pos1;
            var marker = "'";
            if (pos < 0) {
                assert(pos2 >= 0);
                pos = pos2;
                marker = '"';
            } else if (pos >= 0 && pos2 >= 0 && pos2 < pos) {
                pos = pos2;
                marker = '"';
            }
            var ls = rhs.substr(0, pos).trim();
            if (ls.length > 0) {
                tokens.push.apply(tokens, ls.split(' '));
            }
            rhs = rhs.substr(pos + 1);
            // now find the matching end marker.
            //
            // Edge case: token MAY include the ESCAPED MARKER... or other escapes!
            // Hence we need to skip over ALL escapes inside the token!
            var pos3 = rhs.indexOf('\\');
            pos = rhs.indexOf(marker);
            ls = '';
            while (pos3 >= 0 && pos3 < pos) {
                ls += rhs.substr(0, pos3 + 2);  // chop off entire escape (2 chars) and keep as part of next token
                rhs = rhs.substr(pos3 + 2);
                pos3 = rhs.indexOf('\\');
                pos = rhs.indexOf(marker);
            }
            if (pos < 0) {
                throw new Error('internal error parsing literal token(s) in grammar rule');
            }
            ls += rhs.substr(0, pos);
            // check for aliased literals, e.g., `'>'[gt]` and keep it and the alias together
            rhs = rhs.substr(pos + 1);
            var alias = rhs.match(new XRegExp('^\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]'));
            if (alias) {
                ls += alias[0];
                rhs = rhs.substr(alias[0].length);
            }
            tokens.push(ls);

            rhs = rhs.trim();

            pos1 = rhs.indexOf("'");
            pos2 = rhs.indexOf('"');
        }
        // Now, outside the loop, we're left with the remainder of the rhs, which does NOT
        // contain any literal tokens.
        if (rhs.length > 0) {
            tokens.push.apply(tokens, rhs.split(' '));
        }
        return tokens;
    }

    function buildProduction(handle) {
        var r, rhs, i,
            precedence_override;
            aliased = [],
            action = null;

        if (devDebug) Jison.print('\nbuildProduction: ', symbol, ':', JSON.stringify(handle, null, 2));

        if (handle.constructor === Array) {
            var rhs_i;

            rhs = (typeof handle[0] === 'string') ?
                      splitStringIntoSymbols(handle[0]) :
                      handle[0].slice(0);

            for (i = 0; i < rhs.length; i++) {
                // check for aliased names, e.g., id[alias] and strip them
                rhs_i = rhs[i].match(new XRegExp('\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]$'));
                if (rhs_i) {
                    rhs[i] = rhs[i].substr(0, rhs[i].length - rhs_i[0].length);
                    rhs_i = rhs_i[0].substr(1, rhs_i[0].length - 2);
                    aliased[i] = rhs_i;
                } else {
                    aliased[i] = rhs[i];
                }

                if (rhs[i] === 'error') {
                    hasErrorRecovery = true;
                }
                assert(bnf[rhs[i]] ? symbols_[rhs[i]] : true, 'all nonterminals must already exist in the symbol table');
                assert(rhs[i] ? symbols_[rhs[i]] : true, 'all symbols (terminals and nonterminals) must already exist in the symbol table');
                //addSymbol(rhs[i]);
            }

            assert(handle.length === 3 ? typeof handle[1] === 'string' : true);
            if (typeof handle[1] === 'string') {
                // semantic action specified
                action = handle[1];

                // precedence specified also
                if (handle[2] && operators[handle[2].prec]) {
                    precedence_override = {
                        symbol: handle[2].prec,
                        spec: operators[handle[2].prec]
                    };
                }
            } else {
                // only precedence specified
                if (operators[handle[1].prec]) {
                    precedence_override = {
                        symbol: handle[1].prec,
                        spec: operators[handle[1].prec]
                    };
                }
            }
        } else {
            // no action -> don't care about aliases; strip them.
            handle = handle.replace(new XRegExp('\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]', 'g'), '');
            rhs = splitStringIntoSymbols(handle);
            for (i = 0; i < rhs.length; i++) {
                if (rhs[i] === 'error') {
                    hasErrorRecovery = true;
                }
                assert(bnf[rhs[i]] ? symbols_[rhs[i]] : true, 'all nonterminals must already exist in the symbol table');
                assert(rhs[i] ? symbols_[rhs[i]] : true, 'all symbols (terminals and nonterminals) must already exist in the symbol table');
                //addSymbol(rhs[i]);
            }
        }

        r = new Production(symbol, rhs, productions.length + 1, aliased, action);

        // set precedence
        assert(r.precedence === 0);
        if (precedence_override) {
            r.precedence = precedence_override.spec.precedence;
        }
        else {
            var prec_symbols = [];
            var winning_symbol;

            for (i = r.handle.length - 1; i >= 0; i--) {
                if (!(r.handle[i] in nonterminals) && r.handle[i] in operators) {
                    var old_prec = r.precedence;
                    var new_prec = operators[r.handle[i]].precedence;
                    if (old_prec !== 0 && old_prec !== new_prec) {
                        prec_symbols.push(r.handle[i]);
                        // Jison.print('precedence set twice: ', old_prec, new_prec, r.handle[i], symbol, handle[0]);
                        if (new_prec < old_prec) {
                            winning_symbol = r.handle[i];
                        }
                        else {
                            // keep previously set precedence:
                            new_prec = old_prec;
                        }
                    } else if (old_prec === 0) {
                        prec_symbols.push(r.handle[i]);
                        winning_symbol = r.handle[i];
                        // Jison.print('precedence set first time: ', old_prec, r.handle[i], symbol, handle[0]);
                    }
                    r.precedence = new_prec;
                }
            }

            if (prec_symbols.length > 1) {
                if (self.DEBUG || 1) {
                    self.warn('Ambiguous rule precedence in grammar: picking the (highest) precedence from operator "' + winning_symbol + '" for rule "' + symbol + ': ' + r.handle.join(' ') + '" which contains multiple operators with different precedences: {' + prec_symbols.join(', ') + '}');
                }
            }
        }

        productions.push(r);
        productions_.push([symbols_[r.symbol], r.handle[0] === '' ? 0 : r.handle.length]);
        nonterminals[symbol].productions.push(r);
    }
};


generator.buildProductionActions = function buildProductionActions() {
/*
    this.terminals = terms;
    this.terminals_ = terms_;
    this.symbols_ = symbols_;
    this.descriptions_ = descriptions_;

    this.productions_ = productions_;
    assert(this.productions === productions);
*/
    var productions = this.productions,
        nonterminals = this.nonterminals,
        symbols = this.symbols,
        operators = this.operators,
        self = this;

    var actions = [
      '/* this == yyval */',
      'var yy = this.yy;',              // the JS engine itself can go and remove this statement when `yy` turns out to be unused in any action code!
      preprocessActionCode(this.actionInclude || ''),
      'switch (yystate) {'
    ];
    var actionGroups = {};          // used to combine identical actions into single instances: no use duplicating action code needlessly
    var actionGroupValue = {};      // stores the unaltered, expanded, user-defined action code for each action group.
    var symbol;

    // Preprocess the action code block before we perform any `$n`, `@n` ,`##n` or `#n` expansions:
    // Any comment blocks in there should be kept intact (and not cause trouble either as those comments MAY
    // contain `$`, `@`, `##` or `#` prefixed bits which might look like references but aren't!)
    //
    // Also do NOT replace any $x, @x, ##x or #x macros inside any strings!
    //
    // Note:
    // We also replace '/*' comment markers which may (or may not) be lurking inside other comments.
    function preprocessActionCode(s) {
        function replace_markers(cmt) {
            cmt = cmt
            .replace(/##/g, '\x01\x09')
            .replace(/#/g, '\x01\x01')
            .replace(/\$/g, '\x01\x02')
            .replace(/@/g, '\x01\x03')
            .replace(/\/\*/g, '\x01\x05')
            .replace(/\/\//g, '\x01\x06')
            .replace(/\'/g, '\x01\x07')
            .replace(/\"/g, '\x01\x08')
            // and also whiteout any other macros we're about to expand in there:
            .replace(/\bYYABORT\b/g, '\x01\x14')
            .replace(/\bYYACCEPT\b/g, '\x01\x15')
            .replace(/\byyvstack\b/g, '\x01\x16')
            .replace(/\byylstack\b/g, '\x01\x17')
            .replace(/\byyerror\b/g, '\x01\x18')
            .replace(/\bYYRECOVERING\b/g, '\x01\x19')
            .replace(/\byyerrok\b/g, '\x01\x1A')
            .replace(/\byyclearin\b/g, '\x01\x1B')
            .replace(/\byysp\b/g, '\x01\x1C');

            return cmt;
        }

        s = s
        // do not trim any NEWLINES in the action block:
        .replace(/^\s+/, '')
        .replace(/\s+$/, '')
        // unify CR/LF combo's:
        .replace(/\r\n|\r/g, '\n')
        // replace any '$', '@' and '#' in any C++-style comment line to prevent them from being expanded as if they were part of the action code proper:
        .replace(/^\s*\/\/.+$/mg, replace_markers)
        // also process any //-comments trailing a line of code:
        // (we need to ensure these are real and not a bit of string,
        // which leaves those comments that are very hard to correctly
        // recognize with a simple regex, e.g. '// this isn't a #666 location ref!':
        // we accept that we don't actually *parse* the action block and let these
        // slip through... :-( )
        //
        // WARNING: without that `\n` inside the regex `[...]` set, the set *will*
        // match a NEWLINE and thus *possibly* gobble TWO lines for the price of ONE,
        // when the first line is an *empty* comment line, i.e. nothing trailing
        // the `//` in there and thus the `[^'"]` regex matching the terminating NL *before*
        // the `$` in the regex can get at it. Cave canem therefor!       |8-(
        .replace(/\/\/[^'"\n]+$/mg, replace_markers)
        // now MARK all the not-too-tricky-to-recognize /*...*/ comment blocks and process those!
        // (Here again we accept that we don't actually *parse* the action code and
        // permit to let some of these slip, i.e. comment blocks which trail
        // a line of code and contain string delimiter(s). :-( )
        .replace(/^([^'"\n]*?)\/\*/mg, '$1\x01\x04')                            // comment starts the line, guaranteed not to be inside a string
        .replace(/\/\*([^'"\n]*)$/mg, '\x01\x04$1')                             // comment does not contain any string sentinel in its first line
        .replace(/\/\*([^\/]*?\*\/[^'"\n]*)$/mg, '\x01\x04$1')                  // comment end marker near end of line and since the end is definitely not inside a string, there's bound to be comment start as well
        // and find their END marker: first '*/' found wins!
        // (The `[\s\S]` regex expression is a hack to ensure NEWLINES are matched
        // by that set as well, i.e. this way we can easily cross line boundaries
        // while searching for he end of the multiline comment we're trying to
        // dig out by regex matching. Also note that we employ non-aggressive
        // matching to ensure the regex matcher will find the FIRST occurrence of
        // `*/` and mark that as the end of the regex match!)
        .replace(/\x01\x04[\s\S]*?\*\//g, replace_markers)
        // Now that we have processed all comments in the code, it's time
        // to tackle the strings in the code: any strings must be kept intact
        // as well. Regrettably, there's regexes which may carry quotes,
        // e.g. `/'/`, and escapes of quotes inside strings, e.g. `'\''`,
        // which this a non-trivial task. This is when we reconsider whether
        // we should run this stuff through Esprima and deal with that AST
        // verbosity instead...? For now, we accept that regexes can screw
        // us up, but we can handle strings of any kind, by first taking
        // out all explicit `\\` non-escaping characters:
        .replace(/\\\\/g, '\x01\x10')
        // and then we take out all escaped quotes:
        .replace(/\\\'/g, '\x01\x11')
        .replace(/\\\"/g, '\x01\x12')
        // and to top it off, we also take out any more-or-less basic regexes:
        .replace(/\\\//g, '\x01\x13')

        // WARNING: Without that prefix check this would also catch
        // `6/7 + $$ + 8/9` as if `/7 + $$ + 8/` would be a regex   :-(
        // but we need this one to ensure any quotes hiding inside
        // any regex in there are caught and marked, e.g. `/'/g`.
        // Besides, this regex prefix is constructed to it preventing
        // the regex matching a `//....` comment line either!
        .replace(/[^_a-zA-Z0-9\$\)\/][\s\n\r]*\/[^\n\/\*][^\n\/]*\//g, replace_markers);

        // ... which leaves us with plain strings of both persuasions to cover
        // next: we MUST do both at the same time, though or we'll be caught
        // with our pants down in constructs like
        // `'"' + $$ + '"'` vs. `"'" + $$ + "'"`

        var dqpos, sqpos, ccmtpos, cppcmtpos, first = -1;
        for (var c = 0;; c++) {
            first++;
            dqpos = s.indexOf('"', first);
            sqpos = s.indexOf("'", first);
            // also look for remaining comments which contain quotes of any kind,
            // as those will not have been caught by the previous global regexes:
            ccmtpos = s.indexOf('/*', first);
            cppcmtpos = s.indexOf('//', first);
            first = s.length;
            first = Math.min((dqpos >= 0 ? dqpos : first), (sqpos >= 0 ? sqpos : first), (ccmtpos >= 0 ? ccmtpos : first), (cppcmtpos >= 0 ? cppcmtpos : first));
            // now it matters which one came up first:
            if (dqpos === first) {
                s = s
                .replace(/"[^"\n]*"/, replace_markers);
            } else if (sqpos === first) {
                s = s
                .replace(/'[^'\n]*'/, replace_markers);
            } else if (ccmtpos === first) {
                s = s
                .replace(/\/\*[\s\S]*?\*\//, replace_markers);
            } else if (cppcmtpos === first) {
                s = s
                .replace(/\/\/[^\n]*$/m, replace_markers);
            } else {
                break;
            }
        }
        // Presto!
        return s;
    }

    // Postprocess the action code block after we perform any `$n`, `@n`, `##n` or `#n` expansions:
    // revert the preprocessing!
    function postprocessActionCode(s) {
        s = s
        // multiline comment start markers:
        .replace(/\x01\x04/g, '/*')
        .replace(/\x01\x05/g, '/*')
        .replace(/\x01\x06/g, '//')
        // revert markers:
        .replace(/\x01\x01/g, '#')
        .replace(/\x01\x02/g, '$')
        .replace(/\x01\x03/g, '@')
        // and revert the string and regex markers:
        .replace(/\x01\x07/g, '\'')
        .replace(/\x01\x08/g, '\"')
        .replace(/\x01\x09/g, '##')
        .replace(/\x01\x10/g, '\\\\')
        .replace(/\x01\x11/g, '\\\'')
        .replace(/\x01\x12/g, '\\\"')
        .replace(/\x01\x13/g, '\\\/')
        .replace(/\x01\x14/g, 'YYABORT')
        .replace(/\x01\x15/g, 'YYACCEPT')
        .replace(/\x01\x16/g, 'yyvstack')
        .replace(/\x01\x17/g, 'yylstack')
        .replace(/\x01\x18/g, 'yyerror')
        .replace(/\x01\x19/g, 'YYRECOVERING')
        .replace(/\x01\x1A/g, 'yyerrok')
        .replace(/\x01\x1B/g, 'yyclearin')
        .replace(/\x01\x1C/g, 'yysp');

        // And a final, minimal, fixup for the semicolon-lovers -- like me! ;-)
        //
        // Make sure the last statement is properly semicolon-terminated 99.9% of the time:
        s = s
        .replace(/[\s\r\n]+$/, '')          // trim trailing whitespace and empty lines
        .replace(/([^\;}])$/, '$1;');       // append a semicolon to the last statement if it doesn't end with one (or a closing brace, e.g. a function definition)

        return s;
    }

    // Strip off any insignificant whitespace from the user code to ensure that
    // otherwise identical actions are indeed matched up into a single actionGroup:
    function mkHashIndex(s) {
        return s.trim()
        .replace(/\s+$/mg, '')          // strip any trailing whitespace for each line of action code
        .replace(/^\s+/mg, '');         // ditto for leading whitespace for each line: we don't care about more or less clean indenting practices in the user code
    }

    // and now go and process the entire grammar:
    productions.forEach(buildProductionAction);

    for (var hash in actionGroups) {
        actions.push([].concat.apply([], actionGroups[hash]).join('') + actionGroupValue[hash] + '\n    break;\n');
    }

    actions.push('}');

    var parameters = 'yytext, yyleng, yylineno, yyloc, yystate /* action[1] */, yysp, yyvstack, yylstack, yystack, yysstack';
    if (this.parseParams) parameters += ', ' + this.parseParams.join(', ');

    this.performAction = [].concat(
        'function parser__PerformAction(' + parameters + ') {',
        actions,
        '}'
    ).join('\n')
    .replace(/\bYYABORT\b/g, 'return false')
    .replace(/\bYYACCEPT\b/g, 'return true')

    // Replace direct symbol references, e.g. #NUMBER# when there's a `%token NUMBER` for your grammar.
    // We allow these tokens to be referenced anywhere in your code as #TOKEN#.
    .replace(/#([^#\s\r\n]+)#/g, function (_, sym) {
        return provideSymbolAsSourcecode(sym);
    });

    this.actionsUseYYLENG = analyzeFeatureUsage(this.performAction, /\byyleng\b/g, 1);
    this.actionsUseYYLINENO = analyzeFeatureUsage(this.performAction, /\byylineno\b/g, 1);
    this.actionsUseYYTEXT = analyzeFeatureUsage(this.performAction, /\byytext\b/g, 1);
    this.actionsUseYYLOC = analyzeFeatureUsage(this.performAction, /\byyloc\b/g, 1);
    this.actionsUseParseError = analyzeFeatureUsage(this.performAction, /\.parseError\b/g, 0);
    this.actionsUseYYERROR = analyzeFeatureUsage(this.performAction, /\byyerror\b/g, 0);
    this.actionsUseYYRECOVERING = analyzeFeatureUsage(this.performAction, /\bYYRECOVERING\b/g, 0);
    this.actionsUseYYERROK = analyzeFeatureUsage(this.performAction, /\byyerrok\b/g, 0);
    this.actionsUseYYCLEARIN = analyzeFeatureUsage(this.performAction, /\byyclearin\b/g, 0);
    // At this point in time, we have already expanded `$name`, `$$` and `$n` to its `$$[n]` index expression.
    //
    // Also cannot use regex `\b` with `\$` as the regex doesn't consider the literal `$` to be a *word* character
    // hence the *boundary check* `\b` won't deliver as expected. Hence we'll have to wing it but we can, assured
    // in the knowledge that the 'sourcecode' we have here is a complete generated *function* which will include
    // the `function ` prelude and `}` postlude at least! Hence we can replace `\b` with `[^\w]` and we'll be good.
    this.actionsUseValueTracking = analyzeFeatureUsage(this.performAction, /\byyvstack\b/g, 1);
    // Ditto for the specific case where we are assigning a value to `$$`, i.e. `this.$`:
    this.actionsUseValueAssignment = analyzeFeatureUsage(this.performAction, /\bthis\.\$[^\w]/g, 0);
    // Ditto for the expansion of `@name`, `@$` and `@n` to its `yylstack[n]` index expression:
    this.actionsUseLocationTracking = analyzeFeatureUsage(this.performAction, /\byylstack\b/g, 1);
    // Ditto for the specific case where we are assigning a value to `@$`, i.e. `this._$`:
    this.actionsUseLocationAssignment = analyzeFeatureUsage(this.performAction, /\bthis\._\$[^\w]/g, 0);
    // Note that the `#name`, `#$` and `#n` constructs are expanded directly to their symbol number without
    // the need to use yystack! Hence yystack is only there for very special use action code.)
    this.actionsUseYYSTACK = analyzeFeatureUsage(this.performAction, /\byystack\b/g, 1);
    // Ditto for yysstack...
    this.actionsUseYYSSTACK = analyzeFeatureUsage(this.performAction, /\byysstack\b/g, 1);
    this.actionsUseYYSTACKPOINTER = analyzeFeatureUsage(this.performAction, /\byysp\b/g, 1);

    this.performAction = this.performAction
    .replace(/\byyerror\b/g, 'yy.parser.yyError')
    .replace(/\bYYRECOVERING\b(?:\s*\(\s*\))?/g, 'yy.parser.yyRecovering()')
    .replace(/\byyerrok\b(?:\s*\(\s*\))?/g, 'yy.parser.yyErrOk()')
    .replace(/\byyclearin\b(?:\s*\(\s*\))?/g, 'yy.parser.yyClearIn()');

    // Now that we've completed all macro expansions, it's time to execute
    // the recovery code, i.e. the postprocess:
    this.performAction = postprocessActionCode(this.performAction);

    // Now obtain an *EMPTY* `parser__PerformAction()` to compare against and see if all the work
    // actually delivered any code that is important and needs executing.
    // If not, we can discard the entire function!
    //
    // Since we'll recursively invoke this implementation (but with a completely different
    // `this` reference!), we MUST check if we're currently already constructing such an
    // 'empty call':
    var actionsBaseline = '';
    if (!this.__constructing_empty_PerformAction_function) {
      var empty_parser = {
        __constructing_empty_PerformAction_function: true,

        parseParams: this.parseParams,
        moduleInclude: '',
        moduleInit: [],
        actionInclude: '',
        productions: [],
        nonterminals: [],
        symbols: [],
        operators: [],
      };
      buildProductionActions.call(empty_parser);
      var actionsBaseline = empty_parser.performAction;

      // report whether there are actually any custom actions at all (or any custom actions' prep code); this
      // flag will be set when the generated function is essentially *empty*:
      this.actionsAreAllDefault = (actionsBaseline.replace(/\s+/g, ' ') === this.performAction.replace(/\s+/g, ' '));
    }

    if (devDebug || this.DEBUG) {
        Jison.print('Optimization analysis: ', {
            actionsAreAllDefault: this.actionsAreAllDefault,
            actionsUseYYLENG: this.actionsUseYYLENG,
            actionsUseYYLINENO: this.actionsUseYYLINENO,
            actionsUseYYTEXT: this.actionsUseYYTEXT,
            actionsUseYYLOC: this.actionsUseYYLOC,
            actionsUseParseError: this.actionsUseParseError,
            actionsUseYYERROR: this.actionsUseYYERROR,
            actionsUseYYRECOVERING: this.actionsUseYYRECOVERING,
            actionsUseYYERROK: this.actionsUseYYERROK,
            actionsUseYYCLEARIN: this.actionsUseYYCLEARIN,
            actionsUseValueTracking: this.actionsUseValueTracking,
            actionsUseValueAssignment: this.actionsUseValueAssignment,
            actionsUseLocationTracking: this.actionsUseLocationTracking,
            actionsUseLocationAssignment: this.actionsUseLocationAssignment,
            actionsUseYYSTACK: this.actionsUseYYSTACK,
            actionsUseYYSSTACK: this.actionsUseYYSSTACK,
            actionsUseYYSTACKPOINTER: this.actionsUseYYSTACKPOINTER,
            hasErrorRecovery: this.hasErrorRecovery,
            noDefaultAction: this.options.noDefaultAction,
            noTryCatch: this.options.noTryCatch,
        });
    }

    // And before we leave, as a SIDE EFFECT of this call, we also fixup
    // the other code chunks specified in the grammar file:
    //
    // Replace direct symbol references, e.g. #NUMBER# when there's a `%token NUMBER` for your grammar.
    // We allow these tokens to be referenced anywhere in your code as #TOKEN#.
    this.moduleInclude = postprocessActionCode(
        preprocessActionCode(this.moduleInclude)
        .replace(/#([^#\s\r\n]+)#/g, function (_, sym) {
            return provideSymbolAsSourcecode(sym);
        })
    );
    this.moduleInit.forEach(function (chunk) {
        assert(chunk.qualifier);
        assert(typeof chunk.include === 'string');
        chunk.include = postprocessActionCode(
            preprocessActionCode(chunk.include)
            .replace(/#([^#\s\r\n]+)#/g, function (_, sym) {
                return provideSymbolAsSourcecode(sym);
            })
        );
    });


    function analyzeFeatureUsage(sourcecode, feature, threshold) {
        var found = sourcecode.match(feature);
        return !!(found && found.length > threshold);
    }

    // make sure a comment does not contain any embedded '*/' end-of-comment marker
    // as that would break the generated code
    function postprocessComment(str) {
        if (Array.isArray(str)) {
            str = str.map(function (_) {
                return (_ === '' || _ == null) ? 'ε' : _;
            }).join(' ');
        }
        if (str === '') {
            str = 'ε';
        }
        str = str.replace(/\*\//g, '*\\/');         // destroy any inner `*/` comment terminator sequence.
        return str;
    }

    function getSymbolId(s) {
        if (s && !self.symbols_[s]) {
            throw new Error('Your action code is trying to reference non-existing symbol "' + s + '"');
        }
        return self.symbols_[s] || false;
    }

    function provideSymbolAsSourcecode(sym) {
        var ss = String(sym);
        return ' /* ' + postprocessComment(ss) + ' */ ' + getSymbolId(sym);
    }

    // helper: convert index string/number to proper JS add/subtract expression
    function indexToJsExpr(n, len, rule4msg) {
        var v = parseInt(n, 10);
        // the usual situation: `$3`; MUST reference an rhs[] element or it will be considered an ERROR:
        if (v > 0) {
            if (len - v < 0) {
                throw new Error('invalid token reference in action code for rule: "' + rule4msg + '"');
            }
            v = len - v;
            if (v) {
                return ' - ' + v;
            }
            // do not generate code for superfluous `- 0` JS expression:
            return '';
        }
        // the VERY UNusual situation: `$-1`: referencing *parent* rules' values
        if (v < 0) {
            return ' - ' + (len - v);
        }
        // decode error?
        if (v !== 0) {
            throw new Error('invalid token reference in action code for rule: "' + rule4msg + '"');
        }
        // the slightly unusual situation: `$0` (instead of `$$`)
        v = len;
        if (v) {
            return ' - ' + v;
        }
        // do not generate code for superfluous `- 0` JS expression:
        return '';
    }

    function buildProductionAction(handle, index) {
        var r, i;

        if (devDebug) Jison.print('\nbuildProductionAction: ', handle.symbol, ':', JSON.stringify(handle, null, 2));

        if (handle.action) {
            var aliased = handle.aliases,
                rhs_i;

            var rhs = handle.handle;
            var named_token_re = new XRegExp('^[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*$');

            // semantic action specified
            var label = [
                'case ', handle.id, ':',
                '\n    /*! Production::    ', postprocessComment(handle.symbol), ' : '
            ].concat(postprocessComment(rhs.map(function (sym) {
                // check if the symbol is a literal terminal, and if it is, quote it:
                if (sym && !self.nonterminals[sym] && !named_token_re.test(sym)) {
                    return '"' + sym.replace(/["]/g, '\\"') + '"';
                }
                return sym;
            })), ' */\n');
            var action = preprocessActionCode(handle.action);
            var actionHash;
            var rule4msg = handle.symbol + ': ' + rhs.join(' ');

            // before anything else, replace direct symbol references, e.g. #NUMBER# when there's a %token NUMBER for your grammar.
            // This is done to prevent incorrect expansions where tokens are used in rules as RHS elements: we allow these to
            // be referenced as both #TOKEN# and #TOKEN where the first is a literal token/symbol reference (unrelated to its use
            // in the rule) and the latter is a reference to the token/symbol being used in the rule.
            //
            // Here we expand those direct token/symbol references: #TOKEN#
            action = action
                .replace(/#([^#\s\r\n]+)#/g, function (_, sym) {
                    return provideSymbolAsSourcecode(sym);
                });

            // replace named semantic values ($nonterminal)
            if (action.match(new XRegExp('(?:[$@#]|##)[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*'))) {
                var count = {},
                    names = {},
                    donotalias = {};

                // When the rule is fitted with aliases it doesn't mean that the action code MUST use those:
                // we therefor allow access to both the original (non)terminal and the alias.
                //
                // Also note that each (non)terminal can also be uniquely addressed by [$@]<nonterminal><N>
                // where N is a number representing the number of this particular occurrence of the given
                // (non)terminal.
                //
                // For example, given this (intentionally contrived) production:
                //     elem[alias] elem[another_alias] another_elem[alias] elem[alias] another_elem[another_alias]
                // all the items can be accessed as:
                //     $1 $2 $3 $4 $5
                //     $elem1 $elem2 $another_elem1 $elem3 $another_elem2
                //     $elem $elem2 $another_elem $elem3 $another_elem2
                //     $alias1 $another_alias1 $alias2 $alias3 $another_alias2
                //     $alias $another_alias $alias2 $alias3 $another_alias2
                // where each line above is equivalent to the top-most line. Note the numbers postfixed to
                // both (non)terminal identifiers and aliases alike and also note alias2 === another_elem1:
                // the postfix numbering is independent.
                //
                // WARNING: this feature is disabled for a term when there already exists an
                //          (human-defined) *alias* for this term *or* when the numbered auto-alias already
                //          exists because the user has used it as an alias for another term, e.g.
                //
                //             e: WORD[e1] '=' e '+' e;
                //
                //          would *not* produce the `e1` and `e2` aliases, as `e1` is already defined
                //          as an explicit alias: adding auto-alias `e1` would then break the system,
                //          while `e2` would be ambiguous from the human perspective as he *might* then
                //          expect `e2` and `e3`.
                var addName = function addName(s) {
                    if (donotalias[s])
                        return;

                    if (names[s]) {
                        names[s + (++count[s])] = i + 1;
                    } else {
                        names[s] = i + 1;
                        names[s + '1'] = i + 1;
                        count[s] = 1;
                    }
                };

                // register the alias/rule name when the real one ends with a number, e.g. `rule5` as
                // *blocking* the auto-aliasing process for the term of the same base, e.g. `rule`.
                // This will catch the `WORD[e1]` example above too, via `e1` --> `donotalias['e']`
                var markBasename = function markBasename(s) {
                    if (/[0-9]$/.test(s)) {
                        s = s.replace(/[0-9]+$/, '');
                        donotalias[s] = true;
                    }
                };

                for (i = 0; i < rhs.length; i++) {
                    // mark both regular and aliased names, e.g., `id[alias1]` and `id1`
                    rhs_i = aliased[i];
                    markBasename(rhs_i);
                    if (rhs_i !== rhs[i]) {
                        markBasename(rhs[i]);
                    }
                }

                for (i = 0; i < rhs.length; i++) {
                    // check for aliased names, e.g., id[alias]
                    rhs_i = aliased[i];
                    addName(rhs_i);
                    if (rhs_i !== rhs[i]) {
                        addName(rhs[i]);
                    }
                }
                action = action.replace(
                    new XRegExp('([$@#]|##)([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)', 'g'), function (str, mrkr, pl) {
                        return names[pl] ? mrkr + names[pl] : str;
                    });
            }
            action = action
                // replace references to `$$` with `this.$`, `@$` with `this._$` and `#$` with the token ID of the current rule
                .replace(/\$\$/g, 'this.$')
                .replace(/@\$/g, 'this._$')
                .replace(/#\$/g, function (_) {
                    return provideSymbolAsSourcecode(symbol);
                })
                // replace semantic value references ($n) with stack value (stack[n])
                .replace(/\$(-?\d+)\b/g, function (_, n) {
                    return 'yyvstack[yysp' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
                })
                // same as above for location references (@n)
                .replace(/@(-?\d+)\b/g, function (_, n) {
                    return 'yylstack[yysp' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
                })
                // same as above for positional value references (##n): these represent stack indexes
                .replace(/##(-?\d+)\b/g, function (_, n) {
                    return '(yysp' + indexToJsExpr(n, rhs.length, rule4msg) + ')';
                })
                .replace(/##\$/g, function (_) {
                    return 'yysp';
                })
                // same as above for token ID references (#n)
                .replace(/#(-?\d+)\b/g, function (_, n) {
                    var i = parseInt(n, 10) - 1;
                    if (!rhs[i]) {
                        throw new Error('invalid token location reference in action code for rule: "' + rule4msg + '" - location reference: "' + _ + '"');
                    }
                    return provideSymbolAsSourcecode(rhs[i]);
                });

            action = reindentCodeBlock(action, 4);

            actionHash = mkHashIndex(action);

            // Delay running the postprocess (restore) process until we've done ALL macro expansions:
            //action = postprocessActionCode(action);

            if (actionHash in actionGroups) {
                actionGroups[actionHash].push(label);
            } else {
                actionGroups[actionHash] = [label];
                actionGroupValue[actionHash] = action;
            }
        }
    }
};



generator.createParser = function createParser() {
    throw new Error('Calling abstract method.');
};

// no-op. implemented in debug mixin
generator.trace = function no_op_trace() { };

generator.warn = function warn() {
    var args = Array.prototype.slice.call(arguments, 0);
    Jison.print.call(null, args.join(''));
};

generator.error = function error(msg) {
    throw new Error(msg);
};

// Report a few things about the grammar:
//
// - unused rules
// - stats:
//   + production count     (-> parser table size indicator)
//   + state count          (-> parser table size indicator)
//
generator.reportGrammarInformation = function reportGrammarInformation() {
    if (this.unused_productions.length) {
        this.warn('\nUnused productions in your grammar:\n  ' + this.unused_productions.join('\n  ') + '\n\n');
    }

    if (!this.options.reportStats) {
        return;
    }

    // nonterminals = this.nonterminals,
    // operators = this.operators,
    // this.table
    // this.states
    // this.defaultActions
    // this.productions,
    // this.terms = {};
    // this.operators = {};
    // this.productions = [];
    // this.conflicts = 0;
    // this.new_conflicts_found_this_round = 0;
    // this.conflicting_states = [];
    // this.resolutions = [];
    // this.options = options;
    // this.parseParams = grammar.parseParams;
    // exportDest.parseTable = this.table;
    // exportDest.defaultParseActions = this.defaultActions;
    // exportDest.parseProductions = this.productions_;

    // TODO: the next bit of code is LR type specific: refactor into a
    //       LR specific mixin class later on, so that we can have another
    //       implementation/report for LL and PEG type grammars.

    var rows = 0, cols = 0;
    var colmarks = {};
    var i, j, len;

    for (i = 0, len = this.table.length; i < len; i++) {
        rows++;
        for (j in this.table[i]) {
            if (!colmarks[j]) {
                colmarks[j] = true;
                cols++;
            }
        }
    }
    var defrows = 0;
    var rowmarks = {};
    for (j in this.defaultActions) {
        if (!rowmarks[j]) {
            rowmarks[j] = true;
            defrows++;
        }
    }

    var ntc = 0;
    for (var nt in this.nonterminals) {
        ntc++;
    }

    if (devDebug > 3) Jison.print('LALR parse table: ', {
      table: this.table,
      defaultActions: this.defaultActions
    });

    this.warn('Number of productions in parser:........ ' + this.productions_.length);
    this.warn('Number of non-terminals in grammar:..... ' + ntc);
    this.warn('Number of states:....................... ' + this.states.size());
    this.warn('Number of rows (states) in table:....... ' + this.table.length);
    this.warn('Number of rows in table:................ ' + rows);
    this.warn('Number of columns in table:............. ' + cols);
    this.warn('Number of defaulted rows in table:...... ' + defrows);
    this.warn('Number of unresolvable conflicts:....... ' + this.conflicts);
    this.warn('\n');
};


// Generator debug mixin

var generatorDebug = {
    trace: function debug_trace() {
        if (typeof Jison !== 'undefined' && Jison.print) {
            Jison.print.apply(null, arguments);
        } else if (typeof print !== 'undefined') {
            print.apply(null, arguments);
        } else if (typeof console !== 'undefined' && console.log) {
            console.log.apply(null, arguments);
        }
    },
    beforeprocessGrammar: function () {
        this.trace('Processing grammar.');
    },
    afteraugmentGrammar: function () {
        var trace = this.trace;
        trace('\nSymbols:\n');
        each(this.symbols, function (sym, i) {
            trace(sym + '(' + i + ')');
        });
        trace('\n');
    }
};



/*
 * Mixin for common behaviors of lookahead parsers
 */
var lookaheadMixin = {};

lookaheadMixin.computeLookaheads = function computeLookaheads() {
    if (this.DEBUG) {
        this.mix(lookaheadDebug); // mixin debug methods
    }

    this.computeLookaheads = function () {};
    this.nullableSets();
    this.firstSets();
    this.followSets();
};

lookaheadMixin.displayFollowSets = function displayFollowSets() {
    var self = this;
    var symfollowdbg = {};
    this.productions.forEach(function Follow_prod_forEach_debugOut(production, k) {
        // self.trace('Symbol/Follows: ', 'prod:' + k, ':', production.symbol, ' :: ', production.handle.join(' '), '  --> ', self.nonterminals[production.symbol].follows.join(', '));
        var key = ['prod-', k, ':  ', production.symbol, ' := ', production.handle.join(' ')].join('');
        var flw = '[' + self.nonterminals[production.symbol].follows.join(']  [') + ']';
        if (!symfollowdbg[flw]) {
            symfollowdbg[flw] = {};
        }
        if (!symfollowdbg[flw][key]) {
            symfollowdbg[flw][key] = 1;
        } else {
            assert(0);
            symfollowdbg[flw][key]++;
        }
    });
    for (var l in symfollowdbg) {
        var lst = [];
        for (var k in symfollowdbg[l]) {
            lst.push(k);
        }
        self.trace('Symbol/Follows:\n   ', lst.join('\n    '), ' -->\n        ', l);
    }
};

// calculate follow sets based on first and nullable
lookaheadMixin.followSets = function followSets() {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true,
        count = 0;

    // loop until no further changes have been made
    while (cont) {
        cont = false;
        count++;

        productions.forEach(function Follow_prod_forEach(production, k) {
            if (devDebug > 3) Jison.print('Symbol/Follows: ', 'round:' + count, 'prod:' + k, ':', production.symbol, ' --> ', nonterminals[production.symbol].follows.join(', '));

            // q is used in Simple LALR algorithm determine follows in context
            var q;
            var ctx = !!self.go_;

            for (var i = 0, t; (t = production.handle[i]); ++i) {
                if (!nonterminals[t]) continue;

                // for Simple LALR algorithm, self.go_ checks if
                if (ctx) {
                    q = self.go_(production.symbol, production.handle.slice(0, i));
                }
                var bool = (!ctx || q === self.nterms_[t]);
                var set;

                if (i === production.handle.length - 1 && bool) {
                    set = nonterminals[production.symbol].follows;
                } else {
                    var part = production.handle.slice(i + 1);

                    set = self.first(part);
                    if (self.nullable(part) && bool) {
                        assert(nonterminals[production.symbol].follows);
                        set.push.apply(set, nonterminals[production.symbol].follows);
                    }
                }
                var follows = nonterminals[t].follows;
                var oldcount = follows.length;
                follows = union(follows, set);
                if (oldcount !== follows.length) {
                    cont = true;
                }
                nonterminals[t].follows = follows;
            }
        });
    }

    if (devDebug || this.DEBUG) {
        this.displayFollowSets();
    }
};

// return the FIRST set of a symbol or series of symbols
lookaheadMixin.first = function first(symbol) {
    // epsilon
    if (symbol === '') {
        return [];
    // RHS
    } else if (symbol instanceof Array) {
        var firsts = [];
        for (var i = 0, t; (t = symbol[i]); ++i) {
            if (!this.nonterminals[t]) {
                if (firsts.indexOf(t) === -1) {
                    firsts.push(t);
                }
            } else {
                firsts = union(firsts, this.nonterminals[t].first);
            }
            if (!this.nullable(t))
                break;
        }
        return firsts;
    // terminal
    } else if (!this.nonterminals[symbol]) {
        return [symbol];
    // nonterminal
    } else {
        return this.nonterminals[symbol].first;
    }
};

// fixed-point calculation of FIRST sets
lookaheadMixin.firstSets = function firstSets() {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true,
        symbol, firsts;

    // loop until no further changes have been made
    while (cont) {
        cont = false;

        productions.forEach(function FirstSets_forEach(production, k) {
            var firsts = self.first(production.handle);
            if (firsts.length !== production.first.length) {
                production.first = firsts;
                cont = true;
            }
        });

        for (symbol in nonterminals) {
            firsts = [];
            nonterminals[symbol].productions.forEach(function FirstSets_forEachNonTerm(production) {
                firsts = union(firsts, production.first);
            });
            if (firsts.length !== nonterminals[symbol].first.length) {
                nonterminals[symbol].first = firsts;
                cont = true;
            }
        }
    }
};

// fixed-point calculation of NULLABLE
lookaheadMixin.nullableSets = function nullableSets() {
    var nonterminals = this.nonterminals,
        self = this,
        cont = true;

    // loop until no further changes have been made
    while (cont) {
        cont = false;

        // check if each production is nullable
        this.productions.forEach(function isEachProductionNullable(production, k) {
            if (!production.nullable) {
                for (var i = 0, n = 0, t; (t = production.handle[i]); ++i) {
                    if (self.nullable(t)) n++;
                }
                if (n === i) { // production is nullable if all tokens are nullable
                    production.nullable = cont = true;
                }
            }
        });

        // check if each symbol is nullable
        for (var symbol in nonterminals) {
            if (!this.nullable(symbol)) {
                for (var i = 0, production; (production = nonterminals[symbol].productions.item(i)); i++) {
                    if (production.nullable) {
                        nonterminals[symbol].nullable = cont = true;
                    }
                }
            }
        }
    }
};

// check if a token or series of tokens is nullable
lookaheadMixin.nullable = function nullable(symbol) {
    // epsilon
    if (symbol === '') {
        return true;
    // RHS
    } else if (symbol instanceof Array) {
        for (var i = 0, t; (t = symbol[i]); ++i) {
            if (!this.nullable(t)) {
                return false;
            }
        }
        return true;
    // terminal
    } else if (!this.nonterminals[symbol]) {
        return false;
    // nonterminal
    } else {
        return this.nonterminals[symbol].nullable;
    }
};


// lookahead debug mixin
var lookaheadDebug = {
    beforenullableSets: function () {
        this.trace('Computing Nullable sets.');
    },
    beforefirstSets: function () {
        this.trace('Computing First sets.');
    },
    beforefollowSets: function () {
        this.trace('Computing Follow sets.');
    },
    afterfollowSets: function () {
        var trace = this.trace;
        trace('\nNonterminals:\n');
        each(this.nonterminals, function (nt, t) {
            trace(nt.toString(), '\n');
        });
        trace('\n');
    }
};

/*
 * Mixin for common LR parser behavior
 */
var lrGeneratorMixin = {};


// LR state machine actions:
const NONASSOC = 0;
const SHIFT = 1; // shift
const REDUCE = 2; // reduce
const ACCEPT = 3; // accept


lrGeneratorMixin.buildTable = function buildTable() {
    if (this.DEBUG) {
        this.mix(lrGeneratorDebug); // mixin debug methods
    }

    this.states = this.canonicalCollection();

    if (devDebug || this.DEBUG) {
        Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER canonicalCollection:');
        this.displayFollowSets();
        Jison.print('\n');
    }

    this.table = this.parseTable(this.states);

    if (devDebug || this.DEBUG) {
        Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable:');
        this.displayFollowSets();
        Jison.print('\n');
    }

    this.defaultActions = findDefaults(this.table, this.hasErrorRecovery);
    cleanupTable(this.table);

    traceStates(this.trace, this.states, 'at the end of LR::buildTable(), after cleanupTable()');
};

lrGeneratorMixin.Item = typal.construct({
    constructor: function Item(production, dotPosition, followSet, predecessor) {
        this.production = production;
        this.dotPosition = dotPosition || 0;
        this.follows = followSet || [];
        this.predecessor = predecessor;
        this.id = production.id + '#' + this.dotPosition;
        this.markedSymbol = this.production.handle[this.dotPosition];
    },
    remainingHandle: function () {
        return this.production.handle.slice(this.dotPosition + 1);
    },
    eq: function (e) {
        return e.id === this.id;
    },
    handleToString: function () {
        var handle = this.production.handle.slice(0);
        handle[this.dotPosition] = '.' + (handle[this.dotPosition] || '');
        return handle.join(' ');
    },
    toString: function () {
        var temp = this.production.handle.slice(0);
        temp[this.dotPosition] = '.' + (temp[this.dotPosition] || '');
        var s = this.production.symbol + ' -> ' + temp.join(' ');
        var padlen = Math.max(4, 40 - s.length);
        var pad = new Array(padlen);
        if (this.follows.length) {
            s += pad.join(' ') + '#lookaheads= [' + this.follows.join(']  [') + ']';
            pad = new Array(2);
        }
        if (this.reductions && this.reductions.length) {
            s += pad.join(' ') + '#reductions= [' + this.reductions.join(']  [') + ']';
            pad = new Array(2);
        }
        return s;
    }
});

lrGeneratorMixin.ItemSet = Set.prototype.construct({
    afterconstructor: function () {
        this.reductions = [];
        this.goes = {};
        this.edges = {};
        this.shifts = false;
        this.inadequate = false;
        this.hash_ = {};
        for (var i = this._items.length - 1; i >= 0; i--) {
            this.hash_[this._items[i].id] = true; //i;
        }
    },
    concat: function concat(set) {
        var a = set._items || set;
        for (var i = a.length - 1; i >= 0; i--) {
            this.hash_[a[i].id] = true;
        }
        this._items.push.apply(this._items, a);
        return this;
    },
    push: function (item) {
        this.hash_[item.id] = true;
        return this._items.push(item);
    },
    contains: function (item) {
        return this.hash_[item.id];
    },
    valueOf: function toValue() {
        var v = this._items.map(function (a) { return a.id; }).sort().join('|');
        this.valueOf = function valueOf_inner() { return v; };
        return v;
    }
});

lrGeneratorMixin.closureOperation = function closureOperation(itemSet) {
    var closureSet = new this.ItemSet();
    var self = this;

    var set = itemSet,
        itemQueue,
        syms = {};

    do {
        itemQueue = new Set();
        closureSet = closureSet.concat(set);
        set.forEach(function CO_set_forEach(item) {
            var symbol = item.markedSymbol;

            // if token is a non-terminal, recursively add closures
            if (symbol && self.nonterminals[symbol]) {
                if (!syms[symbol]) {
                    self.nonterminals[symbol].productions.forEach(function CO_nt_forEach(production) {
                        var newItem = new self.Item(production, 0);
                        if (!closureSet.contains(newItem)) {
                            itemQueue.push(newItem);
                        }
                    });
                    syms[symbol] = true;
                }
            } else if (!symbol) {
                // reduction
                closureSet.reductions.push(item);
                closureSet.inadequate = closureSet.reductions.length > 1 || closureSet.shifts;
            } else {
                // shift
                closureSet.shifts = true;
                closureSet.inadequate = closureSet.reductions.length > 0;
            }
        });

        set = itemQueue;
    } while (!itemQueue.isEmpty());

    return closureSet;
};

lrGeneratorMixin.gotoOperation = function gotoOperation(itemSet, symbol) {
    var gotoSet = new this.ItemSet(),
        self = this;

    itemSet.forEach(function goto_forEach(item, n) {
        if (item.markedSymbol === symbol) {
            gotoSet.push(new self.Item(item.production, item.dotPosition + 1, item.follows, n));
        }
    });

    return gotoSet;
};

/*
 * Create unique set of item sets
 */
lrGeneratorMixin.canonicalCollection = function canonicalCollection() {
    var item1 = new this.Item(this.productions[0], 0, [this.EOF]);
    var firstStateNoClosure = new this.ItemSet(item1),
        firstState = this.closureOperation(firstStateNoClosure),
        states = new Set(firstState),
        marked = 0,
        self = this,
        itemSet,
        markedSymbols;

    states.has = {};
    states.has[firstStateNoClosure.valueOf()] = 0;

    if (devDebug > 0) Jison.print('canonicalCollection: ', states.has);

    while (marked !== states.size()) {
        itemSet = states.item(marked);
        markedSymbols = {};
        itemSet.forEach(function CC_itemSet_forEach(item) {
            if (item.markedSymbol && !markedSymbols[item.markedSymbol] && item.markedSymbol !== self.EOF) {
                markedSymbols[item.markedSymbol] = true;
                self.canonicalCollectionInsert(item.markedSymbol, itemSet, states, marked);
            }
        });
        marked++;
    }

    return states;
};

// Pushes a unique state into the queue. Some parsing algorithms may perform additional operations
lrGeneratorMixin.canonicalCollectionInsert = function canonicalCollectionInsert(symbol, itemSet, states, stateNum) {
    var g = this.gotoOperation(itemSet, symbol),
        state = states.has[g.valueOf()];

    if (state !== undefined) {
        itemSet.edges[symbol] = state;       // store goto transition for table
        states.item(state).predecessors[symbol].push(stateNum);
    } else {
        // add g to queue if not empty or duplicate
        if (!g.isEmpty()) {
            states.has[g.valueOf()] = states.size();
            g = this.closureOperation(g);
            if (!g.predecessors) {
                g.predecessors = {};
            }
            itemSet.edges[symbol] = states.size();  // store goto transition for table
            states.push(g);
            g.predecessors[symbol] = [stateNum];
        }
    }
};

lrGeneratorMixin.parseTable = function lrParseTable(itemSets) {
    var states = [],
        nonterminals = this.nonterminals,
        operators = this.operators,
        conflictedStates = {}, // set of [state, token] tuples
        self = this;

    // for each item set
    itemSets.forEach(function parseTableItem(itemSet, k) {
        k = +k;
        var state = states[k] = {};
        var action, stackSymbol;

        // set shift and goto actions
        for (stackSymbol in itemSet.edges) {
            itemSet.forEach(function findShiftAndGotoActions(item, j) {
                // find shift and goto actions
                if (item.markedSymbol === stackSymbol) {
                    var gotoState = itemSet.edges[stackSymbol];
                    assert(gotoState);
                    if (nonterminals[stackSymbol]) {
                        // store state to go to after a reduce
                        //self.trace(k, stackSymbol, 'g' + gotoState);
                        state[self.symbols_[stackSymbol]] = gotoState;
                    } else {
                        //self.trace(k, stackSymbol, 's' + gotoState);
                        state[self.symbols_[stackSymbol]] = [SHIFT, gotoState];
                    }
                }
            });
        }

        // set accept action
        itemSet.forEach(function setAcceptAction(item, j) {
            if (item.markedSymbol === self.EOF) {
                // accept
                state[self.symbols_[self.EOF]] = [ACCEPT];
            }
        });

        var allterms = self.lookAheads ? false : self.terminals;

        // set reductions and resolve potential conflicts
        itemSet.reductions.forEach(function calcReduction(item, j) {
            // if parser uses lookahead, only enumerate those terminals
            var terminals = allterms || self.lookAheads(itemSet, item);

            terminals.forEach(function (stackSymbol) {
                action = state[self.symbols_[stackSymbol]];
                var op = operators[stackSymbol];

                // Reading a terminal and current position is at the end of a production, try to reduce
                if (action) {
                    var sol = resolveConflict(item.production, op, [REDUCE, item.production.id], action[0] instanceof Array ? action[0] : action);
                    self.resolutions.push([k, stackSymbol, sol]);
                    if (sol.bydefault) {
                        self.conflicts++;

                        if (self.conflict_fixing_round && self.options.hasPartialLrUpgradeOnConflict) {
                            // have we encountered a *new* conflict, compared to previous rounds?
                            if (!self.conflict_productions_LU[item.production.id]) {
                                self.new_conflicts_found_this_round++;
                                // and we RESET the `conflict_fixing_round` flag to signal that
                                // this round needs another one to attempt a *complete* fix
                                // of the grammar.
                                //
                                // This little act also conveniently helps to manage the
                                // *finity* of the big parsetable production loop, which
                                // wraps around all this work (and more).
                                self.conflict_fixing_round = false;
                                if (self.enableDebugLogs) {
                                    self.warn('RESET conflict fixing: we need another round to see us through...');
                                }
                            }
                        }
                        if (!self.conflict_fixing_round && self.options.hasPartialLrUpgradeOnConflict) {
                            self.conflict_productions_LU[item.production.id] = true;
                            self.conflict_states_LU[k] = true;

                            if (devDebug > 4) Jison.print('Registering conflict: ', {
                                prod_id: item.production.id,
                                stateNum: k,
                                state: state,
                                production: item.production
                            });
                        }

                        if (self.enableDebugLogs) {
                            self.warn('Conflict in grammar: multiple actions possible when lookahead token is ', stackSymbol, ' in state ', k, '\n- ', printAction(sol.r, self), '\n- ', printAction(sol.s, self), '\n  (', sol.msg, ')');
                        }
                        conflictedStates[k] = {
                            reduction: item,
                            symbol: stackSymbol,
                            resolution: sol,
                            state: k
                        };

                        if (self.options.noDefaultResolve) {
                            if (!(action[0] instanceof Array)) {
                                action = [action];
                            }
                            action.push(sol.r);
                        }
                    } else {
                        action = sol.action;
                    }
                } else {
                    action = [REDUCE, item.production.id];
                }
                if (action && action.length) {
                    state[self.symbols_[stackSymbol]] = action;
                } else if (action === NONASSOC) {
                    state[self.symbols_[stackSymbol]] = NONASSOC;
                    // ^- Can't delete this node right away as it will influence
                    // `findDefaults()` decision-making process adversely when this state is
                    // not visible at that time. Hence we defer cleanup to the function
                    // `cleanupTable()` which will be invoked at the very end: the NONASSOC
                    // transition signals a transition into an ERROR state and we don't care
                    // for the explicit zero(0) to be present in our table as anything
                    // 'falsey' as an action code will be considered an error state in
                    // the parser and not having these zeroes around keeps the table small(er).
                }
            });
        });
    });

    self.conflicting_states = conflictedStates;

    if (self.conflicts > 0) {
        if (this.numExpectedConflictStates !== self.conflicts || self.enableDebugLogs) {
            self.warn('\nStates with conflicts:');
            each(conflictedStates, function report_conflict_state(val, state) {
                self.warn('\nState ' + state, '    (' + val.symbol + ' @ ' + val.reduction.production.symbol + ' -> ' + val.reduction.handleToString() + ')\n');
                self.warn('  ', itemSets.item(state).join('\n  '));
            });
            self.warn('\n');
        }
    }

    return states;
};

// find states with only one action: a reduction.
//
// Note: only the state columns for EOF/ERROR/terminals are relevant here as those
// columns are the only ones ever visited by the table lookup code at the top
// of the loop in the parse kernel as the `symbol` index used there cannot ever
// contain a *nonterminal* value!
//
// The nonterminals are recognizable in the table by having numeric entries, rather
// than 1-or-2-element array values, as they only store a GOTO state.
//
// ---
//
// Another 'default' is when all listed terminals all point to the exact same reduce state;
// only this time we are careful about the TERROR symbol as a state carrying that one
// is an explicitly encoded error recovery rule and should remain as-is.
function findDefaults(states, hasErrorRecovery) {
    var defaults = {};
    states.forEach(function (state, k) {
        var act, sym, st, def;
        var i = 0;
        var gotos = {};

        for (sym in state) {
            assert({}.hasOwnProperty.call(state, sym));    // it this isn't true, the last part of this function won't work!
            // keep state rows where there's an error recovery state:
            if (sym === 2 /* TERROR */) {
                return;
            }
            st = state[sym];
            if (typeof st !== 'number') {
                if (st[0] !== REDUCE) {
                    // not a reduce action: forget about this row!
                    return;
                }
                var go = st[1];
                if (!gotos[go]) {
                    gotos[go] = true;
                    i++;
                    act = sym;
                }
            } else if (st === NONASSOC) {
                // forget about this row: it's a state where we should kick up an error
                // because you're trying to get associativity going where there is none!
                return;
            }
        }

        if (i === 1) {
            // only one action in state and it's a reduction; hence we only need to store the new (goto production) state:
            defaults[k] = state[act][1];

            // ... and nuke the entry/entries in the parse table to save space in the generated output: we won't be needing
            // it any more! But make sure we keep the slots for the nonterminal symbols, so only nuke the *terminal* entries!
            //
            // Aber Oh-ho! The table[] entries themselves *are* used: they are needed by
            // the error recovery code to decide, when SHIFTING, if the ERROR token would
            // improve (fix) matters when it is treated as an *inserted* token.  This code
            // is therefor not executed then!
            //
            // ... hence we only nuke these table entries (as that makes for a smaller table --> smaller parser file)
            // when there's no error recovery code included in the generated parser:
            if (!hasErrorRecovery) {
                for (sym in state) {
                    st = state[sym];
                    if (typeof st !== 'number') {
                        delete state[sym];
                    }
                }
            }
        }
    });

    return defaults;
}

// Remove all NONASSOC state transitions from the generated table now that we don't need them any longer
function cleanupTable(table) {
    table.forEach(function (state, k) {
        var symbol;

        for (symbol in state) {
            if (state[symbol] === NONASSOC) {
                delete state[symbol];
            }
        }
    });
}

// resolves shift-reduce and reduce-reduce conflicts
function resolveConflict(production, op, reduce, shift) {
    var sln = {
            production: production,
            operator: op,
            r: reduce,
            s: shift,

            msg: null,
            action: null,
            bydefault: false
        };

    if (shift[0] === REDUCE) {
        sln.msg = 'Resolved R/R conflict: use first production declared in grammar.';
        sln.action = shift[1] < reduce[1] ? shift : reduce;
        if (shift[1] !== reduce[1]) sln.bydefault = true;
        return sln;
    }

    if (production.precedence === 0 || !op) {
        sln.msg = 'Resolved S/R conflict: shift by default.';
        sln.bydefault = true;
        sln.action = shift;
    } else if (production.precedence < op.precedence) {
        sln.msg = 'Resolved S/R conflict: shift for higher precedent operator.';
        sln.action = shift;
    } else if (production.precedence === op.precedence) {
        if (op.assoc === 'right') {
            sln.msg = 'Resolved S/R conflict: shift for right associative operator.';
            sln.action = shift;
        } else if (op.assoc === 'left') {
            sln.msg = 'Resolved S/R conflict: reduce for left associative operator.';
            sln.action = reduce;
        } else if (op.assoc === 'nonassoc') {
            sln.msg = 'Resolved S/R conflict: no action for non-associative operator.';
            sln.action = NONASSOC;
        }
    } else {
        sln.msg = 'Resolved conflict: reduce for higher precedent production.';
        sln.action = reduce;
    }

    return sln;
}

/*
 * Mixin for common LR/LL/*any* parser behavior
 */
var generatorMixin = {};

// internal helper function:
generatorMixin.__prepareOptions = function parser___prepare_Options(opt) {
    opt = mkStdOptions(this.options, opt);
    this.options = opt;
    this.DEBUG = !!opt.debug;
    if (devDebug > 3) {
        Jison.print('GENERATE::OPTIONS:\n', this.options);
    }

    // check for illegal identifier
    if (!opt.moduleName || !opt.moduleName.match(/^[a-zA-Z_$][a-zA-Z0-9_$\.]*?[a-zA-Z0-9_$]$/)) {
        if (opt.moduleName) {
            var msg = 'WARNING: The specified moduleName "' + opt.moduleName + '" is illegal (only characters [a-zA-Z0-9_$] and "." dot are accepted); using the default moduleName "parser" instead.';
            if (typeof opt.warn_cb === 'function') {
                opt.warn_cb(msg);
            } else if (opt.warn_cb) {
                Jison.print(msg);
            } else {
                // do not treat as warning; barf hairball instead so that this oddity gets noticed right away!
                throw new Error(msg);
            }
        }
        opt.moduleName = opt.defaultModuleName;
    }
    return opt;
};

generatorMixin.generateGenericHeaderComment = function generateGenericHeaderComment() {
    var out = '/* parser generated by jison ' + version + ' */\n'
        + `
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}     The so-called "shared state" or rather the *source* of it;
 *               the real "shared state" \`yy\` passed around to
 *               the rule actions, etc. is a derivative/copy of this one,
 *               not a direct reference!
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    EOF: 1,
 *    TERROR: 2,
 *
 *    trace: function(errorMessage, ...),
 *
 *    JisonParserError: function(msg, hash),
 *
 *    quoteName: function(name),
 *               Helper function which can be overridden by user code later on: put suitable
 *               quotes around literal IDs in a description string.
 *
 *    originalQuoteName: function(name),
 *               The basic quoteName handler provided by JISON.
 *               \`cleanupAfterParse()\` will clean up and reset \`quoteName()\` to reference this function
 *               at the end of the \`parse()\`.
 *
 *    describeSymbol: function(symbol),
 *               Return a more-or-less human-readable description of the given symbol, when
 *               available, or the symbol itself, serving as its own 'description' for lack
 *               of something better to serve up.
 *
 *               Return NULL when the symbol is unknown to the parser.
 *
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    nonterminals: {associative list: rule-name ==> {associative list: number ==> rule-alt}},
 *    terminal_descriptions_: (if there are any) {associative list: number ==> description},
 *    productions_: [...],
 *
 *    performAction: function parser__performAction(yytext, yyleng, yylineno, yyloc, yystate, yysp, yyvstack, yylstack, yystack, yysstack, ...),
 *               where \`...\` denotes the (optional) additional arguments the user passed to
 *               \`parser.parse(str, ...)\` and specified by way of \`%parse-param ...\` in the grammar file
 *
 *               The function parameters and \`this\` have the following value/meaning:
 *               - \`this\`    : reference to the \`yyval\` internal object, which has members (\`$\` and \`_$\`)
 *                             to store/reference the rule value \`$$\` and location info \`@$\`.
 *
 *                 One important thing to note about \`this\` a.k.a. \`yyval\`: every *reduce* action gets
 *                 to see the same object via the \`this\` reference, i.e. if you wish to carry custom
 *                 data from one reduce action through to the next within a single parse run, then you
 *                 may get nasty and use \`yyval\` a.k.a. \`this\` for storing you own semi-permanent data.
 *
 *               - \`yytext\`  : reference to the lexer value which belongs to the last lexer token used
 *                             to match this rule. This is *not* the look-ahead token, but the last token
 *                             that's actually part of this rule.
 *
 *                 Formulated another way, \`yytext\` is the value of the token immediately preceeding
 *                 the current look-ahead token.
 *                 Caveats apply for rules which don't require look-ahead, such as epsilon rules.
 *
 *               - \`yyleng\`  : ditto as \`yytext\`, only now for the lexer.yyleng value.
 *
 *               - \`yylineno\`: ditto as \`yytext\`, only now for the lexer.yylineno value.
 *
 *               - \`yyloc\`   : ditto as \`yytext\`, only now for the lexer.yylloc lexer token location info.
 *
 *               - \`yystate\` : the current parser state number, used internally for dispatching and
 *                             executing the action code chunk matching the rule currently being reduced.
 *
 *               - \`yysp\`    : the current state stack position (a.k.a. 'stack pointer')
 *
 *                 This one comes in handy when you are going to do advanced things to the parser
 *                 stacks, all of which are accessible from your action code (see the next entries below).
 *
 *                 Also note that you can access this and other stack index values using the new double-hash
 *                 syntax, i.e. \`##$ === ##0 === yysp\`, while \`##1\` is the stack index for all things
 *                 related to the first rule term, just like you have \`$1\`, \`@1\` and \`#1\`.
 *                 This is made available to write very advanced grammar action rules, e.g. when you want
 *                 to investigate the parse state stack in your action code, which would, for example,
 *                 be relevant when you wish to implement error diagnostics and reporting schemes similar
 *                 to the work described here:
 *
 *                 + Pottier, F., 2016. Reachability and error diagnosis in LR(1) automata.
 *                   In Journées Francophones des Languages Applicatifs.
 *
 *                 + Jeffery, C.L., 2003. Generating LR syntax error messages from examples.
 *                   ACM Transactions on Programming Languages and Systems (TOPLAS), 25(5), pp.631–640.
 *
 *               - \`yyvstack\`: reference to the parser value stack. Also accessed via the \`$1\` etc.
 *                             constructs.
 *
 *               - \`yylstack\`: reference to the parser token location stack. Also accessed via
 *                             the \`@1\` etc. constructs.
 *
 *               - \`yystack\` : reference to the parser token id stack. Also accessed via the
 *                             \`#1\` etc. constructs.
 *
 *                 Note: this is a bit of a **white lie** as we can statically decode any \`#n\` reference to
 *                 its numeric token id value, hence that code wouldn't need the \`yystack\` but *you* might
 *                 want access for your own purposes, such as error analysis as mentioned above!
 *
 *                 Note that this stack stores the current stack of *tokens*, that is the sequence of
 *                 already parsed=reduced *nonterminals* (tokens representing rules) and *terminals*
 *                 (lexer tokens *shifted* onto the stack until the rule they belong to is found and
 *                 *reduced*.
 *
 *               - \`yysstack\`: reference to the parser state stack. This one carries the internal parser
 *                             *states* such as the one in \`yystate\`, which are used to represent
 *                             the parser state machine in the *parse table*. *Very* *internal* stuff,
 *                             what can I say? If you access this one, you're clearly doing wicked things
 *
 *               - \`...\`     : the extra arguments you specified in the \`%parse-param\` statement in your
 *                             grammar definition file.
 *
 *    table: [...],
 *               State transition table
 *               ----------------------
 *
 *               index levels are:
 *               - \`state\`  --> hash table
 *               - \`symbol\` --> action (number or array)
 *
 *                 If the \`action\` is an array, these are the elements' meaning:
 *                 - index [0]: 1 = shift, 2 = reduce, 3 = accept
 *                 - index [1]: GOTO \`state\`
 *
 *                 If the \`action\` is a number, it is the GOTO \`state\`
 *
 *    defaultActions: {...},
 *
 *    parseError: function(str, hash, ExceptionClass),
 *    yyError: function(str, ...),
 *    yyRecovering: function(),
 *    yyErrOk: function(),
 *    yyClearIn: function(),
 *
 *    constructParseErrorInfo: function(error_message, exception_object, expected_token_set, is_recoverable),
 *               Helper function **which will be set up during the first invocation of the \`parse()\` method**.
 *               Produces a new errorInfo 'hash object' which can be passed into \`parseError()\`.
 *               See it's use in this parser kernel in many places; example usage:
 *
 *                   var infoObj = parser.constructParseErrorInfo('fail!', null,
 *                                     parser.collect_expected_token_set(state), true);
 *                   var retVal = parser.parseError(infoObj.errStr, infoObj, parser.JisonParserError);
 *
 *    originalParseError: function(str, hash, ExceptionClass),
 *               The basic \`parseError\` handler provided by JISON.
 *               \`cleanupAfterParse()\` will clean up and reset \`parseError()\` to reference this function
 *               at the end of the \`parse()\`.
 *
 *    options: { ... parser %options ... },
 *
 *    parse: function(input[, args...]),
 *               Parse the given \`input\` and return the parsed value (or \`true\` when none was provided by
 *               the root action, in which case the parser is acting as a *matcher*).
 *               You MAY use the additional \`args...\` parameters as per \`%parse-param\` spec of this grammar:
 *               these extra \`args...\` are passed verbatim to the grammar rules' action code.
 *
 *    cleanupAfterParse: function(resultValue, invoke_post_methods, do_not_nuke_errorinfos),
 *               Helper function **which will be set up during the first invocation of the \`parse()\` method**.
 *               This helper API is invoked at the end of the \`parse()\` call, unless an exception was thrown
 *               and \`%options no-try-catch\` has been defined for this grammar: in that case this helper MAY
 *               be invoked by calling user code to ensure the \`post_parse\` callbacks are invoked and
 *               the internal parser gets properly garbage collected under these particular circumstances.
 *
 *    lexer: {
 *        yy: {...},           A reference to the so-called "shared state" \`yy\` once
 *                             received via a call to the \`.setInput(input, yy)\` lexer API.
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash, ExceptionClass),
 *        setInput: function(input, [yy]),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(n),
 *        upcomingInput: function(n),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index, ...),
 *        next: function(...),
 *        lex: function(...),
 *        begin: function(condition),
 *        pushState: function(condition),
 *        popState: function(),
 *        topState: function(),
 *        _currentRules: function(),
 *        stateStackSize: function(),
 *        cleanupAfterLex: function()
 *
 *        options: { ... lexer %options ... },
 *
 *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START, ...),
 *        rules: [...],
 *        conditions: {associative list: name ==> set},
 *    }
 *  }
 *
 *
 *  token location info (@$, _$, etc.): {
 *    first_line: n,
 *    last_line: n,
 *    first_column: n,
 *    last_column: n,
 *    range: [start_number, end_number]
 *               (where the numbers are indexes into the input string, zero-based)
 *  }
 *
 * ---
 *
 * The \`parseError\` function receives a 'hash' object with these members for lexer and
 * parser errors:
 *
 *  {
 *    text:        (matched text)
 *    token:       (the produced terminal token, if any)
 *    token_id:    (the produced terminal token numeric ID, if any)
 *    line:        (yylineno)
 *    loc:         (yylloc)
 *  }
 *
 * parser (grammar) errors will also provide these additional members:
 *
 *  {
 *    expected:    (array describing the set of expected tokens;
 *                  may be UNDEFINED when we cannot easily produce such a set)
 *    state:       (integer (or array when the table includes grammar collisions);
 *                  represents the current internal state of the parser kernel.
 *                  can, for example, be used to pass to the \`collect_expected_token_set()\`
 *                  API to obtain the expected token set)
 *    action:      (integer; represents the current internal action which will be executed)
 *    new_state:   (integer; represents the next/planned internal state, once the current
 *                  action has executed)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule
 *                  available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    value_stack: (array: the current parser LALR/LR internal \`$$\` value stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    yy:          (object: the current parser internal "shared state" \`yy\`
 *                  as is also available in the rule actions; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    lexer:       (reference to the current lexer instance used by the parser)
 *    parser:      (reference to the current parser instance)
 *  }
 *
 * while \`this\` will reference the current parser instance.
 *
 * When \`parseError\` is invoked by the lexer, \`this\` will still reference the related *parser*
 * instance, while these additional \`hash\` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * When \`parseError\` is invoked by the parser due to a **JavaScript exception** being fired
 * from either the parser or lexer, \`this\` will still reference the related *parser*
 * instance, while these additional \`hash\` fields will also be provided:
 *
 *  {
 *    exception:   (reference to the exception thrown)
 *  }
 *
 * Please do note that in the latter situation, the \`expected\` field will be omitted as
 * this type of failure is assumed not to be due to *parse errors* but rather due to user
 * action code in either parser or lexer failing unexpectedly.
 *
 * ---
 *
 * You can specify parser options by setting / modifying the \`.yy\` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy [, optional parse() args])
 *                 optional: you can specify a pre_parse() function in the chunk following
 *                 the grammar, i.e. after the last \`%%\`.
 *  Parser.post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: you can specify a post_parse() function in the chunk following
 *                 the grammar, i.e. after the last \`%%\`. When it does not return any value,
 *                 the parser will return the original \`retval\`.
 *
 * ### options which can be set up per parser instance
 *
 *  yy: {
 *      pre_parse:  function(yy [, optional parse() args])
 *                 optional: is invoked before the parse cycle starts (and before the first
 *                 invocation of \`lex()\`) but immediately after the invocation of
 *                 \`parser.pre_parse()\`).
 *      post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: is invoked when the parse terminates due to success ('accept')
 *                 or failure (even when exceptions are thrown).
 *                 \`retval\` contains the return value to be produced by \`Parser.parse()\`;
 *                 this function can override the return value by returning another.
 *                 When it does not return any value, the parser will return the original
 *                 \`retval\`.
 *                 This function is invoked immediately before \`Parser.post_parse()\`.
 *
 *      parseError: function(str, hash, ExceptionClass)
 *                 optional: overrides the default \`parseError\` function.
 *      quoteName: function(name),
 *                 optional: overrides the default \`quoteName\` function.
 *  }
 *
 *  parser.lexer.options: {
 *      pre_lex:  function()
 *                 optional: is invoked before the lexer is invoked to produce another token.
 *                 \`this\` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                 optional: is invoked when the lexer has produced a token \`token\`;
 *                 this function can override the returned token value by returning another.
 *                 When it does not return any (truthy) value, the lexer will return
 *                 the original \`token\`.
 *                 \`this\` refers to the Lexer object.
 *
 *      ranges: boolean
 *                 optional: \`true\` ==> token location info will include a .range[] member.
 *      flex: boolean
 *                 optional: \`true\` ==> flex-like lexing behaviour where the rules are tested
 *                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                 optional: \`true\` ==> lexer regexes are tested in order and for invoked;
 *                 the lexer terminates the scan when a token is returned by the action code.
 *      xregexp: boolean
 *                 optional: \`true\` ==> lexer rule regexes are "extended regex format" requiring the
 *                 \`XRegExp\` library. When this %option has not been specified at compile time, all lexer
 *                 rule regexes have been written as standard JavaScript RegExp expressions.
 *  }
 */
`;

    return out;
};

generatorMixin.generate = function parser_generate(opt) {
    opt = this.__prepareOptions(opt);

    var code = '';

    switch (opt.moduleType) {
    case 'js':
        code = this.generateModule(opt);
        break;
    case 'amd':
        code = this.generateAMDModule(opt);
        break;
    case 'es':
        code = this.generateESModule(opt);
        break;
    case 'commonjs':
    default:
        code = this.generateCommonJSModule(opt);
        break;
    }

    return code;
};


generatorMixin.generateAMDModule = function generateAMDModule(opt) {
    opt = this.__prepareOptions(opt);

    var module = this.generateModule_();
    var out = [
        this.generateGenericHeaderComment(),
        '',
        'define(function (require) {',
        module.commonCode,
        '',
        'var parser = ' + module.moduleCode,
        module.modulePostlude,
        '',
        this.moduleInclude
    ];
    if (this.lexer && this.lexer.generateModule) {
      out.push(this.lexer.generateModule());
      out.push('parser.lexer = lexer;');
    }
    out.push('return parser;');
    out.push('});');

    return out.join('\n') + '\n';
};

lrGeneratorMixin.generateESModule = function generateESModule(opt) {
    opt = this.__prepareOptions(opt);

    var module = this.generateModule_();
    var out = [
        this.generateGenericHeaderComment(),
        '',
        module.commonCode,
        '',
        'var parser = ' + module.moduleCode,
        module.modulePostlude,
        '',
        this.moduleInclude
    ];
    if (this.lexer && this.lexer.generateModule) {
      out.push(this.lexer.generateModule());
      out.push('parser.lexer = lexer;');
    }
    out.push('function Parser() { this.yy = {} };');
    out.push('Parser.prototype = parser;');
    out.push('parser.Parser = Parser;');
    out.push('export {parser, Parser};');

    return out.join('\n') + '\n';
};

generatorMixin.generateCommonJSModule = function generateCommonJSModule(opt) {
    opt = this.__prepareOptions(opt);

    var moduleName = opt.moduleName;
    var main = [];
    if (!opt.noMain) {
        main = main.concat([
            '  exports.main = ' + String(opt.moduleMain || commonjsMain) + ';',
            '  if (typeof module !== \'undefined\' && require.main === module) {',
            '    exports.main(process.argv.slice(1));',
            '  }'
        ]);
    }
    var out = [
        this.generateModule(opt),
        '',
        '',
        'if (typeof require !== \'undefined\' && typeof exports !== \'undefined\') {',
        '  exports.parser = ' + moduleName + ';',
        '  exports.Parser = ' + moduleName + '.Parser;',
        '  exports.parse = function () {',
        '    return ' + moduleName + '.parse.apply(' + moduleName + ', arguments);',
        '  };',
        main.join('\n'),
        '}'
    ];
    return out.join('\n') + '\n';
};

generatorMixin.generateModule = function generateModule(opt) {
    opt = this.__prepareOptions(opt);

    var moduleName = opt.moduleName;
    var out = this.generateGenericHeaderComment();

    var self = this;
    var _generateNamespace = function (namespaces, previousNamespace, callback) {
        var subModuleName = namespaces.shift();
        if (subModuleName != null) {
            var moduleName = previousNamespace == null ? subModuleName : previousNamespace + '.' + subModuleName;
            if (namespaces.length > 0) {
                return 'var ' + subModuleName + ';\n'
                    + '(function (' + subModuleName + ') {\n'
                    + _generateNamespace(namespaces, subModuleName, callback)
                    + '\n})(' + subModuleName + (previousNamespace == null ? '' : ' = ' + moduleName) + ' || (' + moduleName + ' = {}));\n';
            }
            return callback(moduleName);
        }
        return '';
    };

    out += _generateNamespace(moduleName.split('.'), null, function _generateNamespace_cb(moduleName) {
        return (moduleName.match(/\./) ? moduleName : 'var ' + moduleName) +
                ' = ' + self.generateModuleExpr() + '\n';
    });

    return out;
};


generatorMixin.generateModuleExpr = function generateModuleExpr() {
    var out;
    var module = this.generateModule_();

    out = [
        '(function () {',
        module.commonCode,
        '',
        'var parser = ' + module.moduleCode,
        module.modulePostlude,
        '',
        this.moduleInclude
    ];
    if (this.lexer && this.lexer.generateModule) {
        out.push(this.lexer.generateModule());
        out.push('parser.lexer = lexer;');
    }
    out = out.concat(['',
        'function Parser() {',
        '  this.yy = {};',
        '}',
        'Parser.prototype = parser;',
        'parser.Parser = Parser;',
        '',
        'return new Parser();',
        '})();'
    ]);
    return out.join('\n') + '\n';
};

function removeUnusedKernelFeatures(parseFn, info) {
    var actionFn = info.performAction;

    if (info.actionsAreAllDefault) {
        // in this case, there's no need to call the parseAction function at all:
        // it is functionally empty anyway.
        actionFn = '';

        // remove:
        //
        //     r = this.performAction.call(yyval, ...);
        //
        //     if (typeof r !== 'undefined') {
        //         retval = r;
        //         break;
        //     }
        //

        parseFn = parseFn
        .replace(/\s+r = this\.performAction\.call[^)]+\)\;/g, '')
        .replace(/\s+if \(typeof r !== 'undefined'\) \{[^}]+\}/g, '');
    }

    if (!info.actionsUseYYTEXT) {
        // Wait with this bit of cleanup until the very end to help keep the
        // other cleanup/optimization options below that much simpler to code:
        if (0) {
            actionFn = actionFn
            .replace(/\(\byytext\b(,\s*)?/g, '(');
        }

        // kill the passing of the local variable as a parameter,
        // its use in an assignment and its declaration:
        parseFn = parseFn
        .replace(/, yytext\b/g, '')
        .replace(/^.*[^.]\byytext = .+$/gm, '')
        .replace(/^.+ = yytext\b.+$/gm, '');
    }

    if (!info.actionsUseYYLENG) {
        actionFn = actionFn
        .replace(/, yyleng\b/g, '');

        // remove:
        //
        //     if (typeof lexer.yyleng === 'undefined') {
        //       lexer.yyleng = 0;
        //     }
        //     var yyleng = lexer.yyleng;
        //     ...

        parseFn = parseFn
        .replace(/, yyleng\b/g, '')
        .replace(/\s+if\b.*?\.yyleng\b.*?\{[^}]+\}/g, '\n')
        .replace(/^.*?\byyleng\b.*?=.*?\byyleng\b.*?$/gm, '');
    }

    if (!info.actionsUseYYLINENO) {
        // The error handling code inside the kernel still uses this one, but only straight off the lexer
        // so we can kill the local var and its usage at least:
        actionFn = actionFn
        .replace(/, yylineno\b/g, '');

        // remove:
        //
        //     var yylineno = lexer.yylineno;
        //     ...

        parseFn = parseFn
        .replace(/, yylineno\b/g, '')
        .replace(/^.*?\byylineno\b.*?=.*?\byylineno\b.*?$/gm, '');
    }

    if (!info.actionsUseYYSTACK) {
        actionFn = actionFn
        .replace(/, yystack\b/g, '');

        parseFn = parseFn
        .replace(/, stack\b/g, '');
    }

    if (!info.actionsUseYYSSTACK) {
        actionFn = actionFn
        .replace(/, yysstack\b/g, '');

        parseFn = parseFn
        .replace(/, sstack\b/g, '');
    }

    if (!info.actionsUseYYLOC && !info.actionsUseLocationTracking && !info.actionsUseLocationAssignment) {
        actionFn = actionFn
        .replace(/\byyloc, (.*?), yylstack\b/g, '$1');

        // remove:
        //
        //    var ranges = lexer.options && lexer.options.ranges;
        //    ...
        //    var yyloc = lexer.yylloc || {};
        //    lstack[sp] = yyloc;
        //    ...
        //        lstack[sp] = lexer.yylloc || {};
        //    ...
        //        // default location, uses first token for firsts, last for lasts
        //        yyval._$ = {
        //            first_line: lstack[lstack_begin].first_line,
        //            last_line: lstack[lstack_end].last_line,
        //            first_column: lstack[lstack_begin].first_column,
        //            last_column: lstack[lstack_end].last_column
        //        };
        //        if (ranges) {
        //          yyval._$.range = [lstack[lstack_begin].range[0], lstack[lstack_end].range[1]];
        //        }
        //    ...

        parseFn = parseFn
        .replace(/\byyloc, (.*?), lstack\b/g, '$1')
        .replace(/\s+if\b.*?\.yylloc\b.*?\{[^}]+\{\s*\}[^}]+\}[^;]+;/g, '\n\n\n\n\n')
        .replace(/\s*\/\/ default location,[^\n]+/g, '\n')
        .replace(/\s+yyval\._\$\s*=\s*\{[^}]+\}[^\{\}]+\{[^}]+\}/g, '\n\n\n\n\n\n\n\n\n')
        .replace(/^\s*var\s+ranges\s+=\s+lexer\.options\s+.*$/gm, '')
        .replace(/^.*?\blstack\b.*$/gm, '')
        .replace(/^.*?\blstack_[a-z]+.*$/gm, '')
        .replace(/^.*?\byyloc\b.*?$/gm, '')
        .replace(/^.*?\byylloc\b.*?$/gm, '')
        .replace(/^\s*_\$:\s+undefined\s*$/gm, '');
    }

    if (!info.actionsUseValueTracking && !info.actionsUseValueAssignment) {
        actionFn = actionFn
        .replace(/, yyvstack\b/g, '');

        parseFn = parseFn
        .replace(/, vstack\b/g, '');

        // kill *all* value tracking when there's also no *implicit* `$$ = $1` action any more:
        if (info.options.noDefaultAction) {
            // remove:
            //
            //     // Make sure subsequent `$$ = $1` bla bla bla ...
            //     vstack[sp] = undefined;
            //     ...up to:
            //     yyval.$ = vstack[sp - len]; // default to $$ = $1
            //
            //     ... and other lines using `vstack[xyz...]` ...

            parseFn = parseFn
            .replace(/\s+\/\/ Make sure subsequent `\$\$ = \$1` \n\s+yyval\.\$ = vstack\[sp - [^\n]+\n/g, '\n\n')
            .replace(/^.*?\bvstack\b.*$/gm, '');

            // also nuke all `yyval`-related code as we know, when this set of
            // features is set, that the grammar doesn't produce any value:
            // we are looking at a *matcher*, rather than a *parser*!
            //
            // remove
            //
            //     // Return the `$accept` rule's `$$` result, if available.
            //     // ...
            //     if (typeof yyval.$ !== 'undefined') {
            //         retval = yyval.$;
            //     }
            //
            // bit keep the yyval declaration as either location tracking MAY
            // still be employed by the grammar OR the grammar uses advanced
            // code which uses `yyval` as a run-time store which carries data
            // across multiple reduction calls to `performAction`, as per
            // the suggestion in the document comment for the grammar:
            //
            // >
            // > One important thing to note about `this` a.k.a. `yyval`: ...
            // >
            parseFn = parseFn
            .replace(/\s+\/\/ Return the \`\$accept\` rule's \`\$\$\` result[\s\S]+?if \(typeof yyval\.\$ !== 'undefined'\)[^\}]+\}[^\n]*\n/g, '\n\n\n\n\n\n');

            // ... unless, of course, when there's no `performAction()` call
            // at all! Then the `yyval` declaration can safely be discarded
            // as well.
            if (info.actionsAreAllDefault) {
                // remove
                //
                //     var yyval = {
                //         $: true,
                //         _$: undefined,
                //         yy: sharedState_yy
                //     };
                parseFn = parseFn
                .replace(/\s+var yyval =[\s\S]+?\};[^\n]*\n/g, '\n\n\n\n\n\n');
            }
        }
    }

    if (!info.DEBUG) {
        // When 'debug mode' hasn't been turned on during parser generation,
        // then we don't allow it at all: this gives us faster production parsers.
        //
        // When you want debug output at parse run-time, then you MUST produce a parser
        // with either the
        //     %debug
        // option set or by invoking JISON with the debug flag `-t`.

        // remove:
        //
        //     var yydebug = false;
        //     ... and delete yydebug function definition ...
        //     ...
        //     if (yydebug) yydebug(...);

        parseFn = parseFn
        .replace(/\s+var yydebug = [\s\S]+?self\.trace[\s\S]+?};[^}]+}/g, '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n')
        // strip single-line `yydebug(...);` statements
        .replace(/^.*?\byydebug\b[^;]+?\);[^\r\n]*?$/gm, '')
        // strip multi-line `if (debug) yydebug(..., {...});` statements
        .replace(/\n\s+if\s+\(yydebug\)\s+yydebug\([^]+?\}\);[^\r\n]*?/g, '\n\n\n\n\n\n\n\n\n');
    }

    if (!info.actionsUseYYERROK && !info.actionsUseYYRECOVERING && !info.actionsUseYYCLEARIN && !info.actionsUseYYERROR) {
        /*
         * Kill long multi-line comment about yyerror + YYRECOVERING + yyerrok + yyclearin before this code:
         *
         *       if (this.yyError) {
         *           ...
         */
        parseFn = parseFn
        .replace(/\s+\/\/.*setup `yyError`, `YYRECOVERING`, `yyErrOk` and `yyClearIn` functions[^\0]+?\n\s+if \(/g, '\n\n\n\n\n  if (');
    }

    if (!info.actionsUseYYERROR) {
        /*
         * Kill this code:
         *
         *       if (this.yyError) {
         *           this.yyError = function yyError(str) {
         *               ...
         *           };
         *       }
         */
        parseFn = parseFn
        .replace(/\s+if \(this\.yyError\) \{[^\0]+?\};\n\s+\}\n/g, '\n\n\n\n\n');
    }

    if (!info.actionsUseYYRECOVERING) {
        /*
         * Kill this code:
         *
         *       if (this.yyRecovering) {
         *           this.yyRecovering = function yyRecovering() {
         *               return recovering;
         *           };
         *       }
         */
        parseFn = parseFn
        .replace(/\s+if \(this\.yyRecovering\) \{[^\0]+?\};\n\s+\}\n/g, '\n\n\n\n\n');
    }

    if (!info.actionsUseYYERROK) {
        /*
         * Kill this code:
         *
         *       if (this.yyErrOk) {
         *           this.yyErrOk = function yyErrOk() {
         *               recovering = 0;
         *           };
         *       }
         */
        parseFn = parseFn
        .replace(/\s+if \(this\.yyErrOk\) \{[^\0]+?\};\n\s+\}\n/g, '\n\n\n\n\n');
    }

    if (!info.actionsUseYYCLEARIN) {
        parseFn = parseFn
        .replace(/\s+if \(this\.yyClearIn\) \{[^\0]+?[^{]\};\n\s+\}\n/g, '\n\n\n\n\n\n');
    }

    if (info.options.noDefaultAction) {
        /*
         * Kill this code:
         *
         *     // perform semantic action
         *     yyval.$ = vstack[sp - len]; // default to $$ = $1
         *
         * and this bit of comment:
         *
         *     // Make sure subsequent `$$ = $1` default action doesn't fail
         *     // for rules where len==0 as then there's no $1 (you're reducing an epsilon rule then!)
         *     //
         *     // Also do this ...
         */
        parseFn = parseFn
        .replace(/\s+\/\/ perform semantic action\n\s+yyval\.\$ = vstack\[sp - [^\n]+\n/g, '\n\n')
        .replace(/\s+\/\/ Make sure subsequent `\$\$ = \$1` default action doesn't fail\n[^\n]+\n[^\n]+\n(\s+\/\/ )Also do this/g, '\n\n\n\n\n$1Do this');

        if (info.options.noTryCatch) {
            /*
             * This is a very performance-oriented setting and does not care if the
             * userland code for the grammar rules is flaky.
             * Kill this protection code:
             *
             *     // Do this to prevent ...
             *     vstack[sp] = undefined;
             */
            parseFn = parseFn
            .replace(/\s+\/\/ Do this to prevent nasty action block codes[^\n]+\n\s+vstack\[sp\] = undefined;[^\n]+\n/g, '\n\n');
        }
    }

    if (info.options.noTryCatch) {
        /*
         * Kill this code:
         *
         *     try {
         *         for (;;) {
         *         ... keep this stuff ...
         *     } catch (ex) {
         *         ... remove this stuff ...
         *     } finally {
         *         retval = this.cleanupAfterParse(retval, true, true);       // <-- keep this line
         *     }
         *
         * and also remove any re-entrant parse() call support:
         *
         *     ... __reentrant_call_depth ...
         */
        parseFn = parseFn
        .replace(/\s+try \{([\s\S]+?)\} catch \(ex\) \{[\s\S]+?\} finally \{([^\}]+)\}/, function replace_noTryCatch(m, p1, p2) {
            p1 = p1.replace(/^        /mg, '    ');
            p2 = p2.replace(/^        /mg, '    ');
            return '\n' + p1 + '\n    // ... AND FINALLY ...\n' + p2;
        })
        .replace(/^[^\n]+\b__reentrant_call_depth\b[^\n]+$/gm, '\n');
    }

    if (!info.actionsUseYYTEXT) {
        // See the comment for the same section near the start of this function:
        //
        // Wait with this bit of cleanup until the very end to help keep the
        // other cleanup/optimization options below that much simpler to code:
        actionFn = actionFn
        .replace(/\(\byytext\b(,\s*)?/g, '(');
    }

    info.performAction = actionFn;

    return parseFn;
}

// Fill in the optional, extra parse parameters (`%parse-param ...`)
// in the generated parser.
//
// See for important context:
//
//     https://github.com/zaach/jison/pull/332
function expandParseArguments(parseFn, self) {
    var arglist = self.parseParams;

    if (!arglist) {
        parseFn = parseFn.replace(/, parseParams\b/g, '');
        parseFn = parseFn.replace(/\bparseParams\b/g, '');
    } else {
        parseFn = parseFn.replace(/, parseParams\b/g, ', ' + arglist.join(', '));
        parseFn = parseFn.replace(/\bparseParams\b/g, arglist.join(', '));
    }
    return parseFn;
}


function pickOneOfTwoCodeAlternatives(parseFn, pick_A_not_B, A_start_marker, B_start_marker, end_marker) {
    // Notes:
    // 1) we use the special /[^\0]*/ regex set as that one will also munch newlines, etc.
    //    while the obvious /.*/ does not as '.' doesn't eat the newlines.
    return parseFn.replace(new RegExp('(' + A_start_marker + '[^\\n]*\\n)([^\\0]*?)(' + B_start_marker + '[^\\n]*\\n)([^\\0]*?)(' + end_marker + '[^\\n]*\\n)', 'g'), function pick_code_alt(str, mA, cA, mB, cB, mE) {
        if (pick_A_not_B) {
            return cA;
        }
        return cB;
    });
}

function addOrRemoveTokenStack(fn, wantTokenStack) {
    var parseFn = fn;
    // We don't use the Esprima+Escodegen toolchain as those loose the code comments easily;
    // instead we just chop the code using labels as sentinels for our chopping-it-up regexes:
    //
    // if (wantTokenStack) {
    //     try {
    //         var ast = esprima.parse(parseFn);
    //         var stackAst = esprima.parse(String(tokenStackLex)).body[0];
    //         stackAst.id.name = 'lex';
    //
    //         var labeled = JSONSelect.match(':has(:root > .label > .name:val("_token_stack"))', ast);
    //
    //         labeled[0].body = stackAst;
    //
    //         return escodegen.generate(ast);
    //     } catch (e) {
    //         return parseFn;
    //     }
    // } else {
    //     // remove the line:
    //     //         tstack = [], // token stack
    //     parseFn = parseFn.replace(/tstack = .*$/m, '');
    //     return parseFn;
    // }
    parseFn = pickOneOfTwoCodeAlternatives(parseFn, !wantTokenStack, '//_lexer_without_token_stack:', '//_lexer_with_token_stack:', '//_lexer_with_token_stack_end:');
    // and some post-coital touch-ups:
    if (wantTokenStack) {
        // And rename the `tokenStackLex` function to become the new `lex`:
        return parseFn.replace(/\btokenStackLex\b/g, 'lex');
    } else {
        // Also nuke the support declaration statement:
        //          tstack = [],
        return parseFn.replace(/^\s*tstack\b.*$/gm, '');
    }
}

// returns parse function with/without error recovery code
function pickErrorHandlingChunk(fn, hasErrorRecovery) {
    var parseFn = fn;

    // We don't use the Esprima+Escodegen toolchain as those loose the code comments easily;
    // instead we just chop the code using labels as sentinels for our chopping-it-up regexes:
    // try {
    //     var ast = esprima.parse(parseFn);

    //     var labeled = JSONSelect.match(':has(:root > .label > .name:val("' +
    //         (!hasErrorRecovery ? '_handle_error_with_recovery' : '_handle_error_no_recovery') +
    //         '"))', ast);
    //     Jison.print('labeled: ', labeled);
    //     assert(labeled[0].body.type === 'IfStatement');
    //     labeled[0].body.type = 'DebuggerStatement';
    //     Jison.print('patched::labeled: ', labeled);

    //     return escodegen.generate(ast);
    // } catch (e) {
    //     return parseFn;
    // }
    parseFn = pickOneOfTwoCodeAlternatives(parseFn, hasErrorRecovery, '//_handle_error_with_recovery:', '//_handle_error_no_recovery:', '//_handle_error_end_of_section:');
    // and some post-coital touch-ups:
    if (!hasErrorRecovery) {
        // Also nuke the support declaration statement:
        //          var recovering = 0;
        // and the recovery support statements:
        //          if (recovering > 0) {
        //              recovering--;
        //          }
        // and these yydebug particles:
        //          , recovering: recovering
        parseFn = parseFn
        .replace(/^\s*var recovering.*$/gm, '')
        .replace(/, recovering: recovering/g, '')
        .replace(/[ \t]*if \(recovering[^\)]+\) \{[^\0]+?\}\n/g, '\n\n\n\n\n')
        // And nuke the preErrorSymbol code as it is unused when there's no error recovery
        //        if (!preErrorSymbol) {
        //            ... keep this chunk ...
        //        } else {
        //            ... KILL this chunk ...
        //        }
        .replace(/\s+if[^a-z]+preErrorSymbol.*?\{\s*\/\/[^\n]+([\s\S]+?)\} else \{[\s\S]+?\}\n\s+\}\n/g, '\n$1\n\n\n\n')
        .replace(/^\s+(?:var )?preErrorSymbol = .*$/gm, '')
        // And nuke the support declaration statement:
        //         var lastEofErrorStateDepth = 0;
        .replace(/^\s*var lastEofErrorStateDepth.*$/gm, '');
    }
    return parseFn;
}

// Generates the code of the parser module, which consists of two parts:
// - module.commonCode: initialization code that should be placed before the module
// - module.moduleCode: code that creates the module object
lrGeneratorMixin.generateModule_ = function generateModule_() {
    var parseFn = String(parser.parse);
    parseFn = pickErrorHandlingChunk(parseFn, this.hasErrorRecovery);

    parseFn = addOrRemoveTokenStack(parseFn, this.options.tokenStack);

    parseFn = removeUnusedKernelFeatures(parseFn, this);

    parseFn = expandParseArguments(parseFn, this);

    var errorClassCode = this.generateErrorClass();

    // set up the 'option' `exportAllTables` as a hash object for returning
    // all generated tables to the caller
    var exportDest = this.options.exportAllTables;
    if (!exportDest || typeof exportDest !== 'object') {
        exportDest = {
            enabled: !!exportDest
        };
    } else {
        exportDest.enabled = true;
    }

    // store the parse tables:
    exportDest.parseTable = this.table;
    exportDest.defaultParseActions = this.defaultActions;
    exportDest.parseProductions = this.productions_;

    var tableCode;
    switch (this.options.compressTables | 0) {
    case 0: // no compression
        tableCode = this.generateTableCode0(this.table, this.defaultActions, this.productions_);
        break;

    default:
    case 1: // default: vanilla JISON table compression = run-length encoding
        tableCode = this.generateTableCode1(this.table, this.defaultActions, this.productions_);
        break;

    case 2: // column-mode compression
        // this compression method corrupts the table when this option is turned on (and one or more conflicts occur)
        if (this.options.noDefaultResolve && this.conflicts > 0) {
            tableCode = this.generateTableCode1(this.table, this.defaultActions, this.productions_);
        } else {
            tableCode = this.generateTableCode2(this.table, this.defaultActions, this.productions_);
        }
        break;
    }

    // Generate the initialization code
    var initCode = this.moduleInit.slice(0);

    function popInitCodeSection(section) {
        var rv = [];
        for (var i = 0, len = initCode.length; i < len; i++) {
            var m = initCode[i];
            if (!m) continue;
            if (m.qualifier === section || !section) {
                rv.push(m.include);
                delete initCode[i];
            }
        }
        return rv;
    }

    var commonCode = [].concat(
        popInitCodeSection('required'),
        errorClassCode.commonCode,
        errorClassCode.moduleCode,
        popInitCodeSection(),
        tableCode.commonCode
    );



    // sort hash table by key to produce a nicer output:
    function produceSymbolTable(tbl) {
        var a = Object.keys(tbl);
        a.sort();
        var nt = {};
        var k;
        for (var i = 0, len = a.length; i < len; i++) {
            k = a[i];
            // `$eof` and `EOF` are synonyms of `$end` (`$eof` is for bison compatibility);
            // this is the only place where two symbol names may map to a single symbol ID number
            // and we do not want `$eof`/`EOF` to show up in the symbol tables of generated parsers
            // as we use `$end` for that one!
            if (k !== '$eof') {
                nt[k] = tbl[k];
            }
        }
        return nt;
    }

    // swap key and value and then sort hash table by key to produce a nicer output:
    function produceTerminalTable(tbl) {
        var a = Object.keys(tbl);
        var nt = {};
        var k, v;
        for (var i = 0, len = a.length; i < len; i++) {
            k = a[i];
            v = tbl[k];
            nt[v] = +k;  // convert numeric key back to number type; all terminals have numeric keys
        }
        return produceSymbolTable(nt);
    }

    function produceProductionsForDebugging(options, symbols, base) {
        function get_orig_symbol(s) {
            var a = s.split(':');
            if (a.length === 1 || a[0] === '') {
                return {
                    state: -1,
                    symbol: s
                };
            }
            var state = a[0];
            a.shift();
            return {
                state: +state,
                symbol: a.join(':'),
            };
        }
        function get_orig_symbol_set(arr) {
            var rv = {};
            for (var i = 0, len = arr.length; i < len; i++) {
                var item = arr[i];
                var symbol = get_orig_symbol(item);
                rv[symbol.symbol] = symbol.state;
            }
            return Object.keys(rv);
        }

        var tbl = this.nonterminals;
        var sym = this.symbols_ || symbols;

        if (!options.outputDebugTables && !options.exportAllTables) {
            return undefined;
        }

        var prods = {
            ids: {},
            states: {},
            rules: {},
            nonterminals: {},
            symbols: {},
            first: {},
            follows: {},
        };

        var self = this;
        this.productions.forEach(function Follow_prod_forEach_genDebugTable(production, k) {
            // self.trace('Symbol/Follows: ', 'prod:' + k, ':', production.symbol, ' :: ', production.handle.join(' '), '  --> ', nonterminals[production.symbol].follows.join(', '));
            var nonterm = production.symbol;
            prods.states[k] = nonterm;
            prods.ids[nonterm] = sym[nonterm];

            var lst = prods.rules[nonterm] || {};
            lst[k] = gen_lalr_states_production(production, k, false, k, true);
            prods.rules[nonterm] = lst;
        });

        function gen_nonterminal(nt) {
            var l = nt.productions._items;
            var lst = l.map(function (p, i) {
                return gen_lalr_states_production(p, i, false, false, false);
            });
            var rv = {
                symbol: nt.symbol,
                productions: lst,
                first: nt.first,
                base_first: get_orig_symbol_set(nt.first),
                follows: nt.follows,
                base_follows: get_orig_symbol_set(nt.follows),
                nullable: nt.nullable,
            };

            // clean up structure: ditch superfluous elements:
            if (rv.base_first.join(' ') === rv.first.join(' ')) {
                delete rv.base_first;
            }
            if (rv.base_follows.join(' ') === rv.follows.join(' ')) {
                delete rv.base_follows;
            }

            return rv;
        }

        for (var key in tbl) {
            prods.nonterminals[key] = gen_nonterminal(tbl[key]);
        }

        if (this.nterms_) {
            prods.nterms_ = this.nterms_;
        }

        function gen_lalr_states_production(production, index, dotPosition, state, patch_base) {
            var nonterm = production.symbol;
            var hlen = production.handle.length;
            var rulestr = production.handle.map(function (t, idx) {
                if (!t) {
                    t = '%epsilon';
                }
                // `$eof` and `EOF` are synonyms of `$end` ('$eof' is for bison compatibility);
                // this is the only place where two symbol names may map to a single symbol ID number
                // and we do not want `$eof`/`EOF` to show up in the symbol tables of generated parsers
                // as we use `$end` for that one!
                if (t === '$eof') {
                    t = '$end';
                }

                if (dotPosition === idx) {
                    t = '⬤' + t;
                }
                return t;
            }).join(' ');
            if (dotPosition === hlen) {
                rulestr += ' ⬤';
            }

            var base_rulestr = production.handle.map(function (t) {
                if (!t) {
                    t = '%epsilon';
                }
                t = get_orig_symbol(t).symbol;
                // `$eof` and `EOF` are synonyms of `$end` ('$eof' is for bison compatibility);
                // this is the only place where two symbol names may map to a single symbol ID number
                // and we do not want `$eof`/`EOF` to show up in the symbol tables of generated parsers
                // as we use `$end` for that one!
                if (t === '$eof') {
                    t = '$end';
                }
                return t;
            }).join(' ');

            var rv = {
                symbol: nonterm,
                base_symbol: get_orig_symbol(nonterm).symbol,
                handle: rulestr,
                base_handle: base_rulestr,
                nullable: production.nullable,
                id: production.id,
                index: index,
                state: (state !== false ? state : -1),
                base_state: -1,
                first: production.first,
                base_first: get_orig_symbol_set(production.first),
                follows: production.follows,
                base_follows: get_orig_symbol_set(production.follows),
                precedence: production.precedence,
                reachable: production.reachable
            };

            // Determine state for given production, if it's not a production that's listed as part of a state:
            var chk, idx;
            var lst = prods.rules[nonterm];
            chk = rv.symbol + ' : ' + rv.handle;
            for (idx in lst) {
                idx = +idx;
                var p = lst[idx];
                if (p) {
                    if (p.symbol + ' : ' + p.handle === chk) {
                        assert(rv.state === -1);
                        rv.state = idx;
                        break;
                    }
                }
            }

            // Try to reference base productions from newg child productions and vice versa:
            chk = rv.base_symbol + ' : ' + rv.base_handle;
            if (base && base.rules) {
                var pr = base.rules[rv.base_symbol];
                for (idx in pr) {
                    var bprod = pr[idx];
                    if (bprod.symbol + ' : ' + bprod.handle === chk) {
                        assert(rv.base_state === -1);
                        rv.base_state = bprod.state;
                        if (patch_base) {
                            bprod.newg_states = (bprod.newg_states || []);
                            bprod.newg_states.push(rv.index);
                        }
                        break;
                    }
                }
            }

            // clean up structure: ditch superfluous elements:
            if (rv.base_symbol === rv.symbol) {
                delete rv.base_symbol;
            }
            if (rv.base_handle === rv.handle) {
                delete rv.base_handle;
            }
            if (rv.base_first.join(' ') === rv.first.join(' ')) {
                delete rv.base_first;
            }
            if (rv.base_follows.join(' ') === rv.follows.join(' ')) {
                delete rv.base_follows;
            }
            if (rv.base_state === -1) {
                delete rv.base_state;
            }
            return rv;
        }

        if (this.states) {
            prods.lalr_states = [];
            this.states.forEach(function traverse_states(state, i) {
                //assert(state.inadequate ? this.inadequate : true);
                state.forEach(function traverse_state(item, j) {
                    // is this a REDUCE state?
                    var nterm_first = self.nonterminals[item.production.symbol].first;
                    var rv = {
                        state: i,
                        item_index: j,
                        is_reduce_state: (item.dotPosition === item.production.handle.length),
                        dot_position: item.dotPosition,
                        state_inadequate: state.inadequate ? true : undefined,
                        item_inadequate: item.inadequate ? true : undefined,
                        production: gen_lalr_states_production(item.production, j, item.dotPosition, i, true),
                        follows: item.follows,
                        base_follows: get_orig_symbol_set(item.follows),
                        nterm_first: nterm_first,
                        base_nterm_first: get_orig_symbol_set(nterm_first),
                        prod_first: item.production.first,
                        base_prod_first: get_orig_symbol_set(item.production.first),
                    };

                    // clean up structure: ditch superfluous elements:
                    if (rv.base_follows.join(' ') === rv.follows.join(' ')) {
                        delete rv.base_follows;
                    }
                    if (rv.base_nterm_first.join(' ') === rv.nterm_first.join(' ')) {
                        delete rv.base_nterm_first;
                    }
                    if (rv.base_prod_first.join(' ') === rv.prod_first.join(' ')) {
                        delete rv.base_prod_first;
                    }

                    prods.lalr_states.push(rv);
                });
            });
        }

        var nt = tbl;
        var sbn;
        for (sbn in nt) {
            var orig_symbol = get_orig_symbol(sbn);
            var item = nt[sbn];
            var firsts = item.first;
            var follows = item.follows;
            if (!prods.symbols[orig_symbol.symbol]) {
                prods.symbols[orig_symbol.symbol] = orig_symbol.state;
            }
            if (!prods.first[orig_symbol.symbol]) {
                prods.first[orig_symbol.symbol] = firsts;
            } else {
                prods.first[orig_symbol.symbol] = prods.first[orig_symbol.symbol].concat(firsts);
            }
            if (!prods.follows[orig_symbol.symbol]) {
                prods.follows[orig_symbol.symbol] = follows;
            } else {
                prods.follows[orig_symbol.symbol] = prods.follows[orig_symbol.symbol].concat(follows);
            }
        }
        for (sbn in prods.first) {
            prods.first[sbn] = get_orig_symbol_set(prods.first[sbn]);
        }
        for (sbn in prods.follows) {
            prods.follows[sbn] = get_orig_symbol_set(prods.follows[sbn]);
        }

        if (this.newg) {
            prods.newg = produceProductionsForDebugging.call(this.newg, options, sym, prods);
        }
        return prods;
    }

    function produceTerminalDescriptions(tbl, sym) {
        var rv = {};
        var count = 0;
        for (var k in tbl) {
            var descr = tbl[k];
            var id = sym[k];
            if (id && descr && descr !== id) {
                rv[id] = descr;
                count++;
            }
        }
        return (count ? rv : undefined);
    }

    function produceOptions(opts) {
        var obj = {};
        var do_not_pass = {
          type: 0,                   // CLI: --parserType option
          debug: !opts.debug,     // do not include this item when it is FALSE as there's no debug tracing built into the generated grammar anyway!
          enableDebugLogs: 1,
          numExpectedConflictStates: 1,
          json: 1,
          _: 1,
          noMain: 1,
          noDefaultResolve: 1,
          noDefaultAction: 1,
          noTryCatch: 1,
          hasPartialLrUpgradeOnConflict: 0,
          compressTables: 1,
          outputDebugTables: 1,
          reportStats: 1,
          file: 1,
          outfile: 1,
          inputPath: 1,
          inputFilename: 1,
          lexfile: 1,
          defaultModuleName: 1,
          moduleName: 1,
          moduleType: 1,
          exportAllTables: 1,
          tokenStack: 1,
          lexer_errors_are_recoverable: 1,
          showSource: 1,

          errorRecoveryTokenDiscardCount: 0,

          warn_cb: 0,  // function(msg) | true (= use Jison.Print) | false (= throw Exception)

          parseParams: 1,
          ranges: 0,
        };
        for (var k in opts) {
            if (!do_not_pass[k] && opts[k] != null && opts[k] !== false) {
                // make sure numeric values are encoded as numeric, the rest as boolean/string.
                if (typeof opts[k] === 'string') {
                    var f = parseFloat(opts[k]);
                    if (f == opts[k]) {
                        obj[k] = f;
                        continue;
                    }
                }
                obj[k] = opts[k];
            }
        }

        // And now some options which should receive some special processing:
        if (!obj.hasPartialLrUpgradeOnConflict) {
          // only list this option when it's actually TRUE:
          delete obj.hasPartialLrUpgradeOnConflict;
        }

        var pre = obj.pre_parse;
        var post = obj.post_parse;
        // since JSON cannot encode functions, we'll have to do it manually at run-time, i.e. later on:
        obj.pre_parse = (pre ? true : undefined);
        obj.post_parse = (post ? true : undefined);

        var js = JSON.stringify(obj, null, 2);

        js = js.replace(new XRegExp('  "([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)": ', 'g'), '  $1: ');
        js = js.replace(/^( +)pre_parse: true,$/gm, '$1pre_parse: ' + String(pre) + ',');
        js = js.replace(/^( +)post_parse: true,$/gm, '$1post_parse: ' + String(post) + ',');
        return js;
    }


    // Generate the module creation code
    var termDescrs = produceTerminalDescriptions(this.descriptions_, this.symbols_);
    exportDest.terminalDescriptions = termDescrs;
    var descrLst = JSON.stringify(termDescrs, null, 2);
    if (descrLst) {
        descrLst = descrLst.replace(/"([0-9]+)":/g, '$1:');
    }

    var rules4Dbg = produceProductionsForDebugging.call(this, this.options);
    exportDest.parseRules = rules4Dbg;
    var rulesLst = (this.options.outputDebugTables ? JSON.stringify(rules4Dbg, null, 2) : undefined);
    if (rulesLst) {
        rulesLst = rulesLst.replace(/"([0-9]+)":/g, '$1:').replace(/^(\s+)"([a-z_][a-z_0-9]*)":/gmi, '$1$2:');
    }

    var symbolTable = produceSymbolTable(this.symbols_);
    exportDest.symbolTable = symbolTable;

    // produce a hash lookup table from the terminal set
    exportDest.terminalTable = produceTerminalTable(this.terminals_);

    if (this.options.exportAllTables) {
        this.options.exportAllTables = exportDest;
    }

    var moduleCode = `{
    // Code Generator Information Report
    // ---------------------------------
    //
    // Options:
    //
    //   no default action: ............... ${this.options.noDefaultAction}
    //   no try..catch: ................... ${this.options.noTryCatch}
    //   no default resolve on conflict:    ${this.options.noDefaultResolve}
    //   on-demand look-ahead: ............ ${this.onDemandLookahead}
    //   error recovery token skip maximum: ${this.options.errorRecoveryTokenDiscardCount}
    //   debug grammar/output: ............ ${this.options.debug}
    //   has partial LR conflict upgrade:   ${this.options.hasPartialLrUpgradeOnConflict}
    //   rudimentary token-stack support:   ${this.options.tokenStack}
    //   parser table compression mode: ... ${this.options.compressTables}
    //   export debug tables: ............. ${this.options.outputDebugTables}
    //   export *all* tables: ............. ${this.options.exportAllTables}
    //   module type: ..................... ${this.options.moduleType}
    //   parser engine type: .............. ${this.options.type}
    //   output main() in the module: ..... ${this.options.noMain}
    //   number of expected conflicts: .... ${this.options.numExpectedConflictStates}
    //
    //
    // Parser Analysis flags:
    //
    //   all actions are default: ......... ${this.actionsAreAllDefault}
    //   uses yyleng: ..................... ${this.actionsUseYYLENG}
    //   uses yylineno: ................... ${this.actionsUseYYLINENO}
    //   uses yytext: ..................... ${this.actionsUseYYTEXT}
    //   uses yylloc: ..................... ${this.actionsUseYYLOC}
    //   uses ParseError API: ............. ${this.actionsUseParseError}
    //   uses YYERROR: .................... ${this.actionsUseYYERROR}
    //   uses YYRECOVERING: ............... ${this.actionsUseYYRECOVERING}
    //   uses YYERROK: .................... ${this.actionsUseYYERROK}
    //   uses YYCLEARIN: .................. ${this.actionsUseYYCLEARIN}
    //   tracks rule values: .............. ${this.actionsUseValueTracking}
    //   assigns rule values: ............. ${this.actionsUseValueAssignment}
    //   uses location tracking: .......... ${this.actionsUseLocationTracking}
    //   assigns location: ................ ${this.actionsUseLocationAssignment}
    //   uses yystack: .................... ${this.actionsUseYYSTACK}
    //   uses yysstack: ................... ${this.actionsUseYYSSTACK}
    //   uses yysp: ....................... ${this.actionsUseYYSTACKPOINTER}
    //   has error recovery: .............. ${this.hasErrorRecovery}
    //
    // --------- END OF REPORT -----------

`;
    moduleCode += [
        'trace: ' + String(this.trace || parser.trace),
        'JisonParserError: JisonParserError',
        'yy: {}',
        'options: ' + produceOptions(this.options),
        'symbols_: ' + JSON.stringify(symbolTable, null, 2),
        'terminals_: ' + JSON.stringify(this.terminals_, null, 2).replace(/"([0-9]+)":/g, '$1:'),
    ].concat(
        rulesLst ?
        'nonterminals_: ' + rulesLst :
        []
    ).concat(
        descrLst ?
        'terminal_descriptions_: ' + descrLst :
        []
    ).concat([
        String(define_parser_APIs_1)
            .replace(/^[\s\S]+?return \{/, '')
            .replace(/\};[s\r\n]+\}\s*$/, '')
            .replace(/^        /mg, '')
            .trim(),
        'productions_: ' + tableCode.productionsCode
    ]).concat(
        String(this.performAction).trim() !== '' ?
        'performAction: ' + String(this.performAction) :
        []
    ).concat([
        'table: ' + tableCode.tableCode,
        'defaultActions: ' + tableCode.defaultActionsCode,
        'parseError: ' + String(this.parseError || parser.parseError),
        'parse: ' + parseFn
    ]).concat(
        this.actionsUseYYERROR ?
        'yyError: 1' :
        []
    ).concat(
        this.actionsUseYYRECOVERING ?
        'yyRecovering: 1' :
        []
    ).concat(
        this.actionsUseYYERROK ?
        'yyErrOk: 1' :
        []
    ).concat(
        this.actionsUseYYCLEARIN ?
        'yyClearIn: 1' :
        []
    ).join(',\n');
    moduleCode += '\n};';

    return {
        commonCode: commonCode.join('\n'),
        moduleCode: moduleCode,
        modulePostlude: [
            'parser.originalParseError = parser.parseError;',
            'parser.originalQuoteName = parser.quoteName;',
            ].join('\n')
    };
};

lrGeneratorMixin.generateErrorClass = function () {
    // See also:
    // http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
    // but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
    // with userland code which might access the derived class in a 'classic' way.
    function JisonParserError(msg, hash) {
        Object.defineProperty(this, 'name', {
            enumerable: false,
            writable: false,
            value: 'JisonParserError'
        });

        if (msg == null) msg = '???';

        Object.defineProperty(this, 'message', {
            enumerable: false,
            writable: true,
            value: msg
        });

        this.hash = hash;

        var stacktrace;
        if (hash && hash.exception instanceof Error) {
            var ex2 = hash.exception;
            this.message = ex2.message || msg;
            stacktrace = ex2.stack;
        }
        if (!stacktrace) {
            if (Error.hasOwnProperty('captureStackTrace')) { // V8
                Error.captureStackTrace(this, this.constructor);
            } else {
                stacktrace = (new Error(msg)).stack;
            }
        }
        if (stacktrace) {
            Object.defineProperty(this, 'stack', {
                enumerable: false,
                writable: false,
                value: stacktrace
            });
        }
    }

    // wrap this init code in a function so we can String(function)-dump it into the generated
    // output: that way we only have to write this code *once*!
    function __extra_code__() {
        if (typeof Object.setPrototypeOf === 'function') {
            Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
        } else {
            JisonParserError.prototype = Object.create(Error.prototype);
        }
        JisonParserError.prototype.constructor = JisonParserError;
        JisonParserError.prototype.name = 'JisonParserError';
    }
    __extra_code__();

    var prelude = [
        '// See also:',
        '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508',
        '// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility',
        '// with userland code which might access the derived class in a \'classic\' way.',
        printFunctionSourceCode(JisonParserError),
        printFunctionSourceCodeContainer(__extra_code__),
        '',
    ];

    return {
        commonCode: '',
        moduleCode: prelude.join('\n')
    };
};

// Generate code that represents the specified parser table
lrGeneratorMixin.generateTableCode0 = function (table, defaultActions, productions) {
    var tableCode = JSON.stringify(table, null, 2);
    var defaultActionsCode = JSON.stringify(defaultActions, null, 2).replace(/"([0-9]+)":/g, '$1:');
    var productionsCode = JSON.stringify(productions, null, 2);

    // Don't surround numerical property name numbers in quotes
    tableCode = tableCode.replace(/"([0-9]+)"(?=:)/g, '$1');

    var prelude = [];

    // Return the variable initialization code and the table code
    return {
        commonCode: prelude.join('\n'),
        tableCode: tableCode,
        defaultActionsCode: defaultActionsCode,
        productionsCode: productionsCode
    };
};

// Generate code that represents the specified parser table
lrGeneratorMixin.generateTableCode1 = function (table, defaultActions, productions) {
    var tableCode = JSON.stringify(table, null, 2);
    var defaultActionsCode = JSON.stringify(defaultActions, null, 2).replace(/"([0-9]+)":/g, '$1:');
    var productionsCode = JSON.stringify(productions, null, 2);
    var usesCompressor = false;

    // Don't surround numerical property name numbers in quotes
    tableCode = tableCode.replace(/"([0-9]+)"(?=:)/g, '$1');

    // Replace objects with several identical values by function calls
    // e.g., { 1: [6, 7]; 3: [6, 7], 4: [6, 7], 5: 8 } = x([1, 3, 4], [6, 7], { 5: 8 })
    tableCode = tableCode.replace(/\{[\s\r\n]*\d+:[^\}]+,[\s\r\n]*\d+:[^\}]+\}/g, function (object) {
        // Find the value that occurs with the highest number of keys
        var value, frequentValue, key,
            keys = {},
            keyCount,
            maxKeyCount = 0,
            keyValue,
            keyValues = [],
            keyValueMatcher = /(\d+):[\s\r\n]*([^:\}]+)(?=,[\s\r\n]*\d+:|\})/g;

        while ((keyValue = keyValueMatcher.exec(object))) {
            // For each value, store the keys where that value occurs
            key = keyValue[1];
            value = keyValue[2].trim();
            keyCount = 1;

            if (!(value in keys)) {
                keys[value] = [key];
            } else {
                keyCount = keys[value].push(key);
            }
            // Remember this value if it is the most frequent one
            if (keyCount > maxKeyCount) {
                maxKeyCount = keyCount;
                frequentValue = value;
            }
        }
        // Construct the object with a function call if the most frequent value occurs multiple times
        if (maxKeyCount > 1) {
            // Collect all non-frequent values into a remainder object
            for (value in keys) {
                if (value !== frequentValue) {
                    for (var k = keys[value], i = 0, l = k.length; i < l; i++) {
                        keyValues.push(k[i] + ':' + value);
                    }
                }
            }
            keyValues = keyValues.length ? ', {' + keyValues.join(',') + '}' : '';
            // Create the function call `x(keys, value, remainder)`
            object = 'x([' + keys[frequentValue].join(',') + '], ' + frequentValue + keyValues + ')';
            usesCompressor = true;
        }
        return object;
    });

    // Count occurrences of number lists
    var list;
    var lists = {};
    var listMatcher = /\[[0-9,]+\]/g;
    var frequentLists = [];

    while ((list = listMatcher.exec(tableCode))) {
        lists[list] = (lists[list] || 0) + 1;
    }

    // Replace frequently occurring number lists with variables
    tableCode = tableCode.replace(listMatcher, function (list) {
        var listId = lists[list];
        // If listId is a number, it represents the list's occurrence frequency
        if (typeof listId === 'number') {
            // If the list does not occur frequently, represent it by the list
            if (listId === 1) {
                lists[list] = listId = list;
            // If the list occurs frequently, represent it by a newly assigned variable
            } else {
                lists[list] = listId = 'u[' + frequentLists.length + ']';
                frequentLists.push(list);
            }
        }
        return listId;
    });

    var prelude = [];

    // Only include the expender function when it's actually used
    // (tiny grammars don't have much state duplication, so this shaves off
    // another couple bytes off the generated output)
    if (usesCompressor) {
        prelude.push(createObjectCode.toString().replace('createObjectCode', 'x'));
        prelude.push('');
    }

    if (frequentLists.length > 0) {
        prelude.push('var u = [\n    ' + frequentLists.join(',\n    ') + '\n];');
        prelude.push('');
    }

    // Return the variable initialization code and the table code
    return {
        commonCode: prelude.join('\n'),
        tableCode: tableCode,
        defaultActionsCode: defaultActionsCode,
        productionsCode: productionsCode
    };
};

// Function that extends an object with the given value for all given keys
// e.g., x([1, 3, 4], [6, 7], { x: 1, y: 2 }) = { 1: [6, 7]; 3: [6, 7], 4: [6, 7], x: 1, y: 2 }
function createObjectCode(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

// Generate code that represents the specified parser table
lrGeneratorMixin.generateTableCode2 = function (table, defaultActions, productions) {
    assert(!(this.options.noDefaultResolve && this.conflicts > 0));           // this compression method corrupts the table when this option is turned on (and one or more conflicts occur)

    var tableCode = JSON.stringify(table, null, 2);
    var defaultActionsCode = JSON.stringify(defaultActions, null, 2).replace(/"([0-9]+)":/g, '$1:');
    var productionsCode = JSON.stringify(productions, null, 2);

    // We know a couple of things about the parse table:
    //
    // - The first level is an array with continuous indexes
    // - Each entry of the array is an object which contains a series of numeric states as a hash table
    // - Each 'hash table' entry is either a state number or a 2-element array
    //
    // So we can start by encoding the table 'vertically', i.e. by column rather than by row,
    // and then provide a bit of code to transform that series of arrays to the real parse table
    // at run time.
    // We can encode the columns by encoding the array-or-number aspect as a separate column,
    // while encoding the size of each hash table in yet another column: number of entries per state.
    // Then thanks to that length info, plus the 'is this hash-table entry going to be a number or an array' flag column,
    // we can transform those back to what we need at run-time.
    //
    // Meanwhile, we can inspect each of the columns and see if we can compress them.
    //
    // Of course the flags array is compressible as it's only 1 bit per entry, but there's sure to
    // be more compression goodies to be had in there, such as run-length encoding and maybe
    // delta-encoding of the hashtable indexes themselves.
    //
    //

    // Don't surround numerical property name numbers in quotes
    tableCode = tableCode.replace(/"([0-9]+)"(?=:)/g, '$1');




    function reportColumnsForCompression(def_arr) {
        var i, key, len;
        var report = [];

        len = 0;
        for (key in def_arr) {
            len = Math.max(len, def_arr[key].length);
        }

        var col_width = 6;
        var col_delta_width = 4;

        function clip(val, width) {
            var s = '        ' + val;
            s = s.substr(s.length - width);
            return s;
        }

        var track_prev4delta = {};
        var c, delta, val, delta_val;
        var line = [];
        line.push('║');
        for (c in def_arr) {
            key = clip(c, col_width);
            delta = clip('∆', col_delta_width);
            line.push(key);
            line.push('┊');
            line.push(delta);
            line.push('║');

            track_prev4delta[c] = 10000000;
        }
        report.push(line.join(''));

        for (i = 0; i < len; i++) {
            line = [];
            line.push('║');

            for (c in def_arr) {
                var tbl = def_arr[c];
                if (tbl.length > i) {
                    val = tbl[i] || 0;

                    delta_val = val - track_prev4delta[c];
                    // negative deltas are jumps: don't treat those as delta but as absolute value, sign-flipped:
                    if (delta_val < 0) {
                        delta_val = -val - 1;  // so that absolute 0 becomes -1, so it can be recognized from delta=0 ('no change')
                    }
                    track_prev4delta[c] = val;
                } else {
                    val = '.';
                    delta_val = '.';
                    delta_val2 = '.';
                }

                key = clip(val, col_width);
                delta = clip(delta_val, col_delta_width);
                line.push(key);
                line.push('┊');
                line.push(delta);
                line.push('║');
            }
            report.push(line.join(''));
        }

        return '\n\n\n// ------------------------------\n\n\n// ' + report.join('\n// ') + '\n\n\n// ------------------\n\n\n';
    }


    // table is array of 1/2-len arrays:
    function analyzeTableForCompression(table) {
        // column: productions' row length
        var len_col = [];
        // column: productions' shift size / action column
        var pop_col = [];
        // column: rule number for each slot ('rule'):
        var rule_col = [];

        var i;
        var row_count = table.length;
        for (i = 0; i < row_count; i++) {
            var prod = table[i];

            len_col.push(prod.length);
            assert(prod.length <= 2);
            assert(prod.length > 0);
            // and the special knowledge about the productions[] table:
            assert(prod.length === 2);
            pop_col.push(prod[0]);
            rule_col.push(prod[1]);
        }

        var def_arr = {
            'len': len_col,
            'pop': pop_col,
            'rule': rule_col,
        };
        return def_arr;
    }




    // table is hash of 1/2-len arrays:
    function analyzeSetForCompression(table) {
        // column: row index
        var idx_col = [];
        // column: productions' row length
        var len_col = [];
        // column: REDUCE productions' goto column
        var goto_col = [];

        var i;
        var row_count = 0;
        for (i in table) {
            i = +i;
            var prod = table[i];
            row_count++;
            idx_col.push(i);

            // and the special knowledge about the defaultActions[] table:
            assert(typeof prod === 'number');
            goto_col.push(prod);
        }

        var def_arr = {
            'idx': idx_col,
            'goto': goto_col,
        };
        return def_arr;
    }



    function analyzeGotoTableForCompression(table) {
        // column: number of symbol hash entries per state slot ('length'):
        var len_col = [];
        // column: symbol hash entry key for each slot ('symbol'):
        var symbol_col = [];
        // column: symbol hash entry value type: number (0) or array (array.length) ('type'):
        var type_col = [];
        // column: symbol hash entry value if single GOTO state number ('state'):
        var state_col = [];
        // column: symbol hash entry mode value if array slot type (reduce/shift/accept):
        var mode_col = [];
        // column: symbol hash entry goto state value if array slot type:
        var goto_col = [];
        // // column: merged: state_col + goto_col:
        // var next_col = [];

        var row_count = table.length;
        for (var state = 0; state < row_count; state++) {
            var hashtable = table[state];
            var count = 0;
            var symbol;
            for (symbol in hashtable) {
                symbol = +symbol;
                symbol_col.push(symbol);

                var slot = hashtable[symbol];
                if (slot && slot.length) {
                    // array type slot:
                    assert(slot.length === 2 || slot.length === 1);
                    assert(slot.length === 1 ? slot[0] === 3 /* $accept */ : true);
                    type_col.push(slot.length);
                    if (slot.length > 1) {
                        mode_col.push(slot[0]);
                        goto_col.push(slot[1]);
                        //next_col.push(slot[1]);
                    }
                } else if (slot) {
                    // number type slot:
                    type_col.push(0);
                    state_col.push(slot);
                    //next_col.push(slot);
                } else {
                    assert(0);
                    type_col.push(666);
                    state_col.push((typeof slot) + state + '/' + symbol);
                    //next_col.push((typeof slot) + state + '/' + symbol);
                }
                count++;
            }
            len_col.push(count);
        }

        var def_arr = {
            'len': len_col,
            'symbol': symbol_col,
            'type': type_col,
            'state': state_col,
            'mode': mode_col,
            'goto': goto_col,
            //'next': next_col,
        };
        return def_arr;
    }


    var has_compressed_a_table = false;


    function generateColumn(name, col) {
        var rv = [];
        var i, j, len, l;

        for (i = 0, len = col.length; i < len; i++) {
            // try basic run-length encoding first:
            var v = col[i];

            for (j = i + 1; j < len; j++) {
                if (col[j] !== v) {
                    break;
                }
            }
            var runlength = j - i;

            // try stepped run-length encoding next:
            var delta = col[i + 1] - v;
            var steplength = 0;

            // we don't want to replicate the runlength result, so only look for a match
            // when delta !== 0:
            if (delta !== 0) {
                for (j = i + 2; j < len; j++) {
                    if (col[j] - col[j - 1] !== delta) {
                        break;
                    }
                }
                steplength = j - i;
            }

            // try to match the pattern in history:
            var best_pos = 0;
            var best_len = 0;
            var upper_bound = i - 2;
            for (j = 0; j < upper_bound; j++) {
                for (l = 0; col[j + l] === col[i + l]; l++) {
                    // No need to check for:
                    //    if (j + l === i) break;
                    // because we know how the c() helper function will regenerate
                    // this pattern: it is perfectly fine to overlap on itself: we always
                    // have an offset of relative -1 or more, so we can encode runlength
                    // patterns as duplicates this way too:
                    //   [4, c(0, 7)]   (note the written offset is 0!)
                    // will output an sequence of 7+1 '4' values: one '4' and then 7 more.
                    //
                    // Encoding such a pattern as direct runlength `s(4, 8)` is cheaper
                    // though. Hence we loop until `i - 2`: we want to find ABABABAB...
                    // patterns, but no AAAAAA... patterns here.
                }

                // We want the nearest offset for the longest pattern:
                if (l >= best_len) {
                    best_len = l;
                    best_pos = i - j;
                }
            }

            // weight our options now:
            var gain = [
                runlength - 2,
                steplength - 3,
                best_len - 2
            ];
            var optimum_gain = Math.max.apply(null, gain);
            if (optimum_gain <= 0) {
                rv.push(v);
            }
            else if (optimum_gain === gain[0]) {
                rv.push('s', '[' + v + ', ' + runlength + ']');
                i += runlength - 1;
            }
            else if (optimum_gain === gain[1]) {
                rv.push('s', '[' + v + ', ' + steplength + ', ' + delta + ']');
                i += steplength - 1;
            }
            else if (optimum_gain === gain[2]) {
                rv.push('c', '[' + best_pos + ', ' + best_len + ']');
                i += best_len - 1;
            }
            else {
                rv.push(v);
                //assert(0);      // should never get here!
            }

            if (optimum_gain > 0) {
                has_compressed_a_table = true;
            }
        }

        var code = [
            '  ', name, ': ',
            'u([',
            '\n  ',
                rv.join(',\n  '),                // JSON.stringify(col, null, 2),
            '\n',
            '])'
        ].join('');
        return code;
    }


    function generateCompressedTable(def_arr) {
        var code = [
            'bp({',
            generateColumn('pop', def_arr.pop) + ',',
            generateColumn('rule', def_arr.rule),
            '})'
        ].join('\n');
        return code;
    }


    function generateCompressedSet(def_arr) {
        var code = [
            'bda({',
            generateColumn('idx', def_arr.idx) + ',',
            generateColumn('goto', def_arr.goto),
            '})'
        ].join('\n');
        return code;
    }


    function generateCompressedGotoTable(def_arr) {
        var code = [
            'bt({',
            generateColumn('len', def_arr.len) + ',',
            generateColumn('symbol', def_arr.symbol) + ',',
            generateColumn('type', def_arr.type) + ',',
            generateColumn('state', def_arr.state) + ',',
            generateColumn('mode', def_arr.mode) + ',',
            generateColumn('goto', def_arr.goto),
            '})'
        ].join('\n');
        return code;
    }


    var tableDef = analyzeGotoTableForCompression(table);
    var defaultActionsDef = analyzeSetForCompression(defaultActions);
    var productionsDef = analyzeTableForCompression(productions);


    function bp_code_container() {
        // helper: reconstruct the productions[] table
        function bp(s) {
            var rv = [];
            var p = s.pop;
            var r = s.rule;
            for (var i = 0, l = p.length; i < l; i++) {
                rv.push([
                    p[i],
                    r[i]
                ]);
            }
            return rv;
        }
    }

    function bda_code_container() {
        // helper: reconstruct the defaultActions[] table
        function bda(s) {
            var rv = {};
            var d = s.idx;
            var g = s.goto;
            for (var i = 0, l = d.length; i < l; i++) {
                var j = d[i];
                rv[j] = g[i];
            }
            return rv;
        }
    }

    function bt_code_container() {
        // helper: reconstruct the 'goto' table
        function bt(s) {
            var rv = [];
            var d = s.len;
            var y = s.symbol;
            var t = s.type;
            var a = s.state;
            var m = s.mode;
            var g = s.goto;
            for (var i = 0, l = d.length; i < l; i++) {
                var n = d[i];
                var q = {};
                for (var j = 0; j < n; j++) {
                    var z = y.shift();
                    switch (t.shift()) {
                    case 2:
                        q[z] = [
                            m.shift(),
                            g.shift()
                        ];
                        break;

                    case 0:
                        q[z] = a.shift();
                        break;

                    default:
                        // type === 1: accept
                        q[z] = [
                            3
                        ];
                    }
                }
                rv.push(q);
            }
            return rv;
        }
    }

    function c_s_u_code_container() {
        // helper: runlength encoding with increment step: code, length: step (default step = 0)
        // `this` references an array
        function s(c, l, a) {
            a = a || 0;
            for (var i = 0; i < l; i++) {
                this.push(c);
                c += a;
            }
        }

        // helper: duplicate sequence from *relative* offset and length.
        // `this` references an array
        function c(i, l) {
            i = this.length - i;
            for (l += i; i < l; i++) {
                this.push(this[i]);
            }
        }

        // helper: unpack an array using helpers and data, all passed in an array argument 'a'.
        function u(a) {
            var rv = [];
            for (var i = 0, l = a.length; i < l; i++) {
                var e = a[i];
                // Is this entry a helper function?
                if (typeof e === 'function') {
                    i++;
                    e.apply(rv, a[i]);
                } else {
                    rv.push(e);
                }
            }
            return rv;
        }
    }

    has_compressed_a_table = false;
    var tc = generateCompressedGotoTable(tableDef);
    var compressGotoTable = has_compressed_a_table;

    has_compressed_a_table = false;
    var dac = generateCompressedSet(defaultActionsDef);
    var compressDefaultActions = has_compressed_a_table;

    has_compressed_a_table = false;
    var pc = generateCompressedTable(productionsDef);
    var compressProductions = has_compressed_a_table;

    var compressAnything = (compressProductions || compressDefaultActions || compressGotoTable);

    tableCode = ((this.DEBUG || devDebug) ? reportColumnsForCompression(tableDef) : '') + (compressGotoTable ? tc : tableCode);
    defaultActionsCode = ((this.DEBUG || devDebug) ? reportColumnsForCompression(defaultActionsDef) : '') + (compressDefaultActions ? dac : defaultActionsCode);
    productionsCode = ((this.DEBUG || devDebug) ? reportColumnsForCompression(productionsDef) : '') + (compressProductions ? pc : productionsCode);


    var prelude = [
        '',
        compressProductions ? printFunctionSourceCodeContainer(bp_code_container) : '',
        '',
        compressDefaultActions ? printFunctionSourceCodeContainer(bda_code_container) : '',
        '',
        compressGotoTable ? printFunctionSourceCodeContainer(bt_code_container) : '',
        '',
        printFunctionSourceCodeContainer(c_s_u_code_container),
    ];
    if (!compressAnything) {
        prelude = [];
    }

    // Return the variable initialization code and the table code
    return {
        commonCode: prelude.join('\n'),
        tableCode: tableCode,
        defaultActionsCode: defaultActionsCode,
        productionsCode: productionsCode
    };
};

// default main method for generated commonjs modules
function commonjsMain(args) {
    // When the parser comes with its own `main` function, then use that one:
    if (typeof exports.parser.main === 'function') {
      return exports.parser.main(args);
    }

    var fs = require('fs');
    var path = require('path');

    if (!args[1]) {
        console.log('Usage: ' + path.basename(args[0]) + ' FILE');
        process.exit(1);
    }
    var source = fs.readFileSync(path.normalize(args[1]), 'utf8');
    var dst = exports.parser.parse(source);
    console.log('parser output: ', {
        type: typeof dst,
        value: dst
    });
    var rv = 0;
    if (typeof dst === 'number' || typeof dst === 'boolean') {
        rv = dst;
    }
    return dst;
}

// debug mixin for LR parser generators

function printAction(a, gen) {
    var s = a[0] === SHIFT ? 'shift token (then go to state ' + a[1] + ')' :
        a[0] === REDUCE ? 'reduce by rule: ' + gen.productions[a[1]] :
        a[0] === ACCEPT ? 'accept' : 'UNDEFINED ACTION: ' + a[0];

    return s;
}

function traceStates(trace, states, title) {
    trace('Item sets -- ' + title + '\n------');

    states.forEach(function (state, i) {
        trace('\nitem set', i, '\n' + state.join('\n'), '\ntransitions -> ', JSON.stringify(state.edges));
    });
    trace('\n');
}

var lrGeneratorDebug = {
    beforeparseTable: function () {
        this.trace('Building parse table.');
    },
    afterparseTable: function () {
        var trace = this.trace;
        var self = this;
        if (this.conflicts > 0) {
            trace('\nConflicts:\n');
            this.resolutions.forEach(function (r, i) {
                if (r[2].bydefault) {
                    trace('Conflict at state: ', r[0], ', token: ', r[1], '\n  ', printAction(r[2].r, self), '\n  ', printAction(r[2].s, self));
                }
            });
            trace('\n' + this.conflicts + ' Conflict(s) found in grammar.');
        }
        trace('Done.\n');
    },
    aftercanonicalCollection: function (states /* as produced by `this.canonicalCollection()` */ ) {
        traceStates(this.trace, states, 'as produced by LR::canonicalCollection()');
    }
};

var parser = typal.beget();

generatorMixin.createParser = function createParser() {
    var sourcecode = this.generateModuleExpr();
    //console.warn('generated code:\n', sourcecode);
    var p;
    try {
        p = eval(sourcecode);
    } catch (ex) {
        console.error("generated source code fatal error: ", ex.message);
        try {
            var fs = require('fs');
            var path = require('path');
            var dumpPath = (this.options.outfile ? path.dirname(this.options.outfile) : null) || this.options.inputPath || process.cwd();
            var dumpName = this.options.inputFilename || this.options.moduleName || this.options.defaultModuleName;
            var ts = new Date();
            function pad(n, p) {
                p = p || 2;
                var rv = '0000' + n;
                return rv.slice(-p);
            }
            var tm = ts.getUTCFullYear() +
                '_' + pad(ts.getUTCMonth() + 1) +
                '_' + pad(ts.getUTCDate()) +
                'T' + pad(ts.getUTCHours()) +
                '' + pad(ts.getUTCMinutes()) +
                '' + pad(ts.getUTCSeconds()) +
                '.' + pad(ts.getUTCMilliseconds(), 3) +
                'Z';
            var dumpfile = path.normalize(dumpPath + '/' + dumpName + '.fatal_dump_' + tm + '.js');
            console.error("****** offending source code dumped into file: ", dumpfile);
            fs.writeFileSync(dumpfile, sourcecode, 'utf8');
        } catch (ex2) {
            console.error("generated source code fatal DUMPING error: ", ex2.message, ex2.stack);
        }
        throw ex;
    }

    // for debugging
    p.productions = this.productions;
    p.unused_productions = this.unused_productions;

    var self = this;
    function bind(method) {
        return function() {
            self.lexer = p.lexer;
            return self[method].apply(self, arguments);
        };
    }

    // backwards compatibility
    p.lexer = this.lexer;
    p.generate = bind('generate');
    p.generateAMDModule = bind('generateAMDModule');
    p.generateModule = bind('generateModule');
    p.generateCommonJSModule = bind('generateCommonJSModule');

    this.reportGrammarInformation();

    return p;
};

parser.trace = generator.trace;
parser.warn = generator.warn;
parser.error = generator.error;

function parseError(str, hash, ExceptionClass) {
    if (hash.recoverable) {
        this.trace(str);
        hash.destroy();             // destroy... well, *almost*!
    } else {
        throw new ExceptionClass(str, hash);
    }
}

parser.parseError = lrGeneratorMixin.parseError = parseError;

// wrapper function so we easily stringify the APIs defined inside to code *with comments*
// in the generated code:
function define_parser_APIs_1() {
    return {
        TERROR: 2,
        EOF: 1,

        // internals: defined here so the object *structure* doesn't get modified by parse() et al,
        // thus helping JIT compilers like Chrome V8.
        originalQuoteName: null,
        originalParseError: null,
        cleanupAfterParse: null,
        constructParseErrorInfo: null,

        __reentrant_call_depth: 0,      // INTERNAL USE ONLY
        __error_infos: [],              // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup

        // APIs which will be set up depending on user action code analysis:
        //yyRecovering: 0,
        //yyErrOk: 0,
        //yyClearIn: 0,

        // Helper APIs
        // -----------

        // Helper function which can be overridden by user code later on: put suitable quotes around
        // literal IDs in a description string.
        quoteName: function parser_quoteName(id_str) {
            return '"' + id_str + '"';
        },

        // Return a more-or-less human-readable description of the given symbol, when available,
        // or the symbol itself, serving as its own 'description' for lack of something better to serve up.
        //
        // Return NULL when the symbol is unknown to the parser.
        describeSymbol: function parser_describeSymbol(symbol) {
            if (symbol !== this.EOF && this.terminal_descriptions_ && this.terminal_descriptions_[symbol]) {
                return this.terminal_descriptions_[symbol];
            }
            else if (symbol === this.EOF) {
                return 'end of input';
            }
            else if (this.terminals_[symbol]) {
                return this.quoteName(this.terminals_[symbol]);
            }
            // Otherwise... this might refer to a RULE token i.e. a non-terminal: see if we can dig that one up.
            //
            // An example of this may be where a rule's action code contains a call like this:
            //
            //      parser.describeSymbol(#$)
            //
            // to obtain a human-readable description or name of the current grammar rule. This comes handy in
            // error handling action code blocks, for example.
            var s = this.symbols_;
            for (var key in s) {
                if (s[key] === symbol) {
                    return key;
                }
            }
            return null;
        },

        // Produce a (more or less) human-readable list of expected tokens at the point of failure.
        //
        // The produced list may contain token or token set descriptions instead of the tokens
        // themselves to help turning this output into something that easier to read by humans
        // unless `do_not_describe` parameter is set, in which case a list of the raw, *numeric*,
        // expected terminals and nonterminals is produced.
        //
        // The returned list (array) will not contain any duplicate entries.
        collect_expected_token_set: function parser_collect_expected_token_set(state, do_not_describe) {
            var TERROR = this.TERROR;
            var tokenset = [];
            var check = {};
            // Has this (error?) state been outfitted with a custom expectations description text for human consumption?
            // If so, use that one instead of the less palatable token set.
            if (!do_not_describe && this.state_descriptions_ && this.state_descriptions_[state]) {
                return [
                    this.state_descriptions_[state]
                ];
            }
            for (var p in this.table[state]) {
                p = +p;
                if (p !== TERROR) {
                    var d = do_not_describe ? p : this.describeSymbol(p);
                    if (d && !check[d]) {
                        tokenset.push(d);
                        check[d] = true;        // Mark this token description as already mentioned to prevent outputting duplicate entries.
                    }
                }
            }
            return tokenset;
        }
    };
}

var api_set = define_parser_APIs_1();
for (var api in api_set) {
    parser[api] = api_set[api];
}


parser.parse = function parse(input, parseParams) {
    var self = this,
        stack = new Array(128),         // token stack: stores token which leads to state at the same index (column storage)
        sstack = new Array(128),        // state stack: stores states (column storage)
        tstack = [],                    // token stack (only used when `%options token_stack` support has been enabled)
        vstack = new Array(128),        // semantic value stack
        lstack = new Array(128),        // location stack
        table = this.table,
        sp = 0;                         // 'stack pointer': index into the stacks

    var recovering = 0;                 // (only used when the grammar contains error recovery rules)
    var TERROR = this.TERROR,
        EOF = this.EOF,
        ERROR_RECOVERY_TOKEN_DISCARD_COUNT = (this.options.errorRecoveryTokenDiscardCount | 0) || 3;
    var NO_ACTION = [0, table.length /* ensures that anyone using this new state will fail dramatically! */];

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState_yy = {
        parseError: null,
        quoteName: null,
        lexer: null,
        parser: null,
        pre_parse: null,
        post_parse: null
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState_yy[k] = this.yy[k];
      }
    }

    sharedState_yy.lexer = lexer;
    sharedState_yy.parser = this;

    var yydebug = false;
    if (this.options.debug) {
        yydebug = function yydebug_impl(msg, obj) {
            var ref_list;
            var ref_names;
            function deepClone(from, sub) {
                if (sub == null) {
                    ref_list = [];
                    ref_names = [];
                    sub = 'root';
                }
                if (typeof from === 'function') return '[Function]';
                if (from == null || typeof from !== 'object') return from;
                if (from.constructor !== Object && from.constructor !== Array) {
                    return from;
                }

                for (var i = 0, len = ref_list.length; i < len; i++) {
                    if (ref_list[i] === from) {
                        return '[Circular/Xref:' + ref_names[i] + ']';   // circular or cross reference
                    }
                }
                ref_list.push(from);
                ref_names.push(sub);

                var to = new from.constructor();
                for (var name in from) {
                    if (name === 'parser') continue;
                    if (name === 'lexer') continue;
                    to[name] = deepClone(from[name], name);
                }
                return to;
            }

            obj = obj || {};
            if (obj.symbol) {
                obj['local yytext'] = yytext;
                obj['lexer.yytext'] = lexer.yytext;
                obj['lexer.yylloc'] = lexer.yylloc;
                obj['lexer.yyllineno'] = lexer.yyllineno;
            }

            // warning: here we fetch from closure (stack et al)
            obj.symbol_stack = stack;
            obj.state_stack = sstack;
            obj.value_stack = vstack;
            obj.location_stack = lstack;
            obj.stack_pointer = sp;

            // ready the object for printing:
            obj = deepClone(obj);

            // wrap try/catch in a function to help the V8 JIT compiler...
            function yydebug_cvt(obj) {
                var js;
                try {
                    var re1;
                    if (typeof XRegExp === 'undefined') {
                        re1 = /  \"([a-z_][a-z_0-9. ]*)\": /ig;
                    } else {
                        re1 = new XRegExp('  \"([\\p{Alphabetic}_][\\p{Alphabetic}\\p{Number}_. ]*)\": ', 'g');
                    }
                    js = JSON.stringify(obj, null, 2).replace(re1, '  $1: ').replace(/[\n\s]+/g, ' ');
                } catch (ex) {
                    js = String(obj);
                }
                return js;
            }

            self.trace(msg, yydebug_cvt(obj), '\n');
        };
    }

    // *Always* setup `yyError`, `YYRECOVERING`, `yyErrOk` and `yyClearIn` functions as it is paramount
    // to have *their* closure match ours -- if we only set them up once,
    // any subsequent `parse()` runs will fail in very obscure ways when
    // these functions are invoked in the user action code block(s) as
    // their closure will still refer to the `parse()` instance which set
    // them up. Hence we MUST set them up at the start of every `parse()` run!
    if (this.yyError) {
        this.yyError = function yyError(str) {
            if (yydebug) yydebug('yyerror: ', { message: str, args: arguments, symbol: symbol, state: state, newState: newState, recovering: recovering, action: action });
            // var error_rule_depth = locateNearestErrorRecoveryRule(state);
            // var expected = this.collect_expected_token_set(state);
            var hash = this.constructParseErrorInfo(str, null, null, false); // (str, null, expected, (error_rule_depth >= 0));
            var r = this.parseError(str, hash, this.JisonParserError);
        };
    }

    if (this.yyRecovering) {
        this.yyRecovering = function yyRecovering() {
            if (yydebug) yydebug('yyrecovering: ', { symbol: symbol, state: state, newState: newState, recovering: recovering, action: action });
            return recovering;
        };
    }

    if (this.yyErrOk) {
        this.yyErrOk = function yyErrOk() {
            if (yydebug) yydebug('yyerrok: ', { symbol: symbol, state: state, newState: newState, recovering: recovering, action: action });
            recovering = 0;
        };
    }

    if (this.yyClearIn) {
        this.yyClearIn = function yyClearIn() {
            if (yydebug) yydebug('yyclearin: ', { symbol: symbol, newState: newState, recovering: recovering, action: action, preErrorSymbol: preErrorSymbol });
            if (symbol === TERROR) {
                symbol = 0;
                yytext = null;
                yyleng = 0;
                yyloc = {};
            }
            preErrorSymbol = 0;
        };
    }

    lexer.setInput(input, sharedState_yy);

    var yyloc = lexer.yylloc || {};
    lstack[sp] = yyloc;
    vstack[sp] = null;
    sstack[sp] = 0;
    stack[sp] = 0;
    ++sp;

    var yytext = lexer.yytext;
    var yylineno = lexer.yylineno;
    var yyleng = lexer.yyleng;

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState_yy.parseError === 'function') {
        this.parseError = function parseErrorAlt(str, hash, ExceptionClass) {
            return sharedState_yy.parseError(str, hash, ExceptionClass);
        };
    } else {
        this.parseError = this.originalParseError;
    }

    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState_yy.quoteName === 'function') {
        this.quoteName = sharedState_yy.quoteName;
    } else {
        this.quoteName = this.originalQuoteName;
    }

    // set up the cleanup function; make it an API so that external code can re-use this one in case of
    // calamities or when the `%options no-try-catch` option has been specified for the grammar, in which
    // case this parse() API method doesn't come with a `finally { ... }` block any more!
    //
    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `sharedState`, etc. references will be *wrong*!
    this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods, do_not_nuke_errorinfos) {
        var rv;

        if (invoke_post_methods) {
            if (sharedState_yy.post_parse) {
                rv = sharedState_yy.post_parse.call(this, sharedState_yy, resultValue, parseParams);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
            if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState_yy, resultValue, parseParams);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
        }

        if (this.__reentrant_call_depth > 1) return resultValue;        // do not (yet) kill the sharedState when this is a reentrant run.

        // clean up the lingering lexer structures as well:
        if (lexer.cleanupAfterLex) {
            lexer.cleanupAfterLex(do_not_nuke_errorinfos);
        }

        // prevent lingering circular references from causing memory leaks:
        if (sharedState_yy) {
            sharedState_yy.parseError = undefined;
            sharedState_yy.quoteName = undefined;
            sharedState_yy.lexer = undefined;
            sharedState_yy.parser = undefined;
            if (lexer.yy === sharedState_yy) {
                lexer.yy = undefined;
            }
        }
        sharedState_yy = undefined;
        this.parseError = this.originalParseError;
        this.quoteName = this.originalQuoteName;

        // nuke the vstack[] array at least as that one will still reference obsoleted user values.
        // To be safe, we nuke the other internal stack columns as well...
        stack.length = 0;               // fastest way to nuke an array without overly bothering the GC
        sstack.length = 0;
        lstack.length = 0;
        vstack.length = 0;
        sp = 0;

        // nuke the error hash info instances created during this run.
        // Userland code must COPY any data/references
        // in the error hash instance(s) it is more permanently interested in.
        if (!do_not_nuke_errorinfos) {
            for (var i = this.__error_infos.length - 1; i >= 0; i--) {
                var el = this.__error_infos[i];
                if (el && typeof el.destroy === 'function') {
                    el.destroy();
                }
            }
            this.__error_infos.length = 0;
        }

        return resultValue;
    };

    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `lexer`, `sharedState`, etc. references will be *wrong*!
    this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected, recoverable) {
        var pei = {
            errStr: msg,
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,
            loc: lexer.yylloc || {},
            expected: expected,
            recoverable: recoverable,
            state: state,
            action: action,
            new_state: newState,
            symbol_stack: stack,
            state_stack: sstack,
            value_stack: vstack,
            location_stack: lstack,
            stack_pointer: sp,
            yy: sharedState_yy,
            lexer: lexer,
            parser: this,

            // and make sure the error info doesn't stay due to potential
            // ref cycle via userland code manipulations.
            // These would otherwise all be memory leak opportunities!
            //
            // Note that only array and object references are nuked as those
            // constitute the set of elements which can produce a cyclic ref.
            // The rest of the members is kept intact as they are harmless.
            destroy: function destructParseErrorInfo() {
                // remove cyclic references added to error info:
                // info.yy = null;
                // info.lexer = null;
                // info.value = null;
                // info.value_stack = null;
                // ...
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this.hasOwnProperty(key) && typeof key === 'object') {
                        this[key] = undefined;
                    }
                }
                this.recoverable = rec;
            }
        };
        // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!
        this.__error_infos.push(pei);
        return pei;
    };

//_lexer_without_token_stack:

    function lex(parseParams) {
        var token = lexer.lex(parseParams);
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token || EOF;
    }

//_lexer_with_token_stack:

    // lex function that supports token stacks
    function tokenStackLex(parseParams) {
        var token;
        token = tstack.pop() || lexer.lex(parseParams) || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            if (token instanceof Array) {
                tstack = token;
                token = tstack.pop();
            }
            // if token isn't its numeric value, convert
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
        }
        return token || EOF;
    }

//_lexer_with_token_stack_end:

    var symbol = 0;
    var preErrorSymbol = 0;
    var lastEofErrorStateDepth = 0;
    var state, action, r, t;
    var yyval = {
        $: true,
        _$: undefined,
        yy: sharedState_yy
    };
    var p, len, this_production;
    var lstack_begin, lstack_end;
    var newState;
    var retval = false;

//_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

    // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = sp - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            if (yydebug) yydebug('locateNearestErrorRecoveryRule #test#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
            var t = table[state][TERROR] || NO_ACTION;
            if (t[0]) {
                // We need to make sure we're not cycling forever:
                // once we hit EOF, even when we `yyerrok()` an error, we must
                // prevent the core from running forever,
                // e.g. when parent rules are still expecting certain input to
                // follow after this, for example when you handle an error inside a set
                // of braces which are matched by a parent rule in your grammar.
                //
                // Hence we require that every error handling/recovery attempt
                // *after we've hit EOF* has a diminishing state stack: this means
                // we will ultimately have unwound the state stack entirely and thus
                // terminate the parse in a controlled fashion even when we have
                // very complex error/recovery code interplay in the core + user
                // action code blocks:
                if (yydebug) yydebug('locateNearestErrorRecoveryRule #found#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
                if (symbol === EOF) {
                    if (!lastEofErrorStateDepth) {
                        lastEofErrorStateDepth = sp - 1 - depth;
                    } else if (lastEofErrorStateDepth <= sp - 1 - depth) {
                        if (yydebug) yydebug('locateNearestErrorRecoveryRule #skip#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
                        --stack_probe; // popStack(1): [symbol, action]
                        state = sstack[stack_probe];
                        ++depth;
                        continue;
                    }
                }
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 1) {
                if (yydebug) yydebug('locateNearestErrorRecoveryRule #end=NIL#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
                return -1; // No suitable error recovery rule available.
            }
            --stack_probe; // popStack(1): [symbol, action]
            state = sstack[stack_probe];
            ++depth;
        }
    }

//_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
//_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

    try {
        this.__reentrant_call_depth++;

        if (this.pre_parse) {
            this.pre_parse.call(this, sharedState_yy, parseParams);
        }
        if (sharedState_yy.pre_parse) {
            sharedState_yy.pre_parse.call(this, sharedState_yy, parseParams);
        }

        newState = sstack[sp - 1];
        for (;;) {
            // retrieve state number from top of stack
            state = newState;               // sstack[sp - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = 2;
                newState = this.defaultActions[state];
            } else {
                // The single `==` condition below covers both these `===` comparisons in a single
                // operation:
                //
                //     if (symbol === null || typeof symbol === 'undefined') ...
                if (!symbol) {
                    symbol = lex(parseParams);
                }
                // read action for current state and first input
                t = (table[state] && table[state][symbol]) || NO_ACTION;
                newState = t[1];
                action = t[0];

                if (yydebug) yydebug('after FETCH/LEX: ', { symbol: symbol, newState: newState, recovering: recovering, action: action });

//_handle_error_with_recovery:                // run this code when the grammar includes error recovery rules

                // handle parse error
                if (!action) {
                    // first see if there's any chance at hitting an error recovery rule:
                    var error_rule_depth = locateNearestErrorRecoveryRule(state);
                    var errStr = null;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    if (!recovering) {
                        // Report error
                        if (typeof lexer.yylineno === 'number') {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                        } else {
                            errStr = 'Parse error: ';
                        }
                        if (lexer.showPosition) {
                            errStr += '\n' + lexer.showPosition(79 - 10, 10) + '\n';
                        }
                        if (expected.length) {
                            errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                        } else {
                            errStr += 'Unexpected ' + errSymbolDescr;
                        }
                        p = this.constructParseErrorInfo(errStr, null, expected, (error_rule_depth >= 0));
                        r = this.parseError(p.errStr, p, this.JisonParserError);

                        if (yydebug) yydebug('error detected: ', { error_rule_depth: error_rule_depth });
                        if (!p.recoverable) {
                            retval = r;
                            break;
                        } else {
                            // TODO: allow parseError callback to edit symbol and or state at the start of the error recovery process...
                        }
                    }

                    if (yydebug) yydebug('after ERROR DETECT: ', { error_rule_depth: error_rule_depth });

                    // just recovered from another error
                    if (recovering === ERROR_RECOVERY_TOKEN_DISCARD_COUNT && error_rule_depth >= 0) {
                        // only barf a fatal hairball when we're out of look-ahead symbols and none hit a match;
                        // this DOES discard look-ahead while recovering from an error when said look-ahead doesn't
                        // suit the error recovery rules... The error HAS been reported already so we're fine with
                        // throwing away a few items if that is what it takes to match the nearest recovery rule!
                        if (symbol === EOF || preErrorSymbol === EOF) {
                            p = this.constructParseErrorInfo((errStr || 'Parsing halted while starting to recover from another error.'), null, expected, false);
                            retval = this.parseError(p.errStr, p, this.JisonParserError);
                            break;
                        }

                        // discard current lookahead and grab another
                        yyleng = lexer.yyleng;
                        yytext = lexer.yytext;
                        yylineno = lexer.yylineno;
                        yyloc = lexer.yylloc || {};

                        symbol = lex(parseParams);

                        if (yydebug) yydebug('after ERROR RECOVERY-3: ', { symbol: symbol });
                    }

                    // try to recover from error
                    if (error_rule_depth < 0) {
                        p = this.constructParseErrorInfo((errStr || 'Parsing halted. No suitable error recovery rule available.'), null, expected, false);
                        retval = this.parseError(p.errStr, p, this.JisonParserError);
                        break;
                    }
                    sp -= error_rule_depth;

                    preErrorSymbol = (symbol === TERROR ? 0 : symbol); // save the lookahead token
                    symbol = TERROR;            // insert generic error symbol as new lookahead
                    // allow N (default: 3) real symbols to be shifted before reporting a new error
                    recovering = ERROR_RECOVERY_TOKEN_DISCARD_COUNT;

                    newState = sstack[sp - 1];

                    if (yydebug) yydebug('after ERROR POP: ', { error_rule_depth: error_rule_depth, symbol: symbol });

                    continue;
                }

//_handle_error_no_recovery:                  // run this code when the grammar does not include any error recovery rules

                // handle parse error
                if (!action) {
                    var errStr;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    // Report error
                    if (typeof lexer.yylineno === 'number') {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                    } else {
                        errStr = 'Parse error: ';
                    }
                    if (lexer.showPosition) {
                        errStr += '\n' + lexer.showPosition(79 - 10, 10) + '\n';
                    }
                    if (expected.length) {
                        errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                    } else {
                        errStr += 'Unexpected ' + errSymbolDescr;
                    }
                    // we cannot recover from the error!
                    p = this.constructParseErrorInfo(errStr, null, expected, false);
                    retval = this.parseError(p.errStr, p, this.JisonParserError);
                    break;
                }

//_handle_error_end_of_section:                  // this concludes the error recovery / no error recovery code section choice above

            }

            if (yydebug) yydebug('::: action: ' + (action === 1 ? 'shift token ' + symbol + ' (then go to state ' + newState + ')' : action === 2 ? 'reduce by rule: ' + newState + (function __print_rule(nt, state) {
                if (!nt || !nt.states || !nt.rules)
                  return '';
                var rulename = nt.states[state];
                var rulespec = nt.rules[rulename][state];
                return ' (' + rulespec.symbol + ' := ' + rulespec.handle + ')';
            })(this.nonterminals_, newState) : action === 3 ? 'accept' : '???unexpected???'), { action: action, newState: newState, recovering: recovering, symbol: symbol });
            switch (action) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action instanceof Array) {
                    p = this.constructParseErrorInfo(('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol), null, null, false);
                    retval = this.parseError(p.errStr, p, this.JisonParserError);
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                retval = this.parseError(p.errStr, p, this.JisonParserError);
                break;

            // shift:
            case 1:
                //this.shiftCount++;
                stack[sp] = symbol;
                vstack[sp] = lexer.yytext;
                lstack[sp] = lexer.yylloc || {};
                sstack[sp] = newState; // push state
                ++sp;
                symbol = 0;
                if (!preErrorSymbol) { // normal execution / no error
                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc || {};

                    if (recovering > 0) {
                        recovering--;
                        if (yydebug) yydebug('... SHIFT:error rule matching: ', { recovering: recovering, symbol: symbol });
                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                    symbol = preErrorSymbol;
                    preErrorSymbol = 0;
                    if (yydebug) yydebug('... SHIFT:error recovery: ', { recovering: recovering, symbol: symbol });
                    // read action for current state and first input
                    t = (table[newState] && table[newState][symbol]) || NO_ACTION;
                    if (!t[0] || symbol === TERROR) {
                        // forget about that symbol and move forward: this wasn't a 'forgot to insert' error type where
                        // (simple) stuff might have been missing before the token which caused the error we're
                        // recovering from now...
                        //
                        // Also check if the LookAhead symbol isn't the ERROR token we set as part of the error
                        // recovery, for then this we would we idling (cycling) on the error forever.
                        // Yes, this does not take into account the possibility that the *lexer* may have
                        // produced a *new* TERROR token all by itself, but that would be a very peculiar grammar!
                        if (yydebug) yydebug('... SHIFT:error recovery: re-application of old symbol doesn\'t work: instead, we\'re moving forward now. ', { recovering: recovering, symbol: symbol });
                        symbol = 0;
                    }
                }

                continue;

            // reduce:
            case 2:
                //this.reductionCount++;
                this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                len = this_production[1];
                lstack_end = sp;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                if (yydebug) yydebug('~~~ REDUCE: ', { pop_size: len, newState: newState, recovering: recovering, symbol: symbol });

                // Make sure subsequent `$$ = $1` default action doesn't fail
                // for rules where len==0 as then there's no $1 (you're reducing an epsilon rule then!)
                //
                // Also do this to prevent nasty action block codes to *read* `$0` or `$$`
                // and *not* get `undefined` as a result for their efforts!
                vstack[sp] = undefined;

                // perform semantic action
                yyval.$ = vstack[sp - len]; // default to $$ = $1; result must produce `undefined` when len == 0, as then there's no $1

                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack_begin].first_line,
                    last_line: lstack[lstack_end].last_line,
                    first_column: lstack[lstack_begin].first_column,
                    last_column: lstack[lstack_end].last_column
                };
                if (ranges) {
                  yyval._$.range = [lstack[lstack_begin].range[0], lstack[lstack_end].range[1]];
                }

                r = this.performAction.call(yyval, yytext, yyleng, yylineno, yyloc, newState, sp - 1, vstack, lstack, stack, sstack, parseParams);

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                sp -= len;

                // don't overwrite the `symbol` variable: use a local var to speed things up:
                var ntsymbol = this_production[0];    // push nonterminal (reduce)
                stack[sp] = ntsymbol;
                vstack[sp] = yyval.$;
                lstack[sp] = yyval._$;
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[sstack[sp - 1]][ntsymbol];
                sstack[sp] = newState;
                ++sp;
                if (yydebug) yydebug('REDUCED: ', { newState: newState, recovering: recovering, symbol: symbol });
                continue;

            // accept:
            case 3:
                retval = true;
                // Return the `$accept` rule's `$$` result, if available.
                //
                // Also note that JISON always adds this top-most `$accept` rule (with implicit,
                // default, action):
                //
                //     $accept: <startSymbol> $end
                //                  %{ $$ = $1; @$ = @1; %}
                //
                // which, combined with the parse kernel's `$accept` state behaviour coded below,
                // will produce the `$$` value output of the <startSymbol> rule as the parse result,
                // IFF that result is *not* `undefined`. (See also the parser kernel code.)
                //
                // In code:
                //
                //                  %{
                //                      @$ = @1;            // if location tracking support is included
                //                      if (typeof $1 !== 'undefined')
                //                          return $1;
                //                      else
                //                          return true;           // the default parse result if the rule actions don't produce anything
                //                  %}
                if (typeof yyval.$ !== 'undefined') {
                    retval = yyval.$;
                }
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } catch (ex) {
        // report exceptions through the parseError callback too:
        p = this.constructParseErrorInfo('Parsing aborted due to exception.', ex, null, false);
        retval = this.parseError(p.errStr, p, this.JisonParserError);
    } finally {
        retval = this.cleanupAfterParse(retval, true, true);
        this.__reentrant_call_depth--;
    }

    return retval;
};


/*
 * LR(0) Parser
 */

var lr0 = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    type: 'LR(0)',
    afterconstructor: function lr0_afterconstructor() {
        this.buildTable();
    }
});

var LR0Generator = exports.LR0Generator = lr0.construct();

/*
 * Simple LALR(1)
 */

var lalr = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    type: 'LALR(1)',

    afterconstructor: function lalr_afterconstructor() {
        if (this.DEBUG) {
            this.mix(lrGeneratorDebug, lalrGeneratorDebug); // mixin debug methods
        }

        for (var round = 1; /* infinite loop if it weren't for the `break`s at the end */ ; round++) {
            this.states = this.canonicalCollection();

            if (this.DEBUG || devDebug) {
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER canonicalCollection:');
                this.displayFollowSets();
                Jison.print('\n');
            }

            this.terms_ = {};

            var newg = this.newg = typal.beget(lookaheadMixin, {
                oldg: this,
                trace: this.trace,
                nterms_: {},
                DEBUG: false,
                go_: function (productionSymbol, productionHandle) {
                    var stateNum = productionSymbol.split(':')[0]; // grab state #
                    assert(stateNum == +stateNum);
                    stateNum = +stateNum;
                    productionHandle = productionHandle.map(function (rhsElem) {
                        return rhsElem.slice(rhsElem.indexOf(':') + 1);
                    });
                    return this.oldg.go(stateNum, productionHandle, productionSymbol);
                }
            });
            newg.nonterminals = {};
            newg.productions = [];

            //this.inadequateStates = [];

            // if true, only lookaheads in inadequate states are computed (faster, larger table)
            // if false, lookaheads for all reductions will be computed (slower, smaller table)
            //
            // WARNING: using this has a negative effect on your error reports:
            //          a lot of 'expected' symbols are reported which are not in the real FOLLOW set,
            //          resulting in 'illogical' error messages!
            this.onDemandLookahead = !!this.options.onDemandLookahead;
            if (devDebug || this.DEBUG) Jison.print('LALR: using on-demand look-ahead: ', (this.onDemandLookahead ? 'yes' : 'no'));

            this.buildNewGrammar();

            if (devDebug || this.DEBUG) {
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER buildNewGrammar: NEW GRAMMAR');
                newg.displayFollowSets();
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER buildNewGrammar: ORIGINAL GRAMMAR');
                this.displayFollowSets();
            }

            newg.computeLookaheads();

            if (devDebug || this.DEBUG) {
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads: NEW GRAMMAR');
                newg.displayFollowSets();
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads: ORIGINAL GRAMMAR');
                this.displayFollowSets();
            }

            this.unionLookaheads();

            if (devDebug || this.DEBUG) {
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER unionLookaheads: NEW GRAMMAR');
                newg.displayFollowSets();
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER unionLookaheads: ORIGINAL GRAMMAR');
                this.displayFollowSets();
            }

            this.table = this.parseTable(this.states);

            if (devDebug || this.DEBUG) {
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable: NEW GRAMMAR');
                newg.displayFollowSets();
                Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable: ORIGINAL GRAMMAR');
                this.displayFollowSets();
            }

            // When some productions are flagged as conflicting, we redo the G' generation and consequent union-ing of the productions
            // in the `.goes[]` arrays.
            //
            // Also quit when we're at the end of the conflict resolution round (which is round #2)
            if (this.conflicts === 0 || this.conflict_fixing_round || !this.options.hasPartialLrUpgradeOnConflict) {
                break;
            }

            if (devDebug > 4) {
                Jison.print('\n-------------------------------------------\nNew round to fix conflicts? Completed round:', {
                    round: round,
                    conflict_fixing_round: this.conflict_fixing_round,
                    states: this.conflict_states_LU,
                    productions: this.conflict_productions_LU
                });
            } else {
                Jison.print('\n'
                    + '----------------------------------- NOTICE -------------------------------\n'
                    + 'Attempting to resolve the unresolved conflicts in partial LR mode...\n\n'
                    + 'When no conflicts are reported in the next round below, your grammar is\n'
                    + 'accepted as mixed LR/LALR and should work as expected.\n'
                    + '--------------------------------------------------------------------------\n\n');
            }

            this.conflict_fixing_round = true;

            // and reset the conflict trackers, which we do not use to attempt to fix the conflict in round #2:
            this.conflicts = 0;
            this.new_conflicts_found_this_round = 0;
            this.conflicting_states = [];
            this.resolutions = [];
        }

        this.defaultActions = findDefaults(this.table, this.hasErrorRecovery);
        cleanupTable(this.table);

        traceStates(this.trace, this.states, 'at the end of the LALR constructor, after cleanupTable() and findDefaults()');
    },

    lookAheads: function LALR_lookaheads(state, item) {
        return (this.onDemandLookahead && !state.inadequate) ? this.terminals : item.follows;
    },

    go: function LALR_go(stateNum, productionHandle, productionSymbol) {
        assert(typeof stateNum === 'number');
        var endStateNum = stateNum;
        for (var i = 0; i < productionHandle.length; i++) {
            endStateNum = this.states.item(endStateNum).edges[productionHandle[i]] || endStateNum;
        }
        if (devDebug > 0) {
            Jison.print('GO: ', {
                stateNum: stateNum,
                symbol: productionSymbol,
                endState: endStateNum
            });
        }
        return endStateNum;
    },

    goPath: function LALR_goPath(stateNum, productionHandle, productionSymbol) {
        assert(typeof stateNum === 'number');
        var endStateNum = stateNum,
            t,
            path = [];
        for (var i = 0; i < productionHandle.length; i++) {
            t = productionHandle[i] ? endStateNum + ':' + productionHandle[i] /* + ':' + productionSymbol */ : '';
            if (t) {
                this.newg.nterms_[t] = endStateNum;
            }
            path.push(t);
            endStateNum = this.states.item(endStateNum).edges[productionHandle[i]] || endStateNum;
            assert(t ? this.terms_[t] === undefined || this.terms_[t] === productionHandle[i] : true);
            this.terms_[t] = productionHandle[i];
        }
        if (devDebug > 0) {
            Jison.print('GOPATH: ', {
                stateNum: stateNum,
                symbol: productionSymbol,
                path: path,
                endState: endStateNum
            });
        }
        return {
            path: path,
            endState: endStateNum
        };
    },

    // every disjoint reduction of a nonterminal becomes a production in G'
    buildNewGrammar: function LALR_buildNewGrammar() {
        var self = this,
            newg = this.newg;

        this.states.forEach(function (state, i) {
            i = +i;
            state.forEach(function LALR_buildNewHandle(item) {
                if (item.dotPosition === 0) {
                    // new symbols are a combination of state and transition symbol
                    var symbol = i + ':' + item.production.symbol;
                    assert(self.terms_[symbol] === undefined || self.terms_[symbol] === item.production.symbol);
                    self.terms_[symbol] = item.production.symbol;
                    newg.nterms_[symbol] = i;
                    if (!newg.nonterminals[symbol]) {
                        newg.nonterminals[symbol] = new Nonterminal(symbol);
                    }
                    var pathInfo = self.goPath(i, item.production.handle, item.production.symbol);
                    var p = new Production(symbol, pathInfo.path, newg.productions.length);
                    newg.productions.push(p);
                    newg.nonterminals[symbol].productions.push(p);

                    // store the transition that gets 'backed up to' after reduction on path
                    var handle = item.production.handle.join(' ');
                    if (self.conflict_fixing_round && self.conflict_states_LU[i]) {
                        // handle += ':C' + i;
                    }
                    if (self.conflict_fixing_round && self.conflict_productions_LU[item.production.id]) {
                        handle += ':P' + item.production.id;
                    }

                    var goes = self.states.item(pathInfo.endState).goes;
                    if (!goes[handle]) {
                        goes[handle] = [];
                    }
                    goes[handle].push(symbol);

                    if (devDebug > 2) Jison.print('new production:', {
                        prod_id: item.production.id,
                        new_prod_id: p.id,
                        state: state,
                        stateNum: i,
                        production: p,
                        item_production: item.production,
                        goes: goes,
                        handle: handle,
                        symbol: symbol,
                        pathInfo: pathInfo
                    });
                }
            });
            // if (state.inadequate) {
            //     self.inadequateStates.push(i);
            // }
        });
    },

    unionLookaheads: function LALR_unionLookaheads() {
        var self = this,
            newg = this.newg;
        // var states = !!this.onDemandLookahead ? this.inadequateStates : this.states;

        this.states.forEach(function union_states_forEach(state, i) {
            i = +i;
            //assert(state.inadequate ? this.inadequate : true);
            var treat_me = (self.onDemandLookahead ? this.inadequate || state.inadequate : true);
            if (state.reductions.length && treat_me) {
                state.reductions.forEach(function union_reduction_forEach(item) {
                    var follows = {};
                    for (var k = 0; k < item.follows.length; k++) {
                        follows[item.follows[k]] = true;
                    }
                    var handle = item.production.handle.join(' ');
                    if (self.conflict_fixing_round && self.conflict_states_LU[i]) {
                        // handle += ':C' + i;
                    }
                    if (self.conflict_fixing_round && self.conflict_productions_LU[item.production.id]) {
                        handle += ':P' + item.production.id;
                    }
                    if (!state.goes[handle]) {
                        state.goes[handle] = [];
                    }

                    if (devDebug > 2) Jison.print('not-yet-unioned item', {
                        handle: handle,
                        item: item,
                        follows: follows,
                        goes: state.goes,
                        state: state,
                        stateNum: i
                    });

                    state.goes[handle].forEach(function reduction_goes_forEach(symbol) {
                        newg.nonterminals[symbol].follows.forEach(function goes_follows_forEach(symbol) {
                            var terminal = self.terms_[symbol];
                            if (!follows[terminal]) {
                                follows[terminal] = true;

                                if (devDebug > 2) Jison.print('adding to FOLLOW set (union)', {
                                    terminal: terminal,
                                    nonterminal: symbol,
                                    in_follows: newg.nonterminals[symbol],
                                    out_follows: item.follows
                                });

                                item.follows.push(terminal);
                            }
                        });
                    });

                    if (devDebug > 2) Jison.print('unioned item', item);
                });
            }
        });
    }
});

var LALRGenerator = exports.LALRGenerator = lalr.construct();

// LALR generator debug mixin

var lalrGeneratorDebug = {
    beforebuildNewGrammar: function () {
        this.trace(this.states.size() + ' states.');
        this.trace('Building lookahead grammar.');
    },
    beforeunionLookaheads: function () {
        this.trace('Computing lookaheads.');
    },
    afterbuildNewGrammar: function () {
        traceStates(this.trace, this.states, 'after LALR::buildNewGrammar()');
    },
    afterunionLookaheads: function () {
        traceStates(this.trace, this.states, 'after LALR::unionLookaheads()');
    },
    aftercomputeLookaheads: function () {
        traceStates(this.trace, this.states, 'after LALR::computeLookaheads()');
    },
    aftercanonicalCollection: function (states /* as produced by `this.canonicalCollection()` */ ) {
        traceStates(this.trace, states, 'as produced by LALR::canonicalCollection()');
    }
};

/*
 * Lookahead parser definitions
 *
 * Define base type
 */
var lrLookaheadGenerator = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    afterconstructor: function lr_aftercontructor() {
        this.computeLookaheads();

        if (devDebug || this.DEBUG) {
            Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads:');
            this.displayFollowSets();
            Jison.print('\n');
        }

        this.buildTable();
    }
});

/*
 * SLR Parser
 */
var SLRGenerator = exports.SLRGenerator = lrLookaheadGenerator.construct({
    type: 'SLR(1)',

    lookAheads: function SLR_lookAhead(state, item) {
        return this.nonterminals[item.production.symbol].follows;
    }
});


/*
 * LR(1) Parser
 */
var lr1 = lrLookaheadGenerator.beget({
    type: 'Canonical LR(1)',

    lookAheads: function LR_lookAheads(state, item) {
        return item.follows;
    },

    Item: lrGeneratorMixin.Item.prototype.construct({
        afterconstructor: function () {
            this.id = this.production.id + '#' + this.dotPosition + '#' + this.follows.sort().join(',');
        },
        eq: function (e) {
            return e.id === this.id;
        }
    }),

    closureOperation: function LR_ClosureOperation(itemSet) {
        var closureSet = new this.ItemSet();
        var self = this;

        var set = itemSet,
            itemQueue,
            syms = {};

        do {
            itemQueue = new Set();
            closureSet = closureSet.concat(set);
            set.forEach(function LR_AddItemToClosureSets(item) {
                var symbol = item.markedSymbol;
                var b, r;

                // if token is a nonterminal, recursively add closures
                if (symbol && self.nonterminals[symbol]) {
                    r = item.remainingHandle();
                    b = self.first(r);
                    if (b.length === 0 || item.production.nullable || self.nullable(r)) {
                        b = b.concat(item.follows);
                    }
                    self.nonterminals[symbol].productions.forEach(function (production) {
                        var newItem = new self.Item(production, 0, b);
                        if (!closureSet.contains(newItem) && !itemQueue.contains(newItem)) {
                            itemQueue.push(newItem);
                        }
                    });
                } else if (!symbol) {
                    // reduction
                    closureSet.reductions.push(item);
                }
            });

            set = itemQueue;
        } while (!itemQueue.isEmpty());

        return closureSet;
    }
});

var LR1Generator = exports.LR1Generator = lr1.construct();

/*
 * LL Parser
 */
var ll = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    type: 'LL(1)',

    afterconstructor: function ll_aftercontructor() {
        this.computeLookaheads();

        if (devDebug || this.DEBUG) {
            Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads:');
            this.displayFollowSets();
        }

        this.table = this.parseTable(this.productions);

        if (devDebug || this.DEBUG) {
            Jison.print('\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable:');
            this.displayFollowSets();
        }

        this.defaultActions = {}; // findDefaults(this.table, this.hasErrorRecovery);
        //cleanupTable(this.table);
    },

    parseTable: function ll_ParseTable(productions) {
        var table = {},
            symbols_ = this.symbols_,
            self = this;

        productions.forEach(function (production, i) {
            var row = table[production.symbol] || {};
            var tokens = production.first;
            if (self.nullable(production.handle)) {
                tokens = union(tokens, self.nonterminals[production.symbol].follows);
            }
            tokens.forEach(function (token) {
                if (row[token]) {
                    row[token].push(i);
                    self.conflicts++;
                } else {
                    row[token] = [i];
                }
            });
            table[production.symbol] = row;
            production.first = tokens;
        });

        return table;
    }
});

var LLGenerator = exports.LLGenerator = ll.construct();

Jison.Generator = function Jison_Generator(grammar, optionalLexerSection, options) {
    // pick the correct argument for the `options` for this call:
    if (!options && optionalLexerSection && typeof optionalLexerSection !== 'string') {
      options = optionalLexerSection;
      optionalLexerSection = null;
    }
    // and standardize it:
    options = mkStdOptions(options);

    // Provisionally parse the grammar, really only to obtain the *options.type*
    // specified within the grammar, if specified (via `%parser-type`).
    //
    // Meanwhile, we *auto-detect* if the input is in JSON or JISON format
    // and parse the specs, so we don't have to, nor should we have to, do
    // *that* activity again in the specific generators below: they all
    // share a common grammar+lexer spec format (JSON/JSON5/JISON) which will
    // be parsed by `autodetectAndConvertToJSONformat()` right now!
    grammar = autodetectAndConvertToJSONformat(grammar, optionalLexerSection, options);

    // make sure all options are 'standardized' before we go and mix them together:
    options = mkStdOptions(grammar.options, options);
    switch (options.type || '') {
    case 'lr0':
        options.hasPartialLrUpgradeOnConflict = false;        // kill this unsupported option
        return new LR0Generator(grammar, null, options);
    case 'slr':
        options.hasPartialLrUpgradeOnConflict = false;        // kill this unsupported option
        return new SLRGenerator(grammar, null, options);
    case 'lr':
    case 'lr1':
        options.hasPartialLrUpgradeOnConflict = false;        // kill this unsupported option
        return new LR1Generator(grammar, null, options);
    case 'll':
    case 'll1':
        options.hasPartialLrUpgradeOnConflict = false;        // kill this unsupported option
        return new LLGenerator(grammar, null, options);
    case 'lalr1':
    case 'lalr':
    case '':
        return new LALRGenerator(grammar, null, options);
    default:
        throw new Error('Unsupported parser type: ' + options.type);
    }
};

return function Parser(g, l, options) {
    var gen = Jison.Generator(g, l, options);
    return gen.createParser();
};

})();
