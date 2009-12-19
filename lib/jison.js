// LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zcarter@mail.usf.edu> (http://zaa.ch)
// http://www.gnu.org/licenses/gpl-3.0.html

if (typeof exports === 'undefined') {
    exports = {};
} else {
    // assume we're in commonjs land
    var system = require("system");
    var typal = require('./jison/util/typal').typal;
    var Set = require('./jison/util/set').Set;
    var RegExpLexer = require('./jison/lex').RegExpLexer;
}

var Jison = exports.Jison = (function () {

function Nonterminal(symbol) {
    this.symbol = symbol;
    this.productions = new Set();
    this.first = new Set();
    this.follows = new Set();
    this.nullable = false;
}

function Production(symbol, handle, id) {
    this.symbol = symbol;
    this.handle = handle;
    this.nullable = false;
    this.id = id;
    this.first = new Set();
    this.precedence = 0;
}
Production.prototype.toString = function () {
    return this.symbol+" -> "+this.handle.join(' ');
};

var Parser = typal.beget();

Parser.constructor = function Jison_Parser(grammar, options) {
    var options = options || {};
    this.terms = {};
    this.operators = {};
    this.productions = [];
    this.conflicts = 0;
    this.resolutions = [];
    this.options = options;
    if (grammar.lex) {
        this.lexer = new RegExpLexer(grammar.lex);
    }

    // source included in semantic action execution scope
    if (grammar.actionInclude) {
        if (typeof grammar.actionInclude === 'function') 
            grammar.actionInclude = String(grammar.actionInclude).replace(/^\s*function \(\) \{/, '').replace(/\}\s*$/, '');
        this.actionInclude = grammar.actionInclude;
    }

    this.DEBUG = options.debug || false;

    this.processGrammar(grammar);
};

Parser.processGrammar = function processGrammarDef(grammar) {
    var bnf = grammar.bnf,
        tokens = grammar.tokens,
        nonterminals = this.nonterminals = {},
        productions = this.productions,
        self = this;

    if (typeof tokens === 'string')
        tokens = tokens.trim().split(' ');
    else
        tokens = tokens.slice(0);
    var symbols = this.symbols = tokens;

    // calculate precedence of operators
    var operators = this.operators = processOperators(grammar.operators);

    // build productions from cfg
    this.buildProductions(grammar.bnf, productions, nonterminals, symbols, operators);

    // augment the grammar
    this.augmentGrammar(grammar);

    this.terminals = this.symbols.filter(function (el) { return !self.nonterminals[el]; });
}

Parser.augmentGrammar = function augmentGrammar(grammar) {
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
    this.symbols.unshift("$accept","$end");

    this.nonterminals["$accept"] = new Nonterminal("$accept");
    this.nonterminals["$accept"].productions.push(acceptProduction);

    // add follow $ to start symbol
    this.nonterminals[this.startSymbol].follows.push(this.EOF);
}

// set precedence and associativity of operators
function processOperators(ops) {
    if (!ops) return {};
    var operators = {};
    for (var i=0,k,prec;prec=ops[i]; i++) {
        for (k=1;k < prec.length;k++)
            operators[prec[k]] = {precedence: i+1, assoc: prec[0]};
    }
    return operators;
}

Parser.buildProductions = function buildProductions(bnf, productions, nonterminals, symbols, operators) {
    var actions = [this.actionInclude, 'switch(arguments[2]) {'],
        prods, symbol;

    for (symbol in bnf) {
        if (!bnf.hasOwnProperty(symbol)) continue;

        nonterminals[symbol] = new Nonterminal(symbol);
        if (symbols.indexOf(symbol) === -1) {
            symbols.push(symbol);
        }
        if (typeof bnf[symbol] === 'string') {
            prods = bnf[symbol].split(/\s*\|\s*/g);
        } else {
            prods = bnf[symbol].slice(0);
        }
        prods.forEach(function (handle) {
            var r, rhs;
            if (handle.constructor === Array) {
                if (typeof handle[0] === 'string')
                    rhs = handle[0].trim().split(' ');
                else 
                    rhs = handle[0].slice(0);

                if (typeof handle[1] === 'string' || handle.length == 3) {
                    // semantic action specified
                    var action = 'case '+(productions.length+1)+':'+handle[1]+'\nbreak;';
                    action = action.replace(/\$(?:0|\$)/g, "this.yyval")
                        .replace(/\$(\d+)/g, "arguments[3][arguments[3].length-"+rhs.length+"+$1-1]");
                    actions.push(action);

                    r = new Production(symbol, rhs, productions.length+1);
                    // precedence specified also
                    if (handle[2]) {
                        r.precedence = operators[handle[2].prec].precedence;
                    }
                } else {
                    // only precedence specified
                    r = new Production(symbol, rhs, productions.length+1);
                    r.precedence = operators[handle[1].prec].precedence;
                }
            } else {
                r = new Production(symbol, handle.trim().split(' '), productions.length+1);
            }
            if (r.precedence === 0) {
                // set precedence
                for (var i=r.handle.length-1;i>=0;i--) {
                    if (!(r.handle[i] in nonterminals) && r.handle[i] in operators) {
                        r.precedence = operators[r.handle[i]].precedence;
                    }
                }
            }

            productions.push(r);
            nonterminals[symbol].productions.push(r);
        });
    }
    actions.push('}');
    this.performAction = Function("yytext","yylineno", actions.join("\n"));
}

Parser.log = function log(){
    if (this.DEBUG) {
        print.apply(null,arguments);
    }
};


/*
 * Mixin for common behaviors of lookahead parsers
 * */
var LookaheadMixin = {};

LookaheadMixin.computeLookaheads = function () {
    this.computeLookaheads = function () {};
    this.nullableSets();
    this.firstSets();
    this.followSets();
}

// calculate follow sets typald on first and nullable
LookaheadMixin.followSets = function followSets() {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true;

    this.log('Follow sets');

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        productions.forEach(function (production, k) {
            self.log(production.symbol,nonterminals[production.symbol].follows);
            // q is used in Simple LALR algorithm determine follows in context
            var q = null;

            var set = [];
            for (var i=0,n=0,t;t=production.handle[i];++i) {
                if (!nonterminals[t]) continue;

                // for Simple LALR algorithm, self.go_ is defined
                if (self.go_)
                    q = self.go_(production.symbol, production.handle.slice(0, i));
                var bool = q === null || q === parseInt(t.split(":")[0]);

                if (i === production.handle.length+1 && bool) {
                    set = nonterminals[production.symbol].follows
                } else {
                    var part = production.handle.slice(i+1);

                    set = self.first(part);
                    if (self.nullable(part) && bool) {
                        set.concat(nonterminals[production.symbol].follows);
                    }
                }
                set.forEach(function (e) {
                    if (!nonterminals[t].follows.contains(e)) {
                        nonterminals[t].follows.push(e);
                        cont = true;
                    }
                });
            }
        });
    }
}

// return the FIRST set of a symbol or series of symbols
LookaheadMixin.first = function first(symbol) {
    // epsilon
    if (symbol === '') {
        return new Set();
    // RHS
    } else if (symbol.constructor === Array) {
        var firsts = new Set();
        for (var i=0,n=0,t;t=symbol[i];++i) {
            this.first(t).forEach(function (e) {
                if (firsts.indexOf(e)===-1)
                firsts.push(e);
            });
            if (!this.nullable(t))
                break;
        }
        return firsts;
    // terminal
    } else if (!this.nonterminals[symbol]) {
        return new Set([symbol]);
    // non-terminal
    } else {
        return this.nonterminals[symbol].first;
    }
}

// fixed-point calculation of FIRST sets
LookaheadMixin.firstSets = function firstSets() {
    var productions = this.productions,
        nonterminals = this.nonterminals,
        self = this,
        cont = true,
        symbol,firsts;

    this.log('First sets');

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        productions.forEach(function (production, k) {
            self.log(production, production.first);
            var firsts = self.first(production.handle);
            if (firsts.size() != production.first.size()) {
                production.first = firsts;
                cont=true;
            }
            self.log(production, production.first);
        });

        for (symbol in nonterminals) {
            this.log(symbol, nonterminals[symbol].first);
            firsts = new Set();
            nonterminals[symbol].productions.forEach(function (production) {
                firsts.joinSet(production.first);
            });
            if (firsts.size()!=nonterminals[symbol].first.size()) {
                nonterminals[symbol].first = firsts;
                cont=true;
            }
            this.log(symbol, nonterminals[symbol].first);
        }
    }
}

