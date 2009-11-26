// LR0, SLR, LARL(1), LR(1) Parser
// Zachary Carter <zcarter@mail.usf.edu> (http://zaa.ch)
// http://www.gnu.org/licenses/gpl-3.0.html

// no browser loader yet (these would be included with <script>)
if (typeof typal === 'undefined')
    var typal = require('./jison/util/typal').typal;

if (typeof Set === 'undefined')
    var Set = require('./jison/util/set').Set;

if (typeof Lex === 'undefined')
    var Lex = require('./jison/lex').Lex;

var Jison = (function () {

function log() {
    if (Jison.DEBUG) {
        print.apply(null,arguments);
    }
}

function NonTerminal(sym) {
    this.sym = sym;
    this.rules = new Set();
    this.first = new Set();
    this.follows = new Set();
    this.nullable = false;
}

function Rule(sym, handle, action, id) {
    this.sym = sym;
    this.handle = handle;
    this.nullable = false;
    this.id = id;
    this.first = new Set();
    this.precedence = 0;
    var l = this.handle.length;
    if (action) {
        var a = action.replace(/\$(?:0|\$)/g, "this.yyval")
            .replace(/\$(\d)/g, "arguments[1][arguments[1].length-"+l+"+$1-1]");
        this.action = Function("yyval", a);
    }
}
Rule.prototype.toString = function () {
    return this.sym+" -> "+this.handle.join(' ');
};

var Parser = typal.beget();

Parser.constructor = function JSParse_Parser(grammer, options) {
    var options = options || {};
    this.terms = {};
    this.operators = {};
    this.rules = new Set();
    this.conflicts = 0;
    this.resolutions = [];
    this.lexData = grammer.lex || {};
    if (grammer.lex) {
        this.lexer = new Lex.RegExpLexer(this.lexData);
    }

    this.DEBUG = options.debug || false;

    this.processGrammer(grammer);
};

Parser.processGrammer = function processGrammerDef(grammer) {
    var bnf = grammer.bnf,
        tokens = grammer.tokens,
        nonterms = this.nonterms = {},
        rules = this.rules,
        self = this;

    if (typeof tokens === 'string')
        tokens = tokens.split(' ');
    var symbols = this._grammerSymbols = tokens;


    // calculate precedence of operators
    var operators = this.operators = processOperators(grammer.operators);

    // build rules from cfg
    buildRules(grammer.bnf, rules, nonterms, symbols, operators);

    // augment the grammer
    this.augmentGrammer(grammer);

    this.terminals = this._grammerSymbols.filter(function (el) { return !self.nonterms[el]; });
}

Parser.augmentGrammer = function augmentGrammer(grammer) {
    // use specified start symbol, or default to first user defined rule
    this.startSymbol = grammer.startSymbol || this.rules.first().sym;
    if (!this.nonterms[this.startSymbol]) {
        throw new Error("Grammer error: startSymbol must be a non-terminal found in your grammer.");
    }
    this.EOF = "$end";

    // augment the grammer
    var acceptRule = new Rule('$accept', [this.startSymbol, '$end'], null, 0);
    this.rules.unshift(acceptRule);

    // prepend parser tokens
    this._grammerSymbols.unshift("$accept","$end");

    this.nonterms["$accept"] = new NonTerminal("$accept");
    this.nonterms["$accept"].rules.push(acceptRule);
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

function buildRules(bnf, rules, nonterms, symbols, operators) {
    for (var sym in bnf) {
        nonterms[sym] = new NonTerminal(sym);
        if (symbols.indexOf(sym) === -1) {
            symbols.push(sym);
        }
        if (typeof bnf[sym] === 'string') {
            bnf[sym] = bnf[sym].split(/\s*\|\s*/g);
        }
        bnf[sym].forEach(function (handle) {
            var r;
            if (handle.constructor === Array) {
                if (typeof handle[1] === 'string' || handle.length == 3) {
                    // semantic action specified
                    r = new Rule(sym, handle[0].split(' '), handle[1], rules.size()+1);
                    // precedence specified also
                    if (handle[2]) {
                        r.precedence = operators[handle[2].prec].precedence;
                    }
                } else {
                    // only precedence specified
                    r = new Rule(sym, handle[0].split(' '), null, rules.size()+1);
                    r.precedence = operators[handle[1].prec].precedence;
                }
            } else {
                r = new Rule(sym, handle.split(' '), null, rules.size()+1);
            }
            if (r.precedence === 0) {
                // set precedence
                for (var i=r.handle.length-1;i>=0;i--) {
                    if (!(r.handle[i] in nonterms) && r.handle[i] in operators) {
                        r.precedence = operators[r.handle[i]].precedence;
                    }
                }
            }

            rules.push(r);
            nonterms[sym].rules.push(r);
        });
    }
}

var LookaheadMixin = {};

LookaheadMixin.afterconstructor = function () {
    this.nullableSets();
    this.firstSets();
    this.followSets();
}

// calculate follow sets typald on first and nullable
LookaheadMixin.followSets = function followSets() {
    var rules = this.rules,
        nonterms = this.nonterms,
        self = this,
        cont = true;

    // add follow $ to start symbol
    nonterms[this.startSymbol].follows.push(this.EOF);

    log('Follow sets');

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        rules.forEach(function (rule, k) {
            //log(rule.sym,nonterms[rule.sym].follows);
            var set = [];
            for (var i=0,n=0,t;t=rule.handle[i];++i) {
                if (!nonterms[t]) continue;

                if (i === rule.handle.length+1) {
                    set = nonterms[rule.sym].follows
                } else {
                    var part = rule.handle.slice(i+1);
                    set = self.first(part);
                    if (self.nullable(part)) {
                        set.concat(nonterms[rule.sym].follows);
                    }
                }
                set.forEach(function (e) {
                    if (!nonterms[t].follows.contains(e)) {
                        nonterms[t].follows.push(e);
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
    } else if (!this.nonterms[symbol]) {
        return new Set([symbol]);
    // non-terminal
    } else {
        return this.nonterms[symbol].first;
    }
}

// fixed-point calculation of FIRST sets
LookaheadMixin.firstSets = function firstSets() {
    var rules = this.rules,
        nonterms = this.nonterms,
        self = this,
        cont = true,
        sym,firsts;

    log('First sets');

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        rules.forEach(function (rule, k) {
            log(rule, rule.first);
            var firsts = self.first(rule.handle);
            if (firsts.size() != rule.first.size()) {
                rule.first = firsts;
                cont=true;
            }
            log(rule, rule.first);
        });

        for (sym in nonterms) {
            log(sym, nonterms[sym].first);
            firsts = new Set();
            nonterms[sym].rules.forEach(function (rule) {
                firsts.joinSet(rule.first);
            });
            if (firsts.size()!=nonterms[sym].first.size()) {
                nonterms[sym].first = firsts;
                cont=true;
            }
            log(sym, nonterms[sym].first);
        }
    }
}

// fixed-point calculation of NULLABLE
LookaheadMixin.nullableSets = function nullableSets() {
    var firsts = this.firsts = {},
        nonterms = this.nonterms,
        self = this,
        cont = true;

    log('Nullables');

    // loop until no further changes have been made
    while(cont) {
        cont = false;

        // check if each rule is nullable
        this.rules.forEach(function (rule, k) {
            log(rule, rule.nullable);
            if (!rule.nullable) {
                for (var i=0,n=0,t;t=rule.handle[i];++i) {
                    if (self.nullable(t)) n++;
                }
                if (n===i) { // rule is nullable if all tokens are nullable
                    rule.nullable = cont = true;
                }
            }
            log(rule, rule.nullable);
        });

        //check if each symbol is nullable
        for (var sym in nonterms) {
            log(sym, nonterms[sym].nullable);
            if (!this.nullable(sym)) {
                for (var i=0,rule;rule=nonterms[sym].rules.item(i);i++) {
                    if (rule.nullable)
                        nonterms[sym].nullable = cont = true;
                }
            }
            log(sym, nonterms[sym].nullable);
        }
    }
}

// check if a token or series of tokens is nullable
LookaheadMixin.nullable = function nullable(symbol) {
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
    } else if (!this.nonterms[symbol]) {
        return false;
        // Non terminal
    } else {
        return this.nonterms[symbol].nullable;
    }
}

var LRParserMixin = {};

LRParserMixin.afterconstructor = function () {
    this.itemSets = this.canonicalCollection();
    this.table = this.parseTable(this.itemSets);
};

LRParserMixin.Item_ = typal.construct({
    constructor: function Item(rule, dot, f) {
        this.rule = rule;
        this.dotPosition = dot || 0;
        this.follows = f || new Set(); 
    },
    currentToken: function () {
        return this.rule.handle[this.dotPosition];
    },
    remainingHandle: function () {
        return this.rule.handle.slice(this.dotPosition+1);
    },
    eq: function (e) {
        return e.rule && e.dotPosition !=null && this.rule===e.rule && this.dotPosition === e.dotPosition;
    },
    toString: function () {
        var temp = this.rule.handle.slice(0);
        temp[this.dotPosition] = '.'+(temp[this.dotPosition]||'');
        return '['+this.rule.sym+" -> "+temp.join(' ')+", "+this.follows.join('/')+']';
    }
});

LRParserMixin.ItemSet_ = typal.construct(Set.prototype, {
    constructor: function ItemSet(set, raw) {
        Set.apply(this, arguments);
    },
    closureFilter: function (closureSet) {
        return closureSet.complement(this);
    }
});

LRParserMixin.closureOperation = function closureOperation(itemSet /*, closureSet*/) {
    var closureSet = arguments[1] || new this.ItemSet_();
    var self = this;

    itemSet = itemSet.closureFilter(closureSet);

    closureSet.concat(itemSet);

    itemSet.forEach(function (item) {
        var token = item.currentToken();
        var b;

        // if token is a non-terminal, recursively add closures
        if (token && self.nonterms[token]) {
            b = self.first(item.remainingHandle());
            if (b.isEmpty()) b = item.follows;
            self.nonterms[token].rules.forEach(function (rule) {
                self.closureOperation(new self.ItemSet_(new self.Item_(rule, 0, b)), closureSet);
            });
        }
    });

    return closureSet;
}

LRParserMixin.gotoOperation = function gotoOperation(itemSet, symbol) {
    var gotoSet = new this.ItemSet_(),
        EOF = this.EOF,
        self = this;

    itemSet.forEach(function (item) {
        if (item.currentToken() == symbol && symbol != EOF) {
            gotoSet.push(new self.Item_(item.rule, item.dotPosition+1, item.follows));
        }
    });

    return gotoSet.isEmpty() ? gotoSet : this.closureOperation(gotoSet);
}

/* Create unique set of item sets
 * */
LRParserMixin.canonicalCollection = function canonicalCollection() {
    var items = this.closureOperation(new this.ItemSet_(new this.Item_(this.rules.first(), 0, new Set(this.EOF)))),
        sets = new Set(items),
        done = new Set(),
        self = this,
        itemSet;

    while (!sets.isEmpty()) {
        itemSet = sets.shift();
        itemSet._goto = {};
        done.push(itemSet);
        // TODO: itemSet could cache the possible next symbols instead of
        // us looping through all
        this._grammerSymbols.forEach(function (sym) {
            var g = self.gotoOperation(itemSet, sym);
            // add g to que if not empty or duplicate
            if (!g.isEmpty()) {
                itemSet._goto[sym] = g; // store goto transition for table
                if (!done.contains(g)) {
                    sets.push(g); 
                }
            }
        });
    }
    log("Canonical");

    log(done.join('\n'));

    return done;
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
        symbols = this._grammerSymbols.slice(0),
        nonterms = this.nonterms,
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
                if (item.currentToken() == stackSymbol) {
                    var gotoState = itemSets.indexOf(itemSet._goto[stackSymbol]);
                    if (nonterms[stackSymbol]) {
                        // store state to go to after a reduce
                        action = gotoState; 
                    } else if (gotoState !== -1 && !hasArray(action, ['s', gotoState]) ) {
                        // store shift-to state
                        if (action.length) {
                            r = resolveConflict(self.rules.item(action[0][1]), op, action[0], ['s', gotoState]);
                            self.resolutions.push([k,stackSymbol,r]);
                            if(r.bydefault)
                                self.conflicts++;
                            action = [r.action];
                        } else {
                            action.push(['s',gotoState]);
                        }
                    } else if (stackSymbol == self.EOF) {
                        action.push(['a']); 
                    }
                }
                // Current position is at the end of a production, try to reduce
                if (!item.currentToken() && !nonterms[stackSymbol]
                    && (!!!self.lookahead || item.follows.contains(stackSymbol)) // LR(1) LALR
                    && (!!!self.simpleLookahead || nonterms[item.rule.sym].follows.contains(stackSymbol)) // SLR
                  ) {
                    if (action.length) {
                        r = resolveConflict(item.rule, op, ['r',item.rule.id], action[0]);
                        self.resolutions.push([k,stackSymbol,r]);
                        if(r.bydefault)
                            self.conflicts++;
                        action = [r.action];
                    } else {
                        action.push(['r',item.rule.id]);
                    }
                    log('reduction:',item);
                }
            });
            state[stackSymbol] = action;
            log('state['+k+','+stackSymbol+'] =',state[stackSymbol]);
        });
    });

    return states;
}

