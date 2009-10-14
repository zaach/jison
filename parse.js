
var JSParse = (function (){

function Rule(sym, handle) {
  this.sym = sym;
  this.handle = handle;
  this.first = [];
}
  Rule.prototype.toString = function(){
    return this.sym+" -> "+this.handle.join(' ');
  };

function Item(rule, dot) {
  this.rule = rule;
  this.dotPosition = dot;
}
  Item.prototype.currentToken = function(){
    return this.rule.handle[this.dotPosition];
  }
  Item.prototype.eq = function(e){
    return e.rule && e.dotPosition !=null && this.rule===e.rule && this.dotPosition === e.dotPosition;
  }
  Item.prototype.toString = function(){
    var temp = this.rule.handle.slice(0);
    temp[this.dotPosition] = '.'+(temp[this.dotPosition]||'');
    return this.rule.sym+" -> "+temp.join(' ');
  };

function Set(set, raw) {
  this._items = set && (raw ? set : set.slice(0)) || [];
}
  Set.prototype = {
    concat : function (setB){ return [].push.apply(this._items, setB._items), this; },
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
    contains : function (item){ return this.indexOf(item) !== -1; },
    item : function (v, val){ return this._items[v]; },
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

var Parser = function JSParse_Parser(grammer){
  this.terms = {};

  proccessGrammerDef.call(this, grammer);

  this.startSymbol = this.rules.first().sym;
  this.EOF = this.rules.first().handle[this.rules.first().handle.length-1];
};

function proccessGrammerDef(grammer){
  var bnf = grammer.bnf;
  var tokens = grammer.tokens;
  var symbols = this._grammerSymbols = [];
  var _nonterms = this._nonterms = {};// { nonterm1: [ruleNo1, ...], ... }
  var rules = this.rules = new Set();// [ {sym: nonterm, handle: handle }, ... ]

  for(var sym in bnf) {
    _nonterms[sym] = []; // will store rule Nos. that begin with this symbol
    bnf[sym].forEach(function (handle){
      if(symbols.indexOf(sym) === -1)
        symbols.push(sym);
      _nonterms[sym].push(rules.size());
      _nonterms[sym].first = [];
      _nonterms[sym].follows = [];
      rules.push(new Rule(sym, handle.split(' ')));
    });
  }
  [].push.apply(symbols, tokens); // concat tokens

  //this.firstSets();
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

    // if token is a non-terminal, recursively add closures
    if(token && that._nonterms[token]) {
      that._nonterms[token].forEach(function(n){
          that.closureOperation(new Set([new Item(that.rules.item(n), 0)]), closureSet);
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
      gotoSet.push(new Item(item.rule, item.dotPosition+1));
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
    symbols.forEach(function (symbol) {
      var action = [];
      itemSet.forEach(function(item, j){
        //action = [];
        // find shift and goto actions
        if(item.currentToken() == symbol){
          var sn = itemSets.indexOf(that.gotoOperation(itemSet, symbol));
          if(_nonterms[symbol]){
            action = sn; // store goto state
          } else if(sn >= 0) {
            action = ['s'+sn]; // store shift to state
          } else if(symbol == EOF){
            action = ['a']; //accept
          }
        }
        if(!item.currentToken() && !_nonterms[symbol]){
          action.push('r'+that.rules.indexOf(item.rule));
        }
      });
      state[symbol] = action;
    });
  });

  return states;
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
    print(this._nonterms[i]);
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
  nonterms[rules.item(nonterms[this.startSymbol][0]).handle[0]].follows.push(this.EOF);

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      print(rule.sym,nonterms[rule.sym].follows);
      var set = [];
      for(var i=0,n=0,t;t=rule.handle[i];++i){
        if(nonterms[t]){
          if(i === rule.handle.length+1){
            set = nonterms[rule.sym].follows
          } else {
            var part = rule.handle.slice(i+1);
            set = that.first(part);
            if(that.nullable(part))
              set.push.apply(set, nonterms[rule.sym]);
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

function first(symbol){
  if(symbol === '')
    return [];
  else if(Object.prototype.toString.apply(symbol) === '[object Array]'){
    var firsts = [];
    for(var i=0,n=0,t;t=symbol[i];++i){
      this.first(t).forEach(function(e){
        if(firsts.indexOf(e)===-1)
          firsts.push(e);
      });
      if(!this.nullable(t))
        break;
    }
    return firsts;
  } else if(!this._nonterms[symbol])
    return [symbol];
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

  // loop until no further changes have been made
  while(cont){
    cont = false;

    rules.forEach(function(rule, k){
      print(rule, rule.first);
      var firsts = that.first(rule.handle);
      if(firsts.length!==rule.first.length) {
        rule.first = firsts;
        cont=true;
      }
      print(rule, rule.first);
    });

    for(sym in nonterms){
      print(sym, nonterms[sym].first);
      firsts = [];
      for(var i=0,rule;rule=rules.item(nonterms[sym][i]);i++){
        firsts.push.apply(firsts, rule.first);
      }
      if(firsts.length!==nonterms[sym].first.length) {
        nonterms[sym].first = firsts;
        cont=true;
      }
      print(sym, nonterms[sym].first);
    }
  }
}

// fixed-point calculation of nullables
function nullableSets(){
  var rules = this.rules;
  var firsts = this.firsts = {};
  var nonterms = this._nonterms;
  var that = this;
  var cont = true;

  // loop until no further changes have been made
  while(cont){
    cont = false;

    // check if each rule is nullable
    rules.forEach(function(rule, k){
      print(rule, rule.nullable);
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
      print(rule, rule.nullable);
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
      print(sym, nonterms[sym].nullable);
    }
  }
}

function nullable(symbol){
  if(symbol === '')
    return true
  else if(Object.prototype.toString.apply(symbol) === '[object Array]'){
    for(var i=0,t;t=symbol[i];++i){
      if(!this.nullable(t))
        return false;
    }
    return true;
  } else if(!this._nonterms[symbol])
    return false;
  else
    return !!this._nonterms[symbol].nullable;
}

function terminals(symbol){
  var terms = this.terms;
  var that = this;

  if(!terms[symbol])
    terms[symbol] = [];

  if(terms[symbol].length)
    return terms[symbol];

  if(!this._nonterms[symbol])
    return [symbol];
  else {
    this._nonterms[symbol].forEach(function(ri, i){
      var rule = that.rules.item(ri);
      rule.handle.forEach(function(sym, i){
        if(sym!==symbol){
          terms[symbol].push.apply(terms[symbol], that.terminals(sym));
        }
      });
    });
  }

  return terms[symbol];
}


function parse(input){
  var that = this;
  input = input.slice(0);
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
    if(!action.length)
      throw 'Parse error. stack:'+stack+', input:'+input;

    print('action:',action);

    switch(action[0].charAt(0)){
      case 's': // shift
        stack.push(input.shift());
        stack.push(parseInt(action[0].charAt(1))); // push state
        break;
      case 'r': // reduce
        var p = that.rules.item(action[0].charAt(1));
        if(p.handle[0] != '') //empty rules won't reduce the stack
          stack = stack.slice(0,-1*p.handle.length*2);
        stack.push(p.sym);
        newState = table[stack[stack.length-2]][stack[stack.length-1]];
        stack.push(newState);
        print('reduce by: ',p);
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
    terminals: terminals,
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




// TODO: FOLLOWS (SLR), empty handles, test cases, refactor, LALR
