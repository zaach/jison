
var JSParse = (function (){

function Rule(sym, handle) {
  this.sym = sym;
  this.handle = handle;
  this.first = new Set();
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
    return this.rule.sym+" -> "+temp.join(' ')+", "+this.follows.join('/');
  };

function Set(set, raw) {
  if(Object.prototype.toString.apply(set) === '[object Array]')
    this._items = set && (raw ? set : set.slice(0)) || [];
  else 
    this._items = [].slice.call(arguments,0);

  var that = this;

  this.length = {toValue: function(){return that.size(); }};
}
  Set.prototype = {
    concat : function (setB){ 
               try{
               return [].push.apply(this._items, setB._items), this; 
               }catch(e){print(e.stack);return this;}
             },
    eq : function (setB){
            return this.toString() == setB.toString();
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
              return (new Set()).concat(this).concat(set);
            },
    intersection : function(set){
              return this.filter(function(elm){
                    return set.contains(elm);
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

  "push shift forEach some filter join".split(' ').forEach(function(e,i){
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

var Parser = function JSParse_Parser(grammer){
  this.terms = {};
  this.rules = new Set();// [ {sym: nonterm, handle: handle }, ... ]
  // augment the grammer
  this.rules.push(new Rule('$accept', [grammer.startSymbol, '$end']));

  proccessGrammerDef.call(this, grammer);

  this.startSymbol = grammer.startSymbol;
  this.EOF = "$end";

  // prepend parser tokens
  this._grammerSymbols.unshift("$end");
  this._grammerSymbols.unshift("$accept");

  this._nonterms["$accept"] = new NonTerminal("$accept");

  this.nullableSets();
  this.firstSets();
  this.followSets();
};

function proccessGrammerDef(grammer){
  var bnf = grammer.bnf;
  var tokens = grammer.tokens;
  var symbols = this._grammerSymbols = [];
  var _nonterms = this._nonterms = {};// { nonterm1: [ruleNo1, ...], ... }
  var rules = this.rules;

  for(var sym in bnf) {
    _nonterms[sym] = new NonTerminal(sym);
    bnf[sym].forEach(function (handle){
      if(symbols.indexOf(sym) === -1)
        symbols.push(sym);
      rules.push(new Rule(sym, handle.split(' ')));
      _nonterms[sym].rules.push(rules.last());
    });
  }
  [].push.apply(symbols, tokens); // concat tokens
}

function closureOperation(itemSet /*, closureSet*/){
  var closureSet = arguments[1] || new Set();
  var that = this;

  itemSet = itemSet.filter(function (e){
      return !closureSet.contains(e);
  });

  closureSet.concat(itemSet);

  itemSet.forEach(function (item){
    var token = item.currentToken();

    var b = that.first(item.remainingHandle());
    if(b.empty()) b = item.follows;
    // if token is a non-terminal, recursively add closures
    if(token && that._nonterms[token]) {
      that._nonterms[token].rules.forEach(function(rule){
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
function canonicalCollection(itemSets){
  var sets = itemSets.copy();
  var done = new Set();
  var that = this;
  var itemSet;

  while(!sets.isEmpty()){
    itemSet = sets.shift();
    done.push(itemSet);
    this._grammerSymbols.forEach(function (sym) {
      var g = that.gotoOperation(itemSet, sym);
      // add g to que if not empty or duplicate
      if(g.size() && !done.contains(g))
        sets.push(g); 
    });
  }

  return done;
}


function allItems(){
  var allItems = new Set();
  this.rules.forEach(function(prod, k){
    for(var i=0;i<=prod.handle.length;i++)
      if(prod.handle[i-1] !== '') // not for empty rules
        allItems.push(new Item(prod, i));
  });
  print(allItems.join('\n'));
}

function test(){
  print(this.rules.join('\n'));
  print(this.rules.item(0));

  for(var i in this._nonterms){
    print(this._nonterms[i].rules);
  }

  var items = this.closureOperation(new Set([new Item(this.rules.item(0), 0)]));

  print(items.join('\n'));

  print(this._grammerSymbols);

  var sets = new Set();
  sets.push(items);
  print('Canonical sets');
  var itemSets = this.canonicalCollection(sets);
  print(itemSets.join('\n'));

  var table = this.actionTable(itemSets);

  table.forEach(function (state, k){
    for(var sym in state){
      print('state['+k+','+sym+'] =',state[sym]);
    }
  });

  this.allItems();
}

function followSets(){
  var rules = this.rules;
  var nonterms = this._nonterms;
  var that = this;
  var cont = true;

  // add follow $ to start symbol
  nonterms[this.startSymbol].follows.push(this.EOF);

  print('Follow sets');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      //print(rule.sym,nonterms[rule.sym].follows);
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
  else if(Object.prototype.toString.apply(symbol) === '[object Array]'){
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
  } else if(!this._nonterms[symbol])
    return new Set([symbol]);
  // non-terminal
  else
    return this._nonterms[symbol].first;
}

// fixed-point calculation of FIRST sets
function firstSets(){
  var rules = this.rules;
  var nonterms = this._nonterms;
  var that = this;
  var cont = true;
  var sym,firsts;

  print('First sets');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      print(rule, rule.first);
      var firsts = that.first(rule.handle);
      if(firsts.size() != rule.first.size()) {
        rule.first = firsts;
        cont=true;
      }
      print(rule, rule.first);
    });

    for(sym in nonterms){
      //print(sym, nonterms[sym].first);
      firsts = new Set();
      nonterms[sym].rules.forEach(function(rule){
        firsts.concat(rule.first);
      });
      if(firsts.size()!=nonterms[sym].first.size()) {
        nonterms[sym].first = firsts;
        cont=true;
      }
      //print(sym, nonterms[sym].first);
    }
  }
}

// fixed-point calculation of NULLABLE
function nullableSets(){
  var rules = this.rules;
  var firsts = this.firsts = {};
  var nonterms = this._nonterms;
  var that = this;
  var cont = true;

  print('Nullables');

  // loop until no further changes have been made
  while(cont){
    cont = false;

    // check if each rule is nullable
    rules.forEach(function(rule, k){
      //print(rule, rule.nullable);
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
      //print(rule, rule.nullable);
    });

    //check if each symbol is nullable
    for(var sym in nonterms){
      print(sym, nonterms[sym].nullable);
      if(!this.nullable(sym)){
        for(var i=0,rule;rule=rules.item(nonterms[sym][i]);i++){
          if(rule.nullable)
            nonterms[sym].nullable = cont = true;
        }
      }
      //print(sym, nonterms[sym].nullable);
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
  } else if(!this._nonterms[symbol])
    return false;
  // Non terminal
  else
    return !!this._nonterms[symbol].nullable;
}

function actionTable(itemSets){
  var states = [];
  var symbols = this._grammerSymbols.slice(0);
  var _nonterms = this._nonterms;
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
          if(_nonterms[stackSymbol]){
            action = gotoState; // store state to go to after a reduce
          } else if(gotoState !== -1) {
            action = ['s'+gotoState]; // store shift to state
          } else if(stackSymbol == EOF){
            action = ['a']; //accept
          }
        }
      if(gotoState)
      print('action table:', itemSets.item(gotoState), action);
        if(!item.currentToken() && !_nonterms[stackSymbol]
          && _nonterms[item.rule.sym].follows.indexOf(stackSymbol)!== -1){
          action.push('r'+that.rules.indexOf(item.rule));
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

  var items = this.closureOperation(new Set([new Item(this.rules.first(), 0)]));
  var itemSets = this.canonicalCollection(new Set([items]));
  var table = this.actionTable(itemSets);

  var sym, output, state, action;
  while(input){
    print('stack:',stack, '\n\t\t\tinput:', input);
    // set first input
    sym = input[0]; 
    state = stack[stack.length-1];
    // read action for current state and first input
    action = table[state][sym];
    if(!action || !action.length)
      throw 'Parse error. stack:'+stack+', input:'+input;

    if(action.length > 1)
      print('Warning: multiple actions possible');

    print('action:',action);

    switch(action[0].charAt(0)){
      case 's': // shift
        stack.push(input.shift());
        stack.push(parseInt(action[0].charAt(1))); // push state
        break;
      case 'r': // reduce
        var p = that.rules.item(action[0].charAt(1));
        if(p.handle[0] != '') //if RHS is not epsilon, pop off stack
          stack = stack.slice(0,-1*p.handle.length*2);
        stack.push(p.sym);    // push nonterminal (reduce)
        // goto new state = table[STATE][NONTERMINAL]
        newState = table[stack[stack.length-2]][stack[stack.length-1]];
        stack.push(newState);
        print('reduced by: ',p);
        break;
      case 'a':
        print('stack:',stack, '\n\tinput:', input);
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
    allItems: allItems,
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