// resolves shift-reduce and reduce-reduce conflicts
function resolveConflict(rule, op, reduce, shift) {
    var sln = {rule: rule, operator: op, r: reduce, s: shift};

    if (shift[0] === 'r') {
        sln.msg = "Resolve R/R conflict (use first rule declared in grammer.)";
        sln.action = shift[1] < reduce[1] ? shift : reduce;
        sln.bydefault = true;
        return sln;
    }

    if (rule.precedence === 0 || !op) {
        sln.msg = "Resolve S/R conflict (shift by default.)";
        sln.bydefault = true;
        sln.action = shift;
    } else if (rule.precedence < op.precedence ) {
        sln.msg = "Resolve S/R conflict (shift for higher precedent operator.)";
        sln.action = shift;
    } else if (rule.precedence === op.precedence) {
        if (op.assoc === "right" ) {
            sln.msg = "Resolve S/R conflict (shift for right associative operator.)";
            sln.action = shift;
        } else if (op.assoc === "left" ) {
            sln.msg = "Resolve S/R conflict (reduce for left associative operator.)";
            sln.action = reduce;
        } else if (op.assoc === "nonassoc" ) {
            sln.msg = "Resolve S/R conflict (no action for non-associative operator.)";
            sln.action = null;
        }
    } else {
        sln.msg = "Resolve conflict (reduce for higher precedent rule.)";
        sln.action = reduce;
    }
    log(sln.msg);

    return sln;
}


