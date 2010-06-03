var require = (function() {
var require = (function () {
    var modules = {};
    var factories = {};
    var r = function (id) {if (!modules[id]) {modules[id] = {};factories[id](r, modules[id], {id: id});}return modules[id];};
    r.def = function (id, params) {factories[id] = params.factory;};
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
if (typeof puts !== 'undefined') {
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
    var actions = [this.actionInclude || "", "var $$ = arguments[5],$0=arguments[5].length;",'switch(arguments[4]) {'],
        prods, symbol;
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
                    if (action.match(/\$[a-zA-Z][a-zA-Z0-9_]*/)) {
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
                        });
                    }
                    action = action.replace(/\$(?:0|\$)/g, "this.$")
                        .replace(/\$(\d+)/g, "$$$[\$0-"+rhs.length+"+$1-1]");
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
    this.performAction = Function("yytext","yyleng","yylineno","yy", actions.join("\n"));
};

generator.createParser = function createParser () {
    throw 'Calling abstract method.';
};

// noop. implemented in debug mixin
generator.trace = function trace () { };

generator.warn = function warn () {
    var args = Array.prototype.slice.call(arguments,0);
    Jison.print.call(null,args.join(""));
};

generator.error = function error (msg) {
    throw msg;
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
    var out = this.generateModule(opt);
    out += "\nif (typeof require !== 'undefined') {";
    out += "\nexports.parser = "+moduleName+";";
    out += "\nexports.parse = function () { return "+moduleName+".parse.apply("+moduleName+", arguments); }";
    out += "\nexports.main = "+ String(opt.moduleMain || commonjsMain);
    out += "\nif (require.main === module) {\n\texports.main(require(\"system\").args);\n}";
    out += "\n}";

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
        "terminals_: " + JSON.stringify(this.terminals_),
        "productions_: " + JSON.stringify(this.productions_),
        "performAction: " + String(this.performAction),
        "table: " + JSON.stringify(this.table),
        "defaultActions: " + JSON.stringify(this.defaultActions),
        "parseError: " + String(this.parseError || (this.hasErrorRecovery ? traceParseError : parser.parseError)),
        "parse: " + String(parser.parse)
        ].join(",\n");
    out += "};";

    return out;
};

// default main method for generated commonjs modules
function commonjsMain (args) {
    var cwd = require("file").path(require("file").cwd());
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    var source = cwd.join(args[1]).read({charset: "utf-8"});
    exports.parser.parse(source);
}

// debug mixin for LR parser generators

function printAction (a, gen) {
    var s = a[0] == 1 ? 'shift '+gen.symbols[a[1]] :
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
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        shifts = 0,
        reductions = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;

    var parseError = this.yy.parseError = typeof this.yy.parseError == 'function' ? this.yy.parseError : this.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
    }

    function checkRecover (st) {
        for (var p in table[st]) if (p == TERROR) {
            return true;
        }
        return false;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token];
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected, recovered = false;
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
                if (this.lexer.showPosition) {
                    parseError.call(this, 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', '),
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                } else {
                    parseError.call(this, 'Parse error on line '+(yylineno+1)+": Unexpected '"+this.terminals_[symbol]+"'",
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                }
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw 'Parsing halted.'
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if (checkRecover(state)) {
                    break;
                }
                if (state == 0) {
                    throw 'Parsing halted.'
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

        a = action; 

        switch (a[0]) {

            case 1: // shift
                shifts++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext); // semantic values or junk only, no terminals
                stack.push(a[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                reductions++;

                len = this.productions_[a[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, a[1], vstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                }

                stack.push(this.productions_[a[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept

                this.reductionCount = reductions;
                this.shiftCount = shifts;
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

exports.main = function main (args) {
    //var parser = new require("args").Parser();
    var fs = require("file");
        gfile = fs.path(fs.cwd()).join(args[1]);

    // try to parse as JSON, else use BNF parser
    if (gfile.extension() === '.json') {
        var grammar = JSON.parse(gfile.read({charset: "utf-8"}));
    } else if (gfile.extension() === '.jison') {
        var grammar = require("jison/bnf").parse(gfile.read({charset: "utf-8"}));
    }

    var opt = grammar.options || {};

    // lexer file
    if (args[2]) {
        var lfile = fs.path(fs.cwd()).join(args[2]);

        // try to parse as JSON, else use BNF parser
        if (lfile.extension() === '.json') {
            grammar.lex = JSON.parse(lfile.read({charset: "utf-8"}));
        } else if (lfile.extension() === '.jisonlex') {
            grammar.lex = require("jison/jisonlex").parse(lfile.read({charset: "utf-8"}));
        }
    }

    if (!opt.moduleName)
        opt.moduleName = gfile.basename().replace(new RegExp(gfile.extension()+"$"), "");
    if (!opt.moduleType)
        opt.moduleType = "commonjs";

    var generator = new Jison.Generator(grammar, opt);
        fname = fs.path(fs.cwd()).join(opt.moduleName + ".js"),
        source = generator.generate(opt),
        stream = fname.open("w");

    stream.print(source);
    stream.close();
};


//*/
},requires:["jison/util/typal","jison/util/set","jison/lexer","jison/bnf","file","file","args","file","jison/bnf","jison/jisonlex"]});

require.def("jison/lexer",{factory:function(require,exports,module){
// Basic RegExp Lexer 
// MIT Licensed
// Zachary Carter <zach@carter.name>

var RegExpLexer = (function () {

// expand macros and convert matchers to RegExp's
function prepareRules(rules, macros, actions, tokens) {
    var m,i,k,action,
        newRules = [];

    if (macros) {
        macros = prepareMacros(macros);
    }

    actions.push('switch(arguments[2]) {');

    for (i=0;i < rules.length; i++) {
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
            rules[i][1] = String(rules[i][1]).replace(/^\s*function \(\) \{/, '').replace(/\}\s*$/, '');
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

function buildActions (dict, tokens) {
    var actions = [dict.actionInclude || ''];
    var tok;
    var toks = {};

    for (tok in tokens) {
        toks[tokens[tok]] = tok;
    }

    this.rules = prepareRules(dict.rules, dict.macros, actions, tokens && toks);
    var fun = actions.join("\n");
    "yytext yyleng yylineno".split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp("("+yy+")", "g"), "yy_.$1");
    });

    return Function("yy", "yy_", fun);
}

function RegExpLexer (dict, input, tokens) {
    if (typeof dict === 'string') {
        dict = require("jison/jisonlex").parse(dict);
    }
    dict = dict || {};

    this.performAction = buildActions.call(this, dict, tokens);

    this.yy = {};
    if (input) {
        this.setInput(input);
    }
}

RegExpLexer.prototype = {
    EOF: '',
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
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        for (var i=0;i < this.rules.length; i++) {
            match = this._input.match(this.rules[i]);
            if (match) {
                lines = match[0].match(/\n/g);
                if (lines) this.yylineno += lines.length;
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, i);
                if (token) return token;
                else return;
            }
        }
        if (this._input == this.EOF) {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },

    // return next match that has a token
    lex: function () {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
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

require.def("jison/json2jison",{factory:function(require,exports,module){
// converts json grammar format to Jison grammar format

function json2jison (grammar, options) {
    options = options || {};
    var s = "";

    s += genDecls(grammar, options);
    s += genBNF(grammar.bnf, options);

    return s;
}

function genDecls (grammar, options) {
    var s = "",
        key;

    for (key in grammar) if (grammar.hasOwnProperty(key)) {
        if (key === 'start') {
            s += "\n%start "+grammar.start+"\n\n";
        }
        else if (key === 'author') {
            s += "\n/* author: "+grammar.author+" */\n\n";
        }
        else if (key === 'comment') {
            s += "\n/* description: "+grammar.comment+" */\n\n";
        }
        else if (key === 'lex') {
            s += "%lex\n"+genLex(grammar.lex)+"/lex\n\n";
        }
        else if (key === 'operators') {
            for (var i=0; i<grammar.operators.length; i++) {
                s += "%"+grammar.operators[i][0]+' '+quoteSymbols(grammar.operators[i].slice(1).join(' '))+"\n";
            }
            s += "\n";
        }
    }

    return s;
}

function genBNF (bnf, options) {
    var s = "%%\n",
        sym;

    for (sym in bnf) if (bnf.hasOwnProperty(sym)) {
        s += ["\n",sym,'\n    : ', genHandles(bnf[sym], options),"\n    ;\n"].join("");
    }

    return s;
}

function genHandles (handle, options) {
    if (typeof handle === 'string') {
        return handle;
    } else { //array
        var s = "";
        for (var i=0; i< handle.length;i++) {
            if (typeof handle[i] === 'string' && handle[i]) {
                s += quoteSymbols(handle[i]);
            } else if (handle[i] instanceof Array) {
                s += (handle[i][0] && quoteSymbols(handle[i][0]));
                if (typeof handle[i][1] === 'string') {
                    if (!options.stripActions) {
                        s += handle[i][1].match(/\}/) ? 
                            "\n        {{"+handle[i][1]+(handle[i][1].match(/\}$/) ? ' ' : '')+"}}" :
                            "\n        {"+handle[i][1]+"}";
                    }
                    if (handle[i][2] && handle[i][2].prec) {
                        s += " %prec "+handle[i][2].prec;
                    }
                } else if (handle[i][1].prec) {
                    s += " %prec "+handle[i][1].prec;
                }
            }
            if (typeof handle[i+1] !== 'undefined')
                s += "\n    | ";
        }
        return s;
    }
}

function quoteSymbols (rhs) {
    rhs = rhs.split(' ');

    for (var i=0; i<rhs.length; i++) {
        rhs[i] = quoteSymbol(rhs[i]);
    }
    return rhs.join(' ');
}

function quoteSymbol (sym) {
    if (!/[a-zA-Z][a-zA-Z0-9_-]*/.test(sym)) {
        var quote = /'/.test(sym) ? '"' : "'";
        sym = quote+sym+quote;
    }
    return sym;
}


// Generate lex format from lex JSON

function genLex (lex) {
    var s = [];

    if (lex.macros) {
        for (var macro in lex.macros) if (lex.macros.hasOwnProperty(macro)) {
            s.push(macro, '         ', lex.macros[macro], '\n');
        }
    }
    if (lex.actionInclude) {
        s.push('\n%{\n', lex.actionInclude, '\n%}\n');
    }
    s.push('\n%%\n');
    if (lex.rules) {
        for (var rule;rule=lex.rules.shift();) {
            s.push(genLexRegex(rule[0]), '         ', genLexRule(rule[1]), '\n');
        }
    }
    s.push('\n');

    return s.join('');
}
function genLexRegex (regex) {
    return regex.match(/\\b$/) ? '"'+regex.replace(/\\b$/, '')+'"' : regex;
}
function genLexRule (rule) {
    return rule.match(/\\}/) ? '%{'+rule+'}%' : '{'+rule+'}';
}

exports.json2jison = json2jison;
exports.convert = json2jison;

exports.main = function main (args) {
    var fs = require("file");
        gfile = fs.path(fs.cwd()).join(args[1]),
        grammar = JSON.parse(gfile.read({charset: "utf-8"}));

    if (grammar.bnf) {
        var fname = fs.path(fs.cwd()).join(gfile.basename(".json") + ".jison"),
            stream = fname.open("w");
        stream.print(json2jison(grammar));
        stream.close();
    }
};


//*/
},requires:["file"]});

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
var parser = {trace: function trace() {
},
yy: {},
symbols_: {"error":2,"spec":3,"declaration_list":4,"%%":5,"grammar":6,"EOF":7,"declaration":8,"START":9,"id":10,"LEX_BLOCK":11,"operator":12,"associativity":13,"token_list":14,"LEFT":15,"RIGHT":16,"NONASSOC":17,"symbol":18,"production_list":19,"production":20,":":21,"handle_list":22,";":23,"|":24,"handle_action":25,"handle":26,"prec":27,"action":28,"PREC":29,"STRING":30,"ID":31,"ACTION":32,"$accept":0,"$end":1},
terminals_: {"2":"error","5":"%%","7":"EOF","9":"START","11":"LEX_BLOCK","15":"LEFT","16":"RIGHT","17":"NONASSOC","21":":","23":";","24":"|","29":"PREC","30":"STRING","31":"ID","32":"ACTION"},
productions_: [0,[3,4],[3,5],[4,2],[4,0],[8,2],[8,1],[8,1],[12,2],[13,1],[13,1],[13,1],[14,2],[14,1],[6,1],[19,2],[19,1],[20,4],[22,3],[22,1],[25,3],[26,2],[26,0],[27,2],[27,0],[18,1],[18,1],[10,1],[28,1],[28,0]],
performAction: function anonymous(yytext, yyleng, yylineno, yy) {
    var $$ = arguments[5], $0 = arguments[5].length;
    switch (arguments[4]) {
      case 1:
        this.$ = $$[$0 - 4 + 1 - 1];
        this.$.bnf = $$[$0 - 4 + 3 - 1];
        return this.$;
        break;
      case 2:
        this.$ = $$[$0 - 5 + 1 - 1];
        this.$.bnf = $$[$0 - 5 + 3 - 1];
        return this.$;
        break;
      case 3:
        this.$ = $$[$0 - 2 + 1 - 1];
        yy.addDeclaration(this.$, $$[$0 - 2 + 2 - 1]);
        break;
      case 4:
        this.$ = {};
        break;
      case 5:
        this.$ = {start: $$[$0 - 2 + 2 - 1]};
        break;
      case 6:
        this.$ = {lex: $$[$0 - 1 + 1 - 1]};
        break;
      case 7:
        this.$ = {operator: $$[$0 - 1 + 1 - 1]};
        break;
      case 8:
        this.$ = [$$[$0 - 2 + 1 - 1]];
        this.$.push.apply(this.$, $$[$0 - 2 + 2 - 1]);
        break;
      case 9:
        this.$ = "left";
        break;
      case 10:
        this.$ = "right";
        break;
      case 11:
        this.$ = "nonassoc";
        break;
      case 12:
        this.$ = $$[$0 - 2 + 1 - 1];
        this.$.push($$[$0 - 2 + 2 - 1]);
        break;
      case 13:
        this.$ = [$$[$0 - 1 + 1 - 1]];
        break;
      case 14:
        this.$ = $$[$0 - 1 + 1 - 1];
        break;
      case 15:
        this.$ = $$[$0 - 2 + 1 - 1];
        this.$[$$[$0 - 2 + 2 - 1][0]] = $$[$0 - 2 + 2 - 1][1];
        break;
      case 16:
        this.$ = {};
        this.$[$$[$0 - 1 + 1 - 1][0]] = $$[$0 - 1 + 1 - 1][1];
        break;
      case 17:
        this.$ = [$$[$0 - 4 + 1 - 1], $$[$0 - 4 + 3 - 1]];
        break;
      case 18:
        this.$ = $$[$0 - 3 + 1 - 1];
        this.$.push($$[$0 - 3 + 3 - 1]);
        break;
      case 19:
        this.$ = [$$[$0 - 1 + 1 - 1]];
        break;
      case 20:
        this.$ = [$$[$0 - 3 + 1 - 1].length ? $$[$0 - 3 + 1 - 1].join(" ") : ""];
        if ($$[$0 - 3 + 3 - 1]) {
            this.$.push($$[$0 - 3 + 3 - 1]);
        }
        if ($$[$0 - 3 + 2 - 1]) {
            this.$.push($$[$0 - 3 + 2 - 1]);
        }
        if (this.$.length === 1) {
            this.$ = this.$[0];
        }
        break;
      case 21:
        this.$ = $$[$0 - 2 + 1 - 1];
        this.$.push($$[$0 - 2 + 2 - 1]);
        break;
      case 22:
        this.$ = [];
        break;
      case 23:
        this.$ = {prec: $$[$0 - 2 + 2 - 1]};
        break;
      case 24:
        this.$ = null;
        break;
      case 25:
        this.$ = $$[$0 - 1 + 1 - 1];
        break;
      case 26:
        this.$ = yytext;
        break;
      case 27:
        this.$ = yytext;
        break;
      case 28:
        this.$ = yytext;
        break;
      case 29:
        this.$ = "";
        break;
      default:;
    }
},
table: [{"3":1,"4":2,"5":[2,4],"9":[2,4],"11":[2,4],"15":[2,4],"16":[2,4],"17":[2,4]},{"1":[3]},{"5":[1,3],"8":4,"9":[1,5],"11":[1,6],"12":7,"13":8,"15":[1,9],"16":[1,10],"17":[1,11]},{"6":12,"19":13,"20":14,"10":15,"31":[1,16]},{"5":[2,3],"9":[2,3],"11":[2,3],"15":[2,3],"16":[2,3],"17":[2,3]},{"10":17,"31":[1,16]},{"17":[2,6],"16":[2,6],"15":[2,6],"11":[2,6],"9":[2,6],"5":[2,6]},{"17":[2,7],"16":[2,7],"15":[2,7],"11":[2,7],"9":[2,7],"5":[2,7]},{"14":18,"18":19,"10":20,"30":[1,21],"31":[1,16]},{"30":[2,9],"31":[2,9]},{"30":[2,10],"31":[2,10]},{"30":[2,11],"31":[2,11]},{"7":[1,22],"5":[1,23]},{"20":24,"10":15,"31":[1,16],"7":[2,14],"5":[2,14]},{"5":[2,16],"7":[2,16],"31":[2,16]},{"21":[1,25]},{"21":[2,27],"5":[2,27],"9":[2,27],"11":[2,27],"15":[2,27],"16":[2,27],"17":[2,27],"31":[2,27],"30":[2,27],"23":[2,27],"24":[2,27],"32":[2,27],"29":[2,27]},{"17":[2,5],"16":[2,5],"15":[2,5],"11":[2,5],"9":[2,5],"5":[2,5]},{"18":26,"10":20,"30":[1,21],"31":[1,16],"5":[2,8],"9":[2,8],"11":[2,8],"15":[2,8],"16":[2,8],"17":[2,8]},{"17":[2,13],"16":[2,13],"15":[2,13],"11":[2,13],"9":[2,13],"5":[2,13],"31":[2,13],"30":[2,13]},{"30":[2,25],"31":[2,25],"5":[2,25],"9":[2,25],"11":[2,25],"15":[2,25],"16":[2,25],"17":[2,25],"29":[2,25],"32":[2,25],"24":[2,25],"23":[2,25]},{"30":[2,26],"31":[2,26],"5":[2,26],"9":[2,26],"11":[2,26],"15":[2,26],"16":[2,26],"17":[2,26],"29":[2,26],"32":[2,26],"24":[2,26],"23":[2,26]},{"1":[2,1]},{"7":[1,27]},{"5":[2,15],"7":[2,15],"31":[2,15]},{"22":28,"25":29,"26":30,"23":[2,22],"24":[2,22],"32":[2,22],"29":[2,22],"31":[2,22],"30":[2,22]},{"17":[2,12],"16":[2,12],"15":[2,12],"11":[2,12],"9":[2,12],"5":[2,12],"31":[2,12],"30":[2,12]},{"1":[2,2]},{"23":[1,31],"24":[1,32]},{"23":[2,19],"24":[2,19]},{"27":33,"18":34,"29":[1,35],"10":20,"30":[1,21],"31":[1,16],"23":[2,24],"24":[2,24],"32":[2,24]},{"31":[2,17],"7":[2,17],"5":[2,17]},{"25":36,"26":30,"23":[2,22],"24":[2,22],"32":[2,22],"29":[2,22],"31":[2,22],"30":[2,22]},{"28":37,"32":[1,38],"23":[2,29],"24":[2,29]},{"23":[2,21],"24":[2,21],"32":[2,21],"29":[2,21],"31":[2,21],"30":[2,21]},{"18":39,"10":20,"30":[1,21],"31":[1,16]},{"23":[2,18],"24":[2,18]},{"24":[2,20],"23":[2,20]},{"23":[2,28],"24":[2,28]},{"23":[2,23],"24":[2,23],"32":[2,23]}],
defaultActions: {"22":[2,1],"27":[2,2]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], table = this.table, yytext = "", yylineno = 0, yyleng = 0, shifts = 0, reductions = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    var parseError = this.yy.parseError = typeof this.yy.parseError == "function" ? this.yy.parseError : this.parseError;

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
    }


    function checkRecover(st) {
        for (var p in table[st]) {
            if (p == TERROR) {
                return true;
            }
        }
        return false;
    }


    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token];
        }
        return token;
    }

    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected, recovered = false;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null) {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            if (!recovering) {
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                }
                if (this.lexer.showPosition) {
                    parseError.call(this, "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", "), {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                } else {
                    parseError.call(this, "Parse error on line " + (yylineno + 1) + ": Unexpected '" + this.terminals_[symbol] + "'", {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                }
            }
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw "Parsing halted.";
                }
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }
            while (true) {
                if (checkRecover(state)) {
                    break;
                }
                if (state == 0) {
                    throw "Parsing halted.";
                }
                popStack(1);
                state = stack[stack.length - 1];
            }
            preErrorSymbol = symbol;
            symbol = TERROR;
            state = stack[stack.length - 1];
            action = table[state] && table[state][TERROR];
            recovering = 3;
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        a = action;
        switch (a[0]) {
          case 1:
            shifts++;
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            stack.push(a[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
          case 2:
            reductions++;
            len = this.productions_[a[1]][1];
            yyval.$ = vstack[vstack.length - len];
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, a[1], vstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[a[1]][0]);
            vstack.push(yyval.$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
          case 3:
            this.reductionCount = reductions;
            this.shiftCount = shifts;
            return true;
          default:;
        }
    }
    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:"",
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
    this.yytext = this.matched = this.match = "";
    return this;
},
input:function () {
    var ch = this._input[0];
    this.yytext += ch;
    this.yyleng++;
    this.match += ch;
    this.matched += ch;
    var lines = ch.match(/\n/);
    if (lines) {
        this.yylineno++;
    }
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
    return (past.length > 20 ? "..." : "") + past.substr(-20).replace(/\n/g, "");
},
upcomingInput:function () {
    var next = this.match;
    if (next.length < 20) {
        next += this._input.substr(0, 20 - next.length);
    }
    return (next.substr(0, 20) + (next.length > 20 ? "..." : "")).replace(/\n/g, "");
},
showPosition:function () {
    var pre = this.pastInput();
    var c = (new Array(pre.length + 1)).join("-");
    return pre + this.upcomingInput() + "\n" + c + "^";
},
next:function () {
    if (this.done) {
        return this.EOF;
    }
    if (!this._input) {
        this.done = true;
    }
    var token, match, lines;
    if (!this._more) {
        this.yytext = "";
        this.match = "";
    }
    for (var i = 0; i < this.rules.length; i++) {
        match = this._input.match(this.rules[i]);
        if (match) {
            lines = match[0].match(/\n/g);
            if (lines) {
                this.yylineno += lines.length;
            }
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, i);
            if (token) {
                return token;
            } else {
                return;
            }
        }
    }
    if (this._input == this.EOF) {
        return this.EOF;
    } else {
        this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {text: "", token: null, line: this.yylineno});
    }
},
lex:function () {
    var r = this.next();
    if (typeof r !== "undefined") {
        return r;
    } else {
        return this.lex();
    }
}});
lexer.performAction = function anonymous(yy, yy_) {
    switch (arguments[2]) {
      case 0:
        break;
      case 1:
        break;
      case 2:
        return yy.lexComment(this);
        break;
      case 3:
        return 31;
        break;
      case 4:
        yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2);
        return 30;
        break;
      case 5:
        yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2);
        return 30;
        break;
      case 6:
        return 21;
        break;
      case 7:
        return 23;
        break;
      case 8:
        return 24;
        break;
      case 9:
        return 5;
        break;
      case 10:
        return 29;
        break;
      case 11:
        return 9;
        break;
      case 12:
        return 15;
        break;
      case 13:
        return 16;
        break;
      case 14:
        return 17;
        break;
      case 15:
        return 11;
        break;
      case 16:
        break;
      case 17:
        break;
      case 18:
        yy_.yytext = yy_.yytext.substr(2, yy_.yyleng - 4);
        return 32;
        break;
      case 19:
        yy_.yytext = yy_.yytext.substr(1, yy_.yyleng - 2);
        return 32;
        break;
      case 20:
        yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4);
        return 32;
        break;
      case 21:
        break;
      case 22:
        return 7;
        break;
      default:;
    }
};
lexer.rules = [/^\s+/,/^\/\/.*/,/^\/\*[^*]*\*/,/^[a-zA-Z][a-zA-Z0-9_-]*/,/^"[^"]+"/,/^'[^']+'/,/^:/,/^;/,/^\|/,/^%%/,/^%prec\b/,/^%start\b/,/^%left\b/,/^%right\b/,/^%nonassoc\b/,/^%lex[\w\W]*?\/lex\b/,/^%[a-zA-Z]+[^\n]*/,/^<[a-zA-Z]*>/,/^\{\{[\w\W]*?\}\}/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^./,/^$/];return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined') {
exports.parser = bnf;
exports.parse = function () { return bnf.parse.apply(bnf, arguments); }
exports.main = function commonjsMain(args) {
    var cwd = require("file").path(require("file").cwd());
    if (!args[1]) {
        throw new Error("Usage: " + args[0] + " FILE");
    }
    var source = cwd.join(args[1]).read({charset: "utf-8"});
    exports.parser.parse(source);
}
if (require.main === module) {
	exports.main(require("system").args);
}
}

