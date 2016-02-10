(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

Jison = require('./lib/jison.js');
bnf = require('ebnf-parser');

},{"./lib/jison.js":2,"ebnf-parser":14}],2:[function(require,module,exports){
(function (process){
// Jison, an LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zach@carter.name>
// MIT X Licensed

var typal      = require('./util/typal').typal;
var Set        = require('./util/set').Set;
var Lexer      = require('./util/regexp-lexer.js');
var ebnfParser = require('./util/ebnf-parser.js');
//var JSONSelect = require('JSONSelect');
//var esprima    = require('esprima');
//var escodegen  = require('escodegen');
var assert     = require('assert');


var version = require('../package.json').version;

var devDebug = 0;

var Jison = exports.Jison = exports;
Jison.version = version;

// detect print
if (typeof console !== 'undefined' && console.log) {
    Jison.print = console.log;
} else if (typeof puts !== 'undefined') {
    Jison.print = function print () { puts([].join.call(arguments, ' ')); };
} else if (typeof print !== 'undefined') {
    Jison.print = print;
} else {
    Jison.print = function print () {};
}

Jison.Parser = (function () {

// iterator utility
function each (obj, func) {
    if (obj.forEach) {
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

var Nonterminal = typal.construct({
    constructor: function Nonterminal (symbol) {
        this.symbol = symbol;
        this.productions = new Set();
        this.first = [];
        this.follows = [];
        this.nullable = false;
    },
    toString: function Nonterminal_toString () {
        var str = this.symbol + '\n';
        str += (this.nullable ? 'nullable' : 'not nullable');
        str += '\nFirsts: ' + this.first.join(', ');
        str += '\nFollows: ' + this.first.join(', ');
        str += '\nProductions:\n  ' + this.productions.join('\n  ');

        return str;
    }
});

var Production = typal.construct({
    constructor: function Production (symbol, handle, id) {
        this.symbol = symbol;
        this.handle = handle;
        this.nullable = false;
        this.id = id;
        this.first = [];
        this.precedence = 0;
    },
    toString: function Production_toString () {
        return this.symbol + ' -> ' + this.handle.join(' ');
    }
});

var generator = typal.beget();

generator.constructor = function Jison_Generator (grammar, opt) {
    if (typeof grammar === 'string') {
        grammar = ebnfParser.parse(grammar);
    }

    var options = typal.mix.call({}, grammar.options, opt);
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

    this.DEBUG = options.debug || false;
    if (this.DEBUG) {
        this.mix(generatorDebug); // mixin debug methods
    }

    this.processGrammar(grammar);

    if (grammar.lex) {
        this.lexer = new Lexer(grammar.lex, null, this.terminals_);
    }
};

generator.processGrammar = function processGrammarDef (grammar) {
    var bnf = grammar.bnf,
        tokens = grammar.tokens,
        nonterminals = this.nonterminals = {},
        productions = this.productions,
        self = this;

    if (!grammar.bnf && grammar.ebnf) {
        bnf = grammar.bnf = ebnfParser.transform(grammar.ebnf);
    }
    if (devDebug) {
        console.log('processGrammar: ', JSON.stringify({
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
                predefined_symbols = JSON.parse(source);
            } catch (ex) {
                if (devDebug) console.log('%import symbols JSON fail: ', ex);
                try {
                    var m = /[\r\n]\s*symbols_:\s*(\{[\s\S]*?\}),\s*[\r\n]/.exec(source);
                    if (m && m[1]) {
                        source = m[1];
                        predefined_symbols = JSON.parse(source);
                    }
                } catch (ex) {
                    if (devDebug) console.log('%import symbols JISON output fail: ', ex);
                }
            }
            if (!predefined_symbols || typeof predefined_symbols !== 'object') {
                throw new Error('Error: `%import symbols <path>` must point to either a JSON file containing a symbol table (hash table) or a previously generated JISON JavaScript file, which contains such a symbol table.');
            }
        }
    }

    var symbols = this.symbols = [];

    // calculate precedence of operators
    var operators = this.operators = processOperators(grammar.operators);

    // build productions from CFG and calculate the symbol sets (terminals and nonterminals) and their name-to-ID mappings
    this.buildProductions(bnf, productions, nonterminals, symbols, operators, predefined_symbols);

    if (devDebug > 1) console.log('terminals vs tokens: ', this.terminals.length, (tokens && tokens.length), this.terminals, '\n###################################### TOKENS\n', tokens, '\n###################################### EXTRA TOKENS\n', grammar.extra_tokens, '\n###################################### LEX\n', grammar.lex, '\n###################################### GRAMMAR\n', grammar);
    if (tokens && this.terminals.length !== tokens.length) {
        self.trace('Warning: declared tokens differ from tokens found in rules.');
        self.trace(this.terminals);
        self.trace(tokens);
    }

    // augment the grammar
    this.augmentGrammar(grammar);
};

generator.augmentGrammar = function augmentGrammar (grammar) {
    if (this.productions.length === 0) {
        throw new Error('Grammar error: must have at least one rule.');
    }
    // use specified start symbol, or default to first user defined production
    this.startSymbol = grammar.start || grammar.startSymbol || this.productions[0].symbol;
    if (!this.nonterminals[this.startSymbol]) {
        throw new Error('Grammar error: startSymbol must be a non-terminal found in your grammar.');
    }
    //this.EOF = '$end';       // moved to generator.buildProductions()

    // augment the grammar
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

// set precedence and associativity of operators
function processOperators (ops) {
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


generator.buildProductions = function buildProductions(bnf, productions, nonterminals, symbols, operators, predefined_symbols) {
    var actions = [
      '/* this == yyval */',
      this.actionInclude || '',
      'var $0 = $$.length - 1;',
      'switch (yystate) {'
    ];
    var actionGroups = {};          // used to combine identical actions into single instances: no use duplicating action code needlessly
    var actionGroupValue = {};      // stores the unaltered, expanded, user-defined action code for each action group.
    var prods, symbol;
    var productions_ = [0];
    var symbols_ = {};
    var usedSymbolIds = [/* $accept = 0 */ true, /* $end = 1 */ true, /* error = 2 */ true];
    var usedSymbolIdsLowIndex = 127; // 127? 3?

    // set up the required symbols `$accept` and `$end` (a.k.a. EOF) and make sure they occupy the expected slots:
    this.EOF = '$end';

    symbols_.$accept = 0;
    symbols_[this.EOF] = 1;
    symbols[0] = '$accept';
    symbols[1] = this.EOF;

    nonterminals.$accept = new Nonterminal('$accept');

    // always add the error symbol; will be third symbol, or "2": ($accept, $end, error)
    symbols_.error = 2;
    symbols[2] = 'error';

    if (predefined_symbols) {
        for (symbol in predefined_symbols) {
            var symId = predefined_symbols[symbol];
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
    }

    var her = false; // has error recovery

    // Strip off any insignificant whitespace from the user code to ensure that
    // otherwise identical actions are indeed matched up into a single actionGroup:
    function mkHashIndex(s) {
        return s.trim()
        .replace(/\r\n|\r/g, '\n')
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

            // assign the Unicode codepoint index to single-character symbols:
            if (s.length === 1 && s.charCodeAt(0)) {
                i = s.charCodeAt(0);
                // has this ID already been taken? If not, pick this ID.
                if (!usedSymbolIds[i]) {
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
    }

    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        addSymbol(symbol);
        nonterminals[symbol] = new Nonterminal(symbol);

        if (typeof bnf[symbol] === 'string') {
            prods = bnf[symbol].split(/\s*\|\s*/g);
        } else {
            prods = bnf[symbol].slice(0);
        }
        if (devDebug) console.log("\ngenerator.buildProductions: ", symbol, JSON.stringify(prods, null, 2));

        prods.forEach(buildProduction);
    }
    for (var hash in actionGroups) {
        actions.push([].concat([].concat.apply([], actionGroups[hash]), actionGroupValue[hash], '\nbreak;').join(' '));
    }

    var sym, 
        terms = [], 
        terms_ = {};
    each(symbols_, function (id, sym) {
        if (!nonterminals[sym]) {
            terms.push(sym);
            terms_[id] = sym;
        }
    });
    assert(terms[0] === this.EOF);

    this.hasErrorRecovery = her;

    this.terminals = terms;
    this.terminals_ = terms_;
    this.symbols_ = symbols_;

    this.productions_ = productions_;
    actions.push('}');

    actions = actions.join('\n')
                .replace(/YYABORT/g, 'return false')
                .replace(/YYACCEPT/g, 'return true');

    var parameters = 'yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack';
    if (this.parseParams) parameters += ', ' + this.parseParams.join(', ');

    this.performAction = 'function anonymous(' + parameters + ') {\n' + actions + '\n}';

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
            if (pos >= 0 && pos2 >= 0 && pos2 < pos) {
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
                throw new Error("internal error parsing literal token(s) in grammar rule");
            }
            ls = rhs.substr(0, pos);
            // check for aliased literals, e.g., `'>'[gt]` and keep it and the alias together
            rhs = rhs.substr(pos + 1);
            var alias = rhs.match(/^\[[a-zA-Z_][a-zA-Z0-9_]*\]/);
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
            str = str.join(' ');
        }
        str = str.replace(/\*\//g, "*\\/");         // destroy any inner `*/` comment terminator sequence.
        return str;
    }

    function buildProduction (handle) {
        var r, rhs, i;
        if (devDebug) console.log('\nbuildProduction: ', JSON.stringify(handle, null, 2));

        if (handle.constructor === Array) {
            var aliased = [],
                rhs_i;
            rhs = (typeof handle[0] === 'string') ?
                      splitStringIntoSymbols(handle[0]) :
                      handle[0].slice(0);

            for (i = 0; i < rhs.length; i++) {
                // check for aliased names, e.g., id[alias] and strip them
                rhs_i = rhs[i].match(/\[[a-zA-Z_][a-zA-Z0-9_]*\]$/);
                if (rhs_i) {
                    rhs[i] = rhs[i].substr(0, rhs[i].length - rhs_i[0].length);
                    rhs_i = rhs_i[0].substr(1, rhs_i[0].length - 2);
                    aliased[i] = rhs_i;
                } else {
                    aliased[i] = rhs[i];
                }

                if (rhs[i] === 'error') {
                    her = true;
                }
                if (!symbols_[rhs[i]]) {
                    addSymbol(rhs[i]);
                }
            }

            if (typeof handle[1] === 'string' || handle.length === 3) {
                // semantic action specified
                var label = [
                    'case', productions.length + 1, ':',
                    '\n/*! Production::    ', postprocessComment(symbol), ':'
                ].concat(postprocessComment(handle[0]), '*/\n');
                var action = handle[1];
                var actionHash;

                // replace named semantic values ($nonterminal)
                if (action.match(/[$@][a-zA-Z_][a-zA-Z0-9_]*/)) {
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
                    function addName (s) {
                        if (names[s]) {
                            names[s + (++count[s])] = i + 1;
                        } else {
                            names[s] = i + 1;
                            names[s + '1'] = i + 1;
                            count[s] = 1;
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
                    action = action.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)\b/g, function (str, pl) {
                            return names[pl] ? '$' + names[pl] : str;
                        }).replace(/@([a-zA-Z_][a-zA-Z0-9_]*\b)/g, function (str, pl) {
                            return names[pl] ? '@' + names[pl] : str;
                        });
                }
                action = action
                    // replace references to $$ with this.$, and @$ with this._$
                    .replace(/([^'"])\$\$|^\$\$/g, '$1this.$').replace(/@[0$]/g, 'this._$')

                    // replace semantic value references ($n) with stack value (stack[n])
                    .replace(/\$(-?\d+)\b/g, function (_, n) {
                        return '$$[$0' + (parseInt(n, 10) - rhs.length || '') + ']';
                    })
                    // same as above for location references (@n)
                    .replace(/@(-?\d+)\b/g, function (_, n) {
                        return '_$[$0' + (n - rhs.length || '') + ']';
                    });
                actionHash = mkHashIndex(action);
                if (actionHash in actionGroups) {
                    actionGroups[actionHash].push(label);
                } else {
                    actionGroups[actionHash] = [label];
                    actionGroupValue[actionHash] = action;
                }

                r = new Production(symbol, rhs, productions.length + 1);
                // precedence specified also
                if (handle[2] && operators[handle[2].prec]) {
                    r.precedence = operators[handle[2].prec].precedence;
                }
            } else {
                // only precedence specified
                r = new Production(symbol, rhs, productions.length + 1);
                if (operators[handle[1].prec]) {
                    r.precedence = operators[handle[1].prec].precedence;
                }
            }
        } else {
            // no action -> don't care about aliases; strip them.
            handle = handle.replace(/\[[a-zA-Z_][a-zA-Z0-9_]*\]/g, '');
            rhs = splitStringIntoSymbols(handle);
            for (i = 0; i < rhs.length; i++) {
                if (rhs[i] === 'error') {
                    her = true;
                }
                if (!symbols_[rhs[i]]) {
                    addSymbol(rhs[i]);
                }
            }
            r = new Production(symbol, rhs, productions.length + 1);
        }
        if (r.precedence === 0) {
            // set precedence
            for (i = r.handle.length - 1; i >= 0; i--) {
                if (!(r.handle[i] in nonterminals) && r.handle[i] in operators) {
                    r.precedence = operators[r.handle[i]].precedence;
                }
            }
        }

        productions.push(r);
        productions_.push([symbols_[r.symbol], r.handle[0] === '' ? 0 : r.handle.length]);
        nonterminals[symbol].productions.push(r);
    }
};



generator.createParser = function createParser () {
    throw new Error('Calling abstract method.');
};

// noop. implemented in debug mixin
generator.trace = function trace () { };

generator.warn = function warn () {
    var args = Array.prototype.slice.call(arguments, 0);
    Jison.print.call(null, args.join(''));
};

generator.error = function error (msg) {
    throw new Error(msg);
};

// Generator debug mixin

var generatorDebug = {
    trace: function trace () {
        Jison.print.apply(null, arguments);
    },
    beforeprocessGrammar: function () {
        this.trace('Processing grammar.');
    },
    afteraugmentGrammar: function () {
        var trace = this.trace;
        each(this.symbols, function (sym, i) {
            trace(sym + '(' + i + ')');
        });
    }
};



/*
 * Mixin for common behaviors of lookahead parsers
 */
var lookaheadMixin = {};

lookaheadMixin.computeLookaheads = function computeLookaheads () {
    if (this.DEBUG) {
        this.mix(lookaheadDebug); // mixin debug methods
    }

    this.computeLookaheads = function () {};
    this.nullableSets();
    this.firstSets();
    this.followSets();
};

// calculate follow sets based on first and nullable
lookaheadMixin.followSets = function followSets () {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true;

    // loop until no further changes have been made
    while (cont) {
        cont = false;

        productions.forEach(function Follow_prod_forEach (production, k) {
            //self.trace(production.symbol, nonterminals[production.symbol].follows);
            // q is used in Simple LALR algorithm determine follows in context
            var q;
            var ctx = !!self.go_;

            var set = [], oldcount;
            for (var i = 0, t; (t = production.handle[i]); ++i) {
                if (!nonterminals[t]) continue;

                // for Simple LALR algorithm, self.go_ checks if
                if (ctx) {
                    q = self.go_(production.symbol, production.handle.slice(0, i));
                }
                var bool = !ctx || q === parseInt(self.nterms_[t], 10);

                if (i === production.handle.length + 1 && bool) {
                    set = nonterminals[production.symbol].follows;
                } else {
                    var part = production.handle.slice(i + 1);

                    set = self.first(part);
                    if (self.nullable(part) && bool) {
                        set.push.apply(set, nonterminals[production.symbol].follows);
                    }
                }
                oldcount = nonterminals[t].follows.length;
                Set.union(nonterminals[t].follows, set);
                if (oldcount !== nonterminals[t].follows.length) {
                    cont = true;
                }
            }
        });
    }
};

// return the FIRST set of a symbol or series of symbols
lookaheadMixin.first = function first (symbol) {
    // epsilon
    if (symbol === '') {
        return [];
    // RHS
    } else if (symbol instanceof Array) {
        var firsts = [];
        for (var i = 0, t; (t = symbol[i]); ++i) {
            if (!this.nonterminals[t]) {
                if (firsts.indexOf(t) === -1)
                    firsts.push(t);
            } else {
                Set.union(firsts, this.nonterminals[t].first);
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
lookaheadMixin.firstSets = function firstSets () {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true,
        symbol,firsts;

    // loop until no further changes have been made
    while (cont) {
        cont = false;

        productions.forEach(function FirstSets_forEach (production, k) {
            var firsts = self.first(production.handle);
            if (firsts.length !== production.first.length) {
                production.first = firsts;
                cont = true;
            }
        });

        for (symbol in nonterminals) {
            firsts = [];
            nonterminals[symbol].productions.forEach(function (production) {
                Set.union(firsts, production.first);
            });
            if (firsts.length !== nonterminals[symbol].first.length) {
                nonterminals[symbol].first = firsts;
                cont = true;
            }
        }
    }
};

// fixed-point calculation of NULLABLE
lookaheadMixin.nullableSets = function nullableSets () {
    var firsts = this.firsts = {},
        nonterminals = this.nonterminals,
        self = this,
        cont = true;

    // loop until no further changes have been made
    while (cont) {
        cont = false;

        // check if each production is nullable
        this.productions.forEach(function (production, k) {
            if (!production.nullable) {
                for (var i = 0, n = 0, t; (t = production.handle[i]); ++i) {
                    if (self.nullable(t)) n++;
                }
                if (n === i) { // production is nullable if all tokens are nullable
                    production.nullable = cont = true;
                }
            }
        });

        //check if each symbol is nullable
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
lookaheadMixin.nullable = function nullable (symbol) {
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
        each(this.nonterminals, function (nt, t) {
            trace(nt, '\n');
        });
    }
};

/*
 * Mixin for common LR parser behavior
 */
var lrGeneratorMixin = {};

lrGeneratorMixin.buildTable = function buildTable () {
    if (this.DEBUG) {
        this.mix(lrGeneratorDebug); // mixin debug methods
    }

    this.states = this.canonicalCollection();
    this.table = this.parseTable(this.states);
    this.defaultActions = findDefaults(this.table);
};

lrGeneratorMixin.Item = typal.construct({
    constructor: function Item(production, dot, f, predecessor) {
        this.production = production;
        this.dotPosition = dot || 0;
        this.follows = f || [];
        this.predecessor = predecessor;
        this.id = parseInt(production.id + 'a' + this.dotPosition, 36);
        this.markedSymbol = this.production.handle[this.dotPosition];
    },
    remainingHandle: function () {
        return this.production.handle.slice(this.dotPosition+1);
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
        return this.production.symbol + ' -> ' + temp.join(' ') +
            (this.follows.length === 0 ? '' : ' #lookaheads= ' + this.follows.join(' '));
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
    concat: function concat (set) {
        var a = set._items || set;
        for (var i = a.length - 1; i >= 0; i--) {
            this.hash_[a[i].id] = true; //i;
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
    valueOf: function toValue () {
        var v = this._items.map(function (a) { return a.id; }).sort().join('|');
        this.valueOf = function toValue_inner() { return v; };
        return v;
    }
});

lrGeneratorMixin.closureOperation = function closureOperation (itemSet /*, closureSet*/) {
    var closureSet = new this.ItemSet();
    var self = this;

    var set = itemSet,
        itemQueue, syms = {};

    do {
        itemQueue = new Set();
        closureSet.concat(set);
        set.forEach(function CO_set_forEach (item) {
            var symbol = item.markedSymbol;

            // if token is a non-terminal, recursively add closures
            if (symbol && self.nonterminals[symbol]) {
                if (!syms[symbol]) {
                    self.nonterminals[symbol].productions.forEach(function CO_nt_forEach (production) {
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

lrGeneratorMixin.gotoOperation = function gotoOperation (itemSet, symbol) {
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
lrGeneratorMixin.canonicalCollection = function canonicalCollection () {
    var item1 = new this.Item(this.productions[0], 0, [this.EOF]);
    var firstState = this.closureOperation(new this.ItemSet(item1)),
        states = new Set(firstState),
        marked = 0,
        self = this,
        itemSet;

    states.has = {};
    states.has[firstState] = 0;

    while (marked !== states.size()) {
        itemSet = states.item(marked);
        marked++;
        itemSet.forEach(function CC_itemSet_forEach (item) {
            if (item.markedSymbol && item.markedSymbol !== self.EOF) {
                self.canonicalCollectionInsert(item.markedSymbol, itemSet, states, marked - 1);
            }
        });
    }

    return states;
};

// Pushes a unique state into the queue. Some parsing algorithms may perform additional operations
lrGeneratorMixin.canonicalCollectionInsert = function canonicalCollectionInsert (symbol, itemSet, states, stateNum) {
    var g = this.gotoOperation(itemSet, symbol);
    if (!g.predecessors)
        g.predecessors = {};
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
lrGeneratorMixin.parseTable = function parseTable (itemSets) {
    var states = [],
        nonterminals = this.nonterminals,
        operators = this.operators,
        conflictedStates = {}, // array of [state, token] tuples
        self = this,
        s = 1, // shift
        r = 2, // reduce
        a = 3; // accept

    // for each item set
    itemSets.forEach(function (itemSet, k) {
        var state = states[k] = {};
        var action, stackSymbol;

        // set shift and goto actions
        for (stackSymbol in itemSet.edges) {
            itemSet.forEach(function (item, j) {
                // find shift and goto actions
                if (item.markedSymbol == stackSymbol) {
                    var gotoState = itemSet.edges[stackSymbol];
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
        itemSet.forEach(function (item, j) {
            if (item.markedSymbol == self.EOF) {
                // accept
                state[self.symbols_[self.EOF]] = [a];
                //self.trace(k, self.EOF, state[self.EOF]);
            }
        });

        var allterms = self.lookAheads ? false : self.terminals;

        // set reductions and resolve potential conflicts
        itemSet.reductions.forEach(function (item, j) {
            // if parser uses lookahead, only enumerate those terminals
            var terminals = allterms || self.lookAheads(itemSet, item);

            terminals.forEach(function (stackSymbol) {
                action = state[self.symbols_[stackSymbol]];
                var op = operators[stackSymbol];

                // Reading a terminal and current position is at the end of a production, try to reduce
                if (action || action && action.length) {
                    var sol = resolveConflict(item.production, op, [r, item.production.id], action[0] instanceof Array ? action[0] : action);
                    self.resolutions.push([k, stackSymbol, sol]);
                    if (sol.bydefault) {
                        self.conflicts++;
                        if (!self.DEBUG) {
                            self.warn('Conflict in grammar: multiple actions possible when lookahead token is ', stackSymbol, ' in state ', k, "\n- ", printAction(sol.r, self), "\n- ", printAction(sol.s, self));
                            conflictedStates[k] = true;
                        }
                        if (self.options.noDefaultResolve) {
                            if (!(action[0] instanceof Array))
                                action = [action];
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
                    state[self.symbols_[stackSymbol]] = undefined;
                }
            });
        });

    });

    if (!self.DEBUG && self.conflicts > 0) {
        self.warn('\nStates with conflicts:');
        each(conflictedStates, function (val, state) {
            self.warn('State ' + state);
            self.warn('  ', itemSets.item(state).join('\n  '));
        });
    }

    return states;
};

// find states with only one action, a reduction
function findDefaults (states) {
    var defaults = {};
    states.forEach(function (state, k) {
        var i = 0;
        for (var act in state) {
             if ({}.hasOwnProperty.call(state, act)) i++;
        }

        if (i === 1 && state[act][0] === 2) {
            // only one action in state and it's a reduction
            defaults[k] = state[act];
        }
    });

    return defaults;
}

// resolves shift-reduce and reduce-reduce conflicts
function resolveConflict (production, op, reduce, shift) {
    var sln = {production: production, operator: op, r: reduce, s: shift},
        s = 1, // shift
        r = 2, // reduce
        a = 3; // accept

    if (shift[0] === r) {
        sln.msg = 'Resolve R/R conflict (use first production declared in grammar.)';
        sln.action = shift[1] < reduce[1] ? shift : reduce;
        if (shift[1] !== reduce[1]) sln.bydefault = true;
        return sln;
    }

    if (production.precedence === 0 || !op) {
        sln.msg = 'Resolve S/R conflict (shift by default.)';
        sln.bydefault = true;
        sln.action = shift;
    } else if (production.precedence < op.precedence) {
        sln.msg = 'Resolve S/R conflict (shift for higher precedent operator.)';
        sln.action = shift;
    } else if (production.precedence === op.precedence) {
        if (op.assoc === 'right') {
            sln.msg = 'Resolve S/R conflict (shift for right associative operator.)';
            sln.action = shift;
        } else if (op.assoc === 'left') {
            sln.msg = 'Resolve S/R conflict (reduce for left associative operator.)';
            sln.action = reduce;
        } else if (op.assoc === 'nonassoc') {
            sln.msg = 'Resolve S/R conflict (no action for non-associative operator.)';
            sln.action = NONASSOC;
        }
    } else {
        sln.msg = 'Resolve conflict (reduce for higher precedent production.)';
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
        + ' *    yy: {}\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  Parser.prototype: {\n'
        + ' *    yy: {},\n'
        + ' *    trace: function(errorMessage, errorHash),\n'
        + ' *    JisonParserError: function(msg, hash),\n'
        + ' *    symbols_: {associative list: name ==> number},\n'
        + ' *    terminals_: {associative list: number ==> name},\n'
        + ' *    productions_: [...],\n'
        + ' *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),\n'
        + ' *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)\n'
        + ' *    table: [...],\n'
        + ' *    defaultActions: {...},\n'
        + ' *    parseError: function(str, hash),\n'
        + ' *    parse: function(input),\n'
        + ' *\n'
        + ' *    lexer: {\n'
        + ' *        EOF: 1,\n'
        + ' *        ERROR: 2,\n'
        + ' *        JisonLexerError: function(msg, hash),\n'
        + ' *        parseError: function(str, hash),\n'
        + ' *        setInput: function(input),\n'
        + ' *        input: function(),\n'
        + ' *        unput: function(str),\n'
        + ' *        more: function(),\n'
        + ' *        reject: function(),\n'
        + ' *        less: function(n),\n'
        + ' *        pastInput: function(),\n'
        + ' *        upcomingInput: function(),\n'
        + ' *        showPosition: function(),\n'
        + ' *        test_match: function(regex_match_array, rule_index),\n'
        + ' *        next: function(),\n'
        + ' *        lex: function(),\n'
        + ' *        begin: function(condition),\n'
        + ' *        popState: function(),\n'
        + ' *        _currentRules: function(),\n'
        + ' *        topState: function(),\n'
        + ' *        pushState: function(condition),\n'
        + ' *        stateStackSize: function(),\n'
        + ' *\n'
        + ' *        options: { ... },\n'
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
        + ' *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * ---\n'
        + ' *\n'
        + ' * The parseError function receives a \'hash\' object with these members for lexer and parser errors:\n'
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
        + ' *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)\n'
        + ' *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)\n'
        + ' *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * while `this` will reference the current parser instance.\n'
        + ' *\n'
        + ' *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:\n'
        + ' *\n'
        + ' *  {\n'
        + ' *    lexer:       (reference to the current lexer instance which reported the error)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * ---\n'
        + ' *\n'
        + ' * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.\n'
        + ' * These options are available:\n'
        + ' *\n'
        + ' * ### options which are global for all parser instances\n'
        + ' *\n'
        + ' *  Parser.pre_parse: function(yy)\n'
        + ' *                              optional: you can specify a pre_parse() function in the chunk following the grammar, \n'
        + ' *                              i.e. after the last `%%`.\n'
        + ' *  Parser.post_parse: function(yy, retval) { return retval; }\n'
        + ' *                              optional: you can specify a post_parse() function in the chunk following the grammar, \n'
        + ' *                              i.e. after the last `%%`. When it does not return any value, the parser will return \n'
        + ' *                              the original `retval`.\n'
        + ' *\n'
        + ' * ### options which can be set up per parser instance\n'
        + ' *  \n'
        + ' *  yy: {\n'
        + ' *      pre_parse:  function(yy)\n'
        + ' *                              optional: is invoked before the parse cycle starts (and before the first invocation \n'
        + ' *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).\n'
        + ' *      post_parse: function(yy, retval) { return retval; }\n'
        + ' *                              optional: is invoked when the parse terminates due to success (\'accept\') or failure \n'
        + ' *                              (even when exceptions are thrown).  `retval` contains the return value to be produced\n'
        + ' *                              by `Parser.parse()`; this function can override the return value by returning another. \n'
        + ' *                              When it does not return any value, the parser will return the original `retval`. \n'
        + ' *                              This function is invoked immediately before `Parser.post_parse()`.\n'
        + ' *      parseError: function(str, hash)\n'
        + ' *                              optional: overrides the default `parseError` function.\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  parser.lexer.options: {\n'
        + ' *      ranges: boolean         optional: true ==> token location info will include a .range[] member.\n'
        + ' *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested\n'
        + ' *                                                 exhaustively to find the longest match.\n'
        + ' *      backtrack_lexer: boolean\n'
        + ' *                              optional: true ==> lexer regexes are tested in order and for each matching\n'
        + ' *                                                 regex the action code is invoked; the lexer terminates\n'
        + ' *                                                 the scan when a token is returned by the action code.\n'
        + ' *      pre_lex:  function()\n'
        + ' *                              optional: is invoked before the lexer is invoked to produce another token.\n'
        + ' *                              `this` refers to the Lexer object.\n'
        + ' *      post_lex: function(token) { return token; }\n'
        + ' *                              optional: is invoked when the lexer has produced a token `token`;\n'
        + ' *                              this function can override the returned token value by returning another.\n'
        + ' *                              When it does not return any (truthy) value, the lexer will return the original `token`.\n'
        + ' *                              `this` refers to the Lexer object.\n'
        + ' *  }\n'
        + ' */\n';

    return out;
}

/*
 * Mixin for common LR/LL/*an* parser behavior
 */
var generatorMixin = {};

generatorMixin.generate = function parser_generate (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var code = '';

    // check for illegal identifier
    if (!opt.moduleName || !opt.moduleName.match(/^[a-zA-Z_$][a-zA-Z0-9_$\.]*$/)) {
        if (opt.debug) {
            console.warn("WARNING: The specified moduleName '" + opt.moduleName + "' is illegal (only characters [a-zA-Z0-9_$] and '.' dot are accepted); using the default moduleName 'parser' instead.");
        }
        opt.moduleName = 'parser';
    }
    switch (opt.moduleType) {
        case 'js':
            code = this.generateModule(opt);
            break;
        case 'amd':
            code = this.generateAMDModule(opt);
            break;
        default:
            code = this.generateCommonJSModule(opt);
            break;
    }

    return code;
};


generatorMixin.generateAMDModule = function generateAMDModule (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var module = this.generateModule_();
    var out = [
        generateGenericHeaderComment(),
        '',
        'define(function (require) {',
        module.commonCode,
        'var parser = ' + module.moduleCode,
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

generatorMixin.generateCommonJSModule = function generateCommonJSModule (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var moduleName = opt.moduleName || 'parser';
    var main = [];
    if (!opt.noMain) {
        main = main.concat([
            'exports.main = ' + String(opt.moduleMain || commonjsMain) + ';',
            'if (typeof module !== \'undefined\' && require.main === module) {',
            '  exports.main(process.argv.slice(1));',
            '}'
        ]);
    }
    var out = [
        this.generateModule(opt),
        '',
        '',
        'if (typeof require !== \'undefined\' && typeof exports !== \'undefined\') {',
        'exports.parser = ' + moduleName + ';',
        'exports.Parser = ' + moduleName + '.Parser;',
        'exports.parse = function () {',
        '  return ' + moduleName + '.parse.apply(' + moduleName + ', arguments);',
        '};',
        main.join('\n'),
        '}'
    ];
    return out.join('\n') + '\n';
};

generatorMixin.generateModule = function generateModule (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var moduleName = opt.moduleName || 'parser';
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

    out += _generateNamespace(moduleName.split('.'), null, function (moduleName) {
        return (moduleName.match(/\./) ? moduleName : 'var ' + moduleName) +
                ' = ' + self.generateModuleExpr() + '\n';
    });

    return out;
};


generatorMixin.generateModuleExpr = function generateModuleExpr () {
    var out = [];
    var module = this.generateModule_();

    out.push('(function () {');
    out.push(module.commonCode);
    out.push('var parser = ' + module.moduleCode);
    out.push(this.moduleInclude);
    if (this.lexer && this.lexer.generateModule) {
        out.push(this.lexer.generateModule());
        out.push('parser.lexer = lexer;');
        if (this.options.ranges) {
            out.push('parser.lexer.options.ranges = true;');
        }
    }
    out = out.concat(['',
            'function Parser () {',
            '  this.yy = {};',
            '}',
            'Parser.prototype = parser;',
            'parser.Parser = Parser;',
            '// parser.JisonParserError = JisonParserError;',
            '',
            'return new Parser();',
            '})();'
    ]);
    return out.join('\n') + '\n';
};

function removeFeatureMarkers (fn) {
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
        //          recovering = 0,
        // and the recovery support statements:
        //          if (recovering > 0) {
        //              recovering--;
        //          }
        parseFn = parseFn.replace(/^\s*recovering.*$/gm, '');
        parseFn = parseFn.replace(/^.*\brecovering\b.*\{[\s\r\n]*\}/gm, '');
    }
    return parseFn;
}

// Generates the code of the parser module, which consists of two parts:
// - module.commonCode: initialization code that should be placed before the module
// - module.moduleCode: code that creates the module object
lrGeneratorMixin.generateModule_ = function generateModule_ () {
    var parseFn = String(parser.parse);
    parseFn = pickErrorHandlingChunk(parseFn, this.hasErrorRecovery);

    parseFn = addOrRemoveTokenStack(parseFn, this.options['token-stack']);

    // always remove the feature markers in the template code.
    parseFn = removeFeatureMarkers(parseFn);

    // Generate code with fresh variable names
    nextVariableId = 0;
    var tableCode = this.generateTableCode(this.table);

    // Generate the initialization code
    var commonCode = tableCode.commonCode;

    // sort hash table by key to produce a nicer output:
    function sortSymbolTable(tbl) {
        var a = Object.keys(tbl);
        a.sort();
        var nt = {};
        var k;
        for (var i = 0, len = a.length; i < len; i++) {
            k = a[i];
            nt[k] = tbl[k];
        }
        return nt;
    }

    function produceProductionsForDebugging(tbl, sym) {
        var prods = {};
        for (var nonterm in tbl) {
            var entry = tbl[nonterm];
            var id = sym[nonterm];
            var item_prods = {};
            var item_tbl = entry.productions._items;
            for (var i = 0, len = item_tbl.length; i < len; i++) {
                var p = item_tbl[i];
                item_prods[p.id] = p.handle.map(function (t) {
                    if (!t) {
                        t = '<epsilon>';
                    }
                    return t;
                }).join(' ');
            }
            prods[nonterm] = item_prods;
        }
        return prods;
    }

    // Generate the module creation code
    var moduleCode = '{\n';
    moduleCode += [
        'trace: ' + String(this.trace || parser.trace),
        'JisonParserError: JisonParserError',
        'yy: {}',
        'symbols_: ' + JSON.stringify(sortSymbolTable(this.symbols_), null, 2),
        'terminals_: ' + JSON.stringify(this.terminals_, null, 2).replace(/"([0-9]+)":/g, '$1:'),
        'nonterminals_: ' + JSON.stringify(produceProductionsForDebugging(this.nonterminals, this.symbols_), null, 2).replace(/"([0-9]+)":/g, '$1:'),
        'productions_: ' + JSON.stringify(this.productions_, null, 2),
        'performAction: ' + String(this.performAction),
        'table: ' + tableCode.moduleCode,
        'defaultActions: ' + JSON.stringify(this.defaultActions, null, 2).replace(/"([0-9]+)":/g, '$1:'),
        'parseError: ' + String(this.parseError || (this.hasErrorRecovery ? traceParseError : parser.parseError)),
        'parse: ' + parseFn
        ].join(',\n');
    moduleCode += '\n};';

    return { commonCode: commonCode, moduleCode: moduleCode }
};

// Generate code that represents the specified parser table
lrGeneratorMixin.generateTableCode = function (table) {
    var moduleCode = JSON.stringify(table, null, 2);
    var variables = [];
    var usesCompressor = false;

    // Don't surround numerical property name numbers in quotes
    moduleCode = moduleCode.replace(/"([0-9]+)"(?=:)/g, "$1");

    // Replace objects with several identical values by function calls
    // e.g., { 1: [6, 7]; 3: [6, 7], 4: [6, 7], 5: 8 } = __expand__([1, 3, 4], [6, 7], { 5: 8 })
    moduleCode = moduleCode.replace(/\{[\s\r\n]*\d+:[^\}]+,[\s\r\n]*\d+:[^\}]+\}/g, function (object) {
        // Find the value that occurs with the highest number of keys
        var value, frequentValue, key, keys = {}, keyCount, maxKeyCount = 0,
            keyValue, keyValues = [], keyValueMatcher = /(\d+):[\s\r\n]*([^:\}]+)(?=,[\s\r\n]*\d+:|[\s\r\n]*\})/g;

        while ((keyValue = keyValueMatcher.exec(object))) {
            // For each value, store the keys where that value occurs
            key = keyValue[1];
            value = keyValue[2];
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
            // Create the function call `__expand__(keys, value, remainder)`
            object = '__expand__([' + keys[frequentValue].join(',') + '], ' + frequentValue + keyValues + ')';
            usesCompressor = true;
        }
        return object;
    });

    // Count occurrences of number lists
    var list;
    var lists = {};
    var listMatcher = /\[[0-9,]+\]/g;

    while (list = listMatcher.exec(moduleCode)) {
        lists[list] = (lists[list] || 0) + 1;
    }

    // Replace frequently occurring number lists with variables
    moduleCode = moduleCode.replace(listMatcher, function (list) {
        var listId = lists[list];
        // If listId is a number, it represents the list's occurrence frequency
        if (typeof listId === 'number') {
            // If the list does not occur frequently, represent it by the list
            if (listId === 1) {
                lists[list] = listId = list;
            // If the list occurs frequently, represent it by a newly assigned variable
            } else {
                lists[list] = listId = createVariable();
                variables.push(listId + '=' + list);
            }
        }
        return listId;
    });

    var prelude = [
        "// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript",
        "// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript",
        "function JisonParserError(msg, hash) {",
        "    this.message = msg;",
        "    this.hash = hash;",
        "    var stacktrace = (new Error(msg)).stack;",
        "    if (stacktrace) {",
        "      this.stack = stacktrace;",
        "    }",
        "}",
        "JisonParserError.prototype = Object.create(Error.prototype);",
        "JisonParserError.prototype.constructor = JisonParserError;",
        "JisonParserError.prototype.name = 'JisonParserError';",
        "",
    ];

    // Only include the expender function when it's actually used
    // (tiny grammars don't have much state duplication, so this shaves off
    // another couple bytes off the generated output)
    if (usesCompressor) {
        prelude.push(createObjectCode.toString().replace('createObjectCode', '__expand__'));
        prelude.push('');
    }

    if (variables.length > 0) {
        prelude.push('var ' + variables.join(',\n    ') + ';');
        prelude.push('');
    }

    // Return the variable initialization code and the table code
    return {
        commonCode: prelude.join('\n'),
        moduleCode: moduleCode
    };
};

// Function that extends an object with the given value for all given keys
// e.g., __expand__([1, 3, 4], [6, 7], { x: 1, y: 2 }) = { 1: [6, 7]; 3: [6, 7], 4: [6, 7], x: 1, y: 2 }
function createObjectCode(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

// Creates a variable with a unique name
function createVariable() {
    var id = nextVariableId++;
    var name = '$V';

    do {
        name += variableTokens[id % variableTokensLength];
        id = ~~(id / variableTokensLength);
    } while (id !== 0);

    return name;
}

var nextVariableId = 0;
var variableTokens = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
var variableTokensLength = variableTokens.length;

// default main method for generated commonjs modules
function commonjsMain (args) {
    // When the parser comes with its own `main` function, then use that one:
    if (typeof exports.parser.main === 'function') {
      return exports.parser.main(args);
    }

    if (!args[1]) {
        console.log('Usage: ' + args[0] + ' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');
    return exports.parser.parse(source);
}

// debug mixin for LR parser generators

function printAction (a, gen) {
    var s = a[0] == 1 ? 'shift token (then go to state ' + a[1] + ')' :
        a[0] == 2 ? 'reduce by rule: ' + gen.productions[a[1]] :
                    'accept';

    return s;
}

var lrGeneratorDebug = {
    beforeparseTable: function () {
        this.trace("Building parse table.");
    },
    afterparseTable: function () {
        var self = this;
        if (this.conflicts > 0) {
            this.resolutions.forEach(function (r, i) {
                if (r[2].bydefault) {
                    self.warn('Conflict at state: ', r[0], ', token: ', r[1], "\n  ", printAction(r[2].r, self), "\n  ", printAction(r[2].s, self));
                }
            });
            this.trace("\n" + this.conflicts + " Conflict(s) found in grammar.");
        }
        this.trace("Done.");
    },
    aftercanonicalCollection: function (states /* as produced by `this.canonicalCollection()` */ ) {
        var trace = this.trace;
        trace("\nItem sets\n------");

        states.forEach(function (state, i) {
            trace("\nitem set", i, "\n" + state.join("\n"), '\ntransitions -> ', JSON.stringify(state.edges));
        });
    }
};

var parser = typal.beget();

generatorMixin.createParser = function createParser () {
    var p = eval(this.generateModuleExpr());

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

function traceParseError (err, hash) {
    this.trace(err);
}

function parseError (str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
}

parser.parseError = lrGeneratorMixin.parseError = parseError;

parser.parse = function parse (input) {
    var self = this,
        stack = [0],
        tstack = [],        // token stack (only used when `%options token_stack` support has been enabled)
        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,     // (only used when the grammar contains error recovery rules)
        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

_lexer_without_token_stack:
    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
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
            token = self.symbols_[token] || token;
        }
        return token;
    }

_lexer_with_token_stack_end:
    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }

_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules
    // Return the rule stack depth where the nearest error rule can be found.
    // Return FALSE when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = stack.length - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            if ((TERROR.toString()) in table[state]) {
                return depth;
            }
            if (state === 0 || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
            }
            stack_probe -= 2; // popStack(1): [symbol, action]
            state = stack[stack_probe];
            ++depth;
        }
    }
_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

_handle_error_with_recovery:                // run this code when the grammar includes error recovery rules
            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var error_rule_depth;
                var errStr = '';

                if (!recovering) {
                    // first see if there's any chance at hitting an error recovery rule:
                    error_rule_depth = locateNearestErrorRecoveryRule(state);

                    // Report error
                    expected = collect_expected_token_set(state);
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                                 (symbol === EOF ? 'end of input' :
                                  ("'" + (this.terminals_[symbol] || symbol) + "'"));
                    }
                    a = this.parseError(errStr, p = {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false),
                        state_stack: stack
                    });
                    if (!p.recoverable) {
                        retval = a;
                        break;
                    }
                } else if (preErrorSymbol !== EOF) {
                    error_rule_depth = locateNearestErrorRecoveryRule(state);
                }

                // just recovered from another error
                if (recovering === 3) {
                    if (symbol === EOF || preErrorSymbol === EOF) {
                        retval = this.parseError(errStr || 'Parsing halted while starting to recover from another error.', {
                            text: lexer.match,
                            token: this.terminals_[symbol] || symbol,
                            token_id: symbol,
                            line: lexer.yylineno,
                            loc: yyloc,
                            expected: expected,
                            recoverable: false,
                            state_stack: stack
                        });
                        break;
                    }

                    // discard current lookahead and grab another
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    symbol = lex();
                }

                // try to recover from error
                if (error_rule_depth === false) {
                    retval = this.parseError(errStr || 'Parsing halted. No suitable error recovery rule available.', {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack
                    });
                    break;
                }
                popStack(error_rule_depth);

                preErrorSymbol = (symbol === TERROR ? null : symbol); // save the lookahead token
                symbol = TERROR;         // insert generic error symbol as new lookahead
                state = stack[stack.length - 1];
                action = table[state] && table[state][TERROR];
                recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
            }

_handle_error_no_recovery:                  // run this code when the grammar does not include any error recovery rules
            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr;

                // Report error
                expected = collect_expected_token_set(state);
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ":\n" + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                             (symbol === EOF ? 'end of input' :
                              ("'" + (this.terminals_[symbol] || symbol) + "'"));
                }
                // we cannot recover from the error!
                retval = this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }
_handle_error_end_of_section:                  // this concludes the error recovery / no error recovery code section choice above

            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    if (recovering > 0) {
                        recovering--;
                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
};


/*
 * LR(0) Parser
 */

var lr0 = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    type: "LR(0)",
    afterconstructor: function lr0_afterconstructor () {
        this.buildTable();
    }
});

var LR0Generator = exports.LR0Generator = lr0.construct();

/*
 * Simple LALR(1)
 */

var lalr = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    type: "LALR(1)",

    afterconstructor: function (typal_property_return_value, grammar, options) {
        if (this.DEBUG) {
            this.mix(lrGeneratorDebug, lalrGeneratorDebug); // mixin debug methods
        }

        options = options || {};
        this.states = this.canonicalCollection();
        this.terms_ = {};

        var newg = this.newg = typal.beget(lookaheadMixin, {
            oldg: this,
            trace: this.trace,
            nterms_: {},
            DEBUG: false,
            go_: function (r, B) {
                r = r.split(":")[0]; // grab state #
                B = B.map(function (b) {
                    return b.slice(b.indexOf(":") + 1);
                });
                return this.oldg.go(r, B);
            }
        });
        newg.nonterminals = {};
        newg.productions = [];

        this.inadequateStates = [];

        // if true, only lookaheads in inadequate states are computed (faster, larger table)
        // if false, lookaheads for all reductions will be computed (slower, smaller table)
        this.onDemandLookahead = options.onDemandLookahead || false;
        if (this.DEBUG) Jison.print('LALR: using on-demand look-ahead: ', (this.onDemandLookahead ? 'yes' : 'no'));

        this.buildNewGrammar();
        newg.computeLookaheads();
        this.unionLookaheads();

        this.table = this.parseTable(this.states);
        this.defaultActions = findDefaults(this.table);
    },

    lookAheads: function LALR_lookaheads (state, item) {
        return (this.onDemandLookahead && !state.inadequate) ? this.terminals : item.follows;
    },
    go: function LALR_go (p, w) {
        var q = parseInt(p, 10);
        for (var i = 0; i < w.length; i++) {
            q = this.states.item(q).edges[w[i]] || q;
        }
        return q;
    },
    goPath: function LALR_goPath (p, w) {
        var q = parseInt(p, 10), t,
            path = [];
        for (var i = 0; i < w.length; i++) {
            t = w[i] ? q + ':' + w[i] : '';
            if (t) {
                this.newg.nterms_[t] = q;
            }
            path.push(t);
            q = this.states.item(q).edges[w[i]] || q;
            this.terms_[t] = w[i];
        }
        return {path: path, endState: q};
    },
    // every disjoint reduction of a nonterminal becomes a production in G'
    buildNewGrammar: function LALR_buildNewGrammar () {
        var self = this,
            newg = this.newg;

        this.states.forEach(function (state, i) {
            state.forEach(function (item) {
                if (item.dotPosition === 0) {
                    // new symbols are a combination of state and transition symbol
                    var symbol = i + ":" + item.production.symbol;
                    self.terms_[symbol] = item.production.symbol;
                    newg.nterms_[symbol] = i;
                    if (!newg.nonterminals[symbol]) {
                        newg.nonterminals[symbol] = new Nonterminal(symbol);
                    }
                    var pathInfo = self.goPath(i, item.production.handle);
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

                    //self.trace('new production:',p);
                }
            });
            if (state.inadequate) {
                self.inadequateStates.push(i);
            }
        });
    },
    unionLookaheads: function LALR_unionLookaheads () {
        var self = this,
            newg = this.newg,
            states = !!this.onDemandLookahead ? this.inadequateStates : this.states;

        states.forEach(function union_states_forEach (i) {
            var state = typeof i === 'number' ? self.states.item(i) : i,
                follows = [];
            if (state.reductions.length) {
                state.reductions.forEach(function union_reduction_forEach (item) {
                    var follows = {};
                    for (var k = 0; k < item.follows.length; k++) {
                        follows[item.follows[k]] = true;
                    }
                    state.goes[item.production.handle.join(' ')].forEach(function reduction_goes_forEach (symbol) {
                        newg.nonterminals[symbol].follows.forEach(function goes_follows_forEach (symbol) {
                            var terminal = self.terms_[symbol];
                            if (!follows[terminal]) {
                                follows[terminal] = true;
                                item.follows.push(terminal);
                            }
                        });
                    });
                    //self.trace('unioned item', item);
                });
            }
        });
    }
});

var LALRGenerator = exports.LALRGenerator = lalr.construct();

// LALR generator debug mixin

var lalrGeneratorDebug = {
    trace: function trace () {
        Jison.print.apply(null, arguments);
    },
    beforebuildNewGrammar: function () {
        this.trace(this.states.size() + " states.");
        this.trace("Building lookahead grammar.");
    },
    beforeunionLookaheads: function () {
        this.trace("Computing lookaheads.");
    }
};

/*
 * Lookahead parser definitions
 *
 * Define base type
 */
var lrLookaheadGenerator = generator.beget(lookaheadMixin, generatorMixin, lrGeneratorMixin, {
    afterconstructor: function lr_aftercontructor () {
        this.computeLookaheads();
        this.buildTable();
    }
});

/*
 * SLR Parser
 */
var SLRGenerator = exports.SLRGenerator = lrLookaheadGenerator.construct({
    type: "SLR(1)",

    lookAheads: function SLR_lookAhead (state, item) {
        return this.nonterminals[item.production.symbol].follows;
    }
});


/*
 * LR(1) Parser
 */
var lr1 = lrLookaheadGenerator.beget({
    type: "Canonical LR(1)",

    lookAheads: function LR_lookAheads (state, item) {
        return item.follows;
    },
    Item: lrGeneratorMixin.Item.prototype.construct({
        afterconstructor: function () {
            this.id = this.production.id + 'a' + this.dotPosition + 'a' + this.follows.sort().join(',');
        },
        eq: function (e) {
            return e.id === this.id;
        }
    }),

    closureOperation: function LR_ClosureOperation (itemSet) {
        var closureSet = new this.ItemSet();
        var self = this;

        var set = itemSet,
            itemQueue, syms = {};

        do {
            itemQueue = new Set();
            closureSet.concat(set);
            set.forEach(function (item) {
                var symbol = item.markedSymbol;
                var b, r;

                // if token is a nonterminal, recursively add closures
                if (symbol && self.nonterminals[symbol]) {
                    r = item.remainingHandle();
                    b = self.first(item.remainingHandle());
                    if (b.length === 0 || item.production.nullable || self.nullable(r)) {
                        b = b.concat(item.follows);
                    }
                    self.nonterminals[symbol].productions.forEach(function (production) {
                        var newItem = new self.Item(production, 0, b);
                        if(!closureSet.contains(newItem) && !itemQueue.contains(newItem)) {
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
var ll = generator.beget(lookaheadMixin, generatorMixin, {
    type: "LL(1)",

    afterconstructor: function ll_aftercontructor () {
        this.computeLookaheads();
        this.table = this.parseTable(this.productions);
    },
    parseTable: function llParseTable (productions) {
        var table = {},
            self = this;
        productions.forEach(function (production, i) {
            var row = table[production.symbol] || {};
            var tokens = production.first;
            if (self.nullable(production.handle)) {
                Set.union(tokens, self.nonterminals[production.symbol].follows);
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
        });

        return table;
    },

    // Generates the code of the parser module, which consists of two parts:
    // - module.commonCode: initialization code that should be placed before the module
    // - module.moduleCode: code that creates the module object
    generateModule_: function ll_GenerateModule_ () {
        // var parseFn = String(parser.parse);
        // parseFn = pickErrorHandlingChunk(parseFn, this.hasErrorRecovery);

        // parseFn = addOrRemoveTokenStack(parseFn, this.options['token-stack']);

        // // always remove the feature markers in the template code.
        // parseFn = removeFeatureMarkers(parseFn);

        // Generate code with fresh variable names
        nextVariableId = 0;
        // var tableCode = this.generateTableCode(this.table);

        // // Generate the initialization code
        // var commonCode = tableCode.commonCode;

        // sort hash table by key to produce a nicer output:
        function sortSymbolTable(tbl) {
            var a = Object.keys(tbl);
            a.sort();
            var nt = {};
            var k;
            for (var i = 0, len = a.length; i < len; i++) {
                k = a[i];
                nt[k] = tbl[k];
            }
            return nt;
        }

        function produceProductionsForDebugging(tbl, sym) {
            var prods = {};
            for (var nonterm in tbl) {
                var entry = tbl[nonterm];
                var id = sym[nonterm];
                var item_prods = {};
                var item_tbl = entry.productions._items;
                for (var i = 0, len = item_tbl.length; i < len; i++) {
                    var p = item_tbl[i];
                    item_prods[p.id] = p.handle.map(function (t) {
                        if (!t) {
                            t = '<epsilon>';
                        }
                        return t;
                    }).join(' ');
                }
                prods[nonterm] = item_prods;
            }
            return prods;
        }

        // Generate the module creation code
        // var moduleCode = '{\n';
        // moduleCode += [
        //     'trace: ' + String(this.trace || parser.trace),
        //     'JisonParserError: JisonParserError',
        //     'yy: {}',
        //     'symbols_: ' + JSON.stringify(sortSymbolTable(this.symbols_), null, 2),
        //     'terminals_: ' + JSON.stringify(this.terminals_, null, 2).replace(/"([0-9]+)":/g, '$1:'),
        //     'nonterminals_: ' + JSON.stringify(produceProductionsForDebugging(this.nonterminals, this.symbols_), null, 2).replace(/"([0-9]+)":/g, '$1:'),
        //     'productions_: ' + JSON.stringify(this.productions_, null, 2),
        //     'performAction: ' + String(this.performAction),
        //     'table: ' + tableCode.moduleCode,
        //     'defaultActions: ' + JSON.stringify(this.defaultActions, null, 2).replace(/"([0-9]+)":/g, '$1:'),
        //     'parseError: ' + String(this.parseError || (this.hasErrorRecovery ? traceParseError : parser.parseError)),
        //     'parse: ' + parseFn
        //     ].join(',\n');
        // moduleCode += '\n};';


        // Generate the module creation code
        var moduleCode = '{\n';
        moduleCode += [
            'trace: ' + String(this.trace),
            'JisonParserError: JisonParserError',
            'yy: {}',
            'self: ' + JSON.stringify(this, null, 2)
            ].join(',\n');
        moduleCode += '\n};';

        return { commonCode: (new Array(100)).join("commonCode\n"), moduleCode: moduleCode }
    }
});

var LLGenerator = exports.LLGenerator = ll.construct();

Jison.Generator = function Jison_Generator (g, options) {
    var opt = typal.mix.call({}, g.options, options);
    switch (opt.type || '') {
        case 'lr0':
            return new LR0Generator(g, opt);
        case 'slr':
            return new SLRGenerator(g, opt);
        case 'lr':
        case 'lr1':
            return new LR1Generator(g, opt);
        case 'll':
        case 'll1':
            return new LLGenerator(g, opt);
        case 'lalr1':
        case 'lalr':
        case '':
            return new LALRGenerator(g, opt);
        default:
            throw new Error('Unsupported parser type: ' + opt.type);
    }
};

return function Parser (g, options) {
    var gen = Jison.Generator(g, options);
    return gen.createParser();
};

})();

}).call(this,require('_process'))
},{"../package.json":24,"./util/ebnf-parser.js":3,"./util/regexp-lexer.js":8,"./util/set":9,"./util/typal":11,"_process":21,"assert":12,"fs":13,"path":20}],3:[function(require,module,exports){
var bnf = require("./parser").parser,
    ebnf = require("./ebnf-transform"),
    jisonlex = require("./lex-parser");

exports.parse = function parse (grammar) { return bnf.parse(grammar); };
exports.transform = ebnf.transform;

// adds a declaration to the grammar
bnf.yy.addDeclaration = function (grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start;
    } else if (decl.lex) {
        grammar.lex = parseLex(decl.lex);
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
    } else if (decl.parseParam) {
        if (!grammar.parseParams) grammar.parseParams = [];
        grammar.parseParams = grammar.parseParams.concat(decl.parseParam);
    } else if (decl.parserType) {
        if (!grammar.options) grammar.options = {};
        grammar.options.type = decl.parserType;
    } else if (decl.include) {
        if (!grammar.moduleInclude) grammar.moduleInclude = '';
        grammar.moduleInclude += decl.include;
    } else if (decl.options) {
        if (!grammar.options) grammar.options = {};
        // last occurrence of %option wins:
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
    }
};

// parse an embedded lex section
var parseLex = function (text) {
    text = text.replace(/(?:^%lex)|(?:\/lex$)/g, '');
    return jisonlex.parse(text);
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
            // by default *copies* the lexer token value, i.e. `$$ = $1` is the default action,
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
/* parser generated by jison 0.4.17-113 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    trace: function(errorMessage, errorHash),
 *    JisonParserError: function(msg, hash),
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    productions_: [...],
 *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),
 *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)
 *    table: [...],
 *    defaultActions: {...},
 *    parseError: function(str, hash),
 *    parse: function(input),
 *
 *    lexer: {
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(),
 *        upcomingInput: function(),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        popState: function(),
 *        _currentRules: function(),
 *        topState: function(),
 *        pushState: function(condition),
 *        stateStackSize: function(),
 *
 *        options: { ... },
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
 *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
 *  }
 *
 * ---
 *
 * The parseError function receives a 'hash' object with these members for lexer and parser errors:
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
 *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                              optional: you can specify a pre_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval) { return retval; }
 *                              optional: you can specify a post_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`. When it does not return any value, the parser will return 
 *                              the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy)
 *                              optional: is invoked before the parse cycle starts (and before the first invocation 
 *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).
 *      post_parse: function(yy, retval) { return retval; }
 *                              optional: is invoked when the parse terminates due to success ('accept') or failure 
 *                              (even when exceptions are thrown).  `retval` contains the return value to be produced
 *                              by `Parser.parse()`; this function can override the return value by returning another. 
 *                              When it does not return any value, the parser will return the original `retval`. 
 *                              This function is invoked immediately before `Parser.post_parse()`.
 *      parseError: function(str, hash)
 *                              optional: overrides the default `parseError` function.
 *  }
 *
 *  parser.lexer.options: {
 *      ranges: boolean         optional: true ==> token location info will include a .range[] member.
 *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested
 *                                                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                              optional: true ==> lexer regexes are tested in order and for each matching
 *                                                 regex the action code is invoked; the lexer terminates
 *                                                 the scan when a token is returned by the action code.
 *      pre_lex:  function()
 *                              optional: is invoked before the lexer is invoked to produce another token.
 *                              `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                              optional: is invoked when the lexer has produced a token `token`;
 *                              this function can override the returned token value by returning another.
 *                              When it does not return any (truthy) value, the lexer will return the original `token`.
 *                              `this` refers to the Lexer object.
 *  }
 */
var lexParser = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonParserError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonParserError.prototype = Object.create(Error.prototype);
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';

function __expand__(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

var $V0=[130,136,138,140,142,145,174],
    $V1=[36,40,46,47,94,123,124,142,157,158,164,165,170,172,173],
    $V2=[41,123,124,130,136,138,140,142,145,174],
    $V3=[36,40,41,46,47,94,123,124,130,136,138,140,142,145,157,158,164,165,170,172,173,174],
    $V4=[41,124],
    $V5=[36,40,41,42,43,46,47,63,94,123,124,130,136,138,140,142,145,157,158,164,165,170,171,172,173,174],
    $V6=[130,136,138,140,142,145,146,174],
    $V7=[36,40,46,47,60,94,123,124,130,132,136,138,140,142,145,157,158,164,165,170,172,173,174,180],
    $V8=[132,180],
    $V9=[36,40,46,47,60,94,123,124,130,132,142,157,158,164,165,170,172,173],
    $Va=[164,167],
    $Vb=[123,125];

var parser = {
trace: function trace() { },
JisonParserError: JisonParserError,
yy: {},
symbols_: {
  "$": 36,
  "$accept": 0,
  "$end": 1,
  "%%": 130,
  "(": 40,
  ")": 41,
  "*": 42,
  "+": 43,
  ",": 44,
  ".": 46,
  "/": 47,
  "/!": 158,
  "<": 60,
  "=": 61,
  ">": 62,
  "?": 63,
  "ACTION": 142,
  "ACTION_BODY": 152,
  "CHARACTER_LIT": 173,
  "CODE": 183,
  "EOF": 132,
  "ESCAPE_CHAR": 170,
  "INCLUDE": 180,
  "NAME": 136,
  "NAME_BRACE": 164,
  "OPTIONS": 174,
  "OPTIONS_END": 176,
  "OPTION_VALUE": 178,
  "PATH": 181,
  "RANGE_REGEX": 171,
  "REGEX_SET": 169,
  "REGEX_SET_END": 167,
  "REGEX_SET_START": 165,
  "SPECIAL_GROUP": 157,
  "START_COND": 146,
  "START_EXC": 140,
  "START_INC": 138,
  "STRING_LIT": 172,
  "UNKNOWN_DECL": 145,
  "^": 94,
  "action": 149,
  "action_body": 150,
  "action_comments_body": 151,
  "any_group_regex": 161,
  "definition": 135,
  "definitions": 129,
  "error": 2,
  "escape_char": 163,
  "extra_lexer_module_code": 133,
  "include_macro_code": 143,
  "init": 128,
  "lex": 127,
  "module_code_chunk": 182,
  "name_expansion": 159,
  "name_list": 153,
  "names_exclusive": 141,
  "names_inclusive": 139,
  "option": 177,
  "option_list": 175,
  "optional_module_code_chunk": 179,
  "options": 144,
  "range_regex": 160,
  "regex": 137,
  "regex_base": 156,
  "regex_concat": 155,
  "regex_list": 154,
  "regex_set": 166,
  "regex_set_atom": 168,
  "rule": 147,
  "rules": 134,
  "rules_and_epilogue": 131,
  "start_conditions": 148,
  "string": 162,
  "{": 123,
  "|": 124,
  "}": 125
},
terminals_: {
  1: "$end",
  2: "error",
  36: "$",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  44: ",",
  46: ".",
  47: "/",
  60: "<",
  61: "=",
  62: ">",
  63: "?",
  94: "^",
  123: "{",
  124: "|",
  125: "}",
  130: "%%",
  132: "EOF",
  136: "NAME",
  138: "START_INC",
  140: "START_EXC",
  142: "ACTION",
  145: "UNKNOWN_DECL",
  146: "START_COND",
  152: "ACTION_BODY",
  157: "SPECIAL_GROUP",
  158: "/!",
  164: "NAME_BRACE",
  165: "REGEX_SET_START",
  167: "REGEX_SET_END",
  169: "REGEX_SET",
  170: "ESCAPE_CHAR",
  171: "RANGE_REGEX",
  172: "STRING_LIT",
  173: "CHARACTER_LIT",
  174: "OPTIONS",
  176: "OPTIONS_END",
  178: "OPTION_VALUE",
  180: "INCLUDE",
  181: "PATH",
  183: "CODE"
},
nonterminals_: {
  "$accept": {
    0: "lex $end"
  },
  "lex": {
    1: "init definitions %% rules_and_epilogue"
  },
  "rules_and_epilogue": {
    2: "EOF",
    3: "%% extra_lexer_module_code EOF",
    4: "rules %% extra_lexer_module_code EOF",
    5: "rules EOF"
  },
  "init": {
    6: "<epsilon>"
  },
  "definitions": {
    7: "definition definitions",
    8: "<epsilon>"
  },
  "definition": {
    9: "NAME regex",
    10: "START_INC names_inclusive",
    11: "START_EXC names_exclusive",
    12: "ACTION",
    13: "include_macro_code",
    14: "options",
    15: "UNKNOWN_DECL"
  },
  "names_inclusive": {
    16: "START_COND",
    17: "names_inclusive START_COND"
  },
  "names_exclusive": {
    18: "START_COND",
    19: "names_exclusive START_COND"
  },
  "rules": {
    20: "rules rule",
    21: "rule"
  },
  "rule": {
    22: "start_conditions regex action"
  },
  "action": {
    23: "{ action_body }",
    24: "ACTION",
    25: "include_macro_code"
  },
  "action_body": {
    26: "action_comments_body",
    27: "action_body { action_body } action_comments_body"
  },
  "action_comments_body": {
    28: "<epsilon>",
    29: "action_comments_body ACTION_BODY"
  },
  "start_conditions": {
    30: "< name_list >",
    31: "< * >",
    32: "<epsilon>"
  },
  "name_list": {
    33: "NAME",
    34: "name_list , NAME"
  },
  "regex": {
    35: "regex_list"
  },
  "regex_list": {
    36: "regex_list | regex_concat",
    37: "regex_list |",
    38: "regex_concat",
    39: "<epsilon>"
  },
  "regex_concat": {
    40: "regex_concat regex_base",
    41: "regex_base"
  },
  "regex_base": {
    42: "( regex_list )",
    43: "SPECIAL_GROUP regex_list )",
    44: "regex_base +",
    45: "regex_base *",
    46: "regex_base ?",
    47: "/ regex_base",
    48: "/! regex_base",
    49: "name_expansion",
    50: "regex_base range_regex",
    51: "any_group_regex",
    52: ".",
    53: "^",
    54: "$",
    55: "string",
    56: "escape_char"
  },
  "name_expansion": {
    57: "NAME_BRACE"
  },
  "any_group_regex": {
    58: "REGEX_SET_START regex_set REGEX_SET_END"
  },
  "regex_set": {
    59: "regex_set_atom regex_set",
    60: "regex_set_atom"
  },
  "regex_set_atom": {
    61: "REGEX_SET",
    62: "name_expansion"
  },
  "escape_char": {
    63: "ESCAPE_CHAR"
  },
  "range_regex": {
    64: "RANGE_REGEX"
  },
  "string": {
    65: "STRING_LIT",
    66: "CHARACTER_LIT"
  },
  "options": {
    67: "OPTIONS option_list OPTIONS_END"
  },
  "option_list": {
    68: "option option_list",
    69: "option"
  },
  "option": {
    70: "NAME",
    71: "NAME = OPTION_VALUE",
    72: "NAME = NAME"
  },
  "extra_lexer_module_code": {
    73: "optional_module_code_chunk",
    74: "optional_module_code_chunk include_macro_code extra_lexer_module_code"
  },
  "include_macro_code": {
    75: "INCLUDE PATH",
    76: "INCLUDE error"
  },
  "module_code_chunk": {
    77: "CODE",
    78: "module_code_chunk CODE"
  },
  "optional_module_code_chunk": {
    79: "module_code_chunk",
    80: "<epsilon>"
  }
},
productions_: [
  0,
  [
    127,
    4
  ],
  [
    131,
    1
  ],
  [
    131,
    3
  ],
  [
    131,
    4
  ],
  [
    131,
    2
  ],
  [
    128,
    0
  ],
  [
    129,
    2
  ],
  [
    129,
    0
  ],
  [
    135,
    2
  ],
  [
    135,
    2
  ],
  [
    135,
    2
  ],
  [
    135,
    1
  ],
  [
    135,
    1
  ],
  [
    135,
    1
  ],
  [
    135,
    1
  ],
  [
    139,
    1
  ],
  [
    139,
    2
  ],
  [
    141,
    1
  ],
  [
    141,
    2
  ],
  [
    134,
    2
  ],
  [
    134,
    1
  ],
  [
    147,
    3
  ],
  [
    149,
    3
  ],
  [
    149,
    1
  ],
  [
    149,
    1
  ],
  [
    150,
    1
  ],
  [
    150,
    5
  ],
  [
    151,
    0
  ],
  [
    151,
    2
  ],
  [
    148,
    3
  ],
  [
    148,
    3
  ],
  [
    148,
    0
  ],
  [
    153,
    1
  ],
  [
    153,
    3
  ],
  [
    137,
    1
  ],
  [
    154,
    3
  ],
  [
    154,
    2
  ],
  [
    154,
    1
  ],
  [
    154,
    0
  ],
  [
    155,
    2
  ],
  [
    155,
    1
  ],
  [
    156,
    3
  ],
  [
    156,
    3
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    1
  ],
  [
    156,
    2
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    159,
    1
  ],
  [
    161,
    3
  ],
  [
    166,
    2
  ],
  [
    166,
    1
  ],
  [
    168,
    1
  ],
  [
    168,
    1
  ],
  [
    163,
    1
  ],
  [
    160,
    1
  ],
  [
    162,
    1
  ],
  [
    162,
    1
  ],
  [
    144,
    3
  ],
  [
    175,
    2
  ],
  [
    175,
    1
  ],
  [
    177,
    1
  ],
  [
    177,
    3
  ],
  [
    177,
    3
  ],
  [
    133,
    1
  ],
  [
    133,
    3
  ],
  [
    143,
    2
  ],
  [
    143,
    2
  ],
  [
    182,
    1
  ],
  [
    182,
    2
  ],
  [
    179,
    1
  ],
  [
    179,
    0
  ]
],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1 : 
/*! Production::     lex : init definitions '%%' rules_and_epilogue */
 
          this.$ = $$[$0];
          if ($$[$0-2][0]) this.$.macros = $$[$0-2][0];
          if ($$[$0-2][1]) this.$.startConditions = $$[$0-2][1];
          if ($$[$0-2][2]) this.$.unknownDecls = $$[$0-2][2];
          // if there are any options, add them all, otherwise set options to NULL:
          // can't check for 'empty object' by `if (yy.options) ...` so we do it this way:
          for (var k in yy.options) {
            this.$.options = yy.options;
            break;
          }
          if (yy.actionInclude) this.$.actionInclude = yy.actionInclude;
          delete yy.options;
          delete yy.actionInclude;
          return this.$;
         
break;
case 2 : 
/*! Production::     rules_and_epilogue : EOF */
 
        this.$ = { rules: [] };
       
break;
case 3 : 
/*! Production::     rules_and_epilogue : '%%' extra_lexer_module_code EOF */
 
        if ($$[$0-1] && $$[$0-1].trim() !== '') {
          this.$ = { rules: [], moduleInclude: $$[$0-1] };
        } else {
          this.$ = { rules: [] };
        }
       
break;
case 4 : 
/*! Production::     rules_and_epilogue : rules '%%' extra_lexer_module_code EOF */
 
        if ($$[$0-1] && $$[$0-1].trim() !== '') {
          this.$ = { rules: $$[$0-3], moduleInclude: $$[$0-1] };
        } else {
          this.$ = { rules: $$[$0-3] };
        }
       
break;
case 5 : 
/*! Production::     rules_and_epilogue : rules EOF */
 
        this.$ = { rules: $$[$0-1] };
       
break;
case 6 : 
/*! Production::     init :  */
 
            yy.actionInclude = '';
            if (!yy.options) yy.options = {};
         
break;
case 7 : 
/*! Production::     definitions : definition definitions */
 
          this.$ = $$[$0];
          if ($$[$0-1] != null) {
            if ('length' in $$[$0-1]) {
              this.$[0] = this.$[0] || {};
              this.$[0][$$[$0-1][0]] = $$[$0-1][1];
            } else if ($$[$0-1].type === 'names') {
              this.$[1] = this.$[1] || {};
              for (var name in $$[$0-1].names) {
                this.$[1][name] = $$[$0-1].names[name];
              }
            } else if ($$[$0-1].type === 'unknown') {
              this.$[2] = this.$[2] || [];
              this.$[2].push($$[$0-1].body);
            }
          }
         
break;
case 8 : 
/*! Production::     definitions :  */
  this.$ = [null, null];  
break;
case 9 : 
/*! Production::     definition : NAME regex */
  this.$ = [$$[$0-1], $$[$0]];  
break;
case 10 : 
/*! Production::     definition : START_INC names_inclusive */
 case 11 : 
/*! Production::     definition : START_EXC names_exclusive */
 case 24 : 
/*! Production::     action : ACTION */
 case 25 : 
/*! Production::     action : include_macro_code */
 case 26 : 
/*! Production::     action_body : action_comments_body */
 case 63 : 
/*! Production::     escape_char : ESCAPE_CHAR */
 case 64 : 
/*! Production::     range_regex : RANGE_REGEX */
 case 73 : 
/*! Production::     extra_lexer_module_code : optional_module_code_chunk */
 case 77 : 
/*! Production::     module_code_chunk : CODE */
 case 79 : 
/*! Production::     optional_module_code_chunk : module_code_chunk */
  this.$ = $$[$0];  
break;
case 12 : 
/*! Production::     definition : ACTION */
 case 13 : 
/*! Production::     definition : include_macro_code */
  yy.actionInclude += $$[$0]; this.$ = null;  
break;
case 14 : 
/*! Production::     definition : options */
  this.$ = null;  
break;
case 15 : 
/*! Production::     definition : UNKNOWN_DECL */
  this.$ = {type: 'unknown', body: $$[$0]};  
break;
case 16 : 
/*! Production::     names_inclusive : START_COND */
  this.$ = {type: 'names', names: {}}; this.$.names[$$[$0]] = 0;  
break;
case 17 : 
/*! Production::     names_inclusive : names_inclusive START_COND */
  this.$ = $$[$0-1]; this.$.names[$$[$0]] = 0;  
break;
case 18 : 
/*! Production::     names_exclusive : START_COND */
  this.$ = {type: 'names', names: {}}; this.$.names[$$[$0]] = 1;  
break;
case 19 : 
/*! Production::     names_exclusive : names_exclusive START_COND */
  this.$ = $$[$0-1]; this.$.names[$$[$0]] = 1;  
break;
case 20 : 
/*! Production::     rules : rules rule */
  this.$ = $$[$0-1]; this.$.push($$[$0]);  
break;
case 21 : 
/*! Production::     rules : rule */
 case 33 : 
/*! Production::     name_list : NAME */
  this.$ = [$$[$0]];  
break;
case 22 : 
/*! Production::     rule : start_conditions regex action */
  this.$ = $$[$0-2] ? [$$[$0-2], $$[$0-1], $$[$0]] : [$$[$0-1], $$[$0]];  
break;
case 23 : 
/*! Production::     action : '{' action_body '}' */
 case 30 : 
/*! Production::     start_conditions : '<' name_list '>' */
  this.$ = $$[$0-1];  
break;
case 27 : 
/*! Production::     action_body : action_body '{' action_body '}' action_comments_body */
  this.$ = $$[$0-4] + $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 28 : 
/*! Production::     action_comments_body :  */
 case 39 : 
/*! Production::     regex_list :  */
 case 80 : 
/*! Production::     optional_module_code_chunk :  */
  this.$ = '';  
break;
case 29 : 
/*! Production::     action_comments_body : action_comments_body ACTION_BODY */
 case 40 : 
/*! Production::     regex_concat : regex_concat regex_base */
 case 50 : 
/*! Production::     regex_base : regex_base range_regex */
 case 59 : 
/*! Production::     regex_set : regex_set_atom regex_set */
 case 78 : 
/*! Production::     module_code_chunk : module_code_chunk CODE */
  this.$ = $$[$0-1] + $$[$0];  
break;
case 31 : 
/*! Production::     start_conditions : '<' '*' '>' */
  this.$ = ['*'];  
break;
case 34 : 
/*! Production::     name_list : name_list ',' NAME */
  this.$ = $$[$0-2]; this.$.push($$[$0]);  
break;
case 35 : 
/*! Production::     regex : regex_list */
 
          this.$ = $$[$0];
          if (yy.options && yy.options.easy_keyword_rules && this.$.match(/[\w\d]$/) && !this.$.match(/\\(r|f|n|t|v|s|b|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}|[0-7]{1,3})$/)) {
              this.$ += "\\b";
          }
         
break;
case 36 : 
/*! Production::     regex_list : regex_list '|' regex_concat */
  this.$ = $$[$0-2] + '|' + $$[$0];  
break;
case 37 : 
/*! Production::     regex_list : regex_list '|' */
  this.$ = $$[$0-1] + '|';  
break;
case 42 : 
/*! Production::     regex_base : '(' regex_list ')' */
  this.$ = '(' + $$[$0-1] + ')';  
break;
case 43 : 
/*! Production::     regex_base : SPECIAL_GROUP regex_list ')' */
  this.$ = $$[$0-2] + $$[$0-1] + ')';  
break;
case 44 : 
/*! Production::     regex_base : regex_base '+' */
  this.$ = $$[$0-1] + '+';  
break;
case 45 : 
/*! Production::     regex_base : regex_base '*' */
  this.$ = $$[$0-1] + '*';  
break;
case 46 : 
/*! Production::     regex_base : regex_base '?' */
  this.$ = $$[$0-1] + '?';  
break;
case 47 : 
/*! Production::     regex_base : '/' regex_base */
  this.$ = '(?=' + $$[$0] + ')';  
break;
case 48 : 
/*! Production::     regex_base : '/!' regex_base */
  this.$ = '(?!' + $$[$0] + ')';  
break;
case 52 : 
/*! Production::     regex_base : '.' */
  this.$ = '.';  
break;
case 53 : 
/*! Production::     regex_base : '^' */
  this.$ = '^';  
break;
case 54 : 
/*! Production::     regex_base : '$' */
  this.$ = '$';  
break;
case 58 : 
/*! Production::     any_group_regex : REGEX_SET_START regex_set REGEX_SET_END */
 case 74 : 
/*! Production::     extra_lexer_module_code : optional_module_code_chunk include_macro_code extra_lexer_module_code */
  this.$ = $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 62 : 
/*! Production::     regex_set_atom : name_expansion */
  this.$ = '{[' + $$[$0] + ']}';  
break;
case 65 : 
/*! Production::     string : STRING_LIT */
  this.$ = prepareString($$[$0].substr(1, $$[$0].length - 2));  
break;
case 70 : 
/*! Production::     option : NAME[option] */
  yy.options[$$[$0]] = true;  
break;
case 71 : 
/*! Production::     option : NAME[option] '=' OPTION_VALUE[value] */
 case 72 : 
/*! Production::     option : NAME[option] '=' NAME[value] */
  yy.options[$$[$0-2]] = $$[$0];  
break;
case 75 : 
/*! Production::     include_macro_code : INCLUDE PATH */
 
            var fs = require('fs');
            var fileContent = fs.readFileSync($$[$0], { encoding: 'utf-8' });
            // And no, we don't support nested '%include':
            this.$ = '\n// Included by Jison: ' + $$[$0] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + $$[$0] + '\n\n';
         
break;
case 76 : 
/*! Production::     include_macro_code : INCLUDE error */
 
            console.error("%include MUST be followed by a valid file path");
         
break;
}
},
table: [
  __expand__($V0, [
      2,
      6
    ], {127:1,128:2,180:[
      2,
      6
    ]
  }),
  {
    1: [
      3
    ]
  },
  {
    129: 3,
    130: [
      2,
      8
    ],
    135: 4,
    136: [
      1,
      5
    ],
    138: [
      1,
      6
    ],
    140: [
      1,
      7
    ],
    142: [
      1,
      8
    ],
    143: 9,
    144: 10,
    145: [
      1,
      11
    ],
    174: [
      1,
      13
    ],
    180: [
      1,
      12
    ]
  },
  {
    130: [
      1,
      14
    ]
  },
  {
    129: 15,
    130: [
      2,
      8
    ],
    135: 4,
    136: [
      1,
      5
    ],
    138: [
      1,
      6
    ],
    140: [
      1,
      7
    ],
    142: [
      1,
      8
    ],
    143: 9,
    144: 10,
    145: [
      1,
      11
    ],
    174: [
      1,
      13
    ],
    180: [
      1,
      12
    ]
  },
  __expand__([124,130,136,138,140,142,145,174], [
      2,
      39
    ], {137:16,154:17,155:18,156:19,159:24,161:25,162:29,163:30,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      39
    ]
  }),
  {
    139: 36,
    146: [
      1,
      37
    ]
  },
  {
    141: 38,
    146: [
      1,
      39
    ]
  },
  __expand__($V0, [
      2,
      12
    ], {180:[
      2,
      12
    ]
  }),
  __expand__($V0, [
      2,
      13
    ], {180:[
      2,
      13
    ]
  }),
  __expand__($V0, [
      2,
      14
    ], {180:[
      2,
      14
    ]
  }),
  __expand__($V0, [
      2,
      15
    ], {180:[
      2,
      15
    ]
  }),
  {
    2: [
      1,
      41
    ],
    181: [
      1,
      40
    ]
  },
  {
    136: [
      1,
      44
    ],
    175: 42,
    177: 43
  },
  __expand__($V1, [
      2,
      32
    ], {131:45,134:48,147:49,148:50,60:[
      1,
      51
    ],130:[
      1,
      47
    ],132:[
      1,
      46
    ],180:[
      2,
      32
    ]
  }),
  {
    130: [
      2,
      7
    ]
  },
  __expand__($V0, [
      2,
      9
    ], {180:[
      2,
      9
    ]
  }),
  __expand__([123,130,136,138,140,142,145,174], [
      2,
      35
    ], {124:[
      1,
      52
    ],180:[
      2,
      35
    ]
  }),
  __expand__($V2, [
      2,
      38
    ], {159:24,161:25,162:29,163:30,156:53,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      38
    ]
  }),
  __expand__($V3, [
      2,
      41
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      41
    ]
  }),
  __expand__($V4, [
      2,
      39
    ], {155:18,156:19,159:24,161:25,162:29,163:30,154:59,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ]
  }),
  __expand__($V4, [
      2,
      39
    ], {155:18,156:19,159:24,161:25,162:29,163:30,154:60,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ]
  }),
  {
    36: [
      1,
      28
    ],
    40: [
      1,
      20
    ],
    46: [
      1,
      26
    ],
    47: [
      1,
      22
    ],
    94: [
      1,
      27
    ],
    156: 61,
    157: [
      1,
      21
    ],
    158: [
      1,
      23
    ],
    159: 24,
    161: 25,
    162: 29,
    163: 30,
    164: [
      1,
      31
    ],
    165: [
      1,
      32
    ],
    170: [
      1,
      35
    ],
    172: [
      1,
      33
    ],
    173: [
      1,
      34
    ]
  },
  {
    36: [
      1,
      28
    ],
    40: [
      1,
      20
    ],
    46: [
      1,
      26
    ],
    47: [
      1,
      22
    ],
    94: [
      1,
      27
    ],
    156: 62,
    157: [
      1,
      21
    ],
    158: [
      1,
      23
    ],
    159: 24,
    161: 25,
    162: 29,
    163: 30,
    164: [
      1,
      31
    ],
    165: [
      1,
      32
    ],
    170: [
      1,
      35
    ],
    172: [
      1,
      33
    ],
    173: [
      1,
      34
    ]
  },
  __expand__($V5, [
      2,
      49
    ], {180:[
      2,
      49
    ]
  }),
  __expand__($V5, [
      2,
      51
    ], {180:[
      2,
      51
    ]
  }),
  __expand__($V5, [
      2,
      52
    ], {180:[
      2,
      52
    ]
  }),
  __expand__($V5, [
      2,
      53
    ], {180:[
      2,
      53
    ]
  }),
  __expand__($V5, [
      2,
      54
    ], {180:[
      2,
      54
    ]
  }),
  __expand__($V5, [
      2,
      55
    ], {180:[
      2,
      55
    ]
  }),
  __expand__($V5, [
      2,
      56
    ], {180:[
      2,
      56
    ]
  }),
  __expand__([36,40,41,42,43,46,47,63,94,123,124,130,136,138,140,142,145,157,158,164,165,167,169,170,171,172,173,174], [
      2,
      57
    ], {180:[
      2,
      57
    ]
  }),
  {
    159: 66,
    164: [
      1,
      31
    ],
    166: 63,
    168: 64,
    169: [
      1,
      65
    ]
  },
  __expand__($V5, [
      2,
      65
    ], {180:[
      2,
      65
    ]
  }),
  __expand__($V5, [
      2,
      66
    ], {180:[
      2,
      66
    ]
  }),
  __expand__($V5, [
      2,
      63
    ], {180:[
      2,
      63
    ]
  }),
  __expand__($V0, [
      2,
      10
    ], {146:[
      1,
      67
    ],180:[
      2,
      10
    ]
  }),
  __expand__($V6, [
      2,
      16
    ], {180:[
      2,
      16
    ]
  }),
  __expand__($V0, [
      2,
      11
    ], {146:[
      1,
      68
    ],180:[
      2,
      11
    ]
  }),
  __expand__($V6, [
      2,
      18
    ], {180:[
      2,
      18
    ]
  }),
  __expand__($V7, [
      2,
      75
    ], {183:[
      2,
      75
    ]
  }),
  __expand__($V7, [
      2,
      76
    ], {183:[
      2,
      76
    ]
  }),
  {
    176: [
      1,
      69
    ]
  },
  {
    136: [
      1,
      44
    ],
    175: 70,
    176: [
      2,
      69
    ],
    177: 43
  },
  {
    61: [
      1,
      71
    ],
    136: [
      2,
      70
    ],
    176: [
      2,
      70
    ]
  },
  {
    1: [
      2,
      1
    ]
  },
  {
    1: [
      2,
      2
    ]
  },
  __expand__($V8, [
      2,
      80
    ], {133:72,179:73,182:74,183:[
      1,
      75
    ]
  }),
  __expand__($V1, [
      2,
      32
    ], {148:50,147:78,60:[
      1,
      51
    ],130:[
      1,
      76
    ],132:[
      1,
      77
    ],180:[
      2,
      32
    ]
  }),
  __expand__($V9, [
      2,
      21
    ], {180:[
      2,
      21
    ]
  }),
  __expand__([123,124,142], [
      2,
      39
    ], {154:17,155:18,156:19,159:24,161:25,162:29,163:30,137:79,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      39
    ]
  }),
  {
    42: [
      1,
      81
    ],
    136: [
      1,
      82
    ],
    153: 80
  },
  __expand__($V2, [
      2,
      37
    ], {156:19,159:24,161:25,162:29,163:30,155:83,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      37
    ]
  }),
  __expand__($V3, [
      2,
      40
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      40
    ]
  }),
  __expand__($V5, [
      2,
      44
    ], {180:[
      2,
      44
    ]
  }),
  __expand__($V5, [
      2,
      45
    ], {180:[
      2,
      45
    ]
  }),
  __expand__($V5, [
      2,
      46
    ], {180:[
      2,
      46
    ]
  }),
  __expand__($V5, [
      2,
      50
    ], {180:[
      2,
      50
    ]
  }),
  __expand__($V5, [
      2,
      64
    ], {180:[
      2,
      64
    ]
  }),
  {
    41: [
      1,
      84
    ],
    124: [
      1,
      52
    ]
  },
  {
    41: [
      1,
      85
    ],
    124: [
      1,
      52
    ]
  },
  __expand__($V3, [
      2,
      47
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      47
    ]
  }),
  __expand__($V3, [
      2,
      48
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      48
    ]
  }),
  {
    167: [
      1,
      86
    ]
  },
  {
    159: 66,
    164: [
      1,
      31
    ],
    166: 87,
    167: [
      2,
      60
    ],
    168: 64,
    169: [
      1,
      65
    ]
  },
  __expand__($Va, [
      2,
      61
    ], {169:[
      2,
      61
    ]
  }),
  __expand__($Va, [
      2,
      62
    ], {169:[
      2,
      62
    ]
  }),
  __expand__($V6, [
      2,
      17
    ], {180:[
      2,
      17
    ]
  }),
  __expand__($V6, [
      2,
      19
    ], {180:[
      2,
      19
    ]
  }),
  __expand__($V0, [
      2,
      67
    ], {180:[
      2,
      67
    ]
  }),
  {
    176: [
      2,
      68
    ]
  },
  {
    136: [
      1,
      89
    ],
    178: [
      1,
      88
    ]
  },
  {
    132: [
      1,
      90
    ]
  },
  {
    132: [
      2,
      73
    ],
    143: 91,
    180: [
      1,
      12
    ]
  },
  __expand__($V8, [
      2,
      79
    ], {183:[
      1,
      92
    ]
  }),
  __expand__($V8, [
      2,
      77
    ], {183:[
      2,
      77
    ]
  }),
  __expand__($V8, [
      2,
      80
    ], {179:73,182:74,133:93,183:[
      1,
      75
    ]
  }),
  {
    1: [
      2,
      5
    ]
  },
  __expand__($V9, [
      2,
      20
    ], {180:[
      2,
      20
    ]
  }),
  {
    123: [
      1,
      95
    ],
    142: [
      1,
      96
    ],
    143: 97,
    149: 94,
    180: [
      1,
      12
    ]
  },
  {
    44: [
      1,
      99
    ],
    62: [
      1,
      98
    ]
  },
  {
    62: [
      1,
      100
    ]
  },
  {
    44: [
      2,
      33
    ],
    62: [
      2,
      33
    ]
  },
  __expand__($V2, [
      2,
      36
    ], {159:24,161:25,162:29,163:30,156:53,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      36
    ]
  }),
  __expand__($V5, [
      2,
      42
    ], {180:[
      2,
      42
    ]
  }),
  __expand__($V5, [
      2,
      43
    ], {180:[
      2,
      43
    ]
  }),
  __expand__($V5, [
      2,
      58
    ], {180:[
      2,
      58
    ]
  }),
  {
    167: [
      2,
      59
    ]
  },
  {
    136: [
      2,
      71
    ],
    176: [
      2,
      71
    ]
  },
  {
    136: [
      2,
      72
    ],
    176: [
      2,
      72
    ]
  },
  {
    1: [
      2,
      3
    ]
  },
  __expand__($V8, [
      2,
      80
    ], {179:73,182:74,133:101,183:[
      1,
      75
    ]
  }),
  __expand__($V8, [
      2,
      78
    ], {183:[
      2,
      78
    ]
  }),
  {
    132: [
      1,
      102
    ]
  },
  __expand__($V9, [
      2,
      22
    ], {180:[
      2,
      22
    ]
  }),
  __expand__($Vb, [
      2,
      28
    ], {150:103,151:104,152:[
      2,
      28
    ]
  }),
  __expand__($V9, [
      2,
      24
    ], {180:[
      2,
      24
    ]
  }),
  __expand__($V9, [
      2,
      25
    ], {180:[
      2,
      25
    ]
  }),
  __expand__($V1, [
      2,
      30
    ], {180:[
      2,
      30
    ]
  }),
  {
    136: [
      1,
      105
    ]
  },
  __expand__($V1, [
      2,
      31
    ], {180:[
      2,
      31
    ]
  }),
  {
    132: [
      2,
      74
    ]
  },
  {
    1: [
      2,
      4
    ]
  },
  {
    123: [
      1,
      107
    ],
    125: [
      1,
      106
    ]
  },
  __expand__($Vb, [
      2,
      26
    ], {152:[
      1,
      108
    ]
  }),
  {
    44: [
      2,
      34
    ],
    62: [
      2,
      34
    ]
  },
  __expand__($V9, [
      2,
      23
    ], {180:[
      2,
      23
    ]
  }),
  __expand__($Vb, [
      2,
      28
    ], {151:104,150:109,152:[
      2,
      28
    ]
  }),
  __expand__($Vb, [
      2,
      29
    ], {152:[
      2,
      29
    ]
  }),
  {
    123: [
      1,
      107
    ],
    125: [
      1,
      110
    ]
  },
  __expand__($Vb, [
      2,
      28
    ], {151:111,152:[
      2,
      28
    ]
  }),
  __expand__($Vb, [
      2,
      27
    ], {152:[
      1,
      108
    ]
  })
],
defaultActions: {
  15: [
    2,
    7
  ],
  45: [
    2,
    1
  ],
  46: [
    2,
    2
  ],
  70: [
    2,
    68
  ],
  77: [
    2,
    5
  ],
  87: [
    2,
    59
  ],
  90: [
    2,
    3
  ],
  101: [
    2,
    74
  ],
  102: [
    2,
    4
  ]
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = [0],

        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,     // (only used when the grammar contains error recovery rules)
        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }

    // Return the rule stack depth where the nearest error rule can be found.
    // Return FALSE when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = stack.length - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            if ((TERROR.toString()) in table[state]) {
                return depth;
            }
            if (state === 0 || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
            }
            stack_probe -= 2; // popStack(1): [symbol, action]
            state = stack[stack_probe];
            ++depth;
        }
    }


    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var error_rule_depth;
                var errStr = '';

                if (!recovering) {
                    // first see if there's any chance at hitting an error recovery rule:
                    error_rule_depth = locateNearestErrorRecoveryRule(state);

                    // Report error
                    expected = collect_expected_token_set(state);
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                                 (symbol === EOF ? 'end of input' :
                                  ("'" + (this.terminals_[symbol] || symbol) + "'"));
                    }
                    a = this.parseError(errStr, p = {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false),
                        state_stack: stack
                    });
                    if (!p.recoverable) {
                        retval = a;
                        break;
                    }
                } else if (preErrorSymbol !== EOF) {
                    error_rule_depth = locateNearestErrorRecoveryRule(state);
                }

                // just recovered from another error
                if (recovering === 3) {
                    if (symbol === EOF || preErrorSymbol === EOF) {
                        retval = this.parseError(errStr || 'Parsing halted while starting to recover from another error.', {
                            text: lexer.match,
                            token: this.terminals_[symbol] || symbol,
                            token_id: symbol,
                            line: lexer.yylineno,
                            loc: yyloc,
                            expected: expected,
                            recoverable: false,
                            state_stack: stack
                        });
                        break;
                    }

                    // discard current lookahead and grab another
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    symbol = lex();
                }

                // try to recover from error
                if (error_rule_depth === false) {
                    retval = this.parseError(errStr || 'Parsing halted. No suitable error recovery rule available.', {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack
                    });
                    break;
                }
                popStack(error_rule_depth);

                preErrorSymbol = (symbol === TERROR ? null : symbol); // save the lookahead token
                symbol = TERROR;         // insert generic error symbol as new lookahead
                state = stack[stack.length - 1];
                action = table[state] && table[state][TERROR];
                recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
            }


            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    if (recovering > 0) {
                        recovering--;
                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
}
};


function encodeRE (s) {
    return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1').replace(/\\\\u([a-fA-F0-9]{4})/g, '\\u$1');
}

function prepareString (s) {
    // unescape slashes
    s = s.replace(/\\\\/g, "\\");
    s = encodeRE(s);
    return s;
};


/* generated by jison-lex 0.3.4-113 */
var lexer = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonLexerError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonLexerError.prototype = Object.create(Error.prototype);
JisonLexerError.prototype.constructor = JisonLexerError;
JisonLexerError.prototype.name = 'JisonLexerError';

var lexer = {

EOF:1,

ERROR:2,

parseError:function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
input:function () {
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
unput:function (ch) {
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
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
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
less:function (n) {
        this.unput(this.match.slice(n));
    },

// return (part of the) already matched input, i.e. for error messages
pastInput:function (maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

// return (part of the) upcoming input, i.e. for error messages
upcomingInput:function (maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

// return a string which displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
next:function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
lex:function lex() {
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

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {
  easy_keyword_rules: true,
  ranges: true
},
JisonLexerError: JisonLexerError,
performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 2 : 
/*! Conditions:: action */ 
/*! Rule::       \/[^ /]*?['"{}'][^ ]*?\/ */ 
 return 152; // regexp with braces or quotes (and no spaces) 
break;
case 7 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++; return 123; 
break;
case 8 : 
/*! Conditions:: action */ 
/*! Rule::       \} */ 
 if (yy.depth == 0) { this.begin('trail'); } else { yy.depth--; } return 125; 
break;
case 10 : 
/*! Conditions:: conditions */ 
/*! Rule::       > */ 
 this.popState(); return 62; 
break;
case 13 : 
/*! Conditions:: rules */ 
/*! Rule::       {BR}+ */ 
 /* empty */ 
break;
case 14 : 
/*! Conditions:: rules */ 
/*! Rule::       \s+{BR}+ */ 
 /* empty */ 
break;
case 15 : 
/*! Conditions:: rules */ 
/*! Rule::       \s+ */ 
 this.begin('indented'); 
break;
case 16 : 
/*! Conditions:: rules */ 
/*! Rule::       %% */ 
 this.begin('code'); return 130; 
break;
case 17 : 
/*! Conditions:: rules */ 
/*! Rule::       [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,'""]+ */ 
 
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 173;
                                         
break;
case 20 : 
/*! Conditions:: options */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 178; 
break;
case 21 : 
/*! Conditions:: options */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 178; 
break;
case 23 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}+ */ 
 this.popState(); return 176; 
break;
case 24 : 
/*! Conditions:: options */ 
/*! Rule::       \s+{BR}+ */ 
 this.popState(); return 176; 
break;
case 25 : 
/*! Conditions:: options */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 27 : 
/*! Conditions:: start_condition */ 
/*! Rule::       {BR}+ */ 
 this.popState(); 
break;
case 28 : 
/*! Conditions:: start_condition */ 
/*! Rule::       \s+{BR}+ */ 
 this.popState(); 
break;
case 29 : 
/*! Conditions:: start_condition */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 30 : 
/*! Conditions:: trail */ 
/*! Rule::       \s*{BR}+ */ 
 this.begin('rules'); 
break;
case 31 : 
/*! Conditions:: indented */ 
/*! Rule::       \{ */ 
 yy.depth = 0; this.begin('action'); return 123; 
break;
case 32 : 
/*! Conditions:: indented */ 
/*! Rule::       %\{(.|{BR})*?%\} */ 
 this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 142; 
break;
case 33 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %\{(.|{BR})*?%\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 142; 
break;
case 34 : 
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
                                            return 180;
                                         
break;
case 35 : 
/*! Conditions:: indented */ 
/*! Rule::       .+ */ 
 this.begin('rules'); return 142; 
break;
case 36 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
 /* ignore */ 
break;
case 37 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/\/.* */ 
 /* ignore */ 
break;
case 38 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       {BR}+ */ 
 /* empty */ 
break;
case 39 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 41 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.replace(/\\"/g,'"'); return 172; 
break;
case 42 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.replace(/\\'/g,"'"); return 172; 
break;
case 43 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \[ */ 
 this.pushState('set'); return 165; 
break;
case 56 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       < */ 
 this.begin('conditions'); return 60; 
break;
case 57 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/! */ 
 return 158;                    // treated as `(?!atom)` 
break;
case 58 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/ */ 
 return 47;                     // treated as `(?=atom)` 
break;
case 60 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \\. */ 
 yy_.yytext = yy_.yytext.replace(/^\\/g, ''); return 170; 
break;
case 63 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %options\b */ 
 this.begin('options'); return 174; 
break;
case 64 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %s\b */ 
 this.begin('start_condition'); return 138; 
break;
case 65 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %x\b */ 
 this.begin('start_condition'); return 140; 
break;
case 66 : 
/*! Conditions:: INITIAL trail code */ 
/*! Rule::       %include\b */ 
 this.pushState('path'); return 180; 
break;
case 67 : 
/*! Conditions:: INITIAL rules trail code */ 
/*! Rule::       %{NAME}[^\r\n]+ */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported lexer option: ', yy_.yytext + ' while lexing in ' + this.topState() + ' state:', this._input, ' /////// ', this.matched);
                                            return 145;
                                         
break;
case 68 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %% */ 
 this.begin('rules'); return 130; 
break;
case 74 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       . */ 
 throw new Error("unsupported input character: " + yy_.yytext + " @ " + JSON.stringify(yy_.yylloc)); /* b0rk on bad characters */ 
break;
case 78 : 
/*! Conditions:: set */ 
/*! Rule::       \] */ 
 this.popState('set'); return 167; 
break;
case 80 : 
/*! Conditions:: code */ 
/*! Rule::       [^\r\n]+ */ 
 return 183;      // the bit of CODE just before EOF... 
break;
case 81 : 
/*! Conditions:: path */ 
/*! Rule::       [\r\n] */ 
 this.popState(); this.unput(yy_.yytext); 
break;
case 82 : 
/*! Conditions:: path */ 
/*! Rule::       '[^\r\n]+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 181; 
break;
case 83 : 
/*! Conditions:: path */ 
/*! Rule::       "[^\r\n]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 181; 
break;
case 84 : 
/*! Conditions:: path */ 
/*! Rule::       \s+ */ 
 // skip whitespace in the line 
break;
case 85 : 
/*! Conditions:: path */ 
/*! Rule::       [^\s\r\n]+ */ 
 this.popState(); return 181; 
break;
case 86 : 
/*! Conditions:: * */ 
/*! Rule::       . */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported lexer input: ', yy_.yytext, ' @ ' + JSON.stringify(yy_.yylloc) + 'while lexing in ' + this.topState() + ' state:', this._input, ' /////// ', this.matched);
                                         
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: action */ 
  /*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
   0 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       \/\/.* */ 
   1 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       "(\\\\|\\"|[^"])*" */ 
   3 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       '(\\\\|\\'|[^'])*' */ 
   4 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       [/"'][^{}/"']+ */ 
   5 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       [^{}/"']+ */ 
   6 : 152,
  /*! Conditions:: conditions */ 
  /*! Rule::       {NAME} */ 
   9 : 136,
  /*! Conditions:: conditions */ 
  /*! Rule::       , */ 
   11 : 44,
  /*! Conditions:: conditions */ 
  /*! Rule::       \* */ 
   12 : 42,
  /*! Conditions:: options */ 
  /*! Rule::       {NAME} */ 
   18 : 136,
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   19 : 61,
  /*! Conditions:: options */ 
  /*! Rule::       [^\s\r\n]+ */ 
   22 : 178,
  /*! Conditions:: start_condition */ 
  /*! Rule::       {ID} */ 
   26 : 146,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       {ID} */ 
   40 : 136,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \| */ 
   44 : 124,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \(\?: */ 
   45 : 157,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \(\?= */ 
   46 : 157,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \(\?! */ 
   47 : 157,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \( */ 
   48 : 40,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \) */ 
   49 : 41,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \+ */ 
   50 : 43,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \* */ 
   51 : 42,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \? */ 
   52 : 63,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \^ */ 
   53 : 94,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       , */ 
   54 : 44,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       <<EOF>> */ 
   55 : 36,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}) */ 
   59 : 170,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \$ */ 
   61 : 36,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \. */ 
   62 : 46,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \{\d+(,\s?\d+|,)?\} */ 
   69 : 171,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \{{ID}\} */ 
   70 : 164,
  /*! Conditions:: set options */ 
  /*! Rule::       \{{ID}\} */ 
   71 : 164,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \{ */ 
   72 : 123,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \} */ 
   73 : 125,
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   75 : 132,
  /*! Conditions:: set */ 
  /*! Rule::       (\\\\|\\\]|[^\]{])+ */ 
   76 : 169,
  /*! Conditions:: set */ 
  /*! Rule::       \{ */ 
   77 : 169,
  /*! Conditions:: code */ 
  /*! Rule::       [^\r\n]*(\r|\n)+ */ 
   79 : 183
},
rules: [
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:\/[^ \/]*?['"{}'][^ ]*?\/)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[\/"'][^{}\/"']+)/,
/^(?:[^{}\/"']+)/,
/^(?:\{)/,
/^(?:\})/,
/^(?:([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?))/,
/^(?:>)/,
/^(?:,)/,
/^(?:\*)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:%%)/,
/^(?:[^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,'""]+)/,
/^(?:([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?))/,
/^(?:=)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[^\s\r\n]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:\s*(\r\n|\n|\r)+)/,
/^(?:\{)/,
/^(?:%\{(.|(\r\n|\n|\r))*?%\})/,
/^(?:%\{(.|(\r\n|\n|\r))*?%\})/,
/^(?:%include\b)/,
/^(?:.+)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
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
/^(?:\\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}))/,
/^(?:\\.)/,
/^(?:\$)/,
/^(?:\.)/,
/^(?:%options\b)/,
/^(?:%s\b)/,
/^(?:%x\b)/,
/^(?:%include\b)/,
/^(?:%([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?)[^\r\n]+)/,
/^(?:%%)/,
/^(?:\{\d+(,\s?\d+|,)?\})/,
/^(?:\{([a-zA-Z_][a-zA-Z0-9_]*)\})/,
/^(?:\{([a-zA-Z_][a-zA-Z0-9_]*)\})/,
/^(?:\{)/,
/^(?:\})/,
/^(?:.)/,
/^(?:$)/,
/^(?:(\\\\|\\\]|[^\]{])+)/,
/^(?:\{)/,
/^(?:\])/,
/^(?:[^\r\n]*(\r|\n)+)/,
/^(?:[^\r\n]+)/,
/^(?:[\r\n])/,
/^(?:'[^\r\n]+')/,
/^(?:"[^\r\n]+")/,
/^(?:\s+)/,
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
      26,
      27,
      28,
      29,
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
      25,
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
      30,
      33,
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
      33,
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
  "INITIAL": {
    rules: [
      33,
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

// lexer.JisonLexerError = JisonLexerError;
return lexer;
})();
parser.lexer = lexer;

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;
// parser.JisonParserError = JisonParserError;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = lexParser;
exports.Parser = lexParser.Parser;
exports.parse = function () {
  return lexParser.parse.apply(lexParser, arguments);
};

}

},{"fs":13}],6:[function(require,module,exports){
module.exports={
  "author": {
    "name": "Zach Carter",
    "email": "zach@carter.name",
    "url": "http://zaa.ch"
  },
  "name": "jison-lex",
  "description": "lexical analyzer generator used by jison",
  "license": "MIT",
  "version": "0.3.4-113",
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
    "node": ">=0.4"
  },
  "dependencies": {
    "lex-parser": "GerHobbelt/lex-parser#master",
    "nomnom": ">=1.8.1"
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
/* parser generated by jison 0.4.17-113 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    trace: function(errorMessage, errorHash),
 *    JisonParserError: function(msg, hash),
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    productions_: [...],
 *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),
 *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)
 *    table: [...],
 *    defaultActions: {...},
 *    parseError: function(str, hash),
 *    parse: function(input),
 *
 *    lexer: {
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(),
 *        upcomingInput: function(),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        popState: function(),
 *        _currentRules: function(),
 *        topState: function(),
 *        pushState: function(condition),
 *        stateStackSize: function(),
 *
 *        options: { ... },
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
 *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
 *  }
 *
 * ---
 *
 * The parseError function receives a 'hash' object with these members for lexer and parser errors:
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
 *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                              optional: you can specify a pre_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval) { return retval; }
 *                              optional: you can specify a post_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`. When it does not return any value, the parser will return 
 *                              the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy)
 *                              optional: is invoked before the parse cycle starts (and before the first invocation 
 *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).
 *      post_parse: function(yy, retval) { return retval; }
 *                              optional: is invoked when the parse terminates due to success ('accept') or failure 
 *                              (even when exceptions are thrown).  `retval` contains the return value to be produced
 *                              by `Parser.parse()`; this function can override the return value by returning another. 
 *                              When it does not return any value, the parser will return the original `retval`. 
 *                              This function is invoked immediately before `Parser.post_parse()`.
 *      parseError: function(str, hash)
 *                              optional: overrides the default `parseError` function.
 *  }
 *
 *  parser.lexer.options: {
 *      ranges: boolean         optional: true ==> token location info will include a .range[] member.
 *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested
 *                                                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                              optional: true ==> lexer regexes are tested in order and for each matching
 *                                                 regex the action code is invoked; the lexer terminates
 *                                                 the scan when a token is returned by the action code.
 *      pre_lex:  function()
 *                              optional: is invoked before the lexer is invoked to produce another token.
 *                              `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                              optional: is invoked when the lexer has produced a token `token`;
 *                              this function can override the returned token value by returning another.
 *                              When it does not return any (truthy) value, the lexer will return the original `token`.
 *                              `this` refers to the Lexer object.
 *  }
 */
var parser = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonParserError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonParserError.prototype = Object.create(Error.prototype);
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';

function __expand__(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

var $V0=[129,135,138,140,142,147,148,153,159,161,164,165,166],
    $V1=[135,151],
    $V2=[129,135,138,140,142,147,148,151,153,159,161,164,165,166,171],
    $V3=[129,135,138,140,142,147,148,151,152,153,159,161,164,165,166],
    $V4=[59,123,124,129,135,138,140,142,147,148,151,152,153,159,161,164,165,166,189],
    $V5=[59,124,129,132,135,138,140,142,147,148,151,153,159,161,164,165,166,193],
    $V6=[132,193],
    $V7=[129,132],
    $V8=[129,135,138,140,142,147,148,151,152,153,159,161,164,165,166,171],
    $V9=[40,59,123,124,135,151,152,187,189],
    $Va=[59,123,124,135,189],
    $Vb=[40,41,59,123,124,135,151,152,187,189],
    $Vc=[40,41,59,123,124,135,151,152,186,187,189],
    $Vd=[40,41,42,43,59,63,123,124,135,151,152,186,187,189],
    $Ve=[40,41,124,151,152],
    $Vf=[123,125],
    $Vg=[41,124];

var parser = {
trace: function trace() { },
JisonParserError: JisonParserError,
yy: {},
symbols_: {
  "$accept": 0,
  "$end": 1,
  "%%": 129,
  "(": 40,
  ")": 41,
  "*": 42,
  "+": 43,
  ":": 58,
  ";": 59,
  "=": 61,
  "?": 63,
  "ACTION": 135,
  "ACTION_BODY": 191,
  "ALIAS": 186,
  "ARROW_ACTION": 189,
  "CODE": 196,
  "EOF": 132,
  "ID": 151,
  "IMPORT": 148,
  "INCLUDE": 193,
  "INTEGER": 172,
  "LEFT": 164,
  "LEX_BLOCK": 140,
  "NAME": 157,
  "NONASSOC": 166,
  "OPTIONS": 153,
  "OPTIONS_END": 155,
  "OPTION_VALUE": 158,
  "PARSER_TYPE": 161,
  "PARSE_PARAM": 159,
  "PATH": 194,
  "PREC": 187,
  "RIGHT": 165,
  "START": 138,
  "STRING": 152,
  "TOKEN": 142,
  "TOKEN_TYPE": 171,
  "UNKNOWN_DECL": 147,
  "action": 181,
  "action_body": 188,
  "action_comments_body": 190,
  "associativity": 163,
  "declaration": 137,
  "declaration_list": 128,
  "error": 2,
  "expression": 184,
  "expression_suffix": 182,
  "extra_parser_module_code": 133,
  "full_token_definition": 167,
  "full_token_definitions": 143,
  "grammar": 130,
  "handle": 179,
  "handle_action": 178,
  "handle_list": 177,
  "handle_sublist": 183,
  "id": 139,
  "id_list": 173,
  "import_name": 149,
  "import_path": 150,
  "include_macro_code": 136,
  "module_code_chunk": 195,
  "operator": 141,
  "option": 156,
  "option_list": 154,
  "optional_action_header_block": 134,
  "optional_end_block": 131,
  "optional_module_code_chunk": 192,
  "optional_token_description": 170,
  "optional_token_type": 168,
  "optional_token_value": 169,
  "options": 146,
  "parse_param": 144,
  "parser_type": 145,
  "prec": 180,
  "production": 176,
  "production_list": 175,
  "spec": 127,
  "suffix": 185,
  "symbol": 162,
  "token_id": 174,
  "token_list": 160,
  "{": 123,
  "|": 124,
  "}": 125
},
terminals_: {
  1: "$end",
  2: "error",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  58: ":",
  59: ";",
  61: "=",
  63: "?",
  123: "{",
  124: "|",
  125: "}",
  129: "%%",
  132: "EOF",
  135: "ACTION",
  138: "START",
  140: "LEX_BLOCK",
  142: "TOKEN",
  147: "UNKNOWN_DECL",
  148: "IMPORT",
  151: "ID",
  152: "STRING",
  153: "OPTIONS",
  155: "OPTIONS_END",
  157: "NAME",
  158: "OPTION_VALUE",
  159: "PARSE_PARAM",
  161: "PARSER_TYPE",
  164: "LEFT",
  165: "RIGHT",
  166: "NONASSOC",
  171: "TOKEN_TYPE",
  172: "INTEGER",
  186: "ALIAS",
  187: "PREC",
  189: "ARROW_ACTION",
  191: "ACTION_BODY",
  193: "INCLUDE",
  194: "PATH",
  196: "CODE"
},
nonterminals_: {
  "$accept": {
    0: "spec $end"
  },
  "spec": {
    1: "declaration_list %% grammar optional_end_block EOF"
  },
  "optional_end_block": {
    2: "<epsilon>",
    3: "%% extra_parser_module_code"
  },
  "optional_action_header_block": {
    4: "<epsilon>",
    5: "optional_action_header_block ACTION",
    6: "optional_action_header_block include_macro_code"
  },
  "declaration_list": {
    7: "declaration_list declaration",
    8: "<epsilon>"
  },
  "declaration": {
    9: "START id",
    10: "LEX_BLOCK",
    11: "operator",
    12: "TOKEN full_token_definitions",
    13: "ACTION",
    14: "include_macro_code",
    15: "parse_param",
    16: "parser_type",
    17: "options",
    18: "UNKNOWN_DECL",
    19: "IMPORT import_name import_path"
  },
  "import_name": {
    20: "ID",
    21: "STRING"
  },
  "import_path": {
    22: "ID",
    23: "STRING"
  },
  "options": {
    24: "OPTIONS option_list OPTIONS_END"
  },
  "option_list": {
    25: "option_list option",
    26: "option"
  },
  "option": {
    27: "NAME",
    28: "NAME = OPTION_VALUE",
    29: "NAME = NAME"
  },
  "parse_param": {
    30: "PARSE_PARAM token_list"
  },
  "parser_type": {
    31: "PARSER_TYPE symbol"
  },
  "operator": {
    32: "associativity token_list"
  },
  "associativity": {
    33: "LEFT",
    34: "RIGHT",
    35: "NONASSOC"
  },
  "token_list": {
    36: "token_list symbol",
    37: "symbol"
  },
  "full_token_definitions": {
    38: "full_token_definitions full_token_definition",
    39: "full_token_definition"
  },
  "full_token_definition": {
    40: "optional_token_type id optional_token_value optional_token_description"
  },
  "optional_token_type": {
    41: "<epsilon>",
    42: "TOKEN_TYPE"
  },
  "optional_token_value": {
    43: "<epsilon>",
    44: "INTEGER"
  },
  "optional_token_description": {
    45: "<epsilon>",
    46: "STRING"
  },
  "id_list": {
    47: "id_list id",
    48: "id"
  },
  "token_id": {
    49: "TOKEN_TYPE id",
    50: "id"
  },
  "grammar": {
    51: "optional_action_header_block production_list"
  },
  "production_list": {
    52: "production_list production",
    53: "production"
  },
  "production": {
    54: "id : handle_list ;"
  },
  "handle_list": {
    55: "handle_list | handle_action",
    56: "handle_action"
  },
  "handle_action": {
    57: "handle prec action"
  },
  "handle": {
    58: "handle expression_suffix",
    59: "<epsilon>"
  },
  "handle_sublist": {
    60: "handle_sublist | handle",
    61: "handle"
  },
  "expression_suffix": {
    62: "expression suffix ALIAS",
    63: "expression suffix"
  },
  "expression": {
    64: "ID",
    65: "STRING",
    66: "( handle_sublist )"
  },
  "suffix": {
    67: "<epsilon>",
    68: "*",
    69: "?",
    70: "+"
  },
  "prec": {
    71: "PREC symbol",
    72: "<epsilon>"
  },
  "symbol": {
    73: "id",
    74: "STRING"
  },
  "id": {
    75: "ID"
  },
  "action": {
    76: "{ action_body }",
    77: "ACTION",
    78: "include_macro_code",
    79: "ARROW_ACTION",
    80: "<epsilon>"
  },
  "action_body": {
    81: "<epsilon>",
    82: "action_comments_body",
    83: "action_body { action_body } action_comments_body",
    84: "action_body { action_body }"
  },
  "action_comments_body": {
    85: "ACTION_BODY",
    86: "action_comments_body ACTION_BODY"
  },
  "extra_parser_module_code": {
    87: "optional_module_code_chunk",
    88: "optional_module_code_chunk include_macro_code extra_parser_module_code"
  },
  "include_macro_code": {
    89: "INCLUDE PATH",
    90: "INCLUDE error"
  },
  "module_code_chunk": {
    91: "CODE",
    92: "module_code_chunk CODE"
  },
  "optional_module_code_chunk": {
    93: "module_code_chunk",
    94: "<epsilon>"
  }
},
productions_: [
  0,
  [
    127,
    5
  ],
  [
    131,
    0
  ],
  [
    131,
    2
  ],
  [
    134,
    0
  ],
  [
    134,
    2
  ],
  [
    134,
    2
  ],
  [
    128,
    2
  ],
  [
    128,
    0
  ],
  [
    137,
    2
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    2
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    3
  ],
  [
    149,
    1
  ],
  [
    149,
    1
  ],
  [
    150,
    1
  ],
  [
    150,
    1
  ],
  [
    146,
    3
  ],
  [
    154,
    2
  ],
  [
    154,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    3
  ],
  [
    156,
    3
  ],
  [
    144,
    2
  ],
  [
    145,
    2
  ],
  [
    141,
    2
  ],
  [
    163,
    1
  ],
  [
    163,
    1
  ],
  [
    163,
    1
  ],
  [
    160,
    2
  ],
  [
    160,
    1
  ],
  [
    143,
    2
  ],
  [
    143,
    1
  ],
  [
    167,
    4
  ],
  [
    168,
    0
  ],
  [
    168,
    1
  ],
  [
    169,
    0
  ],
  [
    169,
    1
  ],
  [
    170,
    0
  ],
  [
    170,
    1
  ],
  [
    173,
    2
  ],
  [
    173,
    1
  ],
  [
    174,
    2
  ],
  [
    174,
    1
  ],
  [
    130,
    2
  ],
  [
    175,
    2
  ],
  [
    175,
    1
  ],
  [
    176,
    4
  ],
  [
    177,
    3
  ],
  [
    177,
    1
  ],
  [
    178,
    3
  ],
  [
    179,
    2
  ],
  [
    179,
    0
  ],
  [
    183,
    3
  ],
  [
    183,
    1
  ],
  [
    182,
    3
  ],
  [
    182,
    2
  ],
  [
    184,
    1
  ],
  [
    184,
    1
  ],
  [
    184,
    3
  ],
  [
    185,
    0
  ],
  [
    185,
    1
  ],
  [
    185,
    1
  ],
  [
    185,
    1
  ],
  [
    180,
    2
  ],
  [
    180,
    0
  ],
  [
    162,
    1
  ],
  [
    162,
    1
  ],
  [
    139,
    1
  ],
  [
    181,
    3
  ],
  [
    181,
    1
  ],
  [
    181,
    1
  ],
  [
    181,
    1
  ],
  [
    181,
    0
  ],
  [
    188,
    0
  ],
  [
    188,
    1
  ],
  [
    188,
    5
  ],
  [
    188,
    4
  ],
  [
    190,
    1
  ],
  [
    190,
    2
  ],
  [
    133,
    1
  ],
  [
    133,
    3
  ],
  [
    136,
    2
  ],
  [
    136,
    2
  ],
  [
    195,
    1
  ],
  [
    195,
    2
  ],
  [
    192,
    1
  ],
  [
    192,
    0
  ]
],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack, options) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1 : 
/*! Production::     spec : declaration_list '%%' grammar optional_end_block EOF */
 
            this.$ = $$[$0-4];
            if ($$[$0-1] && $$[$0-1].trim() !== '') {
                yy.addDeclaration(this.$, { include: $$[$0-1] });
            }
            return extend(this.$, $$[$0-2]);
         
break;
case 3 : 
/*! Production::     optional_end_block : '%%' extra_parser_module_code */
 case 30 : 
/*! Production::     parse_param : PARSE_PARAM token_list */
 case 31 : 
/*! Production::     parser_type : PARSER_TYPE symbol */
 case 49 : 
/*! Production::     token_id : TOKEN_TYPE id */
 case 50 : 
/*! Production::     token_id : id */
 case 64 : 
/*! Production::     expression : ID */
 case 73 : 
/*! Production::     symbol : id */
 case 74 : 
/*! Production::     symbol : STRING */
 case 75 : 
/*! Production::     id : ID */
 case 77 : 
/*! Production::     action : ACTION */
 case 78 : 
/*! Production::     action : include_macro_code */
 case 82 : 
/*! Production::     action_body : action_comments_body */
 case 85 : 
/*! Production::     action_comments_body : ACTION_BODY */
 case 87 : 
/*! Production::     extra_parser_module_code : optional_module_code_chunk */
 case 91 : 
/*! Production::     module_code_chunk : CODE */
 case 93 : 
/*! Production::     optional_module_code_chunk : module_code_chunk */
  this.$ = $$[$0];  
break;
case 4 : 
/*! Production::     optional_action_header_block :  */
 case 8 : 
/*! Production::     declaration_list :  */
  this.$ = {};  
break;
case 5 : 
/*! Production::     optional_action_header_block : optional_action_header_block ACTION */
 case 6 : 
/*! Production::     optional_action_header_block : optional_action_header_block include_macro_code */
 
            this.$ = $$[$0-1];
            yy.addDeclaration(this.$, { actionInclude: $$[$0] });
         
break;
case 7 : 
/*! Production::     declaration_list : declaration_list declaration */
  this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);  
break;
case 9 : 
/*! Production::     declaration : START id */
  this.$ = {start: $$[$0]};  
break;
case 10 : 
/*! Production::     declaration : LEX_BLOCK */
  this.$ = {lex: $$[$0]};  
break;
case 11 : 
/*! Production::     declaration : operator */
  this.$ = {operator: $$[$0]};  
break;
case 12 : 
/*! Production::     declaration : TOKEN full_token_definitions */
  this.$ = {token_list: $$[$0]};  
break;
case 13 : 
/*! Production::     declaration : ACTION */
 case 14 : 
/*! Production::     declaration : include_macro_code */
  this.$ = {include: $$[$0]};  
break;
case 15 : 
/*! Production::     declaration : parse_param */
  this.$ = {parseParam: $$[$0]};  
break;
case 16 : 
/*! Production::     declaration : parser_type */
  this.$ = {parserType: $$[$0]};  
break;
case 17 : 
/*! Production::     declaration : options */
  this.$ = {options: $$[$0]};  
break;
case 18 : 
/*! Production::     declaration : UNKNOWN_DECL */
  this.$ = {unknownDecl: $$[$0]};  
break;
case 19 : 
/*! Production::     declaration : IMPORT import_name import_path */
  this.$ = {imports: {name: $$[$0-1], path: $$[$0]}};  
break;
case 24 : 
/*! Production::     options : OPTIONS option_list OPTIONS_END */
 case 76 : 
/*! Production::     action : '{' action_body '}' */
  this.$ = $$[$0-1];  
break;
case 25 : 
/*! Production::     option_list : option_list option */
 case 36 : 
/*! Production::     token_list : token_list symbol */
 case 38 : 
/*! Production::     full_token_definitions : full_token_definitions full_token_definition */
 case 47 : 
/*! Production::     id_list : id_list id */
  this.$ = $$[$0-1]; this.$.push($$[$0]);  
break;
case 26 : 
/*! Production::     option_list : option */
 case 37 : 
/*! Production::     token_list : symbol */
 case 39 : 
/*! Production::     full_token_definitions : full_token_definition */
 case 48 : 
/*! Production::     id_list : id */
 case 56 : 
/*! Production::     handle_list : handle_action */
  this.$ = [$$[$0]];  
break;
case 27 : 
/*! Production::     option : NAME[option] */
  this.$ = [$$[$0], true];  
break;
case 28 : 
/*! Production::     option : NAME[option] '=' OPTION_VALUE[value] */
 case 29 : 
/*! Production::     option : NAME[option] '=' NAME[value] */
  this.$ = [$$[$0-2], $$[$0]];  
break;
case 32 : 
/*! Production::     operator : associativity token_list */
  this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);  
break;
case 33 : 
/*! Production::     associativity : LEFT */
  this.$ = 'left';  
break;
case 34 : 
/*! Production::     associativity : RIGHT */
  this.$ = 'right';  
break;
case 35 : 
/*! Production::     associativity : NONASSOC */
  this.$ = 'nonassoc';  
break;
case 40 : 
/*! Production::     full_token_definition : optional_token_type id optional_token_value optional_token_description */
 
            this.$ = {id: $$[$0-2]};
            if ($$[$0-3]) {
                this.$.type = $$[$0-3];
            }
            if ($$[$0-1]) {
                this.$.value = $$[$0-1];
            }
            if ($$[$0]) {
                this.$.description = $$[$0];
            }
         
break;
case 41 : 
/*! Production::     optional_token_type :  */
 case 43 : 
/*! Production::     optional_token_value :  */
 case 45 : 
/*! Production::     optional_token_description :  */
  this.$ = false;  
break;
case 51 : 
/*! Production::     grammar : optional_action_header_block production_list */
 
            this.$ = $$[$0-1];
            this.$.grammar = $$[$0];
         
break;
case 52 : 
/*! Production::     production_list : production_list production */
 
            this.$ = $$[$0-1];
            if ($$[$0][0] in this.$) {
                this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
            } else {
                this.$[$$[$0][0]] = $$[$0][1];
            }
         
break;
case 53 : 
/*! Production::     production_list : production */
  this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];  
break;
case 54 : 
/*! Production::     production : id ':' handle_list ';' */
 this.$ = [$$[$0-3], $$[$0-1]]; 
break;
case 55 : 
/*! Production::     handle_list : handle_list '|' handle_action */
 
            this.$ = $$[$0-2];
            this.$.push($$[$0]);
         
break;
case 57 : 
/*! Production::     handle_action : handle prec action */
 
            this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if ($$[$0]) {
                this.$.push($$[$0]);
            }
            if ($$[$0-1]) {
                this.$.push($$[$0-1]);
            }
            if (this.$.length === 1) {
                this.$ = this.$[0];
            }
         
break;
case 58 : 
/*! Production::     handle : handle expression_suffix */
 
            this.$ = $$[$0-1];
            this.$.push($$[$0]);
         
break;
case 59 : 
/*! Production::     handle :  */
 
            this.$ = [];
         
break;
case 60 : 
/*! Production::     handle_sublist : handle_sublist '|' handle */
 
            this.$ = $$[$0-2];
            this.$.push($$[$0].join(' '));
         
break;
case 61 : 
/*! Production::     handle_sublist : handle */
 
            this.$ = [$$[$0].join(' ')];
         
break;
case 62 : 
/*! Production::     expression_suffix : expression suffix ALIAS */
 
            this.$ = $$[$0-2] + $$[$0-1] + "[" + $$[$0] + "]";
         
break;
case 63 : 
/*! Production::     expression_suffix : expression suffix */
 case 86 : 
/*! Production::     action_comments_body : action_comments_body ACTION_BODY */
 case 92 : 
/*! Production::     module_code_chunk : module_code_chunk CODE */
 
            this.$ = $$[$0-1] + $$[$0];
         
break;
case 65 : 
/*! Production::     expression : STRING */
 
            // Re-encode the string *anyway* as it will
            // be made part of the rule rhs a.k.a. production (type: *string*) again and we want
            // to be able to handle all tokens, including *significant space*
            // encoded as literal tokens in a grammar such as this: `rule: A ' ' B`.
            if ($$[$0].indexOf("'") >= 0) {
                this.$ = '"' + $$[$0] + '"';
            } else {
                this.$ = "'" + $$[$0] + "'";
            }
         
break;
case 66 : 
/*! Production::     expression : '(' handle_sublist ')' */
 
            this.$ = '(' + $$[$0-1].join(' | ') + ')';
         
break;
case 67 : 
/*! Production::     suffix :  */
 case 80 : 
/*! Production::     action :  */
 case 81 : 
/*! Production::     action_body :  */
 case 94 : 
/*! Production::     optional_module_code_chunk :  */
  this.$ = '';  
break;
case 71 : 
/*! Production::     prec : PREC symbol */
 
            this.$ = { prec: $$[$0] };
         
break;
case 72 : 
/*! Production::     prec :  */
 
            this.$ = null;
         
break;
case 79 : 
/*! Production::     action : ARROW_ACTION */
  this.$ = '$$ =' + $$[$0] + ';';  
break;
case 83 : 
/*! Production::     action_body : action_body '{' action_body '}' action_comments_body */
  this.$ = $$[$0-4] + $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 84 : 
/*! Production::     action_body : action_body '{' action_body '}' */
  this.$ = $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 88 : 
/*! Production::     extra_parser_module_code : optional_module_code_chunk include_macro_code extra_parser_module_code */
  this.$ = $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 89 : 
/*! Production::     include_macro_code : INCLUDE PATH */
 
console.log('options: ', options);
            var fileContent = fs.readFileSync($$[$0], { encoding: 'utf-8' });
            // And no, we don't support nested '%include':
            this.$ = '\n// Included by Jison: ' + $$[$0] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + $$[$0] + '\n\n';
         
break;
case 90 : 
/*! Production::     include_macro_code : INCLUDE error */
 
            console.error("%include MUST be followed by a valid file path");
         
break;
}
},
table: [
  __expand__($V0, [
      2,
      8
    ], {127:1,128:2,193:[
      2,
      8
    ]
  }),
  {
    1: [
      3
    ]
  },
  {
    129: [
      1,
      3
    ],
    135: [
      1,
      9
    ],
    136: 10,
    137: 4,
    138: [
      1,
      5
    ],
    140: [
      1,
      6
    ],
    141: 7,
    142: [
      1,
      8
    ],
    144: 11,
    145: 12,
    146: 13,
    147: [
      1,
      14
    ],
    148: [
      1,
      15
    ],
    153: [
      1,
      20
    ],
    159: [
      1,
      18
    ],
    161: [
      1,
      19
    ],
    163: 16,
    164: [
      1,
      21
    ],
    165: [
      1,
      22
    ],
    166: [
      1,
      23
    ],
    193: [
      1,
      17
    ]
  },
  __expand__($V1, [
      2,
      4
    ], {130:24,134:25,193:[
      2,
      4
    ]
  }),
  __expand__($V0, [
      2,
      7
    ], {193:[
      2,
      7
    ]
  }),
  {
    139: 26,
    151: [
      1,
      27
    ]
  },
  __expand__($V0, [
      2,
      10
    ], {193:[
      2,
      10
    ]
  }),
  __expand__($V0, [
      2,
      11
    ], {193:[
      2,
      11
    ]
  }),
  {
    143: 28,
    151: [
      2,
      41
    ],
    167: 29,
    168: 30,
    171: [
      1,
      31
    ]
  },
  __expand__($V0, [
      2,
      13
    ], {193:[
      2,
      13
    ]
  }),
  __expand__($V0, [
      2,
      14
    ], {193:[
      2,
      14
    ]
  }),
  __expand__($V0, [
      2,
      15
    ], {193:[
      2,
      15
    ]
  }),
  __expand__($V0, [
      2,
      16
    ], {193:[
      2,
      16
    ]
  }),
  __expand__($V0, [
      2,
      17
    ], {193:[
      2,
      17
    ]
  }),
  __expand__($V0, [
      2,
      18
    ], {193:[
      2,
      18
    ]
  }),
  {
    149: 32,
    151: [
      1,
      33
    ],
    152: [
      1,
      34
    ]
  },
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    160: 35,
    162: 36
  },
  {
    2: [
      1,
      40
    ],
    194: [
      1,
      39
    ]
  },
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    160: 41,
    162: 36
  },
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    162: 42
  },
  {
    154: 43,
    156: 44,
    157: [
      1,
      45
    ]
  },
  {
    151: [
      2,
      33
    ],
    152: [
      2,
      33
    ]
  },
  {
    151: [
      2,
      34
    ],
    152: [
      2,
      34
    ]
  },
  {
    151: [
      2,
      35
    ],
    152: [
      2,
      35
    ]
  },
  {
    129: [
      1,
      47
    ],
    131: 46,
    132: [
      2,
      2
    ]
  },
  {
    135: [
      1,
      49
    ],
    136: 50,
    139: 52,
    151: [
      1,
      27
    ],
    175: 48,
    176: 51,
    193: [
      1,
      17
    ]
  },
  __expand__($V0, [
      2,
      9
    ], {193:[
      2,
      9
    ]
  }),
  __expand__([58,59,123,124,129,135,138,140,142,147,148,151,152,153,159,161,164,165,166,171,172,189], [
      2,
      75
    ], {193:[
      2,
      75
    ]
  }),
  __expand__($V0, [
      2,
      12
    ], {168:30,167:53,151:[
      2,
      41
    ],171:[
      1,
      31
    ],193:[
      2,
      12
    ]
  }),
  __expand__($V2, [
      2,
      39
    ], {193:[
      2,
      39
    ]
  }),
  {
    139: 54,
    151: [
      1,
      27
    ]
  },
  {
    151: [
      2,
      42
    ]
  },
  {
    150: 55,
    151: [
      1,
      56
    ],
    152: [
      1,
      57
    ]
  },
  {
    151: [
      2,
      20
    ],
    152: [
      2,
      20
    ]
  },
  {
    151: [
      2,
      21
    ],
    152: [
      2,
      21
    ]
  },
  __expand__($V0, [
      2,
      32
    ], {139:37,162:58,151:[
      1,
      27
    ],152:[
      1,
      38
    ],193:[
      2,
      32
    ]
  }),
  __expand__($V3, [
      2,
      37
    ], {193:[
      2,
      37
    ]
  }),
  __expand__($V4, [
      2,
      73
    ], {193:[
      2,
      73
    ]
  }),
  __expand__($V4, [
      2,
      74
    ], {193:[
      2,
      74
    ]
  }),
  __expand__($V5, [
      2,
      89
    ], {196:[
      2,
      89
    ]
  }),
  __expand__($V5, [
      2,
      90
    ], {196:[
      2,
      90
    ]
  }),
  __expand__($V0, [
      2,
      30
    ], {139:37,162:58,151:[
      1,
      27
    ],152:[
      1,
      38
    ],193:[
      2,
      30
    ]
  }),
  __expand__($V0, [
      2,
      31
    ], {193:[
      2,
      31
    ]
  }),
  {
    155: [
      1,
      59
    ],
    156: 60,
    157: [
      1,
      45
    ]
  },
  {
    155: [
      2,
      26
    ],
    157: [
      2,
      26
    ]
  },
  {
    61: [
      1,
      61
    ],
    155: [
      2,
      27
    ],
    157: [
      2,
      27
    ]
  },
  {
    132: [
      1,
      62
    ]
  },
  __expand__($V6, [
      2,
      94
    ], {133:63,192:64,195:65,196:[
      1,
      66
    ]
  }),
  __expand__($V7, [
      2,
      51
    ], {139:52,151:[
      1,
      27
    ],176:67
  }),
  __expand__($V1, [
      2,
      5
    ], {193:[
      2,
      5
    ]
  }),
  __expand__($V1, [
      2,
      6
    ], {193:[
      2,
      6
    ]
  }),
  __expand__($V7, [
      2,
      53
    ], {151:[
      2,
      53
    ]
  }),
  {
    58: [
      1,
      68
    ]
  },
  __expand__($V2, [
      2,
      38
    ], {193:[
      2,
      38
    ]
  }),
  __expand__($V8, [
      2,
      43
    ], {169:69,172:[
      1,
      70
    ],193:[
      2,
      43
    ]
  }),
  __expand__($V0, [
      2,
      19
    ], {193:[
      2,
      19
    ]
  }),
  __expand__($V0, [
      2,
      22
    ], {193:[
      2,
      22
    ]
  }),
  __expand__($V0, [
      2,
      23
    ], {193:[
      2,
      23
    ]
  }),
  __expand__($V3, [
      2,
      36
    ], {193:[
      2,
      36
    ]
  }),
  __expand__($V0, [
      2,
      24
    ], {193:[
      2,
      24
    ]
  }),
  {
    155: [
      2,
      25
    ],
    157: [
      2,
      25
    ]
  },
  {
    157: [
      1,
      72
    ],
    158: [
      1,
      71
    ]
  },
  {
    1: [
      2,
      1
    ]
  },
  {
    132: [
      2,
      3
    ]
  },
  {
    132: [
      2,
      87
    ],
    136: 73,
    193: [
      1,
      17
    ]
  },
  __expand__($V6, [
      2,
      93
    ], {196:[
      1,
      74
    ]
  }),
  __expand__($V6, [
      2,
      91
    ], {196:[
      2,
      91
    ]
  }),
  __expand__($V7, [
      2,
      52
    ], {151:[
      2,
      52
    ]
  }),
  __expand__($V9, [
      2,
      59
    ], {177:75,178:76,179:77,193:[
      2,
      59
    ]
  }),
  __expand__($V2, [
      2,
      45
    ], {170:78,152:[
      1,
      79
    ],193:[
      2,
      45
    ]
  }),
  __expand__($V8, [
      2,
      44
    ], {193:[
      2,
      44
    ]
  }),
  {
    155: [
      2,
      28
    ],
    157: [
      2,
      28
    ]
  },
  {
    155: [
      2,
      29
    ],
    157: [
      2,
      29
    ]
  },
  __expand__($V6, [
      2,
      94
    ], {192:64,195:65,133:80,196:[
      1,
      66
    ]
  }),
  __expand__($V6, [
      2,
      92
    ], {196:[
      2,
      92
    ]
  }),
  {
    59: [
      1,
      81
    ],
    124: [
      1,
      82
    ]
  },
  {
    59: [
      2,
      56
    ],
    124: [
      2,
      56
    ]
  },
  __expand__($Va, [
      2,
      72
    ], {180:83,182:84,184:86,40:[
      1,
      89
    ],151:[
      1,
      87
    ],152:[
      1,
      88
    ],187:[
      1,
      85
    ],193:[
      2,
      72
    ]
  }),
  __expand__($V2, [
      2,
      40
    ], {193:[
      2,
      40
    ]
  }),
  __expand__($V2, [
      2,
      46
    ], {193:[
      2,
      46
    ]
  }),
  {
    132: [
      2,
      88
    ]
  },
  __expand__($V7, [
      2,
      54
    ], {151:[
      2,
      54
    ]
  }),
  __expand__($V9, [
      2,
      59
    ], {179:77,178:90,193:[
      2,
      59
    ]
  }),
  __expand__([59,124], [
      2,
      80
    ], {181:91,136:94,123:[
      1,
      92
    ],135:[
      1,
      93
    ],189:[
      1,
      95
    ],193:[
      1,
      17
    ]
  }),
  __expand__($Vb, [
      2,
      58
    ], {193:[
      2,
      58
    ]
  }),
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    162: 96
  },
  __expand__($Vc, [
      2,
      67
    ], {185:97,42:[
      1,
      98
    ],43:[
      1,
      100
    ],63:[
      1,
      99
    ],193:[
      2,
      67
    ]
  }),
  __expand__($Vd, [
      2,
      64
    ], {193:[
      2,
      64
    ]
  }),
  __expand__($Vd, [
      2,
      65
    ], {193:[
      2,
      65
    ]
  }),
  __expand__($Ve, [
      2,
      59
    ], {179:102,183:101
  }),
  {
    59: [
      2,
      55
    ],
    124: [
      2,
      55
    ]
  },
  {
    59: [
      2,
      57
    ],
    124: [
      2,
      57
    ]
  },
  __expand__($Vf, [
      2,
      81
    ], {188:103,190:104,191:[
      1,
      105
    ]
  }),
  {
    59: [
      2,
      77
    ],
    124: [
      2,
      77
    ]
  },
  {
    59: [
      2,
      78
    ],
    124: [
      2,
      78
    ]
  },
  {
    59: [
      2,
      79
    ],
    124: [
      2,
      79
    ]
  },
  __expand__($Va, [
      2,
      71
    ], {193:[
      2,
      71
    ]
  }),
  __expand__($Vb, [
      2,
      63
    ], {186:[
      1,
      106
    ],193:[
      2,
      63
    ]
  }),
  __expand__($Vc, [
      2,
      68
    ], {193:[
      2,
      68
    ]
  }),
  __expand__($Vc, [
      2,
      69
    ], {193:[
      2,
      69
    ]
  }),
  __expand__($Vc, [
      2,
      70
    ], {193:[
      2,
      70
    ]
  }),
  {
    41: [
      1,
      107
    ],
    124: [
      1,
      108
    ]
  },
  __expand__($Vg, [
      2,
      61
    ], {182:84,40:[
      1,
      89
    ],151:[
      1,
      87
    ],152:[
      1,
      88
    ],184:86
  }),
  {
    123: [
      1,
      110
    ],
    125: [
      1,
      109
    ]
  },
  __expand__($Vf, [
      2,
      82
    ], {191:[
      1,
      111
    ]
  }),
  __expand__($Vf, [
      2,
      85
    ], {191:[
      2,
      85
    ]
  }),
  __expand__($Vb, [
      2,
      62
    ], {193:[
      2,
      62
    ]
  }),
  __expand__($Vd, [
      2,
      66
    ], {193:[
      2,
      66
    ]
  }),
  __expand__($Ve, [
      2,
      59
    ], {179:112
  }),
  {
    59: [
      2,
      76
    ],
    124: [
      2,
      76
    ]
  },
  __expand__($Vf, [
      2,
      81
    ], {190:104,188:113,191:[
      1,
      105
    ]
  }),
  __expand__($Vf, [
      2,
      86
    ], {191:[
      2,
      86
    ]
  }),
  __expand__($Vg, [
      2,
      60
    ], {182:84,40:[
      1,
      89
    ],151:[
      1,
      87
    ],152:[
      1,
      88
    ],184:86
  }),
  {
    123: [
      1,
      110
    ],
    125: [
      1,
      114
    ]
  },
  __expand__($Vf, [
      2,
      84
    ], {190:115,191:[
      1,
      105
    ]
  }),
  __expand__($Vf, [
      2,
      83
    ], {191:[
      1,
      111
    ]
  })
],
defaultActions: {
  31: [
    2,
    42
  ],
  62: [
    2,
    1
  ],
  63: [
    2,
    3
  ],
  80: [
    2,
    88
  ]
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = [0],

        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,     // (only used when the grammar contains error recovery rules)
        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }

    // Return the rule stack depth where the nearest error rule can be found.
    // Return FALSE when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = stack.length - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            if ((TERROR.toString()) in table[state]) {
                return depth;
            }
            if (state === 0 || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
            }
            stack_probe -= 2; // popStack(1): [symbol, action]
            state = stack[stack_probe];
            ++depth;
        }
    }


    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var error_rule_depth;
                var errStr = '';

                if (!recovering) {
                    // first see if there's any chance at hitting an error recovery rule:
                    error_rule_depth = locateNearestErrorRecoveryRule(state);

                    // Report error
                    expected = collect_expected_token_set(state);
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                                 (symbol === EOF ? 'end of input' :
                                  ("'" + (this.terminals_[symbol] || symbol) + "'"));
                    }
                    a = this.parseError(errStr, p = {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false),
                        state_stack: stack
                    });
                    if (!p.recoverable) {
                        retval = a;
                        break;
                    }
                } else if (preErrorSymbol !== EOF) {
                    error_rule_depth = locateNearestErrorRecoveryRule(state);
                }

                // just recovered from another error
                if (recovering === 3) {
                    if (symbol === EOF || preErrorSymbol === EOF) {
                        retval = this.parseError(errStr || 'Parsing halted while starting to recover from another error.', {
                            text: lexer.match,
                            token: this.terminals_[symbol] || symbol,
                            token_id: symbol,
                            line: lexer.yylineno,
                            loc: yyloc,
                            expected: expected,
                            recoverable: false,
                            state_stack: stack
                        });
                        break;
                    }

                    // discard current lookahead and grab another
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    symbol = lex();
                }

                // try to recover from error
                if (error_rule_depth === false) {
                    retval = this.parseError(errStr || 'Parsing halted. No suitable error recovery rule available.', {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack
                    });
                    break;
                }
                popStack(error_rule_depth);

                preErrorSymbol = (symbol === TERROR ? null : symbol); // save the lookahead token
                symbol = TERROR;         // insert generic error symbol as new lookahead
                state = stack[stack.length - 1];
                action = table[state] && table[state][TERROR];
                recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
            }


            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    if (recovering > 0) {
                        recovering--;
                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
}
};

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


/* generated by jison-lex 0.3.4-113 */
var lexer = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonLexerError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonLexerError.prototype = Object.create(Error.prototype);
JisonLexerError.prototype.constructor = JisonLexerError;
JisonLexerError.prototype.name = 'JisonLexerError';

var lexer = {

EOF:1,

ERROR:2,

parseError:function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
input:function () {
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
unput:function (ch) {
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
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
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
less:function (n) {
        this.unput(this.match.slice(n));
    },

// return (part of the) already matched input, i.e. for error messages
pastInput:function (maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

// return (part of the) upcoming input, i.e. for error messages
upcomingInput:function (maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

// return a string which displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
next:function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
lex:function lex() {
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

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {
  easy_keyword_rules: true,
  ranges: true
},
JisonLexerError: JisonLexerError,
performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 0 : 
/*! Conditions:: token */ 
/*! Rule::       \r|\n */ 
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
 this.pushState('code'); return 129; 
break;
case 11 : 
/*! Conditions:: options */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 158; 
break;
case 12 : 
/*! Conditions:: options */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 158; 
break;
case 14 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}+ */ 
 this.popState(); return 155; 
break;
case 15 : 
/*! Conditions:: options */ 
/*! Rule::       \s+{BR}+ */ 
 this.popState(); return 155; 
break;
case 16 : 
/*! Conditions:: options */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 17 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \s+ */ 
 /* skip whitespace */ 
break;
case 18 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \/\/.* */ 
 /* skip comment */ 
break;
case 19 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
 /* skip comment */ 
break;
case 20 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \[{ID}\] */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 186; 
break;
case 22 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       "[^"]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 152; 
break;
case 23 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       '[^']+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 152; 
break;
case 28 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %% */ 
 this.pushState(ebnf ? 'ebnf' : 'bnf'); return 129; 
break;
case 29 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %ebnf\b */ 
 if (!yy.options) { yy.options = {}; } ebnf = yy.options.ebnf = true; 
break;
case 30 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %debug\b */ 
 if (!yy.options) { yy.options = {}; } yy.options.debug = true; 
break;
case 37 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %token\b */ 
 this.pushState('token'); return 142; 
break;
case 39 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %options\b */ 
 this.pushState('options'); return 153; 
break;
case 42 : 
/*! Conditions:: INITIAL ebnf bnf code */ 
/*! Rule::       %include\b */ 
 this.pushState('path'); return 193; 
break;
case 43 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %{NAME}[^\r\n]* */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported parser option: ', yy_.yytext, ' while lexing in ', this.topState(), ' state');
                                            return 147;
                                         
break;
case 44 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       <{ID}> */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 171; 
break;
case 45 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \{\{[\w\W]*?\}\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 4); return 135; 
break;
case 46 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %\{(.|\r|\n)*?%\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 135; 
break;
case 47 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \{ */ 
 yy.depth = 0; this.pushState('action'); return 123; 
break;
case 48 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       ->.* */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 2); return 189; 
break;
case 49 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {HEX_NUMBER} */ 
 yy_.yytext = parseInt(yy_.yytext, 16); return 172; 
break;
case 50 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {DECIMAL_NUMBER}(?![xX0-9a-fA-F]) */ 
 yy_.yytext = parseInt(yy_.yytext, 10); return 172; 
break;
case 51 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       . */ 
 
                                            throw new Error("unsupported input character: " + yy_.yytext + " @ " + JSON.stringify(yy_.yylloc)); /* b0rk on bad characters */
                                         
break;
case 55 : 
/*! Conditions:: action */ 
/*! Rule::       \/[^ /]*?['"{}'][^ ]*?\/ */ 
 return 191; // regexp with braces or quotes (and no spaces) 
break;
case 60 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++; return 123; 
break;
case 61 : 
/*! Conditions:: action */ 
/*! Rule::       \} */ 
 if (yy.depth === 0) { this.popState(); } else { yy.depth--; } return 125; 
break;
case 63 : 
/*! Conditions:: code */ 
/*! Rule::       [^\r\n]+ */ 
 return 196;      // the bit of CODE just before EOF... 
break;
case 64 : 
/*! Conditions:: path */ 
/*! Rule::       [\r\n] */ 
 this.popState(); this.unput(yy_.yytext); 
break;
case 65 : 
/*! Conditions:: path */ 
/*! Rule::       '[^\r\n]+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 194; 
break;
case 66 : 
/*! Conditions:: path */ 
/*! Rule::       "[^\r\n]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 194; 
break;
case 67 : 
/*! Conditions:: path */ 
/*! Rule::       \s+ */ 
 // skip whitespace in the line 
break;
case 68 : 
/*! Conditions:: path */ 
/*! Rule::       [^\s\r\n]+ */ 
 this.popState(); return 194; 
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: ebnf */ 
  /*! Rule::       \( */ 
   4 : 40,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \) */ 
   5 : 41,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \* */ 
   6 : 42,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \? */ 
   7 : 63,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \+ */ 
   8 : 43,
  /*! Conditions:: options */ 
  /*! Rule::       {NAME} */ 
   9 : 157,
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   10 : 61,
  /*! Conditions:: options */ 
  /*! Rule::       [^\s\r\n]+ */ 
   13 : 158,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       {ID} */ 
   21 : 151,
  /*! Conditions:: token */ 
  /*! Rule::       [^\s\r\n]+ */ 
   24 : 'TOKEN_WORD',
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       : */ 
   25 : 58,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       ; */ 
   26 : 59,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       \| */ 
   27 : 124,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %parser-type\b */ 
   31 : 161,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %prec\b */ 
   32 : 187,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %start\b */ 
   33 : 138,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %left\b */ 
   34 : 164,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %right\b */ 
   35 : 165,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %nonassoc\b */ 
   36 : 166,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %parse-param\b */ 
   38 : 159,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %lex[\w\W]*?{BR}\s*\/lex\b */ 
   40 : 140,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %import\b */ 
   41 : 148,
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   52 : 132,
  /*! Conditions:: action */ 
  /*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
   53 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       \/\/.* */ 
   54 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       "(\\\\|\\"|[^"])*" */ 
   56 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       '(\\\\|\\'|[^'])*' */ 
   57 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       [/"'][^{}/"']+ */ 
   58 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       [^{}/"']+ */ 
   59 : 191,
  /*! Conditions:: code */ 
  /*! Rule::       [^\r\n]*(\r|\n)+ */ 
   62 : 196
},
rules: [
/^(?:\r|\n)/,
/^(?:%%)/,
/^(?:;)/,
/^(?:%%)/,
/^(?:\()/,
/^(?:\))/,
/^(?:\*)/,
/^(?:\?)/,
/^(?:\+)/,
/^(?:([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?))/,
/^(?:=)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[^\s\r\n]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:\s+)/,
/^(?:\/\/.*)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\[([a-zA-Z_][a-zA-Z0-9_]*)\])/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
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
/^(?:%lex[\w\W]*?(\r\n|\n|\r)\s*\/lex\b)/,
/^(?:%import\b)/,
/^(?:%include\b)/,
/^(?:%([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?)[^\r\n]*)/,
/^(?:<([a-zA-Z_][a-zA-Z0-9_]*)>)/,
/^(?:\{\{[\w\W]*?\}\})/,
/^(?:%\{(.|\r|\n)*?%\})/,
/^(?:\{)/,
/^(?:->.*)/,
/^(?:(0[xX][0-9a-fA-F]+))/,
/^(?:([1-9][0-9]*)(?![xX0-9a-fA-F]))/,
/^(?:.)/,
/^(?:$)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:\/[^ \/]*?['"{}'][^ ]*?\/)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[\/"'][^{}\/"']+)/,
/^(?:[^{}\/"']+)/,
/^(?:\{)/,
/^(?:\})/,
/^(?:[^\r\n]*(\r|\n)+)/,
/^(?:[^\r\n]+)/,
/^(?:[\r\n])/,
/^(?:'[^\r\n]+')/,
/^(?:"[^\r\n]+")/,
/^(?:\s+)/,
/^(?:[^\s\r\n]+)/
],
conditions: {
  "bnf": {
    rules: [
      3,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      51,
      52
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
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      51,
      52
    ],
    inclusive: true
  },
  "token": {
    rules: [
      0,
      1,
      2,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52
    ],
    inclusive: true
  },
  "action": {
    rules: [
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
    inclusive: false
  },
  "code": {
    rules: [
      42,
      52,
      62,
      63
    ],
    inclusive: false
  },
  "path": {
    rules: [
      52,
      64,
      65,
      66,
      67,
      68
    ],
    inclusive: false
  },
  "options": {
    rules: [
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      52
    ],
    inclusive: false
  },
  "INITIAL": {
    rules: [
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      51,
      52
    ],
    inclusive: true
  }
}
};

// lexer.JisonLexerError = JisonLexerError;
return lexer;
})();
parser.lexer = lexer;

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;
// parser.JisonParserError = JisonParserError;

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

var lexParser = require('./lex-parser');
var version = require('./package.json').version;

// expand macros and convert matchers to RegExp's
function prepareRules(dict, actions, tokens, startConditions, caseless, caseHelper, opts) {
    var m, i, k, action, conditions,
        active_conditions,
        rules = dict.rules,
        newRules = [],
        macros = {};

    // Depending on the location within the regex we need different expansions of the macros:
    // one expansion for when a macro is *inside* a `[...]` and another expansion when a macro
    // is anywhere else in a regex:
    if (dict.macros) {
        macros = prepareMacros(dict.macros, opts);
    }

    function tokenNumberReplacement (str, token) {
        return 'return ' + (tokens[token] || '\'' + token.replace(/'/g, '\\\'') + '\'');
    }

    // make sure a comment does not contain any embedded '*/' end-of-comment marker
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
                        rules: [], inclusive: false
                    };
                    console.warn('Lexer Warning : "' + conditions[k] + '" start condition should be defined as %s or %x; assuming %x now.');
                }
                active_conditions.push(conditions[k]);
                startConditions[conditions[k]].rules.push(i);
            }
        }

        m = rules[i][0];
        if (typeof m === 'string') {
            m = expandMacros(m, macros);
            m = new RegExp('^(?:' + m + ')', caseless ? 'i' : '');
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

// expand macros within macros and cache the result
function prepareMacros(dict_macros, opts) {
    var macros = {};

    // Pretty brutal conversion of 'regex' in macro back to raw set: strip outer [...] when they're there;
    // ditto for inner combos of sets, i.e. `]|[` as in `[0-9]|[a-z]`.
    //
    // Of course this brutish approach is NOT SMART enough to cope with *negated* sets such as
    // `[^0-9]` in nested macros!
    function reduceRegexToSet(s, name) {
        // First make sure legal regexes such as `[-@]` or `[@-]` get their hyphens at the edges
        // properly escaped as they'll otherwise produce havoc when being combined into new
        // sets thanks to macro expansion inside the outer regex set expression.
        var m = s.split('\\\\'); // help us find out which chars in there are truly escaped
        for (var i = 0, len = m.length; i < len; i++) {
            s = ' ' + m[i]; // make our life easier when we check the next regex(es)...

            s = s.replace(/([^\\])\[-/g, '$1[\\-').replace(/-\]/g, '\\-]');

            // catch the remains of constructs like `[0-9]|[a-z]`
            s = s.replace(/([^\\])\]\|\[/g, '$1');

            // strip unescaped pipes to catch constructs like `\\r|\\n`
            s = s.replace(/([^\\])\|/g, '$1');

            m[i] = s.substr(1, s.length - 1);
        }
        s = m.join('\\\\');

        // Also remove the outer brackets if this thing is a set all by itself: we accept either
        // `[0-9]` or `0-9` as good macro content to land in a (larger) set and this should
        // take care of the `[]` brackets around the former.
        // 
        // Also strip off some other possible outer wrappers which we know how to remove.
        // We don't worry about 'damaging' the regex as any too-complex regex will be caught
        // in the validation check at the end; our 'strippers' here would not damage useful
        // regexes anyway and them damaging the unacceptable ones is fine.
        s = s.replace(/^\((?:\?:)?(.*?)\)$/, '$1');       // (?:...) -> ...  and  (...) -> ...
        s = s.replace(/^\[(.*?)\]$/, '$1');

        // now ensure that any `-` dash at the start or end of the set list is properly escaped:
        // we won't have caught all of them yet above, just the ones in sub-sets!
        
        m = s.split('\\\\'); // help us find out which chars in there are truly escaped
        m[0] = m[0].replace(/^-/, '\\-');
        m[m.length - 1] = m[m.length - 1].replace(/-$/, '\\-');
        s = m.join('\\\\');

        // when this result is suitable for use in a set, than we should be able to compile 
        // it in a regex; that way we can easily validate whether macro X is fit to be used 
        // inside a regex set:
        try {
            var re = new RegExp('[' + s + ']');
            re.test(s[0]);

            // one thing is apparently *not* caught by the RegExp compile action above: `[a[b]c]`
            // so we check for lingering UNESCAPED brackets in here as those cannot be:
            if (/[^\\][\[\]]/.exec(s)) {
                throw 'unescaped brackets in set data';
            }
        } catch (ex) {
            // make sure we produce a set range expression which will fail badly when it is used
            // in actual code:
            if (0) console.log('reduceRegexToSet: regex validation: ', s, ex);
            s = '[macro \'' + name + '\' is unsuitable for use inside regex set expressions]'; 
        }

        return s;
    }

    // expand a macro which exists inside a `[...]` set:
    function expandMacroInSet(i) {
        var k, a, m;
        if (!macros[i]) {
            m = dict_macros[i];

            for (k in dict_macros) {
                if (dict_macros.hasOwnProperty(k) && i !== k) {
                    // it doesn't matter if the lexer recognized that the inner macro(s)
                    // were sitting inside a `[...]` set or not: the fact that they are used
                    // here in macro `i` which itself sits in a set, makes them *all* live in
                    // a set so all of them get the same treatment: set expansion style.
                    a = m.split('{[{' + k + '}]}');
                    if (a.length > 1) {
                        m = a.join(expandMacroInSet(k));
                    }
                    a = m.split('{' + k + '}');
                    if (a.length > 1) {
                        m = a.join(expandMacroInSet(k));
                    }
                }
            }

            m = reduceRegexToSet(m, i);

            macros[i] = {
                in_set: m,
                elsewhere: null,
                raw: dict_macros[i]
            };
        } else {
            m = macros[i].in_set;
        }

        return m;
    }

    function expandMacroElsewhere(i) {
        var k, a, m;

        if (!macros[i].elsewhere) {
            m = dict_macros[i];

            // the macro MAY contain other macros which MAY be inside a `[...]` set in this
            // macro, hence we first expand those submacros all the way:
            for (k in dict_macros) {
                if (dict_macros.hasOwnProperty(k) && i !== k) {
                    a = m.split('{[{' + k + '}]}');
                    if (a.length > 1) {
                        m = a.join(macros[k].in_set);
                    }
                    
                    a = m.split('{' + k + '}');
                    if (a.length > 1) {
                        m = a.join('(?:' + expandMacroElsewhere(k) + ')');
                    }
                }
            }

            macros[i].elsewhere = m;
        } else {
            m = macros[i].elsewhere;
        }

        return m;
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
function expandMacros(src, macros) {
    var i, m;

    // first process *all* the macros inside [...] set expressions:
    if (src.indexOf('{[{') >= 0) {
        for (i in macros) {
            if (macros.hasOwnProperty(i)) {
                m = macros[i];

                src = src.split('{[{' + i + '}]}').join(m.in_set);
            }
        }
    }

    // then process the remaining macro occurrences in the regex:
    // every macro used in a lexer rule will become its own capture group. 
    // Meanwhile the cached expansion will have expanded any submacros into
    // *NON*-capturing groups so that the backreference indexes remain as you'ld
    // expect and using macros doesn't require you to know exactly what your
    // used macro will expand into, i.e. which and how many submacros it has.
    // 
    // This is a BREAKING CHANGE from vanilla jison 0.4.15! 
    if (src.indexOf('{') >= 0) {
        for (i in macros) {
            if (macros.hasOwnProperty(i)) {
                m = macros[i];

                src = src.split('{' + i + '}').join('(' + m.elsewhere + ')');
            }
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

    var gen = prepareRules(dict, actions, tokens && toks, opts.conditions, opts.options['case-insensitive'], caseHelper, opts);

    var fun = actions.join('\n');
    'yytext yyleng yylineno yylloc'.split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp('\\b(' + yy + ')\\b', 'g'), 'yy_.$1');
    });

    return {
        caseHelperInclude: '{\n' + caseHelper.join(',') + '\n}',

        actions: 'function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {\n' + fun + '\n}',

        rules: gen.rules,
        macros: gen.macros                   // propagate these for debugging/diagnostic purposes
    };
}

var jisonLexerErrorDefinition = [
    '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript',
    '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript',
    'function JisonLexerError(msg, hash) {',
    '    this.message = msg;',
    '    this.hash = hash;',
    '    var stacktrace = (new Error(msg)).stack;',
    '    if (stacktrace) {',
    '      this.stack = stacktrace;',
    '    }',
    '}',
    'JisonLexerError.prototype = Object.create(Error.prototype);',
    'JisonLexerError.prototype.constructor = JisonLexerError;',
    'JisonLexerError.prototype.name = \'JisonLexerError\';',
    '',
];


function RegExpLexer (dict, input, tokens) {
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
            var testcode = '' +
                '// provide a local version for test purposes:\n' +
                jisonLexerErrorDefinition.join('\n') + '\n' +
                source + '\n' +
                'return lexer;\n';
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
                if (typeof opts.options.pre_lex === 'function') {
                    lexer.options.pre_lex = opts.options.pre_lex;
                }
                if (typeof opts.options.post_lex === 'function') {
                    lexer.options.post_lex = opts.options.post_lex;
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

    return lexer;
}

RegExpLexer.prototype = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,

    parseError: function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },
    
    // resets the lexer, sets new input
    setInput: function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
    input: function () {
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
    unput: function (ch) {
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
    more: function () {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function () {
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
    less: function (n) {
        this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages
    pastInput: function(maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

    // return (part of the) upcoming input, i.e. for error messages
    upcomingInput: function(maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // test the lexed token: return FALSE when not a match, otherwise return token
    test_match: function(match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
    next: function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
    lex: function lex () {
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

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    begin: function begin (condition) {
        this.conditionStack.push(condition);
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function popState () {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // produce the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function _currentRules () {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function topState (n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // alias for begin(condition)
    pushState: function pushState (condition) {
        this.begin(condition);
    },

    // return the number of states currently on the stack
    stateStackSize: function stateStackSize() {
        return this.conditionStack.length;
    }
};


// generate lexer source from a grammar
function generate (dict, tokens) {
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

    opts.options = dict.options || {};
    opts.moduleType = opts.options.moduleType;
    opts.moduleName = opts.options.moduleName;

    opts.conditions = prepareStartConditions(dict.startConditions);
    opts.conditions.INITIAL = {rules:[], inclusive:true};

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

function generateModuleBody(opt) {
    var functionDescriptions = {
        setInput: 'resets the lexer, sets new input',
        input: 'consumes and returns one char from the input',
        unput: 'unshifts one char (or a string) into the input',
        more: 'When called from action, caches matched text and appends it on next action',
        reject: 'When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.',
        less: 'retain first n characters of the match',
        pastInput: 'return (part of the) already matched input, i.e. for error messages',
        upcomingInput: 'return (part of the) upcoming input, i.e. for error messages',
        showPosition: 'return a string which displays the character position where the lexing error occurred, i.e. for error messages',
        test_match: 'test the lexed token: return FALSE when not a match, otherwise return token',
        next: 'return next match in input',
        lex: 'return next match that has a token',
        begin: 'activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)',
        popState: 'pop the previously active lexer condition state off the condition stack',
        _currentRules: 'produce the lexer rule set which is active for the currently active lexer condition state',
        topState: 'return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available',
        pushState: 'alias for begin(condition)',
        stateStackSize: 'return the number of states currently on the stack'
    };

    // make the JSON output look more like JavaScript:
    function cleanupJSON(str) {
        str = str.replace(/  "rules": \[/g, '  rules: [');
        str = str.replace(/  "inclusive": /g, '  inclusive: ');
        return str;
    }

    var out;
    if (opt.rules.length > 0 || opt.in_rules_failure_analysis_mode) {
        var p = [];
        var descr;

        // we don't mind that the `test_me()` code above will have this `lexer` variable re-defined:
        // JavaScript is fine with that.
        out = 'var lexer = {\n';

        for (var k in RegExpLexer.prototype) {
            if (RegExpLexer.prototype.hasOwnProperty(k) && k.indexOf('generate') === -1) {
                // copy the function description as a comment before the implementation; supports multi-line descriptions
                descr = '\n';
                if (functionDescriptions[k]) {
                    descr += '// ' + functionDescriptions[k].replace(/\n/g, '\n\/\/ ') + '\n';
                }
                p.push(descr + k + ':' + (RegExpLexer.prototype[k].toString() || '""'));
            }
        }
        out += p.join(',\n');

        if (opt.options) {
            var pre = opt.options.pre_lex;
            var post = opt.options.post_lex;
            // since JSON cannot encode functions, we'll have to do it manually at run-time, i.e. later on:
            opt.options.pre_lex = (pre ? true : undefined);
            opt.options.post_lex = (post ? true : undefined);

            var js = JSON.stringify(opt.options, null, 2);
            js = js.replace(/  \"([a-zA-Z_][a-zA-Z0-9_]*)\": /g, "  $1: ");

            // and restore the original:
            opt.options.pre_lex = pre;
            opt.options.post_lex = post;

            out += ',\noptions: ' + js;
        }

        out += ',\nJisonLexerError: JisonLexerError';
        out += ',\nperformAction: ' + String(opt.performAction);
        out += ',\nsimpleCaseActionClusters: ' + String(opt.caseHelperInclude);
        out += ',\nrules: [\n' + opt.rules.join(',\n') + '\n]';
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
        '// lexer.JisonLexerError = JisonLexerError;',
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
        '// lexer.JisonLexerError = JisonLexerError;',
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


},{"./lex-parser":5,"./package.json":6}],9:[function(require,module,exports){
// Set class to wrap arrays

var typal = require("./typal").typal;

var setMixin = {
    constructor: function Set_constructor (set, raw) {
        this._items = [];
        if (set && set.constructor === Array)
            this._items = raw ? set: set.slice(0);
        else if(arguments.length)
            this._items = [].slice.call(arguments,0);
    },
    concat: function concat (setB) {
        this._items.push.apply(this._items, setB._items || setB);
        return this;
    },
    eq: function eq (set) {
        return this._items.length === set._items.length && this.subset(set);
    },
    indexOf: function indexOf (item) {
        if(item && item.eq) {
            for(var k=0; k<this._items.length;k++)
                if(item.eq(this._items[k]))
                    return k;
            return -1;
        }
        return this._items.indexOf(item);
    },
    union: function union (set) {
        return (new Set(this._items)).concat(this.complement(set));
    },
    intersection: function intersection (set) {
    return this.filter(function (elm) {
            return set.contains(elm);
        });
    },
    complement: function complement (set) {
        var that = this;
        return set.filter(function sub_complement (elm) {
            return !that.contains(elm);
        });
    },
    subset: function subset (set) {
        var cont = true;
        for (var i=0; i<this._items.length && cont;i++) {
            cont = cont && set.contains(this._items[i]);
        }
        return cont;
    },
    superset: function superset (set) {
        return set.subset(this);
    },
    joinSet: function joinSet (set) {
        return this.concat(this.complement(set));
    },
    contains: function contains (item) { return this.indexOf(item) !== -1; },
    item: function item (v, val) { return this._items[v]; },
    i: function i (v, val) { return this._items[v]; },
    first: function first () { return this._items[0]; },
    last: function last () { return this._items[this._items.length-1]; },
    size: function size () { return this._items.length; },
    isEmpty: function isEmpty () { return this._items.length === 0; },
    copy: function copy () { return new Set(this._items); },
    toString: function toString () { return this._items.toString(); }
};

"push shift unshift forEach some every join sort".split(' ').forEach(function (e,i) {
    setMixin[e] = function () { return Array.prototype[e].apply(this._items, arguments); };
    setMixin[e].name = e;
});
"filter slice map".split(' ').forEach(function (e,i) {
    setMixin[e] = function () { return new Set(Array.prototype[e].apply(this._items, arguments), true); };
    setMixin[e].name = e;
});

var Set = typal.construct(setMixin).mix({
    union: function (a, b) {
        var ar = {};
        for (var k=a.length-1;k >=0;--k) {
            ar[a[k]] = true;
        }
        for (var i=b.length-1;i >= 0;--i) {
            if (!ar[b[i]]) {
                a.push(b[i]);
            }
        }
        return a;
    }
});

if (typeof exports !== 'undefined')
    exports.Set = Set;


},{"./typal":11}],10:[function(require,module,exports){
/* parser generated by jison 0.4.15-113 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    trace: function(errorMessage, errorHash),
 *    JisonParserError: function(msg, hash),
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    productions_: [...],
 *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),
 *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)
 *    table: [...],
 *    defaultActions: {...},
 *    parseError: function(str, hash),
 *    parse: function(input),
 *
 *    lexer: {
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(),
 *        upcomingInput: function(),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        popState: function(),
 *        _currentRules: function(),
 *        topState: function(),
 *        pushState: function(condition),
 *        stateStackSize: function(),
 *
 *        options: { ... },
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
 *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
 *  }
 *
 * ---
 *
 * The parseError function receives a 'hash' object with these members for lexer and parser errors:
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
 *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                              optional: you can specify a pre_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval) { return retval; }
 *                              optional: you can specify a post_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`. When it does not return any value, the parser will return 
 *                              the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy)
 *                              optional: is invoked before the parse cycle starts (and before the first invocation 
 *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).
 *      post_parse: function(yy, retval) { return retval; }
 *                              optional: is invoked when the parse terminates due to success ('accept') or failure 
 *                              (even when exceptions are thrown).  `retval` contains the return value to be produced
 *                              by `Parser.parse()`; this function can override the return value by returning another. 
 *                              When it does not return any value, the parser will return the original `retval`. 
 *                              This function is invoked immediately before `Parser.post_parse()`.
 *      parseError: function(str, hash)
 *                              optional: overrides the default `parseError` function.
 *  }
 *
 *  parser.lexer.options: {
 *      ranges: boolean         optional: true ==> token location info will include a .range[] member.
 *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested
 *                                                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                              optional: true ==> lexer regexes are tested in order and for each matching
 *                                                 regex the action code is invoked; the lexer terminates
 *                                                 the scan when a token is returned by the action code.
 *      pre_lex:  function()
 *                              optional: is invoked before the lexer is invoked to produce another token.
 *                              `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                              optional: is invoked when the lexer has produced a token `token`;
 *                              this function can override the returned token value by returning another.
 *                              When it does not return any (truthy) value, the lexer will return the original `token`.
 *                              `this` refers to the Lexer object.
 *  }
 */
var ebnf = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonParserError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonParserError.prototype = Object.create(Error.prototype);
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';

function __expand__(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

var $V0=[40,41,124,129],
    $V1=[40,41,124,129,134],
    $V2=[40,41,42,43,63,124,129,134],
    $V3=[40,41,124],
    $V4=[41,124];

var parser = {
trace: function trace() { },
JisonParserError: JisonParserError,
yy: {},
symbols_: {
  "$accept": 0,
  "$end": 1,
  "(": 40,
  ")": 41,
  "*": 42,
  "+": 43,
  "?": 63,
  "ALIAS": 134,
  "EOF": 129,
  "SYMBOL": 135,
  "error": 2,
  "expression": 132,
  "expression_suffixed": 131,
  "handle": 128,
  "handle_list": 130,
  "production": 127,
  "suffix": 133,
  "|": 124
},
terminals_: {
  1: "$end",
  2: "error",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  63: "?",
  124: "|",
  129: "EOF",
  134: "ALIAS",
  135: "SYMBOL"
},
nonterminals_: {
  "$accept": {
    0: "production $end"
  },
  "production": {
    1: "handle EOF"
  },
  "handle_list": {
    2: "handle",
    3: "handle_list | handle"
  },
  "handle": {
    4: "<epsilon>",
    5: "handle expression_suffixed"
  },
  "expression_suffixed": {
    6: "expression suffix ALIAS",
    7: "expression suffix"
  },
  "expression": {
    8: "SYMBOL",
    9: "( handle_list )"
  },
  "suffix": {
    10: "<epsilon>",
    11: "*",
    12: "?",
    13: "+"
  }
},
productions_: [
  0,
  [
    127,
    2
  ],
  [
    130,
    1
  ],
  [
    130,
    3
  ],
  [
    128,
    0
  ],
  [
    128,
    2
  ],
  [
    131,
    3
  ],
  [
    131,
    2
  ],
  [
    132,
    1
  ],
  [
    132,
    3
  ],
  [
    133,
    0
  ],
  [
    133,
    1
  ],
  [
    133,
    1
  ],
  [
    133,
    1
  ]
],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1 : 
/*! Production::     production : handle EOF */
  return $$[$0-1];  
break;
case 2 : 
/*! Production::     handle_list : handle */
  this.$ = [$$[$0]];  
break;
case 3 : 
/*! Production::     handle_list : handle_list '|' handle */
  $$[$0-2].push($$[$0]);  
break;
case 4 : 
/*! Production::     handle :  */
  this.$ = [];  
break;
case 5 : 
/*! Production::     handle : handle expression_suffixed */
  $$[$0-1].push($$[$0]);  
break;
case 6 : 
/*! Production::     expression_suffixed : expression suffix ALIAS */
  this.$ = ['xalias', $$[$0-1], $$[$0-2], $$[$0]];  
break;
case 7 : 
/*! Production::     expression_suffixed : expression suffix */
 
      if ($$[$0]) {
        this.$ = [$$[$0], $$[$0-1]];
      } else {
        this.$ = $$[$0-1];
      }
     
break;
case 8 : 
/*! Production::     expression : SYMBOL */
  this.$ = ['symbol', $$[$0]];  
break;
case 9 : 
/*! Production::     expression : '(' handle_list ')' */
  this.$ = ['()', $$[$0-1]];  
break;
}
},
table: [
  __expand__([40,129], [
      2,
      4
    ], {127:1,128:2,135:[
      2,
      4
    ]
  }),
  {
    1: [
      3
    ]
  },
  {
    40: [
      1,
      7
    ],
    129: [
      1,
      3
    ],
    131: 4,
    132: 5,
    135: [
      1,
      6
    ]
  },
  {
    1: [
      2,
      1
    ]
  },
  __expand__($V0, [
      2,
      5
    ], {135:[
      2,
      5
    ]
  }),
  __expand__($V1, [
      2,
      10
    ], {133:8,42:[
      1,
      9
    ],43:[
      1,
      11
    ],63:[
      1,
      10
    ],135:[
      2,
      10
    ]
  }),
  __expand__($V2, [
      2,
      8
    ], {135:[
      2,
      8
    ]
  }),
  __expand__($V3, [
      2,
      4
    ], {130:12,128:13,135:[
      2,
      4
    ]
  }),
  __expand__($V0, [
      2,
      7
    ], {134:[
      1,
      14
    ],135:[
      2,
      7
    ]
  }),
  __expand__($V1, [
      2,
      11
    ], {135:[
      2,
      11
    ]
  }),
  __expand__($V1, [
      2,
      12
    ], {135:[
      2,
      12
    ]
  }),
  __expand__($V1, [
      2,
      13
    ], {135:[
      2,
      13
    ]
  }),
  {
    41: [
      1,
      15
    ],
    124: [
      1,
      16
    ]
  },
  __expand__($V4, [
      2,
      2
    ], {131:4,132:5,40:[
      1,
      7
    ],135:[
      1,
      6
    ]
  }),
  __expand__($V0, [
      2,
      6
    ], {135:[
      2,
      6
    ]
  }),
  __expand__($V2, [
      2,
      9
    ], {135:[
      2,
      9
    ]
  }),
  __expand__($V3, [
      2,
      4
    ], {128:17,135:[
      2,
      4
    ]
  }),
  __expand__($V4, [
      2,
      3
    ], {131:4,132:5,40:[
      1,
      7
    ],135:[
      1,
      6
    ]
  })
],
defaultActions: {
  3: [
    2,
    1
  ]
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = [0],

        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,

        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }



    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr;

                // Report error
                expected = collect_expected_token_set(state);
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ":\n" + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                             (symbol === EOF ? 'end of input' :
                              ("'" + (this.terminals_[symbol] || symbol) + "'"));
                }
                // we cannot recover from the error!
                retval = this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }


            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;

                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
}
};

/* generated by jison-lex 0.3.4-112 */
var lexer = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonLexerError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonLexerError.prototype = Object.create(Error.prototype);
JisonLexerError.prototype.constructor = JisonLexerError;
JisonLexerError.prototype.name = 'JisonLexerError';

var lexer = {

EOF:1,

ERROR:2,

parseError:function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
input:function () {
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
unput:function (ch) {
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
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
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
less:function (n) {
        this.unput(this.match.slice(n));
    },

// return (part of the) already matched input, i.e. for error messages
pastInput:function (maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

// return (part of the) upcoming input, i.e. for error messages
upcomingInput:function (maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

// return a string which displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
next:function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
lex:function lex() {
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

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
JisonLexerError: JisonLexerError,
performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 0 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \s+ */ 
 /* skip whitespace */ 
break;
case 2 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \[{ID}\] */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 134; 
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: INITIAL */ 
  /*! Rule::       {ID} */ 
   1 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   3 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   4 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \. */ 
   5 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \( */ 
   6 : 40,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \) */ 
   7 : 41,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \* */ 
   8 : 42,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \? */ 
   9 : 63,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \| */ 
   10 : 124,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \+ */ 
   11 : 43,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       $ */ 
   12 : 129
},
rules: [
/^(?:\s+)/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
/^(?:\[([a-zA-Z_][a-zA-Z0-9_]*)\])/,
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
      12
    ],
    inclusive: true
  }
}
};

// lexer.JisonLexerError = JisonLexerError;
return lexer;
})();
parser.lexer = lexer;

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;
// parser.JisonParserError = JisonParserError;

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

var create = Object.create || function (o) { function F(){} F.prototype = o; return new F(); };
var position = /^(before|after)/;

// basic method layering
// always returns original method's return value
function layerMethod(k, fun) {
    var pos = k.match(position)[0],
        key = k.replace(position, ''),
        prop = this[key];

    if (pos === 'after') {
        this[key] = function () {
            var ret = prop.apply(this, arguments);
            var args = [].slice.call(arguments);
            args.splice(0, 0, ret);
            fun.apply(this, args);
            return ret;
        };
    } else if (pos === 'before') {
        this[key] = function () {
            fun.apply(this, arguments);
            var ret = prop.apply(this, arguments);
            return ret;
        };
    }
}

// mixes each argument's own properties into calling object,
// overwriting them or layering them. i.e. an object method 'meth' is
// layered by mixin methods 'beforemeth' or 'aftermeth'
function typal_mix() {
    var self = this;
    for(var i=0,o,k; i<arguments.length; i++) {
        o=arguments[i];
        if (!o) continue;
        if (Object.prototype.hasOwnProperty.call(o,'constructor'))
            this.constructor = o.constructor;
        if (Object.prototype.hasOwnProperty.call(o,'toString'))
            this.toString = o.toString;
        for(k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                if(k.match(position) && typeof this[k.replace(position, '')] === 'function')
                    layerMethod.call(this, k, o[k]);
                else
                    this[k] = o[k];
            }
        }
    }
    return this;
}

return {
    // extend object with own properties of each argument
    mix: typal_mix,

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

},{"util/":23}],13:[function(require,module,exports){

},{}],14:[function(require,module,exports){
var bnf = require("./parser").parser,
    ebnf = require("./ebnf-transform"),
    jisonlex = require("lex-parser");

exports.parse = function parse (grammar) { return bnf.parse(grammar); };
exports.transform = ebnf.transform;

// adds a declaration to the grammar
bnf.yy.addDeclaration = function (grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start;
    } else if (decl.lex) {
        grammar.lex = parseLex(decl.lex);
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
    } else if (decl.parseParam) {
        if (!grammar.parseParams) grammar.parseParams = [];
        grammar.parseParams = grammar.parseParams.concat(decl.parseParam);
    } else if (decl.parserType) {
        if (!grammar.options) grammar.options = {};
        grammar.options.type = decl.parserType;
    } else if (decl.include) {
        if (!grammar.moduleInclude) grammar.moduleInclude = '';
        grammar.moduleInclude += decl.include;
    } else if (decl.options) {
        if (!grammar.options) grammar.options = {};
        // last occurrence of %option wins:
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
    }
};

// parse an embedded lex section
var parseLex = function (text) {
    text = text.replace(/(?:^%lex)|(?:\/lex$)/g, '');
    return jisonlex.parse(text);
};

},{"./ebnf-transform":15,"./parser":16,"lex-parser":19}],15:[function(require,module,exports){
arguments[4][4][0].apply(exports,arguments)
},{"./transform-parser.js":17,"dup":4}],16:[function(require,module,exports){
/* parser generated by jison 0.4.15-112 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    trace: function(errorMessage, errorHash),
 *    JisonParserError: function(msg, hash),
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    productions_: [...],
 *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),
 *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)
 *    table: [...],
 *    defaultActions: {...},
 *    parseError: function(str, hash),
 *    parse: function(input),
 *
 *    lexer: {
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(),
 *        upcomingInput: function(),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        popState: function(),
 *        _currentRules: function(),
 *        topState: function(),
 *        pushState: function(condition),
 *        stateStackSize: function(),
 *
 *        options: { ... },
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
 *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
 *  }
 *
 * ---
 *
 * The parseError function receives a 'hash' object with these members for lexer and parser errors:
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
 *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                              optional: you can specify a pre_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval) { return retval; }
 *                              optional: you can specify a post_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`. When it does not return any value, the parser will return 
 *                              the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy)
 *                              optional: is invoked before the parse cycle starts (and before the first invocation 
 *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).
 *      post_parse: function(yy, retval) { return retval; }
 *                              optional: is invoked when the parse terminates due to success ('accept') or failure 
 *                              (even when exceptions are thrown).  `retval` contains the return value to be produced
 *                              by `Parser.parse()`; this function can override the return value by returning another. 
 *                              When it does not return any value, the parser will return the original `retval`. 
 *                              This function is invoked immediately before `Parser.post_parse()`.
 *      parseError: function(str, hash)
 *                              optional: overrides the default `parseError` function.
 *  }
 *
 *  parser.lexer.options: {
 *      ranges: boolean         optional: true ==> token location info will include a .range[] member.
 *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested
 *                                                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                              optional: true ==> lexer regexes are tested in order and for each matching
 *                                                 regex the action code is invoked; the lexer terminates
 *                                                 the scan when a token is returned by the action code.
 *      pre_lex:  function()
 *                              optional: is invoked before the lexer is invoked to produce another token.
 *                              `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                              optional: is invoked when the lexer has produced a token `token`;
 *                              this function can override the returned token value by returning another.
 *                              When it does not return any (truthy) value, the lexer will return the original `token`.
 *                              `this` refers to the Lexer object.
 *  }
 */
var bnf = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonParserError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonParserError.prototype = Object.create(Error.prototype);
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';

function __expand__(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

var $V0=[129,135,138,140,142,147,148,153,159,161,164,165,166],
    $V1=[135,151],
    $V2=[129,135,138,140,142,147,148,151,153,159,161,164,165,166,171],
    $V3=[129,135,138,140,142,147,148,151,152,153,159,161,164,165,166],
    $V4=[59,123,124,129,135,138,140,142,147,148,151,152,153,159,161,164,165,166,189],
    $V5=[59,124,129,132,135,138,140,142,147,148,151,153,159,161,164,165,166,193],
    $V6=[132,193],
    $V7=[129,132],
    $V8=[129,135,138,140,142,147,148,151,152,153,159,161,164,165,166,171],
    $V9=[40,59,123,124,135,151,152,187,189],
    $Va=[59,123,124,135,189],
    $Vb=[40,41,59,123,124,135,151,152,187,189],
    $Vc=[40,41,59,123,124,135,151,152,186,187,189],
    $Vd=[40,41,42,43,59,63,123,124,135,151,152,186,187,189],
    $Ve=[40,41,124,151,152],
    $Vf=[123,125],
    $Vg=[41,124];

var parser = {
trace: function trace() { },
JisonParserError: JisonParserError,
yy: {},
symbols_: {
  "$accept": 0,
  "$end": 1,
  "%%": 129,
  "(": 40,
  ")": 41,
  "*": 42,
  "+": 43,
  ":": 58,
  ";": 59,
  "=": 61,
  "?": 63,
  "ACTION": 135,
  "ACTION_BODY": 191,
  "ALIAS": 186,
  "ARROW_ACTION": 189,
  "CODE": 196,
  "EOF": 132,
  "ID": 151,
  "IMPORT": 148,
  "INCLUDE": 193,
  "INTEGER": 172,
  "LEFT": 164,
  "LEX_BLOCK": 140,
  "NAME": 157,
  "NONASSOC": 166,
  "OPTIONS": 153,
  "OPTIONS_END": 155,
  "OPTION_VALUE": 158,
  "PARSER_TYPE": 161,
  "PARSE_PARAM": 159,
  "PATH": 194,
  "PREC": 187,
  "RIGHT": 165,
  "START": 138,
  "STRING": 152,
  "TOKEN": 142,
  "TOKEN_TYPE": 171,
  "UNKNOWN_DECL": 147,
  "action": 181,
  "action_body": 188,
  "action_comments_body": 190,
  "associativity": 163,
  "declaration": 137,
  "declaration_list": 128,
  "error": 2,
  "expression": 184,
  "expression_suffix": 182,
  "extra_parser_module_code": 133,
  "full_token_definition": 167,
  "full_token_definitions": 143,
  "grammar": 130,
  "handle": 179,
  "handle_action": 178,
  "handle_list": 177,
  "handle_sublist": 183,
  "id": 139,
  "id_list": 173,
  "import_name": 149,
  "import_path": 150,
  "include_macro_code": 136,
  "module_code_chunk": 195,
  "operator": 141,
  "option": 156,
  "option_list": 154,
  "optional_action_header_block": 134,
  "optional_end_block": 131,
  "optional_module_code_chunk": 192,
  "optional_token_description": 170,
  "optional_token_type": 168,
  "optional_token_value": 169,
  "options": 146,
  "parse_param": 144,
  "parser_type": 145,
  "prec": 180,
  "production": 176,
  "production_list": 175,
  "spec": 127,
  "suffix": 185,
  "symbol": 162,
  "token_id": 174,
  "token_list": 160,
  "{": 123,
  "|": 124,
  "}": 125
},
terminals_: {
  1: "$end",
  2: "error",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  58: ":",
  59: ";",
  61: "=",
  63: "?",
  123: "{",
  124: "|",
  125: "}",
  129: "%%",
  132: "EOF",
  135: "ACTION",
  138: "START",
  140: "LEX_BLOCK",
  142: "TOKEN",
  147: "UNKNOWN_DECL",
  148: "IMPORT",
  151: "ID",
  152: "STRING",
  153: "OPTIONS",
  155: "OPTIONS_END",
  157: "NAME",
  158: "OPTION_VALUE",
  159: "PARSE_PARAM",
  161: "PARSER_TYPE",
  164: "LEFT",
  165: "RIGHT",
  166: "NONASSOC",
  171: "TOKEN_TYPE",
  172: "INTEGER",
  186: "ALIAS",
  187: "PREC",
  189: "ARROW_ACTION",
  191: "ACTION_BODY",
  193: "INCLUDE",
  194: "PATH",
  196: "CODE"
},
nonterminals_: {
  "$accept": {
    0: "spec $end"
  },
  "spec": {
    1: "declaration_list %% grammar optional_end_block EOF"
  },
  "optional_end_block": {
    2: "<epsilon>",
    3: "%% extra_parser_module_code"
  },
  "optional_action_header_block": {
    4: "<epsilon>",
    5: "optional_action_header_block ACTION",
    6: "optional_action_header_block include_macro_code"
  },
  "declaration_list": {
    7: "declaration_list declaration",
    8: "<epsilon>"
  },
  "declaration": {
    9: "START id",
    10: "LEX_BLOCK",
    11: "operator",
    12: "TOKEN full_token_definitions",
    13: "ACTION",
    14: "include_macro_code",
    15: "parse_param",
    16: "parser_type",
    17: "options",
    18: "UNKNOWN_DECL",
    19: "IMPORT import_name import_path"
  },
  "import_name": {
    20: "ID",
    21: "STRING"
  },
  "import_path": {
    22: "ID",
    23: "STRING"
  },
  "options": {
    24: "OPTIONS option_list OPTIONS_END"
  },
  "option_list": {
    25: "option_list option",
    26: "option"
  },
  "option": {
    27: "NAME",
    28: "NAME = OPTION_VALUE",
    29: "NAME = NAME"
  },
  "parse_param": {
    30: "PARSE_PARAM token_list"
  },
  "parser_type": {
    31: "PARSER_TYPE symbol"
  },
  "operator": {
    32: "associativity token_list"
  },
  "associativity": {
    33: "LEFT",
    34: "RIGHT",
    35: "NONASSOC"
  },
  "token_list": {
    36: "token_list symbol",
    37: "symbol"
  },
  "full_token_definitions": {
    38: "full_token_definitions full_token_definition",
    39: "full_token_definition"
  },
  "full_token_definition": {
    40: "optional_token_type id optional_token_value optional_token_description"
  },
  "optional_token_type": {
    41: "<epsilon>",
    42: "TOKEN_TYPE"
  },
  "optional_token_value": {
    43: "<epsilon>",
    44: "INTEGER"
  },
  "optional_token_description": {
    45: "<epsilon>",
    46: "STRING"
  },
  "id_list": {
    47: "id_list id",
    48: "id"
  },
  "token_id": {
    49: "TOKEN_TYPE id",
    50: "id"
  },
  "grammar": {
    51: "optional_action_header_block production_list"
  },
  "production_list": {
    52: "production_list production",
    53: "production"
  },
  "production": {
    54: "id : handle_list ;"
  },
  "handle_list": {
    55: "handle_list | handle_action",
    56: "handle_action"
  },
  "handle_action": {
    57: "handle prec action"
  },
  "handle": {
    58: "handle expression_suffix",
    59: "<epsilon>"
  },
  "handle_sublist": {
    60: "handle_sublist | handle",
    61: "handle"
  },
  "expression_suffix": {
    62: "expression suffix ALIAS",
    63: "expression suffix"
  },
  "expression": {
    64: "ID",
    65: "STRING",
    66: "( handle_sublist )"
  },
  "suffix": {
    67: "<epsilon>",
    68: "*",
    69: "?",
    70: "+"
  },
  "prec": {
    71: "PREC symbol",
    72: "<epsilon>"
  },
  "symbol": {
    73: "id",
    74: "STRING"
  },
  "id": {
    75: "ID"
  },
  "action": {
    76: "{ action_body }",
    77: "ACTION",
    78: "include_macro_code",
    79: "ARROW_ACTION",
    80: "<epsilon>"
  },
  "action_body": {
    81: "<epsilon>",
    82: "action_comments_body",
    83: "action_body { action_body } action_comments_body",
    84: "action_body { action_body }"
  },
  "action_comments_body": {
    85: "ACTION_BODY",
    86: "action_comments_body ACTION_BODY"
  },
  "extra_parser_module_code": {
    87: "optional_module_code_chunk",
    88: "optional_module_code_chunk include_macro_code extra_parser_module_code"
  },
  "include_macro_code": {
    89: "INCLUDE PATH",
    90: "INCLUDE error"
  },
  "module_code_chunk": {
    91: "CODE",
    92: "module_code_chunk CODE"
  },
  "optional_module_code_chunk": {
    93: "module_code_chunk",
    94: "<epsilon>"
  }
},
productions_: [
  0,
  [
    127,
    5
  ],
  [
    131,
    0
  ],
  [
    131,
    2
  ],
  [
    134,
    0
  ],
  [
    134,
    2
  ],
  [
    134,
    2
  ],
  [
    128,
    2
  ],
  [
    128,
    0
  ],
  [
    137,
    2
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    2
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    1
  ],
  [
    137,
    3
  ],
  [
    149,
    1
  ],
  [
    149,
    1
  ],
  [
    150,
    1
  ],
  [
    150,
    1
  ],
  [
    146,
    3
  ],
  [
    154,
    2
  ],
  [
    154,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    3
  ],
  [
    156,
    3
  ],
  [
    144,
    2
  ],
  [
    145,
    2
  ],
  [
    141,
    2
  ],
  [
    163,
    1
  ],
  [
    163,
    1
  ],
  [
    163,
    1
  ],
  [
    160,
    2
  ],
  [
    160,
    1
  ],
  [
    143,
    2
  ],
  [
    143,
    1
  ],
  [
    167,
    4
  ],
  [
    168,
    0
  ],
  [
    168,
    1
  ],
  [
    169,
    0
  ],
  [
    169,
    1
  ],
  [
    170,
    0
  ],
  [
    170,
    1
  ],
  [
    173,
    2
  ],
  [
    173,
    1
  ],
  [
    174,
    2
  ],
  [
    174,
    1
  ],
  [
    130,
    2
  ],
  [
    175,
    2
  ],
  [
    175,
    1
  ],
  [
    176,
    4
  ],
  [
    177,
    3
  ],
  [
    177,
    1
  ],
  [
    178,
    3
  ],
  [
    179,
    2
  ],
  [
    179,
    0
  ],
  [
    183,
    3
  ],
  [
    183,
    1
  ],
  [
    182,
    3
  ],
  [
    182,
    2
  ],
  [
    184,
    1
  ],
  [
    184,
    1
  ],
  [
    184,
    3
  ],
  [
    185,
    0
  ],
  [
    185,
    1
  ],
  [
    185,
    1
  ],
  [
    185,
    1
  ],
  [
    180,
    2
  ],
  [
    180,
    0
  ],
  [
    162,
    1
  ],
  [
    162,
    1
  ],
  [
    139,
    1
  ],
  [
    181,
    3
  ],
  [
    181,
    1
  ],
  [
    181,
    1
  ],
  [
    181,
    1
  ],
  [
    181,
    0
  ],
  [
    188,
    0
  ],
  [
    188,
    1
  ],
  [
    188,
    5
  ],
  [
    188,
    4
  ],
  [
    190,
    1
  ],
  [
    190,
    2
  ],
  [
    133,
    1
  ],
  [
    133,
    3
  ],
  [
    136,
    2
  ],
  [
    136,
    2
  ],
  [
    195,
    1
  ],
  [
    195,
    2
  ],
  [
    192,
    1
  ],
  [
    192,
    0
  ]
],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack, options) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1 : 
/*! Production::     spec : declaration_list '%%' grammar optional_end_block EOF */
 
            this.$ = $$[$0-4];
            if ($$[$0-1] && $$[$0-1].trim() !== '') {
                yy.addDeclaration(this.$, { include: $$[$0-1] });
            }
            return extend(this.$, $$[$0-2]);
         
break;
case 3 : 
/*! Production::     optional_end_block : '%%' extra_parser_module_code */
 case 30 : 
/*! Production::     parse_param : PARSE_PARAM token_list */
 case 31 : 
/*! Production::     parser_type : PARSER_TYPE symbol */
 case 49 : 
/*! Production::     token_id : TOKEN_TYPE id */
 case 50 : 
/*! Production::     token_id : id */
 case 64 : 
/*! Production::     expression : ID */
 case 73 : 
/*! Production::     symbol : id */
 case 74 : 
/*! Production::     symbol : STRING */
 case 75 : 
/*! Production::     id : ID */
 case 77 : 
/*! Production::     action : ACTION */
 case 78 : 
/*! Production::     action : include_macro_code */
 case 82 : 
/*! Production::     action_body : action_comments_body */
 case 85 : 
/*! Production::     action_comments_body : ACTION_BODY */
 case 87 : 
/*! Production::     extra_parser_module_code : optional_module_code_chunk */
 case 91 : 
/*! Production::     module_code_chunk : CODE */
 case 93 : 
/*! Production::     optional_module_code_chunk : module_code_chunk */
  this.$ = $$[$0];  
break;
case 4 : 
/*! Production::     optional_action_header_block :  */
 case 8 : 
/*! Production::     declaration_list :  */
  this.$ = {};  
break;
case 5 : 
/*! Production::     optional_action_header_block : optional_action_header_block ACTION */
 case 6 : 
/*! Production::     optional_action_header_block : optional_action_header_block include_macro_code */
 
            this.$ = $$[$0-1];
            yy.addDeclaration(this.$, { actionInclude: $$[$0] });
         
break;
case 7 : 
/*! Production::     declaration_list : declaration_list declaration */
  this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);  
break;
case 9 : 
/*! Production::     declaration : START id */
  this.$ = {start: $$[$0]};  
break;
case 10 : 
/*! Production::     declaration : LEX_BLOCK */
  this.$ = {lex: $$[$0]};  
break;
case 11 : 
/*! Production::     declaration : operator */
  this.$ = {operator: $$[$0]};  
break;
case 12 : 
/*! Production::     declaration : TOKEN full_token_definitions */
  this.$ = {token_list: $$[$0]};  
break;
case 13 : 
/*! Production::     declaration : ACTION */
 case 14 : 
/*! Production::     declaration : include_macro_code */
  this.$ = {include: $$[$0]};  
break;
case 15 : 
/*! Production::     declaration : parse_param */
  this.$ = {parseParam: $$[$0]};  
break;
case 16 : 
/*! Production::     declaration : parser_type */
  this.$ = {parserType: $$[$0]};  
break;
case 17 : 
/*! Production::     declaration : options */
  this.$ = {options: $$[$0]};  
break;
case 18 : 
/*! Production::     declaration : UNKNOWN_DECL */
  this.$ = {unknownDecl: $$[$0]};  
break;
case 19 : 
/*! Production::     declaration : IMPORT import_name import_path */
  this.$ = {imports: {name: $$[$0-1], path: $$[$0]}};  
break;
case 24 : 
/*! Production::     options : OPTIONS option_list OPTIONS_END */
 case 76 : 
/*! Production::     action : '{' action_body '}' */
  this.$ = $$[$0-1];  
break;
case 25 : 
/*! Production::     option_list : option_list option */
 case 36 : 
/*! Production::     token_list : token_list symbol */
 case 38 : 
/*! Production::     full_token_definitions : full_token_definitions full_token_definition */
 case 47 : 
/*! Production::     id_list : id_list id */
  this.$ = $$[$0-1]; this.$.push($$[$0]);  
break;
case 26 : 
/*! Production::     option_list : option */
 case 37 : 
/*! Production::     token_list : symbol */
 case 39 : 
/*! Production::     full_token_definitions : full_token_definition */
 case 48 : 
/*! Production::     id_list : id */
 case 56 : 
/*! Production::     handle_list : handle_action */
  this.$ = [$$[$0]];  
break;
case 27 : 
/*! Production::     option : NAME[option] */
  this.$ = [$$[$0], true];  
break;
case 28 : 
/*! Production::     option : NAME[option] '=' OPTION_VALUE[value] */
 case 29 : 
/*! Production::     option : NAME[option] '=' NAME[value] */
  this.$ = [$$[$0-2], $$[$0]];  
break;
case 32 : 
/*! Production::     operator : associativity token_list */
  this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);  
break;
case 33 : 
/*! Production::     associativity : LEFT */
  this.$ = 'left';  
break;
case 34 : 
/*! Production::     associativity : RIGHT */
  this.$ = 'right';  
break;
case 35 : 
/*! Production::     associativity : NONASSOC */
  this.$ = 'nonassoc';  
break;
case 40 : 
/*! Production::     full_token_definition : optional_token_type id optional_token_value optional_token_description */
 
            this.$ = {id: $$[$0-2]};
            if ($$[$0-3]) {
                this.$.type = $$[$0-3];
            }
            if ($$[$0-1]) {
                this.$.value = $$[$0-1];
            }
            if ($$[$0]) {
                this.$.description = $$[$0];
            }
         
break;
case 41 : 
/*! Production::     optional_token_type :  */
 case 43 : 
/*! Production::     optional_token_value :  */
 case 45 : 
/*! Production::     optional_token_description :  */
  this.$ = false;  
break;
case 51 : 
/*! Production::     grammar : optional_action_header_block production_list */
 
            this.$ = $$[$0-1];
            this.$.grammar = $$[$0];
         
break;
case 52 : 
/*! Production::     production_list : production_list production */
 
            this.$ = $$[$0-1];
            if ($$[$0][0] in this.$) {
                this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
            } else {
                this.$[$$[$0][0]] = $$[$0][1];
            }
         
break;
case 53 : 
/*! Production::     production_list : production */
  this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];  
break;
case 54 : 
/*! Production::     production : id ':' handle_list ';' */
 this.$ = [$$[$0-3], $$[$0-1]]; 
break;
case 55 : 
/*! Production::     handle_list : handle_list '|' handle_action */
 
            this.$ = $$[$0-2];
            this.$.push($$[$0]);
         
break;
case 57 : 
/*! Production::     handle_action : handle prec action */
 
            this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if ($$[$0]) {
                this.$.push($$[$0]);
            }
            if ($$[$0-1]) {
                this.$.push($$[$0-1]);
            }
            if (this.$.length === 1) {
                this.$ = this.$[0];
            }
         
break;
case 58 : 
/*! Production::     handle : handle expression_suffix */
 
            this.$ = $$[$0-1];
            this.$.push($$[$0]);
         
break;
case 59 : 
/*! Production::     handle :  */
 
            this.$ = [];
         
break;
case 60 : 
/*! Production::     handle_sublist : handle_sublist '|' handle */
 
            this.$ = $$[$0-2];
            this.$.push($$[$0].join(' '));
         
break;
case 61 : 
/*! Production::     handle_sublist : handle */
 
            this.$ = [$$[$0].join(' ')];
         
break;
case 62 : 
/*! Production::     expression_suffix : expression suffix ALIAS */
 
            this.$ = $$[$0-2] + $$[$0-1] + "[" + $$[$0] + "]";
         
break;
case 63 : 
/*! Production::     expression_suffix : expression suffix */
 case 86 : 
/*! Production::     action_comments_body : action_comments_body ACTION_BODY */
 case 92 : 
/*! Production::     module_code_chunk : module_code_chunk CODE */
 
            this.$ = $$[$0-1] + $$[$0];
         
break;
case 65 : 
/*! Production::     expression : STRING */
 
            // Re-encode the string *anyway* as it will
            // be made part of the rule rhs a.k.a. production (type: *string*) again and we want
            // to be able to handle all tokens, including *significant space*
            // encoded as literal tokens in a grammar such as this: `rule: A ' ' B`.
            if ($$[$0].indexOf("'") >= 0) {
                this.$ = '"' + $$[$0] + '"';
            } else {
                this.$ = "'" + $$[$0] + "'";
            }
         
break;
case 66 : 
/*! Production::     expression : '(' handle_sublist ')' */
 
            this.$ = '(' + $$[$0-1].join(' | ') + ')';
         
break;
case 67 : 
/*! Production::     suffix :  */
 case 80 : 
/*! Production::     action :  */
 case 81 : 
/*! Production::     action_body :  */
 case 94 : 
/*! Production::     optional_module_code_chunk :  */
  this.$ = '';  
break;
case 71 : 
/*! Production::     prec : PREC symbol */
 
            this.$ = { prec: $$[$0] };
         
break;
case 72 : 
/*! Production::     prec :  */
 
            this.$ = null;
         
break;
case 79 : 
/*! Production::     action : ARROW_ACTION */
  this.$ = '$$ =' + $$[$0] + ';';  
break;
case 83 : 
/*! Production::     action_body : action_body '{' action_body '}' action_comments_body */
  this.$ = $$[$0-4] + $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 84 : 
/*! Production::     action_body : action_body '{' action_body '}' */
  this.$ = $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 88 : 
/*! Production::     extra_parser_module_code : optional_module_code_chunk include_macro_code extra_parser_module_code */
  this.$ = $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 89 : 
/*! Production::     include_macro_code : INCLUDE PATH */
 
console.log('options: ', options);
            var fileContent = fs.readFileSync($$[$0], { encoding: 'utf-8' });
            // And no, we don't support nested '%include':
            this.$ = '\n// Included by Jison: ' + $$[$0] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + $$[$0] + '\n\n';
         
break;
case 90 : 
/*! Production::     include_macro_code : INCLUDE error */
 
            console.error("%include MUST be followed by a valid file path");
         
break;
}
},
table: [
  __expand__($V0, [
      2,
      8
    ], {127:1,128:2,193:[
      2,
      8
    ]
  }),
  {
    1: [
      3
    ]
  },
  {
    129: [
      1,
      3
    ],
    135: [
      1,
      9
    ],
    136: 10,
    137: 4,
    138: [
      1,
      5
    ],
    140: [
      1,
      6
    ],
    141: 7,
    142: [
      1,
      8
    ],
    144: 11,
    145: 12,
    146: 13,
    147: [
      1,
      14
    ],
    148: [
      1,
      15
    ],
    153: [
      1,
      20
    ],
    159: [
      1,
      18
    ],
    161: [
      1,
      19
    ],
    163: 16,
    164: [
      1,
      21
    ],
    165: [
      1,
      22
    ],
    166: [
      1,
      23
    ],
    193: [
      1,
      17
    ]
  },
  __expand__($V1, [
      2,
      4
    ], {130:24,134:25,193:[
      2,
      4
    ]
  }),
  __expand__($V0, [
      2,
      7
    ], {193:[
      2,
      7
    ]
  }),
  {
    139: 26,
    151: [
      1,
      27
    ]
  },
  __expand__($V0, [
      2,
      10
    ], {193:[
      2,
      10
    ]
  }),
  __expand__($V0, [
      2,
      11
    ], {193:[
      2,
      11
    ]
  }),
  {
    143: 28,
    151: [
      2,
      41
    ],
    167: 29,
    168: 30,
    171: [
      1,
      31
    ]
  },
  __expand__($V0, [
      2,
      13
    ], {193:[
      2,
      13
    ]
  }),
  __expand__($V0, [
      2,
      14
    ], {193:[
      2,
      14
    ]
  }),
  __expand__($V0, [
      2,
      15
    ], {193:[
      2,
      15
    ]
  }),
  __expand__($V0, [
      2,
      16
    ], {193:[
      2,
      16
    ]
  }),
  __expand__($V0, [
      2,
      17
    ], {193:[
      2,
      17
    ]
  }),
  __expand__($V0, [
      2,
      18
    ], {193:[
      2,
      18
    ]
  }),
  {
    149: 32,
    151: [
      1,
      33
    ],
    152: [
      1,
      34
    ]
  },
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    160: 35,
    162: 36
  },
  {
    2: [
      1,
      40
    ],
    194: [
      1,
      39
    ]
  },
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    160: 41,
    162: 36
  },
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    162: 42
  },
  {
    154: 43,
    156: 44,
    157: [
      1,
      45
    ]
  },
  {
    151: [
      2,
      33
    ],
    152: [
      2,
      33
    ]
  },
  {
    151: [
      2,
      34
    ],
    152: [
      2,
      34
    ]
  },
  {
    151: [
      2,
      35
    ],
    152: [
      2,
      35
    ]
  },
  {
    129: [
      1,
      47
    ],
    131: 46,
    132: [
      2,
      2
    ]
  },
  {
    135: [
      1,
      49
    ],
    136: 50,
    139: 52,
    151: [
      1,
      27
    ],
    175: 48,
    176: 51,
    193: [
      1,
      17
    ]
  },
  __expand__($V0, [
      2,
      9
    ], {193:[
      2,
      9
    ]
  }),
  __expand__([58,59,123,124,129,135,138,140,142,147,148,151,152,153,159,161,164,165,166,171,172,189], [
      2,
      75
    ], {193:[
      2,
      75
    ]
  }),
  __expand__($V0, [
      2,
      12
    ], {168:30,167:53,151:[
      2,
      41
    ],171:[
      1,
      31
    ],193:[
      2,
      12
    ]
  }),
  __expand__($V2, [
      2,
      39
    ], {193:[
      2,
      39
    ]
  }),
  {
    139: 54,
    151: [
      1,
      27
    ]
  },
  {
    151: [
      2,
      42
    ]
  },
  {
    150: 55,
    151: [
      1,
      56
    ],
    152: [
      1,
      57
    ]
  },
  {
    151: [
      2,
      20
    ],
    152: [
      2,
      20
    ]
  },
  {
    151: [
      2,
      21
    ],
    152: [
      2,
      21
    ]
  },
  __expand__($V0, [
      2,
      32
    ], {139:37,162:58,151:[
      1,
      27
    ],152:[
      1,
      38
    ],193:[
      2,
      32
    ]
  }),
  __expand__($V3, [
      2,
      37
    ], {193:[
      2,
      37
    ]
  }),
  __expand__($V4, [
      2,
      73
    ], {193:[
      2,
      73
    ]
  }),
  __expand__($V4, [
      2,
      74
    ], {193:[
      2,
      74
    ]
  }),
  __expand__($V5, [
      2,
      89
    ], {196:[
      2,
      89
    ]
  }),
  __expand__($V5, [
      2,
      90
    ], {196:[
      2,
      90
    ]
  }),
  __expand__($V0, [
      2,
      30
    ], {139:37,162:58,151:[
      1,
      27
    ],152:[
      1,
      38
    ],193:[
      2,
      30
    ]
  }),
  __expand__($V0, [
      2,
      31
    ], {193:[
      2,
      31
    ]
  }),
  {
    155: [
      1,
      59
    ],
    156: 60,
    157: [
      1,
      45
    ]
  },
  {
    155: [
      2,
      26
    ],
    157: [
      2,
      26
    ]
  },
  {
    61: [
      1,
      61
    ],
    155: [
      2,
      27
    ],
    157: [
      2,
      27
    ]
  },
  {
    132: [
      1,
      62
    ]
  },
  __expand__($V6, [
      2,
      94
    ], {133:63,192:64,195:65,196:[
      1,
      66
    ]
  }),
  __expand__($V7, [
      2,
      51
    ], {139:52,151:[
      1,
      27
    ],176:67
  }),
  __expand__($V1, [
      2,
      5
    ], {193:[
      2,
      5
    ]
  }),
  __expand__($V1, [
      2,
      6
    ], {193:[
      2,
      6
    ]
  }),
  __expand__($V7, [
      2,
      53
    ], {151:[
      2,
      53
    ]
  }),
  {
    58: [
      1,
      68
    ]
  },
  __expand__($V2, [
      2,
      38
    ], {193:[
      2,
      38
    ]
  }),
  __expand__($V8, [
      2,
      43
    ], {169:69,172:[
      1,
      70
    ],193:[
      2,
      43
    ]
  }),
  __expand__($V0, [
      2,
      19
    ], {193:[
      2,
      19
    ]
  }),
  __expand__($V0, [
      2,
      22
    ], {193:[
      2,
      22
    ]
  }),
  __expand__($V0, [
      2,
      23
    ], {193:[
      2,
      23
    ]
  }),
  __expand__($V3, [
      2,
      36
    ], {193:[
      2,
      36
    ]
  }),
  __expand__($V0, [
      2,
      24
    ], {193:[
      2,
      24
    ]
  }),
  {
    155: [
      2,
      25
    ],
    157: [
      2,
      25
    ]
  },
  {
    157: [
      1,
      72
    ],
    158: [
      1,
      71
    ]
  },
  {
    1: [
      2,
      1
    ]
  },
  {
    132: [
      2,
      3
    ]
  },
  {
    132: [
      2,
      87
    ],
    136: 73,
    193: [
      1,
      17
    ]
  },
  __expand__($V6, [
      2,
      93
    ], {196:[
      1,
      74
    ]
  }),
  __expand__($V6, [
      2,
      91
    ], {196:[
      2,
      91
    ]
  }),
  __expand__($V7, [
      2,
      52
    ], {151:[
      2,
      52
    ]
  }),
  __expand__($V9, [
      2,
      59
    ], {177:75,178:76,179:77,193:[
      2,
      59
    ]
  }),
  __expand__($V2, [
      2,
      45
    ], {170:78,152:[
      1,
      79
    ],193:[
      2,
      45
    ]
  }),
  __expand__($V8, [
      2,
      44
    ], {193:[
      2,
      44
    ]
  }),
  {
    155: [
      2,
      28
    ],
    157: [
      2,
      28
    ]
  },
  {
    155: [
      2,
      29
    ],
    157: [
      2,
      29
    ]
  },
  __expand__($V6, [
      2,
      94
    ], {192:64,195:65,133:80,196:[
      1,
      66
    ]
  }),
  __expand__($V6, [
      2,
      92
    ], {196:[
      2,
      92
    ]
  }),
  {
    59: [
      1,
      81
    ],
    124: [
      1,
      82
    ]
  },
  {
    59: [
      2,
      56
    ],
    124: [
      2,
      56
    ]
  },
  __expand__($Va, [
      2,
      72
    ], {180:83,182:84,184:86,40:[
      1,
      89
    ],151:[
      1,
      87
    ],152:[
      1,
      88
    ],187:[
      1,
      85
    ],193:[
      2,
      72
    ]
  }),
  __expand__($V2, [
      2,
      40
    ], {193:[
      2,
      40
    ]
  }),
  __expand__($V2, [
      2,
      46
    ], {193:[
      2,
      46
    ]
  }),
  {
    132: [
      2,
      88
    ]
  },
  __expand__($V7, [
      2,
      54
    ], {151:[
      2,
      54
    ]
  }),
  __expand__($V9, [
      2,
      59
    ], {179:77,178:90,193:[
      2,
      59
    ]
  }),
  __expand__([59,124], [
      2,
      80
    ], {181:91,136:94,123:[
      1,
      92
    ],135:[
      1,
      93
    ],189:[
      1,
      95
    ],193:[
      1,
      17
    ]
  }),
  __expand__($Vb, [
      2,
      58
    ], {193:[
      2,
      58
    ]
  }),
  {
    139: 37,
    151: [
      1,
      27
    ],
    152: [
      1,
      38
    ],
    162: 96
  },
  __expand__($Vc, [
      2,
      67
    ], {185:97,42:[
      1,
      98
    ],43:[
      1,
      100
    ],63:[
      1,
      99
    ],193:[
      2,
      67
    ]
  }),
  __expand__($Vd, [
      2,
      64
    ], {193:[
      2,
      64
    ]
  }),
  __expand__($Vd, [
      2,
      65
    ], {193:[
      2,
      65
    ]
  }),
  __expand__($Ve, [
      2,
      59
    ], {179:102,183:101
  }),
  {
    59: [
      2,
      55
    ],
    124: [
      2,
      55
    ]
  },
  {
    59: [
      2,
      57
    ],
    124: [
      2,
      57
    ]
  },
  __expand__($Vf, [
      2,
      81
    ], {188:103,190:104,191:[
      1,
      105
    ]
  }),
  {
    59: [
      2,
      77
    ],
    124: [
      2,
      77
    ]
  },
  {
    59: [
      2,
      78
    ],
    124: [
      2,
      78
    ]
  },
  {
    59: [
      2,
      79
    ],
    124: [
      2,
      79
    ]
  },
  __expand__($Va, [
      2,
      71
    ], {193:[
      2,
      71
    ]
  }),
  __expand__($Vb, [
      2,
      63
    ], {186:[
      1,
      106
    ],193:[
      2,
      63
    ]
  }),
  __expand__($Vc, [
      2,
      68
    ], {193:[
      2,
      68
    ]
  }),
  __expand__($Vc, [
      2,
      69
    ], {193:[
      2,
      69
    ]
  }),
  __expand__($Vc, [
      2,
      70
    ], {193:[
      2,
      70
    ]
  }),
  {
    41: [
      1,
      107
    ],
    124: [
      1,
      108
    ]
  },
  __expand__($Vg, [
      2,
      61
    ], {182:84,40:[
      1,
      89
    ],151:[
      1,
      87
    ],152:[
      1,
      88
    ],184:86
  }),
  {
    123: [
      1,
      110
    ],
    125: [
      1,
      109
    ]
  },
  __expand__($Vf, [
      2,
      82
    ], {191:[
      1,
      111
    ]
  }),
  __expand__($Vf, [
      2,
      85
    ], {191:[
      2,
      85
    ]
  }),
  __expand__($Vb, [
      2,
      62
    ], {193:[
      2,
      62
    ]
  }),
  __expand__($Vd, [
      2,
      66
    ], {193:[
      2,
      66
    ]
  }),
  __expand__($Ve, [
      2,
      59
    ], {179:112
  }),
  {
    59: [
      2,
      76
    ],
    124: [
      2,
      76
    ]
  },
  __expand__($Vf, [
      2,
      81
    ], {190:104,188:113,191:[
      1,
      105
    ]
  }),
  __expand__($Vf, [
      2,
      86
    ], {191:[
      2,
      86
    ]
  }),
  __expand__($Vg, [
      2,
      60
    ], {182:84,40:[
      1,
      89
    ],151:[
      1,
      87
    ],152:[
      1,
      88
    ],184:86
  }),
  {
    123: [
      1,
      110
    ],
    125: [
      1,
      114
    ]
  },
  __expand__($Vf, [
      2,
      84
    ], {190:115,191:[
      1,
      105
    ]
  }),
  __expand__($Vf, [
      2,
      83
    ], {191:[
      1,
      111
    ]
  })
],
defaultActions: {
  31: [
    2,
    42
  ],
  62: [
    2,
    1
  ],
  63: [
    2,
    3
  ],
  80: [
    2,
    88
  ]
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = [0],

        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,     // (only used when the grammar contains error recovery rules)
        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }

    // Return the rule stack depth where the nearest error rule can be found.
    // Return FALSE when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = stack.length - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            if ((TERROR.toString()) in table[state]) {
                return depth;
            }
            if (state === 0 || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
            }
            stack_probe -= 2; // popStack(1): [symbol, action]
            state = stack[stack_probe];
            ++depth;
        }
    }


    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var error_rule_depth;
                var errStr = '';

                if (!recovering) {
                    // first see if there's any chance at hitting an error recovery rule:
                    error_rule_depth = locateNearestErrorRecoveryRule(state);

                    // Report error
                    expected = collect_expected_token_set(state);
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                                 (symbol === EOF ? 'end of input' :
                                  ("'" + (this.terminals_[symbol] || symbol) + "'"));
                    }
                    a = this.parseError(errStr, p = {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false),
                        state_stack: stack
                    });
                    if (!p.recoverable) {
                        retval = a;
                        break;
                    }
                } else if (preErrorSymbol !== EOF) {
                    error_rule_depth = locateNearestErrorRecoveryRule(state);
                }

                // just recovered from another error
                if (recovering === 3) {
                    if (symbol === EOF || preErrorSymbol === EOF) {
                        retval = this.parseError(errStr || 'Parsing halted while starting to recover from another error.', {
                            text: lexer.match,
                            token: this.terminals_[symbol] || symbol,
                            token_id: symbol,
                            line: lexer.yylineno,
                            loc: yyloc,
                            expected: expected,
                            recoverable: false,
                            state_stack: stack
                        });
                        break;
                    }

                    // discard current lookahead and grab another
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    symbol = lex();
                }

                // try to recover from error
                if (error_rule_depth === false) {
                    retval = this.parseError(errStr || 'Parsing halted. No suitable error recovery rule available.', {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack
                    });
                    break;
                }
                popStack(error_rule_depth);

                preErrorSymbol = (symbol === TERROR ? null : symbol); // save the lookahead token
                symbol = TERROR;         // insert generic error symbol as new lookahead
                state = stack[stack.length - 1];
                action = table[state] && table[state][TERROR];
                recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
            }


            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    if (recovering > 0) {
                        recovering--;
                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
}
};

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


/* generated by jison-lex 0.3.4-112 */
var lexer = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonLexerError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonLexerError.prototype = Object.create(Error.prototype);
JisonLexerError.prototype.constructor = JisonLexerError;
JisonLexerError.prototype.name = 'JisonLexerError';

var lexer = {

EOF:1,

ERROR:2,

parseError:function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
input:function () {
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
unput:function (ch) {
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
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
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
less:function (n) {
        this.unput(this.match.slice(n));
    },

// return (part of the) already matched input, i.e. for error messages
pastInput:function (maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

// return (part of the) upcoming input, i.e. for error messages
upcomingInput:function (maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

// return a string which displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
next:function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
lex:function lex() {
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

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {
  easy_keyword_rules: true,
  ranges: true
},
JisonLexerError: JisonLexerError,
performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 0 : 
/*! Conditions:: token */ 
/*! Rule::       \r|\n */ 
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
 this.pushState('code'); return 129; 
break;
case 11 : 
/*! Conditions:: options */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 158; 
break;
case 12 : 
/*! Conditions:: options */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 158; 
break;
case 14 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}+ */ 
 this.popState(); return 155; 
break;
case 15 : 
/*! Conditions:: options */ 
/*! Rule::       \s+{BR}+ */ 
 this.popState(); return 155; 
break;
case 16 : 
/*! Conditions:: options */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 17 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \s+ */ 
 /* skip whitespace */ 
break;
case 18 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \/\/.* */ 
 /* skip comment */ 
break;
case 19 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
 /* skip comment */ 
break;
case 20 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \[{ID}\] */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 186; 
break;
case 22 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       "[^"]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 152; 
break;
case 23 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       '[^']+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 152; 
break;
case 28 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %% */ 
 this.pushState(ebnf ? 'ebnf' : 'bnf'); return 129; 
break;
case 29 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %ebnf\b */ 
 if (!yy.options) { yy.options = {}; } ebnf = yy.options.ebnf = true; 
break;
case 30 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %debug\b */ 
 if (!yy.options) { yy.options = {}; } yy.options.debug = true; 
break;
case 37 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %token\b */ 
 this.pushState('token'); return 142; 
break;
case 39 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %options\b */ 
 this.pushState('options'); return 153; 
break;
case 42 : 
/*! Conditions:: INITIAL ebnf bnf code */ 
/*! Rule::       %include\b */ 
 this.pushState('path'); return 193; 
break;
case 43 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %{NAME}[^\r\n]* */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported parser option: ', yy_.yytext, ' while lexing in ', this.topState(), ' state');
                                            return 147;
                                         
break;
case 44 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       <{ID}> */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 171; 
break;
case 45 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \{\{[\w\W]*?\}\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 4); return 135; 
break;
case 46 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       %\{(.|\r|\n)*?%\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 135; 
break;
case 47 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       \{ */ 
 yy.depth = 0; this.pushState('action'); return 123; 
break;
case 48 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       ->.* */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 2); return 189; 
break;
case 49 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {HEX_NUMBER} */ 
 yy_.yytext = parseInt(yy_.yytext, 16); return 172; 
break;
case 50 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       {DECIMAL_NUMBER}(?![xX0-9a-fA-F]) */ 
 yy_.yytext = parseInt(yy_.yytext, 10); return 172; 
break;
case 51 : 
/*! Conditions:: bnf ebnf token INITIAL */ 
/*! Rule::       . */ 
 
                                            throw new Error("unsupported input character: " + yy_.yytext + " @ " + JSON.stringify(yy_.yylloc)); /* b0rk on bad characters */
                                         
break;
case 55 : 
/*! Conditions:: action */ 
/*! Rule::       \/[^ /]*?['"{}'][^ ]*?\/ */ 
 return 191; // regexp with braces or quotes (and no spaces) 
break;
case 60 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++; return 123; 
break;
case 61 : 
/*! Conditions:: action */ 
/*! Rule::       \} */ 
 if (yy.depth === 0) { this.popState(); } else { yy.depth--; } return 125; 
break;
case 63 : 
/*! Conditions:: code */ 
/*! Rule::       [^\r\n]+ */ 
 return 196;      // the bit of CODE just before EOF... 
break;
case 64 : 
/*! Conditions:: path */ 
/*! Rule::       [\r\n] */ 
 this.popState(); this.unput(yy_.yytext); 
break;
case 65 : 
/*! Conditions:: path */ 
/*! Rule::       '[^\r\n]+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 194; 
break;
case 66 : 
/*! Conditions:: path */ 
/*! Rule::       "[^\r\n]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 194; 
break;
case 67 : 
/*! Conditions:: path */ 
/*! Rule::       \s+ */ 
 // skip whitespace in the line 
break;
case 68 : 
/*! Conditions:: path */ 
/*! Rule::       [^\s\r\n]+ */ 
 this.popState(); return 194; 
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: ebnf */ 
  /*! Rule::       \( */ 
   4 : 40,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \) */ 
   5 : 41,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \* */ 
   6 : 42,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \? */ 
   7 : 63,
  /*! Conditions:: ebnf */ 
  /*! Rule::       \+ */ 
   8 : 43,
  /*! Conditions:: options */ 
  /*! Rule::       {NAME} */ 
   9 : 157,
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   10 : 61,
  /*! Conditions:: options */ 
  /*! Rule::       [^\s\r\n]+ */ 
   13 : 158,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       {ID} */ 
   21 : 151,
  /*! Conditions:: token */ 
  /*! Rule::       [^\s\r\n]+ */ 
   24 : 'TOKEN_WORD',
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       : */ 
   25 : 58,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       ; */ 
   26 : 59,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       \| */ 
   27 : 124,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %parser-type\b */ 
   31 : 161,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %prec\b */ 
   32 : 187,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %start\b */ 
   33 : 138,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %left\b */ 
   34 : 164,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %right\b */ 
   35 : 165,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %nonassoc\b */ 
   36 : 166,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %parse-param\b */ 
   38 : 159,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %lex[\w\W]*?{BR}\s*\/lex\b */ 
   40 : 140,
  /*! Conditions:: bnf ebnf token INITIAL */ 
  /*! Rule::       %import\b */ 
   41 : 148,
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   52 : 132,
  /*! Conditions:: action */ 
  /*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
   53 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       \/\/.* */ 
   54 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       "(\\\\|\\"|[^"])*" */ 
   56 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       '(\\\\|\\'|[^'])*' */ 
   57 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       [/"'][^{}/"']+ */ 
   58 : 191,
  /*! Conditions:: action */ 
  /*! Rule::       [^{}/"']+ */ 
   59 : 191,
  /*! Conditions:: code */ 
  /*! Rule::       [^\r\n]*(\r|\n)+ */ 
   62 : 196
},
rules: [
/^(?:\r|\n)/,
/^(?:%%)/,
/^(?:;)/,
/^(?:%%)/,
/^(?:\()/,
/^(?:\))/,
/^(?:\*)/,
/^(?:\?)/,
/^(?:\+)/,
/^(?:([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?))/,
/^(?:=)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[^\s\r\n]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:\s+)/,
/^(?:\/\/.*)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\[([a-zA-Z_][a-zA-Z0-9_]*)\])/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
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
/^(?:%lex[\w\W]*?(\r\n|\n|\r)\s*\/lex\b)/,
/^(?:%import\b)/,
/^(?:%include\b)/,
/^(?:%([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?)[^\r\n]*)/,
/^(?:<([a-zA-Z_][a-zA-Z0-9_]*)>)/,
/^(?:\{\{[\w\W]*?\}\})/,
/^(?:%\{(.|\r|\n)*?%\})/,
/^(?:\{)/,
/^(?:->.*)/,
/^(?:(0[xX][0-9a-fA-F]+))/,
/^(?:([1-9][0-9]*)(?![xX0-9a-fA-F]))/,
/^(?:.)/,
/^(?:$)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:\/[^ \/]*?['"{}'][^ ]*?\/)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[\/"'][^{}\/"']+)/,
/^(?:[^{}\/"']+)/,
/^(?:\{)/,
/^(?:\})/,
/^(?:[^\r\n]*(\r|\n)+)/,
/^(?:[^\r\n]+)/,
/^(?:[\r\n])/,
/^(?:'[^\r\n]+')/,
/^(?:"[^\r\n]+")/,
/^(?:\s+)/,
/^(?:[^\s\r\n]+)/
],
conditions: {
  "bnf": {
    rules: [
      3,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      51,
      52
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
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      51,
      52
    ],
    inclusive: true
  },
  "token": {
    rules: [
      0,
      1,
      2,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52
    ],
    inclusive: true
  },
  "action": {
    rules: [
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
    inclusive: false
  },
  "code": {
    rules: [
      42,
      52,
      62,
      63
    ],
    inclusive: false
  },
  "path": {
    rules: [
      52,
      64,
      65,
      66,
      67,
      68
    ],
    inclusive: false
  },
  "options": {
    rules: [
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      52
    ],
    inclusive: false
  },
  "INITIAL": {
    rules: [
      17,
      18,
      19,
      20,
      21,
      22,
      23,
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
      51,
      52
    ],
    inclusive: true
  }
}
};

// lexer.JisonLexerError = JisonLexerError;
return lexer;
})();
parser.lexer = lexer;

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;
// parser.JisonParserError = JisonParserError;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = bnf;
exports.Parser = bnf.Parser;
exports.parse = function () {
  return bnf.parse.apply(bnf, arguments);
};

}

},{"./ebnf-transform":15,"fs":13}],17:[function(require,module,exports){
/* parser generated by jison 0.4.15-112 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    trace: function(errorMessage, errorHash),
 *    JisonParserError: function(msg, hash),
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    productions_: [...],
 *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),
 *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)
 *    table: [...],
 *    defaultActions: {...},
 *    parseError: function(str, hash),
 *    parse: function(input),
 *
 *    lexer: {
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(),
 *        upcomingInput: function(),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        popState: function(),
 *        _currentRules: function(),
 *        topState: function(),
 *        pushState: function(condition),
 *        stateStackSize: function(),
 *
 *        options: { ... },
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
 *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
 *  }
 *
 * ---
 *
 * The parseError function receives a 'hash' object with these members for lexer and parser errors:
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
 *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                              optional: you can specify a pre_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval) { return retval; }
 *                              optional: you can specify a post_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`. When it does not return any value, the parser will return 
 *                              the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy)
 *                              optional: is invoked before the parse cycle starts (and before the first invocation 
 *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).
 *      post_parse: function(yy, retval) { return retval; }
 *                              optional: is invoked when the parse terminates due to success ('accept') or failure 
 *                              (even when exceptions are thrown).  `retval` contains the return value to be produced
 *                              by `Parser.parse()`; this function can override the return value by returning another. 
 *                              When it does not return any value, the parser will return the original `retval`. 
 *                              This function is invoked immediately before `Parser.post_parse()`.
 *      parseError: function(str, hash)
 *                              optional: overrides the default `parseError` function.
 *  }
 *
 *  parser.lexer.options: {
 *      ranges: boolean         optional: true ==> token location info will include a .range[] member.
 *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested
 *                                                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                              optional: true ==> lexer regexes are tested in order and for each matching
 *                                                 regex the action code is invoked; the lexer terminates
 *                                                 the scan when a token is returned by the action code.
 *      pre_lex:  function()
 *                              optional: is invoked before the lexer is invoked to produce another token.
 *                              `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                              optional: is invoked when the lexer has produced a token `token`;
 *                              this function can override the returned token value by returning another.
 *                              When it does not return any (truthy) value, the lexer will return the original `token`.
 *                              `this` refers to the Lexer object.
 *  }
 */
var ebnf = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonParserError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonParserError.prototype = Object.create(Error.prototype);
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';

function __expand__(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

var $V0=[40,41,124,129],
    $V1=[40,41,124,129,134],
    $V2=[40,41,42,43,63,124,129,134],
    $V3=[40,41,124],
    $V4=[41,124];

var parser = {
trace: function trace() { },
JisonParserError: JisonParserError,
yy: {},
symbols_: {
  "$accept": 0,
  "$end": 1,
  "(": 40,
  ")": 41,
  "*": 42,
  "+": 43,
  "?": 63,
  "ALIAS": 134,
  "EOF": 129,
  "SYMBOL": 135,
  "error": 2,
  "expression": 132,
  "expression_suffixed": 131,
  "handle": 128,
  "handle_list": 130,
  "production": 127,
  "suffix": 133,
  "|": 124
},
terminals_: {
  1: "$end",
  2: "error",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  63: "?",
  124: "|",
  129: "EOF",
  134: "ALIAS",
  135: "SYMBOL"
},
nonterminals_: {
  "$accept": {
    0: "production $end"
  },
  "production": {
    1: "handle EOF"
  },
  "handle_list": {
    2: "handle",
    3: "handle_list | handle"
  },
  "handle": {
    4: "<epsilon>",
    5: "handle expression_suffixed"
  },
  "expression_suffixed": {
    6: "expression suffix ALIAS",
    7: "expression suffix"
  },
  "expression": {
    8: "SYMBOL",
    9: "( handle_list )"
  },
  "suffix": {
    10: "<epsilon>",
    11: "*",
    12: "?",
    13: "+"
  }
},
productions_: [
  0,
  [
    127,
    2
  ],
  [
    130,
    1
  ],
  [
    130,
    3
  ],
  [
    128,
    0
  ],
  [
    128,
    2
  ],
  [
    131,
    3
  ],
  [
    131,
    2
  ],
  [
    132,
    1
  ],
  [
    132,
    3
  ],
  [
    133,
    0
  ],
  [
    133,
    1
  ],
  [
    133,
    1
  ],
  [
    133,
    1
  ]
],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1 : 
/*! Production::     production : handle EOF */
  return $$[$0-1];  
break;
case 2 : 
/*! Production::     handle_list : handle */
  this.$ = [$$[$0]];  
break;
case 3 : 
/*! Production::     handle_list : handle_list '|' handle */
  $$[$0-2].push($$[$0]);  
break;
case 4 : 
/*! Production::     handle :  */
  this.$ = [];  
break;
case 5 : 
/*! Production::     handle : handle expression_suffixed */
  $$[$0-1].push($$[$0]);  
break;
case 6 : 
/*! Production::     expression_suffixed : expression suffix ALIAS */
  this.$ = ['xalias', $$[$0-1], $$[$0-2], $$[$0]];  
break;
case 7 : 
/*! Production::     expression_suffixed : expression suffix */
 
      if ($$[$0]) {
        this.$ = [$$[$0], $$[$0-1]];
      } else {
        this.$ = $$[$0-1];
      }
     
break;
case 8 : 
/*! Production::     expression : SYMBOL */
  this.$ = ['symbol', $$[$0]];  
break;
case 9 : 
/*! Production::     expression : '(' handle_list ')' */
  this.$ = ['()', $$[$0-1]];  
break;
}
},
table: [
  __expand__([40,129], [
      2,
      4
    ], {127:1,128:2,135:[
      2,
      4
    ]
  }),
  {
    1: [
      3
    ]
  },
  {
    40: [
      1,
      7
    ],
    129: [
      1,
      3
    ],
    131: 4,
    132: 5,
    135: [
      1,
      6
    ]
  },
  {
    1: [
      2,
      1
    ]
  },
  __expand__($V0, [
      2,
      5
    ], {135:[
      2,
      5
    ]
  }),
  __expand__($V1, [
      2,
      10
    ], {133:8,42:[
      1,
      9
    ],43:[
      1,
      11
    ],63:[
      1,
      10
    ],135:[
      2,
      10
    ]
  }),
  __expand__($V2, [
      2,
      8
    ], {135:[
      2,
      8
    ]
  }),
  __expand__($V3, [
      2,
      4
    ], {130:12,128:13,135:[
      2,
      4
    ]
  }),
  __expand__($V0, [
      2,
      7
    ], {134:[
      1,
      14
    ],135:[
      2,
      7
    ]
  }),
  __expand__($V1, [
      2,
      11
    ], {135:[
      2,
      11
    ]
  }),
  __expand__($V1, [
      2,
      12
    ], {135:[
      2,
      12
    ]
  }),
  __expand__($V1, [
      2,
      13
    ], {135:[
      2,
      13
    ]
  }),
  {
    41: [
      1,
      15
    ],
    124: [
      1,
      16
    ]
  },
  __expand__($V4, [
      2,
      2
    ], {131:4,132:5,40:[
      1,
      7
    ],135:[
      1,
      6
    ]
  }),
  __expand__($V0, [
      2,
      6
    ], {135:[
      2,
      6
    ]
  }),
  __expand__($V2, [
      2,
      9
    ], {135:[
      2,
      9
    ]
  }),
  __expand__($V3, [
      2,
      4
    ], {128:17,135:[
      2,
      4
    ]
  }),
  __expand__($V4, [
      2,
      3
    ], {131:4,132:5,40:[
      1,
      7
    ],135:[
      1,
      6
    ]
  })
],
defaultActions: {
  3: [
    2,
    1
  ]
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = [0],

        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,

        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }



    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var errStr;

                // Report error
                expected = collect_expected_token_set(state);
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ":\n" + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                             (symbol === EOF ? 'end of input' :
                              ("'" + (this.terminals_[symbol] || symbol) + "'"));
                }
                // we cannot recover from the error!
                retval = this.parseError(errStr, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }


            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;

                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
}
};

/* generated by jison-lex 0.3.4-112 */
var lexer = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonLexerError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonLexerError.prototype = Object.create(Error.prototype);
JisonLexerError.prototype.constructor = JisonLexerError;
JisonLexerError.prototype.name = 'JisonLexerError';

var lexer = {

EOF:1,

ERROR:2,

parseError:function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
input:function () {
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
unput:function (ch) {
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
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
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
less:function (n) {
        this.unput(this.match.slice(n));
    },

// return (part of the) already matched input, i.e. for error messages
pastInput:function (maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

// return (part of the) upcoming input, i.e. for error messages
upcomingInput:function (maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

// return a string which displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
next:function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
lex:function lex() {
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

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {},
JisonLexerError: JisonLexerError,
performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 0 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \s+ */ 
 /* skip whitespace */ 
break;
case 2 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \[{ID}\] */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); return 134; 
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: INITIAL */ 
  /*! Rule::       {ID} */ 
   1 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   3 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   4 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \. */ 
   5 : 135,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \( */ 
   6 : 40,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \) */ 
   7 : 41,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \* */ 
   8 : 42,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \? */ 
   9 : 63,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \| */ 
   10 : 124,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \+ */ 
   11 : 43,
  /*! Conditions:: INITIAL */ 
  /*! Rule::       $ */ 
   12 : 129
},
rules: [
/^(?:\s+)/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
/^(?:\[([a-zA-Z_][a-zA-Z0-9_]*)\])/,
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
      12
    ],
    inclusive: true
  }
}
};

// lexer.JisonLexerError = JisonLexerError;
return lexer;
})();
parser.lexer = lexer;

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;
// parser.JisonParserError = JisonParserError;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = ebnf;
exports.Parser = ebnf.Parser;
exports.parse = function () {
  return ebnf.parse.apply(ebnf, arguments);
};

}

},{}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
/* parser generated by jison 0.4.15-112 */
/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    trace: function(errorMessage, errorHash),
 *    JisonParserError: function(msg, hash),
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    productions_: [...],
 *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, ...),
 *                (where `...` denotes the (optional) additional arguments the user passed to `parser.parse(str, ...)`)
 *    table: [...],
 *    defaultActions: {...},
 *    parseError: function(str, hash),
 *    parse: function(input),
 *
 *    lexer: {
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash),
 *        setInput: function(input),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(),
 *        upcomingInput: function(),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index),
 *        next: function(),
 *        lex: function(),
 *        begin: function(condition),
 *        popState: function(),
 *        _currentRules: function(),
 *        topState: function(),
 *        pushState: function(condition),
 *        stateStackSize: function(),
 *
 *        options: { ... },
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
 *    range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
 *  }
 *
 * ---
 *
 * The parseError function receives a 'hash' object with these members for lexer and parser errors:
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
 *    expected:    (array describing the set of expected tokens; may be empty when we cannot easily produce such a set)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used, for instance, for advanced error analysis and reporting)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 *  When `parseError` is invoked by the lexer, `this` will still reference the related *parser* instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                              optional: you can specify a pre_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval) { return retval; }
 *                              optional: you can specify a post_parse() function in the chunk following the grammar, 
 *                              i.e. after the last `%%`. When it does not return any value, the parser will return 
 *                              the original `retval`.
 *
 * ### options which can be set up per parser instance
 *  
 *  yy: {
 *      pre_parse:  function(yy)
 *                              optional: is invoked before the parse cycle starts (and before the first invocation 
 *                              of `lex()`) but immediately after the invocation of parser.pre_parse()).
 *      post_parse: function(yy, retval) { return retval; }
 *                              optional: is invoked when the parse terminates due to success ('accept') or failure 
 *                              (even when exceptions are thrown).  `retval` contains the return value to be produced
 *                              by `Parser.parse()`; this function can override the return value by returning another. 
 *                              When it does not return any value, the parser will return the original `retval`. 
 *                              This function is invoked immediately before `Parser.post_parse()`.
 *      parseError: function(str, hash)
 *                              optional: overrides the default `parseError` function.
 *  }
 *
 *  parser.lexer.options: {
 *      ranges: boolean         optional: true ==> token location info will include a .range[] member.
 *      flex: boolean           optional: true ==> flex-like lexing behaviour where the rules are tested
 *                                                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                              optional: true ==> lexer regexes are tested in order and for each matching
 *                                                 regex the action code is invoked; the lexer terminates
 *                                                 the scan when a token is returned by the action code.
 *      pre_lex:  function()
 *                              optional: is invoked before the lexer is invoked to produce another token.
 *                              `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                              optional: is invoked when the lexer has produced a token `token`;
 *                              this function can override the returned token value by returning another.
 *                              When it does not return any (truthy) value, the lexer will return the original `token`.
 *                              `this` refers to the Lexer object.
 *  }
 */
var lexParser = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonParserError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonParserError.prototype = Object.create(Error.prototype);
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';

function __expand__(k, v, o) {
  o = o || {};
  for (var l = k.length; l--; ) {
    o[k[l]] = v;
  }
  return o;
}

var $V0=[130,136,138,140,142,145,174],
    $V1=[36,40,46,47,94,123,124,142,157,158,164,165,170,172,173],
    $V2=[41,123,124,130,136,138,140,142,145,174],
    $V3=[36,40,41,46,47,94,123,124,130,136,138,140,142,145,157,158,164,165,170,172,173,174],
    $V4=[41,124],
    $V5=[36,40,41,42,43,46,47,63,94,123,124,130,136,138,140,142,145,157,158,164,165,170,171,172,173,174],
    $V6=[130,136,138,140,142,145,146,174],
    $V7=[36,40,46,47,60,94,123,124,130,132,136,138,140,142,145,157,158,164,165,170,172,173,174,180],
    $V8=[132,180],
    $V9=[36,40,46,47,60,94,123,124,130,132,142,157,158,164,165,170,172,173],
    $Va=[164,167],
    $Vb=[123,125];

var parser = {
trace: function trace() { },
JisonParserError: JisonParserError,
yy: {},
symbols_: {
  "$": 36,
  "$accept": 0,
  "$end": 1,
  "%%": 130,
  "(": 40,
  ")": 41,
  "*": 42,
  "+": 43,
  ",": 44,
  ".": 46,
  "/": 47,
  "/!": 158,
  "<": 60,
  "=": 61,
  ">": 62,
  "?": 63,
  "ACTION": 142,
  "ACTION_BODY": 152,
  "CHARACTER_LIT": 173,
  "CODE": 183,
  "EOF": 132,
  "ESCAPE_CHAR": 170,
  "INCLUDE": 180,
  "NAME": 136,
  "NAME_BRACE": 164,
  "OPTIONS": 174,
  "OPTIONS_END": 176,
  "OPTION_VALUE": 178,
  "PATH": 181,
  "RANGE_REGEX": 171,
  "REGEX_SET": 169,
  "REGEX_SET_END": 167,
  "REGEX_SET_START": 165,
  "SPECIAL_GROUP": 157,
  "START_COND": 146,
  "START_EXC": 140,
  "START_INC": 138,
  "STRING_LIT": 172,
  "UNKNOWN_DECL": 145,
  "^": 94,
  "action": 149,
  "action_body": 150,
  "action_comments_body": 151,
  "any_group_regex": 161,
  "definition": 135,
  "definitions": 129,
  "error": 2,
  "escape_char": 163,
  "extra_lexer_module_code": 133,
  "include_macro_code": 143,
  "init": 128,
  "lex": 127,
  "module_code_chunk": 182,
  "name_expansion": 159,
  "name_list": 153,
  "names_exclusive": 141,
  "names_inclusive": 139,
  "option": 177,
  "option_list": 175,
  "optional_module_code_chunk": 179,
  "options": 144,
  "range_regex": 160,
  "regex": 137,
  "regex_base": 156,
  "regex_concat": 155,
  "regex_list": 154,
  "regex_set": 166,
  "regex_set_atom": 168,
  "rule": 147,
  "rules": 134,
  "rules_and_epilogue": 131,
  "start_conditions": 148,
  "string": 162,
  "{": 123,
  "|": 124,
  "}": 125
},
terminals_: {
  1: "$end",
  2: "error",
  36: "$",
  40: "(",
  41: ")",
  42: "*",
  43: "+",
  44: ",",
  46: ".",
  47: "/",
  60: "<",
  61: "=",
  62: ">",
  63: "?",
  94: "^",
  123: "{",
  124: "|",
  125: "}",
  130: "%%",
  132: "EOF",
  136: "NAME",
  138: "START_INC",
  140: "START_EXC",
  142: "ACTION",
  145: "UNKNOWN_DECL",
  146: "START_COND",
  152: "ACTION_BODY",
  157: "SPECIAL_GROUP",
  158: "/!",
  164: "NAME_BRACE",
  165: "REGEX_SET_START",
  167: "REGEX_SET_END",
  169: "REGEX_SET",
  170: "ESCAPE_CHAR",
  171: "RANGE_REGEX",
  172: "STRING_LIT",
  173: "CHARACTER_LIT",
  174: "OPTIONS",
  176: "OPTIONS_END",
  178: "OPTION_VALUE",
  180: "INCLUDE",
  181: "PATH",
  183: "CODE"
},
nonterminals_: {
  "$accept": {
    0: "lex $end"
  },
  "lex": {
    1: "init definitions %% rules_and_epilogue"
  },
  "rules_and_epilogue": {
    2: "EOF",
    3: "%% extra_lexer_module_code EOF",
    4: "rules %% extra_lexer_module_code EOF",
    5: "rules EOF"
  },
  "init": {
    6: "<epsilon>"
  },
  "definitions": {
    7: "definition definitions",
    8: "<epsilon>"
  },
  "definition": {
    9: "NAME regex",
    10: "START_INC names_inclusive",
    11: "START_EXC names_exclusive",
    12: "ACTION",
    13: "include_macro_code",
    14: "options",
    15: "UNKNOWN_DECL"
  },
  "names_inclusive": {
    16: "START_COND",
    17: "names_inclusive START_COND"
  },
  "names_exclusive": {
    18: "START_COND",
    19: "names_exclusive START_COND"
  },
  "rules": {
    20: "rules rule",
    21: "rule"
  },
  "rule": {
    22: "start_conditions regex action"
  },
  "action": {
    23: "{ action_body }",
    24: "ACTION",
    25: "include_macro_code"
  },
  "action_body": {
    26: "action_comments_body",
    27: "action_body { action_body } action_comments_body"
  },
  "action_comments_body": {
    28: "<epsilon>",
    29: "action_comments_body ACTION_BODY"
  },
  "start_conditions": {
    30: "< name_list >",
    31: "< * >",
    32: "<epsilon>"
  },
  "name_list": {
    33: "NAME",
    34: "name_list , NAME"
  },
  "regex": {
    35: "regex_list"
  },
  "regex_list": {
    36: "regex_list | regex_concat",
    37: "regex_list |",
    38: "regex_concat",
    39: "<epsilon>"
  },
  "regex_concat": {
    40: "regex_concat regex_base",
    41: "regex_base"
  },
  "regex_base": {
    42: "( regex_list )",
    43: "SPECIAL_GROUP regex_list )",
    44: "regex_base +",
    45: "regex_base *",
    46: "regex_base ?",
    47: "/ regex_base",
    48: "/! regex_base",
    49: "name_expansion",
    50: "regex_base range_regex",
    51: "any_group_regex",
    52: ".",
    53: "^",
    54: "$",
    55: "string",
    56: "escape_char"
  },
  "name_expansion": {
    57: "NAME_BRACE"
  },
  "any_group_regex": {
    58: "REGEX_SET_START regex_set REGEX_SET_END"
  },
  "regex_set": {
    59: "regex_set_atom regex_set",
    60: "regex_set_atom"
  },
  "regex_set_atom": {
    61: "REGEX_SET",
    62: "name_expansion"
  },
  "escape_char": {
    63: "ESCAPE_CHAR"
  },
  "range_regex": {
    64: "RANGE_REGEX"
  },
  "string": {
    65: "STRING_LIT",
    66: "CHARACTER_LIT"
  },
  "options": {
    67: "OPTIONS option_list OPTIONS_END"
  },
  "option_list": {
    68: "option option_list",
    69: "option"
  },
  "option": {
    70: "NAME",
    71: "NAME = OPTION_VALUE",
    72: "NAME = NAME"
  },
  "extra_lexer_module_code": {
    73: "optional_module_code_chunk",
    74: "optional_module_code_chunk include_macro_code extra_lexer_module_code"
  },
  "include_macro_code": {
    75: "INCLUDE PATH",
    76: "INCLUDE error"
  },
  "module_code_chunk": {
    77: "CODE",
    78: "module_code_chunk CODE"
  },
  "optional_module_code_chunk": {
    79: "module_code_chunk",
    80: "<epsilon>"
  }
},
productions_: [
  0,
  [
    127,
    4
  ],
  [
    131,
    1
  ],
  [
    131,
    3
  ],
  [
    131,
    4
  ],
  [
    131,
    2
  ],
  [
    128,
    0
  ],
  [
    129,
    2
  ],
  [
    129,
    0
  ],
  [
    135,
    2
  ],
  [
    135,
    2
  ],
  [
    135,
    2
  ],
  [
    135,
    1
  ],
  [
    135,
    1
  ],
  [
    135,
    1
  ],
  [
    135,
    1
  ],
  [
    139,
    1
  ],
  [
    139,
    2
  ],
  [
    141,
    1
  ],
  [
    141,
    2
  ],
  [
    134,
    2
  ],
  [
    134,
    1
  ],
  [
    147,
    3
  ],
  [
    149,
    3
  ],
  [
    149,
    1
  ],
  [
    149,
    1
  ],
  [
    150,
    1
  ],
  [
    150,
    5
  ],
  [
    151,
    0
  ],
  [
    151,
    2
  ],
  [
    148,
    3
  ],
  [
    148,
    3
  ],
  [
    148,
    0
  ],
  [
    153,
    1
  ],
  [
    153,
    3
  ],
  [
    137,
    1
  ],
  [
    154,
    3
  ],
  [
    154,
    2
  ],
  [
    154,
    1
  ],
  [
    154,
    0
  ],
  [
    155,
    2
  ],
  [
    155,
    1
  ],
  [
    156,
    3
  ],
  [
    156,
    3
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    2
  ],
  [
    156,
    1
  ],
  [
    156,
    2
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    156,
    1
  ],
  [
    159,
    1
  ],
  [
    161,
    3
  ],
  [
    166,
    2
  ],
  [
    166,
    1
  ],
  [
    168,
    1
  ],
  [
    168,
    1
  ],
  [
    163,
    1
  ],
  [
    160,
    1
  ],
  [
    162,
    1
  ],
  [
    162,
    1
  ],
  [
    144,
    3
  ],
  [
    175,
    2
  ],
  [
    175,
    1
  ],
  [
    177,
    1
  ],
  [
    177,
    3
  ],
  [
    177,
    3
  ],
  [
    133,
    1
  ],
  [
    133,
    3
  ],
  [
    143,
    2
  ],
  [
    143,
    2
  ],
  [
    182,
    1
  ],
  [
    182,
    2
  ],
  [
    179,
    1
  ],
  [
    179,
    0
  ]
],
performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack) {
/* this == yyval */

var $0 = $$.length - 1;
switch (yystate) {
case 1 : 
/*! Production::     lex : init definitions '%%' rules_and_epilogue */
 
          this.$ = $$[$0];
          if ($$[$0-2][0]) this.$.macros = $$[$0-2][0];
          if ($$[$0-2][1]) this.$.startConditions = $$[$0-2][1];
          if ($$[$0-2][2]) this.$.unknownDecls = $$[$0-2][2];
          // if there are any options, add them all, otherwise set options to NULL:
          // can't check for 'empty object' by `if (yy.options) ...` so we do it this way:
          for (var k in yy.options) {
            this.$.options = yy.options;
            break;
          }
          if (yy.actionInclude) this.$.actionInclude = yy.actionInclude;
          delete yy.options;
          delete yy.actionInclude;
          return this.$;
         
break;
case 2 : 
/*! Production::     rules_and_epilogue : EOF */
 
        this.$ = { rules: [] };
       
break;
case 3 : 
/*! Production::     rules_and_epilogue : '%%' extra_lexer_module_code EOF */
 
        if ($$[$0-1] && $$[$0-1].trim() !== '') {
          this.$ = { rules: [], moduleInclude: $$[$0-1] };
        } else {
          this.$ = { rules: [] };
        }
       
break;
case 4 : 
/*! Production::     rules_and_epilogue : rules '%%' extra_lexer_module_code EOF */
 
        if ($$[$0-1] && $$[$0-1].trim() !== '') {
          this.$ = { rules: $$[$0-3], moduleInclude: $$[$0-1] };
        } else {
          this.$ = { rules: $$[$0-3] };
        }
       
break;
case 5 : 
/*! Production::     rules_and_epilogue : rules EOF */
 
        this.$ = { rules: $$[$0-1] };
       
break;
case 6 : 
/*! Production::     init :  */
 
            yy.actionInclude = '';
            if (!yy.options) yy.options = {};
         
break;
case 7 : 
/*! Production::     definitions : definition definitions */
 
          this.$ = $$[$0];
          if ($$[$0-1] != null) {
            if ('length' in $$[$0-1]) {
              this.$[0] = this.$[0] || {};
              this.$[0][$$[$0-1][0]] = $$[$0-1][1];
            } else if ($$[$0-1].type === 'names') {
              this.$[1] = this.$[1] || {};
              for (var name in $$[$0-1].names) {
                this.$[1][name] = $$[$0-1].names[name];
              }
            } else if ($$[$0-1].type === 'unknown') {
              this.$[2] = this.$[2] || [];
              this.$[2].push($$[$0-1].body);
            }
          }
         
break;
case 8 : 
/*! Production::     definitions :  */
  this.$ = [null, null];  
break;
case 9 : 
/*! Production::     definition : NAME regex */
  this.$ = [$$[$0-1], $$[$0]];  
break;
case 10 : 
/*! Production::     definition : START_INC names_inclusive */
 case 11 : 
/*! Production::     definition : START_EXC names_exclusive */
 case 24 : 
/*! Production::     action : ACTION */
 case 25 : 
/*! Production::     action : include_macro_code */
 case 26 : 
/*! Production::     action_body : action_comments_body */
 case 63 : 
/*! Production::     escape_char : ESCAPE_CHAR */
 case 64 : 
/*! Production::     range_regex : RANGE_REGEX */
 case 73 : 
/*! Production::     extra_lexer_module_code : optional_module_code_chunk */
 case 77 : 
/*! Production::     module_code_chunk : CODE */
 case 79 : 
/*! Production::     optional_module_code_chunk : module_code_chunk */
  this.$ = $$[$0];  
break;
case 12 : 
/*! Production::     definition : ACTION */
 case 13 : 
/*! Production::     definition : include_macro_code */
  yy.actionInclude += $$[$0]; this.$ = null;  
break;
case 14 : 
/*! Production::     definition : options */
  this.$ = null;  
break;
case 15 : 
/*! Production::     definition : UNKNOWN_DECL */
  this.$ = {type: 'unknown', body: $$[$0]};  
break;
case 16 : 
/*! Production::     names_inclusive : START_COND */
  this.$ = {type: 'names', names: {}}; this.$.names[$$[$0]] = 0;  
break;
case 17 : 
/*! Production::     names_inclusive : names_inclusive START_COND */
  this.$ = $$[$0-1]; this.$.names[$$[$0]] = 0;  
break;
case 18 : 
/*! Production::     names_exclusive : START_COND */
  this.$ = {type: 'names', names: {}}; this.$.names[$$[$0]] = 1;  
break;
case 19 : 
/*! Production::     names_exclusive : names_exclusive START_COND */
  this.$ = $$[$0-1]; this.$.names[$$[$0]] = 1;  
break;
case 20 : 
/*! Production::     rules : rules rule */
  this.$ = $$[$0-1]; this.$.push($$[$0]);  
break;
case 21 : 
/*! Production::     rules : rule */
 case 33 : 
/*! Production::     name_list : NAME */
  this.$ = [$$[$0]];  
break;
case 22 : 
/*! Production::     rule : start_conditions regex action */
  this.$ = $$[$0-2] ? [$$[$0-2], $$[$0-1], $$[$0]] : [$$[$0-1], $$[$0]];  
break;
case 23 : 
/*! Production::     action : '{' action_body '}' */
 case 30 : 
/*! Production::     start_conditions : '<' name_list '>' */
  this.$ = $$[$0-1];  
break;
case 27 : 
/*! Production::     action_body : action_body '{' action_body '}' action_comments_body */
  this.$ = $$[$0-4] + $$[$0-3] + $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 28 : 
/*! Production::     action_comments_body :  */
 case 39 : 
/*! Production::     regex_list :  */
 case 80 : 
/*! Production::     optional_module_code_chunk :  */
  this.$ = '';  
break;
case 29 : 
/*! Production::     action_comments_body : action_comments_body ACTION_BODY */
 case 40 : 
/*! Production::     regex_concat : regex_concat regex_base */
 case 50 : 
/*! Production::     regex_base : regex_base range_regex */
 case 59 : 
/*! Production::     regex_set : regex_set_atom regex_set */
 case 78 : 
/*! Production::     module_code_chunk : module_code_chunk CODE */
  this.$ = $$[$0-1] + $$[$0];  
break;
case 31 : 
/*! Production::     start_conditions : '<' '*' '>' */
  this.$ = ['*'];  
break;
case 34 : 
/*! Production::     name_list : name_list ',' NAME */
  this.$ = $$[$0-2]; this.$.push($$[$0]);  
break;
case 35 : 
/*! Production::     regex : regex_list */
 
          this.$ = $$[$0];
          if (yy.options && yy.options.easy_keyword_rules && this.$.match(/[\w\d]$/) && !this.$.match(/\\(r|f|n|t|v|s|b|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}|[0-7]{1,3})$/)) {
              this.$ += "\\b";
          }
         
break;
case 36 : 
/*! Production::     regex_list : regex_list '|' regex_concat */
  this.$ = $$[$0-2] + '|' + $$[$0];  
break;
case 37 : 
/*! Production::     regex_list : regex_list '|' */
  this.$ = $$[$0-1] + '|';  
break;
case 42 : 
/*! Production::     regex_base : '(' regex_list ')' */
  this.$ = '(' + $$[$0-1] + ')';  
break;
case 43 : 
/*! Production::     regex_base : SPECIAL_GROUP regex_list ')' */
  this.$ = $$[$0-2] + $$[$0-1] + ')';  
break;
case 44 : 
/*! Production::     regex_base : regex_base '+' */
  this.$ = $$[$0-1] + '+';  
break;
case 45 : 
/*! Production::     regex_base : regex_base '*' */
  this.$ = $$[$0-1] + '*';  
break;
case 46 : 
/*! Production::     regex_base : regex_base '?' */
  this.$ = $$[$0-1] + '?';  
break;
case 47 : 
/*! Production::     regex_base : '/' regex_base */
  this.$ = '(?=' + $$[$0] + ')';  
break;
case 48 : 
/*! Production::     regex_base : '/!' regex_base */
  this.$ = '(?!' + $$[$0] + ')';  
break;
case 52 : 
/*! Production::     regex_base : '.' */
  this.$ = '.';  
break;
case 53 : 
/*! Production::     regex_base : '^' */
  this.$ = '^';  
break;
case 54 : 
/*! Production::     regex_base : '$' */
  this.$ = '$';  
break;
case 58 : 
/*! Production::     any_group_regex : REGEX_SET_START regex_set REGEX_SET_END */
 case 74 : 
/*! Production::     extra_lexer_module_code : optional_module_code_chunk include_macro_code extra_lexer_module_code */
  this.$ = $$[$0-2] + $$[$0-1] + $$[$0];  
break;
case 62 : 
/*! Production::     regex_set_atom : name_expansion */
  this.$ = '{[' + $$[$0] + ']}';  
break;
case 65 : 
/*! Production::     string : STRING_LIT */
  this.$ = prepareString($$[$0].substr(1, $$[$0].length - 2));  
break;
case 70 : 
/*! Production::     option : NAME[option] */
  yy.options[$$[$0]] = true;  
break;
case 71 : 
/*! Production::     option : NAME[option] '=' OPTION_VALUE[value] */
 case 72 : 
/*! Production::     option : NAME[option] '=' NAME[value] */
  yy.options[$$[$0-2]] = $$[$0];  
break;
case 75 : 
/*! Production::     include_macro_code : INCLUDE PATH */
 
            var fs = require('fs');
            var fileContent = fs.readFileSync($$[$0], { encoding: 'utf-8' });
            // And no, we don't support nested '%include':
            this.$ = '\n// Included by Jison: ' + $$[$0] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + $$[$0] + '\n\n';
         
break;
case 76 : 
/*! Production::     include_macro_code : INCLUDE error */
 
            console.error("%include MUST be followed by a valid file path");
         
break;
}
},
table: [
  __expand__($V0, [
      2,
      6
    ], {127:1,128:2,180:[
      2,
      6
    ]
  }),
  {
    1: [
      3
    ]
  },
  {
    129: 3,
    130: [
      2,
      8
    ],
    135: 4,
    136: [
      1,
      5
    ],
    138: [
      1,
      6
    ],
    140: [
      1,
      7
    ],
    142: [
      1,
      8
    ],
    143: 9,
    144: 10,
    145: [
      1,
      11
    ],
    174: [
      1,
      13
    ],
    180: [
      1,
      12
    ]
  },
  {
    130: [
      1,
      14
    ]
  },
  {
    129: 15,
    130: [
      2,
      8
    ],
    135: 4,
    136: [
      1,
      5
    ],
    138: [
      1,
      6
    ],
    140: [
      1,
      7
    ],
    142: [
      1,
      8
    ],
    143: 9,
    144: 10,
    145: [
      1,
      11
    ],
    174: [
      1,
      13
    ],
    180: [
      1,
      12
    ]
  },
  __expand__([124,130,136,138,140,142,145,174], [
      2,
      39
    ], {137:16,154:17,155:18,156:19,159:24,161:25,162:29,163:30,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      39
    ]
  }),
  {
    139: 36,
    146: [
      1,
      37
    ]
  },
  {
    141: 38,
    146: [
      1,
      39
    ]
  },
  __expand__($V0, [
      2,
      12
    ], {180:[
      2,
      12
    ]
  }),
  __expand__($V0, [
      2,
      13
    ], {180:[
      2,
      13
    ]
  }),
  __expand__($V0, [
      2,
      14
    ], {180:[
      2,
      14
    ]
  }),
  __expand__($V0, [
      2,
      15
    ], {180:[
      2,
      15
    ]
  }),
  {
    2: [
      1,
      41
    ],
    181: [
      1,
      40
    ]
  },
  {
    136: [
      1,
      44
    ],
    175: 42,
    177: 43
  },
  __expand__($V1, [
      2,
      32
    ], {131:45,134:48,147:49,148:50,60:[
      1,
      51
    ],130:[
      1,
      47
    ],132:[
      1,
      46
    ],180:[
      2,
      32
    ]
  }),
  {
    130: [
      2,
      7
    ]
  },
  __expand__($V0, [
      2,
      9
    ], {180:[
      2,
      9
    ]
  }),
  __expand__([123,130,136,138,140,142,145,174], [
      2,
      35
    ], {124:[
      1,
      52
    ],180:[
      2,
      35
    ]
  }),
  __expand__($V2, [
      2,
      38
    ], {159:24,161:25,162:29,163:30,156:53,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      38
    ]
  }),
  __expand__($V3, [
      2,
      41
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      41
    ]
  }),
  __expand__($V4, [
      2,
      39
    ], {155:18,156:19,159:24,161:25,162:29,163:30,154:59,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ]
  }),
  __expand__($V4, [
      2,
      39
    ], {155:18,156:19,159:24,161:25,162:29,163:30,154:60,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ]
  }),
  {
    36: [
      1,
      28
    ],
    40: [
      1,
      20
    ],
    46: [
      1,
      26
    ],
    47: [
      1,
      22
    ],
    94: [
      1,
      27
    ],
    156: 61,
    157: [
      1,
      21
    ],
    158: [
      1,
      23
    ],
    159: 24,
    161: 25,
    162: 29,
    163: 30,
    164: [
      1,
      31
    ],
    165: [
      1,
      32
    ],
    170: [
      1,
      35
    ],
    172: [
      1,
      33
    ],
    173: [
      1,
      34
    ]
  },
  {
    36: [
      1,
      28
    ],
    40: [
      1,
      20
    ],
    46: [
      1,
      26
    ],
    47: [
      1,
      22
    ],
    94: [
      1,
      27
    ],
    156: 62,
    157: [
      1,
      21
    ],
    158: [
      1,
      23
    ],
    159: 24,
    161: 25,
    162: 29,
    163: 30,
    164: [
      1,
      31
    ],
    165: [
      1,
      32
    ],
    170: [
      1,
      35
    ],
    172: [
      1,
      33
    ],
    173: [
      1,
      34
    ]
  },
  __expand__($V5, [
      2,
      49
    ], {180:[
      2,
      49
    ]
  }),
  __expand__($V5, [
      2,
      51
    ], {180:[
      2,
      51
    ]
  }),
  __expand__($V5, [
      2,
      52
    ], {180:[
      2,
      52
    ]
  }),
  __expand__($V5, [
      2,
      53
    ], {180:[
      2,
      53
    ]
  }),
  __expand__($V5, [
      2,
      54
    ], {180:[
      2,
      54
    ]
  }),
  __expand__($V5, [
      2,
      55
    ], {180:[
      2,
      55
    ]
  }),
  __expand__($V5, [
      2,
      56
    ], {180:[
      2,
      56
    ]
  }),
  __expand__([36,40,41,42,43,46,47,63,94,123,124,130,136,138,140,142,145,157,158,164,165,167,169,170,171,172,173,174], [
      2,
      57
    ], {180:[
      2,
      57
    ]
  }),
  {
    159: 66,
    164: [
      1,
      31
    ],
    166: 63,
    168: 64,
    169: [
      1,
      65
    ]
  },
  __expand__($V5, [
      2,
      65
    ], {180:[
      2,
      65
    ]
  }),
  __expand__($V5, [
      2,
      66
    ], {180:[
      2,
      66
    ]
  }),
  __expand__($V5, [
      2,
      63
    ], {180:[
      2,
      63
    ]
  }),
  __expand__($V0, [
      2,
      10
    ], {146:[
      1,
      67
    ],180:[
      2,
      10
    ]
  }),
  __expand__($V6, [
      2,
      16
    ], {180:[
      2,
      16
    ]
  }),
  __expand__($V0, [
      2,
      11
    ], {146:[
      1,
      68
    ],180:[
      2,
      11
    ]
  }),
  __expand__($V6, [
      2,
      18
    ], {180:[
      2,
      18
    ]
  }),
  __expand__($V7, [
      2,
      75
    ], {183:[
      2,
      75
    ]
  }),
  __expand__($V7, [
      2,
      76
    ], {183:[
      2,
      76
    ]
  }),
  {
    176: [
      1,
      69
    ]
  },
  {
    136: [
      1,
      44
    ],
    175: 70,
    176: [
      2,
      69
    ],
    177: 43
  },
  {
    61: [
      1,
      71
    ],
    136: [
      2,
      70
    ],
    176: [
      2,
      70
    ]
  },
  {
    1: [
      2,
      1
    ]
  },
  {
    1: [
      2,
      2
    ]
  },
  __expand__($V8, [
      2,
      80
    ], {133:72,179:73,182:74,183:[
      1,
      75
    ]
  }),
  __expand__($V1, [
      2,
      32
    ], {148:50,147:78,60:[
      1,
      51
    ],130:[
      1,
      76
    ],132:[
      1,
      77
    ],180:[
      2,
      32
    ]
  }),
  __expand__($V9, [
      2,
      21
    ], {180:[
      2,
      21
    ]
  }),
  __expand__([123,124,142], [
      2,
      39
    ], {154:17,155:18,156:19,159:24,161:25,162:29,163:30,137:79,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      39
    ]
  }),
  {
    42: [
      1,
      81
    ],
    136: [
      1,
      82
    ],
    153: 80
  },
  __expand__($V2, [
      2,
      37
    ], {156:19,159:24,161:25,162:29,163:30,155:83,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      37
    ]
  }),
  __expand__($V3, [
      2,
      40
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      40
    ]
  }),
  __expand__($V5, [
      2,
      44
    ], {180:[
      2,
      44
    ]
  }),
  __expand__($V5, [
      2,
      45
    ], {180:[
      2,
      45
    ]
  }),
  __expand__($V5, [
      2,
      46
    ], {180:[
      2,
      46
    ]
  }),
  __expand__($V5, [
      2,
      50
    ], {180:[
      2,
      50
    ]
  }),
  __expand__($V5, [
      2,
      64
    ], {180:[
      2,
      64
    ]
  }),
  {
    41: [
      1,
      84
    ],
    124: [
      1,
      52
    ]
  },
  {
    41: [
      1,
      85
    ],
    124: [
      1,
      52
    ]
  },
  __expand__($V3, [
      2,
      47
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      47
    ]
  }),
  __expand__($V3, [
      2,
      48
    ], {160:57,42:[
      1,
      55
    ],43:[
      1,
      54
    ],63:[
      1,
      56
    ],171:[
      1,
      58
    ],180:[
      2,
      48
    ]
  }),
  {
    167: [
      1,
      86
    ]
  },
  {
    159: 66,
    164: [
      1,
      31
    ],
    166: 87,
    167: [
      2,
      60
    ],
    168: 64,
    169: [
      1,
      65
    ]
  },
  __expand__($Va, [
      2,
      61
    ], {169:[
      2,
      61
    ]
  }),
  __expand__($Va, [
      2,
      62
    ], {169:[
      2,
      62
    ]
  }),
  __expand__($V6, [
      2,
      17
    ], {180:[
      2,
      17
    ]
  }),
  __expand__($V6, [
      2,
      19
    ], {180:[
      2,
      19
    ]
  }),
  __expand__($V0, [
      2,
      67
    ], {180:[
      2,
      67
    ]
  }),
  {
    176: [
      2,
      68
    ]
  },
  {
    136: [
      1,
      89
    ],
    178: [
      1,
      88
    ]
  },
  {
    132: [
      1,
      90
    ]
  },
  {
    132: [
      2,
      73
    ],
    143: 91,
    180: [
      1,
      12
    ]
  },
  __expand__($V8, [
      2,
      79
    ], {183:[
      1,
      92
    ]
  }),
  __expand__($V8, [
      2,
      77
    ], {183:[
      2,
      77
    ]
  }),
  __expand__($V8, [
      2,
      80
    ], {179:73,182:74,133:93,183:[
      1,
      75
    ]
  }),
  {
    1: [
      2,
      5
    ]
  },
  __expand__($V9, [
      2,
      20
    ], {180:[
      2,
      20
    ]
  }),
  {
    123: [
      1,
      95
    ],
    142: [
      1,
      96
    ],
    143: 97,
    149: 94,
    180: [
      1,
      12
    ]
  },
  {
    44: [
      1,
      99
    ],
    62: [
      1,
      98
    ]
  },
  {
    62: [
      1,
      100
    ]
  },
  {
    44: [
      2,
      33
    ],
    62: [
      2,
      33
    ]
  },
  __expand__($V2, [
      2,
      36
    ], {159:24,161:25,162:29,163:30,156:53,36:[
      1,
      28
    ],40:[
      1,
      20
    ],46:[
      1,
      26
    ],47:[
      1,
      22
    ],94:[
      1,
      27
    ],157:[
      1,
      21
    ],158:[
      1,
      23
    ],164:[
      1,
      31
    ],165:[
      1,
      32
    ],170:[
      1,
      35
    ],172:[
      1,
      33
    ],173:[
      1,
      34
    ],180:[
      2,
      36
    ]
  }),
  __expand__($V5, [
      2,
      42
    ], {180:[
      2,
      42
    ]
  }),
  __expand__($V5, [
      2,
      43
    ], {180:[
      2,
      43
    ]
  }),
  __expand__($V5, [
      2,
      58
    ], {180:[
      2,
      58
    ]
  }),
  {
    167: [
      2,
      59
    ]
  },
  {
    136: [
      2,
      71
    ],
    176: [
      2,
      71
    ]
  },
  {
    136: [
      2,
      72
    ],
    176: [
      2,
      72
    ]
  },
  {
    1: [
      2,
      3
    ]
  },
  __expand__($V8, [
      2,
      80
    ], {179:73,182:74,133:101,183:[
      1,
      75
    ]
  }),
  __expand__($V8, [
      2,
      78
    ], {183:[
      2,
      78
    ]
  }),
  {
    132: [
      1,
      102
    ]
  },
  __expand__($V9, [
      2,
      22
    ], {180:[
      2,
      22
    ]
  }),
  __expand__($Vb, [
      2,
      28
    ], {150:103,151:104,152:[
      2,
      28
    ]
  }),
  __expand__($V9, [
      2,
      24
    ], {180:[
      2,
      24
    ]
  }),
  __expand__($V9, [
      2,
      25
    ], {180:[
      2,
      25
    ]
  }),
  __expand__($V1, [
      2,
      30
    ], {180:[
      2,
      30
    ]
  }),
  {
    136: [
      1,
      105
    ]
  },
  __expand__($V1, [
      2,
      31
    ], {180:[
      2,
      31
    ]
  }),
  {
    132: [
      2,
      74
    ]
  },
  {
    1: [
      2,
      4
    ]
  },
  {
    123: [
      1,
      107
    ],
    125: [
      1,
      106
    ]
  },
  __expand__($Vb, [
      2,
      26
    ], {152:[
      1,
      108
    ]
  }),
  {
    44: [
      2,
      34
    ],
    62: [
      2,
      34
    ]
  },
  __expand__($V9, [
      2,
      23
    ], {180:[
      2,
      23
    ]
  }),
  __expand__($Vb, [
      2,
      28
    ], {151:104,150:109,152:[
      2,
      28
    ]
  }),
  __expand__($Vb, [
      2,
      29
    ], {152:[
      2,
      29
    ]
  }),
  {
    123: [
      1,
      107
    ],
    125: [
      1,
      110
    ]
  },
  __expand__($Vb, [
      2,
      28
    ], {151:111,152:[
      2,
      28
    ]
  }),
  __expand__($Vb, [
      2,
      27
    ], {152:[
      1,
      108
    ]
  })
],
defaultActions: {
  15: [
    2,
    7
  ],
  45: [
    2,
    1
  ],
  46: [
    2,
    2
  ],
  70: [
    2,
    68
  ],
  77: [
    2,
    5
  ],
  87: [
    2,
    59
  ],
  90: [
    2,
    3
  ],
  101: [
    2,
    74
  ],
  102: [
    2,
    4
  ]
},
parseError: function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
},
parse: function parse(input) {
    var self = this,
        stack = [0],

        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,     // (only used when the grammar contains error recovery rules)
        TERROR = 2,
        EOF = 1;

    var args = lstack.slice.call(arguments, 1);

    //this.reductionCount = this.shiftCount = 0;

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState = {
      yy: {}
    };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        sharedState.yy[k] = this.yy[k];
      }
    }

    lexer.setInput(input, sharedState.yy);
    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;
    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);

    var ranges = lexer.options && lexer.options.ranges;

    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState.yy.parseError === 'function') {
        this.parseError = sharedState.yy.parseError;
    }

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    }

    var symbol;
    var preErrorSymbol = null;
    var state, action, a, r;
    var yyval = {};
    var p, len, this_production, lstack_begin, lstack_end, newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.call(this, sharedState.yy);
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.call(this, sharedState.yy);
    }

    // Return the rule stack depth where the nearest error rule can be found.
    // Return FALSE when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = stack.length - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state
            if ((TERROR.toString()) in table[state]) {
                return depth;
            }
            if (state === 0 || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
            }
            stack_probe -= 2; // popStack(1): [symbol, action]
            state = stack[stack_probe];
            ++depth;
        }
    }


    function collect_expected_token_set(state) {
        var tokenset = [];
        for (var p in table[state]) {
            if (p > TERROR) {
                if (self.terminal_descriptions_ && self.terminal_descriptions_[p]) {
                    tokenset.push(self.terminal_descriptions_[p]);
                }
                else if (self.terminals_[p]) {
                    tokenset.push("'" + self.terminals_[p] + "'");
                }
            }
        }
        return tokenset;
    }

    try {
        for (;;) {
            // retrieve state number from top of stack
            state = stack[stack.length - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = this.defaultActions[state];
            } else {
                if (symbol === null || typeof symbol === 'undefined') {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            // handle parse error
            if (typeof action === 'undefined' || !action.length || !action[0]) {
                var error_rule_depth;
                var errStr = '';

                if (!recovering) {
                    // first see if there's any chance at hitting an error recovery rule:
                    error_rule_depth = locateNearestErrorRecoveryRule(state);

                    // Report error
                    expected = collect_expected_token_set(state);
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                    } else {
                        errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' +
                                 (symbol === EOF ? 'end of input' :
                                  ("'" + (this.terminals_[symbol] || symbol) + "'"));
                    }
                    a = this.parseError(errStr, p = {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false),
                        state_stack: stack
                    });
                    if (!p.recoverable) {
                        retval = a;
                        break;
                    }
                } else if (preErrorSymbol !== EOF) {
                    error_rule_depth = locateNearestErrorRecoveryRule(state);
                }

                // just recovered from another error
                if (recovering === 3) {
                    if (symbol === EOF || preErrorSymbol === EOF) {
                        retval = this.parseError(errStr || 'Parsing halted while starting to recover from another error.', {
                            text: lexer.match,
                            token: this.terminals_[symbol] || symbol,
                            token_id: symbol,
                            line: lexer.yylineno,
                            loc: yyloc,
                            expected: expected,
                            recoverable: false,
                            state_stack: stack
                        });
                        break;
                    }

                    // discard current lookahead and grab another
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    symbol = lex();
                }

                // try to recover from error
                if (error_rule_depth === false) {
                    retval = this.parseError(errStr || 'Parsing halted. No suitable error recovery rule available.', {
                        text: lexer.match,
                        token: this.terminals_[symbol] || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: yyloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack
                    });
                    break;
                }
                popStack(error_rule_depth);

                preErrorSymbol = (symbol === TERROR ? null : symbol); // save the lookahead token
                symbol = TERROR;         // insert generic error symbol as new lookahead
                state = stack[stack.length - 1];
                action = table[state] && table[state][TERROR];
                recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
            }


            // this shouldn't happen, unless resolve defaults are off
            if (action[0] instanceof Array && action.length > 1) {
                retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                    text: lexer.match,
                    token: this.terminals_[symbol] || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: yyloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack
                });
                break;
            }

            switch (action[0]) {
            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution / no error
                    yyleng = lexer.yyleng;
                    yytext = lexer.yytext;
                    yylineno = lexer.yylineno;
                    yyloc = lexer.yylloc;
                    if (recovering > 0) {
                        recovering--;
                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                continue;

            case 2:
                // reduce
                //this.reductionCount++;

                this_production = this.productions_[action[1]];
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                // perform semantic action
                yyval.$ = vstack[vstack.length - len]; // default to $$ = $1
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
                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, action[1], vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                if (len) {
                    popStack(len);
                }

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
                continue;

            case 3:
                // accept
                retval = true;
                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.call(this, sharedState.yy, retval);
            if (typeof rv !== 'undefined') retval = rv;
        }
    }

    return retval;
}
};


function encodeRE (s) {
    return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1').replace(/\\\\u([a-fA-F0-9]{4})/g, '\\u$1');
}

function prepareString (s) {
    // unescape slashes
    s = s.replace(/\\\\/g, "\\");
    s = encodeRE(s);
    return s;
};


/* generated by jison-lex 0.3.4-112 */
var lexer = (function () {
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript
function JisonLexerError(msg, hash) {
    this.message = msg;
    this.hash = hash;
    var stacktrace = (new Error(msg)).stack;
    if (stacktrace) {
      this.stack = stacktrace;
    }
}
JisonLexerError.prototype = Object.create(Error.prototype);
JisonLexerError.prototype.constructor = JisonLexerError;
JisonLexerError.prototype.name = 'JisonLexerError';

var lexer = {

EOF:1,

ERROR:2,

parseError:function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },

// resets the lexer, sets new input
setInput:function (input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
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
input:function () {
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
unput:function (ch) {
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
more:function () {
        this._more = true;
        return this;
    },

// When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
reject:function () {
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
less:function (n) {
        this.unput(this.match.slice(n));
    },

// return (part of the) already matched input, i.e. for error messages
pastInput:function (maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

// return (part of the) upcoming input, i.e. for error messages
upcomingInput:function (maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

// return a string which displays the character position where the lexing error occurred, i.e. for error messages
showPosition:function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

// test the lexed token: return FALSE when not a match, otherwise return token
test_match:function (match, indexed_rule) {
        var token,
            lines,
            backup;

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

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
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
next:function () {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
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
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            clear.call(this);
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
lex:function lex() {
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

// activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },

// pop the previously active lexer condition state off the condition stack
popState:function popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

// produce the lexer rule set which is active for the currently active lexer condition state
_currentRules:function _currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

// return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
topState:function topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

// alias for begin(condition)
pushState:function pushState(condition) {
        this.begin(condition);
    },

// return the number of states currently on the stack
stateStackSize:function stateStackSize() {
        return this.conditionStack.length;
    },
options: {
  easy_keyword_rules: true,
  ranges: true
},
JisonLexerError: JisonLexerError,
performAction: function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {

var YYSTATE = YY_START;
switch($avoiding_name_collisions) {
case 2 : 
/*! Conditions:: action */ 
/*! Rule::       \/[^ /]*?['"{}'][^ ]*?\/ */ 
 return 152; // regexp with braces or quotes (and no spaces) 
break;
case 7 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++; return 123; 
break;
case 8 : 
/*! Conditions:: action */ 
/*! Rule::       \} */ 
 if (yy.depth == 0) { this.begin('trail'); } else { yy.depth--; } return 125; 
break;
case 10 : 
/*! Conditions:: conditions */ 
/*! Rule::       > */ 
 this.popState(); return 62; 
break;
case 13 : 
/*! Conditions:: rules */ 
/*! Rule::       {BR}+ */ 
 /* empty */ 
break;
case 14 : 
/*! Conditions:: rules */ 
/*! Rule::       \s+{BR}+ */ 
 /* empty */ 
break;
case 15 : 
/*! Conditions:: rules */ 
/*! Rule::       \s+ */ 
 this.begin('indented'); 
break;
case 16 : 
/*! Conditions:: rules */ 
/*! Rule::       %% */ 
 this.begin('code'); return 130; 
break;
case 17 : 
/*! Conditions:: rules */ 
/*! Rule::       [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,'""]+ */ 
 
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 173;
                                         
break;
case 20 : 
/*! Conditions:: options */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 178; 
break;
case 21 : 
/*! Conditions:: options */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length - 2); return 178; 
break;
case 23 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}+ */ 
 this.popState(); return 176; 
break;
case 24 : 
/*! Conditions:: options */ 
/*! Rule::       \s+{BR}+ */ 
 this.popState(); return 176; 
break;
case 25 : 
/*! Conditions:: options */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 27 : 
/*! Conditions:: start_condition */ 
/*! Rule::       {BR}+ */ 
 this.popState(); 
break;
case 28 : 
/*! Conditions:: start_condition */ 
/*! Rule::       \s+{BR}+ */ 
 this.popState(); 
break;
case 29 : 
/*! Conditions:: start_condition */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 30 : 
/*! Conditions:: trail */ 
/*! Rule::       \s*{BR}+ */ 
 this.begin('rules'); 
break;
case 31 : 
/*! Conditions:: indented */ 
/*! Rule::       \{ */ 
 yy.depth = 0; this.begin('action'); return 123; 
break;
case 32 : 
/*! Conditions:: indented */ 
/*! Rule::       %\{(.|{BR})*?%\} */ 
 this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 142; 
break;
case 33 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %\{(.|{BR})*?%\} */ 
 yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4); return 142; 
break;
case 34 : 
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
                                            return 180;
                                         
break;
case 35 : 
/*! Conditions:: indented */ 
/*! Rule::       .+ */ 
 this.begin('rules'); return 142; 
break;
case 36 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
 /* ignore */ 
break;
case 37 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/\/.* */ 
 /* ignore */ 
break;
case 38 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       {BR}+ */ 
 /* empty */ 
break;
case 39 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \s+ */ 
 /* empty */ 
break;
case 41 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       "(\\\\|\\"|[^"])*" */ 
 yy_.yytext = yy_.yytext.replace(/\\"/g,'"'); return 172; 
break;
case 42 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       '(\\\\|\\'|[^'])*' */ 
 yy_.yytext = yy_.yytext.replace(/\\'/g,"'"); return 172; 
break;
case 43 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \[ */ 
 this.pushState('set'); return 165; 
break;
case 56 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       < */ 
 this.begin('conditions'); return 60; 
break;
case 57 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/! */ 
 return 158;                    // treated as `(?!atom)` 
break;
case 58 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \/ */ 
 return 47;                     // treated as `(?=atom)` 
break;
case 60 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       \\. */ 
 yy_.yytext = yy_.yytext.replace(/^\\/g, ''); return 170; 
break;
case 63 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %options\b */ 
 this.begin('options'); return 174; 
break;
case 64 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %s\b */ 
 this.begin('start_condition'); return 138; 
break;
case 65 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %x\b */ 
 this.begin('start_condition'); return 140; 
break;
case 66 : 
/*! Conditions:: INITIAL trail code */ 
/*! Rule::       %include\b */ 
 this.pushState('path'); return 180; 
break;
case 67 : 
/*! Conditions:: INITIAL rules trail code */ 
/*! Rule::       %{NAME}[^\r\n]+ */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported lexer option: ', yy_.yytext + ' while lexing in ' + this.topState() + ' state:', this._input, ' /////// ', this.matched);
                                            return 145;
                                         
break;
case 68 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       %% */ 
 this.begin('rules'); return 130; 
break;
case 74 : 
/*! Conditions:: indented trail rules INITIAL */ 
/*! Rule::       . */ 
 throw new Error("unsupported input character: " + yy_.yytext + " @ " + JSON.stringify(yy_.yylloc)); /* b0rk on bad characters */ 
break;
case 78 : 
/*! Conditions:: set */ 
/*! Rule::       \] */ 
 this.popState('set'); return 167; 
break;
case 80 : 
/*! Conditions:: code */ 
/*! Rule::       [^\r\n]+ */ 
 return 183;      // the bit of CODE just before EOF... 
break;
case 81 : 
/*! Conditions:: path */ 
/*! Rule::       [\r\n] */ 
 this.popState(); this.unput(yy_.yytext); 
break;
case 82 : 
/*! Conditions:: path */ 
/*! Rule::       '[^\r\n]+' */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 181; 
break;
case 83 : 
/*! Conditions:: path */ 
/*! Rule::       "[^\r\n]+" */ 
 yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2); this.popState(); return 181; 
break;
case 84 : 
/*! Conditions:: path */ 
/*! Rule::       \s+ */ 
 // skip whitespace in the line 
break;
case 85 : 
/*! Conditions:: path */ 
/*! Rule::       [^\s\r\n]+ */ 
 this.popState(); return 181; 
break;
case 86 : 
/*! Conditions:: * */ 
/*! Rule::       . */ 
 
                                            /* ignore unrecognized decl */
                                            console.warn('ignoring unsupported lexer input: ', yy_.yytext, ' @ ' + JSON.stringify(yy_.yylloc) + 'while lexing in ' + this.topState() + ' state:', this._input, ' /////// ', this.matched);
                                         
break;
default:
  return this.simpleCaseActionClusters[$avoiding_name_collisions];
}
},
simpleCaseActionClusters: {

  /*! Conditions:: action */ 
  /*! Rule::       \/\*(.|\n|\r)*?\*\/ */ 
   0 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       \/\/.* */ 
   1 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       "(\\\\|\\"|[^"])*" */ 
   3 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       '(\\\\|\\'|[^'])*' */ 
   4 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       [/"'][^{}/"']+ */ 
   5 : 152,
  /*! Conditions:: action */ 
  /*! Rule::       [^{}/"']+ */ 
   6 : 152,
  /*! Conditions:: conditions */ 
  /*! Rule::       {NAME} */ 
   9 : 136,
  /*! Conditions:: conditions */ 
  /*! Rule::       , */ 
   11 : 44,
  /*! Conditions:: conditions */ 
  /*! Rule::       \* */ 
   12 : 42,
  /*! Conditions:: options */ 
  /*! Rule::       {NAME} */ 
   18 : 136,
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   19 : 61,
  /*! Conditions:: options */ 
  /*! Rule::       [^\s\r\n]+ */ 
   22 : 178,
  /*! Conditions:: start_condition */ 
  /*! Rule::       {ID} */ 
   26 : 146,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       {ID} */ 
   40 : 136,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \| */ 
   44 : 124,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \(\?: */ 
   45 : 157,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \(\?= */ 
   46 : 157,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \(\?! */ 
   47 : 157,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \( */ 
   48 : 40,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \) */ 
   49 : 41,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \+ */ 
   50 : 43,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \* */ 
   51 : 42,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \? */ 
   52 : 63,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \^ */ 
   53 : 94,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       , */ 
   54 : 44,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       <<EOF>> */ 
   55 : 36,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}) */ 
   59 : 170,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \$ */ 
   61 : 36,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \. */ 
   62 : 46,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \{\d+(,\s?\d+|,)?\} */ 
   69 : 171,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \{{ID}\} */ 
   70 : 164,
  /*! Conditions:: set options */ 
  /*! Rule::       \{{ID}\} */ 
   71 : 164,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \{ */ 
   72 : 123,
  /*! Conditions:: indented trail rules INITIAL */ 
  /*! Rule::       \} */ 
   73 : 125,
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   75 : 132,
  /*! Conditions:: set */ 
  /*! Rule::       (\\\\|\\\]|[^\]{])+ */ 
   76 : 169,
  /*! Conditions:: set */ 
  /*! Rule::       \{ */ 
   77 : 169,
  /*! Conditions:: code */ 
  /*! Rule::       [^\r\n]*(\r|\n)+ */ 
   79 : 183
},
rules: [
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:\/[^ \/]*?['"{}'][^ ]*?\/)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[\/"'][^{}\/"']+)/,
/^(?:[^{}\/"']+)/,
/^(?:\{)/,
/^(?:\})/,
/^(?:([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?))/,
/^(?:>)/,
/^(?:,)/,
/^(?:\*)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:%%)/,
/^(?:[^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,'""]+)/,
/^(?:([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?))/,
/^(?:=)/,
/^(?:"(\\\\|\\"|[^"])*")/,
/^(?:'(\\\\|\\'|[^'])*')/,
/^(?:[^\s\r\n]+)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:\s*(\r\n|\n|\r)+)/,
/^(?:\{)/,
/^(?:%\{(.|(\r\n|\n|\r))*?%\})/,
/^(?:%\{(.|(\r\n|\n|\r))*?%\})/,
/^(?:%include\b)/,
/^(?:.+)/,
/^(?:\/\*(.|\n|\r)*?\*\/)/,
/^(?:\/\/.*)/,
/^(?:(\r\n|\n|\r)+)/,
/^(?:\s+)/,
/^(?:([a-zA-Z_][a-zA-Z0-9_]*))/,
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
/^(?:\\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}))/,
/^(?:\\.)/,
/^(?:\$)/,
/^(?:\.)/,
/^(?:%options\b)/,
/^(?:%s\b)/,
/^(?:%x\b)/,
/^(?:%include\b)/,
/^(?:%([a-zA-Z_](?:[a-zA-Z0-9_-]*[a-zA-Z0-9_])?)[^\r\n]+)/,
/^(?:%%)/,
/^(?:\{\d+(,\s?\d+|,)?\})/,
/^(?:\{([a-zA-Z_][a-zA-Z0-9_]*)\})/,
/^(?:\{([a-zA-Z_][a-zA-Z0-9_]*)\})/,
/^(?:\{)/,
/^(?:\})/,
/^(?:.)/,
/^(?:$)/,
/^(?:(\\\\|\\\]|[^\]{])+)/,
/^(?:\{)/,
/^(?:\])/,
/^(?:[^\r\n]*(\r|\n)+)/,
/^(?:[^\r\n]+)/,
/^(?:[\r\n])/,
/^(?:'[^\r\n]+')/,
/^(?:"[^\r\n]+")/,
/^(?:\s+)/,
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
      26,
      27,
      28,
      29,
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
      25,
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
      30,
      33,
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
      33,
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
  "INITIAL": {
    rules: [
      33,
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

// lexer.JisonLexerError = JisonLexerError;
return lexer;
})();
parser.lexer = lexer;

function Parser () {
  this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;
// parser.JisonParserError = JisonParserError;

return new Parser();
})();




if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = lexParser;
exports.Parser = lexParser.Parser;
exports.parse = function () {
  return lexParser.parse.apply(lexParser, arguments);
};

}

},{"fs":13}],20:[function(require,module,exports){
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
},{"_process":21}],21:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
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
    var timeout = setTimeout(cleanUpNextTick);
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
    clearTimeout(timeout);
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
        setTimeout(drainQueue, 0);
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

},{}],22:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],23:[function(require,module,exports){
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
},{"./support/isBuffer":22,"_process":21,"inherits":18}],24:[function(require,module,exports){
module.exports={
  "author": {
    "name": "Zach Carter",
    "email": "zach@carter.name",
    "url": "http://zaa.ch"
  },
  "name": "jison",
  "description": "A parser generator with Bison's API",
  "version": "0.4.17-113",
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
    "node": ">=0.9"
  },
  "dependencies": {
    "jison-lex": "GerHobbelt/jison-lex#master",
    "ebnf-parser": "GerHobbelt/ebnf-parser#master",
    "lex-parser": "GerHobbelt/lex-parser#master",
    "nomnom": "GerHobbelt/nomnom#master",
    "cjson": ">=0.3.2"
  },
  "devDependencies": {
    "test": ">=0.6.0",
    "jison": "GerHobbelt/jison#master",
    "uglify-js": ">=2.6.1",
    "browserify": ">=12.0.1"
  },
  "scripts": {
    "test": "node tests/all-tests.js"
  },
  "homepage": "http://jison.org"
}

},{}]},{},[1]);
