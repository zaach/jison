
var JSParse = exports.JSParse = (function (){

function log(){
  if(JSParse.DEBUG)
    print.apply(null,arguments);
}

function Rule(sym, handle, action) {
  this.sym = sym;
  this.handle = handle;
  this.first = new Set();
  this.action = action;
}
  Rule.prototype.toString = function(){
    return this.sym+" -> "+this.handle.join(' ');
  };

function Item(rule, dot, f) {
  this.rule = rule;
  this.dotPosition = dot;
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
  this.dotPosition = dot;
  this.follows = f || new Set(); 
}
  LRItem.prototype = new Item();
  LRItem.prototype.eq = function(e){
    return e.rule && e.dotPosition !=null && this.rule===e.rule && this.dotPosition === e.dotPosition && this.follows.toString()==e.follows.toString();
  };

function Set(set, raw) {
  if(set && set.constructor === Array)
    this._items = set && (raw ? set : set.slice(0)) || [];
  else 
    this._items = [].slice.call(arguments,0);

  var that = this;

  this.length = {toValue: function(){return that.size(); }};
}
  Set.prototype = {
    concat : function (setB){ 
               return [].push.apply(this._items, setB._items), this; 
             },
    eq : function (set){
            return this.size() === set.size() && this.subset(set); 
          },
    indexOf : function (item){
            if(item.eq) {
              for(var k=0; k<this._items.length;k++)
                if(item.eq(this._items[k]))
                  return k;
            }
            return this._items.indexOf(item);
          },
    union : function(set){
              return (new Set(this._items)).concat(this.complement(set));
            },
    intersection : function(set){
              return this.filter(function(elm){
                    return set.contains(elm);
                    });
            },
    complement : function(set){
              var that = this;
              return set.filter(function(elm){
                    return !that.contains(elm);
                    });
            },
    subset : function(set){
              return this.every(function(elm){
                    return set.contains(elm);
                    });
            },
    superset : function(set){
              return set.subset(this);
            },
    joinSet : function(set){
              return this.concat(this.complement(set));
            },
    contains : function (item){ return this.indexOf(item) !== -1; },
    item : function (v, val){ return this._items[v]; },
    i : function (v, val){ return this._items[v]; },
    first : function (){ return this._items[0]; },
    last : function (){ return this._items[this._items.length-1]; },
    size : function (){ return this._items.length; },
    isEmpty : function (){ return this._items.length === 0; },
    copy : function (){ return new Set(this._items); },
    toString : function (){ return this._items.toString(); }
  };

  "push shift forEach some every join".split(' ').forEach(function(e,i){
    Set.prototype[e] = function(){ return Array.prototype[e].apply(this._items, arguments); };
  });
  "filter slice".split(' ').forEach(function(e,i){
    Set.prototype[e] = function(){ return new Set(Array.prototype[e].apply(this._items, arguments), true); };
  });

function NonTerminal(sym){
  this.sym = sym;
  this.rules = new Set();
  this.first = new Set();
  this.follows = new Set();
  this.nullable = false;
}

var Parser = function JSParse_Parser(grammer, options){
  var options = options || {};
  this.terms = {};
  this.rules = new Set();// [ {sym: nonterm, handle: handle }, ... ]
  // augment the grammer
  this.rules.push(new Rule('$accept', [grammer.startSymbol, '$end']));

  this.DEBUG = options.debug || false;
  this.type = options.type || "lalr";

  proccessGrammerDef.call(this, grammer);

  this.startSymbol = grammer.startSymbol;
  this.EOF = "$end";

  // prepend parser tokens
  this._grammerSymbols.unshift("$end");
  this._grammerSymbols.unshift("$accept");

  this.nonterms["$accept"] = new NonTerminal("$accept");

  this.nullableSets();
  this.firstSets();
  this.followSets();

  this.itemSets = this.canonicalCollection();
  this.table = this.actionTable(this.itemSets);
};

function proccessGrammerDef(grammer){
  var bnf = grammer.bnf;
  var tokens = grammer.tokens;
  var symbols = this._grammerSymbols = [];
  var nonterms = this.nonterms = {};// { nonterm1: [ruleNo1, ...], ... }
  var rules = this.rules;

  for(var sym in bnf) {
    nonterms[sym] = new NonTerminal(sym);
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
  [].push.apply(symbols, tokens); // concat tokens
}

function closureOperation(itemSet /*, closureSet*/){
  var closureSet = arguments[1] || new Set();
  var that = this;

  if(this.type === "lalr"){
    itemSet = itemSet.filter(function (e){
        var r = closureSet.contains(e);
        // add any additional follows if the item is already in the set
        if(r) closureSet.item(closureSet.indexOf(e)).follows.joinSet(e.follows);
        return !r;
    });
  } else {
    itemSet = itemSet.complement(closureSet);
  }

  closureSet.concat(itemSet);

  itemSet.forEach(function (item){
    var token = item.currentToken();

    // if token is a non-terminal, recursively add closures
    if(token && that.nonterms[token]) {
      var b = that.first(item.remainingHandle());
      if(b.isEmpty()) b = item.follows;
      that.nonterms[token].rules.forEach(function(rule){
          that.closureOperation(new Set([new Item(rule, 0, b)]), closureSet);
      });
    }
  });

  return closureSet;
}

function gotoOperation(itemSet, symbol) {
  var gotoSet = new Set();
  var EOF = this.EOF;
  itemSet.forEach(function (item){
    if(item.currentToken() == symbol && symbol != EOF){
      gotoSet.push(new Item(item.rule, item.dotPosition+1, item.follows));
    }
  });

  return this.closureOperation(gotoSet);
}

/* Create unique set of item sets
 * */
function canonicalCollection(){
  var items = this.closureOperation(new Set(new Item(this.rules.first(), 0, new Set(this.EOF))));
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

  var items = this.closureOperation(new Set([new Item(this.rules.item(0), 0)]));

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
            action = [['s',gotoState]]; // store shift to state
          } else if(stackSymbol == EOF){
            action = [['a']]; //accept
          }
        }
      if(gotoState)
      log('action table:', itemSets.item(gotoState), action);
        if(!item.currentToken() && !nonterms[stackSymbol]
          && item.follows.contains(stackSymbol) // LR(1)
          //&& nonterms[item.rule.sym].follows.indexOf(stackSymbol)!== -1 // SLR
          ){
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

  var table = this.table;

  log(this.itemSets.join('\n'));

  table.forEach(function (state, k){
    for(var sym in state){
      log('state['+k+','+sym+'] =',state[sym]);
    }
  });


  var sym, output, state, action, a;
  while(input){
    log('stack:',stack, '\n\t\t\tinput:', input);
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
        stack.push(action[0][1]); // push state
        break;
      case 'r': // reduce
        var p = that.rules.item(action[0][1]);
        if(p.handle[0] != '') //if RHS is not epsilon, pop off stack
          stack = stack.slice(0,-1*p.handle.length*2);
        stack.push(p.sym);    // push nonterminal (reduce)
        // goto new state = table[STATE][NONTERMINAL]
        newState = table[stack[stack.length-2]][stack[stack.length-1]];
        stack.push(newState);
        if(p.action)
          print(p, p.action);
        log('reduced by: ',p);
        break;
      case 'a':
        log('stack:',stack, '\n\tinput:', input);
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

// test cases, refactor, Semantic actions, generator, LALR