// fixed-point calculation of NULLABLE
LookaheadMixin.nullableSets = function nullableSets() {
    var firsts = this.firsts = {},
        nonterminals = this.nonterminals,
        self = this,
        cont = true;

    this.log('Nullables');

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        // check if each production is nullable
        this.productions.forEach(function (production, k) {
            self.log(production, production.nullable);
            if (!production.nullable) {
                for (var i=0,n=0,t;t=production.handle[i];++i) {
                    if (self.nullable(t)) n++;
                }
                if (n===i) { // production is nullable if all tokens are nullable
                    production.nullable = cont = true;
                }
            }
            self.log(production, production.nullable);
        });

        //check if each symbol is nullable
        for (var symbol in nonterminals) {
            this.log(symbol, nonterminals[symbol].nullable);
            if (!this.nullable(symbol)) {
                for (var i=0,production;production=nonterminals[symbol].productions.item(i);i++) {
                    if (production.nullable)
                        nonterminals[symbol].nullable = cont = true;
                }
            }
            this.log(symbol, nonterminals[symbol].nullable);
        }
    }
}

// check if a token or series of tokens is nullable
LookaheadMixin.nullable = function nullable (symbol) {
    // epsilon
    if (symbol === '') {
        return true
    // RHS
    } else if (Object.prototype.toString.apply(symbol) === '[object Array]') {
        for (var i=0,t;t=symbol[i];++i) {
            if (!this.nullable(t))
                return false;
        }
        return true;
    // terminal
    } else if (!this.nonterminals[symbol]) {
        return false;
    // Non terminal
    } else {
        return this.nonterminals[symbol].nullable;
    }
}

