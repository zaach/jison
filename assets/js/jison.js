var require = (function() {
var require = (function () {
    var modules = {};
    var factories = {};
    var r = function(id) {
        if (!modules[id]) {
        console.log(id);
            modules[id] = {};
            factories[id](r, modules[id], { id : id });
        }
        return modules[id];
    };
    r.def = function(id, params) {
        console.log('def', id);
        factories[id] = params.factory;
    };
    return r;
})()
require.def("jison",{factory:function(require,exports,module){
// Jison, an LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zach@carter.name>
// MIT X Licensed

var typal = require("jison/util/typal").typal,
    Set = require("jison/util/set").Set,
    RegExpLexer = require("jison/lexer").RegExpLexer;

var Jison = exports.Jison = exports;

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
        var str = this.symbol+"\n";
        str += (this.nullable ? 'nullable' : 'not nullable');
        str += "\nFirsts: "+this.first.join(', ');
        str += "\nFollows: "+this.first.join(', ');
        str += "\nProductions:\n  "+this.productions.join('\n  ');

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
        return this.symbol+" -> "+this.handle.join(' ');
    }
});

var generator = typal.beget();

generator.constructor = function Jison_Generator (grammar, opt) {
    if (typeof grammar === 'string') {
        grammar = require("jison/bnf").parse(grammar);
    }

    var options = typal.mix.call({}, grammar.options, opt);
    this.terms = {};
    this.operators = {};
    this.productions = [];
    this.conflicts = 0;
    this.resolutions = [];
    this.options = options;
    this.yy = {}; // accessed as yy free variable in the parser/lexer actions

    // source included in semantic action execution scope
    if (grammar.actionInclude) {
        if (typeof grammar.actionInclude === 'function') {
            grammar.actionInclude = String(grammar.actionInclude).replace(/^\s*function \(\) \{/, '').replace(/\}\s*$/, '');
        }
        this.actionInclude = grammar.actionInclude;
    }

    this.DEBUG = options.debug || false;
    if (this.DEBUG) this.mix(generatorDebug); // mixin debug methods

    this.processGrammar(grammar);

    if (grammar.lex) {
        this.lexer = new RegExpLexer(grammar.lex, null, this.terminals_);
    }
};

generator.processGrammar = function processGrammarDef (grammar) {
    var bnf = grammar.bnf,
        tokens = grammar.tokens,
        nonterminals = this.nonterminals = {},
        productions = this.productions,
        self = this;

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
    this.buildProductions(grammar.bnf, productions, nonterminals, symbols, operators);

    if (tokens && this.terminals.length !== tokens.length) {
        self.trace("Warning: declared tokens differ from tokens found in rules.");
        self.trace(this.terminals);
        self.trace(tokens);
    }

    // augment the grammar
    this.augmentGrammar(grammar);
};

generator.augmentGrammar = function augmentGrammar (grammar) {
    // use specified start symbol, or default to first user defined production
    this.startSymbol = grammar.start || grammar.startSymbol || this.productions[0].symbol;
    if (!this.nonterminals[this.startSymbol]) {
        throw new Error("Grammar error: startSymbol must be a non-terminal found in your grammar.");
    }
    this.EOF = "$end";

    // augment the grammar
    var acceptProduction = new Production('$accept', [this.startSymbol, '$end'], 0);
    this.productions.unshift(acceptProduction);

    // prepend parser tokens
    this.symbols.unshift("$accept",this.EOF);
    this.symbols_["$accept"] = 0;
    this.symbols_[this.EOF] = 1;
    this.terminals.unshift(this.EOF);

    this.nonterminals["$accept"] = new Nonterminal("$accept");
    this.nonterminals["$accept"].productions.push(acceptProduction);

    // add follow $ to start symbol
    this.nonterminals[this.startSymbol].follows.push(this.EOF);
};

// set precedence and associativity of operators
function processOperators (ops) {
    if (!ops) return {};
    var operators = {};
    for (var i=0,k,prec;prec=ops[i]; i++) {
        for (k=1;k < prec.length;k++) {
            operators[prec[k]] = {precedence: i+1, assoc: prec[0]};
        }
    }
    return operators;
}


generator.buildProductions = function buildProductions(bnf, productions, nonterminals, symbols, operators) {
    var actions = [
      this.actionInclude || '',
      'var $0 = $$.length - 1;',
      'switch (yystate) {'
    ];
    var prods, symbol;
    var productions_ = [0];
    var symbolId = 1;
    var symbols_ = {};

    var her = false; // has error recovery

    function addSymbol (s) {
        if (s && !symbols_[s]) {
            symbols_[s] = ++symbolId;
            symbols.push(s);
        }
    }

    // add error symbol; will be third symbol, or "2" ($accept, $end, error)
    addSymbol("error");

    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        addSymbol(symbol);
        nonterminals[symbol] = new Nonterminal(symbol);

        if (typeof bnf[symbol] === 'string') {
            prods = bnf[symbol].split(/\s*\|\s*/g);
        } else {
            prods = bnf[symbol].slice(0);
        }

        prods.forEach(function buildProds_forEach (handle) {
            var r, rhs, i;
            if (handle.constructor === Array) {
                if (typeof handle[0] === 'string')
                    rhs = handle[0].trim().split(' ');
                else
                    rhs = handle[0].slice(0);

                for (i=0; her = her || rhs[i] === 'error',i<rhs.length; i++) if (!symbols_[rhs[i]]) {
                    addSymbol(rhs[i]);
                }

                if (typeof handle[1] === 'string' || handle.length == 3) {
                    // semantic action specified
                    var action = 'case '+(productions.length+1)+':'+handle[1]+'\nbreak;';

                    // replace named semantic values ($nonterminal)
                    if (action.match(/[$@][a-zA-Z][a-zA-Z0-9_]*/)) {
                        var count = {},
                            names = {};
                        for (i=0;i<rhs.length;i++) {
                            if (names[rhs[i]]) {
                                names[rhs[i]+(++count[rhs[i]])] = i+1;
                            } else {
                                names[rhs[i]] = i+1;
                                names[rhs[i]+"1"] = i+1;
                                count[rhs[i]] = 1;
                            }
                        }
                        action = action.replace(/\$([a-zA-Z][a-zA-Z0-9_]*)/g, function (str, pl) {
                                return names[pl] ? '$'+names[pl] : pl;
                            }).replace(/@([a-zA-Z][a-zA-Z0-9_]*)/g, function (str, pl) {
                                return names[pl] ? '@'+names[pl] : pl;
                            });
                    }
                    action = action.replace(/\$[0$]/g, "this.$").replace(/@[0$]/g, "this._$")
                        .replace(/\$(\d+)/g, function (_, n) {
                            return "$$[$0" + (n - rhs.length || '') + "]";
                        })
                        .replace(/@(\d+)/g, function (_, n) {
                            return "_$[$0" + (n - rhs.length || '') + "]";
                        });
                    actions.push(action);

                    r = new Production(symbol, rhs, productions.length+1);
                    // precedence specified also
                    if (handle[2] && operators[handle[2].prec]) {
                        r.precedence = operators[handle[2].prec].precedence;
                    }
                } else {
                    // only precedence specified
                    r = new Production(symbol, rhs, productions.length+1);
                    if (operators[handle[1].prec]) {
                        r.precedence = operators[handle[1].prec].precedence;
                    }
                }
            } else {
                rhs = handle.trim().split(' ');
                for (i=0; her = her || rhs[i] === 'error',i<rhs.length; i++) if (!symbols_[rhs[i]]) {
                    addSymbol(rhs[i]);
                }
                r = new Production(symbol, rhs, productions.length+1);
            }
            if (r.precedence === 0) {
                // set precedence
                for (i=r.handle.length-1; i>=0; i--) {
                    if (!(r.handle[i] in nonterminals) && r.handle[i] in operators) {
                        r.precedence = operators[r.handle[i]].precedence;
                    }
                }
            }

            productions.push(r);
            productions_.push([symbols_[r.symbol], r.handle[0] === '' ? 0 : r.handle.length]);
            nonterminals[symbol].productions.push(r);
        });
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
    this.performAction = Function("yytext,yyleng,yylineno,yy,yystate,$$,_$", actions.join("\n"));
};

generator.createParser = function createParser () {
    throw new Error('Calling abstract method.');
};

// noop. implemented in debug mixin
generator.trace = function trace () { };

generator.warn = function warn () {
    var args = Array.prototype.slice.call(arguments,0);
    Jison.print.call(null,args.join(""));
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
        this.trace("Processing grammar.");
    },
    afteraugmentGrammar: function () {
        var trace = this.trace;
        each(this.symbols, function (sym, i) {
            trace(sym+"("+i+")");
        });
    }
};



/*
 * Mixin for common behaviors of lookahead parsers
 * */
var lookaheadMixin = {};

lookaheadMixin.computeLookaheads = function computeLookaheads () {
    if (this.DEBUG) this.mix(lookaheadDebug); // mixin debug methods

    this.computeLookaheads = function () {};
    this.nullableSets();
    this.firstSets();
    this.followSets();
};

// calculate follow sets typald on first and nullable
lookaheadMixin.followSets = function followSets () {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true;

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        productions.forEach(function Follow_prod_forEach (production, k) {
            //self.trace(production.symbol,nonterminals[production.symbol].follows);
            // q is used in Simple LALR algorithm determine follows in context
            var q;
            var ctx = !!self.go_;

            var set = [],oldcount;
            for (var i=0,t;t=production.handle[i];++i) {
                if (!nonterminals[t]) continue;

                // for Simple LALR algorithm, self.go_ checks if
                if (ctx)
                    q = self.go_(production.symbol, production.handle.slice(0, i));
                var bool = !ctx || q === parseInt(self.nterms_[t]);

                if (i === production.handle.length+1 && bool) {
                    set = nonterminals[production.symbol].follows
                } else {
                    var part = production.handle.slice(i+1);

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
        for (var i=0,t;t=symbol[i];++i) {
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
    while(cont) {
        cont = false;

        productions.forEach(function FirstSets_forEach (production, k) {
            var firsts = self.first(production.handle);
            if (firsts.length !== production.first.length) {
                production.first = firsts;
                cont=true;
            }
        });

        for (symbol in nonterminals) {
            firsts = [];
            nonterminals[symbol].productions.forEach(function (production) {
                Set.union(firsts, production.first);
            });
            if (firsts.length !== nonterminals[symbol].first.length) {
                nonterminals[symbol].first = firsts;
                cont=true;
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
    while(cont) {
        cont = false;

        // check if each production is nullable
        this.productions.forEach(function (production, k) {
            if (!production.nullable) {
                for (var i=0,n=0,t;t=production.handle[i];++i) {
                    if (self.nullable(t)) n++;
                }
                if (n===i) { // production is nullable if all tokens are nullable
                    production.nullable = cont = true;
                }
            }
        });

        //check if each symbol is nullable
        for (var symbol in nonterminals) {
            if (!this.nullable(symbol)) {
                for (var i=0,production;production=nonterminals[symbol].productions.item(i);i++) {
                    if (production.nullable)
                        nonterminals[symbol].nullable = cont = true;
                }
            }
        }
    }
};

// check if a token or series of tokens is nullable
lookaheadMixin.nullable = function nullable (symbol) {
    // epsilon
    if (symbol === '') {
        return true
    // RHS
    } else if (symbol instanceof Array) {
        for (var i=0,t;t=symbol[i];++i) {
            if (!this.nullable(t))
                return false;
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
        this.trace("Computing Nullable sets.");
    },
    beforefirstSets: function () {
        this.trace("Computing First sets.");
    },
    beforefollowSets: function () {
        this.trace("Computing Follow sets.");
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
 * */
var lrGeneratorMixin = {};

lrGeneratorMixin.buildTable = function buildTable () {
    if (this.DEBUG) this.mix(lrGeneratorDebug); // mixin debug methods

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
        this.id = parseInt(production.id+'a'+this.dotPosition, 36);
        this.markedSymbol = this.production.handle[this.dotPosition];
    },
    remainingHandle: function () {
        return this.production.handle.slice(this.dotPosition+1);
    },
    eq: function (e) {
        return e.id === this.id;
    },
    toString: function () {
        var temp = this.production.handle.slice(0);
        temp[this.dotPosition] = '.'+(temp[this.dotPosition]||'');
        return '['+this.production.symbol+" -> "+temp.join(' ')
            +(this.follows.length === 0 ? "" : ", "+this.follows.join('/'))
            +']';
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
        for (var i=this._items.length-1;i >=0;i--) {
            this.hash_[this._items[i].id] = true; //i;
        }
    },
    concat: function concat (set) {
        var a = set._items || set;
        for (var i=a.length-1;i >=0;i--) {
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
        var v = this._items.map(function (a) {return a.id}).sort().join('|');
        return (this.valueOf = function toValue_inner() {return v;})();
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
            if(!syms[symbol]) {
                self.nonterminals[symbol].productions.forEach(function CO_nt_forEach (production) {
                    var newItem = new self.Item(production, 0);
                    if(!closureSet.contains(newItem))
                        itemQueue.push(newItem);
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
            gotoSet.push(new self.Item(item.production, item.dotPosition+1, item.follows, n));
        }
    });

    return gotoSet.isEmpty() ? gotoSet : this.closureOperation(gotoSet);
};

/* Create unique set of item sets
 * */
lrGeneratorMixin.canonicalCollection = function canonicalCollection () {
    var item1 = new this.Item(this.productions[0], 0, new Set(this.EOF));
    var firstState = this.closureOperation(new this.ItemSet(item1)),
        states = new Set(firstState),
        marked = 0,
        self = this,
        itemSet;

    states.has = {};
    states.has[firstState] = 0;

    while (marked !== states.size()) {
        itemSet = states.item(marked); marked++;
        itemSet.forEach(function CC_itemSet_forEach (item) {
            if (item.markedSymbol && item.markedSymbol !== self.EOF)
                self.canonicalCollectionInsert(item.markedSymbol, itemSet, states, marked-1);
        });
    }

    return states;
};

// Pushes a unique state into the que. Some parsing algorithms may perform additional operations
lrGeneratorMixin.canonicalCollectionInsert = function canonicalCollectionInsert (symbol, itemSet, states, stateNum) {
    var g = this.gotoOperation(itemSet, symbol);
    if (!g.predecessors)
        g.predecessors = {};
    // add g to que if not empty or duplicate
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
                        //self.trace(k, stackSymbol, 'g'+gotoState);
                        state[self.symbols_[stackSymbol]] = gotoState;
                    } else {
                        //self.trace(k, stackSymbol, 's'+gotoState);
                        state[self.symbols_[stackSymbol]] = [s,gotoState];
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
                    var sol = resolveConflict(item.production, op, [r,item.production.id], action[0] instanceof Array ? action[0] : action);
                    self.resolutions.push([k,stackSymbol,sol]);
                    if (sol.bydefault) {
                        self.conflicts++;
                        if (!self.DEBUG) {
                            self.warn('Conflict in grammar (state:',k, ', token:',stackSymbol, ")\n  ", printAction(sol.r, self), "\n  ", printAction(sol.s, self));
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
                    action = [r,item.production.id];
                }
                if (action && action.length) {
                    state[self.symbols_[stackSymbol]] = action;
                } else if (action === NONASSOC) {
                    state[self.symbols_[stackSymbol]] = undefined;
                }
            });
        });

    });

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
        sln.msg = "Resolve R/R conflict (use first production declared in grammar.)";
        sln.action = shift[1] < reduce[1] ? shift : reduce;
        sln.bydefault = true;
        return sln;
    }

    if (production.precedence === 0 || !op) {
        sln.msg = "Resolve S/R conflict (shift by default.)";
        sln.bydefault = true;
        sln.action = shift;
    } else if (production.precedence < op.precedence ) {
        sln.msg = "Resolve S/R conflict (shift for higher precedent operator.)";
        sln.action = shift;
    } else if (production.precedence === op.precedence) {
        if (op.assoc === "right" ) {
            sln.msg = "Resolve S/R conflict (shift for right associative operator.)";
            sln.action = shift;
        } else if (op.assoc === "left" ) {
            sln.msg = "Resolve S/R conflict (reduce for left associative operator.)";
            sln.action = reduce;
        } else if (op.assoc === "nonassoc" ) {
            sln.msg = "Resolve S/R conflict (no action for non-associative operator.)";
            sln.action = NONASSOC;
        }
    } else {
        sln.msg = "Resolve conflict (reduce for higher precedent production.)";
        sln.action = reduce;
    }

    return sln;
}

lrGeneratorMixin.generate = function parser_generate (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var code = "";
    switch (opt.moduleType) {
        case "js":
            code = this.generateModule(opt);
        break;
        case "commonjs":
        default:
            code = this.generateCommonJSModule(opt);
    }

    return code;
};

lrGeneratorMixin.generateCommonJSModule = function generateCommonJSModule (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var moduleName = opt.moduleName || "parser";
    var out = this.generateModule(opt)
        + "\nif (typeof require !== 'undefined' && typeof exports !== 'undefined') {"
        + "\nexports.parser = "+moduleName+";"
        + "\nexports.parse = function () { return "+moduleName+".parse.apply("+moduleName+", arguments); }"
        + "\nexports.main = "+ String(opt.moduleMain || commonjsMain)
        + "\nif (typeof module !== 'undefined' && require.main === module) {\n"
        + "  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require(\"system\").args);\n}"
        + "\n}"

    return out;
};

lrGeneratorMixin.generateModule = function generateModule (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var moduleName = opt.moduleName || "parser";
    var out = "/* Jison generated parser */\n";
    out += (moduleName.match(/\./) ? moduleName : "var "+moduleName)+" = (function(){";
    out += "\nvar parser = "+this.generateModule_();
    if (this.lexer && this.lexer.generateModule) {
        out += this.lexer.generateModule();
        out += "\nparser.lexer = lexer;";
    }
    out += "\nreturn parser;\n})();";

    return out;
};

lrGeneratorMixin.generateModule_ = function generateModule_ () {
    var out = "{";
    out += [
        "trace: " + String(this.trace || parser.trace),
        "yy: {}",
        "symbols_: " + JSON.stringify(this.symbols_),
        "terminals_: " + JSON.stringify(this.terminals_).replace(/"([0-9]+)":/g,"$1:"),
        "productions_: " + JSON.stringify(this.productions_),
        "performAction: " + String(this.performAction),
        "table: " + JSON.stringify(this.table).replace(/"([0-9]+)":/g,"$1:"),
        "defaultActions: " + JSON.stringify(this.defaultActions).replace(/"([0-9]+)":/g,"$1:"),
        "parseError: " + String(this.parseError || (this.hasErrorRecovery ? traceParseError : parser.parseError)),
        "parse: " + String(parser.parse)
        ].join(",\n");
    out += "};";

    return out;
};

// default main method for generated commonjs modules
function commonjsMain (args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require("fs").readFileSync(require("path").join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}

// debug mixin for LR parser generators

function printAction (a, gen) {
    var s = a[0] == 1 ? 'shift '+(gen.symbols[a[1]] || a[1]) :
        a[0] == 2 ? 'reduce by '+gen.productions[a[1]] :
                    'accept' ;

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
                    self.warn('Conflict at state:',r[0], ', Token:',r[1], "\n  ", printAction(r[2].r, self), "\n  ", printAction(r[2].s, self));
                }
            });
            this.trace("\n"+this.conflicts+" Conflict(s) found in grammar.");
        }
        this.trace("Done.");
    },
    aftercanonicalCollection: function (states) {
        var trace = this.trace;
        trace("\nItem sets\n------");

        states.forEach(function (state, i) {
            trace("\nitem set",i,"\n"+state.join("\n"), '\ntransitions -> ', JSON.stringify(state.edges));
        });
    }
};

var parser = typal.beget();

lrGeneratorMixin.createParser = function createParser () {
    var p = parser.beget();
    p.yy = {};

    p.init({
        table: this.table,
        defaultActions: this.defaultActions,
        productions_: this.productions_,
        symbols_: this.symbols_,
        terminals_: this.terminals_,
        performAction: this.performAction
    });

    // don't throw if grammar recovers from errors
    if (this.hasErrorRecovery) {
        p.parseError = traceParseError;
    }

    // for debugging
    p.productions = this.productions;

    // backwards compatability
    p.generate = this.generate;
    p.lexer = this.lexer;
    p.generateModule = this.generateModule;
    p.generateCommonJSModule = this.generateCommonJSModule;
    p.generateModule_ = this.generateModule_;

    return p;
};

parser.trace = generator.trace;
parser.warn = generator.warn;
parser.error = generator.error;

function traceParseError (err, hash) {
    this.trace(err);
}

parser.parseError = lrGeneratorMixin.parseError = function parseError (str, hash) {
    throw new Error(str);
};

parser.parse = function parse (input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
};

parser.init = function parser_init (dict) {
    this.table = dict.table;
    this.defaultActions = dict.defaultActions;
    this.performAction = dict.performAction;
    this.productions_ = dict.productions_;
    this.symbols_ = dict.symbols_;
    this.terminals_ = dict.terminals_;
};

/*
 * LR(0) Parser
 * */

var lr0 = generator.beget(lookaheadMixin, lrGeneratorMixin, {
    type: "LR(0)",
    afterconstructor: function lr0_afterconstructor () {
        this.buildTable();
    }
});

var LR0Generator = exports.LR0Generator = lr0.construct();

/*
 * Simple LALR(1)
 * */

var lalr = generator.beget(lookaheadMixin, lrGeneratorMixin, {
    type: "LALR(1)",

    afterconstructor: function (grammar, options) {
        if (this.DEBUG) this.mix(lrGeneratorDebug, lalrGeneratorDebug); // mixin debug methods

        options = options || {};
        this.states = this.canonicalCollection();
        this.terms_ = {};

        var newg = this.newg = typal.beget(lookaheadMixin,{
            oldg: this,
            trace: this.trace,
            nterms_: {},
            DEBUG: false,
            go_: function (r, B) {
                r = r.split(":")[0]; // grab state #
                B = B.map(function (b) { return b.slice(b.indexOf(":")+1)});
                return this.oldg.go(r, B);
            }
        });
        newg.nonterminals = {};
        newg.productions = [];

        this.inadequateStates = [];

        // if true, only lookaheads in inadequate states are computed (faster, larger table)
        // if false, lookaheads for all reductions will be computed (slower, smaller table)
        this.onDemandLookahead = options.onDemandLookahead || false;

        this.buildNewGrammar();
        newg.computeLookaheads();
        this.unionLookaheads();

        this.table = this.parseTable(this.states);
        this.defaultActions = findDefaults(this.table);
    },

    lookAheads: function LALR_lookaheads (state, item) {
        return (!!this.onDemandLookahead && !state.inadequate) ? this.terminals : item.follows;
    },
    go: function LALR_go (p, w) {
        var q = parseInt(p);
        for (var i=0;i<w.length;i++) {
            q = this.states.item(q).edges[w[i]] || q;
        }
        return q;
    },
    goPath: function LALR_goPath (p, w) {
        var q = parseInt(p),t,
            path = [];
        for (var i=0;i<w.length;i++) {
            t = w[i] ? q+":"+w[i] : '';
            if (t) this.newg.nterms_[t] = q;
            path.push(t);
            q = this.states.item(q).edges[w[i]] || q;
            this.terms_[t] = w[i];
        }
        return {path: path, endState: q};
    },
    // every disjoint reduction of a nonterminal becomes a produciton in G'
    buildNewGrammar: function LALR_buildNewGrammar () {
        var self = this,
            newg = this.newg;

        this.states.forEach(function (state, i) {
            state.forEach(function (item) {
                if (item.dotPosition === 0) {
                    // new symbols are a combination of state and transition symbol
                    var symbol = i+":"+item.production.symbol;
                    self.terms_[symbol] = item.production.symbol;
                    newg.nterms_[symbol] = i;
                    if (!newg.nonterminals[symbol])
                        newg.nonterminals[symbol] = new Nonterminal(symbol);
                    var pathInfo = self.goPath(i, item.production.handle);
                    var p = new Production(symbol, pathInfo.path, newg.productions.length);
                    newg.productions.push(p);
                    newg.nonterminals[symbol].productions.push(p);

                    // store the transition that get's 'backed up to' after reduction on path
                    var handle = item.production.handle.join(' ');
                    var goes = self.states.item(pathInfo.endState).goes;
                    if (!goes[handle])
                        goes[handle] = [];
                    goes[handle].push(symbol);

                    //self.trace('new production:',p);
                }
            });
            if (state.inadequate)
                self.inadequateStates.push(i);
        });
    },
    unionLookaheads: function LALR_unionLookaheads () {
        var self = this,
            newg = this.newg,
            states = !!this.onDemandLookahead ? this.inadequateStates : this.states;

        states.forEach(function union_states_forEach (i) {
            var state = typeof i === 'number' ? self.states.item(i) : i,
                follows = [];
            if (state.reductions.length)
            state.reductions.forEach(function union_reduction_forEach (item) {
                var follows = {};
                for (var k=0;k<item.follows.length;k++) {
                    follows[item.follows[k]] = true;
                }
                state.goes[item.production.handle.join(' ')].forEach(function reduction_goes_forEach (symbol) {
                    newg.nonterminals[symbol].follows.forEach(function goes_follows_forEach (symbol) {
                        var terminal = self.terms_[symbol];
                        if (!follows[terminal]) {
                            follows[terminal]=true;
                            item.follows.push(terminal);
                        }
                    });
                });
                //self.trace('unioned item', item);
            });
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
        this.trace(this.states.size()+" states.");
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
 * */
var lrLookaheadGenerator = generator.beget(lookaheadMixin, lrGeneratorMixin, {
    afterconstructor: function lr_aftercontructor () {
        this.computeLookaheads();
        this.buildTable();
    }
});

/*
 * SLR Parser
 * */
var SLRGenerator = exports.SLRGenerator = lrLookaheadGenerator.construct({
    type: "SLR(1)",

    lookAheads: function SLR_lookAhead (state, item) {
        return this.nonterminals[item.production.symbol].follows;
    }
});


/*
 * LR(1) Parser
 * */
var lr1 = lrLookaheadGenerator.beget({
    type: "Canonical LR(1)",

    lookAheads: function LR_lookAheads (state, item) {
        return item.follows;
    },
    Item: lrGeneratorMixin.Item.prototype.construct({
        afterconstructor: function () {
            this.id = this.production.id+'a'+this.dotPosition+'a'+this.follows.sort().join(',');
        },
        eq: function (e) {
            return e.id === this.id;
        }
    }),

    closureOperation: function LR_ClosureOperation (itemSet /*, closureSet*/) {
        var closureSet = new this.ItemSet();
        var self = this;

        var set = itemSet,
            itemQueue, syms = {};

        do {
        itemQueue = new Set();
        closureSet.concat(set);
        set.forEach(function (item) {
            var symbol = item.markedSymbol;
            var b;

            // if token is a nonterminal, recursively add closures
            if (symbol && self.nonterminals[symbol]) {
                b = self.first(item.remainingHandle());
                if (b.length === 0) b = item.follows;
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
 * */
var ll = generator.beget(lookaheadMixin, {
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
    }
});

var LLGenerator = exports.LLGenerator = ll.construct();

Jison.Generator = function Jison_Generator (g, options) {
    var opt = typal.mix.call({}, g.options, options);
    switch (opt.type) {
        case 'lr0':
            return new LR0Generator(g, opt);
        case 'slr':
            return new SLRGenerator(g, opt);
        case 'lr':
            return new LR1Generator(g, opt);
        case 'll':
            return new LLGenerator(g, opt);
        case 'lalr':
        default:
            return new LALRGenerator(g, opt);
    }
}

return function Parser (g, options) {
        var opt = typal.mix.call({}, g.options, options);
        var gen;
        switch (opt.type) {
            case 'lr0':
                gen = new LR0Generator(g, opt);
                break;
            case 'slr':
                gen = new SLRGenerator(g, opt);
                break;
            case 'lr':
                gen = new LR1Generator(g, opt);
                break;
            case 'll':
                gen = new LLGenerator(g, opt);
                break;
            case 'lalr':
            default:
                gen = new LALRGenerator(g, opt);
        }
        return gen.createParser();
    }

})();


//*/
},requires:["jison/util/typal","jison/util/set","jison/lexer","jison/bnf","fs","path","file","file"]});

require.def("jison/lexer",{factory:function(require,exports,module){
// Basic RegExp Lexer 
// MIT Licensed
// Zachary Carter <zach@carter.name>

var RegExpLexer = (function () {

// expand macros and convert matchers to RegExp's
function prepareRules(rules, macros, actions, tokens, startConditions) {
    var m,i,k,action,conditions,
        newRules = [];

    if (macros) {
        macros = prepareMacros(macros);
    }

    actions.push('switch($avoiding_name_collisions) {');

    for (i=0;i < rules.length; i++) {
        if (Object.prototype.toString.apply(rules[i][0]) !== '[object Array]') {
            // implicit add to all inclusive start conditions
            for (k in startConditions) {
                if (startConditions[k].inclusive) {
                    startConditions[k].rules.push(i);
                }
            }
        } else if (rules[i][0][0] === '*') {
            // Add to ALL start conditions
            for (k in startConditions) {
                startConditions[k].rules.push(i);
            }
            rules[i].shift();
        } else {
            // Add to explicit start conditions
            conditions = rules[i].shift();
            for (k=0;k<conditions.length;k++) {
                startConditions[conditions[k]].rules.push(i);
            }
        }

        m = rules[i][0];
        for (k in macros) {
            if (macros.hasOwnProperty(k) && typeof m === 'string') {
                m = m.split("{"+k+"}").join(macros[k]);
            }
        }
        if (typeof m === 'string') {
            m = new RegExp("^"+m);
        }
        newRules.push(m);
        if (typeof rules[i][1] === 'function') {
            rules[i][1] = String(rules[i][1]).replace(/^\s*function \(\)\s?\{/, '').replace(/\}\s*$/, '');
        }
        action = rules[i][1];
        if (tokens && action.match(/return '[^']+'/)) {
            action = action.replace(/return '([^']+)'/, function (str, pl) {
                        return "return "+(tokens[pl] ? tokens[pl] : "'"+pl+"'");
                    });
        }
        actions.push('case '+i+':' +action+'\nbreak;');
    }
    actions.push("}");

    return newRules;
}

// expand macros within macros
function prepareMacros (macros) {
    var cont = true,
        m,i,k,mnew;
    while (cont) {
        cont = false;
        for (i in macros) if (macros.hasOwnProperty(i)) {
            m = macros[i];
            for (k in macros) if (macros.hasOwnProperty(k) && i !== k) {
                mnew = m.split("{"+k+"}").join(macros[k]);
                if (mnew !== m) {
                    cont = true;
                    macros[i] = mnew;
                }
            }
        }
    }
    return macros;
}

// expand macros within macros
function prepareStartConditions (conditions) {
    var sc,
        hash = {};
    for (sc in conditions) if (conditions.hasOwnProperty(sc)) {
        hash[sc] = {rules:[],inclusive:!!!conditions[sc]};
    }
    return hash;
}

function buildActions (dict, tokens) {
    var actions = [dict.actionInclude || '', "var YYSTATE=YY_START"];
    var tok;
    var toks = {};

    for (tok in tokens) {
        toks[tokens[tok]] = tok;
    }

    this.rules = prepareRules(dict.rules, dict.macros, actions, tokens && toks, this.conditions);
    var fun = actions.join("\n");
    "yytext yyleng yylineno".split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp("("+yy+")", "g"), "yy_.$1");
    });

    return Function("yy,yy_,$avoiding_name_collisions,YY_START", fun);
}

function RegExpLexer (dict, input, tokens) {
    if (typeof dict === 'string') {
        dict = require("jison/jisonlex").parse(dict);
    }
    dict = dict || {};
    this.conditions = prepareStartConditions(dict.startConditions);
    this.conditions['INITIAL'] = {rules:[],inclusive:true};

    this.performAction = buildActions.call(this, dict, tokens);
    this.conditionStack = ['INITIAL'];

    this.yy = {};
    if (input) {
        this.setInput(input);
    }
}

RegExpLexer.prototype = {
    EOF: 1,
    parseError: function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

    // resets the lexer, sets new input 
    setInput: function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
    // consumes and returns one char from the input
    input: function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
    // unshifts one char into the input
    unput: function (ch) {
        this._input = ch + this._input;
        return this;
    },
    // When called from action, caches matched text and appends it on next action
    more: function () {
        this._more = true;
        return this;
    },
    // displays upcoming input, i.e. for error messages
    pastInput: function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
    // displays upcoming input, i.e. for error messages
    upcomingInput: function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
    // displays upcoming input, i.e. for error messages
    showPosition: function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },

    // return next match in input
    next: function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match.length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },

    // return next match that has a token
    lex: function lex () {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
    begin: function begin (condition) {
        this.conditionStack.push(condition);
    },
    popState: function popState () {
        return this.conditionStack.pop();
    },
    _currentRules: function _currentRules () {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },

    generate:  function generate(opt) {
        var code = "";
        if (opt.commonjs)
            code = this.generateCommonJSModule(opt);
        else
            code = this.generateModule(opt);

        return code;
    },
    generateModule: function generateModule(opt) {
        opt = opt || {};
        var out = "/* Jison generated lexer */",
            moduleName = opt.moduleName || "lexer";
        out += "\nvar "+moduleName+" = (function(){var lexer = ({";
        var p = [];
        for (var k in RegExpLexer.prototype)
            if (RegExpLexer.prototype.hasOwnProperty(k) && k.indexOf("generate") === -1)
            p.push(k + ":" + (RegExpLexer.prototype[k].toString() || '""'));
        out += p.join(",\n");
        out += "})";
        out += ";\nlexer.performAction = "+String(this.performAction);
        out += ";\nlexer.rules = [" + this.rules + "]";
        out += ";\nlexer.conditions = " + JSON.stringify(this.conditions);
        out += ";return lexer;})()";
        return out;
    },
    generateCommonJSModule: function generateCommonJSModule(opt) {
        opt = opt || {};
        var out = "/* Jison generated lexer as commonjs module */",
            moduleName = opt.moduleName || "lexer";
        out += this.generateModule(opt);
        out += "\nexports.lexer = "+moduleName;
        out += ";\nexports.lex = function () { return "+moduleName+".lex.apply(lexer, arguments); };";
        return out;
    }
};

return RegExpLexer;

})()

if (typeof exports !== 'undefined') 
    exports.RegExpLexer = RegExpLexer;


//*/
},requires:["jison/jisonlex"]});

require.def("jison/bnf",{factory:function(require,exports,module){
var bnf = require("jison/util/bnf-parser").parser,
    jisonlex = require("jison/jisonlex");

exports.parse = function parse () { return bnf.parse.apply(bnf, arguments) };

// adds a declaration to the grammar
bnf.yy.addDeclaration = function (grammar, decl) {
    if (decl.start) {
        grammar.start = decl.start;
    }
    else if (decl.lex) {
        grammar.lex = parseLex(decl.lex);
    }
    else if (decl.operator) {
        if (!grammar.operators) {
            grammar.operators = [];
        }
        grammar.operators.push(decl.operator);
    }

};

// helps tokenize comments
bnf.yy.lexComment = function (lexer) {
    var ch = lexer.input();
    if (ch === '/') {
        lexer.yytext = lexer.yytext.replace(/\*(.|\s)\/\*/, '*$1');
        return;
    } else {
        lexer.unput('/*');
        lexer.more();
    }
}

// parse an embedded lex section
var parseLex = function (text) {
    return jisonlex.parse(text.replace(/(?:^%lex)|(?:\/lex$)/g, ''));
}


//*/
},requires:["jison/util/bnf-parser","jison/jisonlex"]});

require.def("jison/jisonlex",{factory:function(require,exports,module){
var jisonlex = require("jison/util/lex-parser").parser;

var parse_ = jisonlex.parse;
jisonlex.parse = exports.parse = function parse () {
    jisonlex.yy.ruleSection = false;
    return parse_.apply(jisonlex, arguments);
};

function encodeRE (s) { return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'); }

jisonlex.yy = {
    prepareString: function (s) {
        // unescape slashes
        s = s.replace(/\\\\/g, "\\");
        s = encodeRE(s);
        return s;
    }
};

//*/
},requires:["jison/util/lex-parser"]});

require.def("jison/util/set",{factory:function(require,exports,module){
// Set class to wrap arrays

var typal = require("jison/util/typal").typal;

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
        };
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


//*/
},requires:["jison/util/typal"]});

require.def("jison/util/typal",{factory:function(require,exports,module){
/*
 * Introduces a typal object to make classical/prototypal patterns easier
 * Plus some AOP sugar
 *
 * By Zachary Carter <zach@carter.name>
 * MIT Licensed
 * */

var typal = (function () {

var create = Object.create || function (o) { function F(){}; F.prototype = o; return new F(); };
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
        }
    } else if (pos === 'before') {
        this[key] = function () {
            fun.apply(this, arguments); 
            var ret = prop.apply(this, arguments); 
            return ret;
        }
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
    // extend object with own typalperties of each argument
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

//*/
},requires:[]});

require.def("jison/util/bnf-parser",{factory:function(require,exports,module){
/* Jison generated parser */
var bnf = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"spec":3,"declaration_list":4,"%%":5,"grammar":6,"EOF":7,"declaration":8,"START":9,"id":10,"LEX_BLOCK":11,"operator":12,"associativity":13,"token_list":14,"LEFT":15,"RIGHT":16,"NONASSOC":17,"symbol":18,"production_list":19,"production":20,":":21,"handle_list":22,";":23,"|":24,"handle_action":25,"handle":26,"prec":27,"action":28,"PREC":29,"STRING":30,"ID":31,"ACTION":32,"$accept":0,"$end":1},
terminals_: {2:"error",5:"%%",7:"EOF",9:"START",11:"LEX_BLOCK",15:"LEFT",16:"RIGHT",17:"NONASSOC",21:":",23:";",24:"|",29:"PREC",30:"STRING",31:"ID",32:"ACTION"},
productions_: [0,[3,4],[3,5],[4,2],[4,0],[8,2],[8,1],[8,1],[12,2],[13,1],[13,1],[13,1],[14,2],[14,1],[6,1],[19,2],[19,1],[20,4],[22,3],[22,1],[25,3],[26,2],[26,0],[27,2],[27,0],[18,1],[18,1],[10,1],[28,1],[28,0]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = $$[$0-3]; this.$.bnf = $$[$0-1]; return this.$;
break;
case 2:this.$ = $$[$0-4]; this.$.bnf = $$[$0-2]; return this.$;
break;
case 3:this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);
break;
case 4:this.$ = {};
break;
case 5:this.$ = {start: $$[$0]};
break;
case 6:this.$ = {lex: $$[$0]};
break;
case 7:this.$ = {operator: $$[$0]};
break;
case 8:this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);
break;
case 9:this.$ = 'left';
break;
case 10:this.$ = 'right';
break;
case 11:this.$ = 'nonassoc';
break;
case 12:this.$ = $$[$0-1]; this.$.push($$[$0]);
break;
case 13:this.$ = [$$[$0]];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = $$[$0-1];
          if($$[$0][0] in this.$) this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
          else  this.$[$$[$0][0]] = $$[$0][1];
break;
case 16:this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];
break;
case 17:this.$ = [$$[$0-3], $$[$0-1]];
break;
case 18:this.$ = $$[$0-2]; this.$.push($$[$0]);
break;
case 19:this.$ = [$$[$0]];
break;
case 20:this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if($$[$0]) this.$.push($$[$0]);
            if($$[$0-1]) this.$.push($$[$0-1]);
            if (this.$.length === 1) this.$ = this.$[0];

break;
case 21:this.$ = $$[$0-1]; this.$.push($$[$0])
break;
case 22:this.$ = [];
break;
case 23:this.$ = {prec: $$[$0]};
break;
case 24:this.$ = null;
break;
case 25:this.$ = $$[$0];
break;
case 26:this.$ = yytext;
break;
case 27:this.$ = yytext;
break;
case 28:this.$ = yytext;
break;
case 29:this.$ = '';
break;
}
},
table: [{3:1,4:2,5:[2,4],9:[2,4],11:[2,4],15:[2,4],16:[2,4],17:[2,4]},{1:[3]},{5:[1,3],8:4,9:[1,5],11:[1,6],12:7,13:8,15:[1,9],16:[1,10],17:[1,11]},{6:12,10:15,19:13,20:14,31:[1,16]},{5:[2,3],9:[2,3],11:[2,3],15:[2,3],16:[2,3],17:[2,3]},{10:17,31:[1,16]},{5:[2,6],9:[2,6],11:[2,6],15:[2,6],16:[2,6],17:[2,6]},{5:[2,7],9:[2,7],11:[2,7],15:[2,7],16:[2,7],17:[2,7]},{10:20,14:18,18:19,30:[1,21],31:[1,16]},{30:[2,9],31:[2,9]},{30:[2,10],31:[2,10]},{30:[2,11],31:[2,11]},{5:[1,23],7:[1,22]},{5:[2,14],7:[2,14],10:15,20:24,31:[1,16]},{5:[2,16],7:[2,16],31:[2,16]},{21:[1,25]},{5:[2,27],9:[2,27],11:[2,27],15:[2,27],16:[2,27],17:[2,27],21:[2,27],23:[2,27],24:[2,27],29:[2,27],30:[2,27],31:[2,27],32:[2,27]},{5:[2,5],9:[2,5],11:[2,5],15:[2,5],16:[2,5],17:[2,5]},{5:[2,8],9:[2,8],10:20,11:[2,8],15:[2,8],16:[2,8],17:[2,8],18:26,30:[1,21],31:[1,16]},{5:[2,13],9:[2,13],11:[2,13],15:[2,13],16:[2,13],17:[2,13],30:[2,13],31:[2,13]},{5:[2,25],9:[2,25],11:[2,25],15:[2,25],16:[2,25],17:[2,25],23:[2,25],24:[2,25],29:[2,25],30:[2,25],31:[2,25],32:[2,25]},{5:[2,26],9:[2,26],11:[2,26],15:[2,26],16:[2,26],17:[2,26],23:[2,26],24:[2,26],29:[2,26],30:[2,26],31:[2,26],32:[2,26]},{1:[2,1]},{7:[1,27]},{5:[2,15],7:[2,15],31:[2,15]},{22:28,23:[2,22],24:[2,22],25:29,26:30,29:[2,22],30:[2,22],31:[2,22],32:[2,22]},{5:[2,12],9:[2,12],11:[2,12],15:[2,12],16:[2,12],17:[2,12],30:[2,12],31:[2,12]},{1:[2,2]},{23:[1,31],24:[1,32]},{23:[2,19],24:[2,19]},{10:20,18:34,23:[2,24],24:[2,24],27:33,29:[1,35],30:[1,21],31:[1,16],32:[2,24]},{5:[2,17],7:[2,17],31:[2,17]},{23:[2,22],24:[2,22],25:36,26:30,29:[2,22],30:[2,22],31:[2,22],32:[2,22]},{23:[2,29],24:[2,29],28:37,32:[1,38]},{23:[2,21],24:[2,21],29:[2,21],30:[2,21],31:[2,21],32:[2,21]},{10:20,18:39,30:[1,21],31:[1,16]},{23:[2,18],24:[2,18]},{23:[2,20],24:[2,20]},{23:[2,28],24:[2,28]},{23:[2,23],24:[2,23],32:[2,23]}],
defaultActions: {22:[2,1],27:[2,2]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }

            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match.length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:/* skip whitespace */
break;
case 1:/* skip comment */
break;
case 2:return yy.lexComment(this);
break;
case 3:return 31;
break;
case 4:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 30;
break;
case 5:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 30;
break;
case 6:return 21;
break;
case 7:return 23;
break;
case 8:return 24;
break;
case 9:return 5;
break;
case 10:return 29;
break;
case 11:return 9;
break;
case 12:return 15;
break;
case 13:return 16;
break;
case 14:return 17;
break;
case 15:return 11;
break;
case 16:/* ignore unrecognized decl */
break;
case 17: /* ignore type */
break;
case 18:yy_.yytext = yy_.yytext.substr(2, yy_.yyleng-4); return 32;
break;
case 19:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 32;
break;
case 20:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 32;
break;
case 21:/* ignore bad characters */
break;
case 22:return 7;
break;
}
};
lexer.rules = [/^\s+/,/^\/\/.*/,/^\/\*[^*]*\*/,/^[a-zA-Z][a-zA-Z0-9_-]*/,/^"[^"]+"/,/^'[^']+'/,/^:/,/^;/,/^\|/,/^%%/,/^%prec\b/,/^%start\b/,/^%left\b/,/^%right\b/,/^%nonassoc\b/,/^%lex[\w\W]*?\/lex\b/,/^%[a-zA-Z]+[^\n]*/,/^<[a-zA-Z]*>/,/^\{\{[\w\W]*?\}\}/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^./,/^$/];
lexer.conditions = {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = bnf;
exports.parse = function () { return bnf.parse.apply(bnf, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require("fs").readFileSync(require("path").join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}
//*/
},requires:["fs","path","file","file","system"]});

