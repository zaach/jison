// LR0, SLR, LARL(1), LR(1) Parser
// Zachary Carter <zcarter@mail.usf.edu> (http://zaa.ch)
// http://www.gnu.org/licenses/gpl-3.0.html

if(typeof load !== 'undefined')
    load("set.js");

var JSParse = (function (){

function log(){
  if(JSParse.DEBUG)
    print.apply(null,arguments);
}

function Rule(sym, handle, action, id) {
  this.sym = sym;
  this.handle = handle;
  this.nullable = false;
  this.id = id;
  this.first = new Set();
  this.precedence = 0;
  var l = this.handle.length;
  if(action){
    var a = action.replace(/\$(?:0|\$)/g, "this.yyval")
                  .replace(/\$(\d)/g, "arguments[1][arguments[1].length-"+l+"+$1-1]");
    this.action = Function("yyval", a);
  }
}
  Rule.prototype.toString = function(){
    return this.sym+" -> "+this.handle.join(' ');
  };

function Item(rule, dot, f) {
  this.rule = rule;
  this.dotPosition = dot || 0;
  this.follows = f || new Set(); 
}
  Item.prototype.currentToken = function(){
    return this.rule.handle[this.dotPosition];
  };
  Item.prototype.remainingHandle = function(){
    return this.rule.handle.slice(this.dotPosition+1);
  };
  Item.prototype.eq = function(e){
    return e.rule && e.dotPosition !=null && this.rule===e.rule && this.dotPosition === e.dotPosition;
  };
  Item.prototype.toString = function(){
    var temp = this.rule.handle.slice(0);
    temp[this.dotPosition] = '.'+(temp[this.dotPosition]||'');
    return '['+this.rule.sym+" -> "+temp.join(' ')+", "+this.follows.join('/')+']';
  };

function LRItem(rule, dot, f) {
  this.rule = rule;
  this.dotPosition = dot || 0;
  this.follows = f || new Set(); 
}
  LRItem.prototype = new Item();
  LRItem.prototype.eq = function(e){
    return e.rule && e.dotPosition !=null && this.rule===e.rule && this.dotPosition === e.dotPosition && this.follows.toString()==e.follows.toString();
  };

function NonTerminal(sym){
  this.sym = sym;
  this.rules = new Set();
  this.first = new Set();
  this.follows = new Set();
  this.nullable = false;
}

// Filter method to use in closure operation
// declared here for cachability
var _cfs = {};

_cfs.lalr = function(itemSet, closureSet){
  return itemSet.filter(function (e){
      var r = closureSet.indexOf(e);
      // add any additional follows if the item is already in the set
      if(r != -1) closureSet.item(closureSet.indexOf(e)).follows.joinSet(e.follows);
      return !(r != -1);
  });
};

_cfs.lr = function(itemSet, closureSet){
  return closureSet.complement(itemSet);
};

_cfs.slr = _cfs.lr0 = _cfs.lr;

var Parser = function JSParse_Parser(grammer, options){
  var options = options || {};
  this.terms = {};
  this.operators = {};
  this.rules = new Set();
  this.conflicts = 0;
  this.resolutions = [];
    var self = this;

  // augment the grammer
  var acceptRule = new Rule('$accept', [grammer.startSymbol, '$end'], null, 0);
  this.rules.push(acceptRule);

  this.DEBUG = options.debug || false;
  this.type = options.type || "lalr"; // LALR by default

  // tweak algorithms based on parser type
  this._closureFilter = _cfs[this.type];
  this._Item = this.type === "lr" ? LRItem : Item;

  proccessGrammerDef.call(this, grammer);

  if(!this.nonterms[grammer.startSymbol]){
    throw new Error("Grammer error: startSymbol must be a non-terminal found in your grammer.");
  }

  this.startSymbol = grammer.startSymbol;
  this.EOF = "$end";

  // prepend parser tokens
  this._grammerSymbols.unshift("$end");
  this._grammerSymbols.unshift("$accept");

  this.nonterms["$accept"] = new NonTerminal("$accept");
  this.nonterms["$accept"].rules.push(acceptRule);

  this.terminals = this._grammerSymbols.filter(function(el){ return !self.nonterms[el]; });

  if(this.type !== 'lr0'){
    this.nullableSets();
    this.firstSets();
    this.followSets();
  }

  if(this.type === 'll'){
      this.table = this.llParseTable(this.rules);
  } else {
      this.itemSets = this.canonicalCollection();
      this.table = this.parseTable(this.itemSets);
  }
};

function proccessGrammerDef(grammer){
    var bnf = grammer.bnf,
        tokens = grammer.tokens,
        operators = this.operators,
        nonterms = this.nonterms = {},
        rules = this.rules;

  if(typeof tokens === 'string')
    tokens = tokens.split(' ');
  var symbols = this._grammerSymbols = tokens;

    // set precedence and associativity of operators
    if(grammer.operators){
        for(var i=0,k,prec;prec=grammer.operators[i]; i++){
            for(k=1;k < prec.length;k++)
                operators[prec[k]] = {precedence: i+1, assoc: prec[0]};
        }
    }

  for(var sym in bnf) {
    nonterms[sym] = new NonTerminal(sym);
    if(typeof bnf[sym] === 'string') bnf[sym] = bnf[sym].split(/\s*\|\s*/g);
    bnf[sym].forEach(function (handle){
        var r;
        if(symbols.indexOf(sym) === -1){
            symbols.push(sym);
        }
        if(handle.constructor === Array){
            // semantic action specified
            r = new Rule(sym, handle[0].split(' '), handle[1], rules.size());
        } else {
            r = new Rule(sym, handle.split(' '), null, rules.size());
        }
        // set precedence
        for(var i=r.handle.length-1;i>=0;i--){
            if(!(r.handle[i] in nonterms) && r.handle[i] in operators){
                r.precedence = operators[r.handle[i]].precedence;
            }
        }

        rules.push(r);
        nonterms[sym].rules.push(r);
    });
  }
}


function followSets(){
  var rules = this.rules,
    nonterms = this.nonterms,
    self = this,
    cont = true;

  // add follow $ to start symbol
  nonterms[this.startSymbol].follows.push(this.EOF);

  log('Follow sets');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      //log(rule.sym,nonterms[rule.sym].follows);
      var set = [];
      for(var i=0,n=0,t;t=rule.handle[i];++i){
        if(nonterms[t]){
          if(i === rule.handle.length+1){
            set = nonterms[rule.sym].follows
          } else {
            var part = rule.handle.slice(i+1);
            set = self.first(part);
            if(self.nullable(part))
              set.concat(nonterms[rule.sym].follows);
          }
          set.forEach(function(e){
            if(!nonterms[t].follows.contains(e)){
              nonterms[t].follows.push(e);
              cont = true;
            }
          });
        }
      }
    });
  }
}