/*
 * Mixin for common LR parser behavior
 * */
var LRParserMixin = {};

LRParserMixin.buildTable = function () {
    this.states = this.canonicalCollection();
    this.table = this.parseTable(this.states);
};

LRParserMixin.Item = typal.construct({
    constructor: function Item(production, dot, f, predecessor) {
        this.production = production;
        this.dotPosition = dot || 0;
        this.follows = f || new Set(); 
        this.predecessor = predecessor;
    },
    markedSymbol: function () {
        return this.production.handle[this.dotPosition];
    },
    remainingHandle: function () {
        return this.production.handle.slice(this.dotPosition+1);
    },
    eq: function (e) {
        return e.production && e.dotPosition !=null && this.production===e.production && this.dotPosition === e.dotPosition;
    },
    toString: function () {
        var temp = this.production.handle.slice(0);
        temp[this.dotPosition] = '.'+(temp[this.dotPosition]||'');
        return '['+this.production.symbol+" -> "+temp.join(' ')
            +(this.follows.isEmpty() ? "" : ", "+this.follows.join('/'))
            +']';
    }
});

LRParserMixin.ItemSet = typal.construct(Set.prototype, {
    constructor: Set,
    afterconstructor: function () {
        this.reductions = [];
        this.goes = {};
        this.shifts = false;
        this.inadequate = false;
    }
});

