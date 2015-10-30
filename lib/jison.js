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

    var symbols = this.symbols = [];

    // calculate precedence of operators
    var operators = this.operators = processOperators(grammar.operators);

    // build productions from cfg
    this.buildProductions(bnf, productions, nonterminals, symbols, operators);

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
    this.EOF = '$end';

    // augment the grammar
    var acceptProduction = new Production('$accept', [this.startSymbol, '$end'], 0);
    this.productions.unshift(acceptProduction);

    // prepend parser tokens
    this.symbols.unshift('$accept', this.EOF);
    this.symbols_.$accept = 0;
    this.symbols_[this.EOF] = 1;
    this.terminals.unshift(this.EOF);

    this.nonterminals.$accept = new Nonterminal('$accept');
    this.nonterminals.$accept.productions.push(acceptProduction);

    // add follow $ to start symbol
    this.nonterminals[this.startSymbol].follows.push(this.EOF);
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


generator.buildProductions = function buildProductions(bnf, productions, nonterminals, symbols, operators) {
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
    var symbolId = 1;
    var symbols_ = {};

    var her = false; // has error recovery

    // Strip off any insignificant whitespace from the user code to ensure that
    // otherwise identical actions are indeed matched up into a single actionGroup:
    function mkHashIndex(s) {
        return s.trim()
        .replace(/\r\n|\r/g, '\n')
        .replace(/\s+$/mg, '')          // strip any trailing whitespace for each line of action code
        .replace(/^\s+/mg, '');         // ditto for leading whitespace for each line: we don't care about more or less clean indenting practices in the user code
    }

    function addSymbol(s) {
        if (s && !symbols_[s]) {
            symbols_[s] = ++symbolId;
            symbols.push(s);
        }
    }

    // add error symbol; will be third symbol, or "2" ($accept, $end, error)
    addSymbol('error');

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

    var sym, terms = [], terms_ = {};
    each(symbols_, function (id, sym) {
        if (!nonterminals[sym]) {
            terms.push(sym);
            terms_[id] = sym;
        }
    });

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
        } else {
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
    Jison.print.call(null,args.join(''));
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
    // When the parser comes with its own `main` function, the use that one:
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
                        token_id,
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