// return the FIRST set of a symbol or series of symbols
function first(symbol){
  // epsilon
  if(symbol === '')
    return new Set();
  // RHS
  else if(symbol.constructor === Array){
    var firsts = new Set();
    for(var i=0,n=0,t;t=symbol[i];++i){
      this.first(t).forEach(function(e){
        if(firsts.indexOf(e)===-1)
          firsts.push(e);
      });
      if(!this.nullable(t))
        break;
    }
    return firsts;
  // terminal
  } else if(!this.nonterms[symbol])
    return new Set([symbol]);
  // non-terminal
  else
    return this.nonterms[symbol].first;
}

// fixed-point calculation of FIRST sets
function firstSets(){
    var rules = this.rules,
        nonterms = this.nonterms,
        self = this,
        cont = true,
        sym,firsts;

  log('First sets');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      log(rule, rule.first);
      var firsts = self.first(rule.handle);
      if(firsts.size() != rule.first.size()) {
        rule.first = firsts;
        cont=true;
      }
      log(rule, rule.first);
    });

    for(sym in nonterms){
      log(sym, nonterms[sym].first);
      firsts = new Set();
      nonterms[sym].rules.forEach(function(rule){
        firsts.joinSet(rule.first);
      });
      if(firsts.size()!=nonterms[sym].first.size()) {
        nonterms[sym].first = firsts;
        cont=true;
      }
      log(sym, nonterms[sym].first);
    }
  }
}

// fixed-point calculation of NULLABLE
function nullableSets(){
    var firsts = this.firsts = {},
        nonterms = this.nonterms,
        self = this,
        cont = true;

  log('Nullables');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    // check if each rule is nullable
    this.rules.forEach(function(rule, k){
      log(rule, rule.nullable);
      if(!rule.nullable){
        for(var i=0,n=0,t;t=rule.handle[i];++i){
          if(self.nullable(t)){
            n++;
          }
        }
        if(n===i) { // rule is nullable if all tokens are nullable
          rule.nullable = cont = true;
        }
      }
      log(rule, rule.nullable);
    });

    //check if each symbol is nullable
    for(var sym in nonterms){
      log(sym, nonterms[sym].nullable);
      if(!this.nullable(sym)){
        for(var i=0,rule;rule=nonterms[sym].rules.item(i);i++){
          if(rule.nullable)
            nonterms[sym].nullable = cont = true;
        }
      }
      log(sym, nonterms[sym].nullable);
    }
  }
}