LRParserMixin.closureOperation = function closureOperation (itemSet /*, closureSet*/) {
    var closureSet = arguments[1] || new this.ItemSet();
    var self = this;

    itemSet = closureSet.complement(itemSet);

    closureSet.concat(itemSet);

    itemSet.forEach(function (item) {
        var symbol = item.markedSymbol();

        // if token is a non-terminal, recursively add closures
        if (symbol && self.nonterminals[symbol]) {
            self.nonterminals[symbol].productions.forEach(function (production) {
                self.closureOperation(new self.ItemSet(new self.Item(production, 0)), closureSet);
            });
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

    return closureSet;
}

LRParserMixin.gotoOperation = function gotoOperation (itemSet, symbol) {
    var gotoSet = new this.ItemSet(),
        EOF = this.EOF,
        self = this;

    itemSet.forEach(function (item, n) {
        if (item.markedSymbol() == symbol && symbol != EOF) {
            gotoSet.push(new self.Item(item.production, item.dotPosition+1, item.follows, n));
        }
    });

    return gotoSet.isEmpty() ? gotoSet : this.closureOperation(gotoSet);
}

/* Create unique set of item sets
 * */
LRParserMixin.canonicalCollection = function canonicalCollection () {
    var item1 = new this.Item(this.productions[0], 0, new Set(this.EOF));
    var firstState = this.closureOperation(new this.ItemSet(item1)),
        states = new Set(firstState),
        marked = 0,
        self = this,
        itemSet;

    while (marked !== states.size()) {
        itemSet = states.item(marked); marked++;
        itemSet.edges = {};
        itemSet.forEach(function (item) {
            if(item.markedSymbol())
                self.canonicalCollectionInsert(item.markedSymbol(), itemSet, states, marked-1);
        });
    }
    this.log("Canonical");

    states.forEach(function (state, i) {
        self.log("\nState ",i,"\n"+state.join("\n"), '\n', JSON.stringify(state.edges));
    });

    return states;
}

// Pushes a unique state into the que. Some parsing algorithms may perform additional operations
LRParserMixin.canonicalCollectionInsert = function canonicalCollectionInsert (symbol, itemSet, states, stateNum) {
    var g = this.gotoOperation(itemSet, symbol);
    if (!g.predecessors)
        g.predecessors = {};
    // add g to que if not empty or duplicate
    if (!g.isEmpty()) {
        var i = states.indexOf(g);
        if (i === -1) {
            itemSet.edges[symbol] = states.size(); // store goto transition for table
            states.push(g); 
            g.predecessors[symbol] = [stateNum];
        } else {
            itemSet.edges[symbol] = i; // store goto transition for table
            states.item(i).predecessors[symbol].push(stateNum);
        }
    }
}

// a is an array that conatins a 2nd order array b
function hasArray(a,b) {
    return a.some(function (el) {
        return el.length === b.length && el.every(function (e,i) {
            return b[i] == e;
        });
    });
}

LRParserMixin.parseTable = function parseTable(itemSets) {
    var states = [],
        symbols = this.symbols.slice(0),
        nonterminals = this.nonterminals,
        operators = this.operators,
        self = this;

    symbols.shift(); // exclude start symbol

    // for each item set
    itemSets.forEach(function (itemSet, k) {
        var state = states[k] = {};
        // if contains a set where symbol is in front
        symbols.forEach(function (stackSymbol) {
            var action = [];
            var op = operators[stackSymbol];
            itemSet.forEach(function (item, j) {
                var r;
                // find shift and goto actions
                if (item.markedSymbol() == stackSymbol) {
                    var gotoState = itemSet.edges[stackSymbol];
                    if (nonterminals[stackSymbol]) {
                        // store state to go to after a reduce
                        action = gotoState; 
                    } else if (stackSymbol == self.EOF) {
                        // accept
                        action.push(['a']); 
                    } else if (gotoState !== -1 && action && (!action.length || !hasArray(action, ['s', gotoState])) ) {
                        // store shift-to state
                        if (action.length) {
                            r = resolveConflict(self.productions[action[0][1]], op, action[0], ['s', gotoState]);
                            self.resolutions.push([k,stackSymbol,r]);
                            self.log(r.msg);
                            if (r.bydefault) {
                                self.conflicts++;
                                if (self.options.noDefaultResolve)
                                    action.push(r.s);
                            } else {
                                action = r.action ? [r.action] : null;
                            }
                        } else {
                            action.push(['s',gotoState]);
                        }
                    }
                }
                // Reading a terminal and current position is at the end of a production, try to reduce
                if (!item.markedSymbol() && !nonterminals[stackSymbol] &&
                    (!self.lookAhead || self.lookAhead(itemSet, stackSymbol, item))) {
                    if (action.length) {
                        r = resolveConflict(item.production, op, ['r',item.production.id], action[0]);
                        self.resolutions.push([k,stackSymbol,r]);
                        self.log(r.msg);
                        if (r.bydefault) {
                            self.conflicts++;
                            if (self.options.noDefaultResolve)
                                action.push(r.r);
                        } else {
                            action = r.action ? [r.action] : null;
                        }
                    } else {
                        action.push(['r',item.production.id]);
                    }
                }
            });
            if (typeof action === 'number' || action && action.length) {
                //print(k, stackSymbol, action);
                state[stackSymbol] = action;
            }
        });
    });

    return states;
}

// resolves shift-reduce and reduce-reduce conflicts
function resolveConflict(production, op, reduce, shift) {
    var sln = {production: production, operator: op, r: reduce, s: shift};

    if (shift[0] === 'r') {
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
            sln.action = undefined;
        }
    } else {
        sln.msg = "Resolve conflict (reduce for higher precedent production.)";
        sln.action = reduce;
    }

    return sln;
}

LRParserMixin.parse = function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        EOF = this.productions[0].handle[1];

    this.lexer = this.lexer;
    this.lexer.setInput(input);

    function lex() {
        var token;
        token = self.lexer.lex();
        return token || EOF;
    };

    var symbol, state, action, a, r, yyval={},p,len,ip=0,newState;
    symbol = lex(); 
    while (true) {
        this.log('stack:',JSON.stringify(stack), '\n\t\t\tinput:', this.lexer._input);
        this.log('vstack:',JSON.stringify(vstack));
        // set first input
        state = stack[stack.length-1];
        // read action for current state and first input
        action = table[state] && table[state][symbol];

        if (typeof action == 'undefined' || !action.length)
            throw new Error('Parse error. Unexpected symbol: '+symbol+".\n stack:"+JSON.stringify(stack)+', input:'+this.lexer.upcomingInput());

        this.log('action:',action);

        // this shouldn't happen, unless resolve defaults are off
        if (action.length > 1)
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);

        a = action[0]; 

        switch (a[0]) {

            case 's': // shift

                stack.push(symbol);++ip;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex(); 
                vstack.push(null); // semantic values or junk only, no terminals
                stack.push(a[1]); // push state
                break;

            case 'r': // reduce

                p = this.productions[a[1]];
                len = p.handle[0] == '' ? 0 : p.handle.length;
                this.log('reduce by: ',p);

                // perform semantic action
                yyval.yyval = vstack[vstack.length-len]; // default to $$ = $1
                r = this.performAction.call(yyval, yytext, yylineno, a[1], vstack);

                if (r != undefined) {
                    return r;
                }

                this.log('yyval=',JSON.stringify(yyval.yyval));

                // pop off stack
                if (len) {
                    this.log('produciton length:',len);
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                }

                stack.push(p.symbol);    // push nonterminal (reduce)
                vstack.push(yyval.yyval);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 'a': // accept

                this.log('stack:',stack, '\n\tinput:', this.lexer._input);
                this.log('vstack:',JSON.stringify(vstack));
                return true;
        }

    }

    return true;
}

