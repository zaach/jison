// Jison, an LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zach@carter.name>
// MIT X Licensed

var typal      = require('./util/typal').typal;
var Set        = require('./util/set').Set;
var Lexer      = require('./util/regexp-lexer.js');
var ebnfParser = require('./util/ebnf-parser.js');
var XRegExp    = require('xregexp');
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
    var ar = {};
    for (var k = a.length - 1; k >= 0; --k) {
        ar[a[k]] = true;
    }
    for (var i = b.length - 1; i >= 0; --i) {
        if (!ar[b[i]]) {
            a.push(b[i]);
        }
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

generator.constructor = function Jison_Generator(grammar, opt) {
    if (typeof grammar === 'string') {
        grammar = ebnfParser.parse(grammar);
    }

    var options = typal.camelMix.call({}, grammar.options, opt);

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

    this.DEBUG = this.options.debug || false;
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
                predefined_symbols = JSON.parse(source);
            } catch (ex) {
                if (devDebug) {
                    console.error('%import symbols JSON fail: ', ex);
                }
                try {
                    var m = /[\r\n]\s*symbols_:\s*(\{[\s\S]*?\}),\s*[\r\n]/.exec(source);
                    if (m && m[1]) {
                        source = m[1];
                        predefined_symbols = JSON.parse(source);
                    }
                } catch (ex) {
                    if (devDebug) {
                        console.error('%import symbols JISON output fail: ', ex);
                    }
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


generator.buildProductions = function buildProductions(bnf, productions, nonterminals, symbols, operators, predefined_symbols, descriptions) {
    var self = this;
    var actions = [
      '/* this == yyval */',
      this.actionInclude || '',
      'var $0 = $$.length - 1;',
      'switch (yystate) {'
    ];
    var actionGroups = {};          // used to combine identical actions into single instances: no use duplicating action code needlessly
    var actionGroupValue = {};      // stores the unaltered, expanded, user-defined action code for each action group.
    var prods, symbol;
    var productions_ = [];
    var symbols_ = {};
    var descriptions_ = {};
    var usedSymbolIds = [/* $accept = 0 */ true, /* $end = 1 */ true, /* error = 2 */ true];
    var usedSymbolIdsLowIndex = 127; // 127? 3?

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

    // Preprocess the action code block before we perform any `$n`, `@n` or `#n` expansions:
    // Any comment blocks in there should be kept intact (and not cause trouble either as those comments MAY
    // contain `$` or `#` prefixed bits which might look like references but aren't!)
    //
    // Note: 
    // We also replace '/*' comment markers which may (or may not) be lurking inside other comments.
    function preprocessActionCode(s) {
        function replace_markers(cmt) {
            cmt = cmt
            .replace(/#/g, '\x01')
            .replace(/\$/g, '\x02')
            .replace(/@/g, '\x03')
            .replace(/\/\*/g, '\x05')
            .replace(/\/\//g, '\x06');
            return cmt;
        }

        s = s
        // do not trim any NEWLINES in the action block:
        .replace(/^\s+/, '')
        .replace(/\s+$/, '')
        // unify CR/LF combo's:
        .replace(/\r\n|\r/g, '\n')
        // replace any '$' and '#' in any C++-style comment line:
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
        // the `//` in there and thus the `[^'"]` matching the terminating NL *before*
        // the `$` in the regex can get at it. Cave canem therefor!       |8-(
        .replace(/\/\/[^'"\n]+$/mg, function (_) {
            return replace_markers(_);
        })
        // now MARK all the /*...*/ comment blocks and process those!
        // (Here again we accept that we don't actually *parse* the action code and
        // permit to let some of these slip, i.e. comment blocks which trail
        // a line of code and contain string delimiter(s). :-( )
        .replace(/^(\s*)\/\*/mg, '$1\x04')
        .replace(/\/\*([^'"\n]*)$/mg, '\x04$1')
        // and find their END marker: first '*/' found wins!
        // (The `[^\0]` regex expression is a hack to ensure NEWLINES are matched
        // by that set as well, i.e. this way we can easily cross line boundaries
        // while searching for he end of the multiline comment we're trying to
        // dig out by regex matching. Also note that we employ non-aggressive
        // matching to ensure the regex matcher will find the FIRST occurrence of
        // `*/` and mark that as the end of the regex match!)
        .replace(/\x04[^\0]*?\*\//g, function (_) {
            return replace_markers(_);
        });
        return s;
    }

    // Postprocess the action code block after we perform any `$n`, `@n` or `#n` expansions:
    // revert the preprocessing!
    function postprocessActionCode(s) {
        s = s
        // multiline comment start markers:
        .replace(/\x04/g, '/*')
        .replace(/\x05/g, '/*')
        .replace(/\x06/g, '//')
        // revert markers:
        .replace(/\x01/g, '#')
        .replace(/\x02/g, '$')
        .replace(/\x03/g, '@');
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
        return symbols_[s] || false;
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
        if (devDebug) Jison.print('\ngenerator.buildProductions: ', symbol, JSON.stringify(prods, null, 2));

        prods.forEach(buildProduction);
    }
    for (var hash in actionGroups) {
        actions.push([].concat([].concat.apply([], actionGroups[hash]), actionGroupValue[hash], '\nbreak;').join(' '));
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

    var parameters = 'yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */, yystack';
    if (this.parseParams) parameters += ', ' + this.parseParams.join(', ');

    this.performAction = [].concat(
        'function anonymous(' + parameters + ') {',
        actions, 
        '}'
    ).join('\n')
    .replace(/YYABORT/g, 'return false')
    .replace(/YYACCEPT/g, 'return true');

    var actionsBaseline = [
        'function anonymous(' + parameters + ') {',
        '/* this == yyval */',
        '',
        'var $0 = $$.length - 1;',
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
    this.actionsUseValueTracking = analyzeFeatureUsage(this.performAction, /[^\w]\$\$[^\w]/g, 2);
    // Ditto for the specific case where we are assigning a value to `$$`:
    this.actionsUseValueAssignment = analyzeFeatureUsage(this.performAction, /\bthis\.\$[^\w]/g, 0);
    // Ditto for the expansion of `@name`, `@$` and `@n` to its `_$[n]` index expression:
    this.actionsUseLocationTracking = analyzeFeatureUsage(this.performAction, /\b_\$[^\w]/g, 1);
    // Ditto for the specific case where we are assigning a value to `@$`:
    this.actionsUseLocationAssignment = analyzeFeatureUsage(this.performAction, /\bthis\._\$[^\w]/g, 0);
    // Ditto for the expansion of `#name`, `#$` and `#n` to its `yystack[n]` index expression:
    // (Note that generally these #n constructs are expanded directly to their symbol number without 
    // the need to use yystack! Hence yystack is only there for very special use action code.)
    this.actionsUseYYSTACK = analyzeFeatureUsage(this.performAction, /\byystack\b/g, 1);

    if (devDebug) {
        Jison.print('Optimization analysis: ', {
            actionsAreAllDefault: this.actionsAreAllDefault,
            actionsUseYYLENG: this.actionsUseYYLENG,
            actionsUseYYLINENO: this.actionsUseYYLINENO,
            actionsUseYYTEXT: this.actionsUseYYTEXT,
            actionsUseParseError: this.actionsUseParseError,
            actionsUseYYERROR: this.actionsUseYYERROR,
            actionsUseYYERROK: this.actionsUseYYERROK,
            actionsUseYYCLEARIN: this.actionsUseYYCLEARIN,
            actionsUseValueTracking: this.actionsUseValueTracking,
            actionsUseValueAssignment: this.actionsUseValueAssignment,
            actionsUseLocationTracking: this.actionsUseLocationTracking,
            actionsUseLocationAssignment: this.actionsUseLocationAssignment,
            actionsUseYYSTACK: this.actionsUseYYSTACK,
            hasErrorRecovery: this.hasErrorRecovery
        });
    }
    
    this.performAction = this.performAction
    .replace(/\byyerror\b/g, 'yy.parser.parseError')
    .replace(/\byyerrok\b(?:\s*\(\s*\))?/g, 'yy.parser.yyErrOk()')
    .replace(/\byyclearin\b(?:\s*\(\s*\))?/g, 'yy.parser.yyClearIn()');

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
    function postprocessComment(str, check_for_epsilon) {
        if (Array.isArray(str)) {
            str = str.map(function (_) {
                return (check_for_epsilon && (_ === '' || _ == null)) ? 'ε' : _;
            }).join(' ');
        }
        if (check_for_epsilon && str === '') {
            str = 'ε';
        }
        str = str.replace(/\*\//g, '*\\/');         // destroy any inner `*/` comment terminator sequence.
        return str;
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
        // the VERY UNusual situation: `$-1`: refencing *parent* rules' values
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
                    'case', productions.length + 1, ':',
                    '\n/*! Production::    ', postprocessComment(symbol), ':'
                ].concat(postprocessComment(handle[0], true), '*/\n');
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
                        return ' /* ' + postprocessComment(sym) + ' */ ' + addSymbol(sym);
                    });

                // replace named semantic values ($nonterminal)
                if (action.match(new XRegExp("[$@#][\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*"))) {
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
                    action = action.replace(new XRegExp("\\$([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)", "g"), function (str, pl) {
                            return names[pl] ? '$' + names[pl] : str;
                        }).replace(new XRegExp("@([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)", "g"), function (str, pl) {
                            return names[pl] ? '@' + names[pl] : str;
                        }).replace(new XRegExp("#([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)", "g"), function (str, pl) {
                            return names[pl] ? '#' + names[pl] : str;
                        });
                }
                action = action
                    // replace references to $$ with this.$, and @$ with this._$
                    .replace(/([^'"])\$\$|^\$\$/g, '$1this.$').replace(/@[0$]/g, 'this._$')

                    // replace semantic value references ($n) with stack value (stack[n])
                    .replace(/\$(-?\d+)\b/g, function (_, n) {
                        return '$$[$0' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
                    })
                    // same as above for location references (@n)
                    .replace(/@(-?\d+)\b/g, function (_, n) {
                        return '_$[$0' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
                    })
                    // same as above for token ID references (#n)
                    .replace(/#(-?\d+)\b/g, function (_, n) {
                        var i = parseInt(n, 10) - 1;
                        if (!rhs[i]) {
                            throw new Error('invalid token location reference in action code for rule: "' + rule4msg + '" - location reference: "' + _ + '"');
                        }
                        var sym = String(rhs[i]);
                        return ' /* ' + postprocessComment(sym, true) + ' */ ' + addSymbol(rhs[i]);
                    });
                
                actionHash = mkHashIndex(action);

                action = postprocessActionCode(action);
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
                if (self.DEBUG) {
                    self.warn('Ambiguous rule precedence in grammar: picking the (highest) precedence from operator "' + winning_symbol + '" for rule "' + symbol + ': ' + handle[0] + '" which contains multiple operators with different precendences: {' + prec_symbols.join(', ') + '}');
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

    traceStates(this.trace, this.states);
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
            // only one action in state and it's a reduction
            defaults[k] = state[act];
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
        + ' *    yy: {}\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  Parser.prototype: {\n'
        + ' *    yy: {},\n'
        + ' *    EOF: 1,\n'
        + ' *    TERROR: 2,\n'
        + ' *\n'
        + ' *    trace: function(errorMessage, errorHash),\n'
        + ' *\n'
        + ' *    JisonParserError: function(msg, hash),\n'
        + ' *\n'
        + ' *    quoteName: function(name),\n'
        + ' *               Helper function which can be overridden by user code later on: put suitable\n'
        + ' *               quotes around literal IDs in a description string.\n'
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
        + ' *    performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$, yystack, ...),\n'
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
        + ' *    options: { ... parser %options ... },\n'
        + ' *\n'
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
        + ' *                  may be empty when we cannot easily produce such a set)\n'
        + ' *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule\n'
        + ' *                  available for this particular error)\n'
        + ' *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    value_stack: (array: the current parser LALR/LR internal `$$` value stack; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,\n'
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
 * Mixin for common LR/LL/*an* parser behavior
 */
var generatorMixin = {};

generatorMixin.generate = function parser_generate(opt) {
    opt = typal.camelMix.call({}, this.options, opt);
    this.options = opt;
    this.DEBUG = opt.debug || false;
    if (this.DEBUG && devDebug) {
        Jison.print('GENERATE::OPTIONS:\n', this.options);
    }
    var code = '';

    // check for illegal identifier
    if (!opt.moduleName || !opt.moduleName.match(/^[a-zA-Z_$][a-zA-Z0-9_$\.]*$/)) {
        if (opt.moduleName) {
            console.warn('WARNING: The specified moduleName "' + opt.moduleName + '" is illegal (only characters [a-zA-Z0-9_$] and "." dot are accepted); using the default moduleName "parser" instead.');
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
    case 'es':
        code = this.generateESModule(opt);
        break;
    default:
        code = this.generateCommonJSModule(opt);
        break;
    }

    return code;
};


generatorMixin.generateAMDModule = function generateAMDModule(opt) {
    opt = typal.camelMix.call({}, this.options, opt);
    this.options = opt;
    this.DEBUG = opt.debug || false;
    if (this.DEBUG && devDebug) {
        Jison.print('GENERATE-AMD::OPTIONS:\n', this.options);
    }
    var module = this.generateModule_();
    var out = [
        generateGenericHeaderComment(),
        '',
        'define(function (require) {',
        module.commonCode,
        '',
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

lrGeneratorMixin.generateESModule = function generateESModule(opt){
    opt = typal.camelMix.call({}, this.options, opt);
    this.options = opt;
    this.DEBUG = opt.debug || false;
    if (this.DEBUG && devDebug) {
        Jison.print('GENERATE-ES2015::OPTIONS:\n', this.options);
    }
    var module = this.generateModule_();
    var out = [
        generateGenericHeaderComment(),
        '',
        module.commonCode,
        '',
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
    out.push('function Parser() { this.yy = {} };');
    out.push('Parser.prototype = parser;');
    out.push('parser.Parser = Parser;');
    out.push('export {parser, Parser};');

    return out.join('\n') + '\n';
};


generatorMixin.generateCommonJSModule = function generateCommonJSModule(opt) {
    opt = typal.camelMix.call({}, this.options, opt);
    this.options = opt;
    this.DEBUG = opt.debug || false;
    if (this.DEBUG && devDebug) {
        Jison.print('GENERATE-CommonJS::OPTIONS:\n', this.options);
    }
    var moduleName = opt.moduleName || 'parser';
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
    opt = typal.camelMix.call({}, this.options, opt);
    this.options = opt;
    this.DEBUG = opt.debug || false;
    if (this.DEBUG && devDebug) {
        Jison.print('GENERATE-Module::OPTIONS:\n', this.options);
    }
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

        // remove:
        // 
        //     var yylineno = lexer.yylineno;
        //     ...

        parseFn = parseFn
        .replace(/, stack\b/g, '');
    }

    if (!info.actionsUseLocationTracking && !info.actionsUseLocationAssignment) {
        actionFn = actionFn
        .replace(/, _\$\s*\/\*\s*lstack\s*\*\//g, '');

        // remove:
        // 
        //    var ranges = lexer.options && lexer.options.ranges;
        //    ...
        //    if (typeof lexer.yylloc === 'undefined') {
        //        lexer.yylloc = {};
        //    }
        //    var yyloc = lexer.yylloc;
        //    lstack.push(yyloc);
        //    ...
        //        lstack.push(lexer.yylloc);
        //    ...
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
        .replace(/, lstack\b/g, '')
        .replace(/\s+if\b.*?\.yylloc\b.*?\{[^}]+\{\s*\}[^}]+\}[^;]+;/g, '\n\n\n\n\n')
        .replace(/\s+yyval\._\$\s*=\s*\{[^}]+\}[^\{\}]+\{[^}]+\}/g, '\n\n\n\n\n\n\n\n\n')
        .replace(/^\s*var\s+ranges\s+=\s+lexer\.options\s+.*$/gm, '')
        .replace(/^.*?\blstack\b.*$/gm, '')
        .replace(/^.*?\blstack_[a-z]+.*$/gm, '')
        .replace(/^.*?\byyloc\s*=.*?\.yylloc\b.*?$/gm, '');
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
        .replace(/\s+var yydebug = [^\0]+?self\.trace[^\0]+?}\n/g, '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n')
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
        .replace(/\s+if \(this\.yyErrOk === 1\) \{[^\0]+?}\n/g, '\n\n\n\n\n');
    }

    if (!info.actionsUseYYCLEARIN) {
        parseFn = parseFn
        .replace(/\s+if \(this\.yyClearIn === 1\) \{[^\0]+?}\n/g, '\n\n\n\n\n\n');
    }

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
        .replace(/\s+if[^a-z]+preErrorSymbol.*?\{\s*\/\/[^\n]+([\s\S]+?)\} else \{[\s\S]+?\}\n/g, '\n$1\n\n\n\n')
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

    var errorClassCode = this.generateErrorClass();

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

    function produceProductionsForDebugging(tbl, sym, options) {
        if (!options.outputDebugTables) {
            return undefined;
        }

        var prods = {};
        for (var nonterm in tbl) {
            var entry = tbl[nonterm];
            var id = sym[nonterm];
            var item_prods = {};
            var item_tbl = entry.productions._items;
            for (var i = 0, len = item_tbl.length; i < len; i++) {
                var p = item_tbl[i];
                var rulestr = p.handle.map(function (t) {
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
                    return t;
                }).join(' ');
                item_prods[p.id] = {
                    handle: rulestr,
                    first: [0],
                    follow: [0]
                };
            }
            prods[nonterm] = item_prods;
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
          _: 1,
          noMain: 1,
          compressTables: 1,
          outputDebugTables: 1,
          file: 1,
          outfile: 1,
          inputPath: 1,
          lexfile: 1,
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
    var descrLst = JSON.stringify(produceTerminalDescriptions(this.descriptions_, this.symbols_), null, 2);
    if (descrLst) {
        descrLst = descrLst.replace(/"([0-9]+)":/g, '$1:');
    }
    var rulesLst = JSON.stringify(produceProductionsForDebugging(this.nonterminals, this.symbols_, this.options), null, 2);
    if (rulesLst) {
        rulesLst = rulesLst.replace(/"([0-9]+)":/g, '$1:');
    }

    var moduleCode = '{\n';
    moduleCode += [
        'EOF: ' + parser.EOF,
        'TERROR: ' + parser.TERROR,
        'trace: ' + String(this.trace || parser.trace),
        'JisonParserError: JisonParserError',
        'yy: {}',
        'options: ' + produceOptions(this.options),
        'symbols_: ' + JSON.stringify(produceSymbolTable(this.symbols_), null, 2),
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
        'productions_: ' + tableCode.productionsCode,
        'performAction: ' + String(this.performAction),
        'table: ' + tableCode.tableCode,
        'defaultActions: ' + tableCode.defaultActionsCode,
        'parseError: ' + String(this.parseError || parser.parseError),
        'quoteName: ' + String(parser.quoteName),
        'describeSymbol: ' + String(parser.describeSymbol),
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
        moduleCode: moduleCode 
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
        // column: productions' shift size / action column
        var pop_col = [];
        // column: rule number for each slot ('rule'):
        var rule_col = []; 

        var i;
        var row_count = 0;
        for (i in table) {
            i = +i;
            var prod = table[i];
            row_count++;
            idx_col.push(i);

            len_col.push(prod.length);
            assert(prod.length <= 2);
            assert(prod.length > 0);
            // and the special knowledge about the defaultActions[] table:
            assert(prod.length === 2);
            pop_col.push(prod[0]);
            rule_col.push(prod[1]);
        }

        var def_arr = {
            'idx': idx_col,
            'len': len_col,
            'pop': pop_col,
            'rule': rule_col,
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
            generateColumn('pop', def_arr.pop) + ',',
            generateColumn('rule', def_arr.rule),
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
        var p = s.pop;
        var r = s.rule;
        for (var i = 0, l = d.length; i < l; i++) {
            var j = d[i];
            rv[j] = [
                p[i],
                r[i]
            ];
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

    if (!args[1]) {
        console.log('Usage: ' + args[0] + ' FILE');
        process.exit(1);
    }
    var source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');
    return exports.parser.parse(source);
}

// debug mixin for LR parser generators

function printAction(a, gen) {
    var s = a[0] == 1 ? 'shift token (then go to state ' + a[1] + ')' :
        a[0] == 2 ? 'reduce by rule: ' + gen.productions[a[1]] :
                    'accept';

    return s;
}

function traceStates(trace, states) {
    trace('Item sets\n------');

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
        traceStates(this.trace, states);
    }
};

var parser = typal.beget();

generatorMixin.createParser = function createParser() {
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

function parseError(str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new this.JisonParserError(str, hash);
    }
}

parser.parseError = lrGeneratorMixin.parseError = parseError;

// Helper function which can be overridden by user code later on: put suitable quotes around
// literal IDs in a description string.
parser.quoteName = function quoteName(id_str) {
    return '"' + id_str + '"';
};

parser.TERROR = 2;
parser.EOF = 1;

// Return a more-or-less human-readable description of the given symbol, when available,
// or the symbol itself, serving as its own 'description' for lack of something better to serve up.
// 
// Return NULL when the symbol is unknown to the parser.
parser.describeSymbol = function describeSymbol(symbol) {
    if (symbol !== this.EOF && this.terminal_descriptions_ && this.terminal_descriptions_[symbol]) {
        return this.terminal_descriptions_[symbol];
    } 
    else if (symbol === this.EOF) {
        return 'end of input';
    }
    else if (this.terminals_[symbol]) {
        return this.quoteName(this.terminals_[symbol]);
    }
    return null;
};

parser.parse = function parse(input) {
    var self = this,
        stack = [0],        // state stack: stores pairs of state (odd indexes) and token (even indexes)
        tstack = [],        // token stack (only used when `%options token_stack` support has been enabled)
        vstack = [null],    // semantic value stack
        lstack = [],        // location stack
        table = this.table;
    var recovering = 0;     // (only used when the grammar contains error recovery rules)
    var TERROR = this.TERROR,
        EOF = this.EOF;

    var args = stack.slice.call(arguments, 1);

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

    sharedState.yy.lexer = lexer;
    sharedState.yy.parser = this;

    var yydebug = false;
    if (this.options.debug) {
        yydebug = function yydebug_impl(msg, obj) {
            var ref_list;
            var ref_names;
            function deepClone(from, sub) {
                if (sub == null) { ref_list = []; ref_names = []; sub = 'root'; }
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
            obj.state_stack = stack;
            obj.value_stack = vstack;
            obj.location_stack = lstack;

            // ready the object for printing:
            obj = deepClone(obj);

            var js;
            try {
                js = JSON.stringify(obj, null, 2).replace(new XRegExp("  \"([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)\": ", "g"), '  $1: ').replace(/[\n\s]+/g, ' ');
            } catch (ex) {
                js = String(obj);
            }
            self.trace(msg, js, '\n');
        };
    }

    if (this.yyErrOk === 1) {
        this.yyErrOk = function yyErrOk() {
            recovering = 0;
        };
    }

    if (this.yyClearIn === 1) {
        this.yyClearIn = function yyClearIn() {
            preErrorSymbol = null;
            symbol = null;
            yytext = null;
        };
    }

    lexer.setInput(input, sharedState.yy);

    if (typeof lexer.yylloc === 'undefined') {
        lexer.yylloc = {};
    }
    var yyloc = lexer.yylloc;
    lstack.push(yyloc);
    
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
    }
    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState.yy.quoteName === 'function') {
        this.quoteName = sharedState.yy.quoteName;
    }

    function popStack(n) {
        if (yydebug) yydebug('popStack: ', { pop_size: n });
        if (!n) return;
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

    var symbol = null;
    var preErrorSymbol = null;
    var state, action, r;
    var yyval = {};
    var p, len, this_production;
    var lstack_begin, lstack_end;
    var newState;
    var expected = [];
    var retval = false;

    if (this.pre_parse) {
        this.pre_parse.apply(this, [sharedState.yy].concat(args));
    }
    if (sharedState.yy.pre_parse) {
        sharedState.yy.pre_parse.apply(this, [sharedState.yy].concat(args));
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
            var action = table[state][TERROR];
            if (action && action.length && action[0]) {
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 2) {
                return false; // No suitable error recovery rule available.
            }
            stack_probe -= 2; // popStack(1): [symbol, action]
            state = stack[stack_probe];
            ++depth;
        }
    }

_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

    // Produce a (more or less) human-readable list of expected tokens at the point of failure.
    // 
    // The produced list may contain token or token set descriptions instead of the tokens
    // themselves to help turning this output into something that easier to read by humans.
    // 
    // The returned list (array) will not contain any duplicate entries.
    function collect_expected_token_set(state) {
        var tokenset = [];
        var check = {};
        // Has this (error?) state been outfitted with a custom expectations description text for human consumption?
        // If so, use that one instead of the less palatable token set.
        if (self.state_descriptions_ && self.state_descriptions_[p]) {
            return [
                self.state_descriptions_[p]
            ];
        }
        for (var p in table[state]) {
            if (p !== TERROR) {
                var d = self.describeSymbol(p);
                if (d && !check[d]) {
                    tokenset.push(d);
                    check[d] = true;        // Mark this token description as already mentioned to prevent outputting duplicate entries.
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
                // The single `==` condition below covers both these `===` comparisons in a single
                // operation:
                // 
                //     if (symbol === null || typeof symbol === 'undefined') ...
                if (symbol == null) {
                    symbol = lex();
                }
                // read action for current state and first input
                action = table[state] && table[state][symbol];
            }

            if (yydebug) yydebug('after FETCH/LEX: ', { symbol: symbol });

_handle_error_with_recovery:                // run this code when the grammar includes error recovery rules

            // handle parse error
            if (!action || !action.length || !action[0]) {
                var error_rule_depth = 0;
                var errStr = null;

                if (!recovering) {
                    // first see if there's any chance at hitting an error recovery rule:
                    error_rule_depth = locateNearestErrorRecoveryRule(state);

                    // Report error
                    expected = collect_expected_token_set(state);
                    if (lexer.showPosition) {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition() + '\n';
                    } else {
                        errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                    }
                    if (expected.length) {
                        errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + (this.describeSymbol(symbol) || symbol);
                    } else {
                        errStr += 'Unexpected ' + (this.describeSymbol(symbol) || symbol);
                    }
                    r = this.parseError(errStr, p = {
                        text: lexer.match,
                        value: lexer.yytext,
                        token: this.describeSymbol(symbol) || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: lexer.yylloc,
                        expected: expected,
                        recoverable: (error_rule_depth !== false),
                        state_stack: stack,
                        value_stack: vstack,
                        location_stack: lstack,
                        lexer: lexer
                    });
                    if (yydebug) yydebug('error detected: ', { error_rule_depth: error_rule_depth });
                    if (!p.recoverable) {
                        retval = r;
                        break;
                    }
                } else if (preErrorSymbol !== EOF) {
                    error_rule_depth = locateNearestErrorRecoveryRule(state);
                }

                if (yydebug) yydebug('after ERROR DETECT: ', { error_rule_depth: error_rule_depth });

                // just recovered from another error
                if (recovering === 3) {
                    if (symbol === EOF || preErrorSymbol === EOF) {
                        retval = this.parseError(errStr || 'Parsing halted while starting to recover from another error.', {
                            text: lexer.match,
                            value: lexer.yytext,
                            token: this.describeSymbol(symbol) || symbol,
                            token_id: symbol,
                            line: lexer.yylineno,
                            loc: lexer.yylloc,
                            expected: expected,
                            recoverable: false,
                            state_stack: stack,
                            value_stack: vstack,
                            location_stack: lstack,
                            lexer: lexer
                        });
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
                if (error_rule_depth === false) {
                    retval = this.parseError(errStr || 'Parsing halted. No suitable error recovery rule available.', {
                        text: lexer.match,
                        value: lexer.yytext,
                        token: this.describeSymbol(symbol) || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: lexer.yylloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack,
                        value_stack: vstack,
                        location_stack: lstack,
                        lexer: lexer
                    });
                    break;
                }
                popStack(error_rule_depth);

                preErrorSymbol = (symbol === TERROR ? null : symbol); // save the lookahead token
                symbol = TERROR;            // insert generic error symbol as new lookahead
                recovering = 3;             // allow 3 real symbols to be shifted before reporting a new error

                if (yydebug) yydebug('after ERROR POP: ', { error_rule_depth: error_rule_depth, symbol: symbol });

                continue;
            }

_handle_error_no_recovery:                  // run this code when the grammar does not include any error recovery rules

            // handle parse error
            if (!action || !action.length || !action[0]) {
                var errStr;

                // Report error
                expected = collect_expected_token_set(state);
                if (lexer.showPosition) {
                    errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ':\n' + lexer.showPosition() + '\n';
                } else {
                    errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                }
                if (expected.length) {
                    errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + (this.describeSymbol(symbol) || symbol);
                } else {
                    errStr += 'Unexpected ' + (this.describeSymbol(symbol) || symbol);
                }
                // we cannot recover from the error!
                retval = this.parseError(errStr, {
                    text: lexer.match,
                    value: lexer.yytext,
                    token: this.describeSymbol(symbol) || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: lexer.yylloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack,
                    value_stack: vstack,
                    location_stack: lstack,
                    lexer: lexer
                });
                break;
            }

_handle_error_end_of_section:                  // this concludes the error recovery / no error recovery code section choice above

            if (yydebug) yydebug('::: action: ' + (action[0] === 1 ? 'shift token (then go to state ' + action[1] + ')' : action[0] === 2 ? 'reduce by rule: ' + action[1] : action[0] === 3 ? 'accept' : '???unexpected???'), { action: action, symbol: symbol });
            switch (action[0]) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action[0] instanceof Array) {
                    retval = this.parseError('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, {
                        text: lexer.match,
                        value: lexer.yytext,
                        token: this.describeSymbol(symbol) || symbol,
                        token_id: symbol,
                        line: lexer.yylineno,
                        loc: lexer.yylloc,
                        expected: expected,
                        recoverable: false,
                        state_stack: stack,
                        value_stack: vstack,
                        location_stack: lstack,
                        lexer: lexer
                    });
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                retval = this.parseError('Parsing halted. No viable error recovery approach available due to internal system failure.', {
                    text: lexer.match,
                    value: lexer.yytext,
                    token: this.describeSymbol(symbol) || symbol,
                    token_id: symbol,
                    line: lexer.yylineno,
                    loc: lexer.yylloc,
                    expected: expected,
                    recoverable: false,
                    state_stack: stack,
                    value_stack: vstack,
                    location_stack: lstack,
                    lexer: lexer
                });
                break;

            // shift:
            case 1: 
                //this.shiftCount++;
                stack.push(symbol);
                vstack.push(lexer.yytext);
                lstack.push(lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
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
                    // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                    if (yydebug) yydebug('... SHIFT:error recovery: ', { recovering: recovering, symbol: symbol });
                }
    
                continue;

            // reduce:
            case 2:
                //this.reductionCount++;
                newState = action[1];
                this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards... 
                len = this_production[1];
                lstack_end = lstack.length;
                lstack_begin = lstack_end - (len || 1);
                lstack_end--;

                if (yydebug) yydebug('~~~ REDUCE: ', { pop_size: len });

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

                r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, sharedState.yy, newState, vstack, lstack, stack].concat(args));

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                popStack(len);

                stack.push(this_production[0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                stack.push(newState);
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
        retval = this.parseError('Parsing aborted due to exception.', {
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,
            loc: lexer.yylloc,
            // expected: expected,
            recoverable: false,
            state_stack: stack,
            value_stack: vstack,
            location_stack: lstack,
            lexer: lexer
        });
    } finally {
        var rv;

        if (sharedState.yy.post_parse) {
            rv = sharedState.yy.post_parse.apply(this, [sharedState.yy, retval].concat(args));
            if (typeof rv !== 'undefined') retval = rv;
        }
        if (this.post_parse) {
            rv = this.post_parse.apply(this, [sharedState.yy, retval].concat(args));
            if (typeof rv !== 'undefined') retval = rv;
        }
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
        this.onDemandLookahead = options.onDemandLookahead || false;
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

        traceStates(this.trace, this.states);
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
            var treat_me = (this.onDemandLookahead ? this.inadequate : true);
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
var ll = generator.beget(lookaheadMixin, generatorMixin, {
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
    },

    parseTable: function llParseTable(productions) {
        var table = {},
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
    },

    // Generates the code of the parser module, which consists of two parts:
    // - module.commonCode: initialization code that should be placed before the module
    // - module.moduleCode: code that creates the module object
    generateModule_: function ll_GenerateModule_() {
        // var parseFn = String(parser.parse);
        // parseFn = pickErrorHandlingChunk(parseFn, this.hasErrorRecovery);

        // parseFn = addOrRemoveTokenStack(parseFn, this.options.tokenStack);

        // // always remove the feature markers in the template code.
        // parseFn = removeFeatureMarkers(parseFn);

        // parseFn = removeUnusedKernelFeatures(parseFn, this);

        // Generate code with fresh variable names
        nextVariableId = 0;
        // var tableCode = this.generateTableCode(this.table);

        // // Generate the initialization code
        // var commonCode = tableCode.commonCode;


        // Generate the module creation code
        var moduleCode = '{\n';
        moduleCode += [
            'trace: ' + String(this.trace),
            'JisonParserError: JisonParserError',
            'yy: {}',
            'self: ' + JSON.stringify(this, null, 2)
            ].join(',\n');
        moduleCode += '\n};';

        return { 
            commonCode: (new Array(100)).join('commonCode\n'), 
            moduleCode: moduleCode 
        };
    }
});

var LLGenerator = exports.LLGenerator = ll.construct();

Jison.Generator = function Jison_Generator(g, options) {
    var opt = typal.camelMix.call({}, g.options, options);
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

return function Parser(g, options) {
    var gen = Jison.Generator(g, options);
    return gen.createParser();
};

})();