// check if a token or series of tokens is nullable
function nullable(symbol){
  // epsilon
  if(symbol === '') {
    return true
  // RHS
  } else if(Object.prototype.toString.apply(symbol) === '[object Array]'){
    for(var i=0,t;t=symbol[i];++i){
      if(!this.nullable(t))
        return false;
    }
    return true;
  // terminal
  } else if(!this.nonterms[symbol]) {
    return false;
  // Non terminal
    } else {
        return this.nonterms[symbol].nullable;
    }
}


function closureOperation(itemSet /*, closureSet*/){
  var closureSet = arguments[1] || new Set();
  var self = this;

  itemSet = this._closureFilter(itemSet, closureSet);

  closureSet.concat(itemSet);

  itemSet.forEach(function (item){
    var token = item.currentToken();
    var b;

    // if token is a non-terminal, recursively add closures
    if(token && self.nonterms[token]) {
      b = self.first(item.remainingHandle());
      if(b.isEmpty()) b = item.follows;
      self.nonterms[token].rules.forEach(function(rule){
          self.closureOperation(new Set([new self._Item(rule, 0, b)]), closureSet);
      });
    }
  });

  return closureSet;
}

function gotoOperation(itemSet, symbol) {
    var gotoSet = new Set(),
        EOF = this.EOF,
        self = this;
  itemSet.forEach(function (item){
    if(item.currentToken() == symbol && symbol != EOF){
      gotoSet.push(new self._Item(item.rule, item.dotPosition+1, item.follows));
    }
  });

  return gotoSet.isEmpty() ? gotoSet : this.closureOperation(gotoSet);
}

/* Create unique set of item sets
 * */
function canonicalCollection(){
    var items = this.closureOperation(new Set(new this._Item(this.rules.first(), 0, new Set(this.EOF)))),
        sets = new Set(items),
        done = new Set(),
        self = this,
        itemSet;

  while(!sets.isEmpty()){
    itemSet = sets.shift();
    itemSet._goto = {}; // used to optmize trans. later
    done.push(itemSet);
    // TODO: itemSet could cache the possible next symbols instead of
    // us looping through all
    this._grammerSymbols.forEach(function (sym) {
      var g = self.gotoOperation(itemSet, sym);
      // add g to que if not empty or duplicate
      if(!g.isEmpty()){
          itemSet._goto[sym] = g;
          if(!done.contains(g))
            sets.push(g); 
        }
    });
  }

  return done;
}

// a is an array that conatins a 2nd order array b
function hasArray(a,b){
    return a.some(function(el){
        return el.length === b.length && el.every(function(e,i){
            return b[i] == e;
        });
    });
}

// a is an array that conatins a 2nd order array with elements of b
function hasArrayMixed(a,b){
    return a.some(function(el){
        return el.length === b.length && el.every(function(e,i){
            return b.indexOf(e) !== -1;
        });
    });
}

function parseTable(itemSets){
  var states = [],
      symbols = this._grammerSymbols.slice(0),
      nonterms = this.nonterms,
      operators = this.operators,
      self = this,
      lookahead = this.type === 'lr' || this.type === 'lalr',
      simpleLookahead = this.type === 'slr';

  symbols.shift(); // exclude start symbol

  // for each item set
  itemSets.forEach(function(itemSet, k){
    var state = states[k] = {};
    // if contains a set where symbol is in front
    symbols.forEach(function (stackSymbol) {
      var action = [];
      var op = operators[stackSymbol];
      itemSet.forEach(function(item, j){
          var r;
        // find shift and goto actions
        if(item.currentToken() == stackSymbol){
          var gotoState = itemSets.indexOf(itemSet._goto[stackSymbol]);
          if(nonterms[stackSymbol]){
            // store state to go to after a reduce
            action = gotoState; 
          } else if(gotoState !== -1 && !hasArray(action, ['s', gotoState]) ) {
            // store shift to state
            if(action.length){
                self.conflicts++;
                r = resolveConflict(self.rules.item(action[0][1]), op, action[0], ['s', gotoState]);
                self.resolutions.push([k,stackSymbol,r]);
                action = [r.action];
            } else
                action.push(['s',gotoState]);
          } else if(stackSymbol == self.EOF){
            action.push(['a']); 
          }
        }
        // Current position is at the end of a production, try to reduce
        if(!item.currentToken() && !nonterms[stackSymbol]
          && (!lookahead || item.follows.contains(stackSymbol)) // LR(1) LALR
          && (!simpleLookahead || nonterms[item.rule.sym].follows.contains(stackSymbol)) // SLR
          ){
          if(action.length){
            self.conflicts++;
            r = resolveConflict(item.rule, op, ['r',item.rule.id], action[0]);
            self.resolutions.push([k,stackSymbol,r]);
            action = [r.action];
          } else 
              action.push(['r',item.rule.id]);
          log('reduction:',item);
        }
      });
      state[stackSymbol] = action;
    });
  });

  return states;
}

