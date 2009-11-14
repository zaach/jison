/* LEXER written in JavaScript */
// By Zachary Carter

var JSLex = (function(){

// expand macros and convert to RegExp's
function prepareRules(rules, macros){
  for(i=0;i < rules.length; i++) {
    m = rules[i][0];
    for(k in macros) {
        print(m);
      if(macros.hasOwnProperty(k))
        m = m.split("{"+k+"}").join(macros[k]);
    }
    rules[i][0] = new RegExp("^"+m);
  }
  return rules;
}

function RegExpLexer (dict, input) {
  dict = dict || {};
  this.rules = prepareRules(dict.rules, dict.macros);
  this.input = input || dict.input;
}

RegExpLexer.prototype = {
    chars: 0,
    tokens: 0,
    done: false,
    yytext: '',
    yylineno: 0,
    EOF: ''
};

// return next match in input
RegExpLexer.prototype.next = function(){
    if(this.done) return this.EOF;
    if(!this.input) this.done = true;

    var token,
        match;
    var chars = this.chars;
    this.yytext = '';
    for(i=0;i < this.rules.length; i++) {
      match = this.input.match(this.rules[i][0]);
      if(match) {
          this.yytext = match[0];
        if(this.rules[i][1])
            token = this.rules[i][1].call(this);
        this.chars += match[0].length;
        this.input = this.input.slice(match[0].length);
        if(token)
            return token;
        else return;
      }
    }
};

// return next match that has a token
RegExpLexer.prototype.nextToken = function(){
    var r;
    if((r = this.next()) != 'undefined')
        return r;
    else
        return this.nextToken();
}

// For polymorphism, since an array is already tokenized
function ArrayLexer (dict, input) {
  dict = dict || {};
  this.rules = dict.rules;
  this.input = (input || dict.input).slice(0);
}

ArrayLexer.prototype = Object.create(RegExpLexer.prototype);

// return next match in input
ArrayLexer.prototype.next = function(){
    if(!this.input.length) return '';

    return this.input.shift();
};

return {
    RegExpLexer: RegExpLexer,
    ArrayLexer: ArrayLexer
  };

})()

if(typeof exports !== 'undefined')
    exports.JSLex = JSLex;