require.def("jison/util/lex-parser",{factory:function(require,exports,module){
/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"include":5,"%%":6,"rules":7,"epilogue":8,"EOF":9,"action":10,"definition":11,"name":12,"regex":13,"START_INC":14,"names_inclusive":15,"START_EXC":16,"names_exclusive":17,"NAME":18,"rule":19,"start_conditions":20,"<":21,"name_list":22,">":23,"*":24,",":25,"ACTION":26,"regex_list":27,"|":28,"regex_concat":29,"regex_base":30,"(":31,")":32,"+":33,"?":34,"/":35,"/!":36,"name_expansion":37,"range_regex":38,"any_group_regex":39,".":40,"^":41,"$":42,"string":43,"escape_char":44,"{":45,"}":46,"ANY_GROUP_REGEX":47,"ESCAPE_CHAR":48,"RANGE_REGEX":49,"STRING_LIT":50,"$accept":0,"$end":1},
terminals_: {2:"error",6:"%%",9:"EOF",14:"START_INC",16:"START_EXC",18:"NAME",21:"<",23:">",24:"*",25:",",26:"ACTION",28:"|",31:"(",32:")",33:"+",34:"?",35:"/",36:"/!",40:".",41:"^",42:"$",45:"{",46:"}",47:"ANY_GROUP_REGEX",48:"ESCAPE_CHAR",49:"RANGE_REGEX",50:"STRING_LIT"},
productions_: [0,[3,5],[8,1],[8,2],[5,1],[5,0],[4,2],[4,0],[11,2],[11,2],[11,2],[15,1],[15,2],[17,1],[17,2],[12,1],[7,2],[7,1],[19,3],[20,3],[20,3],[20,0],[22,1],[22,3],[10,1],[13,1],[27,3],[27,1],[29,2],[29,1],[30,3],[30,2],[30,2],[30,2],[30,2],[30,2],[30,1],[30,2],[30,1],[30,1],[30,1],[30,1],[30,1],[30,1],[37,3],[39,1],[44,1],[38,1],[43,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: this.$ = {rules: $$[$0-1]};
          if ($$[$0-4][0]) this.$.macros = $$[$0-4][0];
          if ($$[$0-4][1]) this.$.startConditions = $$[$0-4][1];
          if ($$[$0-3]) this.$.actionInclude = $$[$0-3];
          return this.$; 
break;
case 6: 
          this.$ = $$[$0-1];
          if ('length' in $$[$0]) {
            this.$[0] = this.$[0] || {};
            this.$[0][$$[$0][0]] = $$[$0][1];
          } else {
            this.$[1] = this.$[1] || {};
            for (var name in $$[$0]) {
              this.$[1][name] = $$[$0][name];
            }
          }
        
break;
case 7: this.$ = [null,null]; 
break;
case 8: this.$ = [$$[$0-1], $$[$0]]; 
break;
case 9: this.$ = $$[$0]; 
break;
case 10: this.$ = $$[$0]; 
break;
case 11: this.$ = {}; this.$[$$[$0]] = 0; 
break;
case 12: this.$ = $$[$0-1]; this.$[$$[$0]] = 0; 
break;
case 13: this.$ = {}; this.$[$$[$0]] = 1; 
break;
case 14: this.$ = $$[$0-1]; this.$[$$[$0]] = 1; 
break;
case 15: this.$ = yytext; 
break;
case 16: this.$ = $$[$0-1]; this.$.push($$[$0]); 
break;
case 17: this.$ = [$$[$0]]; 
break;
case 18: this.$ = $$[$0-2] ? [$$[$0-2], $$[$0-1], $$[$0]] : [$$[$0-1],$$[$0]]; 
break;
case 19: this.$ = $$[$0-1]; 
break;
case 20: this.$ = ['*']; 
break;
case 22: this.$ = [$$[$0]]; 
break;
case 23: this.$ = $$[$0-2]; this.$.push($$[$0]); 
break;
case 24: this.$ = yytext; 
break;
case 25: this.$ = $$[$0]; 
          if (this.$.match(/[\w\d]$/))
              this.$ += "\\b";
        
break;
case 26: this.$ = $$[$0-2]+'|'+$$[$0]; 
break;
case 28: this.$ = $$[$0-1]+$$[$0]; 
break;
case 30: this.$ = '('+$$[$0-1]+')'; 
break;
case 31: this.$ = $$[$0-1]+'+'; 
break;
case 32: this.$ = $$[$0-1]+'*'; 
break;
case 33: this.$ = $$[$0-1]+'?'; 
break;
case 34: this.$ = '(?='+$$[$0]+')'; 
break;
case 35: this.$ = '(?!'+$$[$0]+')'; 
break;
case 37: this.$ = $$[$0-1]+$$[$0]; 
break;
case 39: this.$ = '.'; 
break;
case 40: this.$ = '^'; 
break;
case 41: this.$ = '$'; 
break;
case 44: this.$ = '{'+$$[$0-1]+'}'; 
break;
case 45: this.$ = yytext; 
break;
case 46: this.$ = yytext; 
break;
case 47: this.$ = yytext; 
break;
case 48: this.$ = yy.prepareString(yytext.substr(1, yytext.length-2)); 
break;
}
},
table: [{3:1,4:2,6:[2,7],14:[2,7],16:[2,7],18:[2,7],26:[2,7]},{1:[3]},{5:3,6:[2,5],10:5,11:4,12:6,14:[1,7],16:[1,8],18:[1,10],26:[1,9]},{6:[1,11]},{6:[2,6],14:[2,6],16:[2,6],18:[2,6],26:[2,6]},{6:[2,4]},{13:12,27:13,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{15:30,18:[1,31]},{17:32,18:[1,33]},{6:[2,24],9:[2,24],21:[2,24],31:[2,24],35:[2,24],36:[2,24],40:[2,24],41:[2,24],42:[2,24],45:[2,24],47:[2,24],48:[2,24],50:[2,24]},{31:[2,15],35:[2,15],36:[2,15],40:[2,15],41:[2,15],42:[2,15],45:[2,15],46:[2,15],47:[2,15],48:[2,15],50:[2,15]},{7:34,19:35,20:36,21:[1,37],31:[2,21],35:[2,21],36:[2,21],40:[2,21],41:[2,21],42:[2,21],45:[2,21],47:[2,21],48:[2,21],50:[2,21]},{6:[2,8],14:[2,8],16:[2,8],18:[2,8],26:[2,8]},{6:[2,25],14:[2,25],16:[2,25],18:[2,25],26:[2,25],28:[1,38]},{6:[2,27],14:[2,27],16:[2,27],18:[2,27],26:[2,27],28:[2,27],30:39,31:[1,16],32:[2,27],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{6:[2,29],14:[2,29],16:[2,29],18:[2,29],24:[1,41],26:[2,29],28:[2,29],31:[2,29],32:[2,29],33:[1,40],34:[1,42],35:[2,29],36:[2,29],38:43,40:[2,29],41:[2,29],42:[2,29],45:[2,29],47:[2,29],48:[2,29],49:[1,44],50:[2,29]},{27:45,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{30:46,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{30:47,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{6:[2,36],14:[2,36],16:[2,36],18:[2,36],24:[2,36],26:[2,36],28:[2,36],31:[2,36],32:[2,36],33:[2,36],34:[2,36],35:[2,36],36:[2,36],40:[2,36],41:[2,36],42:[2,36],45:[2,36],47:[2,36],48:[2,36],49:[2,36],50:[2,36]},{6:[2,38],14:[2,38],16:[2,38],18:[2,38],24:[2,38],26:[2,38],28:[2,38],31:[2,38],32:[2,38],33:[2,38],34:[2,38],35:[2,38],36:[2,38],40:[2,38],41:[2,38],42:[2,38],45:[2,38],47:[2,38],48:[2,38],49:[2,38],50:[2,38]},{6:[2,39],14:[2,39],16:[2,39],18:[2,39],24:[2,39],26:[2,39],28:[2,39],31:[2,39],32:[2,39],33:[2,39],34:[2,39],35:[2,39],36:[2,39],40:[2,39],41:[2,39],42:[2,39],45:[2,39],47:[2,39],48:[2,39],49:[2,39],50:[2,39]},{6:[2,40],14:[2,40],16:[2,40],18:[2,40],24:[2,40],26:[2,40],28:[2,40],31:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],41:[2,40],42:[2,40],45:[2,40],47:[2,40],48:[2,40],49:[2,40],50:[2,40]},{6:[2,41],14:[2,41],16:[2,41],18:[2,41],24:[2,41],26:[2,41],28:[2,41],31:[2,41],32:[2,41],33:[2,41],34:[2,41],35:[2,41],36:[2,41],40:[2,41],41:[2,41],42:[2,41],45:[2,41],47:[2,41],48:[2,41],49:[2,41],50:[2,41]},{6:[2,42],14:[2,42],16:[2,42],18:[2,42],24:[2,42],26:[2,42],28:[2,42],31:[2,42],32:[2,42],33:[2,42],34:[2,42],35:[2,42],36:[2,42],40:[2,42],41:[2,42],42:[2,42],45:[2,42],47:[2,42],48:[2,42],49:[2,42],50:[2,42]},{6:[2,43],14:[2,43],16:[2,43],18:[2,43],24:[2,43],26:[2,43],28:[2,43],31:[2,43],32:[2,43],33:[2,43],34:[2,43],35:[2,43],36:[2,43],40:[2,43],41:[2,43],42:[2,43],45:[2,43],47:[2,43],48:[2,43],49:[2,43],50:[2,43]},{12:48,18:[1,10]},{6:[2,45],14:[2,45],16:[2,45],18:[2,45],24:[2,45],26:[2,45],28:[2,45],31:[2,45],32:[2,45],33:[2,45],34:[2,45],35:[2,45],36:[2,45],40:[2,45],41:[2,45],42:[2,45],45:[2,45],47:[2,45],48:[2,45],49:[2,45],50:[2,45]},{6:[2,48],14:[2,48],16:[2,48],18:[2,48],24:[2,48],26:[2,48],28:[2,48],31:[2,48],32:[2,48],33:[2,48],34:[2,48],35:[2,48],36:[2,48],40:[2,48],41:[2,48],42:[2,48],45:[2,48],47:[2,48],48:[2,48],49:[2,48],50:[2,48]},{6:[2,46],14:[2,46],16:[2,46],18:[2,46],24:[2,46],26:[2,46],28:[2,46],31:[2,46],32:[2,46],33:[2,46],34:[2,46],35:[2,46],36:[2,46],40:[2,46],41:[2,46],42:[2,46],45:[2,46],47:[2,46],48:[2,46],49:[2,46],50:[2,46]},{6:[2,9],14:[2,9],16:[2,9],18:[1,49],26:[2,9]},{6:[2,11],14:[2,11],16:[2,11],18:[2,11],26:[2,11]},{6:[2,10],14:[2,10],16:[2,10],18:[1,50],26:[2,10]},{6:[2,13],14:[2,13],16:[2,13],18:[2,13],26:[2,13]},{6:[1,54],8:51,9:[1,53],19:52,20:36,21:[1,37],31:[2,21],35:[2,21],36:[2,21],40:[2,21],41:[2,21],42:[2,21],45:[2,21],47:[2,21],48:[2,21],50:[2,21]},{6:[2,17],9:[2,17],21:[2,17],31:[2,17],35:[2,17],36:[2,17],40:[2,17],41:[2,17],42:[2,17],45:[2,17],47:[2,17],48:[2,17],50:[2,17]},{13:55,27:13,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{18:[1,58],22:56,24:[1,57]},{27:59,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{6:[2,28],14:[2,28],16:[2,28],18:[2,28],24:[1,41],26:[2,28],28:[2,28],31:[2,28],32:[2,28],33:[1,40],34:[1,42],35:[2,28],36:[2,28],38:43,40:[2,28],41:[2,28],42:[2,28],45:[2,28],47:[2,28],48:[2,28],49:[1,44],50:[2,28]},{6:[2,31],14:[2,31],16:[2,31],18:[2,31],24:[2,31],26:[2,31],28:[2,31],31:[2,31],32:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[2,31],40:[2,31],41:[2,31],42:[2,31],45:[2,31],47:[2,31],48:[2,31],49:[2,31],50:[2,31]},{6:[2,32],14:[2,32],16:[2,32],18:[2,32],24:[2,32],26:[2,32],28:[2,32],31:[2,32],32:[2,32],33:[2,32],34:[2,32],35:[2,32],36:[2,32],40:[2,32],41:[2,32],42:[2,32],45:[2,32],47:[2,32],48:[2,32],49:[2,32],50:[2,32]},{6:[2,33],14:[2,33],16:[2,33],18:[2,33],24:[2,33],26:[2,33],28:[2,33],31:[2,33],32:[2,33],33:[2,33],34:[2,33],35:[2,33],36:[2,33],40:[2,33],41:[2,33],42:[2,33],45:[2,33],47:[2,33],48:[2,33],49:[2,33],50:[2,33]},{6:[2,37],14:[2,37],16:[2,37],18:[2,37],24:[2,37],26:[2,37],28:[2,37],31:[2,37],32:[2,37],33:[2,37],34:[2,37],35:[2,37],36:[2,37],40:[2,37],41:[2,37],42:[2,37],45:[2,37],47:[2,37],48:[2,37],49:[2,37],50:[2,37]},{6:[2,47],14:[2,47],16:[2,47],18:[2,47],24:[2,47],26:[2,47],28:[2,47],31:[2,47],32:[2,47],33:[2,47],34:[2,47],35:[2,47],36:[2,47],40:[2,47],41:[2,47],42:[2,47],45:[2,47],47:[2,47],48:[2,47],49:[2,47],50:[2,47]},{28:[1,38],32:[1,60]},{6:[2,34],14:[2,34],16:[2,34],18:[2,34],24:[1,41],26:[2,34],28:[2,34],31:[2,34],32:[2,34],33:[1,40],34:[1,42],35:[2,34],36:[2,34],38:43,40:[2,34],41:[2,34],42:[2,34],45:[2,34],47:[2,34],48:[2,34],49:[1,44],50:[2,34]},{6:[2,35],14:[2,35],16:[2,35],18:[2,35],24:[1,41],26:[2,35],28:[2,35],31:[2,35],32:[2,35],33:[1,40],34:[1,42],35:[2,35],36:[2,35],38:43,40:[2,35],41:[2,35],42:[2,35],45:[2,35],47:[2,35],48:[2,35],49:[1,44],50:[2,35]},{46:[1,61]},{6:[2,12],14:[2,12],16:[2,12],18:[2,12],26:[2,12]},{6:[2,14],14:[2,14],16:[2,14],18:[2,14],26:[2,14]},{1:[2,1]},{6:[2,16],9:[2,16],21:[2,16],31:[2,16],35:[2,16],36:[2,16],40:[2,16],41:[2,16],42:[2,16],45:[2,16],47:[2,16],48:[2,16],50:[2,16]},{1:[2,2]},{9:[1,62]},{10:63,26:[1,9]},{23:[1,64],25:[1,65]},{23:[1,66]},{23:[2,22],25:[2,22]},{6:[2,26],14:[2,26],16:[2,26],18:[2,26],26:[2,26],28:[1,38],32:[2,26]},{6:[2,30],14:[2,30],16:[2,30],18:[2,30],24:[2,30],26:[2,30],28:[2,30],31:[2,30],32:[2,30],33:[2,30],34:[2,30],35:[2,30],36:[2,30],40:[2,30],41:[2,30],42:[2,30],45:[2,30],47:[2,30],48:[2,30],49:[2,30],50:[2,30]},{6:[2,44],14:[2,44],16:[2,44],18:[2,44],24:[2,44],26:[2,44],28:[2,44],31:[2,44],32:[2,44],33:[2,44],34:[2,44],35:[2,44],36:[2,44],40:[2,44],41:[2,44],42:[2,44],45:[2,44],47:[2,44],48:[2,44],49:[2,44],50:[2,44]},{1:[2,3]},{6:[2,18],9:[2,18],21:[2,18],31:[2,18],35:[2,18],36:[2,18],40:[2,18],41:[2,18],42:[2,18],45:[2,18],47:[2,18],48:[2,18],50:[2,18]},{31:[2,19],35:[2,19],36:[2,19],40:[2,19],41:[2,19],42:[2,19],45:[2,19],47:[2,19],48:[2,19],50:[2,19]},{18:[1,67]},{31:[2,20],35:[2,20],36:[2,20],40:[2,20],41:[2,20],42:[2,20],45:[2,20],47:[2,20],48:[2,20],50:[2,20]},{23:[2,23],25:[2,23]}],
defaultActions: {5:[2,4],51:[2,1],53:[2,2],62:[2,3]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }
            
            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column,
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match.length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:this.begin('INITIAL')
break;
case 1:this.begin('trail'); yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length-2);return 26;
break;
case 2:this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 26;
break;
case 3:this.begin('INITIAL'); return 26
break;
case 4:this.begin('INITIAL')
break;
case 5:if (yy.ruleSection) this.begin('indented')
break;
case 6:return 18
break;
case 7:yy_.yytext = yy_.yytext.replace(/\\"/g,'"');return 50;
break;
case 8:yy_.yytext = yy_.yytext.replace(/\\'/g,"'");return 50;
break;
case 9:return 28
break;
case 10:return 47
break;
case 11:return 31
break;
case 12:return 32
break;
case 13:return 33
break;
case 14:return 24
break;
case 15:return 34
break;
case 16:return 41
break;
case 17:return 25
break;
case 18:return 42
break;
case 19:return 21
break;
case 20:return 23
break;
case 21:return 36
break;
case 22:return 35
break;
case 23:yy_.yytext = yy_.yytext.replace(/\\"/g,'"'); return 48
break;
case 24:return 42
break;
case 25:return 40
break;
case 26:return 14
break;
case 27:return 16
break;
case 28:yy.ruleSection = true; return 6
break;
case 29:return 49
break;
case 30:return 45
break;
case 31:return 46
break;
case 32:/* ignore bad characters */
break;
case 33:return 9
break;
}
};
lexer.rules = [/^.*\n+/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^.+/,/^\n+/,/^\s+/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^,/,/^<<EOF>>/,/^</,/^>/,/^\/!/,/^\//,/^\\[a-zA-Z0"]/,/^\$/,/^\./,/^%s\b/,/^%x\b/,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^\{/,/^\}/,/^./,/^$/];
lexer.conditions = {"indented":{"rules":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],"inclusive":true},"trail":{"rules":[0,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],"inclusive":true},"INITIAL":{"rules":[2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = jisonlex;
exports.parse = function () { return jisonlex.parse.apply(jisonlex, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require("fs").readFileSync(require("path").join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}
//*/
},requires:["fs","path","file","file","system"]});;
return require;
})();