function resolveConflict(rule, op, reduce, shift){
    var sln = {rule: rule, operator: op, r: reduce, s: shift};

    if(shift[0] === 'r'){
        sln.msg = "Resolve R/R conflict (use first rule declared in grammer.)";
        sln.action = shift[1] < reduce[1] ? shift : reduce;
        return sln;
    }

    if(rule.precedence === 0 || !op){
        sln.msg = "Resolve S/R conflict (shift by default.)";
        sln.action = shift;
    } else if(rule.precedence < op.precedence ) {
        sln.msg = "Resolve S/R conflict (shift for higher precedent operator.)";
        sln.action = shift;
    } else if(rule.precedence === op.precedence) {
        if(op.assoc === "right" ) {
            sln.msg = "Resolve S/R conflict (shift for right associative operator.)";
            sln.action = shift;
        } else if(op.assoc === "left" ){
            sln.msg = "Resolve S/R conflict (reduce for left associative operator.)";
            sln.action = reduce;
        } else if(op.assoc === "nonassoc" ){
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

function llParseTable(rules){
    var table = {},
        self = this;
    rules.forEach(function(rule, i){
        var row = table[rule.sym] || {};
        (rule.nullable ? self.nonterms[rule.sym].follows : rule.first).forEach(function(token){
            if(row[token]){
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

function parse(input){
  var self = this;
  var stack = [0];
  var vstack = [null]; // semantic value stack

  var yytext = ''; // TODO
  var yylineno = 0; // TODO

  var table = this.table;

  log(this.itemSets.join('\n'));

  table.forEach(function (state, k){
    for(var sym in state){
      log('state['+k+','+sym+'] =',state[sym]);
    }
  });


  var sym, state, action, a, r, yyval={},p,len,ip=0;
    sym = input[ip] || this.EOF; 
  while(true){
    log('stack:',stack, '\n\t\t\tinput:', input);
    log('vstack:',uneval(vstack));
    // set first input
    state = stack[stack.length-1];
    // read action for current state and first input
    action = table[state][sym];
    if(!action || !action[0])
      throw new Error('Parse error. Unexpected symbol: '+sym+"+.\n stack:"+stack+', input:'+input);

    if(action.length > 1)
      log('Warning: multiple actions possible');

    log('action:',action);

    a = action[0]; 

    switch(a[0]){
      case 's': // shift
        stack.push(sym);
        sym = input[++ip] || this.EOF; 
        vstack.push(null); // semantic values or junk only, no terminals
        stack.push(action[0][1]); // push state
        break;
      case 'r': // reduce
        p = self.rules.item(action[0][1]);
        len = p.handle[0] == '' ? 0 : p.handle.length;
        if(p.action){
          log('semantic action:',p.action);
          if((r = p.action.call(yyval,null,vstack)) != undefined ){
            return r;
          }
        } else {
          yyval.yyval = vstack[vstack.length-len]; // default to $$ = $1
        }

        log('yyval=',yyval.yyval);
        if(len){
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
      case 'a':
        log('stack:',stack, '\n\tinput:', input);
        log('vstack:',vstack);
        return true;
    }
      
  }

  return true;
}


  Parser.prototype = {
    closureOperation: closureOperation,
    gotoOperation: gotoOperation,
    canonicalCollection: canonicalCollection,
    parseTable: parseTable,
    llParseTable: llParseTable,
    parse: parse,
    first: first,
    firstSets: firstSets,
    followSets: followSets,
    nullableSets: nullableSets,
    nullable: nullable
  };

  return {
    Parser: Parser
  };
})()

if(typeof exports !== 'undefined')
    exports.JSParse = JSParse;
// refactor, generator, lexer input, context-precedence