//*/
},requires:["file","file","system"]});

require.def("jison/util/lex-parser",{factory:function(require,exports,module){
/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: function trace() {
},
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"include":5,"%%":6,"rules":7,"EOF":8,"action":9,"definition":10,"name":11,"regex":12,"NAME":13,"rule":14,"ACTION":15,"regex_list":16,"|":17,"regex_concat":18,"regex_base":19,"(":20,")":21,"+":22,"*":23,"?":24,"/":25,"name_expansion":26,"range_regex":27,"any_group_regex":28,".":29,"^":30,"$":31,"string":32,"escape_char":33,"{":34,"}":35,"ANY_GROUP_REGEX":36,"ESCAPE_CHAR":37,"RANGE_REGEX":38,"STRING_LIT":39,"$accept":0,"$end":1},
terminals_: {"2":"error","6":"%%","8":"EOF","13":"NAME","15":"ACTION","17":"|","20":"(","21":")","22":"+","23":"*","24":"?","25":"/","29":".","30":"^","31":"$","34":"{","35":"}","36":"ANY_GROUP_REGEX","37":"ESCAPE_CHAR","38":"RANGE_REGEX","39":"STRING_LIT"},
productions_: [0,[3,6],[3,5],[5,1],[5,0],[4,2],[4,0],[10,2],[11,1],[7,2],[7,1],[14,2],[9,1],[12,1],[16,3],[16,1],[18,2],[18,1],[19,3],[19,2],[19,2],[19,2],[19,2],[19,1],[19,2],[19,1],[19,1],[19,1],[19,1],[19,1],[19,1],[26,3],[28,1],[33,1],[27,1],[32,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy) {
    var $$ = arguments[5], $0 = arguments[5].length;
    switch (arguments[4]) {
      case 1:
        this.$ = {rules: $$[$0 - 6 + 4 - 1]};
        if ($$[$0 - 6 + 1 - 1]) {
            this.$.macros = $$[$0 - 6 + 1 - 1];
        }
        if ($$[$0 - 6 + 2 - 1]) {
            this.$.actionInclude = $$[$0 - 6 + 2 - 1];
        }
        return this.$;
        break;
      case 2:
        this.$ = {rules: $$[$0 - 5 + 4 - 1]};
        if ($$[$0 - 5 + 1 - 1]) {
            this.$.macros = $$[$0 - 5 + 1 - 1];
        }
        if ($$[$0 - 5 + 2 - 1]) {
            this.$.actionInclude = $$[$0 - 5 + 2 - 1];
        }
        return this.$;
        break;
      case 5:
        this.$ = $$[$0 - 2 + 1 - 1] || {};
        this.$[$$[$0 - 2 + 2 - 1][0]] = $$[$0 - 2 + 2 - 1][1];
        break;
      case 6:
        this.$ = null;
        break;
      case 7:
        this.$ = [$$[$0 - 2 + 1 - 1], $$[$0 - 2 + 2 - 1]];
        break;
      case 8:
        this.$ = yytext;
        break;
      case 9:
        this.$ = $$[$0 - 2 + 1 - 1];
        this.$.push($$[$0 - 2 + 2 - 1]);
        break;
      case 10:
        this.$ = [$$[$0 - 1 + 1 - 1]];
        break;
      case 11:
        this.$ = [$$[$0 - 2 + 1 - 1], $$[$0 - 2 + 2 - 1]];
        break;
      case 12:
        this.$ = yytext;
        break;
      case 13:
        this.$ = $$[$0 - 1 + 1 - 1];
        if (this.$.match(/[\w\d]$/)) {
            this.$ += "\\b";
        }
        break;
      case 14:
        this.$ = $$[$0 - 3 + 1 - 1] + "|" + $$[$0 - 3 + 3 - 1];
        break;
      case 16:
        this.$ = $$[$0 - 2 + 1 - 1] + $$[$0 - 2 + 2 - 1];
        break;
      case 18:
        this.$ = "(" + $$[$0 - 3 + 2 - 1] + ")";
        break;
      case 19:
        this.$ = $$[$0 - 2 + 1 - 1] + "+";
        break;
      case 20:
        this.$ = $$[$0 - 2 + 1 - 1] + "*";
        break;
      case 21:
        this.$ = $$[$0 - 2 + 1 - 1] + "?";
        break;
      case 22:
        this.$ = "(?=" + $$[$0 - 2 + 2 - 1] + ")";
        break;
      case 24:
        this.$ = $$[$0 - 2 + 1 - 1] + $$[$0 - 2 + 2 - 1];
        break;
      case 26:
        this.$ = ".";
        break;
      case 27:
        this.$ = "^";
        break;
      case 28:
        this.$ = "$";
        break;
      case 31:
        this.$ = "{" + $$[$0 - 3 + 2 - 1] + "}";
        break;
      case 32:
        this.$ = yytext;
        break;
      case 33:
        this.$ = yytext;
        break;
      case 34:
        this.$ = yytext;
        break;
      case 35:
        this.$ = yy.prepareString(yytext.substr(1, yytext.length - 2));
        break;
      default:;
    }
},
table: [{"3":1,"4":2,"6":[2,6],"15":[2,6],"13":[2,6]},{"1":[3]},{"5":3,"10":4,"9":5,"11":6,"15":[1,7],"13":[1,8],"6":[2,4]},{"6":[1,9]},{"6":[2,5],"15":[2,5],"13":[2,5]},{"6":[2,3]},{"12":10,"16":11,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26]},{"6":[2,12],"8":[2,12],"20":[2,12],"25":[2,12],"29":[2,12],"30":[2,12],"31":[2,12],"34":[2,12],"36":[2,12],"39":[2,12],"37":[2,12]},{"20":[2,8],"25":[2,8],"29":[2,8],"30":[2,8],"31":[2,8],"34":[2,8],"36":[2,8],"39":[2,8],"37":[2,8],"35":[2,8]},{"7":27,"14":28,"12":29,"16":11,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26]},{"13":[2,7],"15":[2,7],"6":[2,7]},{"17":[1,30],"6":[2,13],"15":[2,13],"13":[2,13]},{"19":31,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26],"13":[2,15],"15":[2,15],"6":[2,15],"17":[2,15],"21":[2,15]},{"22":[1,32],"23":[1,33],"24":[1,34],"27":35,"38":[1,36],"17":[2,17],"6":[2,17],"15":[2,17],"13":[2,17],"20":[2,17],"25":[2,17],"29":[2,17],"30":[2,17],"31":[2,17],"34":[2,17],"36":[2,17],"39":[2,17],"37":[2,17],"21":[2,17]},{"16":37,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26]},{"19":38,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26]},{"37":[2,23],"39":[2,23],"36":[2,23],"34":[2,23],"31":[2,23],"30":[2,23],"29":[2,23],"25":[2,23],"20":[2,23],"13":[2,23],"15":[2,23],"6":[2,23],"17":[2,23],"22":[2,23],"23":[2,23],"24":[2,23],"38":[2,23],"21":[2,23]},{"37":[2,25],"39":[2,25],"36":[2,25],"34":[2,25],"31":[2,25],"30":[2,25],"29":[2,25],"25":[2,25],"20":[2,25],"13":[2,25],"15":[2,25],"6":[2,25],"17":[2,25],"22":[2,25],"23":[2,25],"24":[2,25],"38":[2,25],"21":[2,25]},{"37":[2,26],"39":[2,26],"36":[2,26],"34":[2,26],"31":[2,26],"30":[2,26],"29":[2,26],"25":[2,26],"20":[2,26],"13":[2,26],"15":[2,26],"6":[2,26],"17":[2,26],"22":[2,26],"23":[2,26],"24":[2,26],"38":[2,26],"21":[2,26]},{"37":[2,27],"39":[2,27],"36":[2,27],"34":[2,27],"31":[2,27],"30":[2,27],"29":[2,27],"25":[2,27],"20":[2,27],"13":[2,27],"15":[2,27],"6":[2,27],"17":[2,27],"22":[2,27],"23":[2,27],"24":[2,27],"38":[2,27],"21":[2,27]},{"37":[2,28],"39":[2,28],"36":[2,28],"34":[2,28],"31":[2,28],"30":[2,28],"29":[2,28],"25":[2,28],"20":[2,28],"13":[2,28],"15":[2,28],"6":[2,28],"17":[2,28],"22":[2,28],"23":[2,28],"24":[2,28],"38":[2,28],"21":[2,28]},{"37":[2,29],"39":[2,29],"36":[2,29],"34":[2,29],"31":[2,29],"30":[2,29],"29":[2,29],"25":[2,29],"20":[2,29],"13":[2,29],"15":[2,29],"6":[2,29],"17":[2,29],"22":[2,29],"23":[2,29],"24":[2,29],"38":[2,29],"21":[2,29]},{"37":[2,30],"39":[2,30],"36":[2,30],"34":[2,30],"31":[2,30],"30":[2,30],"29":[2,30],"25":[2,30],"20":[2,30],"13":[2,30],"15":[2,30],"6":[2,30],"17":[2,30],"22":[2,30],"23":[2,30],"24":[2,30],"38":[2,30],"21":[2,30]},{"11":39,"13":[1,8]},{"38":[2,32],"24":[2,32],"23":[2,32],"22":[2,32],"17":[2,32],"6":[2,32],"15":[2,32],"13":[2,32],"20":[2,32],"25":[2,32],"29":[2,32],"30":[2,32],"31":[2,32],"34":[2,32],"36":[2,32],"39":[2,32],"37":[2,32],"21":[2,32]},{"38":[2,35],"24":[2,35],"23":[2,35],"22":[2,35],"17":[2,35],"6":[2,35],"15":[2,35],"13":[2,35],"20":[2,35],"25":[2,35],"29":[2,35],"30":[2,35],"31":[2,35],"34":[2,35],"36":[2,35],"39":[2,35],"37":[2,35],"21":[2,35]},{"38":[2,33],"24":[2,33],"23":[2,33],"22":[2,33],"17":[2,33],"6":[2,33],"15":[2,33],"13":[2,33],"20":[2,33],"25":[2,33],"29":[2,33],"30":[2,33],"31":[2,33],"34":[2,33],"36":[2,33],"39":[2,33],"37":[2,33],"21":[2,33]},{"6":[1,40],"8":[1,41],"14":42,"12":29,"16":11,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26]},{"6":[2,10],"8":[2,10],"20":[2,10],"25":[2,10],"29":[2,10],"30":[2,10],"31":[2,10],"34":[2,10],"36":[2,10],"39":[2,10],"37":[2,10]},{"9":43,"15":[1,7]},{"16":44,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":16,"28":17,"29":[1,18],"30":[1,19],"31":[1,20],"32":21,"33":22,"34":[1,23],"36":[1,24],"39":[1,25],"37":[1,26]},{"22":[1,32],"23":[1,33],"24":[1,34],"27":35,"38":[1,36],"17":[2,16],"6":[2,16],"15":[2,16],"13":[2,16],"20":[2,16],"25":[2,16],"29":[2,16],"30":[2,16],"31":[2,16],"34":[2,16],"36":[2,16],"39":[2,16],"37":[2,16],"21":[2,16]},{"37":[2,19],"39":[2,19],"36":[2,19],"34":[2,19],"31":[2,19],"30":[2,19],"29":[2,19],"25":[2,19],"20":[2,19],"13":[2,19],"15":[2,19],"6":[2,19],"17":[2,19],"22":[2,19],"23":[2,19],"24":[2,19],"38":[2,19],"21":[2,19]},{"37":[2,20],"39":[2,20],"36":[2,20],"34":[2,20],"31":[2,20],"30":[2,20],"29":[2,20],"25":[2,20],"20":[2,20],"13":[2,20],"15":[2,20],"6":[2,20],"17":[2,20],"22":[2,20],"23":[2,20],"24":[2,20],"38":[2,20],"21":[2,20]},{"37":[2,21],"39":[2,21],"36":[2,21],"34":[2,21],"31":[2,21],"30":[2,21],"29":[2,21],"25":[2,21],"20":[2,21],"13":[2,21],"15":[2,21],"6":[2,21],"17":[2,21],"22":[2,21],"23":[2,21],"24":[2,21],"38":[2,21],"21":[2,21]},{"37":[2,24],"39":[2,24],"36":[2,24],"34":[2,24],"31":[2,24],"30":[2,24],"29":[2,24],"25":[2,24],"20":[2,24],"13":[2,24],"15":[2,24],"6":[2,24],"17":[2,24],"22":[2,24],"23":[2,24],"24":[2,24],"38":[2,24],"21":[2,24]},{"38":[2,34],"24":[2,34],"23":[2,34],"22":[2,34],"17":[2,34],"6":[2,34],"15":[2,34],"13":[2,34],"20":[2,34],"25":[2,34],"29":[2,34],"30":[2,34],"31":[2,34],"34":[2,34],"36":[2,34],"39":[2,34],"37":[2,34],"21":[2,34]},{"21":[1,45],"17":[1,30]},{"22":[1,32],"23":[1,33],"24":[1,34],"27":35,"38":[1,36],"37":[2,22],"39":[2,22],"36":[2,22],"34":[2,22],"31":[2,22],"30":[2,22],"29":[2,22],"25":[2,22],"20":[2,22],"13":[2,22],"15":[2,22],"6":[2,22],"17":[2,22],"21":[2,22]},{"35":[1,46]},{"8":[1,47]},{"1":[2,2]},{"6":[2,9],"8":[2,9],"20":[2,9],"25":[2,9],"29":[2,9],"30":[2,9],"31":[2,9],"34":[2,9],"36":[2,9],"39":[2,9],"37":[2,9]},{"37":[2,11],"39":[2,11],"36":[2,11],"34":[2,11],"31":[2,11],"30":[2,11],"29":[2,11],"25":[2,11],"20":[2,11],"8":[2,11],"6":[2,11]},{"17":[1,30],"13":[2,14],"15":[2,14],"6":[2,14],"21":[2,14]},{"37":[2,18],"39":[2,18],"36":[2,18],"34":[2,18],"31":[2,18],"30":[2,18],"29":[2,18],"25":[2,18],"20":[2,18],"13":[2,18],"15":[2,18],"6":[2,18],"17":[2,18],"22":[2,18],"23":[2,18],"24":[2,18],"38":[2,18],"21":[2,18]},{"24":[2,31],"23":[2,31],"22":[2,31],"17":[2,31],"6":[2,31],"15":[2,31],"13":[2,31],"20":[2,31],"25":[2,31],"29":[2,31],"30":[2,31],"31":[2,31],"34":[2,31],"36":[2,31],"39":[2,31],"37":[2,31],"38":[2,31],"21":[2,31]},{"1":[2,1]}],
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], table = this.table, yytext = "", yylineno = 0, yyleng = 0, shifts = 0, reductions = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    var parseError = this.yy.parseError = typeof this.yy.parseError == "function" ? this.yy.parseError : this.parseError;

    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
    }


    function checkRecover(st) {
        for (var p in table[st]) {
            if (p == TERROR) {
                return true;
            }
        }
        return false;
    }


    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token];
        }
        return token;
    }

    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected, recovered = false;
    symbol = lex();
    while (true) {
        state = stack[stack.length - 1];
        action = table[state] && table[state][symbol];
        if (typeof action === "undefined" || !action.length || !action[0]) {
            if (!recovering) {
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                }
                if (this.lexer.showPosition) {
                    parseError.call(this, "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", "), {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                } else {
                    parseError.call(this, "Parse error on line " + (yylineno + 1) + ": Unexpected '" + this.terminals_[symbol] + "'", {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                }
            }
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw "Parsing halted.";
                }
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }
            while (true) {
                if (checkRecover(state)) {
                    break;
                }
                if (state == 0) {
                    throw "Parsing halted.";
                }
                popStack(1);
                state = stack[stack.length - 1];
            }
            preErrorSymbol = symbol;
            symbol = TERROR;
            state = stack[stack.length - 1];
            action = table[state] && table[state][TERROR];
            recovering = 3;
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        a = action;
        switch (a[0]) {
          case 1:
            shifts++;
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            stack.push(a[1]);
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
          case 2:
            reductions++;
            len = this.productions_[a[1]][1];
            yyval.$ = vstack[vstack.length - len];
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, a[1], vstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[a[1]][0]);
            vstack.push(yyval.$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
          case 3:
            this.reductionCount = reductions;
            this.shiftCount = shifts;
            return true;
          default:;
        }
    }
    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:"",
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
    this.yytext = this.matched = this.match = "";
    return this;
},
input:function () {
    var ch = this._input[0];
    this.yytext += ch;
    this.yyleng++;
    this.match += ch;
    this.matched += ch;
    var lines = ch.match(/\n/);
    if (lines) {
        this.yylineno++;
    }
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
    return (past.length > 20 ? "..." : "") + past.substr(-20).replace(/\n/g, "");
},
upcomingInput:function () {
    var next = this.match;
    if (next.length < 20) {
        next += this._input.substr(0, 20 - next.length);
    }
    return (next.substr(0, 20) + (next.length > 20 ? "..." : "")).replace(/\n/g, "");
},
showPosition:function () {
    var pre = this.pastInput();
    var c = (new Array(pre.length + 1)).join("-");
    return pre + this.upcomingInput() + "\n" + c + "^";
},
next:function () {
    if (this.done) {
        return this.EOF;
    }
    if (!this._input) {
        this.done = true;
    }
    var token, match, lines;
    if (!this._more) {
        this.yytext = "";
        this.match = "";
    }
    for (var i = 0; i < this.rules.length; i++) {
        match = this._input.match(this.rules[i]);
        if (match) {
            lines = match[0].match(/\n/g);
            if (lines) {
                this.yylineno += lines.length;
            }
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, i);
            if (token) {
                return token;
            } else {
                return;
            }
        }
    }
    if (this._input == this.EOF) {
        return this.EOF;
    } else {
        this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {text: "", token: null, line: this.yylineno});
    }
},
lex:function () {
    var r = this.next();
    if (typeof r !== "undefined") {
        return r;
    } else {
        return this.lex();
    }
}});
lexer.performAction = function anonymous(yy, yy_) {
    switch (arguments[2]) {
      case 0:
        yy.freshLine = true;
        break;
      case 1:
        if (yy.ruleSection) {
            yy.freshLine = false;
        }
        break;
      case 2:
        yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 3);
        return 15;
        break;
      case 3:
        return 13;
        break;
      case 4:
        yy_.yytext = yy_.yytext.replace(/\\"/g, "\"");
        return 39;
        break;
      case 5:
        yy_.yytext = yy_.yytext.replace(/\\'/g, "'");
        return 39;
        break;
      case 6:
        return 17;
        break;
      case 7:
        return 36;
        break;
      case 8:
        return 20;
        break;
      case 9:
        return 21;
        break;
      case 10:
        return 22;
        break;
      case 11:
        return 23;
        break;
      case 12:
        return 24;
        break;
      case 13:
        return 30;
        break;
      case 14:
        return 25;
        break;
      case 15:
        return 37;
        break;
      case 16:
        return 31;
        break;
      case 17:
        return 31;
        break;
      case 18:
        return 29;
        break;
      case 19:
        yy.ruleSection = true;
        return 6;
        break;
      case 20:
        return 38;
        break;
      case 21:
        if (yy.freshLine) {
            this.input("{");
            return 34;
        } else {
            this.unput("y");
        }
        break;
      case 22:
        return 35;
        break;
      case 23:
        yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4);
        return 15;
        break;
      case 24:
        break;
      case 25:
        return 8;
        break;
      default:;
    }
};
lexer.rules = [/^\n+/,/^\s+/,/^y\{[^}]*\}/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^\//,/^\\[a-zA-Z0]/,/^\$/,/^<<EOF>>/,/^\./,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^(?=\{)/,/^\}/,/^%\{(.|\n)*?%\}/,/^./,/^$/];return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined') {
exports.parser = jisonlex;
exports.parse = function () { return jisonlex.parse.apply(jisonlex, arguments); }
exports.main = function commonjsMain(args) {
    var cwd = require("file").path(require("file").cwd());
    if (!args[1]) {
        throw new Error("Usage: " + args[0] + " FILE");
    }
    var source = cwd.join(args[1]).read({charset: "utf-8"});
    exports.parser.parse(source);
}
if (require.main === module) {
	exports.main(require("system").args);
}
}

//*/
},requires:["file","file","system"]});;
return require;
})();