// Jison, an LR(0), SLR(1), LARL(1), LR(1) Parser Generator
// Zachary Carter <zach@carter.name>
// MIT X Licensed

if (typeof exports === 'undefined') {
    exports = {};
} else {
    // assume we're in commonjs land
    var system = require("system");
    var typal = require('./jison/util/typal').typal;
    var Set = require('./jison/util/set').Set;
    var RegExpLexer = require('./jison/lex').RegExpLexer;
}

var Jison = exports.Jison = exports;

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
    constructor: function (symbol) {
        this.symbol = symbol;
        this.productions = new Set();
        this.first = new Set();
        this.follows = new Set();
        this.nullable = false;
    }
});

var Production = typal.construct({
    constructor: function (symbol, handle, id) {
        this.symbol = symbol;
        this.handle = handle;
        this.nullable = false;
        this.id = id;
        this.first = new Set();
        this.precedence = 0;
    },
    toString: function () {
        return this.symbol+" -> "+this.handle.join(' ');
    }
});

var Parser = typal.beget();

Parser.constructor = function Jison_Parser(grammar, opt) {
    var options = typal.mix.call({}, grammar.options, opt);
    this.terms = {};
    this.operators = {};
    this.productions = [];
    this.conflicts = 0;
    this.resolutions = [];
    this.options = options;
    this.yy = {}; // accessed as yy free variable in the parser/lexer actions

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

    if (tokens) {
        if (typeof tokens === 'string')
            tokens = tokens.trim().split(' ');
        else
            tokens = tokens.slice(0);
    }

    var symbols = this.symbols = [];

    // calculate precedence of operators
    var operators = this.operators = processOperators(grammar.operators);

    // build productions from cfg
    this.buildProductions(grammar.bnf, productions, nonterminals, symbols, operators);

    if (tokens && this.terminals.length !== tokens.length) {
        self.log("Warning: declared tokens differ from tokens found in rules.");
        self.log(this.terminals);
        self.log(tokens);
    }

    // augment the grammar
    this.augmentGrammar(grammar);
};

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
    this.symbols_["$accept"] = 0;
    this.symbols_["$end"] = 1;
    this.terminals.unshift("$end");

    this.nonterminals["$accept"] = new Nonterminal("$accept");
    this.nonterminals["$accept"].productions.push(acceptProduction);

    // add follow $ to start symbol
    this.nonterminals[this.startSymbol].follows.push(this.EOF);
};

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
    var actions = [this.actionInclude || "", "var $$ = arguments[4],$0=arguments[4].length;",'switch(arguments[3]) {'],
        prods, symbol;
    var productions_ = [0];
    var symbolId = 1;
    var symbols_ = {};

    function addSymbol (s) {
        if (s && !symbols_[s]) {
            symbols_[s] = ++symbolId;
            symbols.push(s);
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

        prods.forEach(function (handle) {
            var r, rhs, i;
            if (handle.constructor === Array) {
                if (typeof handle[0] === 'string')
                    rhs = handle[0].trim().split(' ');
                else 
                    rhs = handle[0].slice(0);

                for (i=0; i<rhs.length; i++) if (!symbols_[rhs[i]]) {
                    addSymbol(rhs[i]);
                }

                if (typeof handle[1] === 'string' || handle.length == 3) {
                    // semantic action specified
                    var action = 'case '+(productions.length+1)+':'+handle[1]+'\nbreak;';
                    action = action.replace(/\$(?:0|\$)/g, "this.$")
                        .replace(/\$(\d+)/g, "$$$[\$0-"+rhs.length+"+$1-1]");
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
                rhs = handle.trim().split(' ');
                for (i=0; i<rhs.length; i++) if (!symbols_[rhs[i]]) {
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

    this.terminals = terms;
    this.terminals_ = terms_;
    this.symbols_ = symbols_;

    this.productions_ = productions_;
    actions.push('}');
    this.performAction = Function("yytext","yylineno","yy", actions.join("\n"));
};

Parser.log = function log(){
    if (this.DEBUG) {
        print.apply(null,arguments);
    }
};


/*
 * Mixin for common behaviors of lookahead parsers
 * */
var LookaheadMixin = {};

LookaheadMixin.computeLookaheads = function computeLookaheads () {
    this.computeLookaheads = function () {};
    this.nullableSets();
    this.firstSets();
    this.followSets();
};

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
            var q;
            var ctx = !!self.go_;

            var set = [];
            for (var i=0,n=0,t;t=production.handle[i];++i) {
                if (!nonterminals[t]) continue;

                // for Simple LALR algorithm, self.go_ checks if 
                if (ctx)
                    q = self.go_(production.symbol, production.handle.slice(0, i));
                var bool = !ctx || q === parseInt(t.split(":")[0]);

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
};

// return the FIRST set of a symbol or series of symbols
LookaheadMixin.first = function first(symbol) {
    // epsilon
    if (symbol === '') {
        return new Set();
    // RHS
    } else if (symbol instanceof Array) {
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
    // nonterminal
    } else {
        return this.nonterminals[symbol].first;
    }
};

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
            var firsts = self.first(production.handle);
            if (firsts.size() != production.first.size()) {
                production.first = firsts;
                cont=true;
            }
        });

        for (symbol in nonterminals) {
            firsts = new Set();
            nonterminals[symbol].productions.forEach(function (production) {
                firsts.joinSet(production.first);
            });
            if (firsts.size()!=nonterminals[symbol].first.size()) {
                nonterminals[symbol].first = firsts;
                cont=true;
            }
        }
    }
};

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
LookaheadMixin.nullable = function nullable (symbol) {
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

LRParserMixin.ItemSet = Set.prototype.construct({
    afterconstructor: function () {
        this.reductions = [];
        this.goes = {};
        this.edges = {};
        this.shifts = false;
        this.inadequate = false;
    }
});

LRParserMixin.closureOperation = function closureOperation (itemSet /*, closureSet*/) {
    var closureSet = new this.ItemSet();
    var self = this;

    var set = itemSet,
        itemQueue, syms = {};

    do {
    itemQueue = new Set();
    closureSet.concat(set);
    set.forEach(function (item) {
        var symbol = item.markedSymbol();

        // if token is a non-terminal, recursively add closures
        if (symbol && self.nonterminals[symbol]) {
            if(!syms[symbol]) {
                self.nonterminals[symbol].productions.forEach(function (production) {
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
};

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
};

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
};

LRParserMixin.parseTable = function parseTable(itemSets) {
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
                if (item.markedSymbol() == stackSymbol) {
                    var gotoState = itemSet.edges[stackSymbol];
                    if (nonterminals[stackSymbol]) {
                        // store state to go to after a reduce
                        self.log(k, stackSymbol, 'g'+gotoState);
                        state[self.symbols_[stackSymbol]] = gotoState; 
                    } else {
                        self.log(k, stackSymbol, 's'+gotoState);
                        state[self.symbols_[stackSymbol]] = [[s,gotoState]];
                    }
                }
            });
        }

        // set accept action
        itemSet.forEach(function (item, j) {
            if (item.markedSymbol() == self.EOF) {
                // accept
                state[self.symbols_[self.EOF]] = [[a]]; 
                self.log(k, self.EOF, state[self.EOF]);
            }
        });

        var allterms = self.lookAheads ? false : self.terminals;

        // set reductions and resolve potential conflicts
        itemSet.reductions.forEach(function (item, j) {
            // if parser uses lookahead, only enumerate those terminals
            var terminals = allterms || self.lookAheads(itemSet, item);

            terminals.forEach(function (stackSymbol) {
                action = state[self.symbols_[stackSymbol]] || [];
                var op = operators[stackSymbol];
                // Reading a terminal and current position is at the end of a production, try to reduce
                if (action.length) {
                    var sol = resolveConflict(item.production, op, [r,item.production.id], action[0]);
                    self.resolutions.push([k,stackSymbol,sol]);
                    self.log(sol.msg);
                    if (sol.bydefault) {
                        self.conflicts++;
                        if (self.options.noDefaultResolve)
                            action.push(sol.r);
                    } else {
                        action = [sol.action];
                    }
                } else {
                    action.push([r,item.production.id]);
                }
                if (action && action.length) {
                    self.log(k, stackSymbol, action);
                    state[self.symbols_[stackSymbol]] = action;
                }
            });
        });

    });

    return states;
};

// resolves shift-reduce and reduce-reduce conflicts
function resolveConflict(production, op, reduce, shift) {
    var sln = {production: production, operator: op, r: reduce, s: shift},
        s = 1, // shift
        r = 2, // reduce
        a = 3; // accept

    if (shift[0] === r) {
        sln.msg = "Resolve R/R conflict (use first production declared in grammar.)";
        sln.action = shift[1] < reduce[1] ? shift : reduce;
        sln.bydefault = true;
        //print(production, reduce[0]);
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

LRParserMixin.parseError = function parseError(str, hash) {
    throw new Error(str);
};

LRParserMixin.parse = function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        table = this.table,
        yytext = '',
        yylineno = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;

    var parseError = this.yy.parseError = this.yy.parseError || this.parseError;

    function lex() {
        var token;
        token = self.lexer.lex();
        return token ? self.symbols_[token] : 1; // EOF = 1
    };

    var symbol, state, action, a, r, yyval={},p,len,ip=0,newState, expected;
    symbol = lex(); 
    while (true) {
        this.log('stack:',JSON.stringify(stack), '\n\t\t\tinput:', this.lexer._input);
        this.log('vstack:',JSON.stringify(vstack));
        // set first input
        state = stack[stack.length-1];
        // read action for current state and first input
        action = table[state] && table[state][symbol];

        if (typeof action == 'undefined' || !action.length || !action[0]) {
            expected = [];
            for (p in table[state]) if (this.terminals_[p] && p != 1) {
                expected.push("'"+this.terminals_[p]+"'");
            }
            self.log("stack:",JSON.stringify(stack), 'symbol:',symbol, 'input', this.lexer.upcomingInput());
            parseError('Parse error on line '+(yylineno+1)+'. Expecting: '+expected.join(', ')+"\n"+this.lexer.showPosition(),
                    {text: this.lexer.match, token: symbol, line: this.lexer.yylineno});
        }

        this.log('action:',action);

        // this shouldn't happen, unless resolve defaults are off
        if (action.length > 1)
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);

        a = action[0]; 

        switch (a[0]) {

            case 1: // shift

                stack.push(symbol);++ip;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex(); 
                vstack.push(null); // semantic values or junk only, no terminals
                stack.push(a[1]); // push state
                break;

            case 2: // reduce

                len = this.productions_[a[1]][1];
                this.log('reduce by: ', this.productions ? this.productions[a[1]] : a[1]);

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                r = this.performAction.call(yyval, yytext, yylineno, this.yy, a[1], vstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                this.log('yyval=',JSON.stringify(yyval.$));

                // pop off stack
                if (len) {
                    this.log('production length:',len);
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

                this.log('stack:',stack, '\n\tinput:', this.lexer._input);
                this.log('vstack:',JSON.stringify(vstack));
                return true;
        }

    }

    return true;
};

LRParserMixin.generate = function (opt) {
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

LRParserMixin.generateCommonJSModule = function generateCommonJSModule (opt) {
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

LRParserMixin.generateModule = function generateModule (opt) {
    opt = typal.mix.call({}, this.options, opt);
    var moduleName = opt.moduleName || "parser";
    var out = "/* Jison generated parser */\n";
    out += (moduleName.match(/\./) ? moduleName : "var "+moduleName)+" = (function(){";
    out += "\nvar parser = "+this.generateModule_();
    out += opt.lexerSource || this.lexer.generateModule();
    out += "\nparser.lexer = lexer; return parser; })();"

    return out;
};

LRParserMixin.generateModule_ = function generateModule () {
    var out = "{";
    out += [
        "log: " + String(this.log),
        "yy: {}",
        "symbols_: " + JSON.stringify(this.symbols_),
        "terminals_: " + JSON.stringify(this.terminals_),
        "productions_: " + JSON.stringify(this.productions_),
        "performAction: " + String(this.performAction),
        "table: " + JSON.stringify(this.table),
        "parseError: " + String(this.parseError),
        "parse: " + String(this.parse)
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
    this.parse(source);
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

    lookAheads: function LALR_lookaheads (state, item) {
        return (!!this.onDemandLookahead && !state.inadequate) ? this.terminals : item.follows;
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
var LRLookaheadParser = Parser.beget(LookaheadMixin, LRParserMixin, {
    afterconstructor: function () {
        this.computeLookaheads();
        this.buildTable();
    }
});

/*
 * SLR Parser
 * */
var SLRParser = exports.SLRParser = LRLookaheadParser.construct({
    type: "SLR(1)",

    lookAheads: function SLR_lookAhead (state, item) {
        return this.nonterminals[item.production.symbol].follows;
    }
});


/*
 * LR(1) Parser
 * */
var lr1 = LRLookaheadParser.beget({
    type: "Canonical LR(1)",

    lookAheads: function LR_lookAheads (state, item) {
        return item.follows;
    },
    Item: LRParserMixin.Item.prototype.construct({
        eq: function (e) {
            return e.production && e.dotPosition !=null && this.production===e.production && this.dotPosition === e.dotPosition && this.follows.eq(e.follows);
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
            var symbol = item.markedSymbol();
            var b;

            // if token is a nonterminal, recursively add closures
            if (symbol && self.nonterminals[symbol]) {
                b = self.first(item.remainingHandle());
                if (b.isEmpty()) b = item.follows;
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

var LR1Parser = exports.LR1Parser = lr1.construct();

/*
 * LL Parser
 * */
var ll = Parser.beget(LookaheadMixin, {
    type: "LL(1)",

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

var LLParser = exports.LLParser = ll.construct();

return function Parser (g, options) {
        var opt = typal.mix.call({}, g.options, options);
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
        grammar.lex = JSON.parse(lfile.read({charset: "utf-8"}));
    }

    if (!opt.moduleName)
        opt.moduleName = gfile.basename().replace(new RegExp(gfile.extension()+"$"), "");
    if (!opt.moduleType)
        opt.moduleType = "commonjs";

    var parser = new Jison.Parser(grammar, opt);
        fname = fs.path(fs.cwd()).join(opt.moduleName + ".js"),
        source = parser.generate(opt),
        stream = fname.open("w");

    stream.print(source);
    stream.close();
};