function lex() {
    var token;
    token = this.lexer.lex();
    return token || this.EOF;
};

LRParserMixin.parse = function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        table = this.table;

    this.lexer = this.lexer || new Lex.ArrayLexer(this.lexData);
    this.lexer.setInput(input);


    var sym, state, action, a, r, yyval={},p,len,ip=0,newState;
    sym = lex.call(this); 
    while (true) {
        log('stack:',stack, '\n\t\t\tinput:', this.lexer._input);
        log('vstack:',uneval(vstack));
        // set first input
        state = stack[stack.length-1];
        // read action for current state and first input
        action = table[state][sym];
        if (!action || !action[0])
            throw new Error('Parse error. Unexpected symbol: '+sym+".\n stack:"+stack+', input:'+this.lexer._input);

        // this shouldn't happen anymore
        if (action.length > 1)
            log('Warning: multiple actions possible');

        log('action:',action);

        a = action[0]; 

        switch (a[0]) {

            case 's': // shift

                stack.push(sym);++ip;
                sym = lex.call(this); 
                vstack.push(null); // semantic values or junk only, no terminals
                stack.push(action[0][1]); // push state
                break;

            case 'r': // reduce

                p = self.rules.item(action[0][1]);
                len = p.handle[0] == '' ? 0 : p.handle.length;
                if (p.action) {
                    log('semantic action:',p.action);
                    if ((r = p.action.call(yyval,null,vstack)) != undefined ) {
                        return r;
                    }
                } else {
                    yyval.yyval = vstack[vstack.length-len]; // default to $$ = $1
                }

                log('yyval=',yyval.yyval);
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                }
                stack.push(p.sym);    // push nonterminal (reduce)
                vstack.push(yyval.yyval);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                log('reduced by: ',p);
                break;

            case 'a': // accept

                log('stack:',stack, '\n\tinput:', this.lexer._input);
                log('vstack:',vstack);
                return true;
        }

    }

    return true;
}

