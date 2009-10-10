
var JSParse = (function (){

function Rule(sym, handle) {
  this.sym = sym;
  this.handle = handle;
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
      rules.push(new Rule(sym, handle.split(' ')));
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
      allItems.push(new Item(prod, i));
  });
  print(allItems.join('\n'));
}

function test(){
  print(rules.join('\n'));
  print(rules.item(0));

  for(var i in _nonterms){
    print(_nonterms[i]);
  }

  var items = closureOperation(new Set([new Item(rules.item(0), 0)]));

  print(items.join('\n'));

  print(grammerSymbols);

  var sets = new Set();
  sets.push(items);
  print('Canonical sets');
  var itemSets = canonicalCollection(sets);
  print(itemSets.join('\n'));

  var table = actionTable(itemSets);

  table.forEach(function (state, k){
    for(var sym in state){
      print('state['+k+','+sym+'] =',state[sym]);
    }
  });

  allItems();
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
    parse: parse
  };

  return {
    Parser: Parser,
  };
})()




// TODO: FOLLOWS (SLR), empty handles, test cases, refactor, LALR