LRParserMixin.generate = function (opt) {
    var code = "";
    if (opt.commonjs || this.options.moduleType === "commonjs")
        code = this.generateCommonJSModule();
    else
        code = this.generateModule();

    return code;
};

LRParserMixin.generateCommonJSModule = function generateCommonJSModule(opt) {
    opt = opt || {};
    var moduleName = opt.moduleName || "parser";
    var out = "/* Jison generated parser as commonjs module */";
    out += this.generateModule(opt);
    out += "\nexports.parse = function () { return "+moduleName+".parse.apply("+moduleName+", arguments); }";

    return out;
};

LRParserMixin.generateModule = function generateModule(opt) {
    opt = opt || {};
    var moduleName = opt.moduleName || "parser";
    var out = "/* Jison generated parser */";
    out += "var "+moduleName+" = (function(){";
    out += "var parser = "+this.generateModule_();
    out += opt.lexerSource || this.lexer.generateModule();
    out += "\nparser.lexer = lexer; return parser; })();"

    return out;
};

LRParserMixin.generateModule_ = function generateModule() {
    var out = "{";
    out += [
        "log: " + String(this.log),
        "productions: " + JSON.stringify(this.productions),
        "performAction: " + String(this.performAction),
        "table: " + JSON.stringify(this.table),
        "parse: " + String(this.parse)
        ].join(",\n");
    out += "};";

    return out;
};


