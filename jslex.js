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
        //print("\nindex: "+match.index);
        //print("match: "+match[0]);
        //print("token: "+token);
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

var Lexer = function (dict, input) {
  dict = dict || {};
  this.rules = dict.rules;
  this.input = input || dict.input;
  this.macros = dict.macros;

  return this;
};

Lexer.prototype = {
  lex: function (dict, input) {
         dict = dict || {rules: this.rules, macros:this.macros};
         return lex.call(this,
             rules || this.rules,
             input || this.input);
       }
};

return {
    lex: lex,
    Lexer: Lexer,
    EOF: $EOF
  };

})()

