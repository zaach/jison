// LARL(1), LR(1) Parser
// Zachary Carter <zcarter@mail.usf.edu> (http://zaa.ch)

load("set.js");

var JSParse = exports.JSParse = (function (){

function log(){
  if(JSParse.DEBUG)
    print.apply(null,arguments);
}

function Rule(sym, handle, action) {
  this.sym = sym;
  this.handle = handle;
  this.first = new Set();
  var l = this.handle.length;
  if(action){
    var a = action.replace(/\$(?:0|\$)/g, "this.yyval")
                  .replace(/\$(\d)/g, "arguments[1][arguments[1].length-"+l+"+$1-1]");
    this.action = Function("yyval", a);
  } 
  //else this.action = function(yyval, stack){yyval = stack[stack.length-l];};
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
// declare these functions here for cachability
var _cfs = {
  lalr: function(itemSet, closureSet){
    return itemSet.filter(function (e){
        var r = closureSet.indexOf(e);
        // add any additional follows if the item is already in the set
        if(r != -1) closureSet.item(closureSet.indexOf(e)).follows.joinSet(e.follows);
        return !(r != -1);
    });
  },
  lr: function(itemSet, closureSet){
    return closureSet.complement(itemSet);
  }
};
_cfs.slr = _cfs.lr0 = _cfs.lr;

var Parser = function JSParse_Parser(grammer, options){
  var options = options || {};
  this.terms = {};
  this.rules = new Set();
  this.conflicts = 0;
  // augment the grammer
  this.rules.push(new Rule('$accept', [grammer.startSymbol, '$end']));

  this.DEBUG = options.debug || false;
  this.type = options.type || "lalr";

  // tweak algorithms based on parser type
  this._closureFilter = _cfs[this.type];
  this._Item = this.type === "lr" ? LRItem : Item;

  proccessGrammerDef.call(this, grammer);

  if(!this.nonterms[grammer.startSymbol]){
    throw new Error("Grammer error: startSymbol must be a non-terminal.");
  }

  this.startSymbol = grammer.startSymbol;
  this.EOF = "$end";

  // prepend parser tokens
  this._grammerSymbols.unshift("$end");
  this._grammerSymbols.unshift("$accept");

  this.nonterms["$accept"] = new NonTerminal("$accept");

  if(this.type !== 'lr0'){
    this.nullableSets();
    this.firstSets();
    this.followSets();
  }

  this.itemSets = this.canonicalCollection();
  this.table = this.actionTable(this.itemSets);
};

function proccessGrammerDef(grammer){
  var bnf = grammer.bnf;
  var tokens = grammer.tokens;
  if(typeof tokens === 'string')
    tokens = tokens.split(' ');
  var symbols = this._grammerSymbols = tokens;
  var nonterms = this.nonterms = {};
  var rules = this.rules;

  for(var sym in bnf) {
    nonterms[sym] = new NonTerminal(sym);
    if(typeof bnf[sym] === 'string') bnf[sym] = bnf[sym].split(/\s*\|\s*/g);
    bnf[sym].forEach(function (handle){
      if(symbols.indexOf(sym) === -1)
        symbols.push(sym);
      if(handle.constructor === Array)
        // semantic action specified
        rules.push(new Rule(sym, handle[0].split(' '), handle[1]));
      else
        rules.push(new Rule(sym, handle.split(' ')));
      nonterms[sym].rules.push(rules.last());
    });
  }
}

function closureOperation(itemSet /*, closureSet*/){
  var closureSet = arguments[1] || new Set();
  var that = this;

  itemSet = this._closureFilter(itemSet, closureSet);

  closureSet.concat(itemSet);

  itemSet.forEach(function (item){
    var token = item.currentToken();
    var b;

    // if token is a non-terminal, recursively add closures
    if(token && that.nonterms[token]) {
      b = that.first(item.remainingHandle());
      if(b.isEmpty()) b = item.follows;
      that.nonterms[token].rules.forEach(function(rule){
          that.closureOperation(new Set([new that._Item(rule, 0, b)]), closureSet);
      });
    }
  });

  return closureSet;
}

function gotoOperation(itemSet, symbol) {
  var gotoSet = new Set();
  var EOF = this.EOF;
  var that = this;
  itemSet.forEach(function (item){
    if(item.currentToken() == symbol && symbol != EOF){
      gotoSet.push(new that._Item(item.rule, item.dotPosition+1, item.follows));
    }
  });

  return this.closureOperation(gotoSet);
}

/* Create unique set of item sets
 * */
function canonicalCollection(){
  var items = this.closureOperation(new Set(new this._Item(this.rules.first(), 0, new Set(this.EOF))));
  var sets = new Set(items);
  var done = new Set();
  var that = this;
  var itemSet;

  while(!sets.isEmpty()){
    itemSet = sets.shift();
    done.push(itemSet);
    // TODO: itemSet could cache the possible next symbols instead of
    // us looping through all
    this._grammerSymbols.forEach(function (sym) {
      var g = that.gotoOperation(itemSet, sym);
      // add g to que if not empty or duplicate
      if(g.size() && !done.contains(g))
        sets.push(g); 
    });
  }

  return done;
}


function test(){
  log(this.rules.join('\n'));
  log(this.rules.item(0));

  for(var i in this.nonterms){
    log(this.nonterms[i].rules);
  }

  var items = this.closureOperation(new Set([new this._Item(this.rules.item(0), 0)]));

  log(items.join('\n'));

  log(this._grammerSymbols);

  var sets = new Set();
  sets.push(items);
  log('Canonical sets');
  var itemSets = this.canonicalCollection(sets);
  log(itemSets.join('\n'));

  var table = this.actionTable(itemSets);

  table.forEach(function (state, k){
    for(var sym in state){
      log('state['+k+','+sym+'] =',state[sym]);
    }
  });

  this.allItems();
}

function followSets(){
  var rules = this.rules;
  var nonterms = this.nonterms;
  var that = this;
  var cont = true;

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
            set = that.first(part);
            if(that.nullable(part))
              set.concat(nonterms[rule.sym].follows);
          }
          set.forEach(function(e){
            if(nonterms[t].follows.indexOf(e)===-1){
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
  var rules = this.rules;
  var nonterms = this.nonterms;
  var that = this;
  var cont = true;
  var sym,firsts;

  log('First sets');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      log(rule, rule.first);
      var firsts = that.first(rule.handle);
      if(firsts.size() != rule.first.size()) {
        rule.first = firsts;
        cont=true;
      }
      log(rule, rule.first);
    });

    for(sym in nonterms){
      //log(sym, nonterms[sym].first);
      firsts = new Set();
      nonterms[sym].rules.forEach(function(rule){
        firsts.concat(rule.first);
      });
      if(firsts.size()!=nonterms[sym].first.size()) {
        nonterms[sym].first = firsts;
        cont=true;
      }
      //log(sym, nonterms[sym].first);
    }
  }
}

// fixed-point calculation of NULLABLE
function nullableSets(){
  var rules = this.rules;
  var firsts = this.firsts = {};
  var nonterms = this.nonterms;
  var that = this;
  var cont = true;

  log('Nullables');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    // check if each rule is nullable
    rules.forEach(function(rule, k){
      //log(rule, rule.nullable);
      if(!rule.nullable){
        for(var i=0,n=0,t;t=rule.handle[i];++i){
          if(that.nullable(t)){
            n++;
          }
        }
        if(n===i) { // rule is nullable if all tokens are nullable
          rule.nullable = cont = true;
        }
      }
      //log(rule, rule.nullable);
    });

    //check if each symbol is nullable
    for(var sym in nonterms){
      log(sym, nonterms[sym].nullable);
      if(!this.nullable(sym)){
        for(var i=0,rule;rule=rules.item(nonterms[sym][i]);i++){
          if(rule.nullable)
            nonterms[sym].nullable = cont = true;
        }
      }
      //log(sym, nonterms[sym].nullable);
    }
  }
}

// check if a token or series of tokens is nullable
function nullable(symbol){
  // epsilon
  if(symbol === '')
    return true
  // RHS
  else if(Object.prototype.toString.apply(symbol) === '[object Array]'){
    for(var i=0,t;t=symbol[i];++i){
      if(!this.nullable(t))
        return false;
    }
    return true;
  // terminal
  } else if(!this.nonterms[symbol])
    return false;
  // Non terminal
  else
    return !!this.nonterms[symbol].nullable;
}

function actionTable(itemSets){
  var states = [];
  var symbols = this._grammerSymbols.slice(0);
  var nonterms = this.nonterms;
  var EOF = this.EOF;
  symbols.shift(); // exclude start symbol
  var that = this;
  var lookahead = this.type === 'lr' || this.type === 'lalr';
  var simpleLookahead = this.type === 'slr';

  // for each item set
  itemSets.forEach(function(itemSet, k){
    var state = states[k] = {};
    // if contains a set where symbol is in front
    symbols.forEach(function (stackSymbol) {
      var action = [];
      itemSet.forEach(function(item, j){
        //action = [];
        // find shift and goto actions
        if(item.currentToken() == stackSymbol){
          var gotoState = itemSets.indexOf(that.gotoOperation(itemSet, stackSymbol));
          if(nonterms[stackSymbol]){
            action = gotoState; // store state to go to after a reduce
          } else if(gotoState !== -1) {
            if(action.length) that.conflicts++;
            action.push(['s',gotoState]); // store shift to state
          } else if(stackSymbol == EOF){
            action.push(['a']); // store shift to state
          }
        }
      if(gotoState)
      log('action table:', itemSets.item(gotoState), action);
        if(!item.currentToken() && !nonterms[stackSymbol]
          && (!lookahead || item.follows.contains(stackSymbol)) // LR(1) LALR
          && (!simpleLookahead || nonterms[item.rule.sym].follows.contains(stackSymbol)) // SLR
          ){
          if(action.length) that.conflicts++;
          action.push(['r',that.rules.indexOf(item.rule)]);
          log('reduction:',item);
        }
      });
      state[stackSymbol] = action;
    });
  });

  return states;
}

function parse(input){
  var that = this;
  input = input.slice(0);
  input.push(this.EOF);
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


  var sym, output, state, action, a, r, yyval={},p,len;
  while(input){
    log('stack:',stack, '\n\t\t\tinput:', input);
    log('vstack:',vstack);
    // set first input
    sym = input[0]; 
    state = stack[stack.length-1];
    // read action for current state and first input
    action = table[state][sym];
    if(!action || !action.length)
      throw 'Parse error. stack:'+stack+', input:'+input;

    if(action.length > 1)
      log('Warning: multiple actions possible');

    log('action:',action);

    a = action[0]; // TODO: precedence rules for multiple actions

    switch(a[0]){
      case 's': // shift
        stack.push(input.shift());
        vstack.push(null); // semantic values or junk only, no terminals
        stack.push(action[0][1]); // push state
        break;
      case 'r': // reduce
        p = that.rules.item(action[0][1]);
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
    actionTable: actionTable,
    parse: parse,
    first: first,
    firstSets: firstSets,
    followSets: followSets,
    nullableSets: nullableSets,
    nullable: nullable,
    test:test
  };

  return {
    Parser: Parser,
  };
})()

// refactor, generator, lexer input