/*
 * LR(0) Parser
 * */

var lr0 = Parser.beget(LookaheadMixin, LRParserMixin, {
    type: "LR(0)",
    afterconstructor: function () {
        this.buildTable();
    }
});

var LR0Parser = exports.LR0Parser = lr0.construct();

/*
 * Simple LALR(1)
 * */

var lalr = Parser.beget(LookaheadMixin, LRParserMixin, {
    type: "LALR(1)",

    afterconstructor: function (grammar, options) {
        options = options || {};
        this.states = this.canonicalCollection();

        var newg = this.newg = typal.beget(LookaheadMixin,{
            oldg: this,
            log: this.log,
            DEBUG: this.DEBUG,
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
    },

    // returns true if LALR item can be followed by symbol
    // or if using on demand lookahead and the state is adequate
    // if state is inadequate, we'll need the on demand lookahead to resolve conflict
    lookAhead: function LALR_lookahead (state, symbol, item) {
        return ((!!this.onDemandLookahead && !state.inadequate) || item.follows.contains(symbol));
    },
    go: function (p, w) {
        var q = parseInt(p);
        for (var i=0;i<w.length;i++) {
            q = this.states.item(q).edges[w[i]] || q;
        }
        return q;
    },
    goPath: function (p, w) {
        var q = parseInt(p),
            path = [];
        for (var i=0;i<w.length;i++) {
            path.push(w[i] ? q+":"+w[i] : '');
            q = this.states.item(q).edges[w[i]] || q;
        }
        return {path: path, endState: q};
    },
    // every disjoint reduction of a nonterminal becomes a produciton in G'
    buildNewGrammar: function () {
        var self = this,
            newg = this.newg;

        this.states.forEach(function (state, i) {
            state.forEach(function (item) {
                if (item.dotPosition === 0) {
                    // new symbols are a combination of state and transition symbol
                    var symbol = i+":"+item.production.symbol;
                    if (!newg.nonterminals[symbol])
                        newg.nonterminals[symbol] = new Nonterminal(symbol);
                    var pathInfo = self.goPath(i, item.production.handle);
                    var p = new Production(symbol, pathInfo.path, newg.productions.length);
                    newg.productions.push(p);
                    newg.nonterminals[symbol].productions.push(p);

                    // store the transition that get's 'backed up to' after reduction on path
                    var handle = item.production.handle.join(' ');
                    if (!self.states.item(pathInfo.endState).goes[handle])
                        self.states.item(pathInfo.endState).goes[handle] = [];
                    self.states.item(pathInfo.endState).goes[handle].push(symbol);

                    self.log('new production:',p);
                }
            });
            if (state.inadequate)
                self.inadequateStates.push(i);
        });
    },
    unionLookaheads: function () {
        var self = this,
            newg = this.newg,
            states = !!this.onDemandLookahead ? this.inadequateStates : this.states;

        states.forEach(function (i) {
            var state = typeof i === 'number' ? self.states.item(i) : i,
                follows = new Set();
            state.reductions.forEach(function (item) {
                state.goes[item.production.handle.join(' ')].forEach(function (symbol) {
                    newg.nonterminals[symbol].follows.forEach(function (symbol) {
                        var terminal = symbol.slice(symbol.indexOf(":")+1);
                        if (!item.follows.contains(terminal))
                            item.follows.push(terminal);
                    });
                });
                //self.log('unioned item', item);
            });
        });
    }
});

var LALRParser = lalr.construct();

/* 
 * Lookahead parser definitions
 *
 * Define base type
 * */
var LRLookaheadParser = Parser.beget(LookaheadMixin, {
    afterconstructor: function () {
        this.computeLookaheads();
    }
}, LRParserMixin, {afterconstructor: function () { this.buildTable();}});

/*
 * SLR Parser
 * */
var SLRParser = LRLookaheadParser.construct({
    type: "SLR(1)",
    // returns true iff nonterminal of production can be followed by symbol
    lookAhead: function SLR_lookAhead (state, symbol, item) {
        return this.nonterminals[item.production.symbol].follows.contains(symbol);
    }
});


/*
 * LR(1) Parser
 * */
var lr1 = LRLookaheadParser.beget({
    type: "Canonical LR(1)",
    // returns true iff LR item can be followed by symbol
    lookAhead: function LR_lookAhead (state, symbol, item) {
        return item.follows.contains(symbol);
    },
    Item: LRParserMixin.Item.prototype.construct({
        eq: function (e) {
            return e.production && e.dotPosition !=null && this.production===e.production && this.dotPosition === e.dotPosition && this.follows.eq(e.follows);
        }
    }),

    closureOperation: function LR_ClosureOperation (itemSet /*, closureSet*/) {
        var closureSet = arguments[1] || new this.ItemSet();
        var self = this;

        itemSet = closureSet.complement(itemSet);

        closureSet.concat(itemSet);

        itemSet.forEach(function (item) {
            var symbol = item.markedSymbol();
            var b;

            // if token is a nonterminal, recursively add closures
            if (symbol && self.nonterminals[symbol]) {
                b = self.first(item.remainingHandle());
                if (b.isEmpty()) b = item.follows;
                self.nonterminals[symbol].productions.forEach(function (production) {
                    self.closureOperation(new self.ItemSet(new self.Item(production, 0, b)), closureSet);
                });
            }
        });

        return closureSet;
    }
});

var LR1Parser = exports.LR1Parser = lr1.construct();

/*
 * LL Parser
 * */
var LLParser = Parser.construct(LookaheadMixin, {
    afterconstructor: function () {
        this.computeLookaheads();
        this.table = this.parseTable(this.productions);
    },
    parseTable: function llParseTable(productions) {
        var table = {},
            self = this;
        productions.forEach(function (production, i) {
            var row = table[production.symbol] || {};
            var tokens = production.first;
            if (self.nullable(production.handle))
                tokens.joinSet(self.nonterminals[production.symbol].follows);
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

return {
    Parser: function (g, opt) {
        opt = opt || {};
        switch (opt.type) {
            case 'lr0':
                return new LR0Parser(g, opt);
            case 'slr':
                return new SLRParser(g, opt);
            case 'lr':
                return new LR1Parser(g, opt);
            case 'll':
                return new LLParser(g, opt);
            case 'lalr':
            default:
                return new LALRParser(g, opt);
        }
    }
};

})();

exports.main = function main (args) {
};

if (typeof require !== 'undefined' && require.main === module)
    exports.main(system.args);