/*
 * LR(0) Parser
 * */

LR0Parser = Parser.construct(LRParserMixin, {
    type: "lr0",

    closureOperation: function LR0closureOperation(itemSet /*, closureSet*/) {
        var closureSet = arguments[1] || new this.ItemSet_();
        var self = this;

        itemSet = itemSet.closureFilter(closureSet);

        closureSet.concat(itemSet);

        itemSet.forEach(function (item) {
            var token = item.currentToken();

            // if token is a non-terminal, recursively add closures
            if (token && self.nonterms[token]) {
                self.nonterms[token].rules.forEach(function (rule) {
                    self.closureOperation(new self.ItemSet_(new self.Item_(rule, 0)), closureSet);
                });
            }
        });

        return closureSet;
    }
});



/* 
 * Lookahead parser defconstructorions
 *
 * Define base type
 * */
var LRLookaheadParser = Parser.beget(LookaheadMixin, LRParserMixin);

/*
 * SLR Parser
 * */
var SLRParser = LRLookaheadParser.construct({
    type: "slr",
    simpleLookahead: true
});


/*
 * LALR(1) Parser
 * */
var LALRParser = LRLookaheadParser.construct({
    type: "lalr",
    lookahead: true,
    ItemSet_: LRParserMixin.ItemSet_.prototype.construct({
        closureFilter: function (closureSet) {
            return this.filter(function (e) {
                var r = closureSet.indexOf(e);
                // add any additional follows if the item is already in the set
                if (r != -1) closureSet.item(closureSet.indexOf(e)).follows.joinSet(e.follows);
                return !(r != -1);
            });
        }
    })
});


/*
 * LR(1) Parser
 * */
var LR1Parser = LRLookaheadParser.construct({
    type: "lr",
    lookahead: true,
    Item_: LRParserMixin.Item_.prototype.construct({
        eq: function (e) {
            return e.rule && e.dotPosition !=null && this.rule===e.rule && this.dotPosition === e.dotPosition && this.follows.toString()==e.follows.toString();
        }
    })
});


/*
 * LL Parser
 * */
var LLParser = Parser.construct(LookaheadMixin, {
    afterconstructor: function () {
        this.table = this.parseTable(this.rules);
    },
    parseTable: function llParseTable(rules) {
        var table = {},
            self = this;
        rules.forEach(function (rule, i) {
            var row = table[rule.sym] || {};
            (rule.nullable ? self.nonterms[rule.sym].follows : rule.first).forEach(function (token) {
                if (row[token]) {
                    row[token].push(i);
                    self.conflicts++;
                } else {
                    row[token] = [i];
                }
            });
            table[rule.sym] = row;
        });

        return table;
    }
});

return {
    Parser: function (g, opt) {
        opt = opt || {};
        switch(opt.type) {
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

if (typeof exports !== 'undefined')
    exports.Jison = Jison;

//TODO: generator, lump semantic actions
