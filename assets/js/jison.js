(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

Jison = require('./lib/jison.js');
//bnf = require('ebnf-parser');

},{"./lib/jison.js":2}],2:[function(require,module,exports){
(function (process){
// Jison, an LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zach@carter.name>
// MIT X Licensed

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
    json: false,
    type: 'lalr',                   // CLI: --parserType option
    compressTables: 2,              // 0, 1, 2
    outputDebugTables: false,
    noDefaultResolve: false,
    noDefaultAction: false,
    noTryCatch: false,
    errorRecoveryTokenDiscardCount: 3,
    exportAllTables: false,
    noMain: false,                  // CLI: not:(--main option)

    // moduleName: 'xxx',
    // file: '...',
    // outfile: '...',
    // inputPath: '...',
    // lexfile: '...',
};

Jison.defaultJisonOptions = defaultJisonOptions;

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
    // and O(1) checking that hash... Turns I was right.
    //
    // The 'arbitrary' threshold of 52 entries in the array to check
    // against is probably at or near the worst-case FIRST/FOLLOW set
    // site for this jscore grammar as the naive scan consistently
    // outperformed the old smarter hash-object code for smaller
    // thresholds (10, 20, 32, 42!)
    if (a.length > 52) {
        var ar = {};
        for (var k = 0, len = a.length; k < len; k++) {
            ar[a[k]] = true;
        }
        for (var k = 0, len = b.length; k < len; k++) {
            if (!ar[b[k]]) {
                a.push(b[k]);
            }
        }
    } else {
        var bn = [];
        for (var k = 0, len = b.length; k < len; k++) {
            if (a.indexOf(b[k]) < 0) {
                bn.push(b[k]);
            }
        }
        a = a.concat(bn);
    }
    return a;
}

// print the function in source code form, properly indented.
function printFunctionSourceCode(f) {
    return String(f).replace(/^    /gm, '');
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
    constructor: function Production(symbol, handle, id) {
        this.symbol = symbol;
        this.handle = handle;
        this.nullable = false;
        this.id = id;
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

// `lexGrammarStr` is an optional {String} argument, specifying the lexer rules.
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
generator.constructor = function Jison_Generator(grammar, lexGrammarStr, opt) {
    // pick the correct argument for the `options` for this call:
    var options = typal.camelMix.call({}, (opt || (typeof grammar === 'string' && typeof lexGrammarStr === 'string')) ? opt : lexGrammarStr);
    var err;

    if (typeof grammar === 'string') {
        try {
            if (options.json) {
                grammar = json5.parse(grammar);
            } else {
                grammar = ebnfParser.parse(grammar);
            }
        } catch (e) {
            if (options.json) {
                err = new Error('Could not parse jison grammar in JSON mode\nError: ' + e.message);
            } else {
                err = new Error('Could not parse jison grammar\nError: ' + e.message);
            }
            err.stack = e.stack;
            throw err;
        }
    }

    if (typeof lexGrammarStr === 'string') {
        if (grammar.lex) {
            throw new Error('Cannot invoke with both a lexer section in the grammar input and a separate lexer input at the same time!');
        }

        try {
            if (options.json) {
                grammar.lex = json5.parse(lexGrammarStr);
            } else {
                grammar.lex = lexParser.parse(lexGrammarStr);
            }
        } catch (e) {
            if (options.json) {
                err = new Error('Could not parse lex grammar in JSON mode\nError: ' + e.message);
            } else {
                err = new Error('Could not parse lex grammar\nError: ' + e.message);
            }
            err.stack = e.stack;
            throw err;
        }
    }

    options = typal.camelMix.call({}, Jison.defaultJisonOptions, grammar.options, options);

    this.terms = {};
    this.operators = {};
    this.productions = [];
    this.conflicts = 0;
    this.resolutions = [];
    this.options = options;
    this.parseParams = grammar.parseParams;
    this.yy = {}; // accessed as yy free variable in the parser/lexer actions

    // calculate the input path; if none is specified, it's the present working directory
    var path = require('path');
    var inpath = options.file || options.outfile || './dummy';
    inpath = path.normalize(inpath);
    options.inputPath = path.dirname(inpath);

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
    if (this.DEBUG) {
        this.mix(generatorDebug); // mixin debug methods
        Jison.print('Grammar::OPTIONS:\n', this.options);
    }

    this.processGrammar(grammar);

    if (grammar.lex) {
        this.lexer = new Lexer(grammar.lex, null, this.terminals_);
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

    // detect unused productions and flag/report them
    this.signalUnusedProductions();
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

    // also export the grammar itself:
    this.grammar = grammar;
};

// Mark & report unused productions
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
    var unused_prods = [];
    for (var sym in mark) {
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
                unused_prods.push(p.toString());
            }
        });

        if (!in_use) {
            // and kill the unused nonterminals:
            delete this.nonterminals[sym];
        }
    }
    if (unused_prods.length) {
        console.warn('\nUnused productions in your grammar:\n  ' + unused_prods.join('\n  ') + '\n\n');
    }

    // and kill the unused productions:
    this.productions = productions.filter(function (p) {
        if (!p.reachable) console.warn('KILL UNUSED PRODUCTION: ' + p);
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
    var actions = [
      '/* this == yyval */',
      preprocessActionCode(this.actionInclude || ''),
      'switch (yystate) {'
    ];
    var actionGroups = {};          // used to combine identical actions into single instances: no use duplicating action code needlessly
    var actionGroupValue = {};      // stores the unaltered, expanded, user-defined action code for each action group.
    var prods, symbol;
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
            var symId = predefined_symbols[symbol];
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
            var symId = predefined_symbols[symbol];
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

    // Preprocess the action code block before we perform any `$n`, `@n` ,`\`n` or `#n` expansions:
    // Any comment blocks in there should be kept intact (and not cause trouble either as those comments MAY
    // contain `$`, `@`, `\`` or `#` prefixed bits which might look like references but aren't!)
    //
    // Also do NOT replace any $x, @x, \`x or #x macros inside any strings!
    //
    // Note:
    // We also replace '/*' comment markers which may (or may not) be lurking inside other comments.
    function preprocessActionCode(s) {
        function replace_markers(cmt) {
            cmt = cmt
            .replace(/#/g, '\x01\x01')
            .replace(/\$/g, '\x01\x02')
            .replace(/@/g, '\x01\x03')
            .replace(/\/\*/g, '\x01\x05')
            .replace(/\/\//g, '\x01\x06')
            .replace(/\'/g, '\x01\x07')
            .replace(/\"/g, '\x01\x08')
            .replace(/`/g, '\x01\x09')
            // and also whiteout any other macros we're about to expand in there:
            .replace(/\bYYABORT\b/g, '\x01\x14')
            .replace(/\bYYACCEPT\b/g, '\x01\x15')
            .replace(/\byyvstack\b/g, '\x01\x16')
            .replace(/\byylstack\b/g, '\x01\x17')
            .replace(/\byyerror\b/g, '\x01\x18')
            .replace(/\byyerrok\b/g, '\x01\x19')
            .replace(/\byyclearin\b/g, '\x01\x1A');

            return cmt;
        }

        s = s
        // do not trim any NEWLINES in the action block:
        .replace(/^\s+/, '')
        .replace(/\s+$/, '')
        // unify CR/LF combo's:
        .replace(/\r\n|\r/g, '\n')
        // replace any '$', '@' and '#' in any C++-style comment line to prevent them from being expanded as if they were part of the action code proper:
        .replace(/^\s*\/\/.+$/mg, function (_) {
            return replace_markers(_);
        })
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
        .replace(/\/\/[^'"\n]+$/mg, function (_) {
            return replace_markers(_);
        })
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
        .replace(/\x01\x04[\s\S]*?\*\//g, function (_) {
            return replace_markers(_);
        })
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
        .replace(/[^_a-zA-Z0-9\$\)\/][\s\n\r]*\/[^\n\/\*][^\n\/]*\//g, function (_) {
            return replace_markers(_);
        });

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
                .replace(/"[^"\n]*"/, function (_) {
                    return replace_markers(_);
                });
            } else if (sqpos === first) {
                s = s
                .replace(/'[^'\n]*'/, function (_) {
                    return replace_markers(_);
                });
            } else if (ccmtpos === first) {
                s = s
                .replace(/\/\*[\s\S]*?\*\//, function (_) {
                    return replace_markers(_);
                });
            } else if (cppcmtpos === first) {
                s = s
                .replace(/\/\/[^\n]*$/m, function (_) {
                    return replace_markers(_);
                });
            } else {
                break;
            }
        }
        // Presto!
        return s;
    }

    // Postprocess the action code block after we perform any `$n`, `@n` or `#n` expansions:
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
        .replace(/\x01\x09/g, '`')
        .replace(/\x01\x10/g, '\\\\')
        .replace(/\x01\x11/g, '\\\'')
        .replace(/\x01\x12/g, '\\\"')
        .replace(/\x01\x13/g, '\\\/')
        .replace(/\x01\x14/g, 'YYABORT')
        .replace(/\x01\x15/g, 'YYACCEPT')
        .replace(/\x01\x16/g, 'yyvstack')
        .replace(/\x01\x17/g, 'yylstack')
        .replace(/\x01\x18/g, 'yyerror')
        .replace(/\x01\x19/g, 'yyerrok')
        .replace(/\x01\x1A/g, 'yyclearin');
        return s;
    }

    // Strip off any insignificant whitespace from the user code to ensure that
    // otherwise identical actions are indeed matched up into a single actionGroup:
    function mkHashIndex(s) {
        return s.trim()
        .replace(/\s+$/mg, '')          // strip any trailing whitespace for each line of action code
        .replace(/^\s+/mg, '');         // ditto for leading whitespace for each line: we don't care about more or less clean indenting practices in the user code
    }

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

    function collectLiteralTokensInProduction(handle) {
        var r, rhs, i, sym;

        if (devDebug) Jison.print('\ncollectLiteralTokensInProduction: ', symbol, ':', JSON.stringify(handle, null, 2));

        if (handle.constructor === Array) {
            var rhs_i;
            rhs = (typeof handle[0] === 'string') ?
                      splitStringIntoSymbols(handle[0]) :
                      handle[0].slice(0);

            for (i = 0; i < rhs.length; i++) {
                sym = rhs[i];
                // check for aliased names, e.g., id[alias] and strip them
                rhs_i = sym.match(new XRegExp("\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]$"));
                if (rhs_i) {
                    sym = sym.substr(0, sym.length - rhs_i[0].length);
                }

                // assign the Unicode codepoint index to single-character *terminal* symbols?
                if (!bnf[sym] && sym.length === 1) {
                    addSymbol(sym);
                }
            }
        } else {
            // no action -> don't care about aliases; strip them.
            handle = handle.replace(new XRegExp("\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]", "g"), '');
            rhs = splitStringIntoSymbols(handle);
            for (i = 0; i < rhs.length; i++) {
                sym = rhs[i];
                // assign the Unicode codepoint index to single-character *terminal* symbols?
                if (!bnf[sym] && sym.length === 1) {
                    addSymbol(sym);
                }
            }
        }
    }

    // Before we go process the grammar for real, we collect the 'literal' non-terminals and add them to the symbol table
    // before all others: this way these tokens have the maximum chance to get assigned their ASCII value as symbol ID,
    // which helps debugging/diagnosis of generated grammars.
    // (This is why previously we had set `usedSymbolIdsLowIndex` to 127 instead of 3!)
    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        // do not add nonterminals to the symbol table yet!
        //addSymbol(symbol);
        if (typeof bnf[symbol] === 'string') {
            prods = bnf[symbol].split(/\s*\|\s*/g);
        } else {
            prods = bnf[symbol].slice(0);
        }
        if (devDebug) Jison.print('\ngenerator.buildProductions: ', symbol, JSON.stringify(prods, null, 2));

        prods.forEach(collectLiteralTokensInProduction);
    }

    // and now go and process the entire grammar:
    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        addSymbol(symbol);
        nonterminals[symbol] = new Nonterminal(symbol);

        if (typeof bnf[symbol] === 'string') {
            prods = bnf[symbol].split(/\s*\|\s*/g);
        } else {
            prods = bnf[symbol].slice(0);
        }

        prods.forEach(buildProduction);
    }
    for (var hash in actionGroups) {
        actions.push([].concat.apply([], actionGroups[hash]).join('') + actionGroupValue[hash] + '\n    break;\n');
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

    actions.push('}');

    var parameters = 'yytext, yyleng, yylineno, yyloc, yy, yystate /* action[1] */, $0, yyvstack, yylstack, yystack, yysstack';
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

    var actionsBaseline = [
        'function parser__PerformAction(' + parameters + ') {',
        '/* this == yyval */',
        '',
        'switch (yystate) {',
        '}',
        '}'
    ].join('\n');

    // report whether there are actually any custom actions at all (or any custom actions' prep code); this
    // flag will be set when the generated function is essentially *empty*:
    this.actionsAreAllDefault = (actionsBaseline.replace(/\s+/g, ' ') === this.performAction.replace(/\s+/g, ' '));

    this.actionsUseYYLENG = analyzeFeatureUsage(this.performAction, /\byyleng\b/g, 1);
    this.actionsUseYYLINENO = analyzeFeatureUsage(this.performAction, /\byylineno\b/g, 1);
    this.actionsUseYYTEXT = analyzeFeatureUsage(this.performAction, /\byytext\b/g, 1);
    this.actionsUseYYLOC = analyzeFeatureUsage(this.performAction, /\byyloc\b/g, 1);
    this.actionsUseParseError = analyzeFeatureUsage(this.performAction, /\.parseError\b/g, 0);
    this.actionsUseYYERROR = analyzeFeatureUsage(this.performAction, /\byyerror\b/g, 0);
    this.actionsUseYYERROK = analyzeFeatureUsage(this.performAction, /\byyerrok\b/g, 0);
    this.actionsUseYYCLEARIN = analyzeFeatureUsage(this.performAction, /\byyclearin\b/g, 0);
    // At this point in time, we have already expanded `$name`, `$$` and `$n` to its `$$[n]` index expression.
    //
    // Also cannot use regex `\b` with `\$` as the regex doesn't consider the literal `$` to be a *word* character
    // hence the *boundary check* `\b` won't deliver as expected. Hence we'll have to wing it but we can, assured
    // in the knowledge that the 'sourcecode' we have here is a complete generated *function* which will include
    // the `function ` prelude and `}` postlude at least! Hence we can replace `\b` with `[^\w]` and we'll be good.
    this.actionsUseValueTracking = analyzeFeatureUsage(this.performAction, /\byyvstack\b/g, 1);
    // Ditto for the specific case where we are assigning a value to `$$`:
    this.actionsUseValueAssignment = analyzeFeatureUsage(this.performAction, /\bthis\.\$[^\w]/g, 0);
    // Ditto for the expansion of `@name`, `@$` and `@n` to its `yylstack[n]` index expression:
    this.actionsUseLocationTracking = analyzeFeatureUsage(this.performAction, /\byylstack\b/g, 1);
    // Ditto for the specific case where we are assigning a value to `@$`:
    this.actionsUseLocationAssignment = analyzeFeatureUsage(this.performAction, /\bthis\._\$[^\w]/g, 0);
    // Note that the `#name`, `#$` and `#n` constructs are expanded directly to their symbol number without
    // the need to use yystack! Hence yystack is only there for very special use action code.)
    this.actionsUseYYSTACK = analyzeFeatureUsage(this.performAction, /\byystack\b/g, 1);
    // Ditto for yysstack...
    this.actionsUseYYSSTACK = analyzeFeatureUsage(this.performAction, /\byysstack\b/g, 1);

    if (devDebug) {
        Jison.print('Optimization analysis: ', {
            actionsAreAllDefault: this.actionsAreAllDefault,
            actionsUseYYLENG: this.actionsUseYYLENG,
            actionsUseYYLINENO: this.actionsUseYYLINENO,
            actionsUseYYTEXT: this.actionsUseYYTEXT,
            actionsUseYYLOC: this.actionsUseYYLOC,
            actionsUseParseError: this.actionsUseParseError,
            actionsUseYYERROR: this.actionsUseYYERROR,
            actionsUseYYERROK: this.actionsUseYYERROK,
            actionsUseYYCLEARIN: this.actionsUseYYCLEARIN,
            actionsUseValueTracking: this.actionsUseValueTracking,
            actionsUseValueAssignment: this.actionsUseValueAssignment,
            actionsUseLocationTracking: this.actionsUseLocationTracking,
            actionsUseLocationAssignment: this.actionsUseLocationAssignment,
            actionsUseYYSTACK: this.actionsUseYYSTACK,
            actionsUseYYSSTACK: this.actionsUseYYSSTACK,
            hasErrorRecovery: this.hasErrorRecovery
        });
    }

    this.performAction = this.performAction
    .replace(/\byyerror\b/g, 'yy.parser.parseError')
    .replace(/\byyerrok\b(?:\s*\(\s*\))?/g, 'yy.parser.yyErrOk()')
    .replace(/\byyclearin\b(?:\s*\(\s*\))?/g, 'yy.parser.yyClearIn()');

    // Now that we've completed all macro expansions, it's time to execute
    // the recovery code, i.e. the postprocess:
    this.performAction = postprocessActionCode(this.performAction);

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
            // As mentioned elsewhere in the code comments, we DO NOT cope with 'weird'
            // literal tokens which are designed to break this scheme, i.e. literals
            // containing *both* quote types, e.g. `rule: A '"\'' B;`
            //
            // Besides, those won't make it through the lexer unscathed either, given the
            // current STRING rules there: see `bnf.l`:
            //
            //      '"'[^"]+'"'             ... return 'STRING';
            //      "'"[^']+"'"             ... return 'STRING';
            //
            // so it's like Chamberlain said: we can all go back to sleep now. ;-)
            pos = rhs.indexOf(marker);
            if (pos < 0) {
                throw new Error('internal error parsing literal token(s) in grammar rule');
            }
            ls = rhs.substr(0, pos);
            // check for aliased literals, e.g., `'>'[gt]` and keep it and the alias together
            rhs = rhs.substr(pos + 1);
            var alias = rhs.match(new XRegExp("^\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]"));
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

    function provideSymbolAsSourcecode(sym) {
        var ss = String(sym);
        return ' /* ' + postprocessComment(ss) + ' */ ' + addSymbol(sym);
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

    function buildProduction(handle) {
        var r, rhs, i,
            precedence_override;

        if (devDebug) Jison.print('\nbuildProduction: ', symbol, ':', JSON.stringify(handle, null, 2));

        if (handle.constructor === Array) {
            var aliased = [],
                rhs_i;
            rhs = (typeof handle[0] === 'string') ?
                      splitStringIntoSymbols(handle[0]) :
                      handle[0].slice(0);

            for (i = 0; i < rhs.length; i++) {
                // check for aliased names, e.g., id[alias] and strip them
                rhs_i = rhs[i].match(new XRegExp("\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]$"));
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
                addSymbol(rhs[i]);
            }

            assert(handle.length === 3 ? typeof handle[1] === 'string' : true);
            if (typeof handle[1] === 'string') {
                // semantic action specified
                var label = [
                    'case ', productions.length + 1, ':',
                    '\n    /*! Production::    ', postprocessComment(symbol), ' : '
                ].concat(postprocessComment(handle[0]), ' */\n');
                var action = preprocessActionCode(handle[1]);
                var actionHash;
                var rule4msg = symbol + ': ' + rhs.join(' ');

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
                if (action.match(new XRegExp("[$@#`][\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*"))) {
                    var count = {},
                        names = {};

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
                    var addName = function addName(s) {
                        if (names[s]) {
                            names[s + (++count[s])] = i + 1;
                        } else {
                            names[s] = i + 1;
                            names[s + '1'] = i + 1;
                            count[s] = 1;
                        }
                    };

                    for (i = 0; i < rhs.length; i++) {
                        // check for aliased names, e.g., id[alias]
                        rhs_i = aliased[i];
                        addName(rhs_i);
                        if (rhs_i !== rhs[i]) {
                            addName(rhs[i]);
                        }
                    }
                    action = action.replace(
                        new XRegExp("([$@#`])([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)", "g"), function (str, mrkr, pl) {
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
                    .replace(/`\$/g, function (_) {
                        return '$0';
                    })
                    // replace semantic value references ($n) with stack value (stack[n])
                    .replace(/\$(-?\d+)\b/g, function (_, n) {
                        return 'yyvstack[$0' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
                    })
                    // same as above for location references (@n)
                    .replace(/@(-?\d+)\b/g, function (_, n) {
                        return 'yylstack[$0' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
                    })
                    // same as above for token ID references (#n)
                    .replace(/#(-?\d+)\b/g, function (_, n) {
                        var i = parseInt(n, 10) - 1;
                        if (!rhs[i]) {
                            throw new Error('invalid token location reference in action code for rule: "' + rule4msg + '" - location reference: "' + _ + '"');
                        }
                        return provideSymbolAsSourcecode(rhs[i]);
                    })
                    // replace positional value references (\`n) with stack index
                    .replace(/`(-?\d+)\b/g, function (_, n) {
                        return '($0' + indexToJsExpr(n, rhs.length, rule4msg) + ')';
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
            handle = handle.replace(new XRegExp("\\[[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*\\]", "g"), '');
            rhs = splitStringIntoSymbols(handle);
            for (i = 0; i < rhs.length; i++) {
                if (rhs[i] === 'error') {
                    hasErrorRecovery = true;
                }
                addSymbol(rhs[i]);
            }
        }

        r = new Production(symbol, rhs, productions.length + 1);

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
                    self.warn('Ambiguous rule precedence in grammar: picking the (highest) precedence from operator "' + winning_symbol + '" for rule "' + symbol + ': ' + handle[0] + '" which contains multiple operators with different precedences: {' + prec_symbols.join(', ') + '}');
                }
            }
        }

        productions.push(r);
        productions_.push([symbols_[r.symbol], r.handle[0] === '' ? 0 : r.handle.length]);
        nonterminals[symbol].productions.push(r);
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
        // self.trace('Symbol/Follows: ', 'prod:' + k, ':', production.symbol, ' :: ', production.handle.join(' '), '  --> ', nonterminals[production.symbol].follows.join(', '));
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
            if (devDebug > 3) self.trace('Symbol/Follows: ', 'round:' + count, 'prod:' + k, ':', production.symbol, ' --> ', nonterminals[production.symbol].follows.join(', '));

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

    if (this.DEBUG) {
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

lrGeneratorMixin.buildTable = function buildTable() {
    if (this.DEBUG) {
        this.mix(lrGeneratorDebug); // mixin debug methods
    }

    this.states = this.canonicalCollection();

    if (this.DEBUG) {
        Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER canonicalCollection:");
        this.displayFollowSets();
        Jison.print("\n");
    }

    this.table = this.parseTable(this.states);

    if (this.DEBUG) {
        Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable:");
        this.displayFollowSets();
        Jison.print("\n");
    }

    this.defaultActions = findDefaults(this.table);
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

    return gotoSet.isEmpty() ? gotoSet : this.closureOperation(gotoSet);
};

/*
 * Create unique set of item sets
 */
lrGeneratorMixin.canonicalCollection = function canonicalCollection() {
    var item1 = new this.Item(this.productions[0], 0, [this.EOF]);
    var firstState = this.closureOperation(new this.ItemSet(item1)),
        states = new Set(firstState),
        marked = 0,
        self = this,
        itemSet;

    states.has = {};
    states.has[firstState] = 0;

    if (devDebug > 0) Jison.print('canonicalCollection: ', states.has);

    while (marked !== states.size()) {
        itemSet = states.item(marked);
        itemSet.forEach(function CC_itemSet_forEach(item) {
            if (item.markedSymbol && item.markedSymbol !== self.EOF) {
                self.canonicalCollectionInsert(item.markedSymbol, itemSet, states, marked);
            }
        });
        marked++;
    }

    return states;
};

// Pushes a unique state into the queue. Some parsing algorithms may perform additional operations
lrGeneratorMixin.canonicalCollectionInsert = function canonicalCollectionInsert(symbol, itemSet, states, stateNum) {
    var g = this.gotoOperation(itemSet, symbol);
    if (!g.predecessors) {
        g.predecessors = {};
    }
    // add g to queue if not empty or duplicate
    if (!g.isEmpty()) {
        var gv = g.valueOf(),
            i = states.has[gv];
        if (i === -1 || typeof i === 'undefined') {
            states.has[gv] = states.size();
            itemSet.edges[symbol] = states.size(); // store goto transition for table
            states.push(g);
            g.predecessors[symbol] = [stateNum];
        } else {
            itemSet.edges[symbol] = i; // store goto transition for table
            states.item(i).predecessors[symbol].push(stateNum);
        }
    }
};

var NONASSOC = 0;

lrGeneratorMixin.parseTable = function lrParseTable(itemSets) {
    var states = [],
        nonterminals = this.nonterminals,
        operators = this.operators,
        conflictedStates = {}, // array of [state, token] tuples
        self = this,
        s = 1, // shift
        r = 2, // reduce
        a = 3; // accept

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
                        state[self.symbols_[stackSymbol]] = [s, gotoState];
                    }
                }
            });
        }

        // set accept action
        itemSet.forEach(function setAcceptAction(item, j) {
            if (item.markedSymbol === self.EOF) {
                // accept
                state[self.symbols_[self.EOF]] = [a];
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
                    var sol = resolveConflict(item.production, op, [r, item.production.id], action[0] instanceof Array ? action[0] : action);
                    self.resolutions.push([k, stackSymbol, sol]);
                    if (sol.bydefault) {
                        self.conflicts++;

                        self.warn('Conflict in grammar: multiple actions possible when lookahead token is ', stackSymbol, ' in state ', k, '\n- ', printAction(sol.r, self), '\n- ', printAction(sol.s, self), '\n  (', sol.msg, ')');
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
                    action = [r, item.production.id];
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

    if (self.conflicts > 0) {
        self.warn('\nStates with conflicts:');
        each(conflictedStates, function report_conflict_state(val, state) {
            self.warn('\nState ' + state, '    (' + val.symbol + ' @ ' + val.reduction.production.symbol + ' -> ' + val.reduction.handleToString() + ')\n');
            self.warn('  ', itemSets.item(state).join('\n  '));
        });
        self.warn('\n');
    }

    return states;
};

// find states with only one action, a reduction
function findDefaults(states) {
    var defaults = {};
    states.forEach(function (state, k) {
        var act;
        var i = 0;

        for (act in state) {
             assert({}.hasOwnProperty.call(state, act));    // it this isn't true, the last part of this function won't work!
             i++;
        }

        if (i === 1 && state[act][0] === 2) {
            // only one action in state and it's a reduction; hence we only need to store the new (goto) state:
            defaults[k] = state[act][1];
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
        },
        s = 1, // shift
        r = 2, // reduce
        a = 3; // accept

    if (shift[0] === r) {
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

function generateGenericHeaderComment() {
    var out = '/* parser generated by jison ' + version + ' */\n'
        + '/*\n'
        + ' * Returns a Parser object of the following structure:\n'
        + ' *\n'
        + ' *  Parser: {\n'
        + ' *    yy: {}     The so-called "shared state" or rather the *source* of it;\n'
        + ' *               the real "shared state" `yy` passed around to\n'
        + ' *               the rule actions, etc. is a derivative/copy of this one,\n'
        + ' *               not a direct reference!\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  Parser.prototype: {\n'
        + ' *    yy: {},\n'
        + ' *    EOF: 1,\n'
        + ' *    TERROR: 2,\n'
        + ' *\n'
        + ' *    trace: function(errorMessage, ...),\n'
        + ' *\n'
        + ' *    JisonParserError: function(msg, hash),\n'
        + ' *\n'
        + ' *    quoteName: function(name),\n'
        + ' *               Helper function which can be overridden by user code later on: put suitable\n'
        + ' *               quotes around literal IDs in a description string.\n'
        + ' *\n'
        + ' *    originalQuoteName: function(name),\n'
        + ' *               The basic quoteName handler provided by JISON.\n'
        + ' *               `cleanupAfterParse()` will clean up and reset `quoteName()` to reference this function\n'
        + ' *               at the end of the `parse()`.\n'
        + ' *\n'
        + ' *    describeSymbol: function(symbol),\n'
        + ' *               Return a more-or-less human-readable description of the given symbol, when\n'
        + ' *               available, or the symbol itself, serving as its own \'description\' for lack\n'
        + ' *               of something better to serve up.\n'
        + ' *\n'
        + ' *               Return NULL when the symbol is unknown to the parser.\n'
        + ' *\n'
        + ' *    symbols_: {associative list: name ==> number},\n'
        + ' *    terminals_: {associative list: number ==> name},\n'
        + ' *    nonterminals: {associative list: rule-name ==> {associative list: number ==> rule-alt}},\n'
        + ' *    terminal_descriptions_: (if there are any) {associative list: number ==> description},\n'
        + ' *    productions_: [...],\n'
        + ' *\n'
        + ' *    performAction: function parser__performAction(yytext, yyleng, yylineno, yyloc, yy, yystate, $0, yyvstack, yylstack, yystack, yysstack, ...),\n'
        + ' *               where `...` denotes the (optional) additional arguments the user passed to\n'
        + ' *               `parser.parse(str, ...)`\n'
        + ' *\n'
        + ' *    table: [...],\n'
        + ' *               State transition table\n'
        + ' *               ----------------------\n'
        + ' *\n'
        + ' *               index levels are:\n'
        + ' *               - `state`  --> hash table\n'
        + ' *               - `symbol` --> action (number or array)\n'
        + ' *\n'
        + ' *                 If the `action` is an array, these are the elements\' meaning:\n'
        + ' *                 - index [0]: 1 = shift, 2 = reduce, 3 = accept\n'
        + ' *                 - index [1]: GOTO `state`\n'
        + ' *\n'
        + ' *                 If the `action` is a number, it is the GOTO `state`\n'
        + ' *\n'
        + ' *    defaultActions: {...},\n'
        + ' *\n'
        + ' *    parseError: function(str, hash),\n'
        + ' *    yyErrOk: function(),\n'
        + ' *    yyClearIn: function(),\n'
        + ' *\n'
        + ' *    constructParseErrorInfo: function(error_message, exception_object, expected_token_set, is_recoverable),\n'
        + ' *               Helper function **which will be set up during the first invocation of the `parse()` method**.\n'
        + ' *               Produces a new errorInfo \'hash object\' which can be passed into `parseError()`.\n'
        + ' *               See it\'s use in this parser kernel in many places; example usage:\n'
        + ' *\n'
        + ' *                   var infoObj = parser.constructParseErrorInfo(\'fail!\', null,\n'
        + ' *                                     parser.collect_expected_token_set(state), true);\n'
        + ' *                   var retVal = parser.parseError(infoObj.errStr, infoObj);\n'
        + ' *\n'
        + ' *    originalParseError: function(str, hash),\n'
        + ' *               The basic parseError handler provided by JISON.\n'
        + ' *               `cleanupAfterParse()` will clean up and reset `parseError()` to reference this function\n'
        + ' *               at the end of the `parse()`.\n'
        + ' *\n'
        + ' *    options: { ... parser %options ... },\n'
        + ' *\n'
        + ' *    parse: function(input[, args...]),\n'
        + ' *               Parse the given `input` and return the parsed value (or `true` when none was provided by\n'
        + ' *               the root action, in which case the parser is acting as a *matcher*).\n'
        + ' *               You MAY use the additional `args...` parameters as per `%parse-param` spec of this grammar:\n'
        + ' *               these extra `args...` are passed verbatim to the grammar rules\' action code.\n'
        + ' *\n'
        + ' *    cleanupAfterParse: function(resultValue, invoke_post_methods),\n'
        + ' *               Helper function **which will be set up during the first invocation of the `parse()` method**.\n'
        + ' *               This helper API is invoked at the end of the `parse()` call, unless an exception was thrown\n'
        + ' *               and `%options no-try-catch` has been defined for this grammar: in that case this helper MAY\n'
        + ' *               be invoked by calling user code to ensure the `post_parse` callbacks are invoked and\n'
        + ' *               the internal parser gets properly garbage collected under these particular circumstances.\n'
        + ' *\n'
        + ' *    lexer: {\n'
        + ' *        yy: {...},           A reference to the so-called "shared state" `yy` once\n'
        + ' *                             received via a call to the `.setInput(input, yy)` lexer API.\n'
        + ' *        EOF: 1,\n'
        + ' *        ERROR: 2,\n'
        + ' *        JisonLexerError: function(msg, hash),\n'
        + ' *        parseError: function(str, hash),\n'
        + ' *        setInput: function(input, [yy]),\n'
        + ' *        input: function(),\n'
        + ' *        unput: function(str),\n'
        + ' *        more: function(),\n'
        + ' *        reject: function(),\n'
        + ' *        less: function(n),\n'
        + ' *        pastInput: function(n),\n'
        + ' *        upcomingInput: function(n),\n'
        + ' *        showPosition: function(),\n'
        + ' *        test_match: function(regex_match_array, rule_index),\n'
        + ' *        next: function(),\n'
        + ' *        lex: function(),\n'
        + ' *        begin: function(condition),\n'
        + ' *        pushState: function(condition),\n'
        + ' *        popState: function(),\n'
        + ' *        topState: function(),\n'
        + ' *        _currentRules: function(),\n'
        + ' *        stateStackSize: function(),\n'
        + ' *\n'
        + ' *        options: { ... lexer %options ... },\n'
        + ' *\n'
        + ' *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),\n'
        + ' *        rules: [...],\n'
        + ' *        conditions: {associative list: name ==> set},\n'
        + ' *    }\n'
        + ' *  }\n'
        + ' *\n'
        + ' *\n'
        + ' *  token location info (@$, _$, etc.): {\n'
        + ' *    first_line: n,\n'
        + ' *    last_line: n,\n'
        + ' *    first_column: n,\n'
        + ' *    last_column: n,\n'
        + ' *    range: [start_number, end_number]\n'
        + ' *               (where the numbers are indexes into the input string, zero-based)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * ---\n'
        + ' *\n'
        + ' * The parseError function receives a \'hash\' object with these members for lexer and\n'
        + ' * parser errors:\n'
        + ' *\n'
        + ' *  {\n'
        + ' *    text:        (matched text)\n'
        + ' *    token:       (the produced terminal token, if any)\n'
        + ' *    token_id:    (the produced terminal token numeric ID, if any)\n'
        + ' *    line:        (yylineno)\n'
        + ' *    loc:         (yylloc)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * parser (grammar) errors will also provide these additional members:\n'
        + ' *\n'
        + ' *  {\n'
        + ' *    expected:    (array describing the set of expected tokens;\n'
        + ' *                  may be UNDEFINED when we cannot easily produce such a set)\n'
        + ' *    state:       (integer (or array when the table includes grammar collisions);\n'
        + ' *                  represents the current internal state of the parser kernel.\n'
        + ' *                  can, for example, be used to pass to the `collect_expected_token_set()`\n'
        + ' *                  API to obtain the expected token set)\n'
        + ' *    action:      (integer; represents the current internal action which will be executed)\n'
        + ' *    new_state:   (integer; represents the next/planned internal state, once the current\n'
        + ' *                  action has executed)\n'
        + ' *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule\n'
        + ' *                  available for this particular error)\n'
        + ' *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    value_stack: (array: the current parser LALR/LR internal `$$` value stack; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    yy:          (object: the current parser internal "shared state" `yy`\n'
        + ' *                  as is also available in the rule actions; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    lexer:       (reference to the current lexer instance used by the parser)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * while `this` will reference the current parser instance.\n'
        + ' *\n'
        + ' *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser*\n'
        + ' *  instance, while these additional `hash` fields will also be provided:\n'
        + ' *\n'
        + ' *  {\n'
        + ' *    lexer:       (reference to the current lexer instance which reported the error)\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  When `parseError` is invoked by the parser due to a **JavaScript exception** being fired\n'
        + ' *  from either the parser or lexer, `this` will still reference the related *parser*\n'
        + ' *  instance, while these additional `hash` fields will also be provided:\n'
        + ' *\n'
        + ' *  {\n'
        + ' *    exception:   (reference to the exception thrown)\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  Please do note that in the latter situation, the `expected` field will be omitted as\n'
        + ' *  type of failure is assumed not to be due to *parse errors* but rather due to user\n'
        + ' *  action code in either parser or lexer failing unexpectedly.\n'
        + ' *\n'
        + ' * ---\n'
        + ' *\n'
        + ' * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.\n'
        + ' * These options are available:\n'
        + ' *\n'
        + ' * ### options which are global for all parser instances\n'
        + ' *\n'
        + ' *  Parser.pre_parse: function(yy [, optional parse() args])\n'
        + ' *                 optional: you can specify a pre_parse() function in the chunk following\n'
        + ' *                 the grammar, i.e. after the last `%%`.\n'
        + ' *  Parser.post_parse: function(yy, retval [, optional parse() args]) { return retval; }\n'
        + ' *                 optional: you can specify a post_parse() function in the chunk following\n'
        + ' *                 the grammar, i.e. after the last `%%`. When it does not return any value,\n'
        + ' *                 the parser will return the original `retval`.\n'
        + ' *\n'
        + ' * ### options which can be set up per parser instance\n'
        + ' *  \n'
        + ' *  yy: {\n'
        + ' *      pre_parse:  function(yy [, optional parse() args])\n'
        + ' *                 optional: is invoked before the parse cycle starts (and before the first\n'
        + ' *                 invocation of `lex()`) but immediately after the invocation of\n'
        + ' *                 `parser.pre_parse()`).\n'
        + ' *      post_parse: function(yy, retval [, optional parse() args]) { return retval; }\n'
        + ' *                 optional: is invoked when the parse terminates due to success (\'accept\')\n'
        + ' *                 or failure (even when exceptions are thrown).\n'
        + ' *                 `retval` contains the return value to be produced by `Parser.parse()`;\n'
        + ' *                 this function can override the return value by returning another. \n'
        + ' *                 When it does not return any value, the parser will return the original\n'
        + ' *                 `retval`. \n'
        + ' *                 This function is invoked immediately before `Parser.post_parse()`.\n'
        + ' *\n'
        + ' *      parseError: function(str, hash)\n'
        + ' *                 optional: overrides the default `parseError` function.\n'
        + ' *      quoteName: function(name),\n'
        + ' *                 optional: overrides the default `quoteName` function.\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  parser.lexer.options: {\n'
        + ' *      pre_lex:  function()\n'
        + ' *                 optional: is invoked before the lexer is invoked to produce another token.\n'
        + ' *                 `this` refers to the Lexer object.\n'
        + ' *      post_lex: function(token) { return token; }\n'
        + ' *                 optional: is invoked when the lexer has produced a token `token`;\n'
        + ' *                 this function can override the returned token value by returning another.\n'
        + ' *                 When it does not return any (truthy) value, the lexer will return\n'
        + ' *                 the original `token`.\n'
        + ' *                 `this` refers to the Lexer object.\n'
        + ' *\n'
        + ' *      ranges: boolean\n'
        + ' *                 optional: `true` ==> token location info will include a .range[] member.\n'
        + ' *      flex: boolean\n'
        + ' *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested\n'
        + ' *                 exhaustively to find the longest match.\n'
        + ' *      backtrack_lexer: boolean\n'
        + ' *                 optional: `true` ==> lexer regexes are tested in order and for invoked;\n'
        + ' *                 the lexer terminates the scan when a token is returned by the action code.\n'
        + ' *      xregexp: boolean\n'
        + ' *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the\n'
        + ' *                 `XRegExp` library. When this %option has not been specified at compile time, all lexer\n'
        + ' *                 rule regexes have been written as standard JavaScript RegExp expressions.\n'
        + ' *  }\n'
        + ' */\n';

    return out;
}

/*
 * Mixin for common LR/LL/*any* parser behavior
 */
var generatorMixin = {};

// internal helper function:
generatorMixin.__prepareOptions = function parser___prepare_Options(opt) {
    opt = typal.camelMix.call({}, Jison.defaultJisonOptions, this.options, opt);
    this.options = opt;
    this.DEBUG = !!opt.debug;
    if (this.DEBUG && devDebug) {
        Jison.print('GENERATE::OPTIONS:\n', this.options);
    }

    // check for illegal identifier
    if (!opt.moduleName || !opt.moduleName.match(/^[a-zA-Z_$][a-zA-Z0-9_$\.]*$/)) {
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
        opt.moduleName = 'parser';
    }
    return opt;
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
        generateGenericHeaderComment(),
        '',
        'define(function (require) {',
        module.commonCode,
        '',
        'var parser = ' + module.moduleCode,
        module.modulePostlude,
        this.moduleInclude
    ];
    if (this.lexer && this.lexer.generateModule) {
      out.push(this.lexer.generateModule());
      out.push('parser.lexer = lexer;');
      if (this.options.ranges) {
        out.push('parser.lexer.options.ranges = true;');
      }
    }
    out.push('return parser;');
    out.push('});');

    return out.join('\n') + '\n';
};

lrGeneratorMixin.generateESModule = function generateESModule(opt){
    opt = this.__prepareOptions(opt);

    var module = this.generateModule_();
    var out = [
        generateGenericHeaderComment(),
        '',
        module.commonCode,
        '',
        'var parser = ' + module.moduleCode,
        module.modulePostlude,
        this.moduleInclude
    ];
    if (this.lexer && this.lexer.generateModule) {
      out.push(this.lexer.generateModule());
      out.push('parser.lexer = lexer;');
      if (this.options.ranges) {
        out.push('parser.lexer.options.ranges = true;');
      }
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
    var out = generateGenericHeaderComment();

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
        this.moduleInclude
    ];
    if (this.lexer && this.lexer.generateModule) {
        out.push(this.lexer.generateModule());
        out.push('parser.lexer = lexer;');
        if (this.options.ranges) {
            out.push('parser.lexer.options.ranges = true;');
        }
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
        //    if (typeof lexer.yylloc === 'undefined') {
        //        lexer.yylloc = {};
        //    }
        //    var yyloc = lexer.yylloc;
        //    lstack[sp] = yyloc;
        //    ...
        //        lstack[sp] = lexer.yylloc;
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
        .replace(/^.*?\byylloc\b.*?$/gm, '');
    }

    if (!info.actionsUseValueTracking && !info.actionsUseValueAssignment) {
        actionFn = actionFn
        .replace(/, yyvstack\b/g, '');

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
        .replace(/, vstack\b/g, '')
        .replace(/^.*?\bvstack\b.*$/gm, '');
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
        .replace(/^.*?\byydebug\b.*?$/gm, '');
    }

    if (!info.actionsUseYYERROK) {
        /*
         * Kill this code:
         *
         *       if (this.yyErrOk === 1) {
         *           this.yyErrOk = function yyErrOk() {
         *               recovering = 0;
         *           };
         *       }
         */
        parseFn = parseFn
        .replace(/\s+if \(this\.yyErrOk === 1\) \{[^\0]+?\};\n\s+\}\n/g, '\n\n\n\n\n');
    }

    if (!info.actionsUseYYCLEARIN) {
        parseFn = parseFn
        .replace(/\s+if \(this\.yyClearIn === 1\) \{[^\0]+?\};\n\s+\}\n/g, '\n\n\n\n\n\n');
    }

    if (info.options.noDefaultAction) {
        /*
         * Kill this code:
         *
         *     // perform semantic action
         *     yyval.$ = vstack[sp - len]; // default to $$ = $1
         */
        parseFn = parseFn
        .replace(/\s+\/\/ perform semantic action\n\s+yyval\.\$ = vstack\[sp - [^\n]+\n/g, '\n\n');
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
         *         retval = this.cleanupAfterParse(retval, true);       // <-- keep this line
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

    // and finally strip out the hacks which were only there to stop strict JS engines barfing on us: jison.js itself!
    parseFn = parseFn
    .replace(/\s+\/\/ SHA-1: c4ea524b22935710d98252a1d9e04ddb82555e56[^;]+;/g, '');

    info.performAction = actionFn;

    return parseFn;
}

function removeFeatureMarkers(fn) {
    var parseFn = fn;
    parseFn = parseFn.replace(/^\s*_handle_error_[a-z_]+:.*$/gm, '').replace(/\\\\n/g, '\\n');
    parseFn = parseFn.replace(/^\s*_lexer_[a-z_]+:.*$/gm, '').replace(/\\\\n/g, '\\n');
    return parseFn;
}

function pickOneOfTwoCodeAlternatives(parseFn, pick_A_not_B, A_start_marker, B_start_marker, end_marker) {
    // Notes:
    // 1) we use the special /[^\0]*/ regex set as that one will also munch newlines, etc.
    //    while the obvious /.*/ does not as '.' doesn't eat the newlines.
    // 2) The end sentinel label is kept intact as we have another function
    //    removeFeatureMarkers() which nukes that line properly, i.e. including the trailing comment!
    if (pick_A_not_B) {
        // kill section B
        return parseFn.replace(new RegExp(B_start_marker + ':[^\\0]*?(' + end_marker + ':)', 'g'), '$1');
    } else {
        // kill section A
        return parseFn.replace(new RegExp(A_start_marker + ':[^\\0]*?(' + B_start_marker + ':)', 'g'), '$1');
    }
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
    parseFn = pickOneOfTwoCodeAlternatives(parseFn, !wantTokenStack, '_lexer_without_token_stack', '_lexer_with_token_stack', '_lexer_with_token_stack_end');
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
    parseFn = pickOneOfTwoCodeAlternatives(parseFn, hasErrorRecovery, '_handle_error_with_recovery', '_handle_error_no_recovery', '_handle_error_end_of_section');
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
        .replace(/^\s+(?:var )?preErrorSymbol = .*$/gm, '');
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

    // always remove the feature markers in the template code.
    parseFn = removeFeatureMarkers(parseFn);

    parseFn = removeUnusedKernelFeatures(parseFn, this);

    // fill in the optional, extra parse parameters (`%parse-param ...`)
    // in the generated parser:
    if (!this.parseParams) {
        parseFn = parseFn.replace(/, parseParams/g, '');
    } else {
        parseFn = parseFn.replace(/, parseParams/g, ', ' + this.parseParams.join(', '));
    }

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
        tableCode = this.generateTableCode2(this.table, this.defaultActions, this.productions_);
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
            var lst = prods.rules[nonterm];
            var chk = rv.symbol + ' : ' + rv.handle;
            for (var idx in lst) {
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
            var chk = rv.base_symbol + ' : ' + rv.base_handle;
            if (base && base.rules) {
                var pr = base.rules[rv.base_symbol];
                for (var idx in pr) {
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
        for (var sbn in nt) {
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
        for (var sbn in prods.first) {
            prods.first[sbn] = get_orig_symbol_set(prods.first[sbn]);
        }
        for (var sbn in prods.follows) {
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
          // type: 1,
          debug: !opts.debug,     // do not include this item when it is FALSE as there's no debug tracing built into the generated grammar anyway!
          json: 1,
          _: 1,
          noMain: 1,
          noDefaultResolve: 1,
          noDefaultAction: 1,
          noTryCatch: 1,
          compressTables: 1,
          outputDebugTables: 1,
          file: 1,
          outfile: 1,
          inputPath: 1,
          lexfile: 1,
          moduleName: 1,
          moduleType: 1,
          exportAllTables: 1,
        };
        for (var k in opts) {
            if (!do_not_pass[k]) {
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

        var pre = obj.pre_parse;
        var post = obj.post_parse;
        // since JSON cannot encode functions, we'll have to do it manually at run-time, i.e. later on:
        obj.pre_parse = (pre ? true : undefined);
        obj.post_parse = (post ? true : undefined);

        var js = JSON.stringify(obj, null, 2);

        js = js.replace(new XRegExp("  \"([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)\": ", "g"), '  $1: ');
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

    var moduleCode = '{\n';
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
        'productions_: ' + tableCode.productionsCode,
        'performAction: ' + String(this.performAction),
        'table: ' + tableCode.tableCode,
        'defaultActions: ' + tableCode.defaultActionsCode,
        'parseError: ' + String(this.parseError || parser.parseError),
        'parse: ' + parseFn
    ]).concat(
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

    var t = new JisonParserError('test', 42);
    assert(t instanceof Error);
    assert(t instanceof JisonParserError);
    assert(t.hash === 42);
    assert(t.message === 'test');
    assert(t.toString() === 'JisonParserError: test');

    var t2 = new Error('a');
    var t3 = new JisonParserError('test', { exception: t2 });
    assert(t2 instanceof Error);
    assert(!(t2 instanceof JisonParserError));
    assert(t3 instanceof Error);
    assert(t3 instanceof JisonParserError);
    assert(!t2.hash);
    assert(t3.hash);
    assert(t3.hash.exception);
    assert(t2.message === 'a');
    assert(t3.message === 'a');
    assert(t2.toString() === 'Error: a');
    assert(t3.toString() === 'JisonParserError: a');

    var prelude = [
        '// See also:',
        '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508',
        '// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility',
        '// with userland code which might access the derived class in a \'classic\' way.',
        String(JisonParserError).replace(/^    /gm, ''),
        printFunctionSourceCode(__extra_code__).replace(/^    /gm, '').replace(/function [^\{]+\{/, '').replace(/\}$/, ''),
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

    tableCode = (devDebug ? reportColumnsForCompression(tableDef) : '') + (compressGotoTable ? tc : tableCode);
    defaultActionsCode = (devDebug ? reportColumnsForCompression(defaultActionsDef) : '') + (compressDefaultActions ? dac : defaultActionsCode);
    productionsCode = (devDebug ? reportColumnsForCompression(productionsDef) : '') + (compressProductions ? pc : productionsCode);


    var prelude = [
        '',
        compressProductions ? '// helper: reconstruct the productions[] table\n' + printFunctionSourceCode(bp) : '',
        '',
        compressDefaultActions ? '// helper: reconstruct the defaultActions[] table\n' + printFunctionSourceCode(bda) : '',
        '',
        compressGotoTable ? '// helper: reconstruct the \'goto\' table\n' + printFunctionSourceCode(bt) : '',
        '',
        '// helper: runlength encoding with increment step: code, length: step (default step = 0)',
        '// `this` references an array',
        printFunctionSourceCode(s),
        '',
        '// helper: duplicate sequence from *relative* offset and length.',
        '// `this` references an array',
        printFunctionSourceCode(c),
        '',
        '// helper: unpack an array using helpers and data, all passed in an array argument \'a\'.',
        printFunctionSourceCode(u)
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
    var s = a[0] == 1 ? 'shift token (then go to state ' + a[1] + ')' :
        a[0] == 2 ? 'reduce by rule: ' + gen.productions[a[1]] :
                    'accept';

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
    var p = eval(sourcecode);

    // for debugging
    p.productions = this.productions;

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

    return p;
};

parser.trace = generator.trace;
parser.warn = generator.warn;
parser.error = generator.error;

function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
        hash.destroy();             // destroy... well, *almost*!
        // assert('recoverable' in hash);
    } else {
        throw new this.JisonParserError(str, hash);
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

        __reentrant_call_depth: 0,       // INTERNAL USE ONLY

        // APIs which will be set up depending on user action code analysis:
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

    var sharedState = {
      yy: {
        parseError: null,
        quoteName: null,
        lexer: null,
        parser: null,
        pre_parse: null,
        post_parse: null
      }
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;

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
            obj.token_stack = stack;
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
                        re1 = new XRegExp("  \"([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)\": ", "g");
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

    if (this.yyErrOk === 1) {
        this.yyErrOk = function yyErrOk() {
            recovering = 0;
        };
    }

    if (this.yyClearIn === 1) {
        this.yyClearIn = function yyClearIn() {
            if (symbol === TERROR) {
                symbol = 0;
                yytext = null;
                yyleng = 0;
                yyloc = null;
            }
            preErrorSymbol = 0;
        };
    }

    lexer.setInput(input, sharedState.yy);

    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack[sp] = yyloc;
    vstack[sp] = null;
    sstack[sp] = 0;
    stack[sp] = 0;
    ++sp;

    if (typeof lexer.yytext === 'undefined') {
        lexer.yytext = '';
    }
    var yytext = lexer.yytext;
    if (typeof lexer.yylineno === 'undefined') {
        lexer.yylineno = 0;
    }
    var yylineno = lexer.yylineno;
    if (typeof lexer.yyleng === 'undefined') {
        lexer.yyleng = 0;
    }
    var yyleng = lexer.yyleng;

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = this.originalParseError;
    }

    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState.yy.quoteName === 'function') {
        this.quoteName = sharedState.yy.quoteName;
    } else {
        this.quoteName = this.originalQuoteName;
    }

    // set up the cleanup function; make it an API so that external code can re-use this one in case of
    // calamities or when the `%options no-try-catch` option has been specified for the grammar, in which
    // case this parse() API method doesn't come with a `finally { ... }` block any more!
    //
    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `sharedState`, etc. references will be *wrong*!
    this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods) {
        var rv;

        if (invoke_post_methods) {
            if (sharedState.yy.post_parse) {
                rv = sharedState.yy.post_parse.call(this, sharedState.yy, resultValue, parseParams);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
            if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState.yy, resultValue, parseParams);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
        }

        if (this.__reentrant_call_depth > 1) return resultValue;        // do not (yet) kill the sharedState when this is a reentrant run.

        // prevent lingering circular references from causing memory leaks:
        if (sharedState.yy) {
            sharedState.yy.parseError = undefined;
            sharedState.yy.quoteName = undefined;
            sharedState.yy.lexer = undefined;
            sharedState.yy.parser = undefined;
            if (lexer.yy === sharedState.yy) {
                lexer.yy = undefined;
            }
        }
        sharedState.yy = undefined;
        this.parseError = this.originalParseError;
        this.quoteName = this.originalQuoteName;

        // nuke the vstack[] array at least as that one will still reference obsoleted user values.
        // To be safe, we nuke the other internal stack columns as well...
        stack.length = 0;               // fastest way to nuke an array without overly bothering the GC
        sstack.length = 0;
        lstack.length = 0;
        vstack.length = 0;
        stack_pointer = 0;

        return resultValue;
    };

    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `lexer`, `sharedState`, etc. references will be *wrong*!
    this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected, recoverable) {
        return {
            errStr: msg,
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,
            loc: lexer.yylloc,
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
            yy: sharedState.yy,
            lexer: lexer,

            // and make sure the error info doesn't stay due to potential ref cycle via userland code manipulations (memory leak opportunity!):
            destroy: function destructParseErrorInfo() {
                // remove cyclic references added to error info:
                // info.yy = null;
                // info.lexer = null;
                // info.value = null;
                // info.value_stack = null;
                // ...
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this.hasOwnProperty(key) && typeof key !== 'function') {
                        this[key] = undefined;
                    }
                }
                this.recoverable = rec;
            }
        };
    };

_lexer_without_token_stack:

    function lex() {
        var token = lexer.lex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token || EOF;
    }

_lexer_with_token_stack:

    // lex function that supports token stacks
    function tokenStackLex() {
        var token;
        token = tstack.pop() || lexer.lex() || EOF;
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

_lexer_with_token_stack_end:

    var symbol = 0;
    var preErrorSymbol = 0;
    var state, action, r, t;
    var yyval = {
        $: true,
        _$: undefined
    };
    var p, len, this_production;
    var lstack_begin, lstack_end;
    var newState;
    var retval = false;

_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

    // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = sp - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            var t = table[state][TERROR] || NO_ACTION;
            if (t[0]) {
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 1) {
                return -1; // No suitable error recovery rule available.
            }
            --stack_probe; // popStack(1): [symbol, action]
            state = sstack[stack_probe];
            ++depth;
        }
    }

_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

    // SHA-1: c4ea524b22935710d98252a1d9e04ddb82555e56 :: shut up error reports about non-strict mode in Chrome in the demo pages:
    // (NodeJS doesn't care, so this semicolon is only important for the demo web pages which run the jison *GENERATOR* in a web page...)
    ;

    try {
        this.__reentrant_call_depth++;

        if (this.pre_parse) {
            this.pre_parse.call(this, sharedState.yy, parseParams);
        }
        if (sharedState.yy.pre_parse) {
            sharedState.yy.pre_parse.call(this, sharedState.yy, parseParams);
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
                    symbol = lex();
                }
                // read action for current state and first input
                t = (table[state] && table[state][symbol]) || NO_ACTION;
                newState = t[1];
                action = t[0];

                if (yydebug) yydebug('after FETCH/LEX: ', { symbol: symbol });

_handle_error_with_recovery:                // run this code when the grammar includes error recovery rules

                // handle parse error
                if (!action) {
                    // first see if there's any chance at hitting an error recovery rule:
                    var error_rule_depth = locateNearestErrorRecoveryRule(state);
                    var errStr = null;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    if (!recovering) {
                        // Report error
                        if (lexer.showPosition) {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition(79 - 10, 10) + '\n';
                        } else {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                        }
                        if (expected.length) {
                            errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                        } else {
                            errStr += 'Unexpected ' + errSymbolDescr;
                        }
                        p = this.constructParseErrorInfo(errStr, null, expected, (error_rule_depth >= 0));
                        r = this.parseError(p.errStr, p);

                        if (yydebug) yydebug('error detected: ', { error_rule_depth: error_rule_depth });
                        if (!p.recoverable) {
                            retval = r;
                            break;
                        } else {
                            // TODO: allow parseError callback to edit symbol and or state tat the start of the error recovery process...
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
                            retval = this.parseError(p.errStr, p);
                            break;
                        }

                        // discard current lookahead and grab another
                        yyleng = lexer.yyleng;
                        yytext = lexer.yytext;
                        yylineno = lexer.yylineno;
                        yyloc = lexer.yylloc;

                        symbol = lex();

                        if (yydebug) yydebug('after ERROR RECOVERY-3: ', { symbol: symbol });
                    }

                    // try to recover from error
                    if (error_rule_depth < 0) {
                        p = this.constructParseErrorInfo((errStr || 'Parsing halted. No suitable error recovery rule available.'), null, expected, false);
                        retval = this.parseError(p.errStr, p);
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

_handle_error_no_recovery:                  // run this code when the grammar does not include any error recovery rules

                // handle parse error
                if (!action) {
                    var errStr;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    // Report error
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition() + '\n';
                    } else {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                    }
                    if (expected.length) {
                        errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                    } else {
                        errStr += 'Unexpected ' + errSymbolDescr;
                    }
                    // we cannot recover from the error!
                    p = this.constructParseErrorInfo(errStr, null, expected, false);
                    retval = this.parseError(p.errStr, p);
                    break;
                }

_handle_error_end_of_section:                  // this concludes the error recovery / no error recovery code section choice above

                // SHA-1: c4ea524b22935710d98252a1d9e04ddb82555e56 :: shut up error reports about non-strict mode in Chrome in the demo pages:
                // (NodeJS doesn't care, so this semicolon is only important for the demo web pages which run the jison *GENERATOR* in a web page...)
                ;
            }

            if (yydebug) yydebug('::: action: ' + (action === 1 ? 'shift token (then go to state ' + newState + ')' : action === 2 ? 'reduce by rule: ' + newState : action === 3 ? 'accept' : '???unexpected???'), { action: action, newState: newState, symbol: symbol });
            switch (action) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action instanceof Array) {
                    p = this.constructParseErrorInfo(('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol), null, null, false);
                    retval = this.parseError(p.errStr, p);
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                retval = this.parseError(p.errStr, p);
                break;

            // shift:
            case 1:
                //this.shiftCount++;
                stack[sp] = symbol;
                vstack[sp] = lexer.yytext;
                lstack[sp] = lexer.yylloc;
                sstack[sp] = newState; // push state
                ++sp;
                symbol = 0;
                if (!preErrorSymbol) { // normal execution / no error
                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;

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
                    if (!t[0]) {
                        // forget about that symbol and move forward: this wasn't an 'forgot to insert' error type where
                        // (simple) stuff might have been missing before the token which caused the error we're
                        // recovering from now...
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

                if (yydebug) yydebug('~~~ REDUCE: ', { pop_size: len });

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

                r = this.performAction.call(yyval, yytext, yyleng, yylineno, yyloc, sharedState.yy, newState, sp - 1, vstack, lstack, stack, sstack, parseParams);

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
        retval = this.parseError(p.errStr, p);
    } finally {
        retval = this.cleanupAfterParse(retval, true);
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

    afterconstructor: function (typal_property_return_value, grammar, options) {
        if (this.DEBUG) {
            this.mix(lrGeneratorDebug, lalrGeneratorDebug); // mixin debug methods
        }

        options = options || {};
        this.states = this.canonicalCollection();

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER canonicalCollection:");
            this.displayFollowSets();
            Jison.print("\n");
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
        this.onDemandLookahead = !!options.onDemandLookahead;
        if (this.DEBUG) Jison.print('LALR: using on-demand look-ahead: ', (this.onDemandLookahead ? 'yes' : 'no'));

        this.buildNewGrammar();

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER buildNewGrammar: NEW GRAMMAR");
            newg.displayFollowSets();
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER buildNewGrammar: ORIGINAL GRAMMAR");
            this.displayFollowSets();
        }

        newg.computeLookaheads();

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads: NEW GRAMMAR");
            newg.displayFollowSets();
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads: ORIGINAL GRAMMAR");
            this.displayFollowSets();
        }

        this.unionLookaheads();

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER unionLookaheads: NEW GRAMMAR");
            newg.displayFollowSets();
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER unionLookaheads: ORIGINAL GRAMMAR");
            this.displayFollowSets();
        }

        this.table = this.parseTable(this.states);

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable: NEW GRAMMAR");
            newg.displayFollowSets();
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable: ORIGINAL GRAMMAR");
            this.displayFollowSets();
        }

        this.defaultActions = findDefaults(this.table);
        cleanupTable(this.table);

        traceStates(this.trace, this.states, 'at the end of the LALR constructor, after cleanupTable()');
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
                    var goes = self.states.item(pathInfo.endState).goes;
                    if (!goes[handle]) {
                        goes[handle] = [];
                    }
                    goes[handle].push(symbol);

                    if (devDebug > 2) self.trace('new production:', {
                        state: state,
                        stateNum: i,
                        production: p
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

        this.states.forEach(function union_states_forEach(state) {
            //assert(state.inadequate ? this.inadequate : true);
            var treat_me = (self.onDemandLookahead ? this.inadequate || state.inadequate : true);
            if (state.reductions.length && treat_me) {
                state.reductions.forEach(function union_reduction_forEach(item) {
                    var follows = {};
                    for (var k = 0; k < item.follows.length; k++) {
                        follows[item.follows[k]] = true;
                    }
                    var handle = item.production.handle.join(' ');
                    state.goes[handle].forEach(function reduction_goes_forEach(symbol) {
                        newg.nonterminals[symbol].follows.forEach(function goes_follows_forEach(symbol) {
                            var terminal = self.terms_[symbol];
                            if (!follows[terminal]) {
                                follows[terminal] = true;
                                item.follows.push(terminal);
                            }
                        });
                    });

                    if (devDebug > 2) self.trace('unioned item', item);
                });
            }
        });
    }
});

var LALRGenerator = exports.LALRGenerator = lalr.construct();

// LALR generator debug mixin

var lalrGeneratorDebug = {
    trace: function lalrDebugTrace() {
        if (typeof Jison !== 'undefined' && Jison.print) {
            Jison.print.apply(null, arguments);
        } else if (typeof print !== 'undefined') {
            print.apply(null, arguments);
        } else if (typeof console !== 'undefined' && console.log) {
            console.log.apply(null, arguments);
        }
    },
    beforebuildNewGrammar: function () {
        this.trace(this.states.size() + ' states.');
        this.trace('Building lookahead grammar.');
    },
    beforeunionLookaheads: function () {
        this.trace('Computing lookaheads.');
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

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads:");
            this.displayFollowSets();
            Jison.print("\n");
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
            set.forEach(function (item) {
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

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER computeLookaheads:");
            this.displayFollowSets();
        }

        this.table = this.parseTable(this.productions);

        if (this.DEBUG) {
            Jison.print("\n-------------------------------------------\nSymbol/Follow sets AFTER parseTable:");
            this.displayFollowSets();
        }

        this.defaultActions = {}; // findDefaults(this.table);
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

Jison.Generator = function Jison_Generator(g, optionalLexerSection, options) {
    // pick the correct argument for the `options` for this call:
    var opt = typal.camelMix.call({}, (options || typeof optionalLexerSection === 'string') ? options : optionalLexerSection);
    var chk_g;

    // Provisionally parse the grammar, really only to obtain the *options.type*
    // specified within the grammar, if specified (via `%parser-type`):
    if (typeof g === 'string') {
        try {
            chk_g = json5.parse(g);

            // When JSON5-based parsing of the grammar succeeds, this implies the grammar is specified in `JSON mode`:
            opt.json = true;
        } catch (e) {
            try {
                chk_g = ebnfParser.parse(g);
    
                opt.json = false;
            } catch (e) {
                chk_g = null;
            }
        }
    } else {
        chk_g = g;
    }

    opt = typal.camelMix.call({}, Jison.defaultJisonOptions, chk_g && chk_g.options, opt);
    switch (opt.type || '') {
    case 'lr0':
        return new LR0Generator(g, optionalLexerSection, opt);
    case 'slr':
        return new SLRGenerator(g, optionalLexerSection, opt);
    case 'lr':
    case 'lr1':
        return new LR1Generator(g, optionalLexerSection, opt);
    case 'll':
    case 'll1':
        return new LLGenerator(g, optionalLexerSection, opt);
    case 'lalr1':
    case 'lalr':
    case '':
        return new LALRGenerator(g, optionalLexerSection, opt);
    default:
        throw new Error('Unsupported parser type: ' + opt.type);
    }
};

return function Parser(g, l, options) {
    var gen = Jison.Generator(g, l, options);
    return gen.createParser();
};

})();

}).call(this,require('_process'))
},{"../package.json":21,"./util/ebnf-parser.js":3,"./util/lex-parser.js":5,"./util/regexp-lexer.js":8,"./util/set":9,"./util/typal":11,"_process":16,"assert":12,"fs":13,"json5":14,"path":15,"xregexp":20}],3:[function(require,module,exports){
var bnf = require("./parser").parser,
    ebnf = require("./ebnf-transform"),
    jisonlex = require("./lex-parser");

exports.parse = function parse(grammar) { 
    return bnf.parse(grammar); 
};

exports.transform = ebnf.transform;

// adds a declaration to the grammar
bnf.yy.addDeclaration = function bnfAddDeclaration(grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start;
    } else if (decl.lex) {
        grammar.lex = parseLex(decl.lex.text, decl.lex.position);
    } else if (decl.operator) {
        if (!grammar.operators) grammar.operators = [];
        grammar.operators.push(decl.operator);
    } else if (decl.token) {
        if (!grammar.extra_tokens) grammar.extra_tokens = [];
        grammar.extra_tokens.push(decl.token);
    } else if (decl.token_list) {
        if (!grammar.extra_tokens) grammar.extra_tokens = [];
        decl.token_list.forEach(function (tok) {
            grammar.extra_tokens.push(tok);
        });
    } else if (decl.parseParams) {
        if (!grammar.parseParams) grammar.parseParams = [];
        grammar.parseParams = grammar.parseParams.concat(decl.parseParams);
    } else if (decl.parserType) {
        if (!grammar.options) grammar.options = {};
        grammar.options.type = decl.parserType;
    } else if (decl.include) {
        if (!grammar.moduleInclude) grammar.moduleInclude = '';
        grammar.moduleInclude += decl.include;
    } else if (decl.options) {
        if (!grammar.options) grammar.options = {};
        // last occurrence of `%options` wins:
        for (var i = 0; i < decl.options.length; i++) {
            grammar.options[decl.options[i][0]] = decl.options[i][1];
        }
    } else if (decl.unknownDecl) {
        if (!grammar.unknownDecls) grammar.unknownDecls = [];
        grammar.unknownDecls.push(decl.unknownDecl);
    } else if (decl.imports) {
        if (!grammar.imports) grammar.imports = [];
        grammar.imports.push(decl.imports);
    } else if (decl.actionInclude) {
        if (!grammar.actionInclude) {
            grammar.actionInclude = '';
        }
        grammar.actionInclude += decl.actionInclude;
    } else if (decl.initCode) {
        if (!grammar.moduleInit) {
            grammar.moduleInit = [];
        }
        grammar.moduleInit.push(decl.initCode);       // {qualifier: <name>, include: <source code chunk>}
    }
};

// parse an embedded lex section
var parseLex = function bnfParseLex(text, position) {
    text = text.replace(/(?:^%lex)|(?:\/lex$)/g, '');
    // We want the lex input to start at the given 'position', if any, 
    // so that error reports will produce a line number and character index
    // which matches the original input file:
    position = position || {};
    position.range = position.range || [];
    var l = position.first_line | 0;
    var c = position.range[0] | 0;
    var prelude = '';
    if (l > 1) {
        prelude += (new Array(l)).join('\n');
        c -= prelude.length;
    }
    if (c > 3) {
        prelude = '// ' + (new Array(c - 3)).join('.') + prelude;
    }
    return jisonlex.parse(prelude + text);
};

},{"./ebnf-transform":4,"./lex-parser":5,"./parser":7}],4:[function(require,module,exports){
var EBNF = (function(){
    var parser = require('./transform-parser.js');
    //var assert = require('assert');

    var devDebug = 0;

    function generatePushAction(handle, offset) {
        var terms = handle.terms;
        var rv = [];

        for (var i = 0, len = terms.length; i < len; i++) {
            rv.push('$' + (i + offset));
        }
        rv = rv.join(', ');
        // and make sure we contain a term series unambiguously, i.e. anything more complex than
        // a single term inside an EBNF check is produced as an array so we can differentiate
        // between */+/? EBNF operator results and groups of tokens per individual match.
        if (len > 1) {
            rv = '[' + rv + ']';
        }
        return rv;
    }

    var transformExpression = function(e, opts, emit) {
        var type = e[0],
            value = e[1],
            name = false,
            has_transformed = 0;
        var list, n;

        if (type === 'xalias') {
            type = e[1];
            value = e[2];
            name = e[3];
            if (type) {
                e = e.slice(1);
            } else {
                e = value;
                type = e[0];
                value = e[1];
            }
            if (devDebug > 3) console.log('xalias: ', e, type, value, name);
        }

        if (type === 'symbol') {
            // if (e[1][0] === '\\') {
            //     n = e[1][1];
            // }
            // else if (e[1][0] === '\'') {
            //     n = e[1].substring(1, e[1].length - 1);
            // }
            // else if (e[1][0] === '"') {
            //     n = e[1].substring(1, e[1].length - 1);
            // }
            // else {
                n = e[1];
            // }
            if (devDebug > 2) console.log('symbol EMIT: ', n + (name ? '[' + name + ']' : ''));
            emit(n + (name ? '[' + name + ']' : ''));
        } else if (type === '+') {
            if (!name) {
                name = opts.production + '_repetition_plus' + opts.repid++;
            }
            if (devDebug > 2) console.log('+ EMIT name: ', name);
            emit(name);

            has_transformed = 1;

            opts = optsForProduction(name, opts.grammar);
            list = transformExpressionList([value], opts);
            opts.grammar[name] = [
                [
                    list.fragment,
                    '$$ = [' + generatePushAction(list, 1) + '];'
                ],
                [
                    name + ' ' + list.fragment,
                    '$1.push(' + generatePushAction(list, 2) + ');\n$$ = $1;'
                ]
            ];
        } else if (type === '*') {
            if (!name) {
                name = opts.production + '_repetition' + opts.repid++;
            }
            if (devDebug > 2) console.log('* EMIT name: ', name);
            emit(name);

            has_transformed = 1;

            opts = optsForProduction(name, opts.grammar);
            list = transformExpressionList([value], opts);
            opts.grammar[name] = [
                [
                    '',
                    '$$ = [];'
                ],
                [
                    name + ' ' + list.fragment,
                    '$1.push(' + generatePushAction(list, 2) + ');\n$$ = $1;'
                ]
            ];
        } else if (type === '?') {
            if (!name) {
                name = opts.production + '_option' + opts.optid++;
            }
            if (devDebug > 2) console.log('? EMIT name: ', name);
            emit(name);

            has_transformed = 1;

            opts = optsForProduction(name, opts.grammar);
            list = transformExpressionList([value], opts);
            // you want to be able to check if 0 or 1 occurrences were recognized: since jison
            // by default *copies* the lexer token value, i.e. `$$ = $1` is the (optional) default action,
            // we will need to set the action up explicitly in case of the 0-count match:
            // `$$ = undefined`.
            //
            // Note that we MUST return an array as the
            // '1 occurrence' match CAN carry multiple terms, e.g. in constructs like
            // `(T1 T2 T3)?`.
            opts.grammar[name] = [
                [
                    '',
                    '$$ = undefined;'
                ],
                [
                    list.fragment,
                    '$$ = ' + generatePushAction(list, 1) + ';'
                ]
            ];
        } else if (type === '()') {
            if (value.length === 1 && !name) {
                list = transformExpressionList(value[0], opts);
                if (list.first_transformed_term_index) {
                    has_transformed = list.first_transformed_term_index;
                }
                if (devDebug > 2) console.log('group EMIT len=1: ', list);
                emit(list);
            } else {
                if (!name) {
                    name = opts.production + '_group' + opts.groupid++;
                }
                if (devDebug > 2) console.log('group EMIT name: ', name);
                emit(name);

                has_transformed = 1;

                opts = optsForProduction(name, opts.grammar);
                opts.grammar[name] = value.map(function(handle) {
                    var list = transformExpressionList(handle, opts);
                    return [
                        list.fragment,
                        '$$ = ' + generatePushAction(list, 1) + ';'
                    ];
                });
            }
        }

        return has_transformed;
    };

    var transformExpressionList = function(list, opts) {
        var first_transformed_term_index = false;
        var terms = list.reduce(function (tot, e) {
            var ci = tot.length;

            var has_transformed = transformExpression(e, opts, function (name) {
                if (name.terms) {
                    tot.push.apply(tot, name.terms);
                } else {
                    tot.push(name);
                }
            });

            if (has_transformed) {
                first_transformed_term_index = ci + has_transformed;
            }
            return tot;
        }, []);
        return {
            fragment: terms.join(' '),
            terms: terms,
            first_transformed_term_index: first_transformed_term_index              // 1-based index
        };
    };

    var optsForProduction = function(id, grammar) {
        return {
            production: id,
            repid: 0,
            groupid: 0,
            optid: 0,
            grammar: grammar
        };
    };

    var transformProduction = function(id, production, grammar) {
        var transform_opts = optsForProduction(id, grammar);
        return production.map(function (handle) {
            var action = null,
                opts = null;
            var i, len, n;

            if (typeof handle !== 'string') {
                action = handle[1];
                opts = handle[2];
                handle = handle[0];
            }
            var expressions = parser.parse(handle);

            if (devDebug > 1) console.log("\n================\nEBNF transform expressions:\n ", handle, opts, JSON.stringify(expressions, null, 2));

            var list = transformExpressionList(expressions, transform_opts);

            var ret = [list.fragment];
            if (action) {
                // make sure the action doesn't address any inner items.
                if (list.first_transformed_term_index) {
                    var rhs = list.fragment;
                    // seek out all names and aliases; strip out literal tokens first as those cannot serve as $names:
                    var alist = list.terms; // rhs.replace(/'[^']+'/g, '~').replace(/"[^"]+"/g, '~').split(' ');
                    // we also know at which index the first transformation occurred:
                    var first_index = list.first_transformed_term_index - 1;
                    if (devDebug > 2) console.log("alist ~ rhs rule terms: ", alist, rhs);

                    var alias_re = /\[[a-zA-Z_][a-zA-Z0-9_]*\]/;
                    var term_re = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
                    // and collect the PERMITTED aliases: the names of the terms and all the remaining aliases
                    var good_aliases = {};
                    var alias_cnt = {};

                    // WARNING: this replicates the knowledge/code of jison.js::addName()
                    var addName = function (s, i) {
                        if (good_aliases[s]) {
                            good_aliases[s + (++alias_cnt[s])] = i + 1;
                        } else {
                            good_aliases[s] = i + 1;
                            good_aliases[s + '1'] = i + 1;
                            alias_cnt[s] = 1;
                        }
                    };

                    for (i = 0, len = alist.length; i < len; i++) {
                        var term = alist[i];
                        var alias = term.match(alias_re);
                        if (alias) {
                            addName(alias[0].substr(1, alias[0].length - 2), i);
                            term = term.replace(alias_re, '');
                        }
                        if (term.match(term_re)) {
                            addName(term, i);
                        }
                    }
                    if (devDebug > 2) console.log("good_aliases: ", good_aliases);

                    // now scan the action for all named and numeric semantic values ($nonterminal / $1)
                    var named_spots = action.match(/[$@][a-zA-Z_][a-zA-Z0-9_]*\b/g);
                    var numbered_spots = action.match(/[$@][0-9]+\b/g);
                    var max_term_index = list.terms.length;
                    if (devDebug > 2) console.log("ACTION named_spots: ", named_spots);
                    if (devDebug > 2) console.log("ACTION numbered_spots: ", numbered_spots);

                    if (named_spots) {
                        for (i = 0, len = named_spots.length; i < len; i++) {
                            n = named_spots[i].substr(1);
                            if (!good_aliases[n]) {
                                throw new Error("The action block references the named alias '" + n + "' " +
                                                "which is not available in production '" + handle + "'; " +
                                                "it probably got removed by the EBNF rule rewrite process.\n" +
                                                "Be reminded that you cannot reference sub-elements within EBNF */+/? groups, " +
                                                "only the outer-most EBNF group alias will remain available at all times " +
                                                "due to the EBNF-to-BNF rewrite process.");
                            }
                            //assert(good_aliases[n] <= max_term_index, "max term index");
                        }
                    }
                    if (numbered_spots) {
                        for (i = 0, len = numbered_spots.length; i < len; i++) {
                            n = parseInt(numbered_spots[i].substr(1));
                            if (n > max_term_index) {
                                /* @const */ var n_suffixes = [ "st", "nd", "rd", "th" ];
                                throw new Error("The action block references the " + n + n_suffixes[Math.max(0, Math.min(3, n - 1))] + " term, " +
                                                "which is not available in production '" + handle + "'; " +
                                                "Be reminded that you cannot reference sub-elements within EBNF */+/? groups, " +
                                                "only the outer-most EBNF group alias will remain available at all times " +
                                                "due to the EBNF-to-BNF rewrite process.");
                            }
                        }
                    }
                }
                ret.push(action);
            }
            if (opts) {
                ret.push(opts);
            }
            if (devDebug > 1) console.log("\n\nEBNF tx result:\n ", JSON.stringify(list, null, 2), JSON.stringify(ret, null, 2));

            if (ret.length === 1) {
                return ret[0];
            } else {
                return ret;
            }
        });
    };

    var transformGrammar = function(grammar) {
        Object.keys(grammar).forEach(function(id) {
            grammar[id] = transformProduction(id, grammar[id], grammar);
        });
    };

    return {
        transform: function (ebnf) {
            if (devDebug > 0) console.log("EBNF:\n ", JSON.stringify(ebnf, null, 2));
            transformGrammar(ebnf);
            if (devDebug > 0) console.log("\n\nEBNF after transformation:\n ", JSON.stringify(ebnf, null, 2));
            return ebnf;
        }
    };
})();

exports.transform = EBNF.transform;


},{"./transform-parser.js":10}],5:[function(require,module,exports){
/* parser generated by jison 0.4.18-153 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}     The so-called "shared state" or rather the *source* of it;
 *               the real "shared state" `yy` passed around to
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
 *               `cleanupAfterParse()` will clean up and reset `quoteName()` to reference this function
 *               at the end of the `parse()`.
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
 *    performAction: function parser__performAction(yytext, yyleng, yylineno, yyloc, yy, yystate, $0, yyvstack, yylstack, yystack, yysstack, ...),
 *               where `...` denotes the (optional) additional arguments the user passed to
 *               `parser.parse(str, ...)`
 *
 *    table: [...],
 *               State transition table
 *               ----------------------
 *
 *               index levels are:
 *               - `state`  --> hash table
 *               - `symbol` --> action (number or array)
 *
 *                 If the `action` is an array, these are the elements' meaning:
 *                 - index [0]: 1 = shift, 2 = reduce, 3 = accept
 *                 - index [1]: GOTO `state`
 *
 *                 If the `action` is a number, it is the GOTO `state`
 *
 *    defaultActions: {...},
 *
 *    parseError: function(str, hash),
 *    yyErrOk: function(),
 *    yyClearIn: function(),
 *
 *    constructParseErrorInfo: function(error_message, exception_object, expected_token_set, is_recoverable),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               Produces a new errorInfo 'hash object' which can be passed into `parseError()`.
 *               See it's use in this parser kernel in many places; example usage:
 *
 *                   var infoObj = parser.constructParseErrorInfo('fail!', null,
 *                                     parser.collect_expected_token_set(state), true);
 *                   var retVal = parser.parseError(infoObj.errStr, infoObj);
 *
 *    originalParseError: function(str, hash),
 *               The basic parseError handler provided by JISON.
 *               `cleanupAfterParse()` will clean up and reset `parseError()` to reference this function
 *               at the end of the `parse()`.
 *
 *    options: { ... parser %options ... },
 *
 *    parse: function(input[, args...]),
 *               Parse the given `input` and return the parsed value (or `true` when none was provided by
 *               the root action, in which case the parser is acting as a *matcher*).
 *               You MAY use the additional `args...` parameters as per `%parse-param` spec of this grammar:
 *               these extra `args...` are passed verbatim to the grammar rules' action code.
 *
 *    cleanupAfterParse: function(resultValue, invoke_post_methods),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               This helper API is invoked at the end of the `parse()` call, unless an exception was thrown
 *               and `%options no-try-catch` has been defined for this grammar: in that case this helper MAY
 *               be invoked by calling user code to ensure the `post_parse` callbacks are invoked and
 *               the internal parser gets properly garbage collected under these particular circumstances.
 *
 *    lexer: {
 *        yy: {...},           A reference to the so-called "shared state" `yy` once
 *                             received via a call to the `.setInput(input, yy)` lexer API.
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input, [yy]),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(n),
 *        upcomingInput: function(n),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        pushState: function(condition),
 *        popState: function(),
 *        topState: function(),
 *        _currentRules: function(),
 *        stateStackSize: function(),
 *
 *        options: { ... lexer %options ... },
 *
 *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
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
 * The parseError function receives a 'hash' object with these members for lexer and
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
 *                  can, for example, be used to pass to the `collect_expected_token_set()`
 *                  API to obtain the expected token set)
 *    action:      (integer; represents the current internal action which will be executed)
 *    new_state:   (integer; represents the next/planned internal state, once the current
 *                  action has executed)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule
 *                  available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    value_stack: (array: the current parser LALR/LR internal `$$` value stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    yy:          (object: the current parser internal "shared state" `yy`
 *                  as is also available in the rule actions; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    lexer:       (reference to the current lexer instance used by the parser)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser*
 *  instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 *  When `parseError` is invoked by the parser due to a **JavaScript exception** being fired
 *  from either the parser or lexer, `this` will still reference the related *parser*
 *  instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    exception:   (reference to the exception thrown)
 *  }
 *
 *  Please do note that in the latter situation, the `expected` field will be omitted as
 *  type of failure is assumed not to be due to *parse errors* but rather due to user
 *  action code in either parser or lexer failing unexpectedly.
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy [, optional parse() args])
 *                 optional: you can specify a pre_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: you can specify a post_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`. When it does not return any value,
 *                 the parser will return the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy [, optional parse() args])
 *                 optional: is invoked before the parse cycle starts (and before the first
 *                 invocation of `lex()`) but immediately after the invocation of
 *                 `parser.pre_parse()`).
 *      post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: is invoked when the parse terminates due to success ('accept')
 *                 or failure (even when exceptions are thrown).
 *                 `retval` contains the return value to be produced by `Parser.parse()`;
 *                 this function can override the return value by returning another. 
 *                 When it does not return any value, the parser will return the original
 *                 `retval`. 
 *                 This function is invoked immediately before `Parser.post_parse()`.
 *
 *      parseError: function(str, hash)
 *                 optional: overrides the default `parseError` function.
 *      quoteName: function(name),
 *                 optional: overrides the default `quoteName` function.
 *  }
 *
 *  parser.lexer.options: {
 *      pre_lex:  function()
 *                 optional: is invoked before the lexer is invoked to produce another token.
 *                 `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                 optional: is invoked when the lexer has produced a token `token`;
 *                 this function can override the returned token value by returning another.
 *                 When it does not return any (truthy) value, the lexer will return
 *                 the original `token`.
 *                 `this` refers to the Lexer object.
 *
 *      ranges: boolean
 *                 optional: `true` ==> token location info will include a .range[] member.
 *      flex: boolean
 *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested
 *                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                 optional: `true` ==> lexer regexes are tested in order and for invoked;
 *                 the lexer terminates the scan when a token is returned by the action code.
 *      xregexp: boolean
 *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the
 *                 `XRegExp` library. When this %option has not been specified at compile time, all lexer
 *                 rule regexes have been written as standard JavaScript RegExp expressions.
 *  }
 */
var lexParser = (function () {

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

if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
} else {
    JisonParserError.prototype = Object.create(Error.prototype);
}
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';



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

var parser = {
trace: function no_op_trace() { },
JisonParserError: JisonParserError,
yy: {},
options: {
  type: "lalr",
  errorRecoveryTokenDiscardCount: 3
},
symbols_: {
  "$": 17,
  "$accept": 0,
  "$end": 1,
  "%%": 22,
  "(": 10,
  ")": 11,
  "*": 7,
  "+": 12,
  ",": 8,
  ".": 15,
  "/": 14,
  "/!": 51,
  "<": 5,
  "=": 18,
  ">": 6,
  "?": 13,
  "ACTION": 34,
  "ACTION_BODY": 44,
  "CHARACTER_LIT": 66,
  "CODE": 76,
  "EOF": 1,
  "ESCAPE_CHAR": 63,
  "INCLUDE": 73,
  "NAME": 27,
  "NAME_BRACE": 57,
  "OPTIONS": 67,
  "OPTIONS_END": 69,
  "OPTION_VALUE": 71,
  "PATH": 74,
  "RANGE_REGEX": 64,
  "REGEX_SET": 62,
  "REGEX_SET_END": 60,
  "REGEX_SET_START": 58,
  "SPECIAL_GROUP": 50,
  "START_COND": 38,
  "START_EXC": 31,
  "START_INC": 29,
  "STRING_LIT": 65,
  "UNKNOWN_DECL": 37,
  "^": 16,
  "action": 41,
  "action_body": 33,
  "action_comments_body": 43,
  "any_group_regex": 54,
  "definition": 26,
  "definitions": 21,
  "error": 2,
  "escape_char": 56,
  "extra_lexer_module_code": 24,
  "include_macro_code": 35,
  "init": 20,
  "lex": 19,
  "module_code_chunk": 75,
  "name_expansion": 52,
  "name_list": 45,
  "names_exclusive": 32,
  "names_inclusive": 30,
  "nonempty_regex_list": 46,
  "option": 70,
  "option_list": 68,
  "optional_module_code_chunk": 72,
  "options": 36,
  "range_regex": 53,
  "regex": 28,
  "regex_base": 49,
  "regex_concat": 48,
  "regex_list": 47,
  "regex_set": 59,
  "regex_set_atom": 61,
  "rule": 39,
  "rules": 25,
  "rules_and_epilogue": 23,
  "start_conditions": 40,
  "string": 55,
  "unbracketed_action_body": 42,
  "{": 3,
  "|": 9,
  "}": 4
},
terminals_: {
  1: "EOF",
  2: "error",
  3: "{",
  4: "}",
  5: "<",
  6: ">",
  7: "*",
  8: ",",
  9: "|",
  10: "(",
  11: ")",
  12: "+",
  13: "?",
  14: "/",
  15: ".",
  16: "^",
  17: "$",
  18: "=",
  22: "%%",
  27: "NAME",
  29: "START_INC",
  31: "START_EXC",
  34: "ACTION",
  37: "UNKNOWN_DECL",
  38: "START_COND",
  44: "ACTION_BODY",
  50: "SPECIAL_GROUP",
  51: "/!",
  57: "NAME_BRACE",
  58: "REGEX_SET_START",
  60: "REGEX_SET_END",
  62: "REGEX_SET",
  63: "ESCAPE_CHAR",
  64: "RANGE_REGEX",
  65: "STRING_LIT",
  66: "CHARACTER_LIT",
  67: "OPTIONS",
  69: "OPTIONS_END",
  71: "OPTION_VALUE",
  73: "INCLUDE",
  74: "PATH",
  76: "CODE"
},
TERROR: 2,
EOF: 1,

// internals: defined here so the object *structure* doesn't get modified by parse() et al,
// thus helping JIT compilers like Chrome V8.
originalQuoteName: null,
originalParseError: null,
cleanupAfterParse: null,
constructParseErrorInfo: null,

__reentrant_call_depth: 0,       // INTERNAL USE ONLY

// APIs which will be set up depending on user action code analysis:
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
},
productions_: bp({
  pop: u([
  19,
  s,
  [23, 4],
  20,
  21,
  21,
  s,
  [26, 8],
  30,
  30,
  32,
  32,
  25,
  25,
  39,
  s,
  [41, 3],
  42,
  42,
  33,
  33,
  43,
  43,
  s,
  [40, 3],
  45,
  45,
  28,
  47,
  47,
  s,
  [46, 3],
  48,
  48,
  s,
  [49, 15],
  52,
  54,
  59,
  59,
  61,
  61,
  56,
  53,
  55,
  55,
  36,
  68,
  68,
  s,
  [70, 3],
  24,
  24,
  35,
  35,
  75,
  75,
  72,
  72
]),
  rule: u([
  4,
  1,
  3,
  4,
  2,
  0,
  2,
  0,
  s,
  [2, 3],
  3,
  s,
  [1, 5],
  2,
  1,
  2,
  2,
  1,
  3,
  c,
  [12, 4],
  2,
  1,
  5,
  0,
  2,
  3,
  3,
  0,
  1,
  c,
  [13, 3],
  0,
  3,
  c,
  [24, 3],
  c,
  [23, 3],
  s,
  [2, 5],
  c,
  [10, 3],
  s,
  [1, 6],
  c,
  [21, 3],
  c,
  [9, 10],
  c,
  [52, 3],
  c,
  [31, 3],
  c,
  [28, 3],
  0
])
}),
performAction: function parser__PerformAction(yytext, yy, yystate /* action[1] */, $0, yyvstack) {
/* this == yyval */

switch (yystate) {
case 1:
    /*! Production::    lex : init definitions '%%' rules_and_epilogue */
    this.$ = yyvstack[$0];
    if (yyvstack[$0 - 2][0]) this.$.macros = yyvstack[$0 - 2][0];
    if (yyvstack[$0 - 2][1]) this.$.startConditions = yyvstack[$0 - 2][1];
    if (yyvstack[$0 - 2][2]) this.$.unknownDecls = yyvstack[$0 - 2][2];
    // if there are any options, add them all, otherwise set options to NULL:
    // can't check for 'empty object' by `if (yy.options) ...` so we do it this way:
    for (var k in yy.options) {
      this.$.options = yy.options;
      break;
    }
    if (yy.actionInclude) {
      var asrc = yy.actionInclude.join('\n\n');
      // Only a non-empty action code chunk should actually make it through:
      if (asrc.trim() !== '') {
        this.$.actionInclude = asrc;
      }
    }
    delete yy.options;
    delete yy.actionInclude;
    return this.$;
    break;

case 2:
    /*! Production::    rules_and_epilogue : EOF */
    this.$ = { rules: [] };
    break;

case 3:
    /*! Production::    rules_and_epilogue : '%%' extra_lexer_module_code EOF */
    if (yyvstack[$0 - 1] && yyvstack[$0 - 1].trim() !== '') {
      this.$ = { rules: [], moduleInclude: yyvstack[$0 - 1] };
    } else {
      this.$ = { rules: [] };
    }
    break;

case 4:
    /*! Production::    rules_and_epilogue : rules '%%' extra_lexer_module_code EOF */
    if (yyvstack[$0 - 1] && yyvstack[$0 - 1].trim() !== '') {
      this.$ = { rules: yyvstack[$0 - 3], moduleInclude: yyvstack[$0 - 1] };
    } else {
      this.$ = { rules: yyvstack[$0 - 3] };
    }
    break;

case 5:
    /*! Production::    rules_and_epilogue : rules EOF */
    this.$ = { rules: yyvstack[$0 - 1] };
    break;

case 6:
    /*! Production::    init : ε */
    yy.actionInclude = [];
    if (!yy.options) yy.options = {};
    break;

case 7:
    /*! Production::    definitions : definition definitions */
    this.$ = yyvstack[$0];
    if (yyvstack[$0 - 1] != null) {
      if ('length' in yyvstack[$0 - 1]) {
        this.$[0] = this.$[0] || {};
        this.$[0][yyvstack[$0 - 1][0]] = yyvstack[$0 - 1][1];
      } else if (yyvstack[$0 - 1].type === 'names') {
        this.$[1] = this.$[1] || {};
        for (var name in yyvstack[$0 - 1].names) {
          this.$[1][name] = yyvstack[$0 - 1].names[name];
        }
      } else if (yyvstack[$0 - 1].type === 'unknown') {
        this.$[2] = this.$[2] || [];
        this.$[2].push(yyvstack[$0 - 1].body);
      }
    }
    break;

case 8:
    /*! Production::    definitions : ε */
    this.$ = [null, null];
    break;

case 9:
    /*! Production::    definition : NAME regex */
    this.$ = [yyvstack[$0 - 1], yyvstack[$0]];
    break;

case 10:
    /*! Production::    definition : START_INC names_inclusive */
case 11:
    /*! Production::    definition : START_EXC names_exclusive */
case 25:
    /*! Production::    action : unbracketed_action_body */
case 26:
    /*! Production::    action : include_macro_code */
case 29:
    /*! Production::    action_body : action_comments_body */
case 67:
    /*! Production::    escape_char : ESCAPE_CHAR */
case 68:
    /*! Production::    range_regex : RANGE_REGEX */
case 77:
    /*! Production::    extra_lexer_module_code : optional_module_code_chunk */
case 81:
    /*! Production::    module_code_chunk : CODE */
case 83:
    /*! Production::    optional_module_code_chunk : module_code_chunk */
    this.$ = yyvstack[$0];
    break;

case 12:
    /*! Production::    definition : '{' action_body '}' */
    yy.actionInclude.push(yyvstack[$0 - 1]); this.$ = null;
    break;

case 13:
    /*! Production::    definition : ACTION */
case 14:
    /*! Production::    definition : include_macro_code */
    yy.actionInclude.push(yyvstack[$0]); this.$ = null;
    break;

case 15:
    /*! Production::    definition : options */
    this.$ = null;
    break;

case 16:
    /*! Production::    definition : UNKNOWN_DECL */
    this.$ = {type: 'unknown', body: yyvstack[$0]};
    break;

case 17:
    /*! Production::    names_inclusive : START_COND */
    this.$ = {type: 'names', names: {}}; this.$.names[yyvstack[$0]] = 0;
    break;

case 18:
    /*! Production::    names_inclusive : names_inclusive START_COND */
    this.$ = yyvstack[$0 - 1]; this.$.names[yyvstack[$0]] = 0;
    break;

case 19:
    /*! Production::    names_exclusive : START_COND */
    this.$ = {type: 'names', names: {}}; this.$.names[yyvstack[$0]] = 1;
    break;

case 20:
    /*! Production::    names_exclusive : names_exclusive START_COND */
    this.$ = yyvstack[$0 - 1]; this.$.names[yyvstack[$0]] = 1;
    break;

case 21:
    /*! Production::    rules : rules rule */
    this.$ = yyvstack[$0 - 1]; this.$.push(yyvstack[$0]);
    break;

case 22:
    /*! Production::    rules : rule */
case 36:
    /*! Production::    name_list : NAME */
    this.$ = [yyvstack[$0]];
    break;

case 23:
    /*! Production::    rule : start_conditions regex action */
    this.$ = yyvstack[$0 - 2] ? [yyvstack[$0 - 2], yyvstack[$0 - 1], yyvstack[$0]] : [yyvstack[$0 - 1], yyvstack[$0]];
    break;

case 24:
    /*! Production::    action : '{' action_body '}' */
case 33:
    /*! Production::    start_conditions : '<' name_list '>' */
    this.$ = yyvstack[$0 - 1];
    break;

case 28:
    /*! Production::    unbracketed_action_body : unbracketed_action_body ACTION */
    this.$ = yyvstack[$0 - 1] + '\n' + yyvstack[$0];
    break;

case 30:
    /*! Production::    action_body : action_body '{' action_body '}' action_comments_body */
    this.$ = yyvstack[$0 - 4] + yyvstack[$0 - 3] + yyvstack[$0 - 2] + yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 31:
    /*! Production::    action_comments_body : ε */
case 40:
    /*! Production::    regex_list : ε */
case 84:
    /*! Production::    optional_module_code_chunk : ε */
    this.$ = '';
    break;

case 32:
    /*! Production::    action_comments_body : action_comments_body ACTION_BODY */
case 44:
    /*! Production::    regex_concat : regex_concat regex_base */
case 54:
    /*! Production::    regex_base : regex_base range_regex */
case 63:
    /*! Production::    regex_set : regex_set_atom regex_set */
case 82:
    /*! Production::    module_code_chunk : module_code_chunk CODE */
    this.$ = yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 34:
    /*! Production::    start_conditions : '<' '*' '>' */
    this.$ = ['*'];
    break;

case 37:
    /*! Production::    name_list : name_list ',' NAME */
    this.$ = yyvstack[$0 - 2]; this.$.push(yyvstack[$0]);
    break;

case 38:
    /*! Production::    regex : nonempty_regex_list[re] */
    // Detect if the regex ends with a pure (Unicode) word;
    // we *do* consider escaped characters which are 'alphanumeric'
    // to be equivalent to their non-escaped version, hence these are
    // all valid 'words' for the 'easy keyword rules' option:
    //
    // - hello_kitty
    // - γεια_σου_γατούλα
    // - \u03B3\u03B5\u03B9\u03B1_\u03C3\u03BF\u03C5_\u03B3\u03B1\u03C4\u03BF\u03CD\u03BB\u03B1
    //
    // http://stackoverflow.com/questions/7885096/how-do-i-decode-a-string-with-escaped-unicode#12869914
    //
    // As we only check the *tail*, we also accept these as
    // 'easy keywords':
    //
    // - %options
    // - %foo-bar
    // - +++a:b:c1
    //
    // Note the dash in that last example: there the code will consider
    // `bar` to be the keyword, which is fine with us as we're only
    // interested in the trailing boundary and patching that one for
    // the `easy_keyword_rules` option.
    this.$ = yyvstack[$0];
    if (yy.options.easy_keyword_rules) {
      // We need to 'protect' `eval` here as keywords are allowed
      // to contain double-quotes and other leading cruft.
      // `eval` *does* gobble some escapes (such as `\b`) but
      // we protect against that through a simple replace regex:
      // we're not interested in the special escapes' exact value
      // anyway.
      // It will also catch escaped escapes (`\\`), which are not
      // word characters either, so no need to worry about
      // `eval(str)` 'correctly' converting convoluted constructs
      // like '\\\\\\\\\\b' in here.
      this.$ = this.$
      .replace(/\\\\/g, '.')
      .replace(/"/g, '.')
      .replace(/\\c[A-Z]/g, '.')
      .replace(/\\[^xu0-9]/g, '.');
    
      try {
        this.$ = eval('"' + this.$ + '"');
      }
      catch (ex) {
        console.warn('easy-keyword-rule FAIL on eval: ', ex);
    
        // make the next keyword test fail:
        this.$ = '.';
      }
      // a 'keyword' starts with an alphanumeric character,
      // followed by zero or more alphanumerics or digits:
      var re = XRegExp('\\w[\\w\\d]*$', 'u');
      if (XRegExp.match(this.$, re)) {
        this.$ = yyvstack[$0] + "\\b";
      } else {
        this.$ = yyvstack[$0];
      }
    }
    break;

case 41:
    /*! Production::    nonempty_regex_list : regex_concat '|' regex_list */
    this.$ = yyvstack[$0 - 2] + '|' + yyvstack[$0];
    break;

case 42:
    /*! Production::    nonempty_regex_list : '|' regex_list */
    this.$ = '|' + yyvstack[$0];
    break;

case 46:
    /*! Production::    regex_base : '(' regex_list ')' */
    this.$ = '(' + yyvstack[$0 - 1] + ')';
    break;

case 47:
    /*! Production::    regex_base : SPECIAL_GROUP regex_list ')' */
    this.$ = yyvstack[$0 - 2] + yyvstack[$0 - 1] + ')';
    break;

case 48:
    /*! Production::    regex_base : regex_base '+' */
    this.$ = yyvstack[$0 - 1] + '+';
    break;

case 49:
    /*! Production::    regex_base : regex_base '*' */
    this.$ = yyvstack[$0 - 1] + '*';
    break;

case 50:
    /*! Production::    regex_base : regex_base '?' */
    this.$ = yyvstack[$0 - 1] + '?';
    break;

case 51:
    /*! Production::    regex_base : '/' regex_base */
    this.$ = '(?=' + yyvstack[$0] + ')';
    break;

case 52:
    /*! Production::    regex_base : '/!' regex_base */
    this.$ = '(?!' + yyvstack[$0] + ')';
    break;

case 56:
    /*! Production::    regex_base : '.' */
    this.$ = '.';
    break;

case 57:
    /*! Production::    regex_base : '^' */
    this.$ = '^';
    break;

case 58:
    /*! Production::    regex_base : '$' */
    this.$ = '$';
    break;

case 62:
    /*! Production::    any_group_regex : REGEX_SET_START regex_set REGEX_SET_END */
case 78:
    /*! Production::    extra_lexer_module_code : optional_module_code_chunk include_macro_code extra_lexer_module_code */
    this.$ = yyvstack[$0 - 2] + yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 66:
    /*! Production::    regex_set_atom : name_expansion */
    if (XRegExp._getUnicodeProperty(yyvstack[$0].replace(/[{}]/g, ''))
        && yyvstack[$0].toUpperCase() !== yyvstack[$0]
    ) {
        // treat this as part of an XRegExp `\p{...}` Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories
        this.$ = yyvstack[$0];
    } else {
        this.$ = yyvstack[$0];
    }
    //console.log("name expansion for: ", { name: $name_expansion, redux: $name_expansion.replace(/[{}]/g, ''), output: $$ });
    break;

case 69:
    /*! Production::    string : STRING_LIT */
    this.$ = prepareString(yyvstack[$0].substr(1, yyvstack[$0].length - 2));
    break;

case 74:
    /*! Production::    option : NAME[option] */
    yy.options[yyvstack[$0]] = true;
    break;

case 75:
    /*! Production::    option : NAME[option] '=' OPTION_VALUE[value] */
case 76:
    /*! Production::    option : NAME[option] '=' NAME[value] */
    yy.options[yyvstack[$0 - 2]] = yyvstack[$0];
    break;

case 79:
    /*! Production::    include_macro_code : INCLUDE PATH */
    var fs = require('fs');
    var fileContent = fs.readFileSync(yyvstack[$0], { encoding: 'utf-8' });
    // And no, we don't support nested '%include':
    this.$ = '\n// Included by Jison: ' + yyvstack[$0] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + yyvstack[$0] + '\n\n';
    break;

case 80:
    /*! Production::    include_macro_code : INCLUDE error */
    console.error("%include MUST be followed by a valid file path");
    break;

}
},
table: bt({
  len: u([
  11,
  1,
  13,
  1,
  13,
  21,
  2,
  2,
  5,
  s,
  [9, 4],
  2,
  3,
  20,
  1,
  9,
  9,
  28,
  31,
  28,
  22,
  22,
  17,
  17,
  s,
  [27, 7],
  29,
  5,
  s,
  [27, 3],
  s,
  [10, 4],
  2,
  3,
  25,
  25,
  1,
  4,
  3,
  1,
  1,
  6,
  18,
  16,
  21,
  3,
  31,
  28,
  10,
  10,
  s,
  [27, 5],
  1,
  1,
  28,
  28,
  1,
  6,
  3,
  3,
  10,
  10,
  9,
  5,
  3,
  9,
  1,
  2,
  1,
  s,
  [3, 3],
  6,
  1,
  16,
  6,
  2,
  1,
  2,
  c,
  [33, 4],
  1,
  s,
  [2, 3],
  c,
  [31, 3],
  1,
  16,
  5,
  17,
  16,
  17,
  c,
  [107, 3],
  4,
  1,
  1,
  2,
  17,
  2,
  3,
  16
]),
  symbol: u([
  3,
  19,
  20,
  22,
  27,
  29,
  31,
  34,
  37,
  67,
  73,
  1,
  3,
  21,
  22,
  26,
  c,
  [12, 4],
  35,
  36,
  c,
  [14, 3],
  22,
  c,
  [14, 13],
  9,
  10,
  s,
  [14, 4, 1],
  28,
  46,
  s,
  [48, 5, 1],
  s,
  [54, 5, 1],
  63,
  65,
  66,
  30,
  38,
  32,
  38,
  3,
  4,
  33,
  43,
  44,
  3,
  c,
  [67, 8],
  c,
  [9, 27],
  2,
  74,
  27,
  68,
  70,
  1,
  5,
  c,
  [73, 6],
  22,
  23,
  25,
  39,
  40,
  50,
  51,
  c,
  [70, 5],
  22,
  c,
  [53, 19],
  9,
  10,
  11,
  c,
  [39, 5],
  c,
  [16, 5],
  c,
  [115, 12],
  c,
  [28, 16],
  s,
  [46, 7, 1],
  c,
  [31, 11],
  7,
  s,
  [9, 9, 1],
  c,
  [34, 6],
  50,
  51,
  53,
  c,
  [27, 3],
  s,
  [64, 4, 1],
  c,
  [197, 3],
  c,
  [58, 5],
  c,
  [52, 15],
  c,
  [22, 22],
  c,
  [167, 5],
  c,
  [17, 29],
  c,
  [106, 19],
  c,
  [105, 8],
  c,
  [27, 183],
  60,
  s,
  [62, 6, 1],
  73,
  52,
  57,
  59,
  61,
  62,
  c,
  [115, 82],
  c,
  [17, 6],
  38,
  c,
  [10, 33],
  4,
  3,
  4,
  44,
  1,
  3,
  c,
  [554, 8],
  c,
  [70, 10],
  c,
  [69, 4],
  76,
  c,
  [25, 25],
  69,
  27,
  68,
  69,
  70,
  18,
  27,
  69,
  s,
  [1, 3],
  24,
  72,
  73,
  75,
  76,
  c,
  [619, 9],
  c,
  [617, 9],
  c,
  [18, 9],
  c,
  [16, 7],
  c,
  [724, 21],
  7,
  27,
  45,
  c,
  [610, 59],
  3,
  11,
  c,
  [707, 9],
  c,
  [10, 10],
  c,
  [498, 134],
  11,
  11,
  c,
  [185, 29],
  c,
  [28, 27],
  60,
  c,
  [528, 3],
  60,
  61,
  62,
  57,
  60,
  c,
  [3, 4],
  c,
  [444, 27],
  c,
  [443, 4],
  c,
  [1037, 4],
  4,
  c,
  [1040, 10],
  69,
  27,
  71,
  1,
  1,
  35,
  73,
  1,
  c,
  [440, 3],
  c,
  [3, 3],
  c,
  [408, 6],
  c,
  [391, 16],
  3,
  34,
  35,
  41,
  42,
  73,
  6,
  8,
  6,
  6,
  8,
  c,
  [309, 91],
  60,
  3,
  4,
  27,
  69,
  c,
  [542, 4],
  c,
  [133, 6],
  c,
  [142, 3],
  c,
  [136, 17],
  c,
  [189, 4],
  c,
  [21, 9],
  34,
  c,
  [565, 23],
  c,
  [33, 17],
  c,
  [15, 6],
  c,
  [13, 7],
  27,
  c,
  [14, 13],
  3,
  4,
  c,
  [81, 3],
  1,
  3,
  4,
  c,
  [52, 17],
  c,
  [234, 3],
  c,
  [739, 3],
  c,
  [90, 15]
]),
  type: u([
  2,
  0,
  0,
  s,
  [2, 8],
  1,
  2,
  0,
  2,
  c,
  [13, 5],
  c,
  [19, 7],
  c,
  [14, 14],
  c,
  [11, 6],
  c,
  [13, 4],
  c,
  [6, 6],
  c,
  [33, 9],
  c,
  [32, 11],
  s,
  [2, 31],
  c,
  [74, 17],
  c,
  [55, 39],
  c,
  [47, 27],
  c,
  [146, 15],
  c,
  [64, 24],
  c,
  [52, 35],
  c,
  [22, 20],
  c,
  [17, 34],
  s,
  [2, 213],
  c,
  [472, 3],
  c,
  [227, 180],
  c,
  [688, 7],
  c,
  [616, 5],
  c,
  [436, 12],
  c,
  [204, 30],
  c,
  [504, 17],
  c,
  [47, 15],
  c,
  [610, 52],
  c,
  [307, 171],
  c,
  [28, 36],
  c,
  [335, 4],
  c,
  [227, 39],
  c,
  [294, 20],
  c,
  [19, 9],
  c,
  [408, 14],
  c,
  [355, 13],
  c,
  [243, 107],
  c,
  [204, 26],
  c,
  [135, 82],
  c,
  [81, 44]
]),
  state: u([
  s,
  [1, 4, 1],
  10,
  11,
  16,
  c,
  [4, 3],
  17,
  18,
  19,
  21,
  26,
  27,
  31,
  32,
  38,
  40,
  42,
  43,
  46,
  47,
  49,
  52,
  53,
  54,
  57,
  c,
  [15, 4],
  59,
  58,
  c,
  [23, 6],
  63,
  59,
  65,
  c,
  [9, 6],
  59,
  66,
  c,
  [8, 6],
  67,
  c,
  [5, 4],
  68,
  c,
  [5, 4],
  72,
  69,
  70,
  79,
  47,
  81,
  82,
  83,
  87,
  54,
  88,
  c,
  [68, 7],
  89,
  59,
  92,
  c,
  [54, 7],
  63,
  63,
  72,
  96,
  70,
  97,
  43,
  101,
  103,
  82,
  83,
  107,
  104,
  106,
  113,
  82,
  83,
  115,
  43,
  118
]),
  mode: u([
  s,
  [2, 9],
  1,
  2,
  s,
  [1, 9],
  c,
  [10, 10],
  s,
  [1, 13],
  s,
  [2, 39],
  c,
  [44, 11],
  c,
  [51, 28],
  c,
  [103, 7],
  c,
  [52, 11],
  c,
  [13, 5],
  c,
  [23, 24],
  c,
  [27, 6],
  c,
  [67, 15],
  c,
  [72, 11],
  c,
  [189, 32],
  c,
  [202, 52],
  s,
  [2, 179],
  c,
  [220, 90],
  c,
  [89, 20],
  c,
  [20, 13],
  c,
  [123, 4],
  c,
  [126, 51],
  c,
  [434, 4],
  c,
  [494, 9],
  c,
  [567, 30],
  c,
  [454, 16],
  c,
  [556, 49],
  c,
  [441, 158],
  c,
  [184, 27],
  c,
  [767, 30],
  c,
  [111, 53],
  c,
  [56, 5],
  c,
  [94, 10],
  c,
  [362, 20],
  c,
  [683, 103],
  c,
  [436, 8],
  c,
  [635, 45],
  c,
  [689, 53],
  c,
  [211, 23],
  c,
  [22, 17]
]),
  goto: u([
  s,
  [6, 9],
  8,
  8,
  5,
  6,
  7,
  9,
  12,
  14,
  13,
  15,
  c,
  [10, 9],
  20,
  22,
  24,
  28,
  29,
  30,
  23,
  25,
  33,
  34,
  37,
  35,
  36,
  39,
  41,
  s,
  [31, 3],
  s,
  [13, 9],
  s,
  [14, 9],
  s,
  [15, 9],
  s,
  [16, 9],
  45,
  44,
  48,
  50,
  55,
  s,
  [35, 6],
  51,
  s,
  [35, 7],
  7,
  s,
  [9, 9],
  s,
  [38, 9],
  43,
  56,
  22,
  43,
  c,
  [94, 4],
  s,
  [43, 6],
  c,
  [100, 7],
  43,
  43,
  40,
  20,
  22,
  40,
  c,
  [23, 4],
  s,
  [40, 6],
  c,
  [23, 7],
  40,
  40,
  45,
  61,
  s,
  [45, 3],
  60,
  62,
  s,
  [45, 15],
  64,
  s,
  [45, 4],
  c,
  [49, 7],
  c,
  [43, 7],
  c,
  [14, 14],
  c,
  [192, 12],
  c,
  [12, 12],
  s,
  [53, 27],
  s,
  [55, 27],
  s,
  [56, 27],
  s,
  [57, 27],
  s,
  [58, 27],
  s,
  [59, 27],
  s,
  [60, 27],
  s,
  [61, 29],
  33,
  71,
  s,
  [69, 27],
  s,
  [70, 27],
  s,
  [67, 27],
  s,
  [10, 7],
  73,
  10,
  10,
  s,
  [17, 10],
  s,
  [11, 7],
  74,
  11,
  11,
  s,
  [19, 10],
  76,
  75,
  29,
  29,
  77,
  s,
  [79, 25],
  s,
  [80, 25],
  78,
  48,
  73,
  80,
  74,
  74,
  1,
  2,
  s,
  [84, 3],
  86,
  c,
  [567, 7],
  85,
  s,
  [35, 7],
  s,
  [22, 16],
  c,
  [656, 13],
  90,
  91,
  c,
  [556, 23],
  44,
  61,
  s,
  [44, 3],
  60,
  62,
  s,
  [44, 15],
  64,
  s,
  [44, 4],
  s,
  [42, 10],
  s,
  [39, 10],
  s,
  [48, 27],
  s,
  [49, 27],
  s,
  [50, 27],
  s,
  [54, 27],
  s,
  [68, 27],
  93,
  94,
  51,
  61,
  s,
  [51, 3],
  60,
  62,
  s,
  [51, 15],
  64,
  s,
  [51, 4],
  52,
  61,
  s,
  [52, 3],
  60,
  62,
  s,
  [52, 15],
  64,
  s,
  [52, 4],
  95,
  33,
  64,
  71,
  s,
  [65, 3],
  s,
  [66, 3],
  s,
  [18, 10],
  s,
  [20, 10],
  s,
  [12, 9],
  s,
  [31, 3],
  s,
  [32, 3],
  s,
  [71, 9],
  72,
  99,
  98,
  100,
  77,
  13,
  83,
  83,
  102,
  s,
  [81, 3],
  s,
  [84, 3],
  5,
  s,
  [21, 16],
  105,
  108,
  13,
  109,
  110,
  111,
  36,
  36,
  s,
  [41, 10],
  s,
  [46, 27],
  s,
  [47, 27],
  s,
  [62, 27],
  63,
  76,
  112,
  75,
  75,
  76,
  76,
  3,
  s,
  [84, 3],
  s,
  [82, 3],
  114,
  s,
  [23, 16],
  s,
  [31, 3],
  s,
  [25, 9],
  116,
  s,
  [25, 7],
  s,
  [26, 16],
  s,
  [27, 17],
  s,
  [33, 13],
  117,
  s,
  [34, 13],
  s,
  [31, 3],
  78,
  4,
  76,
  119,
  s,
  [28, 17],
  37,
  37,
  30,
  30,
  77,
  s,
  [24, 16]
])
}),
defaultActions: {
  16: 7,
  49: 1,
  50: 2,
  79: 72,
  86: 5,
  96: 63,
  100: 3,
  113: 78,
  114: 4
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
        hash.destroy();             // destroy... well, *almost*!
        // assert('recoverable' in hash);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = new Array(128),         // token stack: stores token which leads to state at the same index (column storage)
        sstack = new Array(128),        // state stack: stores states (column storage)

        vstack = new Array(128),        // semantic value stack

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

    var sharedState = {
      yy: {
        parseError: null,
        quoteName: null,
        lexer: null,
        parser: null,
        pre_parse: null,
        post_parse: null
      }
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;






    lexer.setInput(input, sharedState.yy);






    vstack[sp] = null;
    sstack[sp] = 0;
    stack[sp] = 0;
    ++sp;

    if (typeof lexer.yytext === 'undefined') {
        lexer.yytext = '';
    }
    var yytext = lexer.yytext;
    if (typeof lexer.yylineno === 'undefined') {
        lexer.yylineno = 0;
    }


    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = this.originalParseError;
    }

    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState.yy.quoteName === 'function') {
        this.quoteName = sharedState.yy.quoteName;
    } else {
        this.quoteName = this.originalQuoteName;
    }

    // set up the cleanup function; make it an API so that external code can re-use this one in case of
    // calamities or when the `%options no-try-catch` option has been specified for the grammar, in which
    // case this parse() API method doesn't come with a `finally { ... }` block any more!
    //
    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `sharedState`, etc. references will be *wrong*!
    this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods) {
        var rv;

        if (invoke_post_methods) {
            if (sharedState.yy.post_parse) {
                rv = sharedState.yy.post_parse.call(this, sharedState.yy, resultValue);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
            if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState.yy, resultValue);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
        }

        if (this.__reentrant_call_depth > 1) return resultValue;        // do not (yet) kill the sharedState when this is a reentrant run.

        // prevent lingering circular references from causing memory leaks:
        if (sharedState.yy) {
            sharedState.yy.parseError = undefined;
            sharedState.yy.quoteName = undefined;
            sharedState.yy.lexer = undefined;
            sharedState.yy.parser = undefined;
            if (lexer.yy === sharedState.yy) {
                lexer.yy = undefined;
            }
        }
        sharedState.yy = undefined;
        this.parseError = this.originalParseError;
        this.quoteName = this.originalQuoteName;

        // nuke the vstack[] array at least as that one will still reference obsoleted user values.
        // To be safe, we nuke the other internal stack columns as well...
        stack.length = 0;               // fastest way to nuke an array without overly bothering the GC
        sstack.length = 0;

        vstack.length = 0;
        stack_pointer = 0;

        return resultValue;
    };

    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `lexer`, `sharedState`, etc. references will be *wrong*!
    this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected, recoverable) {
        return {
            errStr: msg,
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,

            expected: expected,
            recoverable: recoverable,
            state: state,
            action: action,
            new_state: newState,
            symbol_stack: stack,
            state_stack: sstack,
            value_stack: vstack,

            stack_pointer: sp,
            yy: sharedState.yy,
            lexer: lexer,

            // and make sure the error info doesn't stay due to potential ref cycle via userland code manipulations (memory leak opportunity!):
            destroy: function destructParseErrorInfo() {
                // remove cyclic references added to error info:
                // info.yy = null;
                // info.lexer = null;
                // info.value = null;
                // info.value_stack = null;
                // ...
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this.hasOwnProperty(key) && typeof key !== 'function') {
                        this[key] = undefined;
                    }
                }
                this.recoverable = rec;
            }
        };
    };


    function lex() {
        var token = lexer.lex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token || EOF;
    }


    var symbol = 0;
    var preErrorSymbol = 0;
    var state, action, r, t;
    var yyval = {
        $: true,
        _$: undefined
    };
    var p, len, this_production;

    var newState;
    var retval = false;


    // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = sp - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            var t = table[state][TERROR] || NO_ACTION;
            if (t[0]) {
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 1) {
                return -1; // No suitable error recovery rule available.
            }
            --stack_probe; // popStack(1): [symbol, action]
            state = sstack[stack_probe];
            ++depth;
        }
    }

    try {
        this.__reentrant_call_depth++;

        if (this.pre_parse) {
            this.pre_parse.call(this, sharedState.yy);
        }
        if (sharedState.yy.pre_parse) {
            sharedState.yy.pre_parse.call(this, sharedState.yy);
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
                    symbol = lex();
                }
                // read action for current state and first input
                t = (table[state] && table[state][symbol]) || NO_ACTION;
                newState = t[1];
                action = t[0];




                // handle parse error
                if (!action) {
                    // first see if there's any chance at hitting an error recovery rule:
                    var error_rule_depth = locateNearestErrorRecoveryRule(state);
                    var errStr = null;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    if (!recovering) {
                        // Report error
                        if (lexer.showPosition) {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition(79 - 10, 10) + '\n';
                        } else {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                        }
                        if (expected.length) {
                            errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                        } else {
                            errStr += 'Unexpected ' + errSymbolDescr;
                        }
                        p = this.constructParseErrorInfo(errStr, null, expected, (error_rule_depth >= 0));
                        r = this.parseError(p.errStr, p);


                        if (!p.recoverable) {
                            retval = r;
                            break;
                        } else {
                            // TODO: allow parseError callback to edit symbol and or state tat the start of the error recovery process...
                        }
                    }



                    // just recovered from another error
                    if (recovering === ERROR_RECOVERY_TOKEN_DISCARD_COUNT && error_rule_depth >= 0) {
                        // only barf a fatal hairball when we're out of look-ahead symbols and none hit a match;
                        // this DOES discard look-ahead while recovering from an error when said look-ahead doesn't
                        // suit the error recovery rules... The error HAS been reported already so we're fine with
                        // throwing away a few items if that is what it takes to match the nearest recovery rule!
                        if (symbol === EOF || preErrorSymbol === EOF) {
                            p = this.constructParseErrorInfo((errStr || 'Parsing halted while starting to recover from another error.'), null, expected, false);
                            retval = this.parseError(p.errStr, p);
                            break;
                        }

                        // discard current lookahead and grab another

                        yytext = lexer.yytext;



                        symbol = lex();


                    }

                    // try to recover from error
                    if (error_rule_depth < 0) {
                        p = this.constructParseErrorInfo((errStr || 'Parsing halted. No suitable error recovery rule available.'), null, expected, false);
                        retval = this.parseError(p.errStr, p);
                        break;
                    }
                    sp -= error_rule_depth;

                    preErrorSymbol = (symbol === TERROR ? 0 : symbol); // save the lookahead token
                    symbol = TERROR;            // insert generic error symbol as new lookahead
                    // allow N (default: 3) real symbols to be shifted before reporting a new error
                    recovering = ERROR_RECOVERY_TOKEN_DISCARD_COUNT;

                    newState = sstack[sp - 1];



                    continue;
                }
            }


            switch (action) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action instanceof Array) {
                    p = this.constructParseErrorInfo(('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol), null, null, false);
                    retval = this.parseError(p.errStr, p);
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                retval = this.parseError(p.errStr, p);
                break;

            // shift:
            case 1:
                //this.shiftCount++;
                stack[sp] = symbol;
                vstack[sp] = lexer.yytext;

                sstack[sp] = newState; // push state
                ++sp;
                symbol = 0;
                if (!preErrorSymbol) { // normal execution / no error
                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:

                    yytext = lexer.yytext;



                    if (recovering > 0) {
                        recovering--;

                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                    symbol = preErrorSymbol;
                    preErrorSymbol = 0;

                    // read action for current state and first input
                    t = (table[newState] && table[newState][symbol]) || NO_ACTION;
                    if (!t[0]) {
                        // forget about that symbol and move forward: this wasn't an 'forgot to insert' error type where
                        // (simple) stuff might have been missing before the token which caused the error we're
                        // recovering from now...

                        symbol = 0;
                    }
                }

                continue;

            // reduce:
            case 2:
                //this.reductionCount++;
                this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                len = this_production[1];






                // Make sure subsequent `$$ = $1` default action doesn't fail
                // for rules where len==0 as then there's no $1 (you're reducing an epsilon rule then!)
                //
                // Also do this to prevent nasty action block codes to *read* `$0` or `$$`
                // and *not* get `undefined` as a result for their efforts!
                vstack[sp] = undefined;

                // perform semantic action
                yyval.$ = vstack[sp - len]; // default to $$ = $1; result must produce `undefined` when len == 0, as then there's no $1










                r = this.performAction.call(yyval, yytext, sharedState.yy, newState, sp - 1, vstack);

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

                // goto new state = table[STATE][NONTERMINAL]
                newState = table[sstack[sp - 1]][ntsymbol];
                sstack[sp] = newState;
                ++sp;

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
        retval = this.parseError(p.errStr, p);
    } finally {
        retval = this.cleanupAfterParse(retval, true);
        this.__reentrant_call_depth--;
    }

    return retval;
}
};
parser.originalParseError = parser.parseError;
parser.originalQuoteName = parser.quoteName;
var XRegExp = require('xregexp');

function encodeRE (s) {
    return s.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1').replace(/\\\\u([a-fA-F0-9]{4})/g, '\\u$1');
}

function prepareString (s) {
    // unescape slashes
    s = s.replace(/\\\\/g, "\\");
    s = encodeRE(s);
    return s;
};
/* generated by jison-lex 0.3.4-153 */
var lexer = (function () {
// See also:
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
// with userland code which might access the derived class in a 'classic' way.
function JisonLexerError(msg, hash) {
    Object.defineProperty(this, 'name', {
        enumerable: false,
        writable: false,
        value: 'JisonLexerError'
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

    if (typeof Object.setPrototypeOf === 'function') {
        Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
    } else {
        JisonLexerError.prototype = Object.create(Error.prototype);
    }
    JisonLexerError.prototype.constructor = JisonLexerError;
    JisonLexerError.prototype.name = 'JisonLexerError';


var lexer = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,        // <-- injected by the code generator

    // options: {},                             // <-- injected by the code generator

    // yy: ...,                                 // <-- injected by setInput()

    __currentRuleSet__: null,                   // <-- internal rule set cache for the current lexer state

    parseError: function lexer_parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

    // clear the lexer token context; intended for internal use only
    clear: function lexer_clear() {
        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        this.matches = false;
        this._more = false;
        this._backtrack = false;
    },

    // resets the lexer, sets new input
    setInput: function lexer_setInput(input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this.clear();
        this._signaled_error_token = this.done = false;
        this.yylineno = 0;
        this.matched = '';
        this.conditionStack = ['INITIAL'];
        this.__currentRuleSet__ = null;
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
    },

    // consumes and returns one char from the input
    input: function lexer_input() {
        if (!this._input) {
            this.done = true;
            return null;
        }
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        // Count the linenumber up when we hit the LF (or a stand-alone CR).
        // On CRLF, the linenumber is incremented when you fetch the CR or the CRLF combo
        // and we advance immediately past the LF as well, returning both together as if
        // it was all a single 'character' only.
        var slice_len = 1;
        var lines = false;
        if (ch === '\n') {
            lines = true;
        } else if (ch === '\r') {
            lines = true;
            var ch2 = this._input[1];
            if (ch2 === '\n') {
                slice_len++;
                ch += ch2;
                this.yytext += ch2;
                this.yyleng++;
                this.offset++;
                this.match += ch2;
                this.matched += ch2;
                if (this.options.ranges) {
                    this.yylloc.range[1]++;
                }
            }
        }
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(slice_len);
        return ch;
    },

    // unshifts one char (or a string) into the input
    unput: function lexer_unput(ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - len);
        this.matched = this.matched.substr(0, this.matched.length - len);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }

        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = (lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                + oldLines[oldLines.length - lines.length].length - lines[0].length :
                this.yylloc.first_column - len);

        if (this.options.ranges) {
            this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng - len;
        }
        this.yyleng = this.yytext.length;
        this.done = false;
        return this;
    },

    // When called from action, caches matched text and appends it on next action
    more: function lexer_more() {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function lexer_reject() {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            // when the parseError() call returns, we MUST ensure that the error is registered.
            // We accomplish this by signaling an 'error' token to be produced for the current
            // .lex() run.
            this._signaled_error_token = (this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: this.match,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR);
        }
        return this;
    },

    // retain first n characters of the match
    less: function lexer_less(n) {
        return this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    pastInput: function lexer_pastInput(maxSize, maxLines) {
        var past = this.matched.substring(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = past.length;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substr` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        past = past.substr(-maxSize * 2 - 2);
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = past.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(-maxLines);
        past = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis prefix...
        if (past.length > maxSize) {
            past = '...' + past.substr(-maxSize);
        }
        return past;
    },

    // return (part of the) upcoming input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = maxSize;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substring` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        if (next.length < maxSize * 2 + 2) {
            next += this._input.substring(0, maxSize * 2 + 2);  // substring is faster on Chrome/V8
        }
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = next.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(0, maxLines);
        next = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis postfix...
        if (next.length > maxSize) {
            next = next.substring(0, maxSize) + '...';
        }
        return next;
    },

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
        var pre = this.pastInput(maxPrefix).replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput(maxPostfix).replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // helper function, used to produce a human readable description as a string, given
    // the input `yylloc` location object. 
    // Set `display_range_too` to TRUE to include the string character inex position(s)
    // in the description if the `yylloc.range` is available. 
    describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
        var l1 = yylloc.first_line;
        var l2 = yylloc.last_line;
        var o1 = yylloc.first_column;
        var o2 = yylloc.last_column - 1;
        var dl = l2 - l1;
        var d_o = (dl === 0 ? o2 - o1 : 1000);
        var rv;
        if (dl === 0) {
            rv = 'line ' + l1 + ', ';
            if (d_o === 0) {
                rv += 'column ' + o1;
            } else {
                rv += 'columns ' + o1 + ' .. ' + o2;
            }
        } else {
            rv = 'lines ' + l1 + '(column ' + o1 + ') .. ' + l2 + '(column ' + o2 + ')';
        }
        if (yylloc.range && display_range_too) {
            var r1 = yylloc.range[0];
            var r2 = yylloc.range[1] - 1;
            if (r2 === r1) {
                rv += ' {String Offset: ' + r1 + '}';
            } else {
                rv += ' {String Offset range: ' + r1 + ' .. ' + r2 + '}';
            }
        }
        return rv;
        // return JSON.stringify(yylloc);
    },

    // test the lexed token: return FALSE when not a match, otherwise return token.
    //
    // `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
    // contains the actually matched text string.
    //
    // Also move the input cursor forward and update the match collectors:
    // - yytext
    // - yyleng
    // - match
    // - matches
    // - yylloc
    // - offset
    test_match: function lexer_test_match(match, indexed_rule) {
        var token,
            lines,
            backup,
            match_str;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        match_str = match[0];
        lines = match_str.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match_str.length
        };
        this.yytext += match_str;
        this.match += match_str;
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        // previous lex rules MAY have invoked the `more()` API rather than producing a token:
        // those rules will already have moved this `offset` forward matching their match lengths,
        // hence we must only add our own match length now:
        this.offset += match_str.length;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match_str.length);
        this.matched += match_str;
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            this.__currentRuleSet__ = null;
            return false; // rule action called reject() implying the next rule should be tested instead.
        } else if (this._signaled_error_token) {
            // produce one 'error' token as .parseError() in reject() did not guarantee a failure signal by throwing an exception!
            token = this._signaled_error_token;
            this._signaled_error_token = false;
            return token;
        }
        return false;
    },

    // return next match in input
    next: function lexer_next() {
        if (this.done) {
            this.clear();
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.clear();
        }
        var rules = this.__currentRuleSet__;
        if (!rules) {
            // Update the ruleset cache as we apparently encountered a state change or just started lexing.
            // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
            // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
            // speed up those activities a tiny bit.
            rules = this.__currentRuleSet__ = this._currentRules();
        }
        for (var i = 0, len = rules.length; i < len; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = undefined;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === '') {
            this.clear();
            this.done = true;
            return this.EOF;
        } else {
            token = this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: this.match + this._input,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR;
            if (token === this.ERROR) {
                // we can try to recover from a lexer error that parseError() did not 'recover' for us, by moving forward at least one character at a time:
                if (!this.match.length) {
                    this.input();
                }
            }
            return token;
        }
    },

    // return next match that has a token
    lex: function lexer_lex() {
        var r;
        // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
        if (typeof this.options.pre_lex === 'function') {
            r = this.options.pre_lex.call(this);
        }
        while (!r) {
            r = this.next();
        }
        if (typeof this.options.post_lex === 'function') {
            // (also account for a userdef function which does not return any value: keep the token as is)
            r = this.options.post_lex.call(this, r) || r;
        }
        return r;
    },

    // backwards compatible alias for `pushState()`;
    // the latter is symmetrical with `popState()` and we advise to use
    // those APIs in any modern lexer code, rather than `begin()`.
    begin: function lexer_begin(condition) {
        return this.pushState(condition);
    },

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    pushState: function lexer_pushState(condition) {
        this.conditionStack.push(condition);
        this.__currentRuleSet__ = null;
        return this;
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function lexer_popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            this.__currentRuleSet__ = null;
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function lexer_topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // (internal) determine the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function lexer__currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the number of states currently on the stack
    stateStackSize: function lexer_stateStackSize() {
        return this.conditionStack.length;
    },
options: {
  easy_keyword_rules: true,
  ranges: true
},
JisonLexerError: JisonLexerError,
performAction: function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 7 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++; return 3; 
break;
case 8 : 
/*! Conditions:: action */ 
/*! Rule::       \} */ 
 
                                            if (yy.depth == 0) { 
                                                this.begin('trail'); 
                                            } else { 
                                                yy.depth--; 
                                            } 
                                            return 4;
                                         
break;
case 10 : 
/*! Conditions:: conditions */ 
/*! Rule::       > */ 
 this.popState(); return 6; 
break;
case 13 : 
/*! Conditions:: rules */ 
/*! Rule::       {BR}+ */ 
 /* empty */ 
break;
case 14 : 
/*! Conditions:: rules */ 
/*! Rule::       {WS}+{BR}+ */ 
 /* empty */ 
break;
case 15 : 
/*! Conditions:: rules */ 
/*! Rule::       {WS}+ */ 
 this.begin('indented'); 
break;
case 16 : 
/*! Conditions:: rules */ 
/*! Rule::       %% */ 
 this.begin('code'); return 22; 
break;
case 17 : 
/*! Conditions:: rules */ 
/*! Rule::       [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,\'\";]+ */ 
 
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 66;
                                         
break;
case 20 : 
/*! Conditions:: options */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 71; 
break;
case 21 : 
/*! Conditions:: options */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 71; 
break;
case 23 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}+ */ 
 this.popState(); return 69; 
break;
case 24 : 
/*! Conditions:: options */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 26 : 
/*! Conditions:: start_condition */ 
/*! Rule::       {BR}+ */ 
 this.popState(); 
break;
case 27 : 
/*! Conditions:: start_condition */ 
/*! Rule::       {WS}+ */ 
 /* empty */ 
break;
case 28 : 
/*! Conditions:: trail */ 
/*! Rule::       {WS}*{BR}+ */ 
 this.begin('rules'); 
break;
case 29 : 
/*! Conditions:: indented */ 
/*! Rule::       \{ */ 
 yy.depth = 0; this.begin('action'); return 3; 
break;
case 30 : 
/*! Conditions:: indented */ 
/*! Rule::       %\{(.|{BR})*?%\} */ 
 this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 34; 
break;
case 31 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       %\{(.|{BR})*?%\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 34; 
break;
case 32 : 
/*! Conditions:: indented */ 
/*! Rule::       %include\b */ 
 
                                            // This is an include instruction in place of an action:
                                            // thanks to the `<indented>.+` rule immediately below we need to semi-duplicate
                                            // the `%include` token recognition here vs. the almost-identical rule for the same
                                            // further below.
                                            // There's no real harm as we need to do something special in this case anyway:
                                            // push 2 (two!) conditions.
                                            //
                                            // (Anecdotal: to find that we needed to place this almost-copy here to make the test grammar
                                            // parse correctly took several hours as the debug facilities were - and are - too meager to
                                            // quickly diagnose the problem while we hadn't. So the code got littered with debug prints
                                            // and finally it hit me what the *F* went wrong, after which I saw I needed to add *this* rule!)

                                            // first push the 'trail' condition which will be the follow-up after we're done parsing the path parameter...
                                            this.pushState('trail');
                                            // then push the immediate need: the 'path' condition.
                                            this.pushState('path');
                                            return 73;
                                         
break;
case 33 : 
/*! Conditions:: indented */ 
/*! Rule::       .* */ 
 this.popState(); return 34; 
break;
case 34 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
 /* ignore */ 
break;
case 35 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \/\/[^\r\n]* */ 
 /* ignore */ 
break;
case 36 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {ID} */ 
 this.pushState('macro'); return 27; 
break;
case 37 : 
/*! Conditions:: macro */ 
/*! Rule::       {BR}+ */ 
 this.popState('macro'); 
break;
case 38 : 
/*! Conditions:: macro */ 
/*! Rule::       [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,'""]+ */ 
 
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 66;
                                         
break;
case 39 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       {BR}+ */ 
 /* empty */ 
break;
case 40 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 41 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.replace(/\\"/g,'"'); return 65; 
break;
case 42 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.replace(/\\'/g,"'"); return 65; 
break;
case 43 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \[ */ 
 this.pushState('set'); return 58; 
break;
case 56 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       < */ 
 this.begin('conditions'); return 5; 
break;
case 57 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \/! */ 
 return 51;                    // treated as `(?!atom)` 
break;
case 58 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \/ */ 
 return 14;                     // treated as `(?=atom)` 
break;
case 60 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       \\. */ 
 yy_.yytext = yy_.yytext.replace(/^\\/g, ''); return 63; 
break;
case 63 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       %options\b */ 
 this.begin('options'); return 67; 
break;
case 64 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       %s\b */ 
 this.begin('start_condition'); return 29; 
break;
case 65 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       %x\b */ 
 this.begin('start_condition'); return 31; 
break;
case 66 : 
/*! Conditions:: INITIAL trail code */ 
/*! Rule::       %include\b */ 
 this.pushState('path'); return 73; 
break;
case 67 : 
/*! Conditions:: INITIAL rules trail code */ 
/*! Rule::       %{NAME}[^\r\n]+ */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported lexer option: ', yy_.yytext + ' while lexing in ' + this.topState() + ' state:', this._input, ' /////// ', this.matched);
                                            return 37;
                                         
break;
case 68 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       %% */ 
 this.begin('rules'); return 22; 
break;
case 74 : 
/*! Conditions:: indented trail rules macro INITIAL */ 
/*! Rule::       . */ 
 
                                            var l1 = Math.min(79 - 3 - 6, yy_.yylloc.first_column);
                                            var l2 = Math.min(79 - 3 - 6 - l2, 3);
                                            var errdsc = this.showPosition(l1, l2);
                                            throw new Error('unsupported input character: ' + yy_.yytext + '\n' + indent(errdsc, 6) + '\n    @ ' + this.describeYYLLOC(yy_.yylloc)); /* b0rk on bad characters */
                                         
break;
case 78 : 
/*! Conditions:: set */ 
/*! Rule::       \] */ 
 this.popState('set'); return 60; 
break;
case 80 : 
/*! Conditions:: code */ 
/*! Rule::       [^\r\n]+ */ 
 return 76;      // the bit of CODE just before EOF... 
break;
case 81 : 
/*! Conditions:: path */ 
/*! Rule::       {BR} */ 
 this.popState(); this.unput(yy_.yytext); 
break;
case 82 : 
/*! Conditions:: path */ 
/*! Rule::       '[^\r\n]+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 74; 
break;
case 83 : 
/*! Conditions:: path */ 
/*! Rule::       "[^\r\n]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 74; 
break;
case 84 : 
/*! Conditions:: path */ 
/*! Rule::       {WS}+ */ 
 // skip whitespace in the line 
break;
case 85 : 
/*! Conditions:: path */ 
/*! Rule::       [^\s\r\n]+ */ 
 this.popState(); return 74; 
break;
case 86 : 
/*! Conditions:: * */ 
/*! Rule::       . */ 
 
                                            /* ignore unrecognized decl */
                                            var l1 = Math.min(76 - 4, yy_.yylloc.first_column);
                                            var l2 = Math.min(76 - 4 - l2, 3);
                                            console.warn('ignoring unsupported lexer input: ', yy_.yytext, ' @ ' + this.describeYYLLOC(yy_.yylloc) + ' while lexing in ' + this.topState() + ' state:\n', indent(this.showPosition(l1, l2), 4));
                                         
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: action */ 
  /*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
   0 : 44,
  /*! Conditions:: action */ 
  /*! Rule::       \/\/.* */ 
   1 : 44,
  /*! Conditions:: action */ 
  /*! Rule::       \/[^ /]*?['"{}'][^ ]*?\/ */ 
   2 : 44,
  /*! Conditions:: action */ 
  /*! Rule::       "(\\\\|\\"|[^"])*" */ 
   3 : 44,
  /*! Conditions:: action */ 
  /*! Rule::       '(\\\\|\\'|[^'])*' */ 
   4 : 44,
  /*! Conditions:: action */ 
  /*! Rule::       [/"'][^{}/"']+ */ 
   5 : 44,
  /*! Conditions:: action */ 
  /*! Rule::       [^{}/"']+ */ 
   6 : 44,
  /*! Conditions:: conditions */ 
  /*! Rule::       {NAME} */ 
   9 : 27,
  /*! Conditions:: conditions */ 
  /*! Rule::       , */ 
   11 : 8,
  /*! Conditions:: conditions */ 
  /*! Rule::       \* */ 
   12 : 7,
  /*! Conditions:: options */ 
  /*! Rule::       {NAME} */ 
   18 : 27,
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   19 : 18,
  /*! Conditions:: options */ 
  /*! Rule::       [^\s\r\n]+ */ 
   22 : 71,
  /*! Conditions:: start_condition */ 
  /*! Rule::       {ID} */ 
   25 : 38,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \| */ 
   44 : 9,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \(\?: */ 
   45 : 50,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \(\?= */ 
   46 : 50,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \(\?! */ 
   47 : 50,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \( */ 
   48 : 10,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \) */ 
   49 : 11,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \+ */ 
   50 : 12,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \* */ 
   51 : 7,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \? */ 
   52 : 13,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \^ */ 
   53 : 16,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       , */ 
   54 : 8,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       <<EOF>> */ 
   55 : 17,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}) */ 
   59 : 63,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \$ */ 
   61 : 17,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \. */ 
   62 : 15,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \{\d+(,\s?\d+|,)?\} */ 
   69 : 64,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \{{ID}\} */ 
   70 : 57,
  /*! Conditions:: set options */ 
  /*! Rule::       \{{ID}\} */ 
   71 : 57,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \{ */ 
   72 : 3,
  /*! Conditions:: indented trail rules macro INITIAL */ 
  /*! Rule::       \} */ 
   73 : 4,
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   75 : 1,
  /*! Conditions:: set */ 
  /*! Rule::       (?:\\\\|\\\]|[^\]{])+ */ 
   76 : 62,
  /*! Conditions:: set */ 
  /*! Rule::       \{ */ 
   77 : 62,
  /*! Conditions:: code */ 
  /*! Rule::       [^\r\n]*(\r|\n)+ */ 
   79 : 76
},
rules: [
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:\/[^ \/]*?["'{}][^ ]*?\/)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[\/"'][^{}\/"']+)/,
/^(?:[^{}\/"']+)/,
/^(?:\{)/,
/^(?:\})/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-,.\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])?))/,
/^(?:>)/,
/^(?:,)/,
/^(?:\*)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:([^\S\r\n])+(\r\n|\n|\r)+)/,
/^(?:([^\S\r\n])+)/,
/^(?:%%)/,
/^(?:[^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,\'\";]+)/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-,.\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])?))/,
/^(?:=)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[^\s\r\n]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:([^\S\r\n])+)/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*))/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:([^\S\r\n])+)/,
/^(?:([^\S\r\n])*(\r\n|\n|\r)+)/,
/^(?:\{)/,
/^(?:%\{(.|(\r\n|\n|\r))*?%\})/,
/^(?:%\{(.|(\r\n|\n|\r))*?%\})/,
/^(?:%include\b)/,
/^(?:.*)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/[^\r\n]*)/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*))/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:[^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,'""]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:\[)/,
/^(?:\|)/,
/^(?:\(\?:)/,
/^(?:\(\?=)/,
/^(?:\(\?!)/,
/^(?:\()/,
/^(?:\))/,
/^(?:\+)/,
/^(?:\*)/,
/^(?:\?)/,
/^(?:\^)/,
/^(?:,)/,
/^(?:<<EOF>>)/,
/^(?:<)/,
/^(?:\/!)/,
/^(?:\/)/,
/^(?:\\([0-7]{1,3}|[$(-+.\/?BDSW\[-\^bdfnr-tvw{-}]|c[A-Z]|x[0-9A-F]{2}|u[0-9A-Fa-f]{4}))/,
/^(?:\\.)/,
/^(?:\$)/,
/^(?:\.)/,
/^(?:%options\b)/,
/^(?:%s\b)/,
/^(?:%x\b)/,
/^(?:%include\b)/,
/^(?:%([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-,.\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])?)[^\n\r]+)/,
/^(?:%%)/,
/^(?:\{\d+(,\s?\d+|,)?\})/,
/^(?:\{([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*)\})/,
/^(?:\{([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*)\})/,
/^(?:\{)/,
/^(?:\})/,
/^(?:.)/,
/^(?:$)/,
/^(?:(?:\\\\|\\\]|[^\]{])+)/,
/^(?:\{)/,
/^(?:\])/,
/^(?:[^\r\n]*(\r|\n)+)/,
/^(?:[^\r\n]+)/,
/^(?:(\r\n|\n|\r))/,
/^(?:'[^\r\n]+')/,
/^(?:"[^\r\n]+")/,
/^(?:([^\S\r\n])+)/,
/^(?:[^\s\r\n]+)/,
/^(?:.)/
],
conditions: {
  "code": {
    rules: [
      66,
      67,
      75,
      79,
      80,
      86
    ],
    inclusive: false
  },
  "start_condition": {
    rules: [
      25,
      26,
      27,
      75,
      86
    ],
    inclusive: false
  },
  "options": {
    rules: [
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      71,
      75,
      86
    ],
    inclusive: false
  },
  "conditions": {
    rules: [
      9,
      10,
      11,
      12,
      75,
      86
    ],
    inclusive: false
  },
  "action": {
    rules: [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      75,
      86
    ],
    inclusive: false
  },
  "path": {
    rules: [
      75,
      81,
      82,
      83,
      84,
      85,
      86
    ],
    inclusive: false
  },
  "set": {
    rules: [
      71,
      75,
      76,
      77,
      78,
      86
    ],
    inclusive: false
  },
  "indented": {
    rules: [
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      64,
      65,
      68,
      69,
      70,
      72,
      73,
      74,
      75,
      86
    ],
    inclusive: true
  },
  "trail": {
    rules: [
      28,
      31,
      34,
      35,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      64,
      65,
      66,
      67,
      68,
      69,
      70,
      72,
      73,
      74,
      75,
      86
    ],
    inclusive: true
  },
  "rules": {
    rules: [
      13,
      14,
      15,
      16,
      17,
      31,
      34,
      35,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      64,
      65,
      67,
      68,
      69,
      70,
      72,
      73,
      74,
      75,
      86
    ],
    inclusive: true
  },
  "macro": {
    rules: [
      31,
      34,
      35,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      64,
      65,
      68,
      69,
      70,
      72,
      73,
      74,
      75,
      86
    ],
    inclusive: true
  },
  "INITIAL": {
    rules: [
      31,
      34,
      35,
      36,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      64,
      65,
      66,
      67,
      68,
      69,
      70,
      72,
      73,
      74,
      75,
      86
    ],
    inclusive: true
  }
}
};

function indent(s, i) {
    var a = s.split('\n');
    var pf = (new Array(i + 1)).join(' ');
    return pf + a.join('\n' + pf);
};
return lexer;
})();
parser.lexer = lexer;

function Parser() {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
  exports.parser = lexParser;
  exports.Parser = lexParser.Parser;
  exports.parse = function () {
    return lexParser.parse.apply(lexParser, arguments);
  };

}

},{"fs":13,"xregexp":20}],6:[function(require,module,exports){
module.exports={
  "author": {
    "name": "Zach Carter",
    "email": "zach@carter.name",
    "url": "http://zaa.ch"
  },
  "name": "jison-lex",
  "description": "lexical analyzer generator used by jison",
  "license": "MIT",
  "version": "0.3.4-153",
  "keywords": [
    "jison",
    "parser",
    "generator",
    "lexer",
    "flex",
    "tokenizer"
  ],
  "repository": {
    "type": "git",
    "url": "git://github.com/zaach/jison-lex.git"
  },
  "bugs": {
    "email": "jison@librelist.com",
    "url": "http://github.com/zaach/jison-lex/issues"
  },
  "main": "regexp-lexer",
  "bin": "cli.js",
  "engines": {
    "node": ">=4.0"
  },
  "dependencies": {
    "lex-parser": "GerHobbelt/lex-parser#master",
    "nomnom": ">=1.8.1",
    "xregexp": "GerHobbelt/xregexp#master"
  },
  "devDependencies": {
    "test": ">=0.6.0"
  },
  "scripts": {
    "test": "node tests/all-tests.js"
  },
  "directories": {
    "lib": "lib",
    "tests": "tests"
  },
  "homepage": "http://jison.org"
}

},{}],7:[function(require,module,exports){
/* parser generated by jison 0.4.18-153 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}     The so-called "shared state" or rather the *source* of it;
 *               the real "shared state" `yy` passed around to
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
 *               `cleanupAfterParse()` will clean up and reset `quoteName()` to reference this function
 *               at the end of the `parse()`.
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
 *    performAction: function parser__performAction(yytext, yyleng, yylineno, yyloc, yy, yystate, $0, yyvstack, yylstack, yystack, yysstack, ...),
 *               where `...` denotes the (optional) additional arguments the user passed to
 *               `parser.parse(str, ...)`
 *
 *    table: [...],
 *               State transition table
 *               ----------------------
 *
 *               index levels are:
 *               - `state`  --> hash table
 *               - `symbol` --> action (number or array)
 *
 *                 If the `action` is an array, these are the elements' meaning:
 *                 - index [0]: 1 = shift, 2 = reduce, 3 = accept
 *                 - index [1]: GOTO `state`
 *
 *                 If the `action` is a number, it is the GOTO `state`
 *
 *    defaultActions: {...},
 *
 *    parseError: function(str, hash),
 *    yyErrOk: function(),
 *    yyClearIn: function(),
 *
 *    constructParseErrorInfo: function(error_message, exception_object, expected_token_set, is_recoverable),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               Produces a new errorInfo 'hash object' which can be passed into `parseError()`.
 *               See it's use in this parser kernel in many places; example usage:
 *
 *                   var infoObj = parser.constructParseErrorInfo('fail!', null,
 *                                     parser.collect_expected_token_set(state), true);
 *                   var retVal = parser.parseError(infoObj.errStr, infoObj);
 *
 *    originalParseError: function(str, hash),
 *               The basic parseError handler provided by JISON.
 *               `cleanupAfterParse()` will clean up and reset `parseError()` to reference this function
 *               at the end of the `parse()`.
 *
 *    options: { ... parser %options ... },
 *
 *    parse: function(input[, args...]),
 *               Parse the given `input` and return the parsed value (or `true` when none was provided by
 *               the root action, in which case the parser is acting as a *matcher*).
 *               You MAY use the additional `args...` parameters as per `%parse-param` spec of this grammar:
 *               these extra `args...` are passed verbatim to the grammar rules' action code.
 *
 *    cleanupAfterParse: function(resultValue, invoke_post_methods),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               This helper API is invoked at the end of the `parse()` call, unless an exception was thrown
 *               and `%options no-try-catch` has been defined for this grammar: in that case this helper MAY
 *               be invoked by calling user code to ensure the `post_parse` callbacks are invoked and
 *               the internal parser gets properly garbage collected under these particular circumstances.
 *
 *    lexer: {
 *        yy: {...},           A reference to the so-called "shared state" `yy` once
 *                             received via a call to the `.setInput(input, yy)` lexer API.
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input, [yy]),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(n),
 *        upcomingInput: function(n),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        pushState: function(condition),
 *        popState: function(),
 *        topState: function(),
 *        _currentRules: function(),
 *        stateStackSize: function(),
 *
 *        options: { ... lexer %options ... },
 *
 *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
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
 * The parseError function receives a 'hash' object with these members for lexer and
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
 *                  can, for example, be used to pass to the `collect_expected_token_set()`
 *                  API to obtain the expected token set)
 *    action:      (integer; represents the current internal action which will be executed)
 *    new_state:   (integer; represents the next/planned internal state, once the current
 *                  action has executed)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule
 *                  available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    value_stack: (array: the current parser LALR/LR internal `$$` value stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    yy:          (object: the current parser internal "shared state" `yy`
 *                  as is also available in the rule actions; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    lexer:       (reference to the current lexer instance used by the parser)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser*
 *  instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 *  When `parseError` is invoked by the parser due to a **JavaScript exception** being fired
 *  from either the parser or lexer, `this` will still reference the related *parser*
 *  instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    exception:   (reference to the exception thrown)
 *  }
 *
 *  Please do note that in the latter situation, the `expected` field will be omitted as
 *  type of failure is assumed not to be due to *parse errors* but rather due to user
 *  action code in either parser or lexer failing unexpectedly.
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy [, optional parse() args])
 *                 optional: you can specify a pre_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: you can specify a post_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`. When it does not return any value,
 *                 the parser will return the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy [, optional parse() args])
 *                 optional: is invoked before the parse cycle starts (and before the first
 *                 invocation of `lex()`) but immediately after the invocation of
 *                 `parser.pre_parse()`).
 *      post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: is invoked when the parse terminates due to success ('accept')
 *                 or failure (even when exceptions are thrown).
 *                 `retval` contains the return value to be produced by `Parser.parse()`;
 *                 this function can override the return value by returning another. 
 *                 When it does not return any value, the parser will return the original
 *                 `retval`. 
 *                 This function is invoked immediately before `Parser.post_parse()`.
 *
 *      parseError: function(str, hash)
 *                 optional: overrides the default `parseError` function.
 *      quoteName: function(name),
 *                 optional: overrides the default `quoteName` function.
 *  }
 *
 *  parser.lexer.options: {
 *      pre_lex:  function()
 *                 optional: is invoked before the lexer is invoked to produce another token.
 *                 `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                 optional: is invoked when the lexer has produced a token `token`;
 *                 this function can override the returned token value by returning another.
 *                 When it does not return any (truthy) value, the lexer will return
 *                 the original `token`.
 *                 `this` refers to the Lexer object.
 *
 *      ranges: boolean
 *                 optional: `true` ==> token location info will include a .range[] member.
 *      flex: boolean
 *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested
 *                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                 optional: `true` ==> lexer regexes are tested in order and for invoked;
 *                 the lexer terminates the scan when a token is returned by the action code.
 *      xregexp: boolean
 *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the
 *                 `XRegExp` library. When this %option has not been specified at compile time, all lexer
 *                 rule regexes have been written as standard JavaScript RegExp expressions.
 *  }
 */
var parser = (function () {

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

if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
} else {
    JisonParserError.prototype = Object.create(Error.prototype);
}
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';



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

var parser = {
trace: function no_op_trace() { },
JisonParserError: JisonParserError,
yy: {},
options: {
  type: "lalr",
  errorRecoveryTokenDiscardCount: 3
},
symbols_: {
  "$accept": 0,
  "$end": 1,
  "%%": 16,
  "(": 7,
  ")": 8,
  "*": 9,
  "+": 11,
  ":": 4,
  ";": 5,
  "=": 3,
  "?": 10,
  "ACTION": 21,
  "ACTION_BODY": 80,
  "ALIAS": 75,
  "ARROW_ACTION": 78,
  "CODE": 85,
  "DEBUG": 33,
  "EOF": 1,
  "EPSILON": 70,
  "ID": 40,
  "IMPORT": 35,
  "INCLUDE": 82,
  "INIT_CODE": 38,
  "INTEGER": 62,
  "LEFT": 53,
  "LEX_BLOCK": 26,
  "NAME": 46,
  "NONASSOC": 55,
  "OPTIONS": 42,
  "OPTIONS_END": 44,
  "OPTION_VALUE": 47,
  "PARSER_TYPE": 50,
  "PARSE_PARAM": 48,
  "PATH": 83,
  "PREC": 76,
  "RIGHT": 54,
  "START": 24,
  "STRING": 41,
  "TOKEN": 28,
  "TOKEN_TYPE": 61,
  "UNKNOWN_DECL": 34,
  "action": 69,
  "action_body": 77,
  "action_comments_body": 79,
  "action_ne": 39,
  "associativity": 52,
  "declaration": 23,
  "declaration_list": 15,
  "error": 2,
  "expression": 73,
  "expression_suffix": 71,
  "extra_parser_module_code": 19,
  "full_token_definitions": 29,
  "grammar": 17,
  "handle": 67,
  "handle_action": 66,
  "handle_list": 65,
  "handle_sublist": 72,
  "id": 25,
  "id_list": 57,
  "import_name": 36,
  "import_path": 37,
  "include_macro_code": 22,
  "module_code_chunk": 84,
  "one_full_token": 58,
  "operator": 27,
  "option": 45,
  "option_list": 43,
  "optional_action_header_block": 20,
  "optional_end_block": 18,
  "optional_module_code_chunk": 81,
  "optional_token_type": 56,
  "options": 32,
  "parse_params": 30,
  "parser_type": 31,
  "prec": 68,
  "production": 64,
  "production_list": 63,
  "spec": 14,
  "suffix": 74,
  "symbol": 51,
  "token_description": 60,
  "token_list": 49,
  "token_value": 59,
  "{": 12,
  "|": 6,
  "}": 13
},
terminals_: {
  1: "EOF",
  2: "error",
  3: "=",
  4: ":",
  5: ";",
  6: "|",
  7: "(",
  8: ")",
  9: "*",
  10: "?",
  11: "+",
  12: "{",
  13: "}",
  16: "%%",
  21: "ACTION",
  24: "START",
  26: "LEX_BLOCK",
  28: "TOKEN",
  33: "DEBUG",
  34: "UNKNOWN_DECL",
  35: "IMPORT",
  38: "INIT_CODE",
  40: "ID",
  41: "STRING",
  42: "OPTIONS",
  44: "OPTIONS_END",
  46: "NAME",
  47: "OPTION_VALUE",
  48: "PARSE_PARAM",
  50: "PARSER_TYPE",
  53: "LEFT",
  54: "RIGHT",
  55: "NONASSOC",
  61: "TOKEN_TYPE",
  62: "INTEGER",
  70: "EPSILON",
  75: "ALIAS",
  76: "PREC",
  78: "ARROW_ACTION",
  80: "ACTION_BODY",
  82: "INCLUDE",
  83: "PATH",
  85: "CODE"
},
TERROR: 2,
EOF: 1,

// internals: defined here so the object *structure* doesn't get modified by parse() et al,
// thus helping JIT compilers like Chrome V8.
originalQuoteName: null,
originalParseError: null,
cleanupAfterParse: null,
constructParseErrorInfo: null,

__reentrant_call_depth: 0,       // INTERNAL USE ONLY

// APIs which will be set up depending on user action code analysis:
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
},
productions_: bp({
  pop: u([
  14,
  18,
  18,
  s,
  [20, 3],
  15,
  15,
  s,
  [23, 13],
  36,
  36,
  37,
  37,
  32,
  43,
  43,
  s,
  [45, 3],
  30,
  31,
  27,
  s,
  [52, 3],
  49,
  49,
  29,
  29,
  s,
  [58, 3],
  56,
  56,
  59,
  60,
  57,
  57,
  17,
  63,
  63,
  64,
  65,
  65,
  66,
  66,
  67,
  67,
  72,
  72,
  71,
  71,
  s,
  [73, 3],
  s,
  [74, 4],
  68,
  68,
  51,
  51,
  25,
  s,
  [39, 4],
  69,
  69,
  s,
  [77, 4],
  79,
  79,
  19,
  19,
  22,
  22,
  84,
  84,
  81,
  81
]),
  rule: u([
  5,
  0,
  2,
  0,
  s,
  [2, 3],
  0,
  2,
  1,
  1,
  c,
  [3, 3],
  s,
  [1, 5],
  3,
  3,
  c,
  [6, 5],
  c,
  [15, 3],
  3,
  3,
  s,
  [2, 3],
  s,
  [1, 3],
  2,
  1,
  2,
  2,
  c,
  [11, 3],
  0,
  c,
  [11, 7],
  1,
  4,
  3,
  c,
  [31, 3],
  2,
  0,
  c,
  [6, 4],
  c,
  [37, 3],
  c,
  [23, 5],
  c,
  [5, 4],
  c,
  [56, 5],
  0,
  0,
  1,
  5,
  4,
  c,
  [39, 3],
  c,
  [33, 3],
  c,
  [6, 3],
  0
])
}),
performAction: function parser__PerformAction(yytext, yyloc, yy, yystate /* action[1] */, $0, yyvstack, yylstack, options) {
/* this == yyval */

switch (yystate) {
case 1:
    /*! Production::    spec : declaration_list '%%' grammar optional_end_block EOF */
    this.$ = yyvstack[$0 - 4];
    if (yyvstack[$0 - 1] && yyvstack[$0 - 1].trim() !== '') {
        yy.addDeclaration(this.$, { include: yyvstack[$0 - 1] });
    }
    return extend(this.$, yyvstack[$0 - 2]);
    break;

case 3:
    /*! Production::    optional_end_block : '%%' extra_parser_module_code */
case 32:
    /*! Production::    parse_params : PARSE_PARAM token_list */
case 33:
    /*! Production::    parser_type : PARSER_TYPE symbol */
case 65:
    /*! Production::    expression : ID */
case 74:
    /*! Production::    symbol : id */
case 75:
    /*! Production::    symbol : STRING */
case 76:
    /*! Production::    id : ID */
case 78:
    /*! Production::    action_ne : ACTION */
case 79:
    /*! Production::    action_ne : include_macro_code */
case 81:
    /*! Production::    action : action_ne */
case 84:
    /*! Production::    action_body : action_comments_body */
case 87:
    /*! Production::    action_comments_body : ACTION_BODY */
case 89:
    /*! Production::    extra_parser_module_code : optional_module_code_chunk */
case 93:
    /*! Production::    module_code_chunk : CODE */
case 95:
    /*! Production::    optional_module_code_chunk : module_code_chunk */
    this.$ = yyvstack[$0];
    break;

case 4:
    /*! Production::    optional_action_header_block : ε */
case 8:
    /*! Production::    declaration_list : ε */
    this.$ = {};
    break;

case 5:
    /*! Production::    optional_action_header_block : optional_action_header_block ACTION */
case 6:
    /*! Production::    optional_action_header_block : optional_action_header_block include_macro_code */
    this.$ = yyvstack[$0 - 1];
    yy.addDeclaration(this.$, { actionInclude: yyvstack[$0] });
    break;

case 7:
    /*! Production::    declaration_list : declaration_list declaration */
    this.$ = yyvstack[$0 - 1]; yy.addDeclaration(this.$, yyvstack[$0]);
    break;

case 9:
    /*! Production::    declaration : START id */
    this.$ = {start: yyvstack[$0]};
    break;

case 10:
    /*! Production::    declaration : LEX_BLOCK */
    this.$ = {lex: {text: yyvstack[$0], position: yylstack[$0]}};
    break;

case 11:
    /*! Production::    declaration : operator */
    this.$ = {operator: yyvstack[$0]};
    break;

case 12:
    /*! Production::    declaration : TOKEN full_token_definitions */
    this.$ = {token_list: yyvstack[$0]};
    break;

case 13:
    /*! Production::    declaration : ACTION */
case 14:
    /*! Production::    declaration : include_macro_code */
    this.$ = {include: yyvstack[$0]};
    break;

case 15:
    /*! Production::    declaration : parse_params */
    this.$ = {parseParams: yyvstack[$0]};
    break;

case 16:
    /*! Production::    declaration : parser_type */
    this.$ = {parserType: yyvstack[$0]};
    break;

case 17:
    /*! Production::    declaration : options */
    this.$ = {options: yyvstack[$0]};
    break;

case 18:
    /*! Production::    declaration : DEBUG */
    this.$ = {options: [['debug', true]]};
    break;

case 19:
    /*! Production::    declaration : UNKNOWN_DECL */
    this.$ = {unknownDecl: yyvstack[$0]};
    break;

case 20:
    /*! Production::    declaration : IMPORT import_name import_path */
    this.$ = {imports: {name: yyvstack[$0 - 1], path: yyvstack[$0]}};
    break;

case 21:
    /*! Production::    declaration : INIT_CODE import_name action_ne */
    this.$ = {initCode: {qualifier: yyvstack[$0 - 1], include: yyvstack[$0]}};
    break;

case 26:
    /*! Production::    options : OPTIONS option_list OPTIONS_END */
case 77:
    /*! Production::    action_ne : '{' action_body '}' */
    this.$ = yyvstack[$0 - 1];
    break;

case 27:
    /*! Production::    option_list : option_list option */
case 38:
    /*! Production::    token_list : token_list symbol */
case 49:
    /*! Production::    id_list : id_list id */
    this.$ = yyvstack[$0 - 1]; this.$.push(yyvstack[$0]);
    break;

case 28:
    /*! Production::    option_list : option */
case 39:
    /*! Production::    token_list : symbol */
case 50:
    /*! Production::    id_list : id */
case 56:
    /*! Production::    handle_list : handle_action */
    this.$ = [yyvstack[$0]];
    break;

case 29:
    /*! Production::    option : NAME[option] */
    this.$ = [yyvstack[$0], true];
    break;

case 30:
    /*! Production::    option : NAME[option] '=' OPTION_VALUE[value] */
case 31:
    /*! Production::    option : NAME[option] '=' NAME[value] */
    this.$ = [yyvstack[$0 - 2], yyvstack[$0]];
    break;

case 34:
    /*! Production::    operator : associativity token_list */
    this.$ = [yyvstack[$0 - 1]]; this.$.push.apply(this.$, yyvstack[$0]);
    break;

case 35:
    /*! Production::    associativity : LEFT */
    this.$ = 'left';
    break;

case 36:
    /*! Production::    associativity : RIGHT */
    this.$ = 'right';
    break;

case 37:
    /*! Production::    associativity : NONASSOC */
    this.$ = 'nonassoc';
    break;

case 40:
    /*! Production::    full_token_definitions : optional_token_type id_list */
    var rv = [];
    var lst = yyvstack[$0];
    for (var i = 0, len = lst.length; i < len; i++) {
        var id = lst[i];
        var m = {id: id};
        if (yyvstack[$0 - 1]) {
            m.type = yyvstack[$0 - 1];
        }
        rv.push(m);
    }
    this.$ = rv;
    break;

case 41:
    /*! Production::    full_token_definitions : optional_token_type one_full_token */
    var m = yyvstack[$0];
    if (yyvstack[$0 - 1]) {
        m.type = yyvstack[$0 - 1];
    }
    this.$ = [m];
    break;

case 42:
    /*! Production::    one_full_token : id token_value token_description */
    this.$ = {
        id: yyvstack[$0 - 2],
        value: yyvstack[$0 - 1]
    };
    break;

case 43:
    /*! Production::    one_full_token : id token_description */
    this.$ = {
        id: yyvstack[$0 - 1],
        description: yyvstack[$0]
    };
    break;

case 44:
    /*! Production::    one_full_token : id token_value */
    this.$ = {
        id: yyvstack[$0 - 1],
        value: yyvstack[$0],
        description: $token_description
    };
    break;

case 45:
    /*! Production::    optional_token_type : ε */
    this.$ = false;
    break;

case 51:
    /*! Production::    grammar : optional_action_header_block production_list */
    this.$ = yyvstack[$0 - 1];
    this.$.grammar = yyvstack[$0];
    break;

case 52:
    /*! Production::    production_list : production_list production */
    this.$ = yyvstack[$0 - 1];
    if (yyvstack[$0][0] in this.$) {
        this.$[yyvstack[$0][0]] = this.$[yyvstack[$0][0]].concat(yyvstack[$0][1]);
    } else {
        this.$[yyvstack[$0][0]] = yyvstack[$0][1];
    }
    break;

case 53:
    /*! Production::    production_list : production */
    this.$ = {}; this.$[yyvstack[$0][0]] = yyvstack[$0][1];
    break;

case 54:
    /*! Production::    production : id ':' handle_list ';' */
    this.$ = [yyvstack[$0 - 3], yyvstack[$0 - 1]];
    break;

case 55:
    /*! Production::    handle_list : handle_list '|' handle_action */
    this.$ = yyvstack[$0 - 2];
    this.$.push(yyvstack[$0]);
    break;

case 57:
    /*! Production::    handle_action : handle prec action */
    this.$ = [(yyvstack[$0 - 2].length ? yyvstack[$0 - 2].join(' ') : '')];
    if (yyvstack[$0]) {
        this.$.push(yyvstack[$0]);
    }
    if (yyvstack[$0 - 1]) {
        this.$.push(yyvstack[$0 - 1]);
    }
    if (this.$.length === 1) {
        this.$ = this.$[0];
    }
    break;

case 58:
    /*! Production::    handle_action : EPSILON action */
    this.$ = [''];
    if (yyvstack[$0]) {
        this.$.push(yyvstack[$0]);
    }
    if (this.$.length === 1) {
        this.$ = this.$[0];
    }
    break;

case 59:
    /*! Production::    handle : handle expression_suffix */
    this.$ = yyvstack[$0 - 1];
    this.$.push(yyvstack[$0]);
    break;

case 60:
    /*! Production::    handle : ε */
    this.$ = [];
    break;

case 61:
    /*! Production::    handle_sublist : handle_sublist '|' handle */
    this.$ = yyvstack[$0 - 2];
    this.$.push(yyvstack[$0].join(' '));
    break;

case 62:
    /*! Production::    handle_sublist : handle */
    this.$ = [yyvstack[$0].join(' ')];
    break;

case 63:
    /*! Production::    expression_suffix : expression suffix ALIAS */
    this.$ = yyvstack[$0 - 2] + yyvstack[$0 - 1] + "[" + yyvstack[$0] + "]";
    break;

case 64:
    /*! Production::    expression_suffix : expression suffix */
case 88:
    /*! Production::    action_comments_body : action_comments_body ACTION_BODY */
case 94:
    /*! Production::    module_code_chunk : module_code_chunk CODE */
    this.$ = yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 66:
    /*! Production::    expression : STRING */
    // Re-encode the string *anyway* as it will
    // be made part of the rule rhs a.k.a. production (type: *string*) again and we want
    // to be able to handle all tokens, including *significant space*
    // encoded as literal tokens in a grammar such as this: `rule: A ' ' B`.
    if (yyvstack[$0].indexOf("'") >= 0) {
        this.$ = '"' + yyvstack[$0] + '"';
    } else {
        this.$ = "'" + yyvstack[$0] + "'";
    }
    break;

case 67:
    /*! Production::    expression : '(' handle_sublist ')' */
    this.$ = '(' + yyvstack[$0 - 1].join(' | ') + ')';
    break;

case 68:
    /*! Production::    suffix : ε */
case 82:
    /*! Production::    action : ε */
case 83:
    /*! Production::    action_body : ε */
case 96:
    /*! Production::    optional_module_code_chunk : ε */
    this.$ = '';
    break;

case 72:
    /*! Production::    prec : PREC symbol */
    this.$ = { prec: yyvstack[$0] };
    break;

case 73:
    /*! Production::    prec : ε */
    this.$ = null;
    break;

case 80:
    /*! Production::    action_ne : ARROW_ACTION */
    this.$ = '$$ =' + yyvstack[$0] + ';';
    break;

case 85:
    /*! Production::    action_body : action_body '{' action_body '}' action_comments_body */
    this.$ = yyvstack[$0 - 4] + yyvstack[$0 - 3] + yyvstack[$0 - 2] + yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 86:
    /*! Production::    action_body : action_body '{' action_body '}' */
    this.$ = yyvstack[$0 - 3] + yyvstack[$0 - 2] + yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 90:
    /*! Production::    extra_parser_module_code : optional_module_code_chunk include_macro_code extra_parser_module_code */
    this.$ = yyvstack[$0 - 2] + yyvstack[$0 - 1] + yyvstack[$0];
    break;

case 91:
    /*! Production::    include_macro_code : INCLUDE PATH */
    var fileContent = fs.readFileSync(yyvstack[$0], { encoding: 'utf-8' });
    // And no, we don't support nested '%include':
    this.$ = '\n// Included by Jison: ' + yyvstack[$0] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + yyvstack[$0] + '\n\n';
    break;

case 92:
    /*! Production::    include_macro_code : INCLUDE error */
    console.error("%include MUST be followed by a valid file path");
    break;

}
},
table: bt({
  len: u([
  18,
  1,
  23,
  5,
  16,
  2,
  16,
  16,
  4,
  s,
  [16, 7],
  3,
  3,
  5,
  2,
  s,
  [5, 4, -1],
  2,
  2,
  3,
  7,
  16,
  24,
  16,
  4,
  1,
  3,
  s,
  [6, 3],
  20,
  18,
  22,
  22,
  21,
  21,
  20,
  16,
  3,
  2,
  3,
  1,
  6,
  5,
  s,
  [3, 3],
  1,
  18,
  16,
  21,
  s,
  [16, 4],
  5,
  s,
  [18, 4],
  16,
  2,
  2,
  1,
  1,
  s,
  [3, 4],
  14,
  17,
  18,
  16,
  17,
  16,
  2,
  3,
  c,
  [62, 3],
  6,
  c,
  [4, 3],
  13,
  9,
  16,
  18,
  5,
  3,
  1,
  3,
  13,
  9,
  11,
  4,
  16,
  15,
  15,
  7,
  s,
  [2, 5],
  6,
  s,
  [12, 4],
  2,
  7,
  4,
  11,
  15,
  6,
  3,
  7
]),
  symbol: u([
  14,
  15,
  16,
  21,
  24,
  26,
  28,
  33,
  34,
  35,
  38,
  42,
  48,
  50,
  53,
  54,
  55,
  82,
  1,
  16,
  s,
  [21, 4, 1],
  26,
  27,
  28,
  s,
  [30, 6, 1],
  c,
  [23, 4],
  s,
  [52, 4, 1],
  82,
  17,
  20,
  21,
  40,
  82,
  c,
  [45, 16],
  25,
  40,
  c,
  [18, 16],
  c,
  [16, 16],
  29,
  40,
  56,
  61,
  c,
  [36, 32],
  c,
  [16, 80],
  36,
  40,
  41,
  c,
  [3, 3],
  25,
  40,
  41,
  49,
  51,
  2,
  83,
  c,
  [7, 5],
  c,
  [5, 3],
  51,
  43,
  45,
  46,
  40,
  41,
  40,
  41,
  40,
  41,
  1,
  16,
  18,
  21,
  22,
  25,
  40,
  63,
  64,
  c,
  [57, 17],
  4,
  5,
  6,
  12,
  c,
  [20, 9],
  40,
  41,
  c,
  [22, 6],
  62,
  78,
  c,
  [247, 19],
  57,
  58,
  40,
  37,
  40,
  41,
  12,
  21,
  40,
  41,
  78,
  82,
  c,
  [6, 8],
  22,
  39,
  c,
  [42, 5],
  25,
  c,
  [63, 11],
  51,
  c,
  [159, 13],
  c,
  [82, 8],
  82,
  c,
  [103, 20],
  78,
  c,
  [22, 23],
  1,
  5,
  6,
  c,
  [22, 10],
  c,
  [64, 7],
  85,
  c,
  [21, 21],
  c,
  [124, 29],
  c,
  [37, 7],
  44,
  45,
  46,
  44,
  46,
  3,
  44,
  46,
  1,
  1,
  19,
  81,
  82,
  84,
  85,
  1,
  16,
  25,
  40,
  64,
  c,
  [472, 3],
  c,
  [3, 3],
  1,
  16,
  40,
  4,
  c,
  [66, 11],
  c,
  [363, 32],
  c,
  [161, 8],
  59,
  60,
  62,
  c,
  [432, 65],
  12,
  13,
  77,
  79,
  80,
  c,
  [210, 11],
  c,
  [294, 9],
  c,
  [18, 34],
  c,
  [348, 18],
  c,
  [242, 17],
  46,
  46,
  47,
  s,
  [1, 3],
  22,
  82,
  1,
  c,
  [311, 3],
  c,
  [3, 3],
  16,
  40,
  5,
  6,
  7,
  c,
  [435, 4],
  65,
  66,
  67,
  70,
  76,
  c,
  [476, 11],
  c,
  [243, 17],
  c,
  [82, 7],
  60,
  c,
  [192, 26],
  c,
  [116, 24],
  12,
  13,
  12,
  13,
  80,
  c,
  [3, 3],
  44,
  c,
  [365, 3],
  c,
  [361, 7],
  82,
  85,
  5,
  6,
  5,
  6,
  c,
  [123, 7],
  68,
  71,
  73,
  c,
  [122, 3],
  c,
  [496, 3],
  c,
  [564, 3],
  69,
  c,
  [607, 18],
  c,
  [231, 18],
  c,
  [290, 5],
  c,
  [81, 3],
  1,
  c,
  [191, 10],
  c,
  [190, 6],
  c,
  [68, 9],
  s,
  [5, 4, 1],
  c,
  [23, 4],
  c,
  [20, 3],
  c,
  [749, 4],
  s,
  [5, 8, 1],
  c,
  [18, 3],
  74,
  75,
  c,
  [40, 5],
  c,
  [16, 9],
  c,
  [15, 19],
  c,
  [14, 3],
  40,
  41,
  67,
  72,
  c,
  [160, 4],
  12,
  13,
  c,
  [168, 6],
  12,
  21,
  c,
  [84, 10],
  c,
  [50, 8],
  c,
  [12, 32],
  6,
  8,
  c,
  [73, 5],
  71,
  73,
  12,
  13,
  c,
  [464, 4],
  c,
  [145, 9],
  c,
  [110, 21],
  c,
  [206, 3],
  c,
  [46, 7]
]),
  type: u([
  0,
  0,
  s,
  [2, 16],
  1,
  2,
  2,
  c,
  [21, 4],
  0,
  c,
  [6, 3],
  c,
  [28, 8],
  c,
  [8, 5],
  c,
  [42, 18],
  c,
  [26, 8],
  s,
  [2, 29],
  c,
  [72, 3],
  s,
  [2, 113],
  c,
  [191, 5],
  c,
  [3, 5],
  c,
  [7, 8],
  c,
  [5, 8],
  c,
  [149, 10],
  c,
  [3, 5],
  c,
  [97, 58],
  c,
  [64, 4],
  c,
  [22, 17],
  c,
  [18, 6],
  c,
  [24, 12],
  c,
  [252, 112],
  c,
  [124, 34],
  c,
  [22, 9],
  c,
  [194, 7],
  c,
  [200, 16],
  c,
  [178, 48],
  c,
  [326, 59],
  c,
  [70, 81],
  c,
  [282, 40],
  c,
  [116, 8],
  c,
  [117, 38],
  c,
  [155, 64],
  c,
  [555, 19],
  c,
  [859, 11],
  c,
  [250, 40],
  c,
  [40, 17],
  c,
  [17, 10],
  c,
  [68, 16],
  c,
  [757, 6],
  c,
  [192, 49],
  c,
  [388, 73],
  c,
  [886, 7],
  c,
  [342, 39],
  0,
  0
]),
  state: u([
  1,
  2,
  10,
  4,
  7,
  11,
  12,
  13,
  18,
  26,
  27,
  28,
  30,
  31,
  33,
  36,
  39,
  37,
  38,
  39,
  43,
  38,
  39,
  44,
  45,
  46,
  48,
  52,
  54,
  50,
  53,
  57,
  55,
  56,
  58,
  64,
  61,
  39,
  66,
  39,
  66,
  68,
  71,
  72,
  73,
  54,
  75,
  77,
  78,
  79,
  82,
  83,
  87,
  89,
  90,
  91,
  93,
  97,
  72,
  73,
  100,
  101,
  103,
  64,
  108,
  107,
  109,
  83,
  110,
  91,
  64,
  108,
  111,
  39,
  112,
  113,
  118,
  117,
  101,
  103,
  123,
  124,
  101,
  103
]),
  mode: u([
  s,
  [2, 16],
  s,
  [1, 16],
  s,
  [2, 19],
  c,
  [20, 20],
  c,
  [34, 48],
  s,
  [2, 79],
  c,
  [179, 20],
  c,
  [190, 23],
  c,
  [80, 38],
  c,
  [62, 3],
  c,
  [96, 16],
  c,
  [13, 11],
  s,
  [2, 120],
  c,
  [122, 25],
  c,
  [25, 4],
  c,
  [3, 12],
  c,
  [392, 17],
  c,
  [436, 41],
  c,
  [220, 68],
  c,
  [288, 91],
  c,
  [258, 5],
  c,
  [228, 13],
  c,
  [113, 34],
  c,
  [518, 58],
  c,
  [333, 17],
  c,
  [385, 6],
  c,
  [23, 4],
  c,
  [10, 7],
  c,
  [612, 39],
  c,
  [37, 15],
  c,
  [15, 6],
  c,
  [61, 15],
  c,
  [82, 9],
  c,
  [533, 67],
  c,
  [68, 40],
  c,
  [60, 3],
  c,
  [747, 6],
  c,
  [544, 36],
  c,
  [42, 4]
]),
  goto: u([
  s,
  [8, 16],
  3,
  9,
  5,
  6,
  8,
  s,
  [14, 4, 1],
  22,
  20,
  21,
  23,
  24,
  25,
  19,
  s,
  [4, 3],
  s,
  [7, 16],
  29,
  s,
  [10, 16],
  s,
  [11, 16],
  45,
  32,
  s,
  [13, 16],
  s,
  [14, 16],
  s,
  [15, 16],
  s,
  [16, 16],
  s,
  [17, 16],
  s,
  [18, 16],
  s,
  [19, 16],
  34,
  35,
  34,
  35,
  29,
  40,
  42,
  41,
  29,
  40,
  29,
  40,
  47,
  35,
  35,
  36,
  36,
  37,
  37,
  2,
  49,
  51,
  29,
  19,
  s,
  [9, 16],
  s,
  [76, 24],
  s,
  [12, 16],
  29,
  46,
  59,
  60,
  s,
  [22, 6],
  s,
  [23, 6],
  62,
  63,
  65,
  19,
  s,
  [34, 9],
  29,
  40,
  s,
  [34, 7],
  s,
  [39, 18],
  s,
  [74, 22],
  s,
  [75, 22],
  s,
  [91, 21],
  s,
  [92, 21],
  s,
  [32, 9],
  29,
  40,
  s,
  [32, 7],
  s,
  [33, 16],
  67,
  47,
  28,
  28,
  69,
  29,
  29,
  70,
  96,
  96,
  74,
  51,
  51,
  29,
  s,
  [5, 3],
  s,
  [6, 3],
  s,
  [53, 3],
  76,
  s,
  [40, 9],
  29,
  s,
  [40, 7],
  s,
  [41, 16],
  s,
  [50, 10],
  81,
  s,
  [50, 6],
  80,
  50,
  s,
  [20, 16],
  s,
  [24, 16],
  s,
  [25, 16],
  s,
  [21, 16],
  83,
  83,
  84,
  s,
  [78, 18],
  s,
  [79, 18],
  s,
  [80, 18],
  s,
  [38, 18],
  s,
  [26, 16],
  27,
  27,
  86,
  85,
  1,
  3,
  89,
  19,
  95,
  95,
  88,
  s,
  [93, 3],
  s,
  [52, 3],
  s,
  [60, 7],
  92,
  s,
  [60, 3],
  s,
  [49, 17],
  s,
  [44, 9],
  81,
  s,
  [44, 7],
  s,
  [43, 16],
  s,
  [47, 17],
  s,
  [48, 16],
  95,
  94,
  84,
  84,
  96,
  s,
  [87, 3],
  30,
  30,
  31,
  31,
  c,
  [346, 3],
  s,
  [94, 3],
  98,
  99,
  56,
  56,
  73,
  73,
  106,
  73,
  73,
  104,
  105,
  102,
  73,
  73,
  82,
  82,
  c,
  [536, 4],
  s,
  [42, 16],
  s,
  [77, 18],
  c,
  [274, 3],
  s,
  [88, 3],
  90,
  s,
  [54, 3],
  c,
  [176, 11],
  c,
  [61, 6],
  s,
  [59, 11],
  29,
  40,
  s,
  [68, 4],
  114,
  115,
  116,
  s,
  [68, 8],
  s,
  [65, 15],
  s,
  [66, 15],
  s,
  [60, 5],
  58,
  58,
  81,
  81,
  95,
  119,
  55,
  55,
  57,
  57,
  s,
  [72, 6],
  s,
  [64, 8],
  120,
  s,
  [64, 3],
  s,
  [69, 12],
  s,
  [70, 12],
  s,
  [71, 12],
  122,
  121,
  62,
  106,
  62,
  104,
  105,
  86,
  86,
  84,
  s,
  [63, 11],
  s,
  [67, 15],
  s,
  [60, 5],
  85,
  85,
  96,
  61,
  106,
  61,
  104,
  105
])
}),
defaultActions: {
  32: 46,
  70: 1,
  71: 3,
  97: 90
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
        hash.destroy();             // destroy... well, *almost*!
        // assert('recoverable' in hash);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input, options) {
    var self = this,
        stack = new Array(128),         // token stack: stores token which leads to state at the same index (column storage)
        sstack = new Array(128),        // state stack: stores states (column storage)

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

    var sharedState = {
      yy: {
        parseError: null,
        quoteName: null,
        lexer: null,
        parser: null,
        pre_parse: null,
        post_parse: null
      }
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;






    lexer.setInput(input, sharedState.yy);

    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack[sp] = yyloc;
    vstack[sp] = null;
    sstack[sp] = 0;
    stack[sp] = 0;
    ++sp;

    if (typeof lexer.yytext === 'undefined') {
        lexer.yytext = '';
    }
    var yytext = lexer.yytext;
    if (typeof lexer.yylineno === 'undefined') {
        lexer.yylineno = 0;
    }




    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = this.originalParseError;
    }

    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState.yy.quoteName === 'function') {
        this.quoteName = sharedState.yy.quoteName;
    } else {
        this.quoteName = this.originalQuoteName;
    }

    // set up the cleanup function; make it an API so that external code can re-use this one in case of
    // calamities or when the `%options no-try-catch` option has been specified for the grammar, in which
    // case this parse() API method doesn't come with a `finally { ... }` block any more!
    //
    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `sharedState`, etc. references will be *wrong*!
    this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods) {
        var rv;

        if (invoke_post_methods) {
            if (sharedState.yy.post_parse) {
                rv = sharedState.yy.post_parse.call(this, sharedState.yy, resultValue, options);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
            if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState.yy, resultValue, options);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
        }

        if (this.__reentrant_call_depth > 1) return resultValue;        // do not (yet) kill the sharedState when this is a reentrant run.

        // prevent lingering circular references from causing memory leaks:
        if (sharedState.yy) {
            sharedState.yy.parseError = undefined;
            sharedState.yy.quoteName = undefined;
            sharedState.yy.lexer = undefined;
            sharedState.yy.parser = undefined;
            if (lexer.yy === sharedState.yy) {
                lexer.yy = undefined;
            }
        }
        sharedState.yy = undefined;
        this.parseError = this.originalParseError;
        this.quoteName = this.originalQuoteName;

        // nuke the vstack[] array at least as that one will still reference obsoleted user values.
        // To be safe, we nuke the other internal stack columns as well...
        stack.length = 0;               // fastest way to nuke an array without overly bothering the GC
        sstack.length = 0;
        lstack.length = 0;
        vstack.length = 0;
        stack_pointer = 0;

        return resultValue;
    };

    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `lexer`, `sharedState`, etc. references will be *wrong*!
    this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected, recoverable) {
        return {
            errStr: msg,
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,
            loc: lexer.yylloc,
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
            yy: sharedState.yy,
            lexer: lexer,

            // and make sure the error info doesn't stay due to potential ref cycle via userland code manipulations (memory leak opportunity!):
            destroy: function destructParseErrorInfo() {
                // remove cyclic references added to error info:
                // info.yy = null;
                // info.lexer = null;
                // info.value = null;
                // info.value_stack = null;
                // ...
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this.hasOwnProperty(key) && typeof key !== 'function') {
                        this[key] = undefined;
                    }
                }
                this.recoverable = rec;
            }
        };
    };


    function lex() {
        var token = lexer.lex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token || EOF;
    }


    var symbol = 0;
    var preErrorSymbol = 0;
    var state, action, r, t;
    var yyval = {
        $: true,
        _$: undefined
    };
    var p, len, this_production;
    var lstack_begin, lstack_end;
    var newState;
    var retval = false;


    // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = sp - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            var t = table[state][TERROR] || NO_ACTION;
            if (t[0]) {
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 1) {
                return -1; // No suitable error recovery rule available.
            }
            --stack_probe; // popStack(1): [symbol, action]
            state = sstack[stack_probe];
            ++depth;
        }
    }

    try {
        this.__reentrant_call_depth++;

        if (this.pre_parse) {
            this.pre_parse.call(this, sharedState.yy, options);
        }
        if (sharedState.yy.pre_parse) {
            sharedState.yy.pre_parse.call(this, sharedState.yy, options);
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
                    symbol = lex();
                }
                // read action for current state and first input
                t = (table[state] && table[state][symbol]) || NO_ACTION;
                newState = t[1];
                action = t[0];




                // handle parse error
                if (!action) {
                    // first see if there's any chance at hitting an error recovery rule:
                    var error_rule_depth = locateNearestErrorRecoveryRule(state);
                    var errStr = null;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    if (!recovering) {
                        // Report error
                        if (lexer.showPosition) {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition(79 - 10, 10) + '\n';
                        } else {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                        }
                        if (expected.length) {
                            errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                        } else {
                            errStr += 'Unexpected ' + errSymbolDescr;
                        }
                        p = this.constructParseErrorInfo(errStr, null, expected, (error_rule_depth >= 0));
                        r = this.parseError(p.errStr, p);


                        if (!p.recoverable) {
                            retval = r;
                            break;
                        } else {
                            // TODO: allow parseError callback to edit symbol and or state tat the start of the error recovery process...
                        }
                    }



                    // just recovered from another error
                    if (recovering === ERROR_RECOVERY_TOKEN_DISCARD_COUNT && error_rule_depth >= 0) {
                        // only barf a fatal hairball when we're out of look-ahead symbols and none hit a match;
                        // this DOES discard look-ahead while recovering from an error when said look-ahead doesn't
                        // suit the error recovery rules... The error HAS been reported already so we're fine with
                        // throwing away a few items if that is what it takes to match the nearest recovery rule!
                        if (symbol === EOF || preErrorSymbol === EOF) {
                            p = this.constructParseErrorInfo((errStr || 'Parsing halted while starting to recover from another error.'), null, expected, false);
                            retval = this.parseError(p.errStr, p);
                            break;
                        }

                        // discard current lookahead and grab another

                        yytext = lexer.yytext;

                        yyloc = lexer.yylloc;

                        symbol = lex();


                    }

                    // try to recover from error
                    if (error_rule_depth < 0) {
                        p = this.constructParseErrorInfo((errStr || 'Parsing halted. No suitable error recovery rule available.'), null, expected, false);
                        retval = this.parseError(p.errStr, p);
                        break;
                    }
                    sp -= error_rule_depth;

                    preErrorSymbol = (symbol === TERROR ? 0 : symbol); // save the lookahead token
                    symbol = TERROR;            // insert generic error symbol as new lookahead
                    // allow N (default: 3) real symbols to be shifted before reporting a new error
                    recovering = ERROR_RECOVERY_TOKEN_DISCARD_COUNT;

                    newState = sstack[sp - 1];



                    continue;
                }
            }


            switch (action) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action instanceof Array) {
                    p = this.constructParseErrorInfo(('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol), null, null, false);
                    retval = this.parseError(p.errStr, p);
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                retval = this.parseError(p.errStr, p);
                break;

            // shift:
            case 1:
                //this.shiftCount++;
                stack[sp] = symbol;
                vstack[sp] = lexer.yytext;
                lstack[sp] = lexer.yylloc;
                sstack[sp] = newState; // push state
                ++sp;
                symbol = 0;
                if (!preErrorSymbol) { // normal execution / no error
                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:

                    yytext = lexer.yytext;

                    yyloc = lexer.yylloc;

                    if (recovering > 0) {
                        recovering--;

                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                    symbol = preErrorSymbol;
                    preErrorSymbol = 0;

                    // read action for current state and first input
                    t = (table[newState] && table[newState][symbol]) || NO_ACTION;
                    if (!t[0]) {
                        // forget about that symbol and move forward: this wasn't an 'forgot to insert' error type where
                        // (simple) stuff might have been missing before the token which caused the error we're
                        // recovering from now...

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

                r = this.performAction.call(yyval, yytext, yyloc, sharedState.yy, newState, sp - 1, vstack, lstack, options);

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
        retval = this.parseError(p.errStr, p);
    } finally {
        retval = this.cleanupAfterParse(retval, true);
        this.__reentrant_call_depth--;
    }

    return retval;
}
};
parser.originalParseError = parser.parseError;
parser.originalQuoteName = parser.quoteName;
var fs = require('fs');
var transform = require('./ebnf-transform').transform;
var ebnf = false;


// transform ebnf to bnf if necessary
function extend(json, grammar) {
    json.bnf = ebnf ? transform(grammar.grammar) : grammar.grammar;
    if (grammar.actionInclude) {
        json.actionInclude = grammar.actionInclude;
    }
    return json;
}
/* generated by jison-lex 0.3.4-153 */
var lexer = (function () {
// See also:
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
// with userland code which might access the derived class in a 'classic' way.
function JisonLexerError(msg, hash) {
    Object.defineProperty(this, 'name', {
        enumerable: false,
        writable: false,
        value: 'JisonLexerError'
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

    if (typeof Object.setPrototypeOf === 'function') {
        Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
    } else {
        JisonLexerError.prototype = Object.create(Error.prototype);
    }
    JisonLexerError.prototype.constructor = JisonLexerError;
    JisonLexerError.prototype.name = 'JisonLexerError';


var lexer = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,        // <-- injected by the code generator

    // options: {},                             // <-- injected by the code generator

    // yy: ...,                                 // <-- injected by setInput()

    __currentRuleSet__: null,                   // <-- internal rule set cache for the current lexer state

    parseError: function lexer_parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

    // clear the lexer token context; intended for internal use only
    clear: function lexer_clear() {
        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        this.matches = false;
        this._more = false;
        this._backtrack = false;
    },

    // resets the lexer, sets new input
    setInput: function lexer_setInput(input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this.clear();
        this._signaled_error_token = this.done = false;
        this.yylineno = 0;
        this.matched = '';
        this.conditionStack = ['INITIAL'];
        this.__currentRuleSet__ = null;
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
    },

    // consumes and returns one char from the input
    input: function lexer_input() {
        if (!this._input) {
            this.done = true;
            return null;
        }
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        // Count the linenumber up when we hit the LF (or a stand-alone CR).
        // On CRLF, the linenumber is incremented when you fetch the CR or the CRLF combo
        // and we advance immediately past the LF as well, returning both together as if
        // it was all a single 'character' only.
        var slice_len = 1;
        var lines = false;
        if (ch === '\n') {
            lines = true;
        } else if (ch === '\r') {
            lines = true;
            var ch2 = this._input[1];
            if (ch2 === '\n') {
                slice_len++;
                ch += ch2;
                this.yytext += ch2;
                this.yyleng++;
                this.offset++;
                this.match += ch2;
                this.matched += ch2;
                if (this.options.ranges) {
                    this.yylloc.range[1]++;
                }
            }
        }
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(slice_len);
        return ch;
    },

    // unshifts one char (or a string) into the input
    unput: function lexer_unput(ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - len);
        this.matched = this.matched.substr(0, this.matched.length - len);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }

        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = (lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                + oldLines[oldLines.length - lines.length].length - lines[0].length :
                this.yylloc.first_column - len);

        if (this.options.ranges) {
            this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng - len;
        }
        this.yyleng = this.yytext.length;
        this.done = false;
        return this;
    },

    // When called from action, caches matched text and appends it on next action
    more: function lexer_more() {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function lexer_reject() {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            // when the parseError() call returns, we MUST ensure that the error is registered.
            // We accomplish this by signaling an 'error' token to be produced for the current
            // .lex() run.
            this._signaled_error_token = (this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: this.match,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR);
        }
        return this;
    },

    // retain first n characters of the match
    less: function lexer_less(n) {
        return this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    pastInput: function lexer_pastInput(maxSize, maxLines) {
        var past = this.matched.substring(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = past.length;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substr` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        past = past.substr(-maxSize * 2 - 2);
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = past.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(-maxLines);
        past = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis prefix...
        if (past.length > maxSize) {
            past = '...' + past.substr(-maxSize);
        }
        return past;
    },

    // return (part of the) upcoming input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = maxSize;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substring` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        if (next.length < maxSize * 2 + 2) {
            next += this._input.substring(0, maxSize * 2 + 2);  // substring is faster on Chrome/V8
        }
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = next.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(0, maxLines);
        next = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis postfix...
        if (next.length > maxSize) {
            next = next.substring(0, maxSize) + '...';
        }
        return next;
    },

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
        var pre = this.pastInput(maxPrefix).replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput(maxPostfix).replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // helper function, used to produce a human readable description as a string, given
    // the input `yylloc` location object. 
    // Set `display_range_too` to TRUE to include the string character inex position(s)
    // in the description if the `yylloc.range` is available. 
    describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
        var l1 = yylloc.first_line;
        var l2 = yylloc.last_line;
        var o1 = yylloc.first_column;
        var o2 = yylloc.last_column - 1;
        var dl = l2 - l1;
        var d_o = (dl === 0 ? o2 - o1 : 1000);
        var rv;
        if (dl === 0) {
            rv = 'line ' + l1 + ', ';
            if (d_o === 0) {
                rv += 'column ' + o1;
            } else {
                rv += 'columns ' + o1 + ' .. ' + o2;
            }
        } else {
            rv = 'lines ' + l1 + '(column ' + o1 + ') .. ' + l2 + '(column ' + o2 + ')';
        }
        if (yylloc.range && display_range_too) {
            var r1 = yylloc.range[0];
            var r2 = yylloc.range[1] - 1;
            if (r2 === r1) {
                rv += ' {String Offset: ' + r1 + '}';
            } else {
                rv += ' {String Offset range: ' + r1 + ' .. ' + r2 + '}';
            }
        }
        return rv;
        // return JSON.stringify(yylloc);
    },

    // test the lexed token: return FALSE when not a match, otherwise return token.
    //
    // `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
    // contains the actually matched text string.
    //
    // Also move the input cursor forward and update the match collectors:
    // - yytext
    // - yyleng
    // - match
    // - matches
    // - yylloc
    // - offset
    test_match: function lexer_test_match(match, indexed_rule) {
        var token,
            lines,
            backup,
            match_str;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        match_str = match[0];
        lines = match_str.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match_str.length
        };
        this.yytext += match_str;
        this.match += match_str;
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        // previous lex rules MAY have invoked the `more()` API rather than producing a token:
        // those rules will already have moved this `offset` forward matching their match lengths,
        // hence we must only add our own match length now:
        this.offset += match_str.length;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match_str.length);
        this.matched += match_str;
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            this.__currentRuleSet__ = null;
            return false; // rule action called reject() implying the next rule should be tested instead.
        } else if (this._signaled_error_token) {
            // produce one 'error' token as .parseError() in reject() did not guarantee a failure signal by throwing an exception!
            token = this._signaled_error_token;
            this._signaled_error_token = false;
            return token;
        }
        return false;
    },

    // return next match in input
    next: function lexer_next() {
        if (this.done) {
            this.clear();
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.clear();
        }
        var rules = this.__currentRuleSet__;
        if (!rules) {
            // Update the ruleset cache as we apparently encountered a state change or just started lexing.
            // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
            // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
            // speed up those activities a tiny bit.
            rules = this.__currentRuleSet__ = this._currentRules();
        }
        for (var i = 0, len = rules.length; i < len; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = undefined;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === '') {
            this.clear();
            this.done = true;
            return this.EOF;
        } else {
            token = this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: this.match + this._input,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR;
            if (token === this.ERROR) {
                // we can try to recover from a lexer error that parseError() did not 'recover' for us, by moving forward at least one character at a time:
                if (!this.match.length) {
                    this.input();
                }
            }
            return token;
        }
    },

    // return next match that has a token
    lex: function lexer_lex() {
        var r;
        // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
        if (typeof this.options.pre_lex === 'function') {
            r = this.options.pre_lex.call(this);
        }
        while (!r) {
            r = this.next();
        }
        if (typeof this.options.post_lex === 'function') {
            // (also account for a userdef function which does not return any value: keep the token as is)
            r = this.options.post_lex.call(this, r) || r;
        }
        return r;
    },

    // backwards compatible alias for `pushState()`;
    // the latter is symmetrical with `popState()` and we advise to use
    // those APIs in any modern lexer code, rather than `begin()`.
    begin: function lexer_begin(condition) {
        return this.pushState(condition);
    },

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    pushState: function lexer_pushState(condition) {
        this.conditionStack.push(condition);
        this.__currentRuleSet__ = null;
        return this;
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function lexer_popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            this.__currentRuleSet__ = null;
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function lexer_topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // (internal) determine the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function lexer__currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the number of states currently on the stack
    stateStackSize: function lexer_stateStackSize() {
        return this.conditionStack.length;
    },
options: {
  easy_keyword_rules: true,
  ranges: true
},
JisonLexerError: JisonLexerError,
performAction: function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 0 : 
/*! Conditions:: token */ 
/*! Rule::       {BR} */ 
 this.popState(); 
break;
case 1 : 
/*! Conditions:: token */ 
/*! Rule::       %% */ 
 this.popState(); 
break;
case 2 : 
/*! Conditions:: token */ 
/*! Rule::       ; */ 
 this.popState(); 
break;
case 3 : 
/*! Conditions:: bnf ebnf */ 
/*! Rule::       %% */ 
 this.pushState('code'); return 16; 
break;
case 17 : 
/*! Conditions:: options */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 47; 
break;
case 18 : 
/*! Conditions:: options */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 47; 
break;
case 19 : 
/*! Conditions:: INITIAL ebnf bnf token path options */ 
/*! Rule::       \/\/[^\r\n]* */ 
 /* skip single-line comment */ 
break;
case 20 : 
/*! Conditions:: INITIAL ebnf bnf token path options */ 
/*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
 /* skip multi-line comment */ 
break;
case 22 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}+ */ 
 this.popState(); return 44; 
break;
case 23 : 
/*! Conditions:: options */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 24 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 25 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {BR}+ */ 
 /* skip newlines */ 
break;
case 26 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \[{ID}\] */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 75; 
break;
case 30 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       "[^"]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 41; 
break;
case 31 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       '[^']+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 41; 
break;
case 36 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %% */ 
 this.pushState(ebnf ? 'ebnf' : 'bnf'); return 16; 
break;
case 37 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %ebnf\b */ 
 if (!yy.options) { yy.options = {}; } ebnf = yy.options.ebnf = true; 
break;
case 38 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %debug\b */ 
 if (!yy.options) { yy.options = {}; } yy.options.debug = true; return 33; 
break;
case 45 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %token\b */ 
 this.pushState('token'); return 28; 
break;
case 47 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %options\b */ 
 this.pushState('options'); return 42; 
break;
case 48 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %lex{LEX_CONTENT}\/lex\b */ 
 
                                            // remove the %lex../lex wrapper and return the pure lex section:
                                            yy_.yytext = this.matches[1];
                                            return 26;
                                         
break;
case 51 : 
/*! Conditions:: INITIAL ebnf bnf code */ 
/*! Rule::       %include\b */ 
 this.pushState('path'); return 82; 
break;
case 52 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %{NAME}[^\r\n]* */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported parser option: ', yy_.yytext, ' while lexing in ', this.topState(), ' state');
                                            return 34;
                                         
break;
case 53 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       <{ID}> */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 61; 
break;
case 54 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \{\{[\w\W]*?\}\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 4); return 21; 
break;
case 55 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %\{(.|\r|\n)*?%\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 21; 
break;
case 56 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \{ */ 
 yy.depth = 0; this.pushState('action'); return 12; 
break;
case 57 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       ->.* */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 2); return 78; 
break;
case 58 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {HEX_NUMBER} */ 
 yy_.yytext = parseInt(yy_.yytext, 16); return 62; 
break;
case 59 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {DECIMAL_NUMBER}(?![xX0-9a-fA-F]) */ 
 yy_.yytext = parseInt(yy_.yytext, 10); return 62; 
break;
case 60 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       . */ 
 
                                            throw new Error("unsupported input character: " + yy_.yytext + " @ " + JSON.stringify(yy_.yylloc)); /* b0rk on bad characters */
                                         
break;
case 64 : 
/*! Conditions:: action */ 
/*! Rule::       \/[^ /]*?['"{}'][^ ]*?\/ */ 
 return 80; // regexp with braces or quotes (and no spaces) 
break;
case 69 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++; return 12; 
break;
case 70 : 
/*! Conditions:: action */ 
/*! Rule::       \} */ 
 if (yy.depth === 0) { this.popState(); } else { yy.depth--; } return 13; 
break;
case 72 : 
/*! Conditions:: code */ 
/*! Rule::       [^\r\n]+ */ 
 return 85;      // the bit of CODE just before EOF... 
break;
case 73 : 
/*! Conditions:: path */ 
/*! Rule::       {BR} */ 
 this.popState(); this.unput(yy_.yytext); 
break;
case 74 : 
/*! Conditions:: path */ 
/*! Rule::       '[^\r\n]+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 83; 
break;
case 75 : 
/*! Conditions:: path */ 
/*! Rule::       "[^\r\n]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 83; 
break;
case 76 : 
/*! Conditions:: path */ 
/*! Rule::       {WS}+ */ 
 // skip whitespace in the line 
break;
case 77 : 
/*! Conditions:: path */ 
/*! Rule::       [^\s\r\n]+ */ 
 this.popState(); return 83; 
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: bnf ebnf */ 
  /*! Rule::       %empty\b */ 
   4 : 70,
  /*! Conditions:: bnf ebnf */ 
  /*! Rule::       %epsilon\b */ 
   5 : 70,
  /*! Conditions:: bnf ebnf */ 
  /*! Rule::       \u0190 */ 
   6 : 70,
  /*! Conditions:: bnf ebnf */ 
  /*! Rule::       \u025B */ 
   7 : 70,
  /*! Conditions:: bnf ebnf */ 
  /*! Rule::       \u03B5 */ 
   8 : 70,
  /*! Conditions:: bnf ebnf */ 
  /*! Rule::       \u03F5 */ 
   9 : 70,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \( */ 
   10 : 7,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \) */ 
   11 : 8,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \* */ 
   12 : 9,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \? */ 
   13 : 10,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \+ */ 
   14 : 11,
  /*! Conditions:: options */ 
  /*! Rule::       {NAME} */ 
   15 : 46,
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   16 : 3,
  /*! Conditions:: options */ 
  /*! Rule::       [^\s\r\n]+ */ 
   21 : 47,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       {ID} */ 
   27 : 40,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       \$end\b */ 
   28 : 40,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       \$eof\b */ 
   29 : 40,
  /*! Conditions:: token */ 
  /*! Rule::       [^\s\r\n]+ */ 
   32 : 'TOKEN_WORD',
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       : */ 
   33 : 4,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       ; */ 
   34 : 5,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       \| */ 
   35 : 6,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %parser-type\b */ 
   39 : 50,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %prec\b */ 
   40 : 76,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %start\b */ 
   41 : 24,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %left\b */ 
   42 : 53,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %right\b */ 
   43 : 54,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %nonassoc\b */ 
   44 : 55,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %parse-param\b */ 
   46 : 48,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %code\b */ 
   49 : 38,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %import\b */ 
   50 : 35,
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   61 : 1,
  /*! Conditions:: action */ 
  /*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
   62 : 80,
  /*! Conditions:: action */ 
  /*! Rule::       \/\/[^\r\n]* */ 
   63 : 80,
  /*! Conditions:: action */ 
  /*! Rule::       "(\\\\|\\"|[^"])*" */ 
   65 : 80,
  /*! Conditions:: action */ 
  /*! Rule::       '(\\\\|\\'|[^'])*' */ 
   66 : 80,
  /*! Conditions:: action */ 
  /*! Rule::       [/"'][^{}/"']+ */ 
   67 : 80,
  /*! Conditions:: action */ 
  /*! Rule::       [^{}/"']+ */ 
   68 : 80,
  /*! Conditions:: code */ 
  /*! Rule::       [^\r\n]*(\r|\n)+ */ 
   71 : 85
},
rules: [
/^(?:(\r\n|\n|\r))/,
/^(?:%%)/,
/^(?:;)/,
/^(?:%%)/,
/^(?:%empty\b)/,
/^(?:%epsilon\b)/,
/^(?:\u0190)/,
/^(?:\u025B)/,
/^(?:\u03B5)/,
/^(?:\u03F5)/,
/^(?:\()/,
/^(?:\))/,
/^(?:\*)/,
/^(?:\?)/,
/^(?:\+)/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-,.\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])?))/,
/^(?:=)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:\/\/[^\r\n]*)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:[^\s\r\n]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:([^\S\r\n])+)/,
/^(?:([^\S\r\n])+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\[([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*)\])/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*))/,
/^(?:\$end\b)/,
/^(?:\$eof\b)/,
/^(?:"[^"]+")/,
/^(?:'[^']+')/,
/^(?:[^\s\r\n]+)/,
/^(?::)/,
/^(?:;)/,
/^(?:\|)/,
/^(?:%%)/,
/^(?:%ebnf\b)/,
/^(?:%debug\b)/,
/^(?:%parser-type\b)/,
/^(?:%prec\b)/,
/^(?:%start\b)/,
/^(?:%left\b)/,
/^(?:%right\b)/,
/^(?:%nonassoc\b)/,
/^(?:%token\b)/,
/^(?:%parse-param\b)/,
/^(?:%options\b)/,
/^(?:%lex((?:[^\S\r\n])*(?:(?:\r\n|\n|\r)[\w\W]*?)?(?:\r\n|\n|\r)(?:[^\S\r\n])*)\/lex\b)/,
/^(?:%code\b)/,
/^(?:%import\b)/,
/^(?:%include\b)/,
/^(?:%([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-,.\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])?)[^\n\r]*)/,
/^(?:<([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*)>)/,
/^(?:\{\{[\w\W]*?\}\})/,
/^(?:%\{(.|\r|\n)*?%\})/,
/^(?:\{)/,
/^(?:->.*)/,
/^(?:(0[Xx][0-9A-Fa-f]+))/,
/^(?:([1-9][0-9]*)(?![0-9A-FXa-fx]))/,
/^(?:.)/,
/^(?:$)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/[^\r\n]*)/,
/^(?:\/[^ \/]*?["'{}][^ ]*?\/)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[\/"'][^{}\/"']+)/,
/^(?:[^{}\/"']+)/,
/^(?:\{)/,
/^(?:\})/,
/^(?:[^\r\n]*(\r|\n)+)/,
/^(?:[^\r\n]+)/,
/^(?:(\r\n|\n|\r))/,
/^(?:'[^\r\n]+')/,
/^(?:"[^\r\n]+")/,
/^(?:([^\S\r\n])+)/,
/^(?:[^\s\r\n]+)/
],
conditions: {
  "bnf": {
    rules: [
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      19,
      20,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61
    ],
    inclusive: true
  },
  "ebnf": {
    rules: [
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      19,
      20,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61
    ],
    inclusive: true
  },
  "token": {
    rules: [
      0,
      1,
      2,
      19,
      20,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61
    ],
    inclusive: true
  },
  "action": {
    rules: [
      61,
      62,
      63,
      64,
      65,
      66,
      67,
      68,
      69,
      70
    ],
    inclusive: false
  },
  "code": {
    rules: [
      51,
      61,
      71,
      72
    ],
    inclusive: false
  },
  "path": {
    rules: [
      19,
      20,
      61,
      73,
      74,
      75,
      76,
      77
    ],
    inclusive: false
  },
  "options": {
    rules: [
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      61
    ],
    inclusive: false
  },
  "INITIAL": {
    rules: [
      19,
      20,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61
    ],
    inclusive: true
  }
}
};

return lexer;
})();
parser.lexer = lexer;

function Parser() {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
  exports.parser = parser;
  exports.Parser = parser.Parser;
  exports.parse = function () {
    return parser.parse.apply(parser, arguments);
  };

}

},{"./ebnf-transform":4,"fs":13}],8:[function(require,module,exports){
// Basic Lexer implemented using JavaScript regular expressions
// MIT Licensed

'use strict';

var XRegExp = require('xregexp');
var lexParser = require('./lex-parser');
var version = require('./package.json').version;
var assert = require('assert');

// expand macros and convert matchers to RegExp's
function prepareRules(dict, actions, caseHelper, tokens, startConditions, opts) {
    var m, i, k, action, conditions,
        active_conditions,
        rules = dict.rules,
        newRules = [],
        macros = {};

    // Assure all options are camelCased:
    assert(typeof opts.options['case-insensitive'] === 'undefined');

    // Depending on the location within the regex we need different expansions of the macros:
    // one expansion for when a macro is *inside* a `[...]` and another expansion when a macro
    // is anywhere else in a regex:
    if (dict.macros) {
        macros = prepareMacros(dict.macros, opts);
    }

    function tokenNumberReplacement(str, token) {
        return 'return ' + (tokens[token] || '\'' + token.replace(/'/g, '\\\'') + '\'');
    }

    // Make sure a comment does not contain any embedded '*/' end-of-comment marker
    // as that would break the generated code
    function postprocessComment(str) {
        if (Array.isArray(str)) {
            str = str.join(' ');
        }
        str = str.replace(/\*\//g, '*\\/');         // destroy any inner `*/` comment terminator sequence.
        return str;
    }

    actions.push('switch($avoiding_name_collisions) {');

    for (i = 0; i < rules.length; i++) {
        active_conditions = [];
        if (Object.prototype.toString.apply(rules[i][0]) !== '[object Array]') {
            // implicit add to all inclusive start conditions
            for (k in startConditions) {
                if (startConditions[k].inclusive) {
                    active_conditions.push(k);
                    startConditions[k].rules.push(i);
                }
            }
        } else if (rules[i][0][0] === '*') {
            // Add to ALL start conditions
            active_conditions.push('*');
            for (k in startConditions) {
                startConditions[k].rules.push(i);
            }
            rules[i].shift();
        } else {
            // Add to explicit start conditions
            conditions = rules[i].shift();
            for (k = 0; k < conditions.length; k++) {
                if (!startConditions.hasOwnProperty(conditions[k])) {
                    startConditions[conditions[k]] = {
                        rules: [],
                        inclusive: false
                    };
                    console.warn('Lexer Warning : "' + conditions[k] + '" start condition should be defined as %s or %x; assuming %x now.');
                }
                active_conditions.push(conditions[k]);
                startConditions[conditions[k]].rules.push(i);
            }
        }

        m = rules[i][0];
        if (typeof m === 'string') {
            m = expandMacros(m, macros, opts);
            m = new XRegExp('^(?:' + m + ')', opts.options.caseInsensitive ? 'i' : '');
        }
        newRules.push(m);
        if (typeof rules[i][1] === 'function') {
            rules[i][1] = String(rules[i][1]).replace(/^\s*function \(\)\s?\{/, '').replace(/\}\s*$/, '');
        }
        action = rules[i][1];
        if (tokens && action.match(/return '(?:\\'|[^']+)+'/)) {
            action = action.replace(/return '((?:\\'|[^']+)+)'/g, tokenNumberReplacement);
        }
        if (tokens && action.match(/return "(?:\\"|[^"]+)+"/)) {
            action = action.replace(/return "((?:\\"|[^"]+)+)"/g, tokenNumberReplacement);
        }

        var code = ['\n/*! Conditions::'];
        code.push(postprocessComment(active_conditions));
        code.push('*/', '\n/*! Rule::      ');
        code.push(postprocessComment(rules[i][0]));
        code.push('*/', '\n');

        // When the action is *only* a simple `return TOKEN` statement, then add it to the caseHelpers;
        // otherwise add the additional `break;` at the end.
        //
        // Note: we do NOT analyze the action block any more to see if the *last* line is a simple
        // `return NNN;` statement as there are too many shoddy idioms, e.g.
        //
        // ```
        // %{ if (cond)
        //      return TOKEN;
        // %}
        // ```
        //
        // which would then cause havoc when our action code analysis (using regexes or otherwise) was 'too simple'
        // to catch these culprits; hence we resort and stick with the most fundamental approach here:
        // always append `break;` even when it would be obvious to a human that such would be 'unreachable code'.
        var match_nr = /^return[\s\r\n]+((?:'(?:\\'|[^']+)+')|(?:"(?:\\"|[^"]+)+")|\d+)[\s\r\n]*;?$/.exec(action.trim());
        if (match_nr) {
            caseHelper.push([].concat(code, i, ':', match_nr[1]).join(' ').replace(/[\n]/g, '\n  '));
        } else {
            actions.push([].concat('case', i, ':', code, action, '\nbreak;').join(' '));
        }
    }
    actions.push('default:');
    actions.push('  return this.simpleCaseActionClusters[$avoiding_name_collisions];');
    actions.push('}');

    return {
        rules: newRules,
        macros: macros
    };
}

// 'Join' a regex set `[...]` into a Unicode range spanning logic array, flagging every character in the given set.
function set2bitarray(bitarr, s) {
    var orig = s;
    var set_is_inverted = false;
    var apply = [];

    function mark(d1, d2) {
        if (d2 == null) d2 = d1;
        for (var i = d1; i <= d2; i++) {
            bitarr[i] = true;
        }
    }

    function exec() {
        // array gets sorted on entry [0] of each sub-array
        apply.sort(function (a, b) {
            return a[0] - b[0];
        });

        // When we have marked all slots, '^' NEGATES the set, hence we flip all slots:
        if (set_is_inverted) {
            for (var i = 0; i < 65536; i++) {
                bitarr[i] = !bitarr[i];
            }
        }
    }

    function eval_escaped_code(s) {
        // decode escaped code? If none, just take the character as-is
        if (s.indexOf('\\') === 0) {
            var l = s.substr(0, 2);
            switch (l) {
            case '\\c':
                var c = s.charCodeAt(2) - 'A'.charCodeAt(0) + 1;
                return String.fromCharCode(c);

            case '\\x':
                s = s.substr(2);
                var c = parseInt(s, 16);
                return String.fromCharCode(c);

            case '\\u':
                s = s.substr(2);
                if (s[0] === '{') {
                    s = s.substr(1, s.length - 2);
                }
                var c = parseInt(s, 16);
                return String.fromCharCode(c);

            case '\\0':
            case '\\1':
            case '\\2':
            case '\\3':
            case '\\4':
            case '\\5':
            case '\\6':
            case '\\7':
                s = s.substr(1);
                var c = parseInt(s, 8);
                return String.fromCharCode(c);

            case '\\r':
                return '\r';

            case '\\n':
                return '\n';

            case '\\v':
                return '\v';

            case '\\f':
                return '\f';

            case '\\t':
                return '\t';

            case '\\r':
                return '\r';

            default:
                // just the chracter itself:
                return s.substr(1);
            }
        } else {
            return s;
        }
    }

    if (s && s.length) {
        // inverted set?
        if (s[0] === '^') {
            set_is_inverted = !set_is_inverted;
            s = s.substr(1);
        }

        // BITARR collects flags for characters set. Inversion means the complement set of character is st instead.
        // This results in an OR operations when sets are joined/chained.

        var chr_re = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})/;
        var xregexp_unicode_escape_re = /^\{[A-Za-z0-9 \-\._]+\}/;              // Matches the XRegExp Unicode escape braced part, e.g. `{Number}`

        while (s.length) {
            var c1 = s.match(chr_re);
            if (!c1) {
                // hit an illegal escape sequence? cope anyway!
                c1 = s[0];
            } else {
                c1 = c1[0];
                // Quick hack for XRegExp escapes inside a regex `[...]` set definition: we *could* try to keep those
                // intact but it's easier to unfold them here; this is not nice for when the grammar specifies explicit
                // XRegExp support, but alas, we'll get there when we get there... ;-)
                switch (c1) {
                case '\\p':
                    s = s.substr(c1.length);
                    var c2 = s.match(xregexp_unicode_escape_re);
                    if (c2) {
                        c2 = c2[0];
                        s = s.substr(c2.length);
                        // expand escape:
                        var xr = new XRegExp('[' + c1 + c2 + ']');           // TODO: case-insensitive grammar???
                        var xs = '' + xr;
                        // remove the wrapping `/[...]/`:
                        xs = xs.substr(2, xs.length - 4);
                        // inject back into source string:
                        s = xs + s;
                        continue;
                    }
                    break;

                case '\\S':
                case '\\s':
                case '\\W':
                case '\\w':
                case '\\d':
                case '\\D':
                    // these can't participate in a range, but need to be treated special:
                    s = s.substr(c1.length);
                    switch (c1[1]) {
                    case 'S':
                        // [^ \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
                        set2bitarray(bitarr, '^ \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff');
                        continue;

                    case 's':
                        // [ \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
                        set2bitarray(bitarr, ' \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff');
                        continue;

                    case 'D':
                        // [^0-9]
                        set2bitarray(bitarr, '^0-9');
                        continue;

                    case 'd':
                        // [0-9]
                        set2bitarray(bitarr, '0-9');
                        continue;

                    case 'W':
                        // [^A-Za-z0-9_]
                        set2bitarray(bitarr, '^A-Za-z0-9_');
                        continue;

                    case 'w':
                        // [A-Za-z0-9_]
                        set2bitarray(bitarr, 'A-Za-z0-9_');
                        continue;
                    }
                    continue;

                case '\\b':
                    // matches a backspace: https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions#special-backspace
                    c1 = '\u0008';
                    break;
                }
            }
            var v1 = eval_escaped_code(c1);
            v1 = v1.charCodeAt(0);
            s = s.substr(c1.length);

            if (s[0] === '-' && s.length >= 2) {
                // we can expect a range like 'a-z':
                s = s.substr(1);
                var c2 = s.match(chr_re);
                if (!c2) {
                    // hit an illegal escape sequence? cope anyway!
                    c2 = s[0];
                } else {
                    c2 = c2[0];
                }
                var v2 = eval_escaped_code(c2);
                v2 = v2.charCodeAt(0);
                s = s.substr(c2.length);

                // legal ranges go UP, not /DOWN!
                if (v1 <= v2) {
                    mark(v1, v2);
                } else {
                    console.warn("INVALID CHARACTER RANGE found in regex: ", { re: orig, start: c1, start_n: v1, end: c2, end_n: v2 });
                    mark(v1);
                    mark('-'.charCodeAt(0));
                    mark(v2);
                }
                continue;
            }
            mark(v1);
        }

        // Since a regex like `[^]` should match everything(?really?), we don't need to check if the MARK
        // phase actually marked anything at all (apply.length > 0):
        exec();
    }
}


// convert a simple bitarray back into a regex set `[...]` content:
function bitarray2set(l, output_inverted_variant) {
    function i2c(i) {
        var c;

        switch (i) {
        case 10:
            return '\\n';

        case 13:
            return '\\r';

        case 9:
            return '\\t';

        case 8:
            return '\\b';

        case 12:
            return '\\f';

        case 11:
            return '\\v';

        case 45:        // ASCII/Unicode for '-' dash
            return '\\-';

        case 91:        // '['
            return '\\[';

        case 92:        // '\\'
            return '\\\\';

        case 93:        // ']'
            return '\\]';

        case 94:        // ']'
            return '\\^';
        }
        // Check and warn user about Unicode Supplementary Plane content as that will be FRIED!
        if (i >= 0xD800 && i < 0xDFFF) {
            throw new Error("You have Unicode Supplementary Plane content in a regex set: JavaScript has severe problems with Supplementary Plane content, particularly in regexes, so you are kindly required to get rid of this stuff. Sorry! (Offending UCS-2 code which triggered this: 0x" + i.toString(16) + ")");
        }
        if (i < 32
                || i > 0xFFF0 /* Unicode Specials, also in UTF16 */
                || (i >= 0xD800 && i < 0xDFFF) /* Unicode Supplementary Planes; we're TOAST in JavaScript as we're NOT UTF-16 but UCS-2! */
                || String.fromCharCode(i).match(/[\u2028\u2029]/) /* Code compilation via `new Function()` does not like to see these, or rather: treats them as just another form of CRLF, which breaks your generated regex code! */
            ) {
            // Detail about a detail:
            // U+2028 and U+2029 are part of the `\s` regex escape code (`\s` and `[\s]` match either of these) and when placed in a JavaScript
            // source file verbatim (without escaping it as a `\uNNNN` item) then JavaScript will interpret it as such and consequently report
            // a b0rked generated parser, as the generated code would include this regex right here.
            // Hence we MUST escape these buggers everywhere we go...
            c = '0000' + i.toString(16);
            return '\\u' + c.substr(c.length - 4);
        }
        return String.fromCharCode(i);
    }

    // construct the inverse(?) set from the mark-set:
    //
    // Before we do that, we inject a sentinel so that our inner loops
    // below can be simple and fast:
    l[65536] = 1;
    // now reconstruct the regex set:
    var rv = [];
    var i, j;
    var entire_range_is_marked = false;
    if (output_inverted_variant) {
        // generate the inverted set, hence all unmarked slots are part of the output range:
        i = 0;
        while (i <= 65535) {
            // find first character not in original set:
            while (l[i]) {
                i++;
            }
            if (i > 65535) {
                break;
            }
            // find next character not in original set:
            for (j = i + 1; !l[j]; j++) {} /* empty loop */
            // generate subset:
            rv.push(i2c(i));
            if (j - 1 > i) {
                entire_range_is_marked = (i === 0 && j === 65536);
                rv.push((j - 2 > i ? '-' : '') + i2c(j - 1));
            }
            i = j;
        }
    } else {
        // generate the non-inverted set, hence all logic checks are inverted here...
        i = 0;
        while (i <= 65535) {
            // find first character not in original set:
            while (!l[i]) {
                i++;
            }
            if (i > 65535) {
                break;
            }
            // find next character not in original set:
            for (j = i + 1; l[j]; j++) {} /* empty loop */
            if (j > 65536) {
                j = 65536;
            }
            // generate subset:
            rv.push(i2c(i));
            if (j - 1 > i) {
                entire_range_is_marked = (i === 0 && j === 65536);
                rv.push((j - 2 > i ? '-' : '') + i2c(j - 1));
            }
            i = j;
        }
    }

    // When there's nothing in the output we output a special 'match-nothing' regex: `[^\S\s]`.
    // When we find the entire Unicode range is in the output match set, we also replace this with
    // a shorthand regex: `[\S\s]` (thus replacing the `[\u0000-\uffff]` regex we generated here).
    var s;
    if (!rv.length) {
        // entire range turnes out to be EXCLUDED:
        s = '^\\S\\s';
    } else if (entire_range_is_marked) {
        // entire range turnes out to be INCLUDED:
        s = '\\S\\s';
    } else {
        s = rv.join('');
    }

    return s;
}


// Pretty brutal conversion of 'regex' `s` back to raw regex set content: strip outer [...] when they're there;
// ditto for inner combos of sets, i.e. `]|[` as in `[0-9]|[a-z]`.
function reduceRegexToSet(s, name) {
    var orig = s;

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }

    var chr_re = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})/;
    var set_part_re = /^(?:[^\\\]]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;
    var nothing_special_re = /^(?:[^\\\[\]\(\)\|^]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;

    var l = new Array(65536 + 3);
    var internal_state = 0;

    while (s.length) {
        var c1 = s.match(chr_re);
        if (!c1) {
            // cope with illegal escape sequences too!
            return new Error('illegal escape sequence at start of regex part: "' + s + '" of regex "' + orig + '"');
        } else {
            c1 = c1[0];
        }
        s = s.substr(c1.length);

        switch (c1) {
        case '[':
            // this is starting a set within the regex: scan until end of set!
            var set_content = [];
            while (s.length) {
                var inner = s.match(set_part_re);
                if (!inner) {
                    inner = s.match(chr_re);
                    if (!inner) {
                        // cope with illegal escape sequences too!
                        return new Error('illegal escape sequence at start of regex part: ' + s + '" of regex "' + orig + '"');
                    } else {
                        inner = inner[0];
                    }
                    if (inner === ']') break;
                } else {
                    inner = inner[0];
                }
                set_content.push(inner);
                s = s.substr(inner.length);
            }

            // ensure that we hit the terminating ']':
            var c2 = s.match(chr_re);
            if (!c2) {
                // cope with illegal escape sequences too!
                return new Error('regex set expression is broken in regex: "' + orig + '" --> "' + s + '"');
            } else {
                c2 = c2[0];
            }
            if (c2 !== ']') {
                return new Error('regex set expression is broken in regex: ' + orig);
            }
            s = s.substr(c2.length);

            var se = set_content.join('');
            if (!internal_state) {
                set2bitarray(l, se);

                // a set is to use like a single character in a longer literal phrase, hence input `[abc]word[def]` would thus produce output `[abc]`:
                internal_state = 1;
            }
            break;

        // Strip unescaped pipes to catch constructs like `\\r|\\n` and turn them into
        // something ready for use inside a regex set, e.g. `\\r\\n`.
        //
        // > Of course, we realize that converting more complex piped constructs this way
        // > will produce something you might not expect, e.g. `A|WORD2` which
        // > would end up as the set `[AW]` which is something else than the input
        // > entirely.
        // >
        // > However, we can only depend on the user (grammar writer) to realize this and
        // > prevent this from happening by not creating such oddities in the input grammar.
        case '|':
            // a|b --> [ab]
            internal_state = 0;
            break;

        case '(':
            // (a) --> a
            //
            // TODO - right now we treat this as 'too complex':

            // Strip off some possible outer wrappers which we know how to remove.
            // We don't worry about 'damaging' the regex as any too-complex regex will be caught
            // in the validation check at the end; our 'strippers' here would not damage useful
            // regexes anyway and them damaging the unacceptable ones is fine.
            s = s.replace(/^\((?:\?:)?(.*?)\)$/, '$1');         // (?:...) -> ...  and  (...) -> ...
            s = s.replace(/^\^?(.*?)\$?$/, '$1');               // ^...$ --> ...  (catch these both inside and outside the outer grouping, hence do the ungrouping twice: one before, once after this)
            s = s.replace(/^\((?:\?:)?(.*?)\)$/, '$1');         // (?:...) -> ...  and  (...) -> ...

            return new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + orig + ']"]');

        case '.':
        case '*':
        case '+':
        case '?':
            // wildcard
            //
            // TODO - right now we treat this as 'too complex':
            return new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + orig + ']"]');

        case '{':                        // range, e.g. `x{1,3}`, or macro?
            // TODO - right now we treat this as 'too complex':
            return new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + orig + ']"]');

        default:
            // literal character or word: take the first character only and ignore the rest, so that
            // the constructed set for `word|noun` would be `[wb]`:
            if (!internal_state) {
                set2bitarray(l, c1);

                internal_state = 2;
            }
            break;
        }
    }

    s = bitarray2set(l);

    // When this result is suitable for use in a set, than we should be able to compile
    // it in a regex; that way we can easily validate whether macro X is fit to be used
    // inside a regex set:
    try {
        var re;
        assert(s);
        assert(!(s instanceof Error));
        re = new XRegExp('[' + s + ']');
        re.test(s[0]);

        // One thing is apparently *not* caught by the RegExp compile action above: `[a[b]c]`
        // so we check for lingering UNESCAPED brackets in here as those cannot be:
        if (/[^\\][\[\]]/.exec(s)) {
            throw new Error('unescaped brackets in set data');
        }
    } catch (ex) {
        // make sure we produce a set range expression which will fail badly when it is used
        // in actual code:
        s = new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + s + ']"]: ' + ex.message);
    }

    return s;
}


// expand all macros (with maybe one exception) in the given regex: the macros may exist inside `[...]` regex sets or
// elsewhere, which requires two different treatments to expand these macros.
function reduceRegex(s, name, opts, expandAllMacrosInSet_cb, expandAllMacrosElsewhere_cb) {
    var orig = s;
    var regex_simple_size = 0;
    var regex_previous_alts_simple_size = 0;

    function errinfo() {
        if (name) {
            return 'macro [[' + name + ']]';
        } else {
            return 'regex [[' + orig + ']]';
        }
    }

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }

    var chr_re = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})/;
    var set_part_re = /^(?:[^\\\]]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;
    var nothing_special_re = /^(?:[^\\\[\]\(\)\|^\{\}]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;
    var xregexp_unicode_escape_re = /^\{[A-Za-z0-9 \-\._]+\}/;              // Matches the XRegExp Unicode escape braced part, e.g. `{Number}`

    var rv = [];

    while (s.length) {
        var c1 = s.match(chr_re);
        if (!c1) {
            // cope with illegal escape sequences too!
            return new Error(errinfo() + ': illegal escape sequence at start of regex part: ' + s);
        } else {
            c1 = c1[0];
        }
        s = s.substr(c1.length);

        switch (c1) {
        case '[':
            // this is starting a set within the regex: scan until end of set!
            var set_content = [];
            var l = new Array(65536 + 3);

            while (s.length) {
                var inner = s.match(set_part_re);
                if (!inner) {
                    inner = s.match(chr_re);
                    if (!inner) {
                        // cope with illegal escape sequences too!
                        return new Error(errinfo() + ': illegal escape sequence at start of regex part: ' + s);
                    } else {
                        inner = inner[0];
                    }
                    if (inner === ']') break;
                } else {
                    inner = inner[0];
                }
                set_content.push(inner);
                s = s.substr(inner.length);
            }

            // ensure that we hit the terminating ']':
            var c2 = s.match(chr_re);
            if (!c2) {
                // cope with illegal escape sequences too!
                return new Error(errinfo() + ': regex set expression is broken: "' + s + '"');
            } else {
                c2 = c2[0];
            }
            if (c2 !== ']') {
                return new Error(errinfo() + ': regex set expression is broken: apparently unterminated');
            }
            s = s.substr(c2.length);

            var se = set_content.join('');

            // expand any macros in here:
            if (expandAllMacrosInSet_cb) {
                se = expandAllMacrosInSet_cb(se);
                assert(se);
                if (se instanceof Error) {
                    return new Error(errinfo() + ': ' + se.message);
                }
            }

            set2bitarray(l, se);

            // find out which set expression is optimal in size:
            var s1 = bitarray2set(l);
            var s2 = /* '^' + */ bitarray2set(l, true);
            if (s2[0] === '^') {
                s2 = s2.substr(1);
            } else {
                s2 = '^' + s2;
            }
            // check if the source regex set potentially has any expansions (guestimate!)
            //
            // The indexOf('{') picks both XRegExp Unicode escapes and JISON lexer macros, which is perfect for us here.
            var has_expansions = (se.indexOf('{') >= 0);
            if (s2.length < s1.length) {
                s1 = s2;
            }
            if (!has_expansions && se.length < s1.length) {
                s1 = se;
            }
            rv.push('[' + s1 + ']');
            break;

        // XRegExp Unicode escape, e.g. `\\p{Number}`:
        case '\\p':
            var c2 = s.match(xregexp_unicode_escape_re);
            if (c2) {
                c2 = c2[0];
                s = s.substr(c2.length);

                // nothing to expand.
                rv.push(c1 + c2);
            } else {
                // nothing to stretch this match, hence nothing to expand.
                rv.push(c1);
            }
            break;

        // Either a range expression or the start of a macro reference: `.{1,3}` or `{NAME}`.
        // Treat it as a macro reference and see if it will expand to anything:
        case '{':
            var c2 = s.match(nothing_special_re);
            if (c2) {
                c2 = c2[0];
                s = s.substr(c2.length);

                var c3 = s[0];
                s = s.substr(c3.length);
                if (c3 === '}') {
                    // possibly a macro name in there... Expand if possible:
                    c2 = c1 + c2 + c3;
                    if (expandAllMacrosElsewhere_cb) {
                        c2 = expandAllMacrosElsewhere_cb(c2);
                        assert(c2);
                        if (c2 instanceof Error) {
                            return new Error(errinfo() + ': ' + c2.message);
                        }
                    }
                } else {
                    // not a well-terminated macro reference or something completely different:
                    // we do not even attempt to expand this as there's guaranteed nothing to expand
                    // in this bit.
                    c2 = c1 + c2 + c3;
                }
                rv.push(c2);
            } else {
                // nothing to stretch this match, hence nothing to expand.
                rv.push(c1);
            }
            break;

        // Recognize some other regex elements, but there's no need to understand them all.
        //
        // We are merely interested in any chunks now which do *not* include yet another regex set `[...]`
        // nor any `{MACRO}` reference:
        default:
            // non-set character or word: see how much of this there is for us and then see if there
            // are any macros still lurking inside there:
            var c2 = s.match(nothing_special_re);
            if (c2) {
                c2 = c2[0];
                s = s.substr(c2.length);

                // nothing to expand.
                rv.push(c1 + c2);
            } else {
                // nothing to stretch this match, hence nothing to expand.
                rv.push(c1);
            }
            break;
        }
    }

    s = rv.join('');

    // When this result is suitable for use in a set, than we should be able to compile
    // it in a regex; that way we can easily validate whether macro X is fit to be used
    // inside a regex set:
    try {
        var re;
        re = new XRegExp(s);
        re.test(s[0]);
    } catch (ex) {
        // make sure we produce a regex expression which will fail badly when it is used
        // in actual code:
        return new Error(errinfo() + ': expands to an invalid regex: /' + s + '/');
    }

    return s;
}


// 'normalize' a `[...]` set by inverting an inverted `[^...]` set:
function normalizeSet(s, output_inverted_variant) {
    var orig = s;

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }

    if (s && s.length) {
        // // inverted set?
        // if (s[0] === '^') {
        //     output_inverted_variant = !output_inverted_variant;
        //     s = s.substr(1);
        // }

        var l = new Array(65536 + 3);
        set2bitarray(l, s);

        s = bitarray2set(l, output_inverted_variant);
    }

    return s;
}




// expand macros within macros and cache the result
function prepareMacros(dict_macros, opts) {
    var macros = {};

    // expand a `{NAME}` macro which exists inside a `[...]` set:
    function expandMacroInSet(i) {
        var k, a, m;
        if (!macros[i]) {
            m = dict_macros[i];

            if (m.indexOf('{') >= 0) {
                // set up our own record so we can detect definition loops:
                macros[i] = {
                    in_set: false,
                    in_inv_set: false,
                    elsewhere: null,
                    raw: dict_macros[i]
                };

                for (k in dict_macros) {
                    if (dict_macros.hasOwnProperty(k) && i !== k) {
                        // it doesn't matter if the lexer recognized that the inner macro(s)
                        // were sitting inside a `[...]` set or not: the fact that they are used
                        // here in macro `i` which itself sits in a set, makes them *all* live in
                        // a set so all of them get the same treatment: set expansion style.
                        //
                        // Note: make sure we don't try to expand any XRegExp `\p{...}` or `\P{...}`
                        // macros here:
                        if (XRegExp._getUnicodeProperty(k)) {
                            // Work-around so that you can use `\p{ascii}` for a XRegExp slug, a.k.a.
                            // Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories,
                            // while using `\p{ASCII}` as a *macro expansion* of the `ASCII`
                            // macro:
                            if (k.toUpperCase() !== k) {
                                m = new Error('Cannot use name "' + k + '" as a macro name as it clashes with the same XRegExp "\\p{..}" Unicode \'General Category\' Property name. Use all-uppercase macro names, e.g. name your macro "' + k.toUpperCase() + '" to work around this issue or give your offending macro a different name.');
                                break;
                            }
                        }

                        a = m.split('{' + k + '}');
                        if (a.length > 1) {
                            var x = expandMacroInSet(k);
                            assert(x);
                            if (x instanceof Error) {
                                m = x;
                                break;
                            }
                            m = a.join(x);
                        }
                    }
                }
            }

            m = reduceRegexToSet(m, i);

            macros[i] = {
                in_set: normalizeSet(m, false),
                in_inv_set: normalizeSet(m, true),
                elsewhere: null,
                raw: dict_macros[i]
            };
        } else {
            m = macros[i].in_set;

            if (m instanceof Error) {
                // this turns out to be an macro with 'issues' and it is used, so the 'issues' do matter: bombs away!
                return new Error(m.message);
            }

            // detect definition loop:
            if (m === false) {
                return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
            }
        }

        return m;
    }

    function expandMacroElsewhere(i) {
        var k, a, m;

        if (macros[i].elsewhere == null) {
            m = dict_macros[i];

            // set up our own record so we can detect definition loops:
            macros[i].elsewhere = false;

            // the macro MAY contain other macros which MAY be inside a `[...]` set in this
            // macro or elsewhere, hence we must parse the regex:
            m = reduceRegex(m, i, opts, expandAllMacrosInSet, expandAllMacrosElsewhere);
            assert(m);
            // propagate deferred exceptions = error reports.
            if (m instanceof Error) {
                return m;
            }

            macros[i].elsewhere = m;
        } else {
            m = macros[i].elsewhere;

            if (m instanceof Error) {
                // this turns out to be an macro with 'issues' and it is used, so the 'issues' do matter: bombs away!
                return m;
            }

            // detect definition loop:
            if (m === false) {
                return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
            }
        }

        return m;
    }

    function expandAllMacrosInSet(s) {
        var i, x;

        // process *all* the macros inside [...] set:
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        x = expandMacroInSet(i);
                        assert(x);
                        if (x instanceof Error) {
                            return new Error('failure to expand the macro [' + i + '] in set [' + s + ']: ' + x.message);
                        }
                        s = a.join(x);
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }

    function expandAllMacrosElsewhere(s) {
        var i, x;

        // When we process the remaining macro occurrences in the regex
        // every macro used in a lexer rule will become its own capture group.
        //
        // Meanwhile the cached expansion will expand any submacros into
        // *NON*-capturing groups so that the backreference indexes remain as you'ld
        // expect and using macros doesn't require you to know exactly what your
        // used macro will expand into, i.e. which and how many submacros it has.
        //
        // This is a BREAKING CHANGE from vanilla jison 0.4.15!
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    // These are all submacro expansions, hence non-capturing grouping is applied:
                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        x = expandMacroElsewhere(i);
                        assert(x);
                        if (x instanceof Error) {
                            return new Error('failure to expand the macro [' + i + '] in regex /' + s + '/: ' + x.message);
                        }
                        s = a.join('(?:' + x + ')');
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }


    var m, i;

    if (opts.debug) console.log('\n############## RAW macros: ', dict_macros);

    // first we create the part of the dictionary which is targeting the use of macros
    // *inside* `[...]` sets; once we have completed that half of the expansions work,
    // we then go and expand the macros for when they are used elsewhere in a regex:
    // iff we encounter submacros then which are used *inside* a set, we can use that
    // first half dictionary to speed things up a bit as we can use those expansions
    // straight away!
    for (i in dict_macros) {
        if (dict_macros.hasOwnProperty(i)) {
            expandMacroInSet(i);
        }
    }

    for (i in dict_macros) {
        if (dict_macros.hasOwnProperty(i)) {
            expandMacroElsewhere(i);
        }
    }

    if (opts.debug) console.log('\n############### expanded macros: ', macros);

    return macros;
}



// expand macros in a regex; expands them recursively
function expandMacros(src, macros, opts) {
    var expansion_count = 0;

    // By the time we call this function `expandMacros` we MUST have expanded and cached all macros already!
    // Hence things should be easy in there:

    function expandAllMacrosInSet(s) {
        var i, m, x;

        // process *all* the macros inside [...] set:
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    m = macros[i];

                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        var x = m.in_set;

                        assert(x);
                        if (x instanceof Error) {
                            // this turns out to be an macro with 'issues' and it is used, so the 'issues' do matter: bombs away!
                            throw x;
                        }

                        // detect definition loop:
                        if (x === false) {
                            return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
                        }

                        s = a.join(x);
                        expansion_count++;
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }

    function expandAllMacrosElsewhere(s) {
        var i, m, x;

        // When we process the main macro occurrences in the regex
        // every macro used in a lexer rule will become its own capture group.
        //
        // Meanwhile the cached expansion will expand any submacros into
        // *NON*-capturing groups so that the backreference indexes remain as you'ld
        // expect and using macros doesn't require you to know exactly what your
        // used macro will expand into, i.e. which and how many submacros it has.
        //
        // This is a BREAKING CHANGE from vanilla jison 0.4.15!
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    m = macros[i];

                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        // These are all main macro expansions, hence CAPTURING grouping is applied:
                        x = m.elsewhere;
                        assert(x);

                        // detect definition loop:
                        if (x === false) {
                            return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
                        }

                        s = a.join('(' + x + ')');
                        expansion_count++;
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }


    // When we process the macro occurrences in the regex
    // every macro used in a lexer rule will become its own capture group.
    //
    // Meanwhile the cached expansion will have expanded any submacros into
    // *NON*-capturing groups so that the backreference indexes remain as you'ld
    // expect and using macros doesn't require you to know exactly what your
    // used macro will expand into, i.e. which and how many submacros it has.
    //
    // This is a BREAKING CHANGE from vanilla jison 0.4.15!
    var s2 = reduceRegex(src, null, opts, expandAllMacrosInSet, expandAllMacrosElsewhere);
    // propagate deferred exceptions = error reports.
    if (s2 instanceof Error) {
        throw s2;
    }

    // only when we did expand some actual macros do we take the re-interpreted/optimized/regenerated regex from reduceRegex()
    // in order to keep our test cases simple and rules recognizable. This assumes the user can code good regexes on his own,
    // as long as no macros are involved...
    //
    // Also pick the reduced regex when there (potentially) are XRegExp extensions in the original, e.g. `\\p{Number}`,
    // unless the `xregexp` output option has been enabled.
    if (expansion_count > 0 || (src.indexOf('\\p{') >= 0 && !opts.options.xregexp)) {
        src = s2;
    } else {
        // Check if the reduced regex is smaller in size; when it is, we still go with the new one!
        if (s2.length < src.length) {
            src = s2;
        }
    }

    return src;
}

function prepareStartConditions (conditions) {
    var sc,
        hash = {};
    for (sc in conditions) {
        if (conditions.hasOwnProperty(sc)) {
            hash[sc] = {rules:[], inclusive: !conditions[sc]};
        }
    }
    return hash;
}

function buildActions(dict, tokens, opts) {
    var actions = [dict.actionInclude || '', 'var YYSTATE = YY_START;'];
    var tok;
    var toks = {};
    var caseHelper = [];

    for (tok in tokens) {
        toks[tokens[tok]] = tok;
    }

    if (opts.options.flex) {
        dict.rules.push(['.', 'console.log(yytext);']);
    }

    var gen = prepareRules(dict, actions, caseHelper, tokens && toks, opts.conditions, opts);

    var fun = actions.join('\n');
    'yytext yyleng yylineno yylloc'.split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp('\\b(' + yy + ')\\b', 'g'), 'yy_.$1');
    });

    return {
        caseHelperInclude: '{\n' + caseHelper.join(',') + '\n}',

        actions: 'function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START) {\n' + fun + '\n}',

        rules: gen.rules,
        macros: gen.macros                   // propagate these for debugging/diagnostic purposes
    };
}

//
// NOTE: this is *almost* a copy of the JisonParserError producing code in
//       jison/lib/jison.js @ line 2304:lrGeneratorMixin.generateErrorClass
//
function generateErrorClass() {
    // See also:
    // http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
    // but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
    // with userland code which might access the derived class in a 'classic' way.
    function JisonLexerError(msg, hash) {
        Object.defineProperty(this, 'name', {
            enumerable: false,
            writable: false,
            value: 'JisonLexerError'
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
            Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
        } else {
            JisonLexerError.prototype = Object.create(Error.prototype);
        }
        JisonLexerError.prototype.constructor = JisonLexerError;
        JisonLexerError.prototype.name = 'JisonLexerError';
    }
    __extra_code__();

    var prelude = [
        '// See also:',
        '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508',
        '// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility',
        '// with userland code which might access the derived class in a \'classic\' way.',
        String(JisonLexerError).replace(/^    /gm, ''),
        String(__extra_code__).replace(/^    /gm, '').replace(/function [^\{]+\{/, '').replace(/\}$/, ''),
        '',
    ];

    return prelude;
}


var jisonLexerErrorDefinition = generateErrorClass();


function RegExpLexer(dict, input, tokens) {
    var opts;
    var dump = false;

    function test_me(tweak_cb, description, src_exception, ex_callback) {
        opts = processGrammar(dict, tokens);
        opts.in_rules_failure_analysis_mode = false;
        if (tweak_cb) {
            tweak_cb();
        }
        var source = generateModuleBody(opts);
        try {
            // The generated code will always have the `lexer` variable declared at local scope
            // as `eval()` will use the local scope.
            //
            // The compiled code will look something like this:
            //
            // ```
            // var lexer;
            // bla bla...
            // ```
            //
            // or
            //
            // ```
            // var lexer = { bla... };
            // ```
            var testcode = [
                '// provide a local version for test purposes:',
                jisonLexerErrorDefinition.join('\n'),
                '',
                'var __hacky_counter__ = 0;',
                'function XRegExp(re, f) {',
                '  this.re = re;',
                '  this.flags = f;',
                '  var fake = /./;',    // WARNING: this exact 'fake' is also depended upon by the xregexp unit test!
                '  __hacky_counter__++;',
                '  fake.__hacky_backy__ = __hacky_counter__;',
                '  return fake;',
                '}',
                '',
                source,
                'return lexer;'].join('\n');
            //console.log("===============================TEST CODE\n", testcode, "\n=====================END====================\n");
            var lexer_f = new Function('', testcode);
            var lexer = lexer_f();

            if (!lexer) {
                throw new Error('no lexer defined *at all*?!');
            }
            if (typeof lexer.options !== 'object' || lexer.options == null) {
                throw new Error('your lexer class MUST have an .options member object or it won\'t fly!');
            }
            if (typeof lexer.setInput !== 'function') {
                throw new Error('your lexer class MUST have a .setInput function member or it won\'t fly!');
            }
            if (lexer.EOF !== 1 && lexer.ERROR !== 2) {
                throw new Error('your lexer class MUST have these constants defined: lexer.EOF = 1 and lexer.ERROR = 2 or it won\'t fly!');
            }

            // When we do NOT crash, we found/killed the problem area just before this call!
            if (src_exception && description) {
                src_exception.message += '\n        (' + description + ')';
            }

            // patch the pre and post handlers in there, now that we have some live code to work with:
            if (opts.options) {
                var pre = opts.options.pre_lex;
                var post = opts.options.post_lex;
                // since JSON cannot encode functions, we'll have to do it manually now:
                if (typeof pre === 'function') {
                    lexer.options.pre_lex = pre;
                }
                if (typeof post === 'function') {
                    lexer.options.post_lex = post;
                }
            }

            if (opts.options.showSource) {
                if (typeof opts.options.showSource === 'function') {
                    opts.options.showSource(lexer, source, opts);
                } else {
                    console.log("\nGenerated lexer sourcecode:\n----------------------------------------\n", source, "\n----------------------------------------\n");
                }
            }
            return lexer;
        } catch (ex) {
            // if (src_exception) {
            //     src_exception.message += '\n        (' + description + ': ' + ex.message + ')';
            // }

            if (ex_callback) {
                ex_callback(ex);
            } else if (dump) {
                console.log('source code:\n', source);
            }
            return false;
        }
    }

    var lexer = test_me(null, null, null, function (ex) {
        // When we get an exception here, it means some part of the user-specified lexer is botched.
        //
        // Now we go and try to narrow down the problem area/category:
        if (!test_me(function () {
            opts.conditions = [];
            opts.showSource = false;
        }, (dict.rules.length > 0 ?
            'One or more of your lexer state names are possibly botched?' :
            'Your custom lexer is somehow botched.'), ex)) {
            if (!test_me(function () {
                // opts.conditions = [];
                opts.rules = [];
                opts.showSource = false;
                opts.in_rules_failure_analysis_mode = true;
            }, 'One or more of your lexer rules are possibly botched?', ex)) {
                // kill each rule action block, one at a time and test again after each 'edit':
                var rv = false;
                for (var i = 0, len = dict.rules.length; i < len; i++) {
                    dict.rules[i][1] = '{ /* nada */ }';
                    rv = test_me(function () {
                        // opts.conditions = [];
                        // opts.rules = [];
                        // opts.in_rules_failure_analysis_mode = true;
                    }, 'Your lexer rule "' + dict.rules[i][0] + '" action code block is botched?', ex);
                    if (rv) {
                        break;
                    }
                }
                if (!rv) {
                    test_me(function () {
                        opts.conditions = [];
                        opts.rules = [];
                        opts.performAction = 'null';
                        // opts.options = {};
                        // opts.caseHelperInclude = '{}';
                        opts.showSource = false;
                        opts.in_rules_failure_analysis_mode = true;

                        dump = false;
                    }, 'One or more of your lexer rule action code block(s) are possibly botched?', ex);
                }
            }
        }
        throw ex;
    });

    lexer.yy = {};
    if (input) {
        lexer.setInput(input);
    }

    lexer.generate = function () {
        return generateFromOpts(opts);
    };
    lexer.generateModule = function () {
        return generateModule(opts);
    };
    lexer.generateCommonJSModule = function () {
        return generateCommonJSModule(opts);
    };
    lexer.generateAMDModule = function () {
        return generateAMDModule(opts);
    };

    // internal APIs to aid testing:
    lexer.getExpandedMacros = function () {
        return opts.macros;
    };

    return lexer;
}

// As a function can be reproduced in source-code form by any JavaScript engine, we're going to wrap this chunk
// of code in a function so that we can easily get it including it comments, etc.:
function getRegExpLexerPrototype() {
var __objdef__ = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,        // <-- injected by the code generator

    // options: {},                             // <-- injected by the code generator

    // yy: ...,                                 // <-- injected by setInput()

    __currentRuleSet__: null,                   // <-- internal rule set cache for the current lexer state

    parseError: function lexer_parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

    // clear the lexer token context; intended for internal use only
    clear: function lexer_clear() {
        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        this.matches = false;
        this._more = false;
        this._backtrack = false;
    },

    // resets the lexer, sets new input
    setInput: function lexer_setInput(input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this.clear();
        this._signaled_error_token = this.done = false;
        this.yylineno = 0;
        this.matched = '';
        this.conditionStack = ['INITIAL'];
        this.__currentRuleSet__ = null;
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
    },

    // consumes and returns one char from the input
    input: function lexer_input() {
        if (!this._input) {
            this.done = true;
            return null;
        }
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        // Count the linenumber up when we hit the LF (or a stand-alone CR).
        // On CRLF, the linenumber is incremented when you fetch the CR or the CRLF combo
        // and we advance immediately past the LF as well, returning both together as if
        // it was all a single 'character' only.
        var slice_len = 1;
        var lines = false;
        if (ch === '\n') {
            lines = true;
        } else if (ch === '\r') {
            lines = true;
            var ch2 = this._input[1];
            if (ch2 === '\n') {
                slice_len++;
                ch += ch2;
                this.yytext += ch2;
                this.yyleng++;
                this.offset++;
                this.match += ch2;
                this.matched += ch2;
                if (this.options.ranges) {
                    this.yylloc.range[1]++;
                }
            }
        }
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(slice_len);
        return ch;
    },

    // unshifts one char (or a string) into the input
    unput: function lexer_unput(ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - len);
        this.matched = this.matched.substr(0, this.matched.length - len);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }

        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = (lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                + oldLines[oldLines.length - lines.length].length - lines[0].length :
                this.yylloc.first_column - len);

        if (this.options.ranges) {
            this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng - len;
        }
        this.yyleng = this.yytext.length;
        this.done = false;
        return this;
    },

    // When called from action, caches matched text and appends it on next action
    more: function lexer_more() {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function lexer_reject() {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            // when the parseError() call returns, we MUST ensure that the error is registered.
            // We accomplish this by signaling an 'error' token to be produced for the current
            // .lex() run.
            this._signaled_error_token = (this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: this.match,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR);
        }
        return this;
    },

    // retain first n characters of the match
    less: function lexer_less(n) {
        return this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    pastInput: function lexer_pastInput(maxSize, maxLines) {
        var past = this.matched.substring(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = past.length;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substr` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        past = past.substr(-maxSize * 2 - 2);
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = past.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(-maxLines);
        past = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis prefix...
        if (past.length > maxSize) {
            past = '...' + past.substr(-maxSize);
        }
        return past;
    },

    // return (part of the) upcoming input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = maxSize;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substring` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        if (next.length < maxSize * 2 + 2) {
            next += this._input.substring(0, maxSize * 2 + 2);  // substring is faster on Chrome/V8
        }
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = next.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(0, maxLines);
        next = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis postfix...
        if (next.length > maxSize) {
            next = next.substring(0, maxSize) + '...';
        }
        return next;
    },

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
        var pre = this.pastInput(maxPrefix).replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput(maxPostfix).replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // helper function, used to produce a human readable description as a string, given
    // the input `yylloc` location object. 
    // Set `display_range_too` to TRUE to include the string character inex position(s)
    // in the description if the `yylloc.range` is available. 
    describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
        var l1 = yylloc.first_line;
        var l2 = yylloc.last_line;
        var o1 = yylloc.first_column;
        var o2 = yylloc.last_column - 1;
        var dl = l2 - l1;
        var d_o = (dl === 0 ? o2 - o1 : 1000);
        var rv;
        if (dl === 0) {
            rv = 'line ' + l1 + ', ';
            if (d_o === 0) {
                rv += 'column ' + o1;
            } else {
                rv += 'columns ' + o1 + ' .. ' + o2;
            }
        } else {
            rv = 'lines ' + l1 + '(column ' + o1 + ') .. ' + l2 + '(column ' + o2 + ')';
        }
        if (yylloc.range && display_range_too) {
            var r1 = yylloc.range[0];
            var r2 = yylloc.range[1] - 1;
            if (r2 === r1) {
                rv += ' {String Offset: ' + r1 + '}';
            } else {
                rv += ' {String Offset range: ' + r1 + ' .. ' + r2 + '}';
            }
        }
        return rv;
        // return JSON.stringify(yylloc);
    },

    // test the lexed token: return FALSE when not a match, otherwise return token.
    //
    // `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
    // contains the actually matched text string.
    //
    // Also move the input cursor forward and update the match collectors:
    // - yytext
    // - yyleng
    // - match
    // - matches
    // - yylloc
    // - offset
    test_match: function lexer_test_match(match, indexed_rule) {
        var token,
            lines,
            backup,
            match_str;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        match_str = match[0];
        lines = match_str.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match_str.length
        };
        this.yytext += match_str;
        this.match += match_str;
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        // previous lex rules MAY have invoked the `more()` API rather than producing a token:
        // those rules will already have moved this `offset` forward matching their match lengths,
        // hence we must only add our own match length now:
        this.offset += match_str.length;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match_str.length);
        this.matched += match_str;
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            this.__currentRuleSet__ = null;
            return false; // rule action called reject() implying the next rule should be tested instead.
        } else if (this._signaled_error_token) {
            // produce one 'error' token as .parseError() in reject() did not guarantee a failure signal by throwing an exception!
            token = this._signaled_error_token;
            this._signaled_error_token = false;
            return token;
        }
        return false;
    },

    // return next match in input
    next: function lexer_next() {
        if (this.done) {
            this.clear();
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.clear();
        }
        var rules = this.__currentRuleSet__;
        if (!rules) {
            // Update the ruleset cache as we apparently encountered a state change or just started lexing.
            // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
            // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
            // speed up those activities a tiny bit.
            rules = this.__currentRuleSet__ = this._currentRules();
        }
        for (var i = 0, len = rules.length; i < len; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = undefined;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === '') {
            this.clear();
            this.done = true;
            return this.EOF;
        } else {
            token = this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: this.match + this._input,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR;
            if (token === this.ERROR) {
                // we can try to recover from a lexer error that parseError() did not 'recover' for us, by moving forward at least one character at a time:
                if (!this.match.length) {
                    this.input();
                }
            }
            return token;
        }
    },

    // return next match that has a token
    lex: function lexer_lex() {
        var r;
        // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
        if (typeof this.options.pre_lex === 'function') {
            r = this.options.pre_lex.call(this);
        }
        while (!r) {
            r = this.next();
        }
        if (typeof this.options.post_lex === 'function') {
            // (also account for a userdef function which does not return any value: keep the token as is)
            r = this.options.post_lex.call(this, r) || r;
        }
        return r;
    },

    // backwards compatible alias for `pushState()`;
    // the latter is symmetrical with `popState()` and we advise to use
    // those APIs in any modern lexer code, rather than `begin()`.
    begin: function lexer_begin(condition) {
        return this.pushState(condition);
    },

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    pushState: function lexer_pushState(condition) {
        this.conditionStack.push(condition);
        this.__currentRuleSet__ = null;
        return this;
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function lexer_popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            this.__currentRuleSet__ = null;
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function lexer_topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // (internal) determine the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function lexer__currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the number of states currently on the stack
    stateStackSize: function lexer_stateStackSize() {
        return this.conditionStack.length;
    }
};
    return __objdef__;
}

RegExpLexer.prototype = getRegExpLexerPrototype();

// Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
function camelCase(s) {
    return s.replace(/-\w/g, function (match) {
        return match.charAt(1).toUpperCase();
    });
}

// camelCase all options:
function camelCaseAllOptions(opts) {
    opts = opts || {};
    var options = {};
    for (var key in opts) {
        var nk = camelCase(key);
        options[nk] = opts[key];
    }
    return options;
}



// generate lexer source from a grammar
function generate(dict, tokens) {
    var opt = processGrammar(dict, tokens);

    return generateFromOpts(opt);
}

// process the grammar and build final data structures and functions
function processGrammar(dict, tokens) {
    var opts = {};
    if (typeof dict === 'string') {
        dict = lexParser.parse(dict);
    }
    dict = dict || {};

    // Feed the possibly reprocessed 'dictionary' above back to the caller
    // (for use by our error diagnostic assistance code)
    opts.lex_rule_dictionary = dict;

    // Make sure to camelCase all options:
    opts.options = camelCaseAllOptions(dict.options);

    opts.moduleType = opts.options.moduleType;
    opts.moduleName = opts.options.moduleName;

    opts.conditions = prepareStartConditions(dict.startConditions);
    opts.conditions.INITIAL = {
        rules: [],
        inclusive: true
    };

    var code = buildActions(dict, tokens, opts);
    opts.performAction = code.actions;
    opts.caseHelperInclude = code.caseHelperInclude;
    opts.rules = code.rules;
    opts.macros = code.macros;

    opts.conditionStack = ['INITIAL'];

    opts.actionInclude = (dict.actionInclude || '');
    opts.moduleInclude = (opts.moduleInclude || '') + (dict.moduleInclude || '').trim();
    return opts;
}

// Assemble the final source from the processed grammar
function generateFromOpts(opt) {
    var code = '';

    if (opt.moduleType === 'commonjs') {
        code = generateCommonJSModule(opt);
    } else if (opt.moduleType === 'amd') {
        code = generateAMDModule(opt);
    } else {
        code = generateModule(opt);
    }

    return code;
}

function generateRegexesInitTableCode(opt) {
    var a = opt.rules;
    var print_xregexp = opt.options && opt.options.xregexp;
    a = a.map(function generateXRegExpInitCode(re) {
        if (re instanceof XRegExp) {
            // When we don't need the special XRegExp sauce at run-time, we do with the original
            // JavaScript RegExp instance a.k.a. 'native regex':
            if (re.xregexp.isNative || !print_xregexp) {
                return re;
            }
            // And make sure to escape the regex to make it suitable for placement inside a *string*
            // as it is passed as a string argument to the XRegExp constructor here.
            return 'new XRegExp("' + re.xregexp.source.replace(/[\\"]/g, '\\$&') + '", "' + re.xregexp.flags + '")';
        } else {
            return re;
        }
    });
    return a.join(',\n');
}

function generateModuleBody(opt) {
    // make the JSON output look more like JavaScript:
    function cleanupJSON(str) {
        str = str.replace(/  "rules": \[/g, '  rules: [');
        str = str.replace(/  "inclusive": /g, '  inclusive: ');
        return str;
    }

    function produceOptions(opts) {
        var obj = {};
        var do_not_pass = {
          moduleName: 1,
          moduleType: 1,
        };
        for (var k in opts) {
            if (!do_not_pass[k]) {
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

        var pre = obj.pre_lex;
        var post = obj.post_lex;
        // since JSON cannot encode functions, we'll have to do it manually at run-time, i.e. later on:
        obj.pre_lex = (pre ? true : undefined);
        obj.post_lex = (post ? true : undefined);

        var js = JSON.stringify(obj, null, 2);

        js = js.replace(/  \"([a-zA-Z_][a-zA-Z0-9_]*)\": /g, "  $1: ");
        js = js.replace(/^( +)pre_lex: true,$/gm, "$1pre_lex: " + String(pre) + ',');
        js = js.replace(/^( +)post_lex: true,$/gm, "$1post_lex: " + String(post) + ',');
        return js;
    }


    var out;
    if (opt.rules.length > 0 || opt.in_rules_failure_analysis_mode) {
        var descr;

        // we don't mind that the `test_me()` code above will have this `lexer` variable re-defined:
        // JavaScript is fine with that.
        out = 'var lexer = {\n';

        // get the RegExpLexer.prototype in source code form:
        var protosrc = String(getRegExpLexerPrototype);
        // and strip off the surrounding bits we don't want:
        protosrc = protosrc
        .replace(/^[\s\r\n]*function getRegExpLexerPrototype\(\) \{[\s\r\n]*var __objdef__ = \{[\s]*[\r\n]/, '')
        .replace(/[\s\r\n]*\};[\s\r\n]*return __objdef__;[\s\r\n]*\}[\s\r\n]*/, '');
        out += protosrc + ',\n';

        if (opt.options) {
            // Assure all options are camelCased:
            assert(typeof opt.options['case-insensitive'] === 'undefined');

            out += 'options: ' + produceOptions(opt.options);
        } else {
            // always provide the lexer with an options object, even if it's empty!
            out += 'options: {}';
        }

        out += ',\nJisonLexerError: JisonLexerError';
        out += ',\nperformAction: ' + String(opt.performAction);
        out += ',\nsimpleCaseActionClusters: ' + String(opt.caseHelperInclude);
        out += ',\nrules: [\n' + generateRegexesInitTableCode(opt) + '\n]';
        out += ',\nconditions: ' + cleanupJSON(JSON.stringify(opt.conditions, null, 2));
        out += '\n};\n';
    } else {
        // We're clearly looking at a custom lexer here as there's no lexer rules at all.
        //
        // We are re-purposing the `%{...%}` `actionInclude` code block here as it serves no purpose otherwise.
        //
        // Meanwhile we make sure we have the `lexer` variable declared in *local scope* no matter
        // what crazy stuff (or lack thereof) the userland code is pulling in the `actionInclude` chunk.
        out = 'var lexer;\n';

        if (opt.actionInclude) {
            out += opt.actionInclude + (!opt.actionInclude.match(/;[\s\r\n]*$/) ? ';' : '') + '\n';
        }
    }

    // The output of this function is guaranteed to read something like this:
    //
    // ```
    // var lexer;
    //
    // bla bla bla bla ... lotsa bla bla;
    // ```
    //
    // and that should work nicely as an `eval()`-able piece of source code.
    return out;
}

function generateModule(opt) {
    opt = opt || {};

    var out = ['/* generated by jison-lex ' + version + ' */'];
    var moduleName = opt.moduleName || 'lexer';

    out.push('var ' + moduleName + ' = (function () {');
    out.push.apply(out, jisonLexerErrorDefinition);
    out.push(generateModuleBody(opt));

    if (opt.moduleInclude) {
        out.push(opt.moduleInclude + ';');
    }

    out.push(
        'return lexer;',
        '})();'
    );

    return out.join('\n');
}

function generateAMDModule(opt) {
    opt = opt || {};

    var out = ['/* generated by jison-lex ' + version + ' */'];

    out.push('define([], function () {');
    out.push.apply(out, jisonLexerErrorDefinition);
    out.push(generateModuleBody(opt));

    if (opt.moduleInclude) {
        out.push(opt.moduleInclude + ';');
    }

    out.push(
        'return lexer;',
        '});'
    );

    return out.join('\n');
}

function generateCommonJSModule(opt) {
    opt = opt || {};

    var out = [];
    var moduleName = opt.moduleName || 'lexer';

    out.push(
        generateModule(opt),
        'exports.lexer = ' + moduleName + ';',
        'exports.lex = function () {',
        ' return ' + moduleName + '.lex.apply(lexer, arguments);',
        '};'
    );
    return out.join('\n');
}

RegExpLexer.generate = generate;

module.exports = RegExpLexer;


},{"./lex-parser":5,"./package.json":6,"assert":12,"xregexp":20}],9:[function(require,module,exports){
// Set class to wrap arrays

var typal = require('./typal').typal;
var assert = require('assert');

var setMixin = {
    constructor: function Set_constructor(set, raw) {
        this._items = [];
        if (set && set.constructor === Array) {
            this._items = raw ? set: set.slice(0);
        }
        else if (arguments.length) {
            this._items = [].slice.call(arguments, 0);
        }
    },
    concat: function concat(setB) {
        this._items.push.apply(this._items, setB._items || setB);
        return this;
    },
    eq: function eq(set) {
        return this._items.length === set._items.length && this.subset(set) && this.superset(set);
    },
    indexOf: function indexOf(item) {
        if (item && item.eq) {
            for (var k = 0; k < this._items.length; k++) {
                if (item.eq(this._items[k])) {
                    return k;
                }
            }
            return -1;
        }
        return this._items.indexOf(item);
    },
    intersection: function intersection(set) {
        return this.filter(function intersection_filter(elm) {
            return set.contains(elm);
        });
    },
    complement: function complement(set) {
        var that = this;
        return set.filter(function sub_complement(elm) {
            return !that.contains(elm);
        });
    },
    subset: function subset(set) {
        var cont = true;
        for (var i = 0; i < this._items.length && cont; i++) {
            cont = cont && set.contains(this._items[i]);
        }
        return cont;
    },
    superset: function superset(set) {
        return set.subset(this);
    },
    joinSet: function joinSet(set) {
        return this.concat(this.complement(set));
    },
    contains: function contains(item) { 
        return this.indexOf(item) !== -1; 
    },
    item: function item(v) { 
        return this._items[v]; 
    },
    i: function i(v) { 
        return this._items[v]; 
    },
    assign: function assign(index, value) { 
        this._items[index] = value;
        return this; 
    },
    first: function first() { 
        return this._items[0]; 
    },
    last: function last() { 
        return this._items[this._items.length - 1]; 
    },
    size: function size() { 
        return this._items.length; 
    },
    isEmpty: function isEmpty() { 
        return this._items.length === 0; 
    },
    copy: function copy() { 
        return new Set(this._items); 
    },
    toString: function toString() { 
        return this._items.toString(); 
    }
};

'push shift unshift forEach some every join sort'.split(' ').forEach(function (e, i) {
    setMixin[e] = function () { 
        return Array.prototype[e].apply(this._items, arguments); 
    };
    setMixin[e].name = e;
});
'filter slice map'.split(' ').forEach(function (e, i) {
    setMixin[e] = function () { 
        return new Set(Array.prototype[e].apply(this._items, arguments), true); 
    };
    setMixin[e].name = e;
});

var Set = typal.construct(setMixin);

if (typeof exports !== 'undefined') {
    exports.Set = Set;
}


},{"./typal":11,"assert":12}],10:[function(require,module,exports){
/* parser generated by jison 0.4.18-152 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}     The so-called "shared state" or rather the *source* of it;
 *               the real "shared state" `yy` passed around to
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
 *               `cleanupAfterParse()` will clean up and reset `quoteName()` to reference this function
 *               at the end of the `parse()`.
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
 *    performAction: function parser__performAction(yytext, yyleng, yylineno, yyloc, yy, yystate, $0, yyvstack, yylstack, yystack, yysstack, ...),
 *               where `...` denotes the (optional) additional arguments the user passed to
 *               `parser.parse(str, ...)`
 *
 *    table: [...],
 *               State transition table
 *               ----------------------
 *
 *               index levels are:
 *               - `state`  --> hash table
 *               - `symbol` --> action (number or array)
 *
 *                 If the `action` is an array, these are the elements' meaning:
 *                 - index [0]: 1 = shift, 2 = reduce, 3 = accept
 *                 - index [1]: GOTO `state`
 *
 *                 If the `action` is a number, it is the GOTO `state`
 *
 *    defaultActions: {...},
 *
 *    parseError: function(str, hash),
 *    yyErrOk: function(),
 *    yyClearIn: function(),
 *
 *    constructParseErrorInfo: function(error_message, exception_object, expected_token_set, is_recoverable),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               Produces a new errorInfo 'hash object' which can be passed into `parseError()`.
 *               See it's use in this parser kernel in many places; example usage:
 *
 *                   var infoObj = parser.constructParseErrorInfo('fail!', null,
 *                                     parser.collect_expected_token_set(state), true);
 *                   var retVal = parser.parseError(infoObj.errStr, infoObj);
 *
 *    originalParseError: function(str, hash),
 *               The basic parseError handler provided by JISON.
 *               `cleanupAfterParse()` will clean up and reset `parseError()` to reference this function
 *               at the end of the `parse()`.
 *
 *    options: { ... parser %options ... },
 *
 *    parse: function(input[, args...]),
 *               Parse the given `input` and return the parsed value (or `true` when none was provided by
 *               the root action, in which case the parser is acting as a *matcher*).
 *               You MAY use the additional `args...` parameters as per `%parse-param` spec of this grammar:
 *               these extra `args...` are passed verbatim to the grammar rules' action code.
 *
 *    cleanupAfterParse: function(resultValue, invoke_post_methods),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               This helper API is invoked at the end of the `parse()` call, unless an exception was thrown
 *               and `%options no-try-catch` has been defined for this grammar: in that case this helper MAY
 *               be invoked by calling user code to ensure the `post_parse` callbacks are invoked and
 *               the internal parser gets properly garbage collected under these particular circumstances.
 *
 *    lexer: {
 *        yy: {...},           A reference to the so-called "shared state" `yy` once
 *                             received via a call to the `.setInput(input, yy)` lexer API.
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input, [yy]),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(n),
 *        upcomingInput: function(n),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        pushState: function(condition),
 *        popState: function(),
 *        topState: function(),
 *        _currentRules: function(),
 *        stateStackSize: function(),
 *
 *        options: { ... lexer %options ... },
 *
 *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
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
 * The parseError function receives a 'hash' object with these members for lexer and
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
 *                  can, for example, be used to pass to the `collect_expected_token_set()`
 *                  API to obtain the expected token set)
 *    action:      (integer; represents the current internal action which will be executed)
 *    new_state:   (integer; represents the next/planned internal state, once the current
 *                  action has executed)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule
 *                  available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    value_stack: (array: the current parser LALR/LR internal `$$` value stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    yy:          (object: the current parser internal "shared state" `yy`
 *                  as is also available in the rule actions; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    lexer:       (reference to the current lexer instance used by the parser)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser*
 *  instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 *  When `parseError` is invoked by the parser due to a **JavaScript exception** being fired
 *  from either the parser or lexer, `this` will still reference the related *parser*
 *  instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    exception:   (reference to the exception thrown)
 *  }
 *
 *  Please do note that in the latter situation, the `expected` field will be omitted as
 *  type of failure is assumed not to be due to *parse errors* but rather due to user
 *  action code in either parser or lexer failing unexpectedly.
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy [, optional parse() args])
 *                 optional: you can specify a pre_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: you can specify a post_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`. When it does not return any value,
 *                 the parser will return the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy [, optional parse() args])
 *                 optional: is invoked before the parse cycle starts (and before the first
 *                 invocation of `lex()`) but immediately after the invocation of
 *                 `parser.pre_parse()`).
 *      post_parse: function(yy, retval [, optional parse() args]) { return retval; }
 *                 optional: is invoked when the parse terminates due to success ('accept')
 *                 or failure (even when exceptions are thrown).
 *                 `retval` contains the return value to be produced by `Parser.parse()`;
 *                 this function can override the return value by returning another. 
 *                 When it does not return any value, the parser will return the original
 *                 `retval`. 
 *                 This function is invoked immediately before `Parser.post_parse()`.
 *
 *      parseError: function(str, hash)
 *                 optional: overrides the default `parseError` function.
 *      quoteName: function(name),
 *                 optional: overrides the default `quoteName` function.
 *  }
 *
 *  parser.lexer.options: {
 *      pre_lex:  function()
 *                 optional: is invoked before the lexer is invoked to produce another token.
 *                 `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                 optional: is invoked when the lexer has produced a token `token`;
 *                 this function can override the returned token value by returning another.
 *                 When it does not return any (truthy) value, the lexer will return
 *                 the original `token`.
 *                 `this` refers to the Lexer object.
 *
 *      ranges: boolean
 *                 optional: `true` ==> token location info will include a .range[] member.
 *      flex: boolean
 *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested
 *                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                 optional: `true` ==> lexer regexes are tested in order and for invoked;
 *                 the lexer terminates the scan when a token is returned by the action code.
 *      xregexp: boolean
 *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the
 *                 `XRegExp` library. When this %option has not been specified at compile time, all lexer
 *                 rule regexes have been written as standard JavaScript RegExp expressions.
 *  }
 */
var ebnf = (function () {

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

if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
} else {
    JisonParserError.prototype = Object.create(Error.prototype);
}
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';



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

var parser = {
trace: function no_op_trace() { },
JisonParserError: JisonParserError,
yy: {},
options: {
  type: "lalr",
  errorRecoveryTokenDiscardCount: 3
},
symbols_: {
  "$accept": 0,
  "$end": 1,
  "(": 4,
  ")": 5,
  "*": 6,
  "+": 8,
  "?": 7,
  "ALIAS": 17,
  "EOF": 1,
  "EPSILON": 12,
  "SYMBOL": 18,
  "error": 2,
  "expression": 15,
  "expression_suffixed": 14,
  "handle": 10,
  "handle_list": 11,
  "production": 9,
  "rule": 13,
  "suffix": 16,
  "|": 3
},
terminals_: {
  1: "EOF",
  2: "error",
  3: "|",
  4: "(",
  5: ")",
  6: "*",
  7: "?",
  8: "+",
  12: "EPSILON",
  17: "ALIAS",
  18: "SYMBOL"
},
TERROR: 2,
EOF: 1,

// internals: defined here so the object *structure* doesn't get modified by parse() et al,
// thus helping JIT compilers like Chrome V8.
originalQuoteName: null,
originalParseError: null,
cleanupAfterParse: null,
constructParseErrorInfo: null,

__reentrant_call_depth: 0,       // INTERNAL USE ONLY

// APIs which will be set up depending on user action code analysis:
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
},
productions_: bp({
  pop: u([
  9,
  11,
  11,
  s,
  [10, 3],
  13,
  13,
  14,
  14,
  15,
  15,
  s,
  [16, 4]
]),
  rule: u([
  2,
  1,
  3,
  0,
  s,
  [1, 3],
  2,
  3,
  c,
  [9, 7]
])
}),
performAction: function parser__PerformAction(yytext, yy, yystate /* action[1] */, $0, yyvstack) {
/* this == yyval */

switch (yystate) {
case 1:
    /*! Production::    production : handle EOF */
    return yyvstack[$0 - 1];
    break;

case 2:
    /*! Production::    handle_list : handle */
case 7:
    /*! Production::    rule : expression_suffixed */
    this.$ = [yyvstack[$0]];
    break;

case 3:
    /*! Production::    handle_list : handle_list '|' handle */
    yyvstack[$0 - 2].push(yyvstack[$0]);
    break;

case 4:
    /*! Production::    handle : ε */
case 5:
    /*! Production::    handle : EPSILON */
    this.$ = [];
    break;

case 6:
    /*! Production::    handle : rule */
    this.$ = yyvstack[$0];
    break;

case 8:
    /*! Production::    rule : rule expression_suffixed */
    yyvstack[$0 - 1].push(yyvstack[$0]);
    break;

case 9:
    /*! Production::    expression_suffixed : expression suffix ALIAS */
    this.$ = ['xalias', yyvstack[$0 - 1], yyvstack[$0 - 2], yyvstack[$0]];
    break;

case 10:
    /*! Production::    expression_suffixed : expression suffix */
    if (yyvstack[$0]) {
      this.$ = [yyvstack[$0], yyvstack[$0 - 1]];
    } else {
      this.$ = yyvstack[$0 - 1];
    }
    break;

case 11:
    /*! Production::    expression : SYMBOL */
    this.$ = ['symbol', yyvstack[$0]];
    break;

case 12:
    /*! Production::    expression : '(' handle_list ')' */
    this.$ = ['()', yyvstack[$0 - 1]];
    break;

}
},
table: bt({
  len: u([
  9,
  1,
  1,
  3,
  7,
  5,
  10,
  9,
  10,
  1,
  5,
  s,
  [6, 4],
  2,
  2,
  5,
  9,
  9,
  2
]),
  symbol: u([
  1,
  4,
  9,
  10,
  s,
  [12, 4, 1],
  18,
  s,
  [1, 3],
  3,
  5,
  1,
  3,
  4,
  5,
  c,
  [12, 4],
  c,
  [7, 3],
  c,
  [5, 5],
  6,
  7,
  8,
  16,
  17,
  c,
  [10, 8],
  17,
  18,
  c,
  [8, 3],
  s,
  [10, 6, 1],
  c,
  [46, 3],
  c,
  [35, 8],
  c,
  [31, 6],
  c,
  [6, 14],
  3,
  5,
  c,
  [75, 6],
  c,
  [58, 14],
  c,
  [57, 5],
  3,
  5
]),
  type: u([
  2,
  2,
  0,
  0,
  c,
  [3, 3],
  0,
  2,
  1,
  s,
  [2, 8],
  c,
  [12, 3],
  s,
  [2, 12],
  c,
  [14, 14],
  c,
  [46, 8],
  s,
  [2, 51],
  c,
  [57, 8]
]),
  state: u([
  1,
  2,
  4,
  5,
  6,
  10,
  6,
  11,
  16,
  15,
  c,
  [8, 3],
  20,
  c,
  [4, 3]
]),
  mode: u([
  2,
  s,
  [1, 4],
  s,
  [2, 5],
  1,
  2,
  c,
  [8, 6],
  c,
  [12, 5],
  c,
  [20, 7],
  c,
  [15, 8],
  c,
  [17, 3],
  c,
  [14, 12],
  s,
  [2, 18],
  c,
  [48, 14],
  c,
  [53, 11]
]),
  goto: u([
  4,
  8,
  3,
  7,
  9,
  s,
  [5, 3],
  6,
  6,
  8,
  6,
  s,
  [7, 6],
  s,
  [13, 4],
  12,
  13,
  14,
  13,
  13,
  s,
  [11, 9],
  4,
  8,
  4,
  3,
  7,
  1,
  s,
  [8, 5],
  s,
  [10, 4],
  17,
  10,
  s,
  [14, 6],
  s,
  [15, 6],
  s,
  [16, 6],
  19,
  18,
  2,
  2,
  s,
  [9, 5],
  s,
  [12, 9],
  c,
  [53, 5],
  3,
  3
])
}),
defaultActions: {
  9: 1
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
        hash.destroy();             // destroy... well, *almost*!
        // assert('recoverable' in hash);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = new Array(128),         // token stack: stores token which leads to state at the same index (column storage)
        sstack = new Array(128),        // state stack: stores states

        vstack = new Array(128),        // semantic value stack

        table = this.table,
        sp = 0;                         // 'stack pointer': index into the stacks

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

    var sharedState = {
      yy: {
        parseError: null,
        quoteName: null,
        lexer: null,
        parser: null,
        pre_parse: null,
        post_parse: null
      }
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;






    lexer.setInput(input, sharedState.yy);






    vstack[sp] = null;
    sstack[sp] = 0;
    stack[sp] = 0;
    ++sp;

    if (typeof lexer.yytext === 'undefined') {
        lexer.yytext = '';
    }
    var yytext = lexer.yytext;
    if (typeof lexer.yylineno === 'undefined') {
        lexer.yylineno = 0;
    }


    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    } else {
        this.parseError = this.originalParseError;
    }

    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState.yy.quoteName === 'function') {
        this.quoteName = sharedState.yy.quoteName;
    } else {
        this.quoteName = this.originalQuoteName;
    }

    // set up the cleanup function; make it an API so that external code can re-use this one in case of
    // calamities or when the `%options no-try-catch` option has been specified for the grammar, in which
    // case this parse() API method doesn't come with a `finally { ... }` block any more!
    //
    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `sharedState`, etc. references will be *wrong*!
    this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods) {
        var rv;

        if (invoke_post_methods) {
            if (sharedState.yy.post_parse) {
                rv = sharedState.yy.post_parse.call(this, sharedState.yy, resultValue);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
            if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState.yy, resultValue);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
        }

        if (this.__reentrant_call_depth > 1) return resultValue;        // do not (yet) kill the sharedState when this is a reentrant run.

        // prevent lingering circular references from causing memory leaks:
        if (sharedState.yy) {
            sharedState.yy.parseError = undefined;
            sharedState.yy.quoteName = undefined;
            sharedState.yy.lexer = undefined;
            sharedState.yy.parser = undefined;
            if (lexer.yy === sharedState.yy) {
                lexer.yy = undefined;
            }
        }
        sharedState.yy = undefined;
        this.parseError = this.originalParseError;
        this.quoteName = this.originalQuoteName;

        // nuke the vstack[] array at least as that one will still reference obsoleted user values.
        // To be safe, we nuke the other internal stack columns as well...
        stack.length = 0;               // fastest way to nuke an array without overly bothering the GC
        sstack.length = 0;

        vstack.length = 0;
        stack_pointer = 0;

        return resultValue;
    };

    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `lexer`, `sharedState`, etc. references will be *wrong*!
    this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected, recoverable) {
        return {
            errStr: msg,
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,

            expected: expected,
            recoverable: recoverable,
            state: state,
            action: action,
            new_state: newState,
            symbol_stack: stack,
            state_stack: sstack,
            value_stack: vstack,

            stack_pointer: sp,
            yy: sharedState.yy,
            lexer: lexer,

            // and make sure the error info doesn't stay due to potential ref cycle via userland code manipulations (memory leak opportunity!):
            destroy: function destructParseErrorInfo() {
                // remove cyclic references added to error info:
                // info.yy = null;
                // info.lexer = null;
                // info.value = null;
                // info.value_stack = null;
                // ...
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this.hasOwnProperty(key) && typeof key !== 'function') {
                        this[key] = undefined;
                    }
                }
                this.recoverable = rec;
            }
        };
    };


    function lex() {
        var token = lexer.lex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token || EOF;
    }


    var symbol = 0;

    var state, action, r, t;
    var yyval = {
        $: true,
        _$: undefined
    };
    var p, len, this_production;

    var newState;
    var retval = false;

    try {
        this.__reentrant_call_depth++;

        if (this.pre_parse) {
            this.pre_parse.call(this, sharedState.yy);
        }
        if (sharedState.yy.pre_parse) {
            sharedState.yy.pre_parse.call(this, sharedState.yy);
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
                    symbol = lex();
                }
                // read action for current state and first input
                t = (table[state] && table[state][symbol]) || NO_ACTION;
                newState = t[1];
                action = t[0];




                // handle parse error
                if (!action) {
                    var errStr;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    // Report error
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition() + '\n';
                    } else {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                    }
                    if (expected.length) {
                        errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                    } else {
                        errStr += 'Unexpected ' + errSymbolDescr;
                    }
                    // we cannot recover from the error!
                    p = this.constructParseErrorInfo(errStr, null, expected, false);
                    retval = this.parseError(p.errStr, p);
                    break;
                }
            }


            switch (action) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action instanceof Array) {
                    p = this.constructParseErrorInfo(('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol), null, null, false);
                    retval = this.parseError(p.errStr, p);
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                retval = this.parseError(p.errStr, p);
                break;

            // shift:
            case 1:
                //this.shiftCount++;
                stack[sp] = symbol;
                vstack[sp] = lexer.yytext;

                sstack[sp] = newState; // push state
                ++sp;
                symbol = 0;

                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:

                    yytext = lexer.yytext;








                




                continue;

            // reduce:
            case 2:
                //this.reductionCount++;
                this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                len = this_production[1];






                // Make sure subsequent `$$ = $1` default action doesn't fail
                // for rules where len==0 as then there's no $1 (you're reducing an epsilon rule then!)
                //
                // Also do this to prevent nasty action block codes to *read* `$0` or `$$`
                // and *not* get `undefined` as a result for their efforts!
                vstack[sp] = undefined;

                // perform semantic action
                yyval.$ = vstack[sp - len]; // default to $$ = $1; result must produce `undefined` when len == 0, as then there's no $1










                r = this.performAction.call(yyval, yytext, sharedState.yy, newState, sp - 1, vstack);

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

                // goto new state = table[STATE][NONTERMINAL]
                newState = table[sstack[sp - 1]][ntsymbol];
                sstack[sp] = newState;
                ++sp;

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
        retval = this.parseError(p.errStr, p);
    } finally {
        retval = this.cleanupAfterParse(retval, true);
        this.__reentrant_call_depth--;
    }

    return retval;
}
};
parser.originalParseError = parser.parseError;
parser.originalQuoteName = parser.quoteName;

/* generated by jison-lex 0.3.4-152 */
var lexer = (function () {
// See also:
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
// with userland code which might access the derived class in a 'classic' way.
function JisonLexerError(msg, hash) {
    Object.defineProperty(this, 'name', {
        enumerable: false,
        writable: false,
        value: 'JisonLexerError'
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

    if (typeof Object.setPrototypeOf === 'function') {
        Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
    } else {
        JisonLexerError.prototype = Object.create(Error.prototype);
    }
    JisonLexerError.prototype.constructor = JisonLexerError;
    JisonLexerError.prototype.name = 'JisonLexerError';


var lexer = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,        // <-- injected by the code generator

    // options: {},                             // <-- injected by the code generator

    // yy: ...,                                 // <-- injected by setInput()

    __currentRuleSet__: null,                   // <-- internal rule set cache for the current lexer state

    parseError: function lexer_parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

    // clear the lexer token context; intended for internal use only
    clear: function lexer_clear() {
        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        this.matches = false;
        this._more = false;
        this._backtrack = false;
    },

    // resets the lexer, sets new input
    setInput: function lexer_setInput(input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this.clear();
        this._signaled_error_token = this.done = false;
        this.yylineno = 0;
        this.matched = '';
        this.conditionStack = ['INITIAL'];
        this.__currentRuleSet__ = null;
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
    },

    // consumes and returns one char from the input
    input: function lexer_input() {
        if (!this._input) {
            this.done = true;
            return null;
        }
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        // Count the linenumber up when we hit the LF (or a stand-alone CR).
        // On CRLF, the linenumber is incremented when you fetch the CR or the CRLF combo
        // and we advance immediately past the LF as well, returning both together as if
        // it was all a single 'character' only.
        var slice_len = 1;
        var lines = false;
        if (ch === '\n') {
            lines = true;
        } else if (ch === '\r') {
            lines = true;
            var ch2 = this._input[1];
            if (ch2 === '\n') {
                slice_len++;
                ch += ch2;
                this.yytext += ch2;
                this.yyleng++;
                this.offset++;
                this.match += ch2;
                this.matched += ch2;
                if (this.options.ranges) {
                    this.yylloc.range[1]++;
                }
            }
        }
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(slice_len);
        return ch;
    },

    // unshifts one char (or a string) into the input
    unput: function lexer_unput(ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - len);
        this.matched = this.matched.substr(0, this.matched.length - len);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }

        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = (lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                + oldLines[oldLines.length - lines.length].length - lines[0].length :
                this.yylloc.first_column - len);

        if (this.options.ranges) {
            this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng - len;
        }
        this.yyleng = this.yytext.length;
        this.done = false;
        return this;
    },

    // When called from action, caches matched text and appends it on next action
    more: function lexer_more() {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function lexer_reject() {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            // when the parseError() call returns, we MUST ensure that the error is registered.
            // We accomplish this by signaling an 'error' token to be produced for the current
            // .lex() run.
            this._signaled_error_token = (this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: this.match,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR);
        }
        return this;
    },

    // retain first n characters of the match
    less: function lexer_less(n) {
        return this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    pastInput: function lexer_pastInput(maxSize, maxLines) {
        var past = this.matched.substring(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = past.length;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substr` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        past = past.substr(-maxSize * 2 - 2);
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = past.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(-maxLines);
        past = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis prefix...
        if (past.length > maxSize) {
            past = '...' + past.substr(-maxSize);
        }
        return past;
    },

    // return (part of the) upcoming input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = maxSize;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substring` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        if (next.length < maxSize * 2 + 2) {
            next += this._input.substring(0, maxSize * 2 + 2);  // substring is faster on Chrome/V8
        }
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = next.replace(/\r\n|\r/g, '\n').split('\n');
        a = a.slice(0, maxLines);
        next = a.join('\n');
        // When, after limiting to maxLines, we still have to much to return, 
        // do add an ellipsis postfix...
        if (next.length > maxSize) {
            next = next.substring(0, maxSize) + '...';
        }
        return next;
    },

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
        var pre = this.pastInput(maxPrefix).replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput(maxPostfix).replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // helper function, used to produce a human readable description as a string, given
    // the input `yylloc` location object. 
    // Set `display_range_too` to TRUE to include the string character inex position(s)
    // in the description if the `yylloc.range` is available. 
    describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
        var l1 = yylloc.first_line;
        var l2 = yylloc.last_line;
        var o1 = yylloc.first_column;
        var o2 = yylloc.last_column - 1;
        var dl = l2 - l1;
        var d_o = (dl === 0 ? o2 - o1 : 1000);
        var rv;
        if (dl === 0) {
            rv = 'line ' + l1 + ', ';
            if (d_o === 0) {
                rv += 'column ' + o1;
            } else {
                rv += 'columns ' + o1 + ' .. ' + o2;
            }
        } else {
            rv = 'lines ' + l1 + '(column ' + o1 + ') .. ' + l2 + '(column ' + o2 + ')';
        }
        if (yylloc.range && display_range_too) {
            var r1 = yylloc.range[0];
            var r2 = yylloc.range[1] - 1;
            if (r2 === r1) {
                rv += ' {String Offset: ' + r1 + '}';
            } else {
                rv += ' {String Offset range: ' + r1 + ' .. ' + r2 + '}';
            }
        }
        return rv;
        // return JSON.stringify(yylloc);
    },

    // test the lexed token: return FALSE when not a match, otherwise return token.
    //
    // `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
    // contains the actually matched text string.
    //
    // Also move the input cursor forward and update the match collectors:
    // - yytext
    // - yyleng
    // - match
    // - matches
    // - yylloc
    // - offset
    test_match: function lexer_test_match(match, indexed_rule) {
        var token,
            lines,
            backup,
            match_str;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        match_str = match[0];
        lines = match_str.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match_str.length
        };
        this.yytext += match_str;
        this.match += match_str;
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        // previous lex rules MAY have invoked the `more()` API rather than producing a token:
        // those rules will already have moved this `offset` forward matching their match lengths,
        // hence we must only add our own match length now:
        this.offset += match_str.length;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match_str.length);
        this.matched += match_str;
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
        if (this.done && this._input) {
            this.done = false;
        }
        if (token) {
            return token;
        } else if (this._backtrack) {
            // recover context
            for (var k in backup) {
                this[k] = backup[k];
            }
            this.__currentRuleSet__ = null;
            return false; // rule action called reject() implying the next rule should be tested instead.
        } else if (this._signaled_error_token) {
            // produce one 'error' token as .parseError() in reject() did not guarantee a failure signal by throwing an exception!
            token = this._signaled_error_token;
            this._signaled_error_token = false;
            return token;
        }
        return false;
    },

    // return next match in input
    next: function lexer_next() {
        if (this.done) {
            this.clear();
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            this.clear();
        }
        var rules = this.__currentRuleSet__;
        if (!rules) {
            // Update the ruleset cache as we apparently encountered a state change or just started lexing.
            // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
            // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
            // speed up those activities a tiny bit.
            rules = this.__currentRuleSet__ = this._currentRules();
        }
        for (var i = 0, len = rules.length; i < len; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = undefined;
                        continue; // rule action called reject() implying a rule MISmatch.
                    } else {
                        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                        return false;
                    }
                } else if (!this.options.flex) {
                    break;
                }
            }
        }
        if (match) {
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === '') {
            this.clear();
            this.done = true;
            return this.EOF;
        } else {
            token = this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: this.match + this._input,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR;
            if (token === this.ERROR) {
                // we can try to recover from a lexer error that parseError() did not 'recover' for us, by moving forward at least one character at a time:
                if (!this.match.length) {
                    this.input();
                }
            }
            return token;
        }
    },

    // return next match that has a token
    lex: function lexer_lex() {
        var r;
        // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
        if (typeof this.options.pre_lex === 'function') {
            r = this.options.pre_lex.call(this);
        }
        while (!r) {
            r = this.next();
        }
        if (typeof this.options.post_lex === 'function') {
            // (also account for a userdef function which does not return any value: keep the token as is)
            r = this.options.post_lex.call(this, r) || r;
        }
        return r;
    },

    // backwards compatible alias for `pushState()`;
    // the latter is symmetrical with `popState()` and we advise to use
    // those APIs in any modern lexer code, rather than `begin()`.
    begin: function lexer_begin(condition) {
        return this.pushState(condition);
    },

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    pushState: function lexer_pushState(condition) {
        this.conditionStack.push(condition);
        this.__currentRuleSet__ = null;
        return this;
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function lexer_popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            this.__currentRuleSet__ = null;
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function lexer_topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // (internal) determine the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function lexer__currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the number of states currently on the stack
    stateStackSize: function lexer_stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
JisonLexerError: JisonLexerError,
performAction: function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 0 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \s+ */ 
 /* skip whitespace */ 
break;
case 4 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \[{ID}\] */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 17; 
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: INITIAL */ 
  /*! Rule::       {ID} */ 
   1 : 18,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \$end */ 
   2 : 18,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \$eof */ 
   3 : 18,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       %empty */ 
   5 : 12,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       %epsilon */ 
   6 : 12,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \u0190 */ 
   7 : 12,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \u025B */ 
   8 : 12,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \u03B5 */ 
   9 : 12,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \u03F5 */ 
   10 : 12,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   11 : 18,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   12 : 18,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \. */ 
   13 : 18,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \( */ 
   14 : 4,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \) */ 
   15 : 5,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \* */ 
   16 : 6,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \? */ 
   17 : 7,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \| */ 
   18 : 3,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \+ */ 
   19 : 8,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       $ */ 
   20 : 1
},
rules: [
/^(?:\s+)/,
/^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*))/,
/^(?:\$end)/,
/^(?:\$eof)/,
/^(?:\[([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff][^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࢟ࢵ-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸ૺ-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿ಀ಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-ഀഄ഍഑഻഼൅൉്൏-ൖ൘-൞൤൥൶-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄮ-㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿖-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞮꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*)\])/,
/^(?:%empty)/,
/^(?:%epsilon)/,
/^(?:\u0190)/,
/^(?:\u025B)/,
/^(?:\u03B5)/,
/^(?:\u03F5)/,
/^(?:'((?:\\'|(?!').)*)')/,
/^(?:"((?:\\"|(?!").)*)")/,
/^(?:\.)/,
/^(?:\()/,
/^(?:\))/,
/^(?:\*)/,
/^(?:\?)/,
/^(?:\|)/,
/^(?:\+)/,
/^(?:$)/
],
conditions: {
  "INITIAL": {
    rules: [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20
    ],
    inclusive: true
  }
}
};

return lexer;
})();
parser.lexer = lexer;

function Parser() {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
  exports.parser = ebnf;
  exports.Parser = ebnf.Parser;
  exports.parse = function () {
    return ebnf.parse.apply(ebnf, arguments);
  };

}

},{}],11:[function(require,module,exports){
/*
 * Introduces a typal object to make classical/prototypal patterns easier
 * Plus some AOP sugar
 *
 * By Zachary Carter <zach@carter.name>
 * MIT Licensed
 * */

var typal = (function () {
'use strict';

var create = Object.create || function (o) { 
    function F(){} 
    F.prototype = o; 
    return new F(); 
};
var position = /^(before|after)/;

// basic method layering
// always returns original method's return value
function layerMethod(pos, key, prop, fun) {
    if (pos === 'after') {
        return function () {
            var ret = prop.apply(this, arguments);
            var args = [].slice.call(arguments);
            args.splice(0, 0, ret);
            fun.apply(this, args);
            return ret;
        };
    } else if (pos === 'before') {
        return function () {
            fun.apply(this, arguments);
            var ret = prop.apply(this, arguments);
            return ret;
        };
    }
    return fun;
}

// mixes each argument's own properties into calling object,
// overwriting them or layering them. i.e. an object method 'meth' is
// layered by mixin methods 'beforemeth' or 'aftermeth'
function typal_mix() {
    var self = this;
    var i, o, k;
    for (i = 0; i < arguments.length; i++) {
        o = arguments[i];
        if (!o) continue;
        if (Object.prototype.hasOwnProperty.call(o, 'constructor')) {
            this.constructor = o.constructor;
        }
        if (Object.prototype.hasOwnProperty.call(o, 'toString')) {
            this.toString = o.toString;
        }
        for (k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                var match = k.match(position);
                var key = k.replace(position, '');
                if (match && typeof this[key] === 'function') {
                    this[key] = layerMethod(match[0], key, this[key], o[k]);
                } else {
                    this[k] = o[k];
                }
            }
        }
    }
    return this;
}

// Same as typal_mix but also camelCases every object member.
// This is useful for processing options with dashes in their key, e.g. `token-stack` --> tokenStack.
function typal_camel_mix() {
    var self = this;
    var i, o, k;

    // Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'` 
    function camelCase(s) {
        return s.replace(/-\w/g, function (match) { 
            return match.charAt(1).toUpperCase(); 
        });
    }

    // Convert first character to lowercase
    function lcase0(s) {
        return s.replace(/^\w/, function (match) { 
            return match.toLowerCase(); 
        });
    }

    for (i = 0; i < arguments.length; i++) {
        o = arguments[i];
        if (!o) continue;
        if (Object.prototype.hasOwnProperty.call(o, 'constructor')) {
            this.constructor = o.constructor;
        }
        if (Object.prototype.hasOwnProperty.call(o, 'toString')) {
            this.toString = o.toString;
        }
        for (k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                var nk = camelCase(k);
                var match = k.match(position);
                var key = k.replace(position, '');
                // This anticipates before/after members to be camelcased already, e.g.
                // 'afterParse()' for layering 'parse()': 
                var alt_key = lcase0(key);
                if (match && typeof this[key] === 'function') {
                    this[key] = layerMethod(match[0], key, this[key], o[k]);
                }
                else if (match && typeof this[alt_key] === 'function') {
                    this[alt_key] = layerMethod(match[0], alt_key, this[alt_key], o[k]);
                } else {
                    this[nk] = o[k];
                }
            }
        }
    }
    return this;
}

return {
    // extend object with own properties of each argument
    mix: typal_mix,

    camelMix: typal_camel_mix,

    // sugar for object begetting and mixing
    // - Object.create(typal).mix(etc, etc);
    // + typal.beget(etc, etc);
    beget: function typal_beget() {
        return arguments.length ? typal_mix.apply(create(this), arguments) : create(this);
    },

    // Creates a new Class function based on an object with a constructor method
    construct: function typal_construct() {
        var o = typal_mix.apply(create(this), arguments);
        var constructor = o.constructor;
        var Klass = o.constructor = function () { return constructor.apply(this, arguments); };
        Klass.prototype = o;
        Klass.mix = typal_mix; // allow for easy singleton property extension
        return Klass;
    },

    // no op
    constructor: function typal_constructor() { return this; }
};

})();

if (typeof exports !== 'undefined')
    exports.typal = typal;

},{}],12:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && !isFinite(value)) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b)) {
    return a === b;
  }
  var aIsArgs = isArguments(a),
      bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  var ka = objectKeys(a),
      kb = objectKeys(b),
      key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":19}],13:[function(require,module,exports){

},{}],14:[function(require,module,exports){
// json5.js
// Modern JSON. See README.md for details.
//
// This file is based directly off of Douglas Crockford's json_parse.js:
// https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js

var JSON5 = (typeof exports === 'object' ? exports : {});

JSON5.parse = (function () {
    "use strict";

// This is a function that can parse a JSON5 text, producing a JavaScript
// data structure. It is a simple, recursive descent parser. It does not use
// eval or regular expressions, so it can be used as a model for implementing
// a JSON5 parser in other languages.

// We are defining the function inside of another function to avoid creating
// global variables.

    var at,           // The index of the current character
        lineNumber,   // The current line number
        columnNumber, // The current column number
        ch,           // The current character
        escapee = {
            "'":  "'",
            '"':  '"',
            '\\': '\\',
            '/':  '/',
            '\n': '',       // Replace escaped newlines in strings w/ empty string
            b:    '\b',
            f:    '\f',
            n:    '\n',
            r:    '\r',
            t:    '\t'
        },
        ws = [
            ' ',
            '\t',
            '\r',
            '\n',
            '\v',
            '\f',
            '\xA0',
            '\uFEFF'
        ],
        text,

        renderChar = function (chr) {
            return chr === '' ? 'EOF' : "'" + chr + "'";
        },

        error = function (m) {

// Call error when something is wrong.

            var error = new SyntaxError();
            // beginning of message suffix to agree with that provided by Gecko - see https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
            error.message = m + " at line " + lineNumber + " column " + columnNumber + " of the JSON5 data. Still to read: " + JSON.stringify(text.substring(at - 1, at + 19));
            error.at = at;
            // These two property names have been chosen to agree with the ones in Gecko, the only popular
            // environment which seems to supply this info on JSON.parse
            error.lineNumber = lineNumber;
            error.columnNumber = columnNumber;
            throw error;
        },

        next = function (c) {

// If a c parameter is provided, verify that it matches the current character.

            if (c && c !== ch) {
                error("Expected " + renderChar(c) + " instead of " + renderChar(ch));
            }

// Get the next character. When there are no more characters,
// return the empty string.

            ch = text.charAt(at);
            at++;
            columnNumber++;
            if (ch === '\n' || ch === '\r' && peek() !== '\n') {
                lineNumber++;
                columnNumber = 0;
            }
            return ch;
        },

        peek = function () {

// Get the next character without consuming it or
// assigning it to the ch varaible.

            return text.charAt(at);
        },

        identifier = function () {

// Parse an identifier. Normally, reserved words are disallowed here, but we
// only use this for unquoted object keys, where reserved words are allowed,
// so we don't check for those here. References:
// - http://es5.github.com/#x7.6
// - https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Core_Language_Features#Variables
// - http://docstore.mik.ua/orelly/webprog/jscript/ch02_07.htm
// TODO Identifiers can have Unicode "letters" in them; add support for those.

            var key = ch;

            // Identifiers must start with a letter, _ or $.
            if ((ch !== '_' && ch !== '$') &&
                    (ch < 'a' || ch > 'z') &&
                    (ch < 'A' || ch > 'Z')) {
                error("Bad identifier as unquoted key");
            }

            // Subsequent characters can contain digits.
            while (next() && (
                    ch === '_' || ch === '$' ||
                    (ch >= 'a' && ch <= 'z') ||
                    (ch >= 'A' && ch <= 'Z') ||
                    (ch >= '0' && ch <= '9'))) {
                key += ch;
            }

            return key;
        },

        number = function () {

// Parse a number value.

            var number,
                sign = '',
                string = '',
                base = 10;

            if (ch === '-' || ch === '+') {
                sign = ch;
                next(ch);
            }

            // support for Infinity (could tweak to allow other words):
            if (ch === 'I') {
                number = word();
                if (typeof number !== 'number' || isNaN(number)) {
                    error('Unexpected word for number');
                }
                return (sign === '-') ? -number : number;
            }

            // support for NaN
            if (ch === 'N' ) {
              number = word();
              if (!isNaN(number)) {
                error('expected word to be NaN');
              }
              // ignore sign as -NaN also is NaN
              return number;
            }

            if (ch === '0') {
                string += ch;
                next();
                if (ch === 'x' || ch === 'X') {
                    string += ch;
                    next();
                    base = 16;
                } else if (ch >= '0' && ch <= '9') {
                    error('Octal literal');
                }
            }

            switch (base) {
            case 10:
                while (ch >= '0' && ch <= '9' ) {
                    string += ch;
                    next();
                }
                if (ch === '.') {
                    string += '.';
                    while (next() && ch >= '0' && ch <= '9') {
                        string += ch;
                    }
                }
                if (ch === 'e' || ch === 'E') {
                    string += ch;
                    next();
                    if (ch === '-' || ch === '+') {
                        string += ch;
                        next();
                    }
                    while (ch >= '0' && ch <= '9') {
                        string += ch;
                        next();
                    }
                }
                break;
            case 16:
                while (ch >= '0' && ch <= '9' || ch >= 'A' && ch <= 'F' || ch >= 'a' && ch <= 'f') {
                    string += ch;
                    next();
                }
                break;
            }

            if(sign === '-') {
                number = -string;
            } else {
                number = +string;
            }

            if (!isFinite(number)) {
                error("Bad number");
            } else {
                return number;
            }
        },

        string = function () {

// Parse a string value.

            var hex,
                i,
                string = '',
                delim,      // double quote or single quote
                uffff;

// When parsing for string values, we must look for ' or " and \ characters.

            if (ch === '"' || ch === "'") {
                delim = ch;
                while (next()) {
                    if (ch === delim) {
                        next();
                        return string;
                    } else if (ch === '\\') {
                        next();
                        if (ch === 'u') {
                            uffff = 0;
                            for (i = 0; i < 4; i += 1) {
                                hex = parseInt(next(), 16);
                                if (!isFinite(hex)) {
                                    break;
                                }
                                uffff = uffff * 16 + hex;
                            }
                            string += String.fromCharCode(uffff);
                        } else if (ch === '\r') {
                            if (peek() === '\n') {
                                next();
                            }
                        } else if (typeof escapee[ch] === 'string') {
                            string += escapee[ch];
                        } else {
                            break;
                        }
                    } else if (ch === '\n') {
                        // unescaped newlines are invalid; see:
                        // https://github.com/aseemk/json5/issues/24
                        // TODO this feels special-cased; are there other
                        // invalid unescaped chars?
                        break;
                    } else {
                        string += ch;
                    }
                }
            }
            error("Bad string");
        },

        inlineComment = function () {

// Skip an inline comment, assuming this is one. The current character should
// be the second / character in the // pair that begins this inline comment.
// To finish the inline comment, we look for a newline or the end of the text.

            if (ch !== '/') {
                error("Not an inline comment");
            }

            do {
                next();
                if (ch === '\n' || ch === '\r') {
                    next();
                    return;
                }
            } while (ch);
        },

        blockComment = function () {

// Skip a block comment, assuming this is one. The current character should be
// the * character in the /* pair that begins this block comment.
// To finish the block comment, we look for an ending */ pair of characters,
// but we also watch for the end of text before the comment is terminated.

            if (ch !== '*') {
                error("Not a block comment");
            }

            do {
                next();
                while (ch === '*') {
                    next('*');
                    if (ch === '/') {
                        next('/');
                        return;
                    }
                }
            } while (ch);

            error("Unterminated block comment");
        },

        comment = function () {

// Skip a comment, whether inline or block-level, assuming this is one.
// Comments always begin with a / character.

            if (ch !== '/') {
                error("Not a comment");
            }

            next('/');

            if (ch === '/') {
                inlineComment();
            } else if (ch === '*') {
                blockComment();
            } else {
                error("Unrecognized comment");
            }
        },

        white = function () {

// Skip whitespace and comments.
// Note that we're detecting comments by only a single / character.
// This works since regular expressions are not valid JSON(5), but this will
// break if there are other valid values that begin with a / character!

            while (ch) {
                if (ch === '/') {
                    comment();
                } else if (ws.indexOf(ch) >= 0) {
                    next();
                } else {
                    return;
                }
            }
        },

        word = function () {

// true, false, or null.

            switch (ch) {
            case 't':
                next('t');
                next('r');
                next('u');
                next('e');
                return true;
            case 'f':
                next('f');
                next('a');
                next('l');
                next('s');
                next('e');
                return false;
            case 'n':
                next('n');
                next('u');
                next('l');
                next('l');
                return null;
            case 'I':
                next('I');
                next('n');
                next('f');
                next('i');
                next('n');
                next('i');
                next('t');
                next('y');
                return Infinity;
            case 'N':
              next( 'N' );
              next( 'a' );
              next( 'N' );
              return NaN;
            }
            error("Unexpected " + renderChar(ch));
        },

        value,  // Place holder for the value function.

        array = function () {

// Parse an array value.

            var array = [];

            if (ch === '[') {
                next('[');
                white();
                while (ch) {
                    if (ch === ']') {
                        next(']');
                        return array;   // Potentially empty array
                    }
                    // ES5 allows omitting elements in arrays, e.g. [,] and
                    // [,null]. We don't allow this in JSON5.
                    if (ch === ',') {
                        error("Missing array element");
                    } else {
                        array.push(value());
                    }
                    white();
                    // If there's no comma after this value, this needs to
                    // be the end of the array.
                    if (ch !== ',') {
                        next(']');
                        return array;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad array");
        },

        object = function () {

// Parse an object value.

            var key,
                object = {};

            if (ch === '{') {
                next('{');
                white();
                while (ch) {
                    if (ch === '}') {
                        next('}');
                        return object;   // Potentially empty object
                    }

                    // Keys can be unquoted. If they are, they need to be
                    // valid JS identifiers.
                    if (ch === '"' || ch === "'") {
                        key = string();
                    } else {
                        key = identifier();
                    }

                    white();
                    next(':');
                    object[key] = value();
                    white();
                    // If there's no comma after this pair, this needs to be
                    // the end of the object.
                    if (ch !== ',') {
                        next('}');
                        return object;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad object");
        };

    value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

        white();
        switch (ch) {
        case '{':
            return object();
        case '[':
            return array();
        case '"':
        case "'":
            return string();
        case '-':
        case '+':
        case '.':
            return number();
        default:
            return ch >= '0' && ch <= '9' ? number() : word();
        }
    };

// Return the json_parse function. It will have access to all of the above
// functions and variables.

    return function (source, reviver) {
        var result;

        text = String(source);
        at = 0;
        lineNumber = 1;
        columnNumber = 1;
        ch = ' ';
        result = value();
        white();
        if (ch) {
            error("Syntax error");
        }

// If there is a reviver function, we recursively walk the new structure,
// passing each name/value pair to the reviver function for possible
// transformation, starting with a temporary root object that holds the result
// in an empty key. If there is not a reviver function, we simply return the
// result.

        return typeof reviver === 'function' ? (function walk(holder, key) {
            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = walk(value, k);
                        if (v !== undefined) {
                            value[k] = v;
                        } else {
                            delete value[k];
                        }
                    }
                }
            }
            return reviver.call(holder, key, value);
        }({'': result}, '')) : result;
    };
}());

// JSON5 stringify will not quote keys where appropriate
JSON5.stringify = function (obj, replacer, space) {
    if (replacer && (typeof(replacer) !== "function" && !isArray(replacer))) {
        throw new Error('Replacer must be a function or an array');
    }
    var getReplacedValueOrUndefined = function(holder, key, isTopLevel) {
        var value = holder[key];

        // Replace the value with its toJSON value first, if possible
        if (value && value.toJSON && typeof value.toJSON === "function") {
            value = value.toJSON();
        }

        // If the user-supplied replacer if a function, call it. If it's an array, check objects' string keys for
        // presence in the array (removing the key/value pair from the resulting JSON if the key is missing).
        if (typeof(replacer) === "function") {
            return replacer.call(holder, key, value);
        } else if(replacer) {
            if (isTopLevel || isArray(holder) || replacer.indexOf(key) >= 0) {
                return value;
            } else {
                return undefined;
            }
        } else {
            return value;
        }
    };

    function isWordChar(c) {
        return (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') ||
            c === '_' || c === '$';
    }

    function isWordStart(c) {
        return (c >= 'a' && c <= 'z') ||
            (c >= 'A' && c <= 'Z') ||
            c === '_' || c === '$';
    }

    function isWord(key) {
        if (typeof key !== 'string') {
            return false;
        }
        if (!isWordStart(key[0])) {
            return false;
        }
        var i = 1, length = key.length;
        while (i < length) {
            if (!isWordChar(key[i])) {
                return false;
            }
            i++;
        }
        return true;
    }

    // export for use in tests
    JSON5.isWord = isWord;

    // polyfills
    function isArray(obj) {
        if (Array.isArray) {
            return Array.isArray(obj);
        } else {
            return Object.prototype.toString.call(obj) === '[object Array]';
        }
    }

    function isDate(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    var objStack = [];
    function checkForCircular(obj) {
        for (var i = 0; i < objStack.length; i++) {
            if (objStack[i] === obj) {
                throw new TypeError("Converting circular structure to JSON");
            }
        }
    }

    function makeIndent(str, num, noNewLine) {
        if (!str) {
            return "";
        }
        // indentation no more than 10 chars
        if (str.length > 10) {
            str = str.substring(0, 10);
        }

        var indent = noNewLine ? "" : "\n";
        for (var i = 0; i < num; i++) {
            indent += str;
        }

        return indent;
    }

    var indentStr;
    if (space) {
        if (typeof space === "string") {
            indentStr = space;
        } else if (typeof space === "number" && space >= 0) {
            indentStr = makeIndent(" ", space, true);
        } else {
            // ignore space parameter
        }
    }

    // Copied from Crokford's implementation of JSON
    // See https://github.com/douglascrockford/JSON-js/blob/e39db4b7e6249f04a195e7dd0840e610cc9e941e/json2.js#L195
    // Begin
    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        meta = { // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    };
    function escapeString(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ?
                c :
                '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }
    // End

    function internalStringify(holder, key, isTopLevel) {
        var buffer, res;

        // Replace the value, if necessary
        var obj_part = getReplacedValueOrUndefined(holder, key, isTopLevel);

        if (obj_part && !isDate(obj_part)) {
            // unbox objects
            // don't unbox dates, since will turn it into number
            obj_part = obj_part.valueOf();
        }
        switch(typeof obj_part) {
            case "boolean":
                return obj_part.toString();

            case "number":
                if (isNaN(obj_part) || !isFinite(obj_part)) {
                    return "null";
                }
                return obj_part.toString();

            case "string":
                return escapeString(obj_part.toString());

            case "object":
                if (obj_part === null) {
                    return "null";
                } else if (isArray(obj_part)) {
                    checkForCircular(obj_part);
                    buffer = "[";
                    objStack.push(obj_part);

                    for (var i = 0; i < obj_part.length; i++) {
                        res = internalStringify(obj_part, i, false);
                        buffer += makeIndent(indentStr, objStack.length);
                        if (res === null || typeof res === "undefined") {
                            buffer += "null";
                        } else {
                            buffer += res;
                        }
                        if (i < obj_part.length-1) {
                            buffer += ",";
                        } else if (indentStr) {
                            buffer += "\n";
                        }
                    }
                    objStack.pop();
                    buffer += makeIndent(indentStr, objStack.length, true) + "]";
                } else {
                    checkForCircular(obj_part);
                    buffer = "{";
                    var nonEmpty = false;
                    objStack.push(obj_part);
                    for (var prop in obj_part) {
                        if (obj_part.hasOwnProperty(prop)) {
                            var value = internalStringify(obj_part, prop, false);
                            isTopLevel = false;
                            if (typeof value !== "undefined" && value !== null) {
                                buffer += makeIndent(indentStr, objStack.length);
                                nonEmpty = true;
                                key = isWord(prop) ? prop : escapeString(prop);
                                buffer += key + ":" + (indentStr ? ' ' : '') + value + ",";
                            }
                        }
                    }
                    objStack.pop();
                    if (nonEmpty) {
                        buffer = buffer.substring(0, buffer.length-1) + makeIndent(indentStr, objStack.length) + "}";
                    } else {
                        buffer = '{}';
                    }
                }
                return buffer;
            default:
                // functions and undefined should be ignored
                return undefined;
        }
    }

    // special case...when undefined is used inside of
    // a compound object/array, return null.
    // but when top-level, return undefined
    var topLevelHolder = {"":obj};
    if (obj === undefined) {
        return getReplacedValueOrUndefined(topLevelHolder, '', true);
    }
    return internalStringify(topLevelHolder, '', true);
};

},{}],15:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":16}],16:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],17:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],18:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],19:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":18,"_process":16,"inherits":17}],20:[function(require,module,exports){
/*!
 * XRegExp-All 
 * <xregexp.com>
 * Steven Levithan (c) 2012-2016 MIT License
 */

// Module systems magic dance
// Don't use strict mode for this function, so it can assign to global
(function(root, definition) {
    // RequireJS
    if (typeof define === 'function' && define.amd) {
        define(definition);
    // CommonJS
    } else if (typeof exports === 'object') {
        var self = definition();
        // Use Node.js's `module.exports`. This supports both `require('xregexp')` and
        // `require('xregexp').XRegExp`
        (typeof module === 'object' ? (module.exports = self) : exports).XRegExp = self;
    // <script>
    } else {
        // Create global
        root.XRegExp = definition();
    }
}(this, function() {
    "use strict";

/*!
 * XRegExp 
 * <xregexp.com>
 * Steven Levithan (c) 2007-2016 MIT License
 */



/**
 * XRegExp provides augmented, extensible regular expressions. You get additional regex syntax and
 * flags, beyond what browsers support natively. XRegExp is also a regex utility belt with tools to
 * make your client-side grepping simpler and more powerful, while freeing you from related
 * cross-browser inconsistencies.
 */

// ==--------------------------==
// Private stuff
// ==--------------------------==

// Property name used for extended regex instance data
var REGEX_DATA = 'xregexp';
// Optional features that can be installed and uninstalled
var features = {
    astral: false,
    natives: false
};
// Native methods to use and restore ('native' is an ES3 reserved keyword)
var nativ = {
    exec: RegExp.prototype.exec,
    test: RegExp.prototype.test,
    match: String.prototype.match,
    replace: String.prototype.replace,
    split: String.prototype.split
};
// Storage for fixed/extended native methods
var fixed = {};
// Storage for regexes cached by `XRegExp.cache`
var regexCache = {};
// Storage for pattern details cached by the `XRegExp` constructor
var patternCache = {};
// Storage for regex syntax tokens added internally or by `XRegExp.addToken`
var tokens = [];
// Token scopes
var defaultScope = 'default';
var classScope = 'class';
// Regexes that match native regex syntax, including octals
var nativeTokens = {
    // Any native multicharacter token in default scope, or any single character
    'default': /\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u(?:[\dA-Fa-f]{4}|{[\dA-Fa-f]+})|c[A-Za-z]|[\s\S])|\(\?(?:[:=!]|<[=!])|[?*+]\?|{\d+(?:,\d*)?}\??|[\s\S]/,
    // Any native multicharacter token in character class scope, or any single character
    'class': /\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u(?:[\dA-Fa-f]{4}|{[\dA-Fa-f]+})|c[A-Za-z]|[\s\S])|[\s\S]/
};
// Any backreference or dollar-prefixed character in replacement strings
var replacementToken = /\$(?:{([\w$]+)}|(\d\d?|[\s\S]))/g;
// Check for correct `exec` handling of nonparticipating capturing groups
var correctExecNpcg = nativ.exec.call(/()??/, '')[1] === undefined;
// Check for ES6 `flags` prop support
var hasFlagsProp = /x/.flags !== undefined;
// Shortcut to `Object.prototype.toString`
var toString = {}.toString;

function hasNativeFlag(flag) {
    // Can't check based on the presence of properties/getters since browsers might support such
    // properties even when they don't support the corresponding flag in regex construction (tested
    // in Chrome 48, where `'unicode' in /x/` is true but trying to construct a regex with flag `u`
    // throws an error)
    var isSupported = true;
    try {
        // Can't use regex literals for testing even in a `try` because regex literals with
        // unsupported flags cause a compilation error in IE
        new RegExp('', flag);
    } catch (exception) {
        isSupported = false;
    }
    if (isSupported && flag === 'y') {
        // Work around Safari 9.1.1 bug
        return new RegExp('aa|.', 'y').test('b');
    }
    return isSupported;
}
// Check for ES6 `u` flag support
var hasNativeU = hasNativeFlag('u');
// Check for ES6 `y` flag support
var hasNativeY = hasNativeFlag('y');
// Tracker for known flags, including addon flags
var registeredFlags = {
    g: true,
    i: true,
    m: true,
    u: hasNativeU,
    y: hasNativeY
};

/**
 * Attaches extended data and `XRegExp.prototype` properties to a regex object.
 *
 * @private
 * @param {RegExp} regex Regex to augment.
 * @param {Array} captureNames Array with capture names, or `null`.
 * @param {String} xSource XRegExp pattern used to generate `regex`, or `null` if N/A.
 * @param {String} xFlags XRegExp flags used to generate `regex`, or `null` if N/A.
 * @param {Boolean} [isNotNative=false] Whether the regex requires some XRegExp specific feature.
 * @param {Boolean} [isInternalOnly=false] Whether the regex will be used only for internal
 *   operations, and never exposed to users. For internal-only regexes, we can improve perf by
 *   skipping some operations like attaching `XRegExp.prototype` properties.
 * @returns {RegExp} Augmented regex.
 */
function augment(regex, captureNames, xSource, xFlags, isNotNative, isInternalOnly) {
    var p;

    regex[REGEX_DATA] = {
        captureNames: captureNames
    };

    if (isInternalOnly) {
        return regex;
    }

    // Can't auto-inherit these since the XRegExp constructor returns a nonprimitive value
    if (regex.__proto__) {
        regex.__proto__ = XRegExp.prototype;
    } else {
        for (p in XRegExp.prototype) {
            // An `XRegExp.prototype.hasOwnProperty(p)` check wouldn't be worth it here, since this
            // is performance sensitive, and enumerable `Object.prototype` or `RegExp.prototype`
            // extensions exist on `regex.prototype` anyway
            regex[p] = XRegExp.prototype[p];
        }
    }

    regex[REGEX_DATA].source = xSource;
    // Emulate the ES6 `flags` prop by ensuring flags are in alphabetical order
    regex[REGEX_DATA].flags = xFlags ? xFlags.split('').sort().join('') : xFlags;

    // signal whether the given regex is a standard RegExp one ('native') or does require
    // one or more XRegExp specific features:
    regex[REGEX_DATA].isNative = !isNotNative;

    return regex;
}

/**
 * Removes any duplicate characters from the provided string.
 *
 * @private
 * @param {String} str String to remove duplicate characters from.
 * @returns {String} String with any duplicate characters removed.
 */
function clipDuplicates(str) {
    return nativ.replace.call(str, /([\s\S])(?=[\s\S]*\1)/g, '');
}

/**
 * Copies a regex object while preserving extended data and augmenting with `XRegExp.prototype`
 * properties. The copy has a fresh `lastIndex` property (set to zero). Allows adding and removing
 * flags g and y while copying the regex.
 *
 * @private
 * @param {RegExp} regex Regex to copy.
 * @param {Object} [options] Options object with optional properties:
 *   <li>`addG` {Boolean} Add flag g while copying the regex.
 *   <li>`addY` {Boolean} Add flag y while copying the regex.
 *   <li>`removeG` {Boolean} Remove flag g while copying the regex.
 *   <li>`removeY` {Boolean} Remove flag y while copying the regex.
 *   <li>`isInternalOnly` {Boolean} Whether the copied regex will be used only for internal
 *     operations, and never exposed to users. For internal-only regexes, we can improve perf by
 *     skipping some operations like attaching `XRegExp.prototype` properties.
 * @returns {RegExp} Copy of the provided regex, possibly with modified flags.
 */
function copyRegex(regex, options) {
    if (!XRegExp.isRegExp(regex)) {
        throw new TypeError('Type RegExp expected');
    }

    var xData = regex[REGEX_DATA] || {},
        flags = getNativeFlags(regex),
        flagsToAdd = '',
        flagsToRemove = '',
        xregexpSource = null,
        xregexpFlags = null,
        customFlags;

    options = options || {};

    if (options.removeG) {flagsToRemove += 'g';}
    if (options.removeY) {flagsToRemove += 'y';}
    if (flagsToRemove) {
        flags = nativ.replace.call(flags, new RegExp('[' + flagsToRemove + ']+', 'g'), '');
    }

    if (options.addG) {flagsToAdd += 'g';}
    if (options.addY) {flagsToAdd += 'y';}
    if (flagsToAdd) {
        flags = clipDuplicates(flags + flagsToAdd);
    }

    if (!options.isInternalOnly) {
        if (xData.source !== undefined) {
            xregexpSource = xData.source;
        }
        // null or undefined; don't want to add to `flags` if the previous value was null, since
        // that indicates we're not tracking original precompilation flags
        if (xData.flags != null) {
            // Flags are only added for non-internal regexes by `XRegExp.globalize`. Flags are never
            // removed for non-internal regexes, so don't need to handle it
            xregexpFlags = flagsToAdd ? clipDuplicates(xData.flags + flagsToAdd) : xData.flags;
        }
    }

    // Augment with `XRegExp.prototype` properties, but use the native `RegExp` constructor to avoid
    // searching for special tokens. That would be wrong for regexes constructed by `RegExp`, and
    // unnecessary for regexes constructed by `XRegExp` because the regex has already undergone the
    // translation to native regex syntax
    var hasCaptureNames = hasNamedCapture(regex);

    // Strip all but custom flags, except the 'A' flag
    customFlags = flags;
    if (xregexpFlags) {
        customFlags += xregexpFlags;
    }
    customFlags = nativ.replace.call(clipDuplicates(customFlags), /[Agimuy]+/g, '');
    regex = augment(
        new RegExp(regex.source, flags),
        hasCaptureNames ? xData.captureNames.slice(0) : null,
        xregexpSource,
        xregexpFlags,
        customFlags || hasCaptureNames || regex.source !== xregexpSource,
        options.isInternalOnly
    );

    return regex;
}

/**
 * Converts hexadecimal to decimal.
 *
 * @private
 * @param {String} hex
 * @returns {Number}
 */
function dec(hex) {
    return parseInt(hex, 16);
}

/**
 * Returns native `RegExp` flags used by a regex object.
 *
 * @private
 * @param {RegExp} regex Regex to check.
 * @returns {String} Native flags in use.
 */
function getNativeFlags(regex) {
    return hasFlagsProp ?
        regex.flags :
        // Explicitly using `RegExp.prototype.toString` (rather than e.g. `String` or concatenation
        // with an empty string) allows this to continue working predictably when
        // `XRegExp.proptotype.toString` is overridden
        nativ.exec.call(/\/([a-z]*)$/i, RegExp.prototype.toString.call(regex))[1];
}

/**
 * Determines whether a regex has extended instance data used to track capture names.
 *
 * @private
 * @param {RegExp} regex Regex to check.
 * @returns {Boolean} Whether the regex uses named capture.
 */
function hasNamedCapture(regex) {
    return !!(regex[REGEX_DATA] && regex[REGEX_DATA].captureNames);
}

/**
 * Converts decimal to hexadecimal.
 *
 * @private
 * @param {Number|String} dec
 * @returns {String}
 */
function hex(dec) {
    return parseInt(dec, 10).toString(16);
}

/**
 * Returns the first index at which a given value can be found in an array.
 *
 * @private
 * @param {Array} array Array to search.
 * @param {*} value Value to locate in the array.
 * @returns {Number} Zero-based index at which the item is found, or -1.
 */
function indexOf(array, value) {
    var len = array.length, i;

    for (i = 0; i < len; ++i) {
        if (array[i] === value) {
            return i;
        }
    }

    return -1;
}

/**
 * Determines whether a value is of the specified type, by resolving its internal [[Class]].
 *
 * @private
 * @param {*} value Object to check.
 * @param {String} type Type to check for, in TitleCase.
 * @returns {Boolean} Whether the object matches the type.
 */
function isType(value, type) {
    return toString.call(value) === '[object ' + type + ']';
}

/**
 * Checks whether the next nonignorable token after the specified position is a quantifier.
 *
 * @private
 * @param {String} pattern Pattern to search within.
 * @param {Number} pos Index in `pattern` to search at.
 * @param {String} flags Flags used by the pattern.
 * @returns {Boolean} Whether the next token is a quantifier.
 */
function isQuantifierNext(pattern, pos, flags) {
    return nativ.test.call(
        flags.indexOf('x') > -1 ?
            // Ignore any leading whitespace, line comments, and inline comments
            /^(?:\s|#[^#\n]*|\(\?#[^)]*\))*(?:[?*+]|{\d+(?:,\d*)?})/ :
            // Ignore any leading inline comments
            /^(?:\(\?#[^)]*\))*(?:[?*+]|{\d+(?:,\d*)?})/,
        pattern.slice(pos)
    );
}

/**
 * Adds leading zeros if shorter than four characters. Used for fixed-length hexadecimal values.
 *
 * @private
 * @param {String} str
 * @returns {String}
 */
function pad4(str) {
    while (str.length < 4) {
        str = '0' + str;
    }
    return str;
}

/**
 * Checks for flag-related errors, and strips/applies flags in a leading mode modifier. Offloads
 * the flag preparation logic from the `XRegExp` constructor.
 *
 * @private
 * @param {String} pattern Regex pattern, possibly with a leading mode modifier.
 * @param {String} flags Any combination of flags.
 * @returns {Object} Object with properties `pattern` and `flags`.
 */
function prepareFlags(pattern, flags) {
    var i;

    // Recent browsers throw on duplicate flags, so copy this behavior for nonnative flags
    if (clipDuplicates(flags) !== flags) {
        throw new SyntaxError('Invalid duplicate regex flag ' + flags);
    }

    // Strip and apply a leading mode modifier with any combination of flags except g or y
    pattern = nativ.replace.call(pattern, /^\(\?([\w$]+)\)/, function($0, $1) {
        if (nativ.test.call(/[gy]/, $1)) {
            throw new SyntaxError('Cannot use flag g or y in mode modifier ' + $0);
        }
        // Allow duplicate flags within the mode modifier
        flags = clipDuplicates(flags + $1);
        return '';
    });

    // Throw on unknown native or nonnative flags
    for (i = 0; i < flags.length; ++i) {
        if (!registeredFlags[flags.charAt(i)]) {
            throw new SyntaxError('Unknown regex flag ' + flags.charAt(i));
        }
    }

    return {
        pattern: pattern,
        flags: flags
    };
}

/**
 * Prepares an options object from the given value.
 *
 * @private
 * @param {String|Object} value Value to convert to an options object.
 * @returns {Object} Options object.
 */
function prepareOptions(value) {
    var options = {};

    if (isType(value, 'String')) {
        XRegExp.forEach(value, /[^\s,]+/, function(match) {
            options[match] = true;
        });

        return options;
    }

    return value;
}

/**
 * Registers a flag so it doesn't throw an 'unknown flag' error.
 *
 * @private
 * @param {String} flag Single-character flag to register.
 */
function registerFlag(flag) {
    if (!/^[\w$]$/.test(flag)) {
        throw new Error('Flag must be a single character A-Za-z0-9_$');
    }

    registeredFlags[flag] = true;
}

/**
 * Runs built-in and custom regex syntax tokens in reverse insertion order at the specified
 * position, until a match is found.
 *
 * @private
 * @param {String} pattern Original pattern from which an XRegExp object is being built.
 * @param {String} flags Flags being used to construct the regex.
 * @param {Number} pos Position to search for tokens within `pattern`.
 * @param {Number} scope Regex scope to apply: 'default' or 'class'.
 * @param {Object} context Context object to use for token handler functions.
 * @returns {Object} Object with properties `matchLength`, `output`, and `reparse`; or `null`.
 */
function runTokens(pattern, flags, pos, scope, context) {
    var i = tokens.length,
        leadChar = pattern.charAt(pos),
        result = null,
        match,
        t;

    // Run in reverse insertion order
    while (i--) {
        t = tokens[i];
        if (
            (t.leadChar && t.leadChar !== leadChar) ||
            (t.scope !== scope && t.scope !== 'all') ||
            (t.flag && flags.indexOf(t.flag) === -1)
        ) {
            continue;
        }

        match = XRegExp.exec(pattern, t.regex, pos, 'sticky');
        if (match) {
            result = {
                matchLength: match[0].length,
                output: t.handler.call(context, match, scope, flags),
                reparse: t.reparse
            };
            // Finished with token tests
            break;
        }
    }

    return result;
}

/**
 * Enables or disables implicit astral mode opt-in. When enabled, flag A is automatically added to
 * all new regexes created by XRegExp. This causes an error to be thrown when creating regexes if
 * the Unicode Base addon is not available, since flag A is registered by that addon.
 *
 * @private
 * @param {Boolean} on `true` to enable; `false` to disable.
 */
function setAstral(on) {
    features.astral = on;
}

/**
 * Enables or disables native method overrides.
 *
 * @private
 * @param {Boolean} on `true` to enable; `false` to disable.
 */
function setNatives(on) {
    RegExp.prototype.exec = (on ? fixed : nativ).exec;
    RegExp.prototype.test = (on ? fixed : nativ).test;
    String.prototype.match = (on ? fixed : nativ).match;
    String.prototype.replace = (on ? fixed : nativ).replace;
    String.prototype.split = (on ? fixed : nativ).split;

    features.natives = on;
}

/**
 * Returns the object, or throws an error if it is `null` or `undefined`. This is used to follow
 * the ES5 abstract operation `ToObject`.
 *
 * @private
 * @param {*} value Object to check and return.
 * @returns {*} The provided object.
 */
function toObject(value) {
    // null or undefined
    if (value == null) {
        throw new TypeError('Cannot convert null or undefined to object');
    }

    return value;
}


/**
 * Returns an Array that is the list of given patterns to be joined. Patterns can be provided as
 * regex objects or strings. Metacharacters are escaped in patterns provided as strings.
 * Backreferences in provided regex objects are automatically renumbered to work correctly. Native
 * flags used by provided regexes are ignored in favor of the `flags` argument.
 *
 * @private
 * @param {Array} patterns Regexes and strings to combine.
 * @returns {Array} modified patterns RegExps and Strings to be combined.
 */
function prepareJoin(patterns) {
    var parts = /(\()(?!\?)|\\([1-9]\d*)|\\[\s\S]|\[(?:[^\\\]]|\\[\s\S])*\]/g,
        output = [],
        numCaptures = 0,
        numPriorCaptures,
        captureNames,
        pattern,
        rewrite = function(match, paren, backref) {
            var name = captureNames[numCaptures - numPriorCaptures];

            // Capturing group
            if (paren) {
                ++numCaptures;
                // If the current capture has a name, preserve the name
                if (name) {
                    return '(?<' + name + '>';
                }
            // Backreference
            } else if (backref) {
                // Rewrite the backreference
                return '\\' + (+backref + numPriorCaptures);
            }

            return match;
        },
        i;

    if (!(isType(patterns, 'Array') && patterns.length)) {
        throw new TypeError('Must provide a nonempty array of patterns to merge');
    }

    for (i = 0; i < patterns.length; ++i) {
        pattern = patterns[i];

        if (XRegExp.isRegExp(pattern)) {
            numPriorCaptures = numCaptures;
            captureNames = (pattern[REGEX_DATA] && pattern[REGEX_DATA].captureNames) || [];

            // Rewrite backreferences. Passing to XRegExp dies on octals and ensures patterns
            // are independently valid; helps keep this simple. Named captures are put back
            output.push(nativ.replace.call(XRegExp(pattern.source).source, parts, rewrite));
        } else {
            output.push(XRegExp.escape(pattern));
        }
    }

    return output;
}


// ==--------------------------==
// Constructor
// ==--------------------------==

/**
 * Creates an extended regular expression object for matching text with a pattern. Differs from a
 * native regular expression in that additional syntax and flags are supported. The returned object
 * is in fact a native `RegExp` and works with all native methods.
 *
 * @class XRegExp
 * @constructor
 * @param {String|RegExp} pattern Regex pattern string, or an existing regex object to copy.
 * @param {String} [flags] Any combination of flags.
 *   Native flags:
 *     <li>`g` - global
 *     <li>`i` - ignore case
 *     <li>`m` - multiline anchors
 *     <li>`u` - unicode (ES6)
 *     <li>`y` - sticky (Firefox 3+, ES6)
 *   Additional XRegExp flags:
 *     <li>`n` - explicit capture
 *     <li>`s` - dot matches all (aka singleline)
 *     <li>`x` - free-spacing and line comments (aka extended)
 *     <li>`A` - astral (requires the Unicode Base addon)
 *   Flags cannot be provided when constructing one `RegExp` from another.
 * @returns {RegExp} Extended regular expression object.
 * @example
 *
 * // With named capture and flag x
 * XRegExp('(?<year>  [0-9]{4} ) -?  # year  \n\
 *          (?<month> [0-9]{2} ) -?  # month \n\
 *          (?<day>   [0-9]{2} )     # day   ', 'x');
 *
 * // Providing a regex object copies it. Native regexes are recompiled using native (not XRegExp)
 * // syntax. Copies maintain extended data, are augmented with `XRegExp.prototype` properties, and
 * // have fresh `lastIndex` properties (set to zero).
 * XRegExp(/regex/);
 */
function XRegExp(pattern, flags) {
    if (XRegExp.isRegExp(pattern)) {
        if (flags !== undefined) {
            throw new TypeError('Cannot supply flags when copying a RegExp');
        }
        return copyRegex(pattern);
    }

    // Copy the argument behavior of `RegExp`
    pattern = pattern === undefined ? '' : String(pattern);
    flags = flags === undefined ? '' : String(flags);

    if (XRegExp.isInstalled('astral') && flags.indexOf('A') === -1) {
        // This causes an error to be thrown if the Unicode Base addon is not available
        flags += 'A';
    }

    if (!patternCache[pattern]) {
        patternCache[pattern] = {};
    }

    if (!patternCache[pattern][flags]) {
        var context = {
            hasNamedCapture: false,
            captureNames: []
        };
        var scope = defaultScope;
        var output = '';
        var pos = 0;
        var result;

        // Check for flag-related errors, and strip/apply flags in a leading mode modifier
        var applied = prepareFlags(pattern, flags);
        var appliedPattern = applied.pattern;
        var appliedFlags = applied.flags;

        // Use XRegExp's tokens to translate the pattern to a native regex pattern.
        // `appliedPattern.length` may change on each iteration if tokens use `reparse`
        while (pos < appliedPattern.length) {
            do {
                // Check for custom tokens at the current position
                result = runTokens(appliedPattern, appliedFlags, pos, scope, context);
                // If the matched token used the `reparse` option, splice its output into the
                // pattern before running tokens again at the same position
                if (result && result.reparse) {
                    appliedPattern = appliedPattern.slice(0, pos) +
                        result.output +
                        appliedPattern.slice(pos + result.matchLength);
                }
            } while (result && result.reparse);

            if (result) {
                output += result.output;
                pos += (result.matchLength || 1);
            } else {
                // Get the native token at the current position
                var token = XRegExp.exec(appliedPattern, nativeTokens[scope], pos, 'sticky')[0];
                output += token;
                pos += token.length;
                if (token === '[' && scope === defaultScope) {
                    scope = classScope;
                } else if (token === ']' && scope === classScope) {
                    scope = defaultScope;
                }
            }
        }

        patternCache[pattern][flags] = {
            // Use basic cleanup to collapse repeated empty groups like `(?:)(?:)` to `(?:)`. Empty
            // groups are sometimes inserted during regex transpilation in order to keep tokens
            // separated. However, more than one empty group in a row is never needed.
            pattern: nativ.replace.call(output, /(?:\(\?:\))+/g, '(?:)'),
            // Strip all but native flags
            flags: nativ.replace.call(appliedFlags, /[^gimuy]+/g, ''),
            // `context.captureNames` has an item for each capturing group, even if unnamed
            captures: context.hasNamedCapture ? context.captureNames : null
        };
    }

    var generated = patternCache[pattern][flags];
        
    // Strip all but custom flags, except the 'A' flag
    var customFlags = flags;
    if (appliedFlags) {
        customFlags += appliedFlags;
    }
    customFlags = nativ.replace.call(clipDuplicates(customFlags), /[Agimuy]+/g, '');
    return augment(
        new RegExp(generated.pattern, generated.flags),
        generated.captures,
        pattern,
        flags,
        customFlags || generated.captures || generated.pattern !== pattern
    );
}

// Add `RegExp.prototype` to the prototype chain
XRegExp.prototype = new RegExp();

// ==--------------------------==
// Public properties
// ==--------------------------==

/**
 * The XRegExp version number as a string containing three dot-separated parts. For example,
 * '2.0.0-beta-3'.
 *
 * @static
 * @memberOf XRegExp
 * @type String
 */
XRegExp.version = '3.1.2-8';

// ==--------------------------==
// Public methods
// ==--------------------------==

// Intentionally undocumented; used in tests and addons
XRegExp._hasNativeFlag = hasNativeFlag;
XRegExp._dec = dec;
XRegExp._hex = hex;
XRegExp._pad4 = pad4;

/**
 * Extends XRegExp syntax and allows custom flags. This is used internally and can be used to
 * create XRegExp addons. If more than one token can match the same string, the last added wins.
 *
 * @memberOf XRegExp
 * @param {RegExp} regex Regex object that matches the new token.
 * @param {Function} handler Function that returns a new pattern string (using native regex syntax)
 *   to replace the matched token within all future XRegExp regexes. Has access to persistent
 *   properties of the regex being built, through `this`. Invoked with three arguments:
 *   <li>The match array, with named backreference properties.
 *   <li>The regex scope where the match was found: 'default' or 'class'.
 *   <li>The flags used by the regex, including any flags in a leading mode modifier.
 *   The handler function becomes part of the XRegExp construction process, so be careful not to
 *   construct XRegExps within the function or you will trigger infinite recursion.
 * @param {Object} [options] Options object with optional properties:
 *   <li>`scope` {String} Scope where the token applies: 'default', 'class', or 'all'.
 *   <li>`flag` {String} Single-character flag that triggers the token. This also registers the
 *     flag, which prevents XRegExp from throwing an 'unknown flag' error when the flag is used.
 *   <li>`optionalFlags` {String} Any custom flags checked for within the token `handler` that are
 *     not required to trigger the token. This registers the flags, to prevent XRegExp from
 *     throwing an 'unknown flag' error when any of the flags are used.
 *   <li>`reparse` {Boolean} Whether the `handler` function's output should not be treated as
 *     final, and instead be reparseable by other tokens (including the current token). Allows
 *     token chaining or deferring.
 *   <li>`leadChar` {String} Single character that occurs at the beginning of any successful match
 *     of the token (not always applicable). This doesn't change the behavior of the token unless
 *     you provide an erroneous value. However, providing it can increase the token's performance
 *     since the token can be skipped at any positions where this character doesn't appear.
 * @example
 *
 * // Basic usage: Add \a for the ALERT control code
 * XRegExp.addToken(
 *   /\\a/,
 *   function() {return '\\x07';},
 *   {scope: 'all'}
 * );
 * XRegExp('\\a[\\a-\\n]+').test('\x07\n\x07'); // -> true
 *
 * // Add the U (ungreedy) flag from PCRE and RE2, which reverses greedy and lazy quantifiers.
 * // Since `scope` is not specified, it uses 'default' (i.e., transformations apply outside of
 * // character classes only)
 * XRegExp.addToken(
 *   /([?*+]|{\d+(?:,\d*)?})(\??)/,
 *   function(match) {return match[1] + (match[2] ? '' : '?');},
 *   {flag: 'U'}
 * );
 * XRegExp('a+', 'U').exec('aaa')[0]; // -> 'a'
 * XRegExp('a+?', 'U').exec('aaa')[0]; // -> 'aaa'
 */
XRegExp.addToken = function(regex, handler, options) {
    options = options || {};
    var optionalFlags = options.optionalFlags, i;

    if (options.flag) {
        registerFlag(options.flag);
    }

    if (optionalFlags) {
        optionalFlags = nativ.split.call(optionalFlags, '');
        for (i = 0; i < optionalFlags.length; ++i) {
            registerFlag(optionalFlags[i]);
        }
    }

    // Add to the private list of syntax tokens
    tokens.push({
        regex: copyRegex(regex, {
            addG: true,
            addY: hasNativeY,
            isInternalOnly: true
        }),
        handler: handler,
        scope: options.scope || defaultScope,
        flag: options.flag,
        reparse: options.reparse,
        leadChar: options.leadChar
    });

    // Reset the pattern cache used by the `XRegExp` constructor, since the same pattern and flags
    // might now produce different results
    XRegExp.cache.flush('patterns');
};

/**
 * Caches and returns the result of calling `XRegExp(pattern, flags)`. On any subsequent call with
 * the same pattern and flag combination, the cached copy of the regex is returned.
 *
 * @memberOf XRegExp
 * @param {String} pattern Regex pattern string.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Cached XRegExp object.
 * @example
 *
 * while (match = XRegExp.cache('.', 'gs').exec(str)) {
 *   // The regex is compiled once only
 * }
 */
XRegExp.cache = function(pattern, flags) {
    if (!regexCache[pattern]) {
        regexCache[pattern] = {};
    }
    return regexCache[pattern][flags] || (
        regexCache[pattern][flags] = XRegExp(pattern, flags)
    );
};

// Intentionally undocumented; used in tests
XRegExp.cache.flush = function(cacheName) {
    if (cacheName === 'patterns') {
        // Flush the pattern cache used by the `XRegExp` constructor
        patternCache = {};
    } else {
        // Flush the regex cache populated by `XRegExp.cache`
        regexCache = {};
    }
};

/**
 * Escapes any regular expression metacharacters, for use when matching literal strings. The result
 * can safely be used at any point within a regex that uses any flags.
 *
 * @memberOf XRegExp
 * @param {String} str String to escape.
 * @returns {String} String with regex metacharacters escaped.
 * @example
 *
 * XRegExp.escape('Escaped? <.>');
 * // -> 'Escaped\?\ <\.>'
 */
XRegExp.escape = function(str) {
    return nativ.replace.call(toObject(str), /[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Executes a regex search in a specified string. Returns a match array or `null`. If the provided
 * regex uses named capture, named backreference properties are included on the match array.
 * Optional `pos` and `sticky` arguments specify the search start position, and whether the match
 * must start at the specified position only. The `lastIndex` property of the provided regex is not
 * used, but is updated for compatibility. Also fixes browser bugs compared to the native
 * `RegExp.prototype.exec` and can be used reliably cross-browser.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {Number} [pos=0] Zero-based index at which to start the search.
 * @param {Boolean|String} [sticky=false] Whether the match must start at the specified position
 *   only. The string `'sticky'` is accepted as an alternative to `true`.
 * @returns {Array} Match array with named backreference properties, or `null`.
 * @example
 *
 * // Basic use, with named backreference
 * var match = XRegExp.exec('U+2620', XRegExp('U\\+(?<hex>[0-9A-F]{4})'));
 * match.hex; // -> '2620'
 *
 * // With pos and sticky, in a loop
 * var pos = 2, result = [], match;
 * while (match = XRegExp.exec('<1><2><3><4>5<6>', /<(\d)>/, pos, 'sticky')) {
 *   result.push(match[1]);
 *   pos = match.index + match[0].length;
 * }
 * // result -> ['2', '3', '4']
 */
XRegExp.exec = function(str, regex, pos, sticky) {
    var cacheKey = 'g',
        addY = false,
        match,
        r2;

    addY = hasNativeY && !!(sticky || (regex.sticky && sticky !== false));
    if (addY) {
        cacheKey += 'y';
    }

    regex[REGEX_DATA] = regex[REGEX_DATA] || {};

    // Shares cached copies with `XRegExp.match`/`replace`
    r2 = regex[REGEX_DATA][cacheKey] || (
        regex[REGEX_DATA][cacheKey] = copyRegex(regex, {
            addG: true,
            addY: addY,
            removeY: sticky === false,
            isInternalOnly: true
        })
    );

    r2.lastIndex = pos = pos || 0;

    // Fixed `exec` required for `lastIndex` fix, named backreferences, etc.
    match = fixed.exec.call(r2, str);

    if (sticky && match && match.index !== pos) {
        match = null;
    }

    if (regex.global) {
        regex.lastIndex = match ? r2.lastIndex : 0;
    }

    return match;
};

/**
 * Executes a provided function once per regex match. Searches always start at the beginning of the
 * string and continue until the end, regardless of the state of the regex's `global` property and
 * initial `lastIndex`.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {Function} callback Function to execute for each match. Invoked with four arguments:
 *   <li>The match array, with named backreference properties.
 *   <li>The zero-based match index.
 *   <li>The string being traversed.
 *   <li>The regex object being used to traverse the string.
 * @example
 *
 * // Extracts every other digit from a string
 * var evens = [];
 * XRegExp.forEach('1a2345', /\d/, function(match, i) {
 *   if (i % 2) evens.push(+match[0]);
 * });
 * // evens -> [2, 4]
 */
XRegExp.forEach = function(str, regex, callback) {
    var pos = 0,
        i = -1,
        match;

    while ((match = XRegExp.exec(str, regex, pos))) {
        // Because `regex` is provided to `callback`, the function could use the deprecated/
        // nonstandard `RegExp.prototype.compile` to mutate the regex. However, since `XRegExp.exec`
        // doesn't use `lastIndex` to set the search position, this can't lead to an infinite loop,
        // at least. Actually, because of the way `XRegExp.exec` caches globalized versions of
        // regexes, mutating the regex will not have any effect on the iteration or matched strings,
        // which is a nice side effect that brings extra safety.
        callback(match, ++i, str, regex);

        pos = match.index + (match[0].length || 1);
    }
};

/**
 * Copies a regex object and adds flag `g`. The copy maintains extended data, is augmented with
 * `XRegExp.prototype` properties, and has a fresh `lastIndex` property (set to zero). Native
 * regexes are not recompiled using XRegExp syntax.
 *
 * @memberOf XRegExp
 * @param {RegExp} regex Regex to globalize.
 * @returns {RegExp} Copy of the provided regex with flag `g` added.
 * @example
 *
 * var globalCopy = XRegExp.globalize(/regex/);
 * globalCopy.global; // -> true
 */
XRegExp.globalize = function(regex) {
    return copyRegex(regex, {addG: true});
};

/**
 * Installs optional features according to the specified options. Can be undone using
 * `XRegExp.uninstall`.
 *
 * @memberOf XRegExp
 * @param {Object|String} options Options object or string.
 * @example
 *
 * // With an options object
 * XRegExp.install({
 *   // Enables support for astral code points in Unicode addons (implicitly sets flag A)
 *   astral: true,
 *
 *   // DEPRECATED: Overrides native regex methods with fixed/extended versions
 *   natives: true
 * });
 *
 * // With an options string
 * XRegExp.install('astral natives');
 */
XRegExp.install = function(options) {
    options = prepareOptions(options);

    if (!features.astral && options.astral) {
        setAstral(true);
    }

    if (!features.natives && options.natives) {
        setNatives(true);
    }
};

/**
 * Checks whether an individual optional feature is installed.
 *
 * @memberOf XRegExp
 * @param {String} feature Name of the feature to check. One of:
 *   <li>`astral`
 *   <li>`natives`
 * @returns {Boolean} Whether the feature is installed.
 * @example
 *
 * XRegExp.isInstalled('astral');
 */
XRegExp.isInstalled = function(feature) {
    return !!(features[feature]);
};

/**
 * Returns `true` if an object is a regex; `false` if it isn't. This works correctly for regexes
 * created in another frame, when `instanceof` and `constructor` checks would fail.
 *
 * @memberOf XRegExp
 * @param {*} value Object to check.
 * @returns {Boolean} Whether the object is a `RegExp` object.
 * @example
 *
 * XRegExp.isRegExp('string'); // -> false
 * XRegExp.isRegExp(/regex/i); // -> true
 * XRegExp.isRegExp(RegExp('^', 'm')); // -> true
 * XRegExp.isRegExp(XRegExp('(?s).')); // -> true
 */
XRegExp.isRegExp = function(value) {
    return toString.call(value) === '[object RegExp]';
    //return isType(value, 'RegExp');
};

/**
 * Returns the first matched string, or in global mode, an array containing all matched strings.
 * This is essentially a more convenient re-implementation of `String.prototype.match` that gives
 * the result types you actually want (string instead of `exec`-style array in match-first mode,
 * and an empty array instead of `null` when no matches are found in match-all mode). It also lets
 * you override flag g and ignore `lastIndex`, and fixes browser bugs.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {String} [scope='one'] Use 'one' to return the first match as a string. Use 'all' to
 *   return an array of all matched strings. If not explicitly specified and `regex` uses flag g,
 *   `scope` is 'all'.
 * @returns {String|Array} In match-first mode: First match as a string, or `null`. In match-all
 *   mode: Array of all matched strings, or an empty array.
 * @example
 *
 * // Match first
 * XRegExp.match('abc', /\w/); // -> 'a'
 * XRegExp.match('abc', /\w/g, 'one'); // -> 'a'
 * XRegExp.match('abc', /x/g, 'one'); // -> null
 *
 * // Match all
 * XRegExp.match('abc', /\w/g); // -> ['a', 'b', 'c']
 * XRegExp.match('abc', /\w/, 'all'); // -> ['a', 'b', 'c']
 * XRegExp.match('abc', /x/, 'all'); // -> []
 */
XRegExp.match = function(str, regex, scope) {
    var global = (regex.global && scope !== 'one') || scope === 'all',
        cacheKey = ((global ? 'g' : '') + (regex.sticky ? 'y' : '')) || 'noGY',
        result,
        r2;

    regex[REGEX_DATA] = regex[REGEX_DATA] || {};

    // Shares cached copies with `XRegExp.exec`/`replace`
    r2 = regex[REGEX_DATA][cacheKey] || (
        regex[REGEX_DATA][cacheKey] = copyRegex(regex, {
            addG: !!global,
            removeG: scope === 'one',
            isInternalOnly: true
        })
    );

    result = nativ.match.call(toObject(str), r2);

    if (regex.global) {
        regex.lastIndex = (
            (scope === 'one' && result) ?
                // Can't use `r2.lastIndex` since `r2` is nonglobal in this case
                (result.index + result[0].length) : 0
        );
    }

    return global ? (result || []) : (result && result[0]);
};

/**
 * Retrieves the matches from searching a string using a chain of regexes that successively search
 * within previous matches. The provided `chain` array can contain regexes and or objects with
 * `regex` and `backref` properties. When a backreference is specified, the named or numbered
 * backreference is passed forward to the next regex or returned.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {Array} chain Regexes that each search for matches within preceding results.
 * @returns {Array} Matches by the last regex in the chain, or an empty array.
 * @example
 *
 * // Basic usage; matches numbers within <b> tags
 * XRegExp.matchChain('1 <b>2</b> 3 <b>4 a 56</b>', [
 *   XRegExp('(?is)<b>.*?</b>'),
 *   /\d+/
 * ]);
 * // -> ['2', '4', '56']
 *
 * // Passing forward and returning specific backreferences
 * html = '<a href="http://xregexp.com/api/">XRegExp</a>\
 *         <a href="http://www.google.com/">Google</a>';
 * XRegExp.matchChain(html, [
 *   {regex: /<a href="([^"]+)">/i, backref: 1},
 *   {regex: XRegExp('(?i)^https?://(?<domain>[^/?#]+)'), backref: 'domain'}
 * ]);
 * // -> ['xregexp.com', 'www.google.com']
 */
XRegExp.matchChain = function(str, chain) {
    return (function recurseChain(values, level) {
        var item = chain[level].regex ? chain[level] : {regex: chain[level]};
        var matches = [];

        function addMatch(match) {
            if (item.backref) {
                // Safari 4.0.5 (but not 5.0.5+) inappropriately uses sparse arrays to hold the
                // `undefined`s for backreferences to nonparticipating capturing groups. In such
                // cases, a `hasOwnProperty` or `in` check on its own would inappropriately throw
                // the exception, so also check if the backreference is a number that is within the
                // bounds of the array.
                if (!(match.hasOwnProperty(item.backref) || +item.backref < match.length)) {
                    throw new ReferenceError('Backreference to undefined group: ' + item.backref);
                }

                matches.push(match[item.backref] || '');
            } else {
                matches.push(match[0]);
            }
        }

        for (var i = 0; i < values.length; ++i) {
            XRegExp.forEach(values[i], item.regex, addMatch);
        }

        return ((level === chain.length - 1) || !matches.length) ?
            matches :
            recurseChain(matches, level + 1);
    }([str], 0));
};

/**
 * Returns a new string with one or all matches of a pattern replaced. The pattern can be a string
 * or regex, and the replacement can be a string or a function to be called for each match. To
 * perform a global search and replace, use the optional `scope` argument or include flag g if using
 * a regex. Replacement strings can use `${n}` for named and numbered backreferences. Replacement
 * functions can use named backreferences via `arguments[0].name`. Also fixes browser bugs compared
 * to the native `String.prototype.replace` and can be used reliably cross-browser.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp|String} search Search pattern to be replaced.
 * @param {String|Function} replacement Replacement string or a function invoked to create it.
 *   Replacement strings can include special replacement syntax:
 *     <li>$$ - Inserts a literal $ character.
 *     <li>$&, $0 - Inserts the matched substring.
 *     <li>$` - Inserts the string that precedes the matched substring (left context).
 *     <li>$' - Inserts the string that follows the matched substring (right context).
 *     <li>$n, $nn - Where n/nn are digits referencing an existent capturing group, inserts
 *       backreference n/nn.
 *     <li>${n} - Where n is a name or any number of digits that reference an existent capturing
 *       group, inserts backreference n.
 *   Replacement functions are invoked with three or more arguments:
 *     <li>The matched substring (corresponds to $& above). Named backreferences are accessible as
 *       properties of this first argument.
 *     <li>0..n arguments, one for each backreference (corresponding to $1, $2, etc. above).
 *     <li>The zero-based index of the match within the total search string.
 *     <li>The total string being searched.
 * @param {String} [scope='one'] Use 'one' to replace the first match only, or 'all'. If not
 *   explicitly specified and using a regex with flag g, `scope` is 'all'.
 * @returns {String} New string with one or all matches replaced.
 * @example
 *
 * // Regex search, using named backreferences in replacement string
 * var name = XRegExp('(?<first>\\w+) (?<last>\\w+)');
 * XRegExp.replace('John Smith', name, '${last}, ${first}');
 * // -> 'Smith, John'
 *
 * // Regex search, using named backreferences in replacement function
 * XRegExp.replace('John Smith', name, function(match) {
 *   return match.last + ', ' + match.first;
 * });
 * // -> 'Smith, John'
 *
 * // String search, with replace-all
 * XRegExp.replace('RegExp builds RegExps', 'RegExp', 'XRegExp', 'all');
 * // -> 'XRegExp builds XRegExps'
 */
XRegExp.replace = function(str, search, replacement, scope) {
    var isRegex = XRegExp.isRegExp(search),
        global = (search.global && scope !== 'one') || scope === 'all',
        cacheKey = ((global ? 'g' : '') + (search.sticky ? 'y' : '')) || 'noGY',
        s2 = search,
        result;

    if (isRegex) {
        search[REGEX_DATA] = search[REGEX_DATA] || {};

        // Shares cached copies with `XRegExp.exec`/`match`. Since a copy is used, `search`'s
        // `lastIndex` isn't updated *during* replacement iterations
        s2 = search[REGEX_DATA][cacheKey] || (
            search[REGEX_DATA][cacheKey] = copyRegex(search, {
                addG: !!global,
                removeG: scope === 'one',
                isInternalOnly: true
            })
        );
    } else if (global) {
        s2 = new RegExp(XRegExp.escape(String(search)), 'g');
    }

    // Fixed `replace` required for named backreferences, etc.
    result = fixed.replace.call(toObject(str), s2, replacement);

    if (isRegex && search.global) {
        // Fixes IE, Safari bug (last tested IE 9, Safari 5.1)
        search.lastIndex = 0;
    }

    return result;
};

/**
 * Performs batch processing of string replacements. Used like `XRegExp.replace`, but accepts an
 * array of replacement details. Later replacements operate on the output of earlier replacements.
 * Replacement details are accepted as an array with a regex or string to search for, the
 * replacement string or function, and an optional scope of 'one' or 'all'. Uses the XRegExp
 * replacement text syntax, which supports named backreference properties via `${name}`.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {Array} replacements Array of replacement detail arrays.
 * @returns {String} New string with all replacements.
 * @example
 *
 * str = XRegExp.replaceEach(str, [
 *   [XRegExp('(?<name>a)'), 'z${name}'],
 *   [/b/gi, 'y'],
 *   [/c/g, 'x', 'one'], // scope 'one' overrides /g
 *   [/d/, 'w', 'all'],  // scope 'all' overrides lack of /g
 *   ['e', 'v', 'all'],  // scope 'all' allows replace-all for strings
 *   [/f/g, function($0) {
 *     return $0.toUpperCase();
 *   }]
 * ]);
 */
XRegExp.replaceEach = function(str, replacements) {
    var i, r;

    for (i = 0; i < replacements.length; ++i) {
        r = replacements[i];
        str = XRegExp.replace(str, r[0], r[1], r[2]);
    }

    return str;
};

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 *
 * @memberOf XRegExp
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * XRegExp.split('a b c', ' ');
 * // -> ['a', 'b', 'c']
 *
 * // With limit
 * XRegExp.split('a b c', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * XRegExp.split('..word1..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', '..']
 */
XRegExp.split = function(str, separator, limit) {
    return fixed.split.call(toObject(str), separator, limit);
};

/**
 * Executes a regex search in a specified string. Returns `true` or `false`. Optional `pos` and
 * `sticky` arguments specify the search start position, and whether the match must start at the
 * specified position only. The `lastIndex` property of the provided regex is not used, but is
 * updated for compatibility. Also fixes browser bugs compared to the native
 * `RegExp.prototype.test` and can be used reliably cross-browser.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {RegExp} regex Regex to search with.
 * @param {Number} [pos=0] Zero-based index at which to start the search.
 * @param {Boolean|String} [sticky=false] Whether the match must start at the specified position
 *   only. The string `'sticky'` is accepted as an alternative to `true`.
 * @returns {Boolean} Whether the regex matched the provided value.
 * @example
 *
 * // Basic use
 * XRegExp.test('abc', /c/); // -> true
 *
 * // With pos and sticky
 * XRegExp.test('abc', /c/, 0, 'sticky'); // -> false
 * XRegExp.test('abc', /c/, 2, 'sticky'); // -> true
 */
XRegExp.test = function(str, regex, pos, sticky) {
    // Do this the easy way :-)
    return !!XRegExp.exec(str, regex, pos, sticky);
};

/**
 * Uninstalls optional features according to the specified options. All optional features start out
 * uninstalled, so this is used to undo the actions of `XRegExp.install`.
 *
 * @memberOf XRegExp
 * @param {Object|String} options Options object or string.
 * @example
 *
 * // With an options object
 * XRegExp.uninstall({
 *   // Disables support for astral code points in Unicode addons
 *   astral: true,
 *
 *   // DEPRECATED: Restores native regex methods
 *   natives: true
 * });
 *
 * // With an options string
 * XRegExp.uninstall('astral natives');
 */
XRegExp.uninstall = function(options) {
    options = prepareOptions(options);

    if (features.astral && options.astral) {
        setAstral(false);
    }

    if (features.natives && options.natives) {
        setNatives(false);
    }
};

/**
 * Returns an XRegExp object that is the concatenation of the given patterns. Patterns can be provided as
 * regex objects or strings. Metacharacters are escaped in patterns provided as strings.
 * Backreferences in provided regex objects are automatically renumbered to work correctly within
 * the larger combined pattern. Native flags used by provided regexes are ignored in favor of the
 * `flags` argument.
 *
 * @memberOf XRegExp
 * @param {Array} patterns Regexes and strings to combine.
 * @param {String|RegExp} separator Regex or string to use as the joining separator.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Union of the provided regexes and strings.
 * @example
 *
 * XRegExp.join(['a+b*c', /(dogs)\1/, /(cats)\1/], 'i');
 * // -> /a\+b\*c(dogs)\1(cats)\2/i
 */
XRegExp.join = function(patterns, separator, flags) {
    separator = separator || "";
    var separatorStr = XRegExp.isRegExp(separator) ? separator.source : XRegExp.escape(separator),
        output = prepareJoin(patterns);
    return XRegExp(output.join(separatorStr), flags);
};

/**
 * Returns an XRegExp object that is the union of the given patterns. Patterns can be provided as
 * regex objects or strings. Metacharacters are escaped in patterns provided as strings.
 * Backreferences in provided regex objects are automatically renumbered to work correctly within
 * the larger combined pattern. Native flags used by provided regexes are ignored in favor of the
 * `flags` argument.
 *
 * @memberOf XRegExp
 * @param {Array} patterns Regexes and strings to combine.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Union of the provided regexes and strings.
 * @example
 *
 * XRegExp.union(['a+b*c', /(dogs)\1/, /(cats)\1/], 'i');
 * // -> /a\+b\*c|(dogs)\1|(cats)\2/i
 */
XRegExp.union = function(patterns, flags) {
    return XRegExp.join(patterns, /|/, flags);
};

/* ==============================
 * Fixed/extended native methods
 * ============================== */

/**
 * Adds named capture support (with backreferences returned as `result.name`), and fixes browser
 * bugs in the native `RegExp.prototype.exec`. Calling `XRegExp.install('natives')` uses this to
 * override the native method. Use via `XRegExp.exec` without overriding natives.
 *
 * @private
 * @param {String} str String to search.
 * @returns {Array} Match array with named backreference properties, or `null`.
 */
fixed.exec = function(str) {
    var origLastIndex = this.lastIndex,
        match = nativ.exec.apply(this, arguments),
        name,
        r2,
        i;

    if (match) {
        // Fix browsers whose `exec` methods don't return `undefined` for nonparticipating capturing
        // groups. This fixes IE 5.5-8, but not IE 9's quirks mode or emulation of older IEs. IE 9
        // in standards mode follows the spec.
        if (!correctExecNpcg && match.length > 1 && indexOf(match, '') > -1) {
            r2 = copyRegex(this, {
                removeG: true,
                isInternalOnly: true
            });
            // Using `str.slice(match.index)` rather than `match[0]` in case lookahead allowed
            // matching due to characters outside the match
            nativ.replace.call(String(str).slice(match.index), r2, function() {
                var len = arguments.length, i;
                // Skip index 0 and the last 2
                for (i = 1; i < len - 2; ++i) {
                    if (arguments[i] === undefined) {
                        match[i] = undefined;
                    }
                }
            });
        }

        // Attach named capture properties
        if (this[REGEX_DATA] && this[REGEX_DATA].captureNames) {
            // Skip index 0
            for (i = 1; i < match.length; ++i) {
                name = this[REGEX_DATA].captureNames[i - 1];
                if (name) {
                    if (match[i] != undefined || match[name] == undefined) {
                        match[name] = match[i];
                    }
                }
            }
        }

        // Fix browsers that increment `lastIndex` after zero-length matches
        if (this.global && !match[0].length && (this.lastIndex > match.index)) {
            this.lastIndex = match.index;
        }
    }

    if (!this.global) {
        // Fixes IE, Opera bug (last tested IE 9, Opera 11.6)
        this.lastIndex = origLastIndex;
    }

    return match;
};

/**
 * Fixes browser bugs in the native `RegExp.prototype.test`. Calling `XRegExp.install('natives')`
 * uses this to override the native method.
 *
 * @private
 * @param {String} str String to search.
 * @returns {Boolean} Whether the regex matched the provided value.
 */
fixed.test = function(str) {
    // Do this the easy way :-)
    return !!fixed.exec.call(this, str);
};

/**
 * Adds named capture support (with backreferences returned as `result.name`), and fixes browser
 * bugs in the native `String.prototype.match`. Calling `XRegExp.install('natives')` uses this to
 * override the native method.
 *
 * @private
 * @param {RegExp|*} regex Regex to search with. If not a regex object, it is passed to `RegExp`.
 * @returns {Array} If `regex` uses flag g, an array of match strings or `null`. Without flag g,
 *   the result of calling `regex.exec(this)`.
 */
fixed.match = function(regex) {
    var result;

    if (!XRegExp.isRegExp(regex)) {
        // Use the native `RegExp` rather than `XRegExp`
        regex = new RegExp(regex);
    } else if (regex.global) {
        result = nativ.match.apply(this, arguments);
        // Fixes IE bug
        regex.lastIndex = 0;

        return result;
    }

    return fixed.exec.call(regex, toObject(this));
};

/**
 * Adds support for `${n}` tokens for named and numbered backreferences in replacement text, and
 * provides named backreferences to replacement functions as `arguments[0].name`. Also fixes browser
 * bugs in replacement text syntax when performing a replacement using a nonregex search value, and
 * the value of a replacement regex's `lastIndex` property during replacement iterations and upon
 * completion. Calling `XRegExp.install('natives')` uses this to override the native method. Note
 * that this doesn't support SpiderMonkey's proprietary third (`flags`) argument. Use via
 * `XRegExp.replace` without overriding natives.
 *
 * @private
 * @param {RegExp|String} search Search pattern to be replaced.
 * @param {String|Function} replacement Replacement string or a function invoked to create it.
 * @returns {String} New string with one or all matches replaced.
 */
fixed.replace = function(search, replacement) {
    var isRegex = XRegExp.isRegExp(search),
        origLastIndex,
        captureNames,
        result;

    if (isRegex) {
        if (search[REGEX_DATA]) {
            captureNames = search[REGEX_DATA].captureNames;
        }
        // Only needed if `search` is nonglobal
        origLastIndex = search.lastIndex;
    } else {
        search += ''; // Type-convert
    }

    // Don't use `typeof`; some older browsers return 'function' for regex objects
    if (isType(replacement, 'Function')) {
        // Stringifying `this` fixes a bug in IE < 9 where the last argument in replacement
        // functions isn't type-converted to a string
        result = nativ.replace.call(String(this), search, function() {
            var args = arguments, i;
            if (captureNames) {
                // Change the `arguments[0]` string primitive to a `String` object that can store
                // properties. This really does need to use `String` as a constructor
                args[0] = new String(args[0]);
                // Store named backreferences on the first argument
                for (i = 0; i < captureNames.length; ++i) {
                    if (captureNames[i]) {
                        args[0][captureNames[i]] = args[i + 1];
                    }
                }
            }
            // Update `lastIndex` before calling `replacement`. Fixes IE, Chrome, Firefox, Safari
            // bug (last tested IE 9, Chrome 17, Firefox 11, Safari 5.1)
            if (isRegex && search.global) {
                search.lastIndex = args[args.length - 2] + args[0].length;
            }
            // ES6 specs the context for replacement functions as `undefined`
            return replacement.apply(undefined, args);
        });
    } else {
        // Ensure that the last value of `args` will be a string when given nonstring `this`,
        // while still throwing on null or undefined context
        result = nativ.replace.call(this == null ? this : String(this), search, function() {
            // Keep this function's `arguments` available through closure
            var args = arguments;
            return nativ.replace.call(String(replacement), replacementToken, function($0, $1, $2) {
                var n;
                // Named or numbered backreference with curly braces
                if ($1) {
                    // XRegExp behavior for `${n}`:
                    // 1. Backreference to numbered capture, if `n` is an integer. Use `0` for the
                    //    entire match. Any number of leading zeros may be used.
                    // 2. Backreference to named capture `n`, if it exists and is not an integer
                    //    overridden by numbered capture. In practice, this does not overlap with
                    //    numbered capture since XRegExp does not allow named capture to use a bare
                    //    integer as the name.
                    // 3. If the name or number does not refer to an existing capturing group, it's
                    //    an error.
                    n = +$1; // Type-convert; drop leading zeros
                    if (n <= args.length - 3) {
                        return args[n] || '';
                    }
                    // Groups with the same name is an error, else would need `lastIndexOf`
                    n = captureNames ? indexOf(captureNames, $1) : -1;
                    if (n < 0) {
                        throw new SyntaxError('Backreference to undefined group ' + $0);
                    }
                    return args[n + 1] || '';
                }
                // Else, special variable or numbered backreference without curly braces
                if ($2 === '$') { // $$
                    return '$';
                }
                if ($2 === '&' || +$2 === 0) { // $&, $0 (not followed by 1-9), $00
                    return args[0];
                }
                if ($2 === '`') { // $` (left context)
                    return args[args.length - 1].slice(0, args[args.length - 2]);
                }
                if ($2 === "'") { // $' (right context)
                    return args[args.length - 1].slice(args[args.length - 2] + args[0].length);
                }
                // Else, numbered backreference without curly braces
                $2 = +$2; // Type-convert; drop leading zero
                // XRegExp behavior for `$n` and `$nn`:
                // - Backrefs end after 1 or 2 digits. Use `${..}` for more digits.
                // - `$1` is an error if no capturing groups.
                // - `$10` is an error if less than 10 capturing groups. Use `${1}0` instead.
                // - `$01` is `$1` if at least one capturing group, else it's an error.
                // - `$0` (not followed by 1-9) and `$00` are the entire match.
                // Native behavior, for comparison:
                // - Backrefs end after 1 or 2 digits. Cannot reference capturing group 100+.
                // - `$1` is a literal `$1` if no capturing groups.
                // - `$10` is `$1` followed by a literal `0` if less than 10 capturing groups.
                // - `$01` is `$1` if at least one capturing group, else it's a literal `$01`.
                // - `$0` is a literal `$0`.
                if (!isNaN($2)) {
                    if ($2 > args.length - 3) {
                        throw new SyntaxError('Backreference to undefined group ' + $0);
                    }
                    return args[$2] || '';
                }
                // `$` followed by an unsupported char is an error, unlike native JS
                throw new SyntaxError('Invalid token ' + $0);
            });
        });
    }

    if (isRegex) {
        if (search.global) {
            // Fixes IE, Safari bug (last tested IE 9, Safari 5.1)
            search.lastIndex = 0;
        } else {
            // Fixes IE, Opera bug (last tested IE 9, Opera 11.6)
            search.lastIndex = origLastIndex;
        }
    }

    return result;
};

/**
 * Fixes browser bugs in the native `String.prototype.split`. Calling `XRegExp.install('natives')`
 * uses this to override the native method. Use via `XRegExp.split` without overriding natives.
 *
 * @private
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 */
fixed.split = function(separator, limit) {
    if (!XRegExp.isRegExp(separator)) {
        // Browsers handle nonregex split correctly, so use the faster native method
        return nativ.split.apply(this, arguments);
    }

    var str = String(this),
        output = [],
        origLastIndex = separator.lastIndex,
        lastLastIndex = 0,
        lastLength;

    // Values for `limit`, per the spec:
    // If undefined: pow(2,32) - 1
    // If 0, Infinity, or NaN: 0
    // If positive number: limit = floor(limit); if (limit >= pow(2,32)) limit -= pow(2,32);
    // If negative number: pow(2,32) - floor(abs(limit))
    // If other: Type-convert, then use the above rules
    // This line fails in very strange ways for some values of `limit` in Opera 10.5-10.63, unless
    // Opera Dragonfly is open (go figure). It works in at least Opera 9.5-10.1 and 11+
    limit = (limit === undefined ? -1 : limit) >>> 0;

    XRegExp.forEach(str, separator, function(match) {
        // This condition is not the same as `if (match[0].length)`
        if ((match.index + match[0].length) > lastLastIndex) {
            output.push(str.slice(lastLastIndex, match.index));
            if (match.length > 1 && match.index < str.length) {
                Array.prototype.push.apply(output, match.slice(1));
            }
            lastLength = match[0].length;
            lastLastIndex = match.index + lastLength;
        }
    });

    if (lastLastIndex === str.length) {
        if (!nativ.test.call(separator, '') || lastLength) {
            output.push('');
        }
    } else {
        output.push(str.slice(lastLastIndex));
    }

    separator.lastIndex = origLastIndex;
    return output.length > limit ? output.slice(0, limit) : output;
};

// ==--------------------------==
// Built-in syntax/flag tokens
// ==--------------------------==

/*
 * Letter escapes that natively match literal characters: `\a`, `\A`, etc. These should be
 * SyntaxErrors but are allowed in web reality. XRegExp makes them errors for cross-browser
 * consistency and to reserve their syntax, but lets them be superseded by addons.
 */
XRegExp.addToken(
    /\\([ABCE-RTUVXYZaeg-mopqyz]|c(?![A-Za-z])|u(?![\dA-Fa-f]{4}|{[\dA-Fa-f]+})|x(?![\dA-Fa-f]{2}))/,
    function(match, scope) {
        // \B is allowed in default scope only
        if (match[1] === 'B' && scope === defaultScope) {
            return match[0];
        }
        throw new SyntaxError('Invalid escape ' + match[0]);
    },
    {
        scope: 'all',
        leadChar: '\\'
    }
);

/*
 * Unicode code point escape with curly braces: `\u{N..}`. `N..` is any one or more digit
 * hexadecimal number from 0-10FFFF, and can include leading zeros. Requires the native ES6 `u` flag
 * to support code points greater than U+FFFF. Avoids converting code points above U+FFFF to
 * surrogate pairs (which could be done without flag `u`), since that could lead to broken behavior
 * if you follow a `\u{N..}` token that references a code point above U+FFFF with a quantifier, or
 * if you use the same in a character class.
 */
XRegExp.addToken(
    /\\u{([\dA-Fa-f]+)}/,
    function(match, scope, flags) {
        var code = dec(match[1]);
        if (code > 0x10FFFF) {
            throw new SyntaxError('Invalid Unicode code point ' + match[0]);
        }
        if (code <= 0xFFFF) {
            // Converting to \uNNNN avoids needing to escape the literal character and keep it
            // separate from preceding tokens
            return '\\u' + pad4(hex(code));
        }
        // If `code` is between 0xFFFF and 0x10FFFF, require and defer to native handling
        if (hasNativeU && flags.indexOf('u') > -1) {
            return match[0];
        }
        throw new SyntaxError('Cannot use Unicode code point above \\u{FFFF} without flag u');
    },
    {
        scope: 'all',
        leadChar: '\\'
    }
);

/*
 * Empty character class: `[]` or `[^]`. This fixes a critical cross-browser syntax inconsistency.
 * Unless this is standardized (per the ES spec), regex syntax can't be accurately parsed because
 * character class endings can't be determined.
 */
XRegExp.addToken(
    /\[(\^?)\]/,
    function(match) {
        // For cross-browser compatibility with ES3, convert [] to \b\B and [^] to [\s\S].
        // (?!) should work like \b\B, but is unreliable in some versions of Firefox
        return match[1] ? '[\\s\\S]' : '\\b\\B';
    },
    {leadChar: '['}
);

/*
 * Comment pattern: `(?# )`. Inline comments are an alternative to the line comments allowed in
 * free-spacing mode (flag x).
 */
XRegExp.addToken(
    /\(\?#[^)]*\)/,
    function(match, scope, flags) {
        // Keep tokens separated unless the following token is a quantifier. This avoids e.g.
        // inadvertedly changing `\1(?#)1` to `\11`.
        return isQuantifierNext(match.input, match.index + match[0].length, flags) ?
            '' : '(?:)';
    },
    {leadChar: '('}
);

/*
 * Whitespace and line comments, in free-spacing mode (aka extended mode, flag x) only.
 */
XRegExp.addToken(
    /\s+|#[^\n]*\n?/,
    function(match, scope, flags) {
        // Keep tokens separated unless the following token is a quantifier. This avoids e.g.
        // inadvertedly changing `\1 1` to `\11`.
        return isQuantifierNext(match.input, match.index + match[0].length, flags) ?
            '' : '(?:)';
    },
    {flag: 'x'}
);

/*
 * Dot, in dotall mode (aka singleline mode, flag s) only.
 */
XRegExp.addToken(
    /\./,
    function() {
        return '[\\s\\S]';
    },
    {
        flag: 's',
        leadChar: '.'
    }
);

/*
 * Named backreference: `\k<name>`. Backreference names can use the characters A-Z, a-z, 0-9, _,
 * and $ only. Also allows numbered backreferences as `\k<n>`.
 */
XRegExp.addToken(
    /\\k<([\w$]+)>/,
    function(match) {
        // Groups with the same name is an error, else would need `lastIndexOf`
        var index = isNaN(match[1]) ? (indexOf(this.captureNames, match[1]) + 1) : +match[1],
            endIndex = match.index + match[0].length;
        if (!index || index > this.captureNames.length) {
            throw new SyntaxError('Backreference to undefined group ' + match[0]);
        }
        // Keep backreferences separate from subsequent literal numbers. This avoids e.g.
        // inadvertedly changing `(?<n>)\k<n>1` to `()\11`.
        return '\\' + index + (
            endIndex === match.input.length || isNaN(match.input.charAt(endIndex)) ?
                '' : '(?:)'
        );
    },
    {leadChar: '\\'}
);

/*
 * Numbered backreference or octal, plus any following digits: `\0`, `\11`, etc. Octals except `\0`
 * not followed by 0-9 and backreferences to unopened capture groups throw an error. Other matches
 * are returned unaltered. IE < 9 doesn't support backreferences above `\99` in regex syntax.
 */
XRegExp.addToken(
    /\\(\d+)/,
    function(match, scope) {
        if (
            !(
                scope === defaultScope &&
                /^[1-9]/.test(match[1]) &&
                +match[1] <= this.captureNames.length
            ) &&
            match[1] !== '0'
        ) {
            throw new SyntaxError('Cannot use octal escape or backreference to undefined group ' +
                match[0]);
        }
        return match[0];
    },
    {
        scope: 'all',
        leadChar: '\\'
    }
);

/*
 * Named capturing group; match the opening delimiter only: `(?<name>`. Capture names can use the
 * characters A-Z, a-z, 0-9, _, and $ only. Names can't be integers. Supports Python-style
 * `(?P<name>` as an alternate syntax to avoid issues in some older versions of Opera which natively
 * supported the Python-style syntax. Otherwise, XRegExp might treat numbered backreferences to
 * Python-style named capture as octals.
 */
XRegExp.addToken(
    /\(\?P?<([\w$]+)>/,
    function(match) {
        // Disallow bare integers as names because named backreferences are added to match arrays
        // and therefore numeric properties may lead to incorrect lookups
        if (!isNaN(match[1])) {
            throw new SyntaxError('Cannot use integer as capture name ' + match[0]);
        }
        if (match[1] === 'length' || match[1] === '__proto__') {
            throw new SyntaxError('Cannot use reserved word as capture name ' + match[0]);
        }
        if (indexOf(this.captureNames, match[1]) > -1) {
            throw new SyntaxError('Cannot use same name for multiple groups ' + match[0]);
        }
        this.captureNames.push(match[1]);
        this.hasNamedCapture = true;
        return '(';
    },
    {leadChar: '('}
);

/*
 * Capturing group; match the opening parenthesis only. Required for support of named capturing
 * groups. Also adds explicit capture mode (flag n).
 */
XRegExp.addToken(
    /\((?!\?)/,
    function(match, scope, flags) {
        if (flags.indexOf('n') > -1) {
            return '(?:';
        }
        this.captureNames.push(null);
        return '(';
    },
    {
        optionalFlags: 'n',
        leadChar: '('
    }
);

// ==--------------------------==
// Expose XRegExp
// ==--------------------------==



/*!
 * XRegExp.build
 * <xregexp.com>
 * Steven Levithan (c) 2012-2016 MIT License
 * Inspired by Lea Verou's RegExp.create <lea.verou.me>
 */





var REGEX_DATA = 'xregexp';
var subParts = /(\()(?!\?)|\\([1-9]\d*)|\\[\s\S]|\[(?:[^\\\]]|\\[\s\S])*\]/g;
var parts = XRegExp.union([/\({{([\w$]+)}}\)|{{([\w$]+)}}/, subParts], 'g');

/**
 * Strips a leading `^` and trailing unescaped `$`, if both are present.
 *
 * @private
 * @param {String} pattern Pattern to process.
 * @returns {String} Pattern with edge anchors removed.
 */
function deanchor(pattern) {
    // Allow any number of empty noncapturing groups before/after anchors, because regexes
    // built/generated by XRegExp sometimes include them
    var leadingAnchor = /^(?:\(\?:\))*\^/,
        trailingAnchor = /\$(?:\(\?:\))*$/;

    if (
        leadingAnchor.test(pattern) &&
        trailingAnchor.test(pattern) &&
        // Ensure that the trailing `$` isn't escaped
        trailingAnchor.test(pattern.replace(/\\[\s\S]/g, ''))
    ) {
        return pattern.replace(leadingAnchor, '').replace(trailingAnchor, '');
    }

    return pattern;
}

/**
 * Converts the provided value to an XRegExp. Native RegExp flags are not preserved.
 *
 * @private
 * @param {String|RegExp} value Value to convert.
 * @returns {RegExp} XRegExp object with XRegExp syntax applied.
 */
function asXRegExp(value) {
    return XRegExp.isRegExp(value) ?
        (value[REGEX_DATA] && value[REGEX_DATA].captureNames ?
            // Don't recompile, to preserve capture names
            value :
            // Recompile as XRegExp
            XRegExp(value.source)
        ) :
        // Compile string as XRegExp
        XRegExp(value);
}

/**
 * Builds regexes using named subpatterns, for readability and pattern reuse. Backreferences in
 * the outer pattern and provided subpatterns are automatically renumbered to work correctly.
 * Native flags used by provided subpatterns are ignored in favor of the `flags` argument.
 *
 * @memberOf XRegExp
 * @param {String} pattern XRegExp pattern using `{{name}}` for embedded subpatterns. Allows
 *   `({{name}})` as shorthand for `(?<name>{{name}})`. Patterns cannot be embedded within
 *   character classes.
 * @param {Object} subs Lookup object for named subpatterns. Values can be strings or regexes. A
 *   leading `^` and trailing unescaped `$` are stripped from subpatterns, if both are present.
 * @param {String} [flags] Any combination of XRegExp flags.
 * @returns {RegExp} Regex with interpolated subpatterns.
 * @example
 *
 * var time = XRegExp.build('(?x)^ {{hours}} ({{minutes}}) $', {
 *   hours: XRegExp.build('{{h12}} : | {{h24}}', {
 *     h12: /1[0-2]|0?[1-9]/,
 *     h24: /2[0-3]|[01][0-9]/
 *   }, 'x'),
 *   minutes: /^[0-5][0-9]$/
 * });
 * time.test('10:59'); // -> true
 * XRegExp.exec('10:59', time).minutes; // -> '59'
 */
XRegExp.build = function(pattern, subs, flags) {
    var inlineFlags = /^\(\?([\w$]+)\)/.exec(pattern),
        data = {},
        numCaps = 0, // 'Caps' is short for captures
        numPriorCaps,
        numOuterCaps = 0,
        outerCapsMap = [0],
        outerCapNames,
        sub,
        p;

    // Add flags within a leading mode modifier to the overall pattern's flags
    if (inlineFlags) {
        flags = flags || '';
        inlineFlags[1].replace(/./g, function(flag) {
            // Don't add duplicates
            flags += (flags.indexOf(flag) > -1 ? '' : flag);
        });
    }

    for (p in subs) {
        if (subs.hasOwnProperty(p)) {
            // Passing to XRegExp enables extended syntax and ensures independent validity,
            // lest an unescaped `(`, `)`, `[`, or trailing `\` breaks the `(?:)` wrapper. For
            // subpatterns provided as native regexes, it dies on octals and adds the property
            // used to hold extended regex instance data, for simplicity
            sub = asXRegExp(subs[p]);
            data[p] = {
                // Deanchoring allows embedding independently useful anchored regexes. If you
                // really need to keep your anchors, double them (i.e., `^^...$$`)
                pattern: deanchor(sub.source),
                names: sub[REGEX_DATA].captureNames || []
            };
        }
    }

    // Passing to XRegExp dies on octals and ensures the outer pattern is independently valid;
    // helps keep this simple. Named captures will be put back
    pattern = asXRegExp(pattern);
    outerCapNames = pattern[REGEX_DATA].captureNames || [];
    pattern = pattern.source.replace(parts, function($0, $1, $2, $3, $4) {
        var subName = $1 || $2,
            capName,
            intro,
            localCapIndex;
        // Named subpattern
        if (subName) {
            if (!data.hasOwnProperty(subName)) {
                throw new ReferenceError('Undefined property ' + $0);
            }
            // Named subpattern was wrapped in a capturing group
            if ($1) {
                capName = outerCapNames[numOuterCaps];
                outerCapsMap[++numOuterCaps] = ++numCaps;
                // If it's a named group, preserve the name. Otherwise, use the subpattern name
                // as the capture name
                intro = '(?<' + (capName || subName) + '>';
            } else {
                intro = '(?:';
            }
            numPriorCaps = numCaps;
            return intro + data[subName].pattern.replace(subParts, function(match, paren, backref) {
                // Capturing group
                if (paren) {
                    capName = data[subName].names[numCaps - numPriorCaps];
                    ++numCaps;
                    // If the current capture has a name, preserve the name
                    if (capName) {
                        return '(?<' + capName + '>';
                    }
                // Backreference
                } else if (backref) {
                    localCapIndex = +backref - 1;
                    // Rewrite the backreference
                    return data[subName].names[localCapIndex] ?
                        // Need to preserve the backreference name in case using flag `n`
                        '\\k<' + data[subName].names[localCapIndex] + '>' :
                        '\\' + (+backref + numPriorCaps);
                }
                return match;
            }) + ')';
        }
        // Capturing group
        if ($3) {
            capName = outerCapNames[numOuterCaps];
            outerCapsMap[++numOuterCaps] = ++numCaps;
            // If the current capture has a name, preserve the name
            if (capName) {
                return '(?<' + capName + '>';
            }
        // Backreference
        } else if ($4) {
            localCapIndex = +$4 - 1;
            // Rewrite the backreference
            return outerCapNames[localCapIndex] ?
                // Need to preserve the backreference name in case using flag `n`
                '\\k<' + outerCapNames[localCapIndex] + '>' :
                '\\' + outerCapsMap[+$4];
        }
        return $0;
    });

    return XRegExp(pattern, flags);
};



/*!
 * XRegExp.matchRecursive
 * <xregexp.com>
 * Steven Levithan (c) 2009-2016 MIT License
 */





/**
 * Returns a match detail object composed of the provided values.
 *
 * @private
 */
function row(name, value, start, end) {
    return {
        name: name,
        value: value,
        start: start,
        end: end
    };
}

/**
 * Returns an array of match strings between outermost left and right delimiters, or an array of
 * objects with detailed match parts and position data. An error is thrown if delimiters are
 * unbalanced within the data.
 *
 * @memberOf XRegExp
 * @param {String} str String to search.
 * @param {String} left Left delimiter as an XRegExp pattern.
 * @param {String} right Right delimiter as an XRegExp pattern.
 * @param {String} [flags] Any native or XRegExp flags, used for the left and right delimiters.
 * @param {Object} [options] Lets you specify `valueNames` and `escapeChar` options.
 * @returns {Array} Array of matches, or an empty array.
 * @example
 *
 * // Basic usage
 * var str = '(t((e))s)t()(ing)';
 * XRegExp.matchRecursive(str, '\\(', '\\)', 'g');
 * // -> ['t((e))s', '', 'ing']
 *
 * // Extended information mode with valueNames
 * str = 'Here is <div> <div>an</div></div> example';
 * XRegExp.matchRecursive(str, '<div\\s*>', '</div>', 'gi', {
 *   valueNames: ['between', 'left', 'match', 'right']
 * });
 * // -> [
 * // {name: 'between', value: 'Here is ',       start: 0,  end: 8},
 * // {name: 'left',    value: '<div>',          start: 8,  end: 13},
 * // {name: 'match',   value: ' <div>an</div>', start: 13, end: 27},
 * // {name: 'right',   value: '</div>',         start: 27, end: 33},
 * // {name: 'between', value: ' example',       start: 33, end: 41}
 * // ]
 *
 * // Omitting unneeded parts with null valueNames, and using escapeChar
 * str = '...{1}.\\{{function(x,y){return {y:x}}}';
 * XRegExp.matchRecursive(str, '{', '}', 'g', {
 *   valueNames: ['literal', null, 'value', null],
 *   escapeChar: '\\'
 * });
 * // -> [
 * // {name: 'literal', value: '...',  start: 0, end: 3},
 * // {name: 'value',   value: '1',    start: 4, end: 5},
 * // {name: 'literal', value: '.\\{', start: 6, end: 9},
 * // {name: 'value',   value: 'function(x,y){return {y:x}}', start: 10, end: 37}
 * // ]
 *
 * // Sticky mode via flag y
 * str = '<1><<<2>>><3>4<5>';
 * XRegExp.matchRecursive(str, '<', '>', 'gy');
 * // -> ['1', '<<2>>', '3']
 */
XRegExp.matchRecursive = function(str, left, right, flags, options) {
    flags = flags || '';
    options = options || {};
    var global = flags.indexOf('g') > -1,
        sticky = flags.indexOf('y') > -1,
        // Flag `y` is controlled internally
        basicFlags = flags.replace(/y/g, ''),
        escapeChar = options.escapeChar,
        vN = options.valueNames,
        output = [],
        openTokens = 0,
        delimStart = 0,
        delimEnd = 0,
        lastOuterEnd = 0,
        outerStart,
        innerStart,
        leftMatch,
        rightMatch,
        esc;
    left = XRegExp(left, basicFlags);
    right = XRegExp(right, basicFlags);

    if (escapeChar) {
        if (escapeChar.length > 1) {
            throw new Error('Cannot use more than one escape character');
        }
        escapeChar = XRegExp.escape(escapeChar);
        // Using `XRegExp.union` safely rewrites backreferences in `left` and `right`
        esc = new RegExp(
            '(?:' + escapeChar + '[\\S\\s]|(?:(?!' +
                XRegExp.union([left, right]).source +
                ')[^' + escapeChar + '])+)+',
            // Flags `gy` not needed here
            flags.replace(/[^imu]+/g, '')
        );
    }

    while (true) {
        // If using an escape character, advance to the delimiter's next starting position,
        // skipping any escaped characters in between
        if (escapeChar) {
            delimEnd += (XRegExp.exec(str, esc, delimEnd, 'sticky') || [''])[0].length;
        }
        leftMatch = XRegExp.exec(str, left, delimEnd);
        rightMatch = XRegExp.exec(str, right, delimEnd);
        // Keep the leftmost match only
        if (leftMatch && rightMatch) {
            if (leftMatch.index <= rightMatch.index) {
                rightMatch = null;
            } else {
                leftMatch = null;
            }
        }
        // Paths (LM: leftMatch, RM: rightMatch, OT: openTokens):
        // LM | RM | OT | Result
        // 1  | 0  | 1  | loop
        // 1  | 0  | 0  | loop
        // 0  | 1  | 1  | loop
        // 0  | 1  | 0  | throw
        // 0  | 0  | 1  | throw
        // 0  | 0  | 0  | break
        // The paths above don't include the sticky mode special case. The loop ends after the
        // first completed match if not `global`.
        if (leftMatch || rightMatch) {
            delimStart = (leftMatch || rightMatch).index;
            delimEnd = delimStart + (leftMatch || rightMatch)[0].length;
        } else if (!openTokens) {
            break;
        }
        if (sticky && !openTokens && delimStart > lastOuterEnd) {
            break;
        }
        if (leftMatch) {
            if (!openTokens) {
                outerStart = delimStart;
                innerStart = delimEnd;
            }
            ++openTokens;
        } else if (rightMatch && openTokens) {
            if (!--openTokens) {
                if (vN) {
                    if (vN[0] && outerStart > lastOuterEnd) {
                        output.push(row(vN[0], str.slice(lastOuterEnd, outerStart), lastOuterEnd, outerStart));
                    }
                    if (vN[1]) {
                        output.push(row(vN[1], str.slice(outerStart, innerStart), outerStart, innerStart));
                    }
                    if (vN[2]) {
                        output.push(row(vN[2], str.slice(innerStart, delimStart), innerStart, delimStart));
                    }
                    if (vN[3]) {
                        output.push(row(vN[3], str.slice(delimStart, delimEnd), delimStart, delimEnd));
                    }
                } else {
                    output.push(str.slice(innerStart, delimStart));
                }
                lastOuterEnd = delimEnd;
                if (!global) {
                    break;
                }
            }
        } else {
            throw new Error('Unbalanced delimiter found in string');
        }
        // If the delimiter matched an empty string, avoid an infinite loop
        if (delimStart === delimEnd) {
            ++delimEnd;
        }
    }

    if (global && !sticky && vN && vN[0] && str.length > lastOuterEnd) {
        output.push(row(vN[0], str.slice(lastOuterEnd), lastOuterEnd, str.length));
    }

    return output;
};



/*!
 * XRegExp Unicode Base 
 * <xregexp.com>
 * Steven Levithan (c) 2008-2016 MIT License
 */





/**
 * Adds base support for Unicode matching:
 * - Adds syntax `\p{..}` for matching Unicode tokens. Tokens can be inverted using `\P{..}` or
 *   `\p{^..}`. Token names ignore case, spaces, hyphens, and underscores. You can omit the
 *   braces for token names that are a single letter (e.g. `\pL` or `PL`).
 * - Adds flag A (astral), which enables 21-bit Unicode support.
 * - Adds the `XRegExp.addUnicodeData` method used by other addons to provide character data.
 *
 * Unicode Base relies on externally provided Unicode character data. Official addons are
 * available to provide data for Unicode categories, scripts, blocks, and properties.
 *
 * @requires XRegExp
 */

// ==--------------------------==
// Private stuff
// ==--------------------------==

// Storage for Unicode data
var unicode = {};

// Reuse utils
var dec = XRegExp._dec;
var hex = XRegExp._hex;
var pad4 = XRegExp._pad4;

// Generates a token lookup name: lowercase, with hyphens, spaces, and underscores removed
function normalize(name) {
    return name.replace(/[- _]+/g, '').toLowerCase();
}

// Gets the decimal code of a literal code unit, \xHH, \uHHHH, or a backslash-escaped literal
function charCode(chr) {
    var esc = /^\\[xu](.+)/.exec(chr);
    return esc ?
        dec(esc[1]) :
        chr.charCodeAt(chr.charAt(0) === '\\' ? 1 : 0);
}

// Inverts a list of ordered BMP characters and ranges
function invertBmp(range) {
    var output = '',
        lastEnd = -1;
    XRegExp.forEach(
        range, 
        /(\\x..|\\u....|\\?[\s\S])(?:-(\\x..|\\u....|\\?[\s\S]))?/, 
        function(m) {
            var start = charCode(m[1]);
            if (start > lastEnd + 1) {
                output += '\\u' + pad4(hex(lastEnd + 1));
                if (start > lastEnd + 2) {
                    output += '-\\u' + pad4(hex(start - 1));
                }
            }
            lastEnd = charCode(m[2] || m[1]);
        }
);
    if (lastEnd < 0xFFFF) {
        output += '\\u' + pad4(hex(lastEnd + 1));
        if (lastEnd < 0xFFFE) {
            output += '-\\uFFFF';
        }
    }
    return output;
}

// Generates an inverted BMP range on first use
function cacheInvertedBmp(slug) {
    var prop = 'b!';
    return unicode[slug][prop] || (
        unicode[slug][prop] = invertBmp(unicode[slug].bmp)
    );
}

// Combines and optionally negates BMP and astral data
function buildAstral(slug, isNegated) {
    var item = unicode[slug],
        combined = '';
    if (item.bmp && !item.isBmpLast) {
        combined = '[' + item.bmp + ']' + (item.astral ? '|' : '');
    }
    if (item.astral) {
        combined += item.astral;
    }
    if (item.isBmpLast && item.bmp) {
        combined += (item.astral ? '|' : '') + '[' + item.bmp + ']';
    }
    // Astral Unicode tokens always match a code point, never a code unit
    return isNegated ?
        '(?:(?!' + combined + ')(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\0-\uFFFF]))' :
        '(?:' + combined + ')';
}

// Builds a complete astral pattern on first use
function cacheAstral(slug, isNegated) {
    var prop = isNegated ? 'a!' : 'a=';
    return unicode[slug][prop] || (
        unicode[slug][prop] = buildAstral(slug, isNegated)
    );
}

// ==--------------------------==
// Core functionality
// ==--------------------------==

/*
 * Add Unicode token syntax: `\p{..}`, `\P{..}`, `\p{^..}`, `\pC`. Also add astral mode (flag A).
 */
XRegExp.addToken(
    // Use `*` instead of `+` to avoid capturing `^` as the token name in `\p{^}`
    /\\([pP])(?:{(\^?)([^}]*)}|([A-Za-z]))/,
    function(match, scope, flags) {
        var ERR_DOUBLE_NEG = 'Invalid double negation ',
            ERR_UNKNOWN_NAME = 'Unknown Unicode token ',
            ERR_UNKNOWN_REF = 'Unicode token missing data ',
            ERR_ASTRAL_ONLY = 'Astral mode required for Unicode token ',
            ERR_ASTRAL_IN_CLASS = 'Astral mode does not support Unicode tokens within character classes',
            // Negated via \P{..} or \p{^..}
            isNegated = match[1] === 'P' || !!match[2],
            // Switch from BMP (0-FFFF) to astral (0-10FFFF) mode via flag A
            isAstralMode = flags.indexOf('A') > -1,
            // Token lookup name. Check `[4]` first to avoid passing `undefined` via `\p{}`
            slug = normalize(match[4] || match[3]),
            // Token data object
            item = unicode[slug];

        if (match[1] === 'P' && match[2]) {
            throw new SyntaxError(ERR_DOUBLE_NEG + match[0]);
        }
        if (!unicode.hasOwnProperty(slug)) {
            throw new SyntaxError(ERR_UNKNOWN_NAME + match[0]);
        }

        // Switch to the negated form of the referenced Unicode token
        if (item.inverseOf) {
            slug = normalize(item.inverseOf);
            if (!unicode.hasOwnProperty(slug)) {
                throw new ReferenceError(ERR_UNKNOWN_REF + match[0] + ' -> ' + item.inverseOf);
            }
            item = unicode[slug];
            isNegated = !isNegated;
        }

        if (!(item.bmp || isAstralMode)) {
            throw new SyntaxError(ERR_ASTRAL_ONLY + match[0]);
        }
        if (isAstralMode) {
            if (scope === 'class') {
                throw new SyntaxError(ERR_ASTRAL_IN_CLASS);
            }

            return cacheAstral(slug, isNegated);
        }

        return scope === 'class' ?
            (isNegated ? cacheInvertedBmp(slug) : item.bmp) :
            (isNegated ? '[^' : '[') + item.bmp + ']';
    },
    {
        scope: 'all',
        optionalFlags: 'A',
        leadChar: '\\'
    }
);

/**
 * Adds to the list of Unicode tokens that XRegExp regexes can match via `\p` or `\P`.
 *
 * @memberOf XRegExp
 * @param {Array} data Objects with named character ranges. Each object may have properties
 *   `name`, `alias`, `isBmpLast`, `inverseOf`, `bmp`, and `astral`. All but `name` are
 *   optional, although one of `bmp` or `astral` is required (unless `inverseOf` is set). If
 *   `astral` is absent, the `bmp` data is used for BMP and astral modes. If `bmp` is absent,
 *   the name errors in BMP mode but works in astral mode. If both `bmp` and `astral` are
 *   provided, the `bmp` data only is used in BMP mode, and the combination of `bmp` and
 *   `astral` data is used in astral mode. `isBmpLast` is needed when a token matches orphan
 *   high surrogates *and* uses surrogate pairs to match astral code points. The `bmp` and
 *   `astral` data should be a combination of literal characters and `\xHH` or `\uHHHH` escape
 *   sequences, with hyphens to create ranges. Any regex metacharacters in the data should be
 *   escaped, apart from range-creating hyphens. The `astral` data can additionally use
 *   character classes and alternation, and should use surrogate pairs to represent astral code
 *   points. `inverseOf` can be used to avoid duplicating character data if a Unicode token is
 *   defined as the exact inverse of another token.
 * @example
 *
 * // Basic use
 * XRegExp.addUnicodeData([{
 *   name: 'XDigit',
 *   alias: 'Hexadecimal',
 *   bmp: '0-9A-Fa-f'
 * }]);
 * XRegExp('\\p{XDigit}:\\p{Hexadecimal}+').test('0:3D'); // -> true
 */
XRegExp.addUnicodeData = function(data) {
    var ERR_NO_NAME = 'Unicode token requires name',
        ERR_NO_DATA = 'Unicode token has no character data ',
        item,
        i;

    for (i = 0; i < data.length; ++i) {
        item = data[i];
        if (!item.name) {
            throw new Error(ERR_NO_NAME);
        }
        if (!(item.inverseOf || item.bmp || item.astral)) {
            throw new Error(ERR_NO_DATA + item.name);
        }
        unicode[normalize(item.name)] = item;
        if (item.alias) {
            unicode[normalize(item.alias)] = item;
        }
    }

    // Reset the pattern cache used by the `XRegExp` constructor, since the same pattern and
    // flags might now produce different results
    XRegExp.cache.flush('patterns');
};

/**
 * @ignore
 *
 * Return a reference to the internal Unicode definition structure for the given Unicode Property 
 * if the given name is a legal Unicode Property for use in XRegExp `\p` or `\P` regex constructs.
 *
 * @memberOf XRegExp
 * @param {String} name Name by which the Unicode Property may be recognized (case-insensitive),
 *   e.g. `'N'` or `'Number'`.
 *   
 *   The given name is matched against all registered Unicode Properties and Property Aliases.
 *
 * @return {Object} Reference to definition structure when the name matches a Unicode Property; 
 * `false` when the name does not match *any* Unicode Property or Property Alias. 
 *
 * @note
 * For more info on Unicode Properties, see also http://unicode.org/reports/tr18/#Categories. 
 *
 * @note
 * This method is *not* part of the officially documented and published API and is meant 'for
 * advanced use only' where userland code wishes to re-use the (large) internal Unicode 
 * structures set up by XRegExp as a single point of Unicode 'knowledge' in the application.
 *
 * See some example usage of this functionality, used as a boolean check if the given name 
 * is legal and to obtain internal structural data:
 * - `function prepareMacros(...)` in https://github.com/GerHobbelt/jison-lex/blob/master/regexp-lexer.js#L885  
 * - `function generateRegexesInitTableCode(...)` in https://github.com/GerHobbelt/jison-lex/blob/master/regexp-lexer.js#L1999
 *
 * Note that the second function in the example (`function generateRegexesInitTableCode(...)`) 
 * uses a approach without using this API to obtain a Unicode range spanning regex for use in environments
 * which do not support XRegExp by simply expanding the XRegExp instance to a String through
 * the `map()` mapping action and subsequent `join()`.
 */
XRegExp._getUnicodeProperty = function(name) {
    var slug = normalize(name);
    return unicode[slug] || false;
};



/*!
 * XRegExp Unicode Blocks 
 * <xregexp.com>
 * Steven Levithan (c) 2010-2016 MIT License
 * Unicode data by Mathias Bynens <mathiasbynens.be>
 */





/**
 * Adds support for all Unicode blocks. Block names use the prefix 'In'. E.g.,
 * `\p{InBasicLatin}`. Token names are case insensitive, and any spaces, hyphens, and
 * underscores are ignored.
 *
 * Uses Unicode 8.0.0.
 *
 * @requires XRegExp, Unicode Base
 */

if (!XRegExp.addUnicodeData) {
    throw new ReferenceError('Unicode Base must be loaded before Unicode Blocks');
}

XRegExp.addUnicodeData([
    {
        name: 'InAegean_Numbers',
        astral: '\uD800[\uDD00-\uDD3F]'
    },
    {
        name: 'InAhom',
        astral: '\uD805[\uDF00-\uDF3F]'
    },
    {
        name: 'InAlchemical_Symbols',
        astral: '\uD83D[\uDF00-\uDF7F]'
    },
    {
        name: 'InAlphabetic_Presentation_Forms',
        bmp: '\uFB00-\uFB4F'
    },
    {
        name: 'InAnatolian_Hieroglyphs',
        astral: '\uD811[\uDC00-\uDE7F]'
    },
    {
        name: 'InAncient_Greek_Musical_Notation',
        astral: '\uD834[\uDE00-\uDE4F]'
    },
    {
        name: 'InAncient_Greek_Numbers',
        astral: '\uD800[\uDD40-\uDD8F]'
    },
    {
        name: 'InAncient_Symbols',
        astral: '\uD800[\uDD90-\uDDCF]'
    },
    {
        name: 'InArabic',
        bmp: '\u0600-\u06FF'
    },
    {
        name: 'InArabic_Extended_A',
        bmp: '\u08A0-\u08FF'
    },
    {
        name: 'InArabic_Mathematical_Alphabetic_Symbols',
        astral: '\uD83B[\uDE00-\uDEFF]'
    },
    {
        name: 'InArabic_Presentation_Forms_A',
        bmp: '\uFB50-\uFDFF'
    },
    {
        name: 'InArabic_Presentation_Forms_B',
        bmp: '\uFE70-\uFEFF'
    },
    {
        name: 'InArabic_Supplement',
        bmp: '\u0750-\u077F'
    },
    {
        name: 'InArmenian',
        bmp: '\u0530-\u058F'
    },
    {
        name: 'InArrows',
        bmp: '\u2190-\u21FF'
    },
    {
        name: 'InAvestan',
        astral: '\uD802[\uDF00-\uDF3F]'
    },
    {
        name: 'InBalinese',
        bmp: '\u1B00-\u1B7F'
    },
    {
        name: 'InBamum',
        bmp: '\uA6A0-\uA6FF'
    },
    {
        name: 'InBamum_Supplement',
        astral: '\uD81A[\uDC00-\uDE3F]'
    },
    {
        name: 'InBasic_Latin',
        bmp: '\0-\x7F'
    },
    {
        name: 'InBassa_Vah',
        astral: '\uD81A[\uDED0-\uDEFF]'
    },
    {
        name: 'InBatak',
        bmp: '\u1BC0-\u1BFF'
    },
    {
        name: 'InBengali',
        bmp: '\u0980-\u09FF'
    },
    {
        name: 'InBlock_Elements',
        bmp: '\u2580-\u259F'
    },
    {
        name: 'InBopomofo',
        bmp: '\u3100-\u312F'
    },
    {
        name: 'InBopomofo_Extended',
        bmp: '\u31A0-\u31BF'
    },
    {
        name: 'InBox_Drawing',
        bmp: '\u2500-\u257F'
    },
    {
        name: 'InBrahmi',
        astral: '\uD804[\uDC00-\uDC7F]'
    },
    {
        name: 'InBraille_Patterns',
        bmp: '\u2800-\u28FF'
    },
    {
        name: 'InBuginese',
        bmp: '\u1A00-\u1A1F'
    },
    {
        name: 'InBuhid',
        bmp: '\u1740-\u175F'
    },
    {
        name: 'InByzantine_Musical_Symbols',
        astral: '\uD834[\uDC00-\uDCFF]'
    },
    {
        name: 'InCJK_Compatibility',
        bmp: '\u3300-\u33FF'
    },
    {
        name: 'InCJK_Compatibility_Forms',
        bmp: '\uFE30-\uFE4F'
    },
    {
        name: 'InCJK_Compatibility_Ideographs',
        bmp: '\uF900-\uFAFF'
    },
    {
        name: 'InCJK_Compatibility_Ideographs_Supplement',
        astral: '\uD87E[\uDC00-\uDE1F]'
    },
    {
        name: 'InCJK_Radicals_Supplement',
        bmp: '\u2E80-\u2EFF'
    },
    {
        name: 'InCJK_Strokes',
        bmp: '\u31C0-\u31EF'
    },
    {
        name: 'InCJK_Symbols_and_Punctuation',
        bmp: '\u3000-\u303F'
    },
    {
        name: 'InCJK_Unified_Ideographs',
        bmp: '\u4E00-\u9FFF'
    },
    {
        name: 'InCJK_Unified_Ideographs_Extension_A',
        bmp: '\u3400-\u4DBF'
    },
    {
        name: 'InCJK_Unified_Ideographs_Extension_B',
        astral: '[\uD840-\uD868][\uDC00-\uDFFF]|\uD869[\uDC00-\uDEDF]'
    },
    {
        name: 'InCJK_Unified_Ideographs_Extension_C',
        astral: '\uD86D[\uDC00-\uDF3F]|[\uD86A-\uD86C][\uDC00-\uDFFF]|\uD869[\uDF00-\uDFFF]'
    },
    {
        name: 'InCJK_Unified_Ideographs_Extension_D',
        astral: '\uD86D[\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1F]'
    },
    {
        name: 'InCJK_Unified_Ideographs_Extension_E',
        astral: '[\uD86F-\uD872][\uDC00-\uDFFF]|\uD873[\uDC00-\uDEAF]|\uD86E[\uDC20-\uDFFF]'
    },
    {
        name: 'InCarian',
        astral: '\uD800[\uDEA0-\uDEDF]'
    },
    {
        name: 'InCaucasian_Albanian',
        astral: '\uD801[\uDD30-\uDD6F]'
    },
    {
        name: 'InChakma',
        astral: '\uD804[\uDD00-\uDD4F]'
    },
    {
        name: 'InCham',
        bmp: '\uAA00-\uAA5F'
    },
    {
        name: 'InCherokee',
        bmp: '\u13A0-\u13FF'
    },
    {
        name: 'InCherokee_Supplement',
        bmp: '\uAB70-\uABBF'
    },
    {
        name: 'InCombining_Diacritical_Marks',
        bmp: '\u0300-\u036F'
    },
    {
        name: 'InCombining_Diacritical_Marks_Extended',
        bmp: '\u1AB0-\u1AFF'
    },
    {
        name: 'InCombining_Diacritical_Marks_Supplement',
        bmp: '\u1DC0-\u1DFF'
    },
    {
        name: 'InCombining_Diacritical_Marks_for_Symbols',
        bmp: '\u20D0-\u20FF'
    },
    {
        name: 'InCombining_Half_Marks',
        bmp: '\uFE20-\uFE2F'
    },
    {
        name: 'InCommon_Indic_Number_Forms',
        bmp: '\uA830-\uA83F'
    },
    {
        name: 'InControl_Pictures',
        bmp: '\u2400-\u243F'
    },
    {
        name: 'InCoptic',
        bmp: '\u2C80-\u2CFF'
    },
    {
        name: 'InCoptic_Epact_Numbers',
        astral: '\uD800[\uDEE0-\uDEFF]'
    },
    {
        name: 'InCounting_Rod_Numerals',
        astral: '\uD834[\uDF60-\uDF7F]'
    },
    {
        name: 'InCuneiform',
        astral: '\uD808[\uDC00-\uDFFF]'
    },
    {
        name: 'InCuneiform_Numbers_and_Punctuation',
        astral: '\uD809[\uDC00-\uDC7F]'
    },
    {
        name: 'InCurrency_Symbols',
        bmp: '\u20A0-\u20CF'
    },
    {
        name: 'InCypriot_Syllabary',
        astral: '\uD802[\uDC00-\uDC3F]'
    },
    {
        name: 'InCyrillic',
        bmp: '\u0400-\u04FF'
    },
    {
        name: 'InCyrillic_Extended_A',
        bmp: '\u2DE0-\u2DFF'
    },
    {
        name: 'InCyrillic_Extended_B',
        bmp: '\uA640-\uA69F'
    },
    {
        name: 'InCyrillic_Supplement',
        bmp: '\u0500-\u052F'
    },
    {
        name: 'InDeseret',
        astral: '\uD801[\uDC00-\uDC4F]'
    },
    {
        name: 'InDevanagari',
        bmp: '\u0900-\u097F'
    },
    {
        name: 'InDevanagari_Extended',
        bmp: '\uA8E0-\uA8FF'
    },
    {
        name: 'InDingbats',
        bmp: '\u2700-\u27BF'
    },
    {
        name: 'InDomino_Tiles',
        astral: '\uD83C[\uDC30-\uDC9F]'
    },
    {
        name: 'InDuployan',
        astral: '\uD82F[\uDC00-\uDC9F]'
    },
    {
        name: 'InEarly_Dynastic_Cuneiform',
        astral: '\uD809[\uDC80-\uDD4F]'
    },
    {
        name: 'InEgyptian_Hieroglyphs',
        astral: '\uD80C[\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2F]'
    },
    {
        name: 'InElbasan',
        astral: '\uD801[\uDD00-\uDD2F]'
    },
    {
        name: 'InEmoticons',
        astral: '\uD83D[\uDE00-\uDE4F]'
    },
    {
        name: 'InEnclosed_Alphanumeric_Supplement',
        astral: '\uD83C[\uDD00-\uDDFF]'
    },
    {
        name: 'InEnclosed_Alphanumerics',
        bmp: '\u2460-\u24FF'
    },
    {
        name: 'InEnclosed_CJK_Letters_and_Months',
        bmp: '\u3200-\u32FF'
    },
    {
        name: 'InEnclosed_Ideographic_Supplement',
        astral: '\uD83C[\uDE00-\uDEFF]'
    },
    {
        name: 'InEthiopic',
        bmp: '\u1200-\u137F'
    },
    {
        name: 'InEthiopic_Extended',
        bmp: '\u2D80-\u2DDF'
    },
    {
        name: 'InEthiopic_Extended_A',
        bmp: '\uAB00-\uAB2F'
    },
    {
        name: 'InEthiopic_Supplement',
        bmp: '\u1380-\u139F'
    },
    {
        name: 'InGeneral_Punctuation',
        bmp: '\u2000-\u206F'
    },
    {
        name: 'InGeometric_Shapes',
        bmp: '\u25A0-\u25FF'
    },
    {
        name: 'InGeometric_Shapes_Extended',
        astral: '\uD83D[\uDF80-\uDFFF]'
    },
    {
        name: 'InGeorgian',
        bmp: '\u10A0-\u10FF'
    },
    {
        name: 'InGeorgian_Supplement',
        bmp: '\u2D00-\u2D2F'
    },
    {
        name: 'InGlagolitic',
        bmp: '\u2C00-\u2C5F'
    },
    {
        name: 'InGothic',
        astral: '\uD800[\uDF30-\uDF4F]'
    },
    {
        name: 'InGrantha',
        astral: '\uD804[\uDF00-\uDF7F]'
    },
    {
        name: 'InGreek_Extended',
        bmp: '\u1F00-\u1FFF'
    },
    {
        name: 'InGreek_and_Coptic',
        bmp: '\u0370-\u03FF'
    },
    {
        name: 'InGujarati',
        bmp: '\u0A80-\u0AFF'
    },
    {
        name: 'InGurmukhi',
        bmp: '\u0A00-\u0A7F'
    },
    {
        name: 'InHalfwidth_and_Fullwidth_Forms',
        bmp: '\uFF00-\uFFEF'
    },
    {
        name: 'InHangul_Compatibility_Jamo',
        bmp: '\u3130-\u318F'
    },
    {
        name: 'InHangul_Jamo',
        bmp: '\u1100-\u11FF'
    },
    {
        name: 'InHangul_Jamo_Extended_A',
        bmp: '\uA960-\uA97F'
    },
    {
        name: 'InHangul_Jamo_Extended_B',
        bmp: '\uD7B0-\uD7FF'
    },
    {
        name: 'InHangul_Syllables',
        bmp: '\uAC00-\uD7AF'
    },
    {
        name: 'InHanunoo',
        bmp: '\u1720-\u173F'
    },
    {
        name: 'InHatran',
        astral: '\uD802[\uDCE0-\uDCFF]'
    },
    {
        name: 'InHebrew',
        bmp: '\u0590-\u05FF'
    },
    {
        name: 'InHigh_Private_Use_Surrogates',
        bmp: '\uDB80-\uDBFF'
    },
    {
        name: 'InHigh_Surrogates',
        bmp: '\uD800-\uDB7F'
    },
    {
        name: 'InHiragana',
        bmp: '\u3040-\u309F'
    },
    {
        name: 'InIPA_Extensions',
        bmp: '\u0250-\u02AF'
    },
    {
        name: 'InIdeographic_Description_Characters',
        bmp: '\u2FF0-\u2FFF'
    },
    {
        name: 'InImperial_Aramaic',
        astral: '\uD802[\uDC40-\uDC5F]'
    },
    {
        name: 'InInscriptional_Pahlavi',
        astral: '\uD802[\uDF60-\uDF7F]'
    },
    {
        name: 'InInscriptional_Parthian',
        astral: '\uD802[\uDF40-\uDF5F]'
    },
    {
        name: 'InJavanese',
        bmp: '\uA980-\uA9DF'
    },
    {
        name: 'InKaithi',
        astral: '\uD804[\uDC80-\uDCCF]'
    },
    {
        name: 'InKana_Supplement',
        astral: '\uD82C[\uDC00-\uDCFF]'
    },
    {
        name: 'InKanbun',
        bmp: '\u3190-\u319F'
    },
    {
        name: 'InKangxi_Radicals',
        bmp: '\u2F00-\u2FDF'
    },
    {
        name: 'InKannada',
        bmp: '\u0C80-\u0CFF'
    },
    {
        name: 'InKatakana',
        bmp: '\u30A0-\u30FF'
    },
    {
        name: 'InKatakana_Phonetic_Extensions',
        bmp: '\u31F0-\u31FF'
    },
    {
        name: 'InKayah_Li',
        bmp: '\uA900-\uA92F'
    },
    {
        name: 'InKharoshthi',
        astral: '\uD802[\uDE00-\uDE5F]'
    },
    {
        name: 'InKhmer',
        bmp: '\u1780-\u17FF'
    },
    {
        name: 'InKhmer_Symbols',
        bmp: '\u19E0-\u19FF'
    },
    {
        name: 'InKhojki',
        astral: '\uD804[\uDE00-\uDE4F]'
    },
    {
        name: 'InKhudawadi',
        astral: '\uD804[\uDEB0-\uDEFF]'
    },
    {
        name: 'InLao',
        bmp: '\u0E80-\u0EFF'
    },
    {
        name: 'InLatin_Extended_Additional',
        bmp: '\u1E00-\u1EFF'
    },
    {
        name: 'InLatin_Extended_A',
        bmp: '\u0100-\u017F'
    },
    {
        name: 'InLatin_Extended_B',
        bmp: '\u0180-\u024F'
    },
    {
        name: 'InLatin_Extended_C',
        bmp: '\u2C60-\u2C7F'
    },
    {
        name: 'InLatin_Extended_D',
        bmp: '\uA720-\uA7FF'
    },
    {
        name: 'InLatin_Extended_E',
        bmp: '\uAB30-\uAB6F'
    },
    {
        name: 'InLatin_1_Supplement',
        bmp: '\x80-\xFF'
    },
    {
        name: 'InLepcha',
        bmp: '\u1C00-\u1C4F'
    },
    {
        name: 'InLetterlike_Symbols',
        bmp: '\u2100-\u214F'
    },
    {
        name: 'InLimbu',
        bmp: '\u1900-\u194F'
    },
    {
        name: 'InLinear_A',
        astral: '\uD801[\uDE00-\uDF7F]'
    },
    {
        name: 'InLinear_B_Ideograms',
        astral: '\uD800[\uDC80-\uDCFF]'
    },
    {
        name: 'InLinear_B_Syllabary',
        astral: '\uD800[\uDC00-\uDC7F]'
    },
    {
        name: 'InLisu',
        bmp: '\uA4D0-\uA4FF'
    },
    {
        name: 'InLow_Surrogates',
        bmp: '\uDC00-\uDFFF'
    },
    {
        name: 'InLycian',
        astral: '\uD800[\uDE80-\uDE9F]'
    },
    {
        name: 'InLydian',
        astral: '\uD802[\uDD20-\uDD3F]'
    },
    {
        name: 'InMahajani',
        astral: '\uD804[\uDD50-\uDD7F]'
    },
    {
        name: 'InMahjong_Tiles',
        astral: '\uD83C[\uDC00-\uDC2F]'
    },
    {
        name: 'InMalayalam',
        bmp: '\u0D00-\u0D7F'
    },
    {
        name: 'InMandaic',
        bmp: '\u0840-\u085F'
    },
    {
        name: 'InManichaean',
        astral: '\uD802[\uDEC0-\uDEFF]'
    },
    {
        name: 'InMathematical_Alphanumeric_Symbols',
        astral: '\uD835[\uDC00-\uDFFF]'
    },
    {
        name: 'InMathematical_Operators',
        bmp: '\u2200-\u22FF'
    },
    {
        name: 'InMeetei_Mayek',
        bmp: '\uABC0-\uABFF'
    },
    {
        name: 'InMeetei_Mayek_Extensions',
        bmp: '\uAAE0-\uAAFF'
    },
    {
        name: 'InMende_Kikakui',
        astral: '\uD83A[\uDC00-\uDCDF]'
    },
    {
        name: 'InMeroitic_Cursive',
        astral: '\uD802[\uDDA0-\uDDFF]'
    },
    {
        name: 'InMeroitic_Hieroglyphs',
        astral: '\uD802[\uDD80-\uDD9F]'
    },
    {
        name: 'InMiao',
        astral: '\uD81B[\uDF00-\uDF9F]'
    },
    {
        name: 'InMiscellaneous_Mathematical_Symbols_A',
        bmp: '\u27C0-\u27EF'
    },
    {
        name: 'InMiscellaneous_Mathematical_Symbols_B',
        bmp: '\u2980-\u29FF'
    },
    {
        name: 'InMiscellaneous_Symbols',
        bmp: '\u2600-\u26FF'
    },
    {
        name: 'InMiscellaneous_Symbols_and_Arrows',
        bmp: '\u2B00-\u2BFF'
    },
    {
        name: 'InMiscellaneous_Symbols_and_Pictographs',
        astral: '\uD83D[\uDC00-\uDDFF]|\uD83C[\uDF00-\uDFFF]'
    },
    {
        name: 'InMiscellaneous_Technical',
        bmp: '\u2300-\u23FF'
    },
    {
        name: 'InModi',
        astral: '\uD805[\uDE00-\uDE5F]'
    },
    {
        name: 'InModifier_Tone_Letters',
        bmp: '\uA700-\uA71F'
    },
    {
        name: 'InMongolian',
        bmp: '\u1800-\u18AF'
    },
    {
        name: 'InMro',
        astral: '\uD81A[\uDE40-\uDE6F]'
    },
    {
        name: 'InMultani',
        astral: '\uD804[\uDE80-\uDEAF]'
    },
    {
        name: 'InMusical_Symbols',
        astral: '\uD834[\uDD00-\uDDFF]'
    },
    {
        name: 'InMyanmar',
        bmp: '\u1000-\u109F'
    },
    {
        name: 'InMyanmar_Extended_A',
        bmp: '\uAA60-\uAA7F'
    },
    {
        name: 'InMyanmar_Extended_B',
        bmp: '\uA9E0-\uA9FF'
    },
    {
        name: 'InNKo',
        bmp: '\u07C0-\u07FF'
    },
    {
        name: 'InNabataean',
        astral: '\uD802[\uDC80-\uDCAF]'
    },
    {
        name: 'InNew_Tai_Lue',
        bmp: '\u1980-\u19DF'
    },
    {
        name: 'InNumber_Forms',
        bmp: '\u2150-\u218F'
    },
    {
        name: 'InOgham',
        bmp: '\u1680-\u169F'
    },
    {
        name: 'InOl_Chiki',
        bmp: '\u1C50-\u1C7F'
    },
    {
        name: 'InOld_Hungarian',
        astral: '\uD803[\uDC80-\uDCFF]'
    },
    {
        name: 'InOld_Italic',
        astral: '\uD800[\uDF00-\uDF2F]'
    },
    {
        name: 'InOld_North_Arabian',
        astral: '\uD802[\uDE80-\uDE9F]'
    },
    {
        name: 'InOld_Permic',
        astral: '\uD800[\uDF50-\uDF7F]'
    },
    {
        name: 'InOld_Persian',
        astral: '\uD800[\uDFA0-\uDFDF]'
    },
    {
        name: 'InOld_South_Arabian',
        astral: '\uD802[\uDE60-\uDE7F]'
    },
    {
        name: 'InOld_Turkic',
        astral: '\uD803[\uDC00-\uDC4F]'
    },
    {
        name: 'InOptical_Character_Recognition',
        bmp: '\u2440-\u245F'
    },
    {
        name: 'InOriya',
        bmp: '\u0B00-\u0B7F'
    },
    {
        name: 'InOrnamental_Dingbats',
        astral: '\uD83D[\uDE50-\uDE7F]'
    },
    {
        name: 'InOsmanya',
        astral: '\uD801[\uDC80-\uDCAF]'
    },
    {
        name: 'InPahawh_Hmong',
        astral: '\uD81A[\uDF00-\uDF8F]'
    },
    {
        name: 'InPalmyrene',
        astral: '\uD802[\uDC60-\uDC7F]'
    },
    {
        name: 'InPau_Cin_Hau',
        astral: '\uD806[\uDEC0-\uDEFF]'
    },
    {
        name: 'InPhags_pa',
        bmp: '\uA840-\uA87F'
    },
    {
        name: 'InPhaistos_Disc',
        astral: '\uD800[\uDDD0-\uDDFF]'
    },
    {
        name: 'InPhoenician',
        astral: '\uD802[\uDD00-\uDD1F]'
    },
    {
        name: 'InPhonetic_Extensions',
        bmp: '\u1D00-\u1D7F'
    },
    {
        name: 'InPhonetic_Extensions_Supplement',
        bmp: '\u1D80-\u1DBF'
    },
    {
        name: 'InPlaying_Cards',
        astral: '\uD83C[\uDCA0-\uDCFF]'
    },
    {
        name: 'InPrivate_Use_Area',
        bmp: '\uE000-\uF8FF'
    },
    {
        name: 'InPsalter_Pahlavi',
        astral: '\uD802[\uDF80-\uDFAF]'
    },
    {
        name: 'InRejang',
        bmp: '\uA930-\uA95F'
    },
    {
        name: 'InRumi_Numeral_Symbols',
        astral: '\uD803[\uDE60-\uDE7F]'
    },
    {
        name: 'InRunic',
        bmp: '\u16A0-\u16FF'
    },
    {
        name: 'InSamaritan',
        bmp: '\u0800-\u083F'
    },
    {
        name: 'InSaurashtra',
        bmp: '\uA880-\uA8DF'
    },
    {
        name: 'InSharada',
        astral: '\uD804[\uDD80-\uDDDF]'
    },
    {
        name: 'InShavian',
        astral: '\uD801[\uDC50-\uDC7F]'
    },
    {
        name: 'InShorthand_Format_Controls',
        astral: '\uD82F[\uDCA0-\uDCAF]'
    },
    {
        name: 'InSiddham',
        astral: '\uD805[\uDD80-\uDDFF]'
    },
    {
        name: 'InSinhala',
        bmp: '\u0D80-\u0DFF'
    },
    {
        name: 'InSinhala_Archaic_Numbers',
        astral: '\uD804[\uDDE0-\uDDFF]'
    },
    {
        name: 'InSmall_Form_Variants',
        bmp: '\uFE50-\uFE6F'
    },
    {
        name: 'InSora_Sompeng',
        astral: '\uD804[\uDCD0-\uDCFF]'
    },
    {
        name: 'InSpacing_Modifier_Letters',
        bmp: '\u02B0-\u02FF'
    },
    {
        name: 'InSpecials',
        bmp: '\uFFF0-\uFFFF'
    },
    {
        name: 'InSundanese',
        bmp: '\u1B80-\u1BBF'
    },
    {
        name: 'InSundanese_Supplement',
        bmp: '\u1CC0-\u1CCF'
    },
    {
        name: 'InSuperscripts_and_Subscripts',
        bmp: '\u2070-\u209F'
    },
    {
        name: 'InSupplemental_Arrows_A',
        bmp: '\u27F0-\u27FF'
    },
    {
        name: 'InSupplemental_Arrows_B',
        bmp: '\u2900-\u297F'
    },
    {
        name: 'InSupplemental_Arrows_C',
        astral: '\uD83E[\uDC00-\uDCFF]'
    },
    {
        name: 'InSupplemental_Mathematical_Operators',
        bmp: '\u2A00-\u2AFF'
    },
    {
        name: 'InSupplemental_Punctuation',
        bmp: '\u2E00-\u2E7F'
    },
    {
        name: 'InSupplemental_Symbols_and_Pictographs',
        astral: '\uD83E[\uDD00-\uDDFF]'
    },
    {
        name: 'InSupplementary_Private_Use_Area_A',
        astral: '[\uDB80-\uDBBF][\uDC00-\uDFFF]'
    },
    {
        name: 'InSupplementary_Private_Use_Area_B',
        astral: '[\uDBC0-\uDBFF][\uDC00-\uDFFF]'
    },
    {
        name: 'InSutton_SignWriting',
        astral: '\uD836[\uDC00-\uDEAF]'
    },
    {
        name: 'InSyloti_Nagri',
        bmp: '\uA800-\uA82F'
    },
    {
        name: 'InSyriac',
        bmp: '\u0700-\u074F'
    },
    {
        name: 'InTagalog',
        bmp: '\u1700-\u171F'
    },
    {
        name: 'InTagbanwa',
        bmp: '\u1760-\u177F'
    },
    {
        name: 'InTags',
        astral: '\uDB40[\uDC00-\uDC7F]'
    },
    {
        name: 'InTai_Le',
        bmp: '\u1950-\u197F'
    },
    {
        name: 'InTai_Tham',
        bmp: '\u1A20-\u1AAF'
    },
    {
        name: 'InTai_Viet',
        bmp: '\uAA80-\uAADF'
    },
    {
        name: 'InTai_Xuan_Jing_Symbols',
        astral: '\uD834[\uDF00-\uDF5F]'
    },
    {
        name: 'InTakri',
        astral: '\uD805[\uDE80-\uDECF]'
    },
    {
        name: 'InTamil',
        bmp: '\u0B80-\u0BFF'
    },
    {
        name: 'InTelugu',
        bmp: '\u0C00-\u0C7F'
    },
    {
        name: 'InThaana',
        bmp: '\u0780-\u07BF'
    },
    {
        name: 'InThai',
        bmp: '\u0E00-\u0E7F'
    },
    {
        name: 'InTibetan',
        bmp: '\u0F00-\u0FFF'
    },
    {
        name: 'InTifinagh',
        bmp: '\u2D30-\u2D7F'
    },
    {
        name: 'InTirhuta',
        astral: '\uD805[\uDC80-\uDCDF]'
    },
    {
        name: 'InTransport_and_Map_Symbols',
        astral: '\uD83D[\uDE80-\uDEFF]'
    },
    {
        name: 'InUgaritic',
        astral: '\uD800[\uDF80-\uDF9F]'
    },
    {
        name: 'InUnified_Canadian_Aboriginal_Syllabics',
        bmp: '\u1400-\u167F'
    },
    {
        name: 'InUnified_Canadian_Aboriginal_Syllabics_Extended',
        bmp: '\u18B0-\u18FF'
    },
    {
        name: 'InVai',
        bmp: '\uA500-\uA63F'
    },
    {
        name: 'InVariation_Selectors',
        bmp: '\uFE00-\uFE0F'
    },
    {
        name: 'InVariation_Selectors_Supplement',
        astral: '\uDB40[\uDD00-\uDDEF]'
    },
    {
        name: 'InVedic_Extensions',
        bmp: '\u1CD0-\u1CFF'
    },
    {
        name: 'InVertical_Forms',
        bmp: '\uFE10-\uFE1F'
    },
    {
        name: 'InWarang_Citi',
        astral: '\uD806[\uDCA0-\uDCFF]'
    },
    {
        name: 'InYi_Radicals',
        bmp: '\uA490-\uA4CF'
    },
    {
        name: 'InYi_Syllables',
        bmp: '\uA000-\uA48F'
    },
    {
        name: 'InYijing_Hexagram_Symbols',
        bmp: '\u4DC0-\u4DFF'
    }
]);



/*!
 * XRegExp Unicode Categories 
 * <xregexp.com>
 * Steven Levithan (c) 2010-2016 MIT License
 * Unicode data by Mathias Bynens <mathiasbynens.be>
 */





/**
 * Adds support for Unicode's general categories. E.g., `\p{Lu}` or `\p{Uppercase Letter}`. See
 * category descriptions in UAX #44 <http://unicode.org/reports/tr44/#GC_Values_Table>. Token
 * names are case insensitive, and any spaces, hyphens, and underscores are ignored.
 *
 * Uses Unicode 8.0.0.
 *
 * @requires XRegExp, Unicode Base
 */

if (!XRegExp.addUnicodeData) {
    throw new ReferenceError('Unicode Base must be loaded before Unicode Categories');
}

XRegExp.addUnicodeData([
    {
        name: 'C',
        alias: 'Other',
        isBmpLast: true,
        bmp: '\0-\x1F\x7F-\x9F\xAD\u0378\u0379\u0380-\u0383\u038B\u038D\u03A2\u0530\u0557\u0558\u0560\u0588\u058B\u058C\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u0605\u061C\u061D\u06DD\u070E\u070F\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08B5-\u08E2\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0AF8\u0AFA-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0BFF\u0C04\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D00\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5E\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F6\u13F7\u13FE\u13FF\u169D-\u169F\u16F9-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180E\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE\u1AAF\u1ABF-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7\u1CFA-\u1CFF\u1DF6-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2072\u2073\u208F\u209D-\u209F\u20BF-\u20CF\u20F1-\u20FF\u218C-\u218F\u23FB-\u23FF\u2427-\u243F\u244B-\u245F\u2B74\u2B75\u2B96\u2B97\u2BBA-\u2BBC\u2BC9\u2BD2-\u2BEB\u2BF0-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E43-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FD6-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA6F8-\uA6FF\uA7AE\uA7AF\uA7B8-\uA7F6\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FE\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB66-\uAB6F\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uF8FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD-\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFFB\uFFFE\uFFFF',
        astral: '\uD834[\uDCF6-\uDCFF\uDD27\uDD28\uDD73-\uDD7A\uDDE9-\uDDFF\uDE46-\uDEFF\uDF57-\uDF5F\uDF72-\uDFFF]|\uD836[\uDE8C-\uDE9A\uDEA0\uDEB0-\uDFFF]|\uD83C[\uDC2C-\uDC2F\uDC94-\uDC9F\uDCAF\uDCB0\uDCC0\uDCD0\uDCF6-\uDCFF\uDD0D-\uDD0F\uDD2F\uDD6C-\uDD6F\uDD9B-\uDDE5\uDE03-\uDE0F\uDE3B-\uDE3F\uDE49-\uDE4F\uDE52-\uDEFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDE6D\uDE70-\uDECF\uDEEE\uDEEF\uDEF6-\uDEFF\uDF46-\uDF4F\uDF5A\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD809[\uDC6F\uDC75-\uDC7F\uDD44-\uDFFF]|\uD81B[\uDC00-\uDEFF\uDF45-\uDF4F\uDF7F-\uDF8E\uDFA0-\uDFFF]|\uD86E[\uDC1E\uDC1F]|\uD83D[\uDD7A\uDDA4\uDED1-\uDEDF\uDEED-\uDEEF\uDEF4-\uDEFF\uDF74-\uDF7F\uDFD5-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCFF\uDD28-\uDD2F\uDD64-\uDD6E\uDD70-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDCFF\uDD03-\uDD06\uDD34-\uDD36\uDD8D-\uDD8F\uDD9C-\uDD9F\uDDA1-\uDDCF\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEFC-\uDEFF\uDF24-\uDF2F\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDFC4-\uDFC7\uDFD6-\uDFFF]|\uD869[\uDED7-\uDEFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDEEF\uDEF2-\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uDB40[\uDC00-\uDCFF\uDDF0-\uDFFF]|\uD804[\uDC4E-\uDC51\uDC70-\uDC7E\uDCBD\uDCC2-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD44-\uDD4F\uDD77-\uDD7F\uDDCE\uDDCF\uDDE0\uDDF5-\uDDFF\uDE12\uDE3E-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEAA-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDEFF\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF3B\uDF45\uDF46\uDF49\uDF4A\uDF4E\uDF4F\uDF51-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD83A[\uDCC5\uDCC6\uDCD7-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD86D[\uDF35-\uDF3F]|[\uD807\uD80A\uD80B\uD80E-\uD810\uD812-\uD819\uD81C-\uD82B\uD82D\uD82E\uD830-\uD833\uD837-\uD839\uD83F\uD874-\uD87D\uD87F-\uDB3F\uDB41-\uDBFF][\uDC00-\uDFFF]|\uD806[\uDC00-\uDC9F\uDCF3-\uDCFE\uDD00-\uDEBF\uDEF9-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCF9\uDD00-\uDE5F\uDE7F-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDFCC\uDFCD]|\uD805[\uDC00-\uDC7F\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDDE-\uDDFF\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB8-\uDEBF\uDECA-\uDEFF\uDF1A-\uDF1C\uDF2C-\uDF2F\uDF40-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56\uDC9F-\uDCA6\uDCB0-\uDCDF\uDCF3\uDCF6-\uDCFA\uDD1C-\uDD1E\uDD3A-\uDD3E\uDD40-\uDD7F\uDDB8-\uDDBB\uDDD0\uDDD1\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE34-\uDE37\uDE3B-\uDE3E\uDE48-\uDE4F\uDE59-\uDE5F\uDEA0-\uDEBF\uDEE7-\uDEEA\uDEF7-\uDEFF\uDF36-\uDF38\uDF56\uDF57\uDF73-\uDF77\uDF92-\uDF98\uDF9D-\uDFA8\uDFB0-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A\uDC9B\uDCA0-\uDFFF]|\uD82C[\uDC02-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD83E[\uDC0C-\uDC0F\uDC48-\uDC4F\uDC5A-\uDC5F\uDC88-\uDC8F\uDCAE-\uDD0F\uDD19-\uDD7F\uDD85-\uDDBF\uDDC1-\uDFFF]|\uD873[\uDEA2-\uDFFF]'
    },
    {
        name: 'Cc',
        alias: 'Control',
        bmp: '\0-\x1F\x7F-\x9F'
    },
    {
        name: 'Cf',
        alias: 'Format',
        bmp: '\xAD\u0600-\u0605\u061C\u06DD\u070F\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB',
        astral: '\uDB40[\uDC01\uDC20-\uDC7F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uD804\uDCBD'
    },
    {
        name: 'Cn',
        alias: 'Unassigned',
        bmp: '\u0378\u0379\u0380-\u0383\u038B\u038D\u03A2\u0530\u0557\u0558\u0560\u0588\u058B\u058C\u0590\u05C8-\u05CF\u05EB-\u05EF\u05F5-\u05FF\u061D\u070E\u074B\u074C\u07B2-\u07BF\u07FB-\u07FF\u082E\u082F\u083F\u085C\u085D\u085F-\u089F\u08B5-\u08E2\u0984\u098D\u098E\u0991\u0992\u09A9\u09B1\u09B3-\u09B5\u09BA\u09BB\u09C5\u09C6\u09C9\u09CA\u09CF-\u09D6\u09D8-\u09DB\u09DE\u09E4\u09E5\u09FC-\u0A00\u0A04\u0A0B-\u0A0E\u0A11\u0A12\u0A29\u0A31\u0A34\u0A37\u0A3A\u0A3B\u0A3D\u0A43-\u0A46\u0A49\u0A4A\u0A4E-\u0A50\u0A52-\u0A58\u0A5D\u0A5F-\u0A65\u0A76-\u0A80\u0A84\u0A8E\u0A92\u0AA9\u0AB1\u0AB4\u0ABA\u0ABB\u0AC6\u0ACA\u0ACE\u0ACF\u0AD1-\u0ADF\u0AE4\u0AE5\u0AF2-\u0AF8\u0AFA-\u0B00\u0B04\u0B0D\u0B0E\u0B11\u0B12\u0B29\u0B31\u0B34\u0B3A\u0B3B\u0B45\u0B46\u0B49\u0B4A\u0B4E-\u0B55\u0B58-\u0B5B\u0B5E\u0B64\u0B65\u0B78-\u0B81\u0B84\u0B8B-\u0B8D\u0B91\u0B96-\u0B98\u0B9B\u0B9D\u0BA0-\u0BA2\u0BA5-\u0BA7\u0BAB-\u0BAD\u0BBA-\u0BBD\u0BC3-\u0BC5\u0BC9\u0BCE\u0BCF\u0BD1-\u0BD6\u0BD8-\u0BE5\u0BFB-\u0BFF\u0C04\u0C0D\u0C11\u0C29\u0C3A-\u0C3C\u0C45\u0C49\u0C4E-\u0C54\u0C57\u0C5B-\u0C5F\u0C64\u0C65\u0C70-\u0C77\u0C80\u0C84\u0C8D\u0C91\u0CA9\u0CB4\u0CBA\u0CBB\u0CC5\u0CC9\u0CCE-\u0CD4\u0CD7-\u0CDD\u0CDF\u0CE4\u0CE5\u0CF0\u0CF3-\u0D00\u0D04\u0D0D\u0D11\u0D3B\u0D3C\u0D45\u0D49\u0D4F-\u0D56\u0D58-\u0D5E\u0D64\u0D65\u0D76-\u0D78\u0D80\u0D81\u0D84\u0D97-\u0D99\u0DB2\u0DBC\u0DBE\u0DBF\u0DC7-\u0DC9\u0DCB-\u0DCE\u0DD5\u0DD7\u0DE0-\u0DE5\u0DF0\u0DF1\u0DF5-\u0E00\u0E3B-\u0E3E\u0E5C-\u0E80\u0E83\u0E85\u0E86\u0E89\u0E8B\u0E8C\u0E8E-\u0E93\u0E98\u0EA0\u0EA4\u0EA6\u0EA8\u0EA9\u0EAC\u0EBA\u0EBE\u0EBF\u0EC5\u0EC7\u0ECE\u0ECF\u0EDA\u0EDB\u0EE0-\u0EFF\u0F48\u0F6D-\u0F70\u0F98\u0FBD\u0FCD\u0FDB-\u0FFF\u10C6\u10C8-\u10CC\u10CE\u10CF\u1249\u124E\u124F\u1257\u1259\u125E\u125F\u1289\u128E\u128F\u12B1\u12B6\u12B7\u12BF\u12C1\u12C6\u12C7\u12D7\u1311\u1316\u1317\u135B\u135C\u137D-\u137F\u139A-\u139F\u13F6\u13F7\u13FE\u13FF\u169D-\u169F\u16F9-\u16FF\u170D\u1715-\u171F\u1737-\u173F\u1754-\u175F\u176D\u1771\u1774-\u177F\u17DE\u17DF\u17EA-\u17EF\u17FA-\u17FF\u180F\u181A-\u181F\u1878-\u187F\u18AB-\u18AF\u18F6-\u18FF\u191F\u192C-\u192F\u193C-\u193F\u1941-\u1943\u196E\u196F\u1975-\u197F\u19AC-\u19AF\u19CA-\u19CF\u19DB-\u19DD\u1A1C\u1A1D\u1A5F\u1A7D\u1A7E\u1A8A-\u1A8F\u1A9A-\u1A9F\u1AAE\u1AAF\u1ABF-\u1AFF\u1B4C-\u1B4F\u1B7D-\u1B7F\u1BF4-\u1BFB\u1C38-\u1C3A\u1C4A-\u1C4C\u1C80-\u1CBF\u1CC8-\u1CCF\u1CF7\u1CFA-\u1CFF\u1DF6-\u1DFB\u1F16\u1F17\u1F1E\u1F1F\u1F46\u1F47\u1F4E\u1F4F\u1F58\u1F5A\u1F5C\u1F5E\u1F7E\u1F7F\u1FB5\u1FC5\u1FD4\u1FD5\u1FDC\u1FF0\u1FF1\u1FF5\u1FFF\u2065\u2072\u2073\u208F\u209D-\u209F\u20BF-\u20CF\u20F1-\u20FF\u218C-\u218F\u23FB-\u23FF\u2427-\u243F\u244B-\u245F\u2B74\u2B75\u2B96\u2B97\u2BBA-\u2BBC\u2BC9\u2BD2-\u2BEB\u2BF0-\u2BFF\u2C2F\u2C5F\u2CF4-\u2CF8\u2D26\u2D28-\u2D2C\u2D2E\u2D2F\u2D68-\u2D6E\u2D71-\u2D7E\u2D97-\u2D9F\u2DA7\u2DAF\u2DB7\u2DBF\u2DC7\u2DCF\u2DD7\u2DDF\u2E43-\u2E7F\u2E9A\u2EF4-\u2EFF\u2FD6-\u2FEF\u2FFC-\u2FFF\u3040\u3097\u3098\u3100-\u3104\u312E-\u3130\u318F\u31BB-\u31BF\u31E4-\u31EF\u321F\u32FF\u4DB6-\u4DBF\u9FD6-\u9FFF\uA48D-\uA48F\uA4C7-\uA4CF\uA62C-\uA63F\uA6F8-\uA6FF\uA7AE\uA7AF\uA7B8-\uA7F6\uA82C-\uA82F\uA83A-\uA83F\uA878-\uA87F\uA8C5-\uA8CD\uA8DA-\uA8DF\uA8FE\uA8FF\uA954-\uA95E\uA97D-\uA97F\uA9CE\uA9DA-\uA9DD\uA9FF\uAA37-\uAA3F\uAA4E\uAA4F\uAA5A\uAA5B\uAAC3-\uAADA\uAAF7-\uAB00\uAB07\uAB08\uAB0F\uAB10\uAB17-\uAB1F\uAB27\uAB2F\uAB66-\uAB6F\uABEE\uABEF\uABFA-\uABFF\uD7A4-\uD7AF\uD7C7-\uD7CA\uD7FC-\uD7FF\uFA6E\uFA6F\uFADA-\uFAFF\uFB07-\uFB12\uFB18-\uFB1C\uFB37\uFB3D\uFB3F\uFB42\uFB45\uFBC2-\uFBD2\uFD40-\uFD4F\uFD90\uFD91\uFDC8-\uFDEF\uFDFE\uFDFF\uFE1A-\uFE1F\uFE53\uFE67\uFE6C-\uFE6F\uFE75\uFEFD\uFEFE\uFF00\uFFBF-\uFFC1\uFFC8\uFFC9\uFFD0\uFFD1\uFFD8\uFFD9\uFFDD-\uFFDF\uFFE7\uFFEF-\uFFF8\uFFFE\uFFFF',
        astral: '\uDB40[\uDC00\uDC02-\uDC1F\uDC80-\uDCFF\uDDF0-\uDFFF]|\uD834[\uDCF6-\uDCFF\uDD27\uDD28\uDDE9-\uDDFF\uDE46-\uDEFF\uDF57-\uDF5F\uDF72-\uDFFF]|\uD83C[\uDC2C-\uDC2F\uDC94-\uDC9F\uDCAF\uDCB0\uDCC0\uDCD0\uDCF6-\uDCFF\uDD0D-\uDD0F\uDD2F\uDD6C-\uDD6F\uDD9B-\uDDE5\uDE03-\uDE0F\uDE3B-\uDE3F\uDE49-\uDE4F\uDE52-\uDEFF]|\uD81A[\uDE39-\uDE3F\uDE5F\uDE6A-\uDE6D\uDE70-\uDECF\uDEEE\uDEEF\uDEF6-\uDEFF\uDF46-\uDF4F\uDF5A\uDF62\uDF78-\uDF7C\uDF90-\uDFFF]|\uD809[\uDC6F\uDC75-\uDC7F\uDD44-\uDFFF]|\uD81B[\uDC00-\uDEFF\uDF45-\uDF4F\uDF7F-\uDF8E\uDFA0-\uDFFF]|\uD86E[\uDC1E\uDC1F]|\uD83D[\uDD7A\uDDA4\uDED1-\uDEDF\uDEED-\uDEEF\uDEF4-\uDEFF\uDF74-\uDF7F\uDFD5-\uDFFF]|\uD801[\uDC9E\uDC9F\uDCAA-\uDCFF\uDD28-\uDD2F\uDD64-\uDD6E\uDD70-\uDDFF\uDF37-\uDF3F\uDF56-\uDF5F\uDF68-\uDFFF]|\uD800[\uDC0C\uDC27\uDC3B\uDC3E\uDC4E\uDC4F\uDC5E-\uDC7F\uDCFB-\uDCFF\uDD03-\uDD06\uDD34-\uDD36\uDD8D-\uDD8F\uDD9C-\uDD9F\uDDA1-\uDDCF\uDDFE-\uDE7F\uDE9D-\uDE9F\uDED1-\uDEDF\uDEFC-\uDEFF\uDF24-\uDF2F\uDF4B-\uDF4F\uDF7B-\uDF7F\uDF9E\uDFC4-\uDFC7\uDFD6-\uDFFF]|\uD869[\uDED7-\uDEFF]|\uD83B[\uDC00-\uDDFF\uDE04\uDE20\uDE23\uDE25\uDE26\uDE28\uDE33\uDE38\uDE3A\uDE3C-\uDE41\uDE43-\uDE46\uDE48\uDE4A\uDE4C\uDE50\uDE53\uDE55\uDE56\uDE58\uDE5A\uDE5C\uDE5E\uDE60\uDE63\uDE65\uDE66\uDE6B\uDE73\uDE78\uDE7D\uDE7F\uDE8A\uDE9C-\uDEA0\uDEA4\uDEAA\uDEBC-\uDEEF\uDEF2-\uDFFF]|[\uDBBF\uDBFF][\uDFFE\uDFFF]|\uD87E[\uDE1E-\uDFFF]|\uD82F[\uDC6B-\uDC6F\uDC7D-\uDC7F\uDC89-\uDC8F\uDC9A\uDC9B\uDCA4-\uDFFF]|\uD83A[\uDCC5\uDCC6\uDCD7-\uDFFF]|\uD80D[\uDC2F-\uDFFF]|\uD86D[\uDF35-\uDF3F]|[\uD807\uD80A\uD80B\uD80E-\uD810\uD812-\uD819\uD81C-\uD82B\uD82D\uD82E\uD830-\uD833\uD837-\uD839\uD83F\uD874-\uD87D\uD87F-\uDB3F\uDB41-\uDB7F][\uDC00-\uDFFF]|\uD806[\uDC00-\uDC9F\uDCF3-\uDCFE\uDD00-\uDEBF\uDEF9-\uDFFF]|\uD803[\uDC49-\uDC7F\uDCB3-\uDCBF\uDCF3-\uDCF9\uDD00-\uDE5F\uDE7F-\uDFFF]|\uD835[\uDC55\uDC9D\uDCA0\uDCA1\uDCA3\uDCA4\uDCA7\uDCA8\uDCAD\uDCBA\uDCBC\uDCC4\uDD06\uDD0B\uDD0C\uDD15\uDD1D\uDD3A\uDD3F\uDD45\uDD47-\uDD49\uDD51\uDEA6\uDEA7\uDFCC\uDFCD]|\uD836[\uDE8C-\uDE9A\uDEA0\uDEB0-\uDFFF]|\uD805[\uDC00-\uDC7F\uDCC8-\uDCCF\uDCDA-\uDD7F\uDDB6\uDDB7\uDDDE-\uDDFF\uDE45-\uDE4F\uDE5A-\uDE7F\uDEB8-\uDEBF\uDECA-\uDEFF\uDF1A-\uDF1C\uDF2C-\uDF2F\uDF40-\uDFFF]|\uD802[\uDC06\uDC07\uDC09\uDC36\uDC39-\uDC3B\uDC3D\uDC3E\uDC56\uDC9F-\uDCA6\uDCB0-\uDCDF\uDCF3\uDCF6-\uDCFA\uDD1C-\uDD1E\uDD3A-\uDD3E\uDD40-\uDD7F\uDDB8-\uDDBB\uDDD0\uDDD1\uDE04\uDE07-\uDE0B\uDE14\uDE18\uDE34-\uDE37\uDE3B-\uDE3E\uDE48-\uDE4F\uDE59-\uDE5F\uDEA0-\uDEBF\uDEE7-\uDEEA\uDEF7-\uDEFF\uDF36-\uDF38\uDF56\uDF57\uDF73-\uDF77\uDF92-\uDF98\uDF9D-\uDFA8\uDFB0-\uDFFF]|\uD808[\uDF9A-\uDFFF]|\uD804[\uDC4E-\uDC51\uDC70-\uDC7E\uDCC2-\uDCCF\uDCE9-\uDCEF\uDCFA-\uDCFF\uDD35\uDD44-\uDD4F\uDD77-\uDD7F\uDDCE\uDDCF\uDDE0\uDDF5-\uDDFF\uDE12\uDE3E-\uDE7F\uDE87\uDE89\uDE8E\uDE9E\uDEAA-\uDEAF\uDEEB-\uDEEF\uDEFA-\uDEFF\uDF04\uDF0D\uDF0E\uDF11\uDF12\uDF29\uDF31\uDF34\uDF3A\uDF3B\uDF45\uDF46\uDF49\uDF4A\uDF4E\uDF4F\uDF51-\uDF56\uDF58-\uDF5C\uDF64\uDF65\uDF6D-\uDF6F\uDF75-\uDFFF]|\uD82C[\uDC02-\uDFFF]|\uD811[\uDE47-\uDFFF]|\uD83E[\uDC0C-\uDC0F\uDC48-\uDC4F\uDC5A-\uDC5F\uDC88-\uDC8F\uDCAE-\uDD0F\uDD19-\uDD7F\uDD85-\uDDBF\uDDC1-\uDFFF]|\uD873[\uDEA2-\uDFFF]'
    },
    {
        name: 'Co',
        alias: 'Private_Use',
        bmp: '\uE000-\uF8FF',
        astral: '[\uDB80-\uDBBE\uDBC0-\uDBFE][\uDC00-\uDFFF]|[\uDBBF\uDBFF][\uDC00-\uDFFD]'
    },
    {
        name: 'Cs',
        alias: 'Surrogate',
        bmp: '\uD800-\uDFFF'
    },
    {
        name: 'L',
        alias: 'Letter',
        bmp: 'A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC',
        astral: '\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD83A[\uDC00-\uDCC4]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF40\uDF42-\uDF49\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF]|\uD80D[\uDC00-\uDC2E]|\uD87E[\uDC00-\uDE1D]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD809[\uDC80-\uDD43]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD808[\uDC00-\uDF99]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD811[\uDC00-\uDE46]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD82C[\uDC00\uDC01]|\uD873[\uDC00-\uDEA1]'
    },
    {
        name: 'Ll',
        alias: 'Lowercase_Letter',
        bmp: 'a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A',
        astral: '\uD803[\uDCC0-\uDCF2]|\uD835[\uDC1A-\uDC33\uDC4E-\uDC54\uDC56-\uDC67\uDC82-\uDC9B\uDCB6-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDCEA-\uDD03\uDD1E-\uDD37\uDD52-\uDD6B\uDD86-\uDD9F\uDDBA-\uDDD3\uDDEE-\uDE07\uDE22-\uDE3B\uDE56-\uDE6F\uDE8A-\uDEA5\uDEC2-\uDEDA\uDEDC-\uDEE1\uDEFC-\uDF14\uDF16-\uDF1B\uDF36-\uDF4E\uDF50-\uDF55\uDF70-\uDF88\uDF8A-\uDF8F\uDFAA-\uDFC2\uDFC4-\uDFC9\uDFCB]|\uD801[\uDC28-\uDC4F]|\uD806[\uDCC0-\uDCDF]'
    },
    {
        name: 'Lm',
        alias: 'Modifier_Letter',
        bmp: '\u02B0-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0374\u037A\u0559\u0640\u06E5\u06E6\u07F4\u07F5\u07FA\u081A\u0824\u0828\u0971\u0E46\u0EC6\u10FC\u17D7\u1843\u1AA7\u1C78-\u1C7D\u1D2C-\u1D6A\u1D78\u1D9B-\u1DBF\u2071\u207F\u2090-\u209C\u2C7C\u2C7D\u2D6F\u2E2F\u3005\u3031-\u3035\u303B\u309D\u309E\u30FC-\u30FE\uA015\uA4F8-\uA4FD\uA60C\uA67F\uA69C\uA69D\uA717-\uA71F\uA770\uA788\uA7F8\uA7F9\uA9CF\uA9E6\uAA70\uAADD\uAAF3\uAAF4\uAB5C-\uAB5F\uFF70\uFF9E\uFF9F',
        astral: '\uD81A[\uDF40-\uDF43]|\uD81B[\uDF93-\uDF9F]'
    },
    {
        name: 'Lo',
        alias: 'Other_Letter',
        bmp: '\xAA\xBA\u01BB\u01C0-\u01C3\u0294\u05D0-\u05EA\u05F0-\u05F2\u0620-\u063F\u0641-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u0800-\u0815\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0972-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E45\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10D0-\u10FA\u10FD-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17DC\u1820-\u1842\u1844-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C77\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u2135-\u2138\u2D30-\u2D67\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3006\u303C\u3041-\u3096\u309F\u30A1-\u30FA\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA014\uA016-\uA48C\uA4D0-\uA4F7\uA500-\uA60B\uA610-\uA61F\uA62A\uA62B\uA66E\uA6A0-\uA6E5\uA78F\uA7F7\uA7FB-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9E0-\uA9E4\uA9E7-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA6F\uAA71-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB\uAADC\uAAE0-\uAAEA\uAAF2\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF66-\uFF6F\uFF71-\uFF9D\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC',
        astral: '\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD83A[\uDC00-\uDCC4]|\uD803[\uDC00-\uDC48]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF40\uDF42-\uDF49\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF]|\uD80D[\uDC00-\uDC2E]|\uD87E[\uDC00-\uDE1D]|\uD81B[\uDF00-\uDF44\uDF50]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD805[\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCFF\uDEC0-\uDEF8]|\uD809[\uDC80-\uDD43]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD808[\uDC00-\uDF99]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF63-\uDF77\uDF7D-\uDF8F]|\uD801[\uDC50-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD811[\uDC00-\uDE46]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD82C[\uDC00\uDC01]|\uD873[\uDC00-\uDEA1]'
    },
    {
        name: 'Lt',
        alias: 'Titlecase_Letter',
        bmp: '\u01C5\u01C8\u01CB\u01F2\u1F88-\u1F8F\u1F98-\u1F9F\u1FA8-\u1FAF\u1FBC\u1FCC\u1FFC'
    },
    {
        name: 'Lu',
        alias: 'Uppercase_Letter',
        bmp: 'A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A',
        astral: '\uD806[\uDCA0-\uDCBF]|\uD803[\uDC80-\uDCB2]|\uD801[\uDC00-\uDC27]|\uD835[\uDC00-\uDC19\uDC34-\uDC4D\uDC68-\uDC81\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB5\uDCD0-\uDCE9\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD38\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD6C-\uDD85\uDDA0-\uDDB9\uDDD4-\uDDED\uDE08-\uDE21\uDE3C-\uDE55\uDE70-\uDE89\uDEA8-\uDEC0\uDEE2-\uDEFA\uDF1C-\uDF34\uDF56-\uDF6E\uDF90-\uDFA8\uDFCA]'
    },
    {
        name: 'M',
        alias: 'Mark',
        bmp: '\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C03\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D01-\u0D03\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F',
        astral: '\uD805[\uDCB0-\uDCC3\uDDAF-\uDDB5\uDDB8-\uDDC0\uDDDC\uDDDD\uDE30-\uDE40\uDEAB-\uDEB7\uDF1D-\uDF2B]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD804[\uDC00-\uDC02\uDC38-\uDC46\uDC7F-\uDC82\uDCB0-\uDCBA\uDD00-\uDD02\uDD27-\uDD34\uDD73\uDD80-\uDD82\uDDB3-\uDDC0\uDDCA-\uDDCC\uDE2C-\uDE37\uDEDF-\uDEEA\uDF00-\uDF03\uDF3C\uDF3E-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF57\uDF62\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD81B[\uDF51-\uDF7E\uDF8F-\uDF92]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD82F[\uDC9D\uDC9E]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD83A[\uDCD0-\uDCD6]|\uDB40[\uDD00-\uDDEF]'
    },
    {
        name: 'Mc',
        alias: 'Spacing_Mark',
        bmp: '\u0903\u093B\u093E-\u0940\u0949-\u094C\u094E\u094F\u0982\u0983\u09BE-\u09C0\u09C7\u09C8\u09CB\u09CC\u09D7\u0A03\u0A3E-\u0A40\u0A83\u0ABE-\u0AC0\u0AC9\u0ACB\u0ACC\u0B02\u0B03\u0B3E\u0B40\u0B47\u0B48\u0B4B\u0B4C\u0B57\u0BBE\u0BBF\u0BC1\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD7\u0C01-\u0C03\u0C41-\u0C44\u0C82\u0C83\u0CBE\u0CC0-\u0CC4\u0CC7\u0CC8\u0CCA\u0CCB\u0CD5\u0CD6\u0D02\u0D03\u0D3E-\u0D40\u0D46-\u0D48\u0D4A-\u0D4C\u0D57\u0D82\u0D83\u0DCF-\u0DD1\u0DD8-\u0DDF\u0DF2\u0DF3\u0F3E\u0F3F\u0F7F\u102B\u102C\u1031\u1038\u103B\u103C\u1056\u1057\u1062-\u1064\u1067-\u106D\u1083\u1084\u1087-\u108C\u108F\u109A-\u109C\u17B6\u17BE-\u17C5\u17C7\u17C8\u1923-\u1926\u1929-\u192B\u1930\u1931\u1933-\u1938\u1A19\u1A1A\u1A55\u1A57\u1A61\u1A63\u1A64\u1A6D-\u1A72\u1B04\u1B35\u1B3B\u1B3D-\u1B41\u1B43\u1B44\u1B82\u1BA1\u1BA6\u1BA7\u1BAA\u1BE7\u1BEA-\u1BEC\u1BEE\u1BF2\u1BF3\u1C24-\u1C2B\u1C34\u1C35\u1CE1\u1CF2\u1CF3\u302E\u302F\uA823\uA824\uA827\uA880\uA881\uA8B4-\uA8C3\uA952\uA953\uA983\uA9B4\uA9B5\uA9BA\uA9BB\uA9BD-\uA9C0\uAA2F\uAA30\uAA33\uAA34\uAA4D\uAA7B\uAA7D\uAAEB\uAAEE\uAAEF\uAAF5\uABE3\uABE4\uABE6\uABE7\uABE9\uABEA\uABEC',
        astral: '\uD834[\uDD65\uDD66\uDD6D-\uDD72]|\uD804[\uDC00\uDC02\uDC82\uDCB0-\uDCB2\uDCB7\uDCB8\uDD2C\uDD82\uDDB3-\uDDB5\uDDBF\uDDC0\uDE2C-\uDE2E\uDE32\uDE33\uDE35\uDEE0-\uDEE2\uDF02\uDF03\uDF3E\uDF3F\uDF41-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF57\uDF62\uDF63]|\uD805[\uDCB0-\uDCB2\uDCB9\uDCBB-\uDCBE\uDCC1\uDDAF-\uDDB1\uDDB8-\uDDBB\uDDBE\uDE30-\uDE32\uDE3B\uDE3C\uDE3E\uDEAC\uDEAE\uDEAF\uDEB6\uDF20\uDF21\uDF26]|\uD81B[\uDF51-\uDF7E]'
    },
    {
        name: 'Me',
        alias: 'Enclosing_Mark',
        bmp: '\u0488\u0489\u1ABE\u20DD-\u20E0\u20E2-\u20E4\uA670-\uA672'
    },
    {
        name: 'Mn',
        alias: 'Nonspacing_Mark',
        bmp: '\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E3-\u0902\u093A\u093C\u0941-\u0948\u094D\u0951-\u0957\u0962\u0963\u0981\u09BC\u09C1-\u09C4\u09CD\u09E2\u09E3\u0A01\u0A02\u0A3C\u0A41\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81\u0A82\u0ABC\u0AC1-\u0AC5\u0AC7\u0AC8\u0ACD\u0AE2\u0AE3\u0B01\u0B3C\u0B3F\u0B41-\u0B44\u0B4D\u0B56\u0B62\u0B63\u0B82\u0BC0\u0BCD\u0C00\u0C3E-\u0C40\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81\u0CBC\u0CBF\u0CC6\u0CCC\u0CCD\u0CE2\u0CE3\u0D01\u0D41-\u0D44\u0D4D\u0D62\u0D63\u0DCA\u0DD2-\u0DD4\u0DD6\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F71-\u0F7E\u0F80-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102D-\u1030\u1032-\u1037\u1039\u103A\u103D\u103E\u1058\u1059\u105E-\u1060\u1071-\u1074\u1082\u1085\u1086\u108D\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4\u17B5\u17B7-\u17BD\u17C6\u17C9-\u17D3\u17DD\u180B-\u180D\u18A9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193B\u1A17\u1A18\u1A1B\u1A56\u1A58-\u1A5E\u1A60\u1A62\u1A65-\u1A6C\u1A73-\u1A7C\u1A7F\u1AB0-\u1ABD\u1B00-\u1B03\u1B34\u1B36-\u1B3A\u1B3C\u1B42\u1B6B-\u1B73\u1B80\u1B81\u1BA2-\u1BA5\u1BA8\u1BA9\u1BAB-\u1BAD\u1BE6\u1BE8\u1BE9\u1BED\u1BEF-\u1BF1\u1C2C-\u1C33\u1C36\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302D\u3099\u309A\uA66F\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA825\uA826\uA8C4\uA8E0-\uA8F1\uA926-\uA92D\uA947-\uA951\uA980-\uA982\uA9B3\uA9B6-\uA9B9\uA9BC\uA9E5\uAA29-\uAA2E\uAA31\uAA32\uAA35\uAA36\uAA43\uAA4C\uAA7C\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEC\uAAED\uAAF6\uABE5\uABE8\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F',
        astral: '\uD805[\uDCB3-\uDCB8\uDCBA\uDCBF\uDCC0\uDCC2\uDCC3\uDDB2-\uDDB5\uDDBC\uDDBD\uDDBF\uDDC0\uDDDC\uDDDD\uDE33-\uDE3A\uDE3D\uDE3F\uDE40\uDEAB\uDEAD\uDEB0-\uDEB5\uDEB7\uDF1D-\uDF1F\uDF22-\uDF25\uDF27-\uDF2B]|\uD834[\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD81A[\uDEF0-\uDEF4\uDF30-\uDF36]|\uD81B[\uDF8F-\uDF92]|\uD82F[\uDC9D\uDC9E]|\uD800[\uDDFD\uDEE0\uDF76-\uDF7A]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD802[\uDE01-\uDE03\uDE05\uDE06\uDE0C-\uDE0F\uDE38-\uDE3A\uDE3F\uDEE5\uDEE6]|\uD804[\uDC01\uDC38-\uDC46\uDC7F-\uDC81\uDCB3-\uDCB6\uDCB9\uDCBA\uDD00-\uDD02\uDD27-\uDD2B\uDD2D-\uDD34\uDD73\uDD80\uDD81\uDDB6-\uDDBE\uDDCA-\uDDCC\uDE2F-\uDE31\uDE34\uDE36\uDE37\uDEDF\uDEE3-\uDEEA\uDF00\uDF01\uDF3C\uDF40\uDF66-\uDF6C\uDF70-\uDF74]|\uD83A[\uDCD0-\uDCD6]|\uDB40[\uDD00-\uDDEF]'
    },
    {
        name: 'N',
        alias: 'Number',
        bmp: '0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19',
        astral: '\uD800[\uDD07-\uDD33\uDD40-\uDD78\uDD8A\uDD8B\uDEE1-\uDEFB\uDF20-\uDF23\uDF41\uDF4A\uDFD1-\uDFD5]|\uD801[\uDCA0-\uDCA9]|\uD803[\uDCFA-\uDCFF\uDE60-\uDE7E]|\uD835[\uDFCE-\uDFFF]|\uD83A[\uDCC7-\uDCCF]|\uD81A[\uDE60-\uDE69\uDF50-\uDF59\uDF5B-\uDF61]|\uD806[\uDCE0-\uDCF2]|\uD804[\uDC52-\uDC6F\uDCF0-\uDCF9\uDD36-\uDD3F\uDDD0-\uDDD9\uDDE1-\uDDF4\uDEF0-\uDEF9]|\uD834[\uDF60-\uDF71]|\uD83C[\uDD00-\uDD0C]|\uD809[\uDC00-\uDC6E]|\uD802[\uDC58-\uDC5F\uDC79-\uDC7F\uDCA7-\uDCAF\uDCFB-\uDCFF\uDD16-\uDD1B\uDDBC\uDDBD\uDDC0-\uDDCF\uDDD2-\uDDFF\uDE40-\uDE47\uDE7D\uDE7E\uDE9D-\uDE9F\uDEEB-\uDEEF\uDF58-\uDF5F\uDF78-\uDF7F\uDFA9-\uDFAF]|\uD805[\uDCD0-\uDCD9\uDE50-\uDE59\uDEC0-\uDEC9\uDF30-\uDF3B]'
    },
    {
        name: 'Nd',
        alias: 'Decimal_Number',
        bmp: '0-9\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29\u1040-\u1049\u1090-\u1099\u17E0-\u17E9\u1810-\u1819\u1946-\u194F\u19D0-\u19D9\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\uA620-\uA629\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19',
        astral: '\uD801[\uDCA0-\uDCA9]|\uD835[\uDFCE-\uDFFF]|\uD805[\uDCD0-\uDCD9\uDE50-\uDE59\uDEC0-\uDEC9\uDF30-\uDF39]|\uD806[\uDCE0-\uDCE9]|\uD804[\uDC66-\uDC6F\uDCF0-\uDCF9\uDD36-\uDD3F\uDDD0-\uDDD9\uDEF0-\uDEF9]|\uD81A[\uDE60-\uDE69\uDF50-\uDF59]'
    },
    {
        name: 'Nl',
        alias: 'Letter_Number',
        bmp: '\u16EE-\u16F0\u2160-\u2182\u2185-\u2188\u3007\u3021-\u3029\u3038-\u303A\uA6E6-\uA6EF',
        astral: '\uD809[\uDC00-\uDC6E]|\uD800[\uDD40-\uDD74\uDF41\uDF4A\uDFD1-\uDFD5]'
    },
    {
        name: 'No',
        alias: 'Other_Number',
        bmp: '\xB2\xB3\xB9\xBC-\xBE\u09F4-\u09F9\u0B72-\u0B77\u0BF0-\u0BF2\u0C78-\u0C7E\u0D70-\u0D75\u0F2A-\u0F33\u1369-\u137C\u17F0-\u17F9\u19DA\u2070\u2074-\u2079\u2080-\u2089\u2150-\u215F\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA830-\uA835',
        astral: '\uD804[\uDC52-\uDC65\uDDE1-\uDDF4]|\uD803[\uDCFA-\uDCFF\uDE60-\uDE7E]|\uD83C[\uDD00-\uDD0C]|\uD806[\uDCEA-\uDCF2]|\uD83A[\uDCC7-\uDCCF]|\uD802[\uDC58-\uDC5F\uDC79-\uDC7F\uDCA7-\uDCAF\uDCFB-\uDCFF\uDD16-\uDD1B\uDDBC\uDDBD\uDDC0-\uDDCF\uDDD2-\uDDFF\uDE40-\uDE47\uDE7D\uDE7E\uDE9D-\uDE9F\uDEEB-\uDEEF\uDF58-\uDF5F\uDF78-\uDF7F\uDFA9-\uDFAF]|\uD805[\uDF3A\uDF3B]|\uD81A[\uDF5B-\uDF61]|\uD834[\uDF60-\uDF71]|\uD800[\uDD07-\uDD33\uDD75-\uDD78\uDD8A\uDD8B\uDEE1-\uDEFB\uDF20-\uDF23]'
    },
    {
        name: 'P',
        alias: 'Punctuation',
        bmp: '\x21-\x23\x25-\\x2A\x2C-\x2F\x3A\x3B\\x3F\x40\\x5B-\\x5D\x5F\\x7B\x7D\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65',
        astral: '\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD809[\uDC70-\uDC74]|\uD805[\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDF3C-\uDF3E]|\uD836[\uDE87-\uDE8B]|\uD801\uDD6F|\uD82F\uDC9F|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]'
    },
    {
        name: 'Pc',
        alias: 'Connector_Punctuation',
        bmp: '\x5F\u203F\u2040\u2054\uFE33\uFE34\uFE4D-\uFE4F\uFF3F'
    },
    {
        name: 'Pd',
        alias: 'Dash_Punctuation',
        bmp: '\\x2D\u058A\u05BE\u1400\u1806\u2010-\u2015\u2E17\u2E1A\u2E3A\u2E3B\u2E40\u301C\u3030\u30A0\uFE31\uFE32\uFE58\uFE63\uFF0D'
    },
    {
        name: 'Pe',
        alias: 'Close_Punctuation',
        bmp: '\\x29\\x5D\x7D\u0F3B\u0F3D\u169C\u2046\u207E\u208E\u2309\u230B\u232A\u2769\u276B\u276D\u276F\u2771\u2773\u2775\u27C6\u27E7\u27E9\u27EB\u27ED\u27EF\u2984\u2986\u2988\u298A\u298C\u298E\u2990\u2992\u2994\u2996\u2998\u29D9\u29DB\u29FD\u2E23\u2E25\u2E27\u2E29\u3009\u300B\u300D\u300F\u3011\u3015\u3017\u3019\u301B\u301E\u301F\uFD3E\uFE18\uFE36\uFE38\uFE3A\uFE3C\uFE3E\uFE40\uFE42\uFE44\uFE48\uFE5A\uFE5C\uFE5E\uFF09\uFF3D\uFF5D\uFF60\uFF63'
    },
    {
        name: 'Pf',
        alias: 'Final_Punctuation',
        bmp: '\xBB\u2019\u201D\u203A\u2E03\u2E05\u2E0A\u2E0D\u2E1D\u2E21'
    },
    {
        name: 'Pi',
        alias: 'Initial_Punctuation',
        bmp: '\xAB\u2018\u201B\u201C\u201F\u2039\u2E02\u2E04\u2E09\u2E0C\u2E1C\u2E20'
    },
    {
        name: 'Po',
        alias: 'Other_Punctuation',
        bmp: '\x21-\x23\x25-\x27\\x2A\x2C\\x2E\x2F\x3A\x3B\\x3F\x40\\x5C\xA1\xA7\xB6\xB7\xBF\u037E\u0387\u055A-\u055F\u0589\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u166D\u166E\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u1805\u1807-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2016\u2017\u2020-\u2027\u2030-\u2038\u203B-\u203E\u2041-\u2043\u2047-\u2051\u2053\u2055-\u205E\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00\u2E01\u2E06-\u2E08\u2E0B\u2E0E-\u2E16\u2E18\u2E19\u2E1B\u2E1E\u2E1F\u2E2A-\u2E2E\u2E30-\u2E39\u2E3C-\u2E3F\u2E41\u3001-\u3003\u303D\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFE10-\uFE16\uFE19\uFE30\uFE45\uFE46\uFE49-\uFE4C\uFE50-\uFE52\uFE54-\uFE57\uFE5F-\uFE61\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF07\uFF0A\uFF0C\uFF0E\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3C\uFF61\uFF64\uFF65',
        astral: '\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD809[\uDC70-\uDC74]|\uD805[\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDF3C-\uDF3E]|\uD836[\uDE87-\uDE8B]|\uD801\uDD6F|\uD82F\uDC9F|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]'
    },
    {
        name: 'Ps',
        alias: 'Open_Punctuation',
        bmp: '\\x28\\x5B\\x7B\u0F3A\u0F3C\u169B\u201A\u201E\u2045\u207D\u208D\u2308\u230A\u2329\u2768\u276A\u276C\u276E\u2770\u2772\u2774\u27C5\u27E6\u27E8\u27EA\u27EC\u27EE\u2983\u2985\u2987\u2989\u298B\u298D\u298F\u2991\u2993\u2995\u2997\u29D8\u29DA\u29FC\u2E22\u2E24\u2E26\u2E28\u2E42\u3008\u300A\u300C\u300E\u3010\u3014\u3016\u3018\u301A\u301D\uFD3F\uFE17\uFE35\uFE37\uFE39\uFE3B\uFE3D\uFE3F\uFE41\uFE43\uFE47\uFE59\uFE5B\uFE5D\uFF08\uFF3B\uFF5B\uFF5F\uFF62'
    },
    {
        name: 'S',
        alias: 'Symbol',
        bmp: '\\x24\\x2B\x3C-\x3E\\x5E\x60\\x7C\x7E\xA2-\xA6\xA8\xA9\xAC\xAE-\xB1\xB4\xB8\xD7\xF7\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u03F6\u0482\u058D-\u058F\u0606-\u0608\u060B\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u09F2\u09F3\u09FA\u09FB\u0AF1\u0B70\u0BF3-\u0BFA\u0C7F\u0D79\u0E3F\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u17DB\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u2044\u2052\u207A-\u207C\u208A-\u208C\u20A0-\u20BE\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u2140-\u2144\u214A-\u214D\u214F\u218A\u218B\u2190-\u2307\u230C-\u2328\u232B-\u23FA\u2400-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u2767\u2794-\u27C4\u27C7-\u27E5\u27F0-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2B73\u2B76-\u2B95\u2B98-\u2BB9\u2BBD-\u2BC8\u2BCA-\u2BD1\u2BEC-\u2BEF\u2CE5-\u2CEA\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFB\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u309B\u309C\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u32FE\u3300-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA700-\uA716\uA720\uA721\uA789\uA78A\uA828-\uA82B\uA836-\uA839\uAA77-\uAA79\uAB5B\uFB29\uFBB2-\uFBC1\uFDFC\uFDFD\uFE62\uFE64-\uFE66\uFE69\uFF04\uFF0B\uFF1C-\uFF1E\uFF3E\uFF40\uFF5C\uFF5E\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFFC\uFFFD',
        astral: '\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDD10-\uDD18\uDD80-\uDD84\uDDC0]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD10-\uDD2E\uDD30-\uDD6B\uDD70-\uDD9A\uDDE6-\uDE02\uDE10-\uDE3A\uDE40-\uDE48\uDE50\uDE51\uDF00-\uDFFF]|\uD83D[\uDC00-\uDD79\uDD7B-\uDDA3\uDDA5-\uDED0\uDEE0-\uDEEC\uDEF0-\uDEF3\uDF00-\uDF73\uDF80-\uDFD4]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C\uDD90-\uDD9B\uDDA0\uDDD0-\uDDFC]|\uD82F\uDC9C|\uD805\uDF3F|\uD802[\uDC77\uDC78\uDEC8]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDE8\uDE00-\uDE41\uDE45\uDF00-\uDF56]|\uD83B[\uDEF0\uDEF1]'
    },
    {
        name: 'Sc',
        alias: 'Currency_Symbol',
        bmp: '\\x24\xA2-\xA5\u058F\u060B\u09F2\u09F3\u09FB\u0AF1\u0BF9\u0E3F\u17DB\u20A0-\u20BE\uA838\uFDFC\uFE69\uFF04\uFFE0\uFFE1\uFFE5\uFFE6'
    },
    {
        name: 'Sk',
        alias: 'Modifier_Symbol',
        bmp: '\\x5E\x60\xA8\xAF\xB4\xB8\u02C2-\u02C5\u02D2-\u02DF\u02E5-\u02EB\u02ED\u02EF-\u02FF\u0375\u0384\u0385\u1FBD\u1FBF-\u1FC1\u1FCD-\u1FCF\u1FDD-\u1FDF\u1FED-\u1FEF\u1FFD\u1FFE\u309B\u309C\uA700-\uA716\uA720\uA721\uA789\uA78A\uAB5B\uFBB2-\uFBC1\uFF3E\uFF40\uFFE3',
        astral: '\uD83C[\uDFFB-\uDFFF]'
    },
    {
        name: 'Sm',
        alias: 'Math_Symbol',
        bmp: '\\x2B\x3C-\x3E\\x7C\x7E\xAC\xB1\xD7\xF7\u03F6\u0606-\u0608\u2044\u2052\u207A-\u207C\u208A-\u208C\u2118\u2140-\u2144\u214B\u2190-\u2194\u219A\u219B\u21A0\u21A3\u21A6\u21AE\u21CE\u21CF\u21D2\u21D4\u21F4-\u22FF\u2320\u2321\u237C\u239B-\u23B3\u23DC-\u23E1\u25B7\u25C1\u25F8-\u25FF\u266F\u27C0-\u27C4\u27C7-\u27E5\u27F0-\u27FF\u2900-\u2982\u2999-\u29D7\u29DC-\u29FB\u29FE-\u2AFF\u2B30-\u2B44\u2B47-\u2B4C\uFB29\uFE62\uFE64-\uFE66\uFF0B\uFF1C-\uFF1E\uFF5C\uFF5E\uFFE2\uFFE9-\uFFEC',
        astral: '\uD83B[\uDEF0\uDEF1]|\uD835[\uDEC1\uDEDB\uDEFB\uDF15\uDF35\uDF4F\uDF6F\uDF89\uDFA9\uDFC3]'
    },
    {
        name: 'So',
        alias: 'Other_Symbol',
        bmp: '\xA6\xA9\xAE\xB0\u0482\u058D\u058E\u060E\u060F\u06DE\u06E9\u06FD\u06FE\u07F6\u09FA\u0B70\u0BF3-\u0BF8\u0BFA\u0C7F\u0D79\u0F01-\u0F03\u0F13\u0F15-\u0F17\u0F1A-\u0F1F\u0F34\u0F36\u0F38\u0FBE-\u0FC5\u0FC7-\u0FCC\u0FCE\u0FCF\u0FD5-\u0FD8\u109E\u109F\u1390-\u1399\u1940\u19DE-\u19FF\u1B61-\u1B6A\u1B74-\u1B7C\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116\u2117\u211E-\u2123\u2125\u2127\u2129\u212E\u213A\u213B\u214A\u214C\u214D\u214F\u218A\u218B\u2195-\u2199\u219C-\u219F\u21A1\u21A2\u21A4\u21A5\u21A7-\u21AD\u21AF-\u21CD\u21D0\u21D1\u21D3\u21D5-\u21F3\u2300-\u2307\u230C-\u231F\u2322-\u2328\u232B-\u237B\u237D-\u239A\u23B4-\u23DB\u23E2-\u23FA\u2400-\u2426\u2440-\u244A\u249C-\u24E9\u2500-\u25B6\u25B8-\u25C0\u25C2-\u25F7\u2600-\u266E\u2670-\u2767\u2794-\u27BF\u2800-\u28FF\u2B00-\u2B2F\u2B45\u2B46\u2B4D-\u2B73\u2B76-\u2B95\u2B98-\u2BB9\u2BBD-\u2BC8\u2BCA-\u2BD1\u2BEC-\u2BEF\u2CE5-\u2CEA\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u2FF0-\u2FFB\u3004\u3012\u3013\u3020\u3036\u3037\u303E\u303F\u3190\u3191\u3196-\u319F\u31C0-\u31E3\u3200-\u321E\u322A-\u3247\u3250\u3260-\u327F\u328A-\u32B0\u32C0-\u32FE\u3300-\u33FF\u4DC0-\u4DFF\uA490-\uA4C6\uA828-\uA82B\uA836\uA837\uA839\uAA77-\uAA79\uFDFD\uFFE4\uFFE8\uFFED\uFFEE\uFFFC\uFFFD',
        astral: '\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDD10-\uDD18\uDD80-\uDD84\uDDC0]|\uD83D[\uDC00-\uDD79\uDD7B-\uDDA3\uDDA5-\uDED0\uDEE0-\uDEEC\uDEF0-\uDEF3\uDF00-\uDF73\uDF80-\uDFD4]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD10-\uDD2E\uDD30-\uDD6B\uDD70-\uDD9A\uDDE6-\uDE02\uDE10-\uDE3A\uDE40-\uDE48\uDE50\uDE51\uDF00-\uDFFA]|\uD800[\uDD37-\uDD3F\uDD79-\uDD89\uDD8C\uDD90-\uDD9B\uDDA0\uDDD0-\uDDFC]|\uD82F\uDC9C|\uD805\uDF3F|\uD802[\uDC77\uDC78\uDEC8]|\uD81A[\uDF3C-\uDF3F\uDF45]|\uD836[\uDC00-\uDDFF\uDE37-\uDE3A\uDE6D-\uDE74\uDE76-\uDE83\uDE85\uDE86]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD64\uDD6A-\uDD6C\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDE8\uDE00-\uDE41\uDE45\uDF00-\uDF56]'
    },
    {
        name: 'Z',
        alias: 'Separator',
        bmp: '\x20\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000'
    },
    {
        name: 'Zl',
        alias: 'Line_Separator',
        bmp: '\u2028'
    },
    {
        name: 'Zp',
        alias: 'Paragraph_Separator',
        bmp: '\u2029'
    },
    {
        name: 'Zs',
        alias: 'Space_Separator',
        bmp: '\x20\xA0\u1680\u2000-\u200A\u202F\u205F\u3000'
    }
]);



/*!
 * XRegExp Unicode Properties 
 * <xregexp.com>
 * Steven Levithan (c) 2012-2016 MIT License
 * Unicode data by Mathias Bynens <mathiasbynens.be>
 */





/**
 * Adds properties to meet the UTS #18 Level 1 RL1.2 requirements for Unicode regex support. See
 * <http://unicode.org/reports/tr18/#RL1.2>. Following are definitions of these properties from
 * UAX #44 <http://unicode.org/reports/tr44/>:
 *
 * - Alphabetic
 *   Characters with the Alphabetic property. Generated from: Lowercase + Uppercase + Lt + Lm +
 *   Lo + Nl + Other_Alphabetic.
 *
 * - Default_Ignorable_Code_Point
 *   For programmatic determination of default ignorable code points. New characters that should
 *   be ignored in rendering (unless explicitly supported) will be assigned in these ranges,
 *   permitting programs to correctly handle the default rendering of such characters when not
 *   otherwise supported.
 *
 * - Lowercase
 *   Characters with the Lowercase property. Generated from: Ll + Other_Lowercase.
 *
 * - Noncharacter_Code_Point
 *   Code points permanently reserved for internal use.
 *
 * - Uppercase
 *   Characters with the Uppercase property. Generated from: Lu + Other_Uppercase.
 *
 * - White_Space
 *   Spaces, separator characters and other control characters which should be treated by
 *   programming languages as "white space" for the purpose of parsing elements.
 *
 * The properties ASCII, Any, and Assigned are also included but are not defined in UAX #44. UTS
 * #18 RL1.2 additionally requires support for Unicode scripts and general categories. These are
 * included in XRegExp's Unicode Categories and Unicode Scripts addons.
 *
 * Token names are case insensitive, and any spaces, hyphens, and underscores are ignored.
 *
 * Uses Unicode 8.0.0.
 *
 * @requires XRegExp, Unicode Base
 */

if (!XRegExp.addUnicodeData) {
    throw new ReferenceError('Unicode Base must be loaded before Unicode Properties');
}

var unicodeData = [
    {
        name: 'ASCII',
        bmp: '\0-\x7F'
    },
    {
        name: 'Alphabetic',
        bmp: 'A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0345\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05B0-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0657\u0659-\u065F\u066E-\u06D3\u06D5-\u06DC\u06E1-\u06E8\u06ED-\u06EF\u06FA-\u06FC\u06FF\u0710-\u073F\u074D-\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0817\u081A-\u082C\u0840-\u0858\u08A0-\u08B4\u08E3-\u08E9\u08F0-\u093B\u093D-\u094C\u094E-\u0950\u0955-\u0963\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD-\u09C4\u09C7\u09C8\u09CB\u09CC\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09F0\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3E-\u0A42\u0A47\u0A48\u0A4B\u0A4C\u0A51\u0A59-\u0A5C\u0A5E\u0A70-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD-\u0AC5\u0AC7-\u0AC9\u0ACB\u0ACC\u0AD0\u0AE0-\u0AE3\u0AF9\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D-\u0B44\u0B47\u0B48\u0B4B\u0B4C\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCC\u0BD0\u0BD7\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4C\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCC\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4C\u0D4E\u0D57\u0D5F-\u0D63\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E46\u0E4D\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0ECD\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F71-\u0F81\u0F88-\u0F97\u0F99-\u0FBC\u1000-\u1036\u1038\u103B-\u103F\u1050-\u1062\u1065-\u1068\u106E-\u1086\u108E\u109C\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1713\u1720-\u1733\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17B3\u17B6-\u17C8\u17D7\u17DC\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u1938\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A1B\u1A20-\u1A5E\u1A61-\u1A74\u1AA7\u1B00-\u1B33\u1B35-\u1B43\u1B45-\u1B4B\u1B80-\u1BA9\u1BAC-\u1BAF\u1BBA-\u1BE5\u1BE7-\u1BF1\u1C00-\u1C35\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u1D00-\u1DBF\u1DE7-\u1DF4\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u24B6-\u24E9\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA674-\uA67B\uA67F-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA827\uA840-\uA873\uA880-\uA8C3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA92A\uA930-\uA952\uA960-\uA97C\uA980-\uA9B2\uA9B4-\uA9BF\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA60-\uAA76\uAA7A\uAA7E-\uAABE\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF5\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC',
        astral: '\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD804[\uDC00-\uDC45\uDC82-\uDCB8\uDCD0-\uDCE8\uDD00-\uDD32\uDD50-\uDD72\uDD76\uDD80-\uDDBF\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE34\uDE37\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEE8\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D-\uDF44\uDF47\uDF48\uDF4B\uDF4C\uDF50\uDF57\uDF5D-\uDF63]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD83A[\uDC00-\uDCC4]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF36\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD801[\uDC00-\uDC9D\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD83C[\uDD30-\uDD49\uDD50-\uDD69\uDD70-\uDD89]|\uD80D[\uDC00-\uDC2E]|\uD87E[\uDC00-\uDE1D]|[\uD80C\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9E]|\uD808[\uDC00-\uDF99]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD805[\uDC80-\uDCC1\uDCC4\uDCC5\uDCC7\uDD80-\uDDB5\uDDB8-\uDDBE\uDDD8-\uDDDD\uDE00-\uDE3E\uDE40\uDE44\uDE80-\uDEB5\uDF00-\uDF19\uDF1D-\uDF2A]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|\uD806[\uDCA0-\uDCDF\uDCFF\uDEC0-\uDEF8]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF30-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD811[\uDC00-\uDE46]|\uD82C[\uDC00\uDC01]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF93-\uDF9F]|\uD873[\uDC00-\uDEA1]'
    },
    {
        name: 'Any',
        isBmpLast: true,
        bmp: '\0-\uFFFF',
        astral: '[\uD800-\uDBFF][\uDC00-\uDFFF]'
    },
    {
        name: 'Default_Ignorable_Code_Point',
        bmp: '\xAD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8',
        astral: '[\uDB40-\uDB43][\uDC00-\uDFFF]|\uD834[\uDD73-\uDD7A]|\uD82F[\uDCA0-\uDCA3]'
    },
    {
        name: 'Lowercase',
        bmp: 'a-z\xAA\xB5\xBA\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02B8\u02C0\u02C1\u02E0-\u02E4\u0345\u0371\u0373\u0377\u037A-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1DBF\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u2071\u207F\u2090-\u209C\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2170-\u217F\u2184\u24D0-\u24E9\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7D\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B-\uA69D\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7F8-\uA7FA\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A',
        astral: '\uD803[\uDCC0-\uDCF2]|\uD835[\uDC1A-\uDC33\uDC4E-\uDC54\uDC56-\uDC67\uDC82-\uDC9B\uDCB6-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDCEA-\uDD03\uDD1E-\uDD37\uDD52-\uDD6B\uDD86-\uDD9F\uDDBA-\uDDD3\uDDEE-\uDE07\uDE22-\uDE3B\uDE56-\uDE6F\uDE8A-\uDEA5\uDEC2-\uDEDA\uDEDC-\uDEE1\uDEFC-\uDF14\uDF16-\uDF1B\uDF36-\uDF4E\uDF50-\uDF55\uDF70-\uDF88\uDF8A-\uDF8F\uDFAA-\uDFC2\uDFC4-\uDFC9\uDFCB]|\uD801[\uDC28-\uDC4F]|\uD806[\uDCC0-\uDCDF]'
    },
    {
        name: 'Noncharacter_Code_Point',
        bmp: '\uFDD0-\uFDEF\uFFFE\uFFFF',
        astral: '[\uDB3F\uDB7F\uDBBF\uDBFF\uD83F\uD87F\uD8BF\uDAFF\uD97F\uD9BF\uD9FF\uDA3F\uD8FF\uDABF\uDA7F\uD93F][\uDFFE\uDFFF]'
    },
    {
        name: 'Uppercase',
        bmp: 'A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2160-\u216F\u2183\u24B6-\u24CF\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A',
        astral: '\uD806[\uDCA0-\uDCBF]|\uD803[\uDC80-\uDCB2]|\uD835[\uDC00-\uDC19\uDC34-\uDC4D\uDC68-\uDC81\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB5\uDCD0-\uDCE9\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD38\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD6C-\uDD85\uDDA0-\uDDB9\uDDD4-\uDDED\uDE08-\uDE21\uDE3C-\uDE55\uDE70-\uDE89\uDEA8-\uDEC0\uDEE2-\uDEFA\uDF1C-\uDF34\uDF56-\uDF6E\uDF90-\uDFA8\uDFCA]|\uD801[\uDC00-\uDC27]|\uD83C[\uDD30-\uDD49\uDD50-\uDD69\uDD70-\uDD89]'
    },
    {
        name: 'White_Space',
        bmp: '\x09-\x0D\x20\x85\xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000'
    }
];

// Add non-generated data
unicodeData.push({
    name: 'Assigned',
    // Since this is defined as the inverse of Unicode category Cn (Unassigned), the Unicode
    // Categories addon is required to use this property
    inverseOf: 'Cn'
});

XRegExp.addUnicodeData(unicodeData);



/*!
 * XRegExp Unicode Scripts 
 * <xregexp.com>
 * Steven Levithan (c) 2010-2016 MIT License
 * Unicode data by Mathias Bynens <mathiasbynens.be>
 */





/**
 * Adds support for all Unicode scripts. E.g., `\p{Latin}`. Token names are case insensitive,
 * and any spaces, hyphens, and underscores are ignored.
 *
 * Uses Unicode 8.0.0.
 *
 * @requires XRegExp, Unicode Base
 */

if (!XRegExp.addUnicodeData) {
    throw new ReferenceError('Unicode Base must be loaded before Unicode Scripts');
}

XRegExp.addUnicodeData([
    {
        name: 'Ahom',
        astral: '\uD805[\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF3F]'
    },
    {
        name: 'Anatolian_Hieroglyphs',
        astral: '\uD811[\uDC00-\uDE46]'
    },
    {
        name: 'Arabic',
        bmp: '\u0600-\u0604\u0606-\u060B\u060D-\u061A\u061E\u0620-\u063F\u0641-\u064A\u0656-\u066F\u0671-\u06DC\u06DE-\u06FF\u0750-\u077F\u08A0-\u08B4\u08E3-\u08FF\uFB50-\uFBC1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFD\uFE70-\uFE74\uFE76-\uFEFC',
        astral: '\uD803[\uDE60-\uDE7E]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB\uDEF0\uDEF1]'
    },
    {
        name: 'Armenian',
        bmp: '\u0531-\u0556\u0559-\u055F\u0561-\u0587\u058A\u058D-\u058F\uFB13-\uFB17'
    },
    {
        name: 'Avestan',
        astral: '\uD802[\uDF00-\uDF35\uDF39-\uDF3F]'
    },
    {
        name: 'Balinese',
        bmp: '\u1B00-\u1B4B\u1B50-\u1B7C'
    },
    {
        name: 'Bamum',
        bmp: '\uA6A0-\uA6F7',
        astral: '\uD81A[\uDC00-\uDE38]'
    },
    {
        name: 'Bassa_Vah',
        astral: '\uD81A[\uDED0-\uDEED\uDEF0-\uDEF5]'
    },
    {
        name: 'Batak',
        bmp: '\u1BC0-\u1BF3\u1BFC-\u1BFF'
    },
    {
        name: 'Bengali',
        bmp: '\u0980-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09FB'
    },
    {
        name: 'Bopomofo',
        bmp: '\u02EA\u02EB\u3105-\u312D\u31A0-\u31BA'
    },
    {
        name: 'Brahmi',
        astral: '\uD804[\uDC00-\uDC4D\uDC52-\uDC6F\uDC7F]'
    },
    {
        name: 'Braille',
        bmp: '\u2800-\u28FF'
    },
    {
        name: 'Buginese',
        bmp: '\u1A00-\u1A1B\u1A1E\u1A1F'
    },
    {
        name: 'Buhid',
        bmp: '\u1740-\u1753'
    },
    {
        name: 'Canadian_Aboriginal',
        bmp: '\u1400-\u167F\u18B0-\u18F5'
    },
    {
        name: 'Carian',
        astral: '\uD800[\uDEA0-\uDED0]'
    },
    {
        name: 'Caucasian_Albanian',
        astral: '\uD801[\uDD30-\uDD63\uDD6F]'
    },
    {
        name: 'Chakma',
        astral: '\uD804[\uDD00-\uDD34\uDD36-\uDD43]'
    },
    {
        name: 'Cham',
        bmp: '\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA5C-\uAA5F'
    },
    {
        name: 'Cherokee',
        bmp: '\u13A0-\u13F5\u13F8-\u13FD\uAB70-\uABBF'
    },
    {
        name: 'Common',
        bmp: '\0-\x40\\x5B-\x60\\x7B-\xA9\xAB-\xB9\xBB-\xBF\xD7\xF7\u02B9-\u02DF\u02E5-\u02E9\u02EC-\u02FF\u0374\u037E\u0385\u0387\u0589\u0605\u060C\u061B\u061C\u061F\u0640\u06DD\u0964\u0965\u0E3F\u0FD5-\u0FD8\u10FB\u16EB-\u16ED\u1735\u1736\u1802\u1803\u1805\u1CD3\u1CE1\u1CE9-\u1CEC\u1CEE-\u1CF3\u1CF5\u1CF6\u2000-\u200B\u200E-\u2064\u2066-\u2070\u2074-\u207E\u2080-\u208E\u20A0-\u20BE\u2100-\u2125\u2127-\u2129\u212C-\u2131\u2133-\u214D\u214F-\u215F\u2189-\u218B\u2190-\u23FA\u2400-\u2426\u2440-\u244A\u2460-\u27FF\u2900-\u2B73\u2B76-\u2B95\u2B98-\u2BB9\u2BBD-\u2BC8\u2BCA-\u2BD1\u2BEC-\u2BEF\u2E00-\u2E42\u2FF0-\u2FFB\u3000-\u3004\u3006\u3008-\u3020\u3030-\u3037\u303C-\u303F\u309B\u309C\u30A0\u30FB\u30FC\u3190-\u319F\u31C0-\u31E3\u3220-\u325F\u327F-\u32CF\u3358-\u33FF\u4DC0-\u4DFF\uA700-\uA721\uA788-\uA78A\uA830-\uA839\uA92E\uA9CF\uAB5B\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE66\uFE68-\uFE6B\uFEFF\uFF01-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\uFF70\uFF9E\uFF9F\uFFE0-\uFFE6\uFFE8-\uFFEE\uFFF9-\uFFFD',
        astral: '\uD83E[\uDC00-\uDC0B\uDC10-\uDC47\uDC50-\uDC59\uDC60-\uDC87\uDC90-\uDCAD\uDD10-\uDD18\uDD80-\uDD84\uDDC0]|\uD82F[\uDCA0-\uDCA3]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDFCB\uDFCE-\uDFFF]|\uDB40[\uDC01\uDC20-\uDC7F]|\uD83D[\uDC00-\uDD79\uDD7B-\uDDA3\uDDA5-\uDED0\uDEE0-\uDEEC\uDEF0-\uDEF3\uDF00-\uDF73\uDF80-\uDFD4]|\uD800[\uDD00-\uDD02\uDD07-\uDD33\uDD37-\uDD3F\uDD90-\uDD9B\uDDD0-\uDDFC\uDEE1-\uDEFB]|\uD834[\uDC00-\uDCF5\uDD00-\uDD26\uDD29-\uDD66\uDD6A-\uDD7A\uDD83\uDD84\uDD8C-\uDDA9\uDDAE-\uDDE8\uDF00-\uDF56\uDF60-\uDF71]|\uD83C[\uDC00-\uDC2B\uDC30-\uDC93\uDCA0-\uDCAE\uDCB1-\uDCBF\uDCC1-\uDCCF\uDCD1-\uDCF5\uDD00-\uDD0C\uDD10-\uDD2E\uDD30-\uDD6B\uDD70-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE10-\uDE3A\uDE40-\uDE48\uDE50\uDE51\uDF00-\uDFFF]'
    },
    {
        name: 'Coptic',
        bmp: '\u03E2-\u03EF\u2C80-\u2CF3\u2CF9-\u2CFF'
    },
    {
        name: 'Cuneiform',
        astral: '\uD809[\uDC00-\uDC6E\uDC70-\uDC74\uDC80-\uDD43]|\uD808[\uDC00-\uDF99]'
    },
    {
        name: 'Cypriot',
        astral: '\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F]'
    },
    {
        name: 'Cyrillic',
        bmp: '\u0400-\u0484\u0487-\u052F\u1D2B\u1D78\u2DE0-\u2DFF\uA640-\uA69F\uFE2E\uFE2F'
    },
    {
        name: 'Deseret',
        astral: '\uD801[\uDC00-\uDC4F]'
    },
    {
        name: 'Devanagari',
        bmp: '\u0900-\u0950\u0953-\u0963\u0966-\u097F\uA8E0-\uA8FD'
    },
    {
        name: 'Duployan',
        astral: '\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9C-\uDC9F]'
    },
    {
        name: 'Egyptian_Hieroglyphs',
        astral: '\uD80C[\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]'
    },
    {
        name: 'Elbasan',
        astral: '\uD801[\uDD00-\uDD27]'
    },
    {
        name: 'Ethiopic',
        bmp: '\u1200-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u137C\u1380-\u1399\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E'
    },
    {
        name: 'Georgian',
        bmp: '\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u10FF\u2D00-\u2D25\u2D27\u2D2D'
    },
    {
        name: 'Glagolitic',
        bmp: '\u2C00-\u2C2E\u2C30-\u2C5E'
    },
    {
        name: 'Gothic',
        astral: '\uD800[\uDF30-\uDF4A]'
    },
    {
        name: 'Grantha',
        astral: '\uD804[\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]'
    },
    {
        name: 'Greek',
        bmp: '\u0370-\u0373\u0375-\u0377\u037A-\u037D\u037F\u0384\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03E1\u03F0-\u03FF\u1D26-\u1D2A\u1D5D-\u1D61\u1D66-\u1D6A\u1DBF\u1F00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FC4\u1FC6-\u1FD3\u1FD6-\u1FDB\u1FDD-\u1FEF\u1FF2-\u1FF4\u1FF6-\u1FFE\u2126\uAB65',
        astral: '\uD800[\uDD40-\uDD8C\uDDA0]|\uD834[\uDE00-\uDE45]'
    },
    {
        name: 'Gujarati',
        bmp: '\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AF1\u0AF9'
    },
    {
        name: 'Gurmukhi',
        bmp: '\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75'
    },
    {
        name: 'Han',
        bmp: '\u2E80-\u2E99\u2E9B-\u2EF3\u2F00-\u2FD5\u3005\u3007\u3021-\u3029\u3038-\u303B\u3400-\u4DB5\u4E00-\u9FD5\uF900-\uFA6D\uFA70-\uFAD9',
        astral: '\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|[\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872][\uDC00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD87E[\uDC00-\uDE1D]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD873[\uDC00-\uDEA1]'
    },
    {
        name: 'Hangul',
        bmp: '\u1100-\u11FF\u302E\u302F\u3131-\u318E\u3200-\u321E\u3260-\u327E\uA960-\uA97C\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC'
    },
    {
        name: 'Hanunoo',
        bmp: '\u1720-\u1734'
    },
    {
        name: 'Hatran',
        astral: '\uD802[\uDCE0-\uDCF2\uDCF4\uDCF5\uDCFB-\uDCFF]'
    },
    {
        name: 'Hebrew',
        bmp: '\u0591-\u05C7\u05D0-\u05EA\u05F0-\u05F4\uFB1D-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFB4F'
    },
    {
        name: 'Hiragana',
        bmp: '\u3041-\u3096\u309D-\u309F',
        astral: '\uD82C\uDC01|\uD83C\uDE00'
    },
    {
        name: 'Imperial_Aramaic',
        astral: '\uD802[\uDC40-\uDC55\uDC57-\uDC5F]'
    },
    {
        name: 'Inherited',
        bmp: '\u0300-\u036F\u0485\u0486\u064B-\u0655\u0670\u0951\u0952\u1AB0-\u1ABE\u1CD0-\u1CD2\u1CD4-\u1CE0\u1CE2-\u1CE8\u1CED\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u200C\u200D\u20D0-\u20F0\u302A-\u302D\u3099\u309A\uFE00-\uFE0F\uFE20-\uFE2D',
        astral: '\uD834[\uDD67-\uDD69\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD]|\uD800[\uDDFD\uDEE0]|\uDB40[\uDD00-\uDDEF]'
    },
    {
        name: 'Inscriptional_Pahlavi',
        astral: '\uD802[\uDF60-\uDF72\uDF78-\uDF7F]'
    },
    {
        name: 'Inscriptional_Parthian',
        astral: '\uD802[\uDF40-\uDF55\uDF58-\uDF5F]'
    },
    {
        name: 'Javanese',
        bmp: '\uA980-\uA9CD\uA9D0-\uA9D9\uA9DE\uA9DF'
    },
    {
        name: 'Kaithi',
        astral: '\uD804[\uDC80-\uDCC1]'
    },
    {
        name: 'Kannada',
        bmp: '\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2'
    },
    {
        name: 'Katakana',
        bmp: '\u30A1-\u30FA\u30FD-\u30FF\u31F0-\u31FF\u32D0-\u32FE\u3300-\u3357\uFF66-\uFF6F\uFF71-\uFF9D',
        astral: '\uD82C\uDC00'
    },
    {
        name: 'Kayah_Li',
        bmp: '\uA900-\uA92D\uA92F'
    },
    {
        name: 'Kharoshthi',
        astral: '\uD802[\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F-\uDE47\uDE50-\uDE58]'
    },
    {
        name: 'Khmer',
        bmp: '\u1780-\u17DD\u17E0-\u17E9\u17F0-\u17F9\u19E0-\u19FF'
    },
    {
        name: 'Khojki',
        astral: '\uD804[\uDE00-\uDE11\uDE13-\uDE3D]'
    },
    {
        name: 'Khudawadi',
        astral: '\uD804[\uDEB0-\uDEEA\uDEF0-\uDEF9]'
    },
    {
        name: 'Lao',
        bmp: '\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF'
    },
    {
        name: 'Latin',
        bmp: 'A-Za-z\xAA\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02B8\u02E0-\u02E4\u1D00-\u1D25\u1D2C-\u1D5C\u1D62-\u1D65\u1D6B-\u1D77\u1D79-\u1DBE\u1E00-\u1EFF\u2071\u207F\u2090-\u209C\u212A\u212B\u2132\u214E\u2160-\u2188\u2C60-\u2C7F\uA722-\uA787\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA7FF\uAB30-\uAB5A\uAB5C-\uAB64\uFB00-\uFB06\uFF21-\uFF3A\uFF41-\uFF5A'
    },
    {
        name: 'Lepcha',
        bmp: '\u1C00-\u1C37\u1C3B-\u1C49\u1C4D-\u1C4F'
    },
    {
        name: 'Limbu',
        bmp: '\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1940\u1944-\u194F'
    },
    {
        name: 'Linear_A',
        astral: '\uD801[\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]'
    },
    {
        name: 'Linear_B',
        astral: '\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA]'
    },
    {
        name: 'Lisu',
        bmp: '\uA4D0-\uA4FF'
    },
    {
        name: 'Lycian',
        astral: '\uD800[\uDE80-\uDE9C]'
    },
    {
        name: 'Lydian',
        astral: '\uD802[\uDD20-\uDD39\uDD3F]'
    },
    {
        name: 'Mahajani',
        astral: '\uD804[\uDD50-\uDD76]'
    },
    {
        name: 'Malayalam',
        bmp: '\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D5F-\u0D63\u0D66-\u0D75\u0D79-\u0D7F'
    },
    {
        name: 'Mandaic',
        bmp: '\u0840-\u085B\u085E'
    },
    {
        name: 'Manichaean',
        astral: '\uD802[\uDEC0-\uDEE6\uDEEB-\uDEF6]'
    },
    {
        name: 'Meetei_Mayek',
        bmp: '\uAAE0-\uAAF6\uABC0-\uABED\uABF0-\uABF9'
    },
    {
        name: 'Mende_Kikakui',
        astral: '\uD83A[\uDC00-\uDCC4\uDCC7-\uDCD6]'
    },
    {
        name: 'Meroitic_Cursive',
        astral: '\uD802[\uDDA0-\uDDB7\uDDBC-\uDDCF\uDDD2-\uDDFF]'
    },
    {
        name: 'Meroitic_Hieroglyphs',
        astral: '\uD802[\uDD80-\uDD9F]'
    },
    {
        name: 'Miao',
        astral: '\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F]'
    },
    {
        name: 'Modi',
        astral: '\uD805[\uDE00-\uDE44\uDE50-\uDE59]'
    },
    {
        name: 'Mongolian',
        bmp: '\u1800\u1801\u1804\u1806-\u180E\u1810-\u1819\u1820-\u1877\u1880-\u18AA'
    },
    {
        name: 'Mro',
        astral: '\uD81A[\uDE40-\uDE5E\uDE60-\uDE69\uDE6E\uDE6F]'
    },
    {
        name: 'Multani',
        astral: '\uD804[\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA9]'
    },
    {
        name: 'Myanmar',
        bmp: '\u1000-\u109F\uA9E0-\uA9FE\uAA60-\uAA7F'
    },
    {
        name: 'Nabataean',
        astral: '\uD802[\uDC80-\uDC9E\uDCA7-\uDCAF]'
    },
    {
        name: 'New_Tai_Lue',
        bmp: '\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19DA\u19DE\u19DF'
    },
    {
        name: 'Nko',
        bmp: '\u07C0-\u07FA'
    },
    {
        name: 'Ogham',
        bmp: '\u1680-\u169C'
    },
    {
        name: 'Ol_Chiki',
        bmp: '\u1C50-\u1C7F'
    },
    {
        name: 'Old_Hungarian',
        astral: '\uD803[\uDC80-\uDCB2\uDCC0-\uDCF2\uDCFA-\uDCFF]'
    },
    {
        name: 'Old_Italic',
        astral: '\uD800[\uDF00-\uDF23]'
    },
    {
        name: 'Old_North_Arabian',
        astral: '\uD802[\uDE80-\uDE9F]'
    },
    {
        name: 'Old_Permic',
        astral: '\uD800[\uDF50-\uDF7A]'
    },
    {
        name: 'Old_Persian',
        astral: '\uD800[\uDFA0-\uDFC3\uDFC8-\uDFD5]'
    },
    {
        name: 'Old_South_Arabian',
        astral: '\uD802[\uDE60-\uDE7F]'
    },
    {
        name: 'Old_Turkic',
        astral: '\uD803[\uDC00-\uDC48]'
    },
    {
        name: 'Oriya',
        bmp: '\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B77'
    },
    {
        name: 'Osmanya',
        astral: '\uD801[\uDC80-\uDC9D\uDCA0-\uDCA9]'
    },
    {
        name: 'Pahawh_Hmong',
        astral: '\uD81A[\uDF00-\uDF45\uDF50-\uDF59\uDF5B-\uDF61\uDF63-\uDF77\uDF7D-\uDF8F]'
    },
    {
        name: 'Palmyrene',
        astral: '\uD802[\uDC60-\uDC7F]'
    },
    {
        name: 'Pau_Cin_Hau',
        astral: '\uD806[\uDEC0-\uDEF8]'
    },
    {
        name: 'Phags_Pa',
        bmp: '\uA840-\uA877'
    },
    {
        name: 'Phoenician',
        astral: '\uD802[\uDD00-\uDD1B\uDD1F]'
    },
    {
        name: 'Psalter_Pahlavi',
        astral: '\uD802[\uDF80-\uDF91\uDF99-\uDF9C\uDFA9-\uDFAF]'
    },
    {
        name: 'Rejang',
        bmp: '\uA930-\uA953\uA95F'
    },
    {
        name: 'Runic',
        bmp: '\u16A0-\u16EA\u16EE-\u16F8'
    },
    {
        name: 'Samaritan',
        bmp: '\u0800-\u082D\u0830-\u083E'
    },
    {
        name: 'Saurashtra',
        bmp: '\uA880-\uA8C4\uA8CE-\uA8D9'
    },
    {
        name: 'Sharada',
        astral: '\uD804[\uDD80-\uDDCD\uDDD0-\uDDDF]'
    },
    {
        name: 'Shavian',
        astral: '\uD801[\uDC50-\uDC7F]'
    },
    {
        name: 'Siddham',
        astral: '\uD805[\uDD80-\uDDB5\uDDB8-\uDDDD]'
    },
    {
        name: 'SignWriting',
        astral: '\uD836[\uDC00-\uDE8B\uDE9B-\uDE9F\uDEA1-\uDEAF]'
    },
    {
        name: 'Sinhala',
        bmp: '\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2-\u0DF4',
        astral: '\uD804[\uDDE1-\uDDF4]'
    },
    {
        name: 'Sora_Sompeng',
        astral: '\uD804[\uDCD0-\uDCE8\uDCF0-\uDCF9]'
    },
    {
        name: 'Sundanese',
        bmp: '\u1B80-\u1BBF\u1CC0-\u1CC7'
    },
    {
        name: 'Syloti_Nagri',
        bmp: '\uA800-\uA82B'
    },
    {
        name: 'Syriac',
        bmp: '\u0700-\u070D\u070F-\u074A\u074D-\u074F'
    },
    {
        name: 'Tagalog',
        bmp: '\u1700-\u170C\u170E-\u1714'
    },
    {
        name: 'Tagbanwa',
        bmp: '\u1760-\u176C\u176E-\u1770\u1772\u1773'
    },
    {
        name: 'Tai_Le',
        bmp: '\u1950-\u196D\u1970-\u1974'
    },
    {
        name: 'Tai_Tham',
        bmp: '\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA0-\u1AAD'
    },
    {
        name: 'Tai_Viet',
        bmp: '\uAA80-\uAAC2\uAADB-\uAADF'
    },
    {
        name: 'Takri',
        astral: '\uD805[\uDE80-\uDEB7\uDEC0-\uDEC9]'
    },
    {
        name: 'Tamil',
        bmp: '\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BFA'
    },
    {
        name: 'Telugu',
        bmp: '\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C78-\u0C7F'
    },
    {
        name: 'Thaana',
        bmp: '\u0780-\u07B1'
    },
    {
        name: 'Thai',
        bmp: '\u0E01-\u0E3A\u0E40-\u0E5B'
    },
    {
        name: 'Tibetan',
        bmp: '\u0F00-\u0F47\u0F49-\u0F6C\u0F71-\u0F97\u0F99-\u0FBC\u0FBE-\u0FCC\u0FCE-\u0FD4\u0FD9\u0FDA'
    },
    {
        name: 'Tifinagh',
        bmp: '\u2D30-\u2D67\u2D6F\u2D70\u2D7F'
    },
    {
        name: 'Tirhuta',
        astral: '\uD805[\uDC80-\uDCC7\uDCD0-\uDCD9]'
    },
    {
        name: 'Ugaritic',
        astral: '\uD800[\uDF80-\uDF9D\uDF9F]'
    },
    {
        name: 'Vai',
        bmp: '\uA500-\uA62B'
    },
    {
        name: 'Warang_Citi',
        astral: '\uD806[\uDCA0-\uDCF2\uDCFF]'
    },
    {
        name: 'Yi',
        bmp: '\uA000-\uA48C\uA490-\uA4C6'
    }
]);



return XRegExp;

}));


},{}],21:[function(require,module,exports){
module.exports={
  "author": {
    "name": "Zach Carter",
    "email": "zach@carter.name",
    "url": "http://zaa.ch"
  },
  "name": "jison",
  "description": "A parser generator with Bison's API",
  "version": "0.4.18-153",
  "license": "MIT",
  "keywords": [
    "jison",
    "bison",
    "yacc",
    "parser",
    "generator",
    "lexer",
    "flex",
    "tokenizer",
    "compiler"
  ],
  "preferGlobal": true,
  "repository": {
    "type": "git",
    "url": "git://github.com/zaach/jison.git"
  },
  "bugs": {
    "email": "jison@librelist.com",
    "url": "http://github.com/zaach/jison/issues"
  },
  "main": "lib/jison",
  "bin": {
    "jison": "lib/cli.js"
  },
  "engines": {
    "node": ">=4.0"
  },
  "dependencies": {
    "ebnf-parser": "GerHobbelt/ebnf-parser#master",
    "jison-lex": "GerHobbelt/jison-lex#master",
    "lex-parser": "GerHobbelt/lex-parser#master",
    "recast": "0.11.14",
    "jscodeshift": "0.3.28",
    "json5": "0.5.0",
    "nomnom": "GerHobbelt/nomnom#master",
    "xregexp": "GerHobbelt/xregexp#master"
  },
  "devDependencies": {
    "browserify": "13.1.0",
    "glob": "^7.0.6",
    "test": "0.6.0",
    "uglify-js": "2.7.3"
  },
  "scripts": {
    "test": "node tests/all-tests.js"
  },
  "homepage": "http://jison.org"
}

},{}]},{},[1]);
