/* LEXER written in JavaScript */
// By Zachary Carter

var JSLex = (function(){

    var $EOF = "$";

// expand macros and convert to RegExp's
function prepareRules(rules, macros){
  for(i=0;i < rules.length; i++) {
    m = rules[i][0];
    for(k in macros) {
      if(macros.hasOwnProperty(k))
        m = m.split("{"+k+"}").join(macros[k]);
    }
    rules[i][0] = new RegExp("^"+m);
  }
  return rules;
}

function lex(dict, input) {
  var tokens = [];
  var i, m, k;
  // prepare rules if needed
  var rules = ({}).toString.apply(dict) === '[object Array]' ? dict : prepareRules(dict.rules, dict.macros);
  
  // serve up a curried function if no input string
  if(!input) {
    return function (input){ return lex(rules, input); };
  }

  var EOF = 2; // used to continue loop after input is empty to ensure EOF rules can run

  while(input || EOF) {
    for(i=0;i < rules.length; i++) {
      match = input.match(rules[i][0]);
      if(match) {
        token = rules[i][1].call({yytext: match[0]});
        input = input.slice(match[0].length);
        if(token)
          tokens.push([token, match[0]]);

        break;
      }
    }
    if(!input) EOF--;
  }

  return tokens;
}

var RegExpLexer = function (dict, input) {
  dict = dict || {};
  this.rules = prepareRules(dict.rules, dict.macros);
  this.input = input || dict.input;

  return this;
};

RegExpLexer.prototype = {
    chars: 0,
    tokens: 0,
    done: false,
    yytext: '',
    yylineno: 0,
    lex: function (input) {
         return lex.call(this,
             this.rules,
             input || this.input);
       }
};

// return next match in input
RegExpLexer.prototype.next = function(){
    if(this.done) return '';
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

return {
    lex: lex,
    RegExpLexer: RegExpLexer,
    EOF: $EOF
  };

})()

if(typeof exports !== 'undefined')
    exports.JSLex = JSLex;
