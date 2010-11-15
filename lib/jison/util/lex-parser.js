/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"include":5,"%%":6,"rules":7,"EOF":8,"action":9,"definition":10,"name":11,"regex":12,"NAME":13,"rule":14,"ACTION":15,"regex_list":16,"|":17,"regex_concat":18,"regex_base":19,"(":20,")":21,"+":22,"*":23,"?":24,"/":25,"/!":26,"name_expansion":27,"range_regex":28,"any_group_regex":29,".":30,"^":31,"$":32,"string":33,"escape_char":34,"{":35,"}":36,"ANY_GROUP_REGEX":37,"ESCAPE_CHAR":38,"RANGE_REGEX":39,"STRING_LIT":40,"$accept":0,"$end":1},
terminals_: {"2":"error","6":"%%","8":"EOF","13":"NAME","15":"ACTION","17":"|","20":"(","21":")","22":"+","23":"*","24":"?","25":"/","26":"/!","30":".","31":"^","32":"$","35":"{","36":"}","37":"ANY_GROUP_REGEX","38":"ESCAPE_CHAR","39":"RANGE_REGEX","40":"STRING_LIT"},
productions_: [0,[3,6],[3,5],[5,1],[5,0],[4,2],[4,0],[10,2],[11,1],[7,2],[7,1],[14,2],[9,1],[12,1],[16,3],[16,1],[18,2],[18,1],[19,3],[19,2],[19,2],[19,2],[19,2],[19,2],[19,1],[19,2],[19,1],[19,1],[19,1],[19,1],[19,1],[19,1],[27,3],[29,1],[34,1],[28,1],[33,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy) { 
var $$ = arguments[5],$0=arguments[5].length;
switch(arguments[4]) {
case 1: this.$ = {rules: $$[$0-6+4-1]};
          if ($$[$0-6+1-1]) this.$.macros = $$[$0-6+1-1];
          if ($$[$0-6+2-1]) this.$.actionInclude = $$[$0-6+2-1];
          return this.$; 
break;
case 2: this.$ = {rules: $$[$0-5+4-1]};
          if ($$[$0-5+1-1]) this.$.macros = $$[$0-5+1-1];
          if ($$[$0-5+2-1]) this.$.actionInclude = $$[$0-5+2-1];
          return this.$; 
break;
case 5: this.$ = $$[$0-2+1-1] || {}; this.$[$$[$0-2+2-1][0]] = $$[$0-2+2-1][1]; 
break;
case 6: this.$ = null; 
break;
case 7: this.$ = [$$[$0-2+1-1], $$[$0-2+2-1]]; 
break;
case 8: this.$ = yytext; 
break;
case 9: this.$ = $$[$0-2+1-1]; this.$.push($$[$0-2+2-1]); 
break;
case 10: this.$ = [$$[$0-1+1-1]]; 
break;
case 11: this.$ = [$$[$0-2+1-1], $$[$0-2+2-1]]; 
break;
case 12: this.$ = yytext; 
break;
case 13: this.$ = $$[$0-1+1-1]; 
          if (this.$.match(/[\w\d]$/))
              this.$ += "\\b";
        
break;
case 14: this.$ = $$[$0-3+1-1]+'|'+$$[$0-3+3-1]; 
break;
case 16: this.$ = $$[$0-2+1-1]+$$[$0-2+2-1]; 
break;
case 18: this.$ = '('+$$[$0-3+2-1]+')'; 
break;
case 19: this.$ = $$[$0-2+1-1]+'+'; 
break;
case 20: this.$ = $$[$0-2+1-1]+'*'; 
break;
case 21: this.$ = $$[$0-2+1-1]+'?'; 
break;
case 22: this.$ = '(?='+$$[$0-2+2-1]+')'; 
break;
case 23: this.$ = '(?!'+$$[$0-2+2-1]+')'; 
break;
case 25: this.$ = $$[$0-2+1-1]+$$[$0-2+2-1]; 
break;
case 27: this.$ = '.'; 
break;
case 28: this.$ = '^'; 
break;
case 29: this.$ = '$'; 
break;
case 32: this.$ = '{'+$$[$0-3+2-1]+'}'; 
break;
case 33: this.$ = yytext; 
break;
case 34: this.$ = yytext; 
break;
case 35: this.$ = yytext; 
break;
case 36: this.$ = yy.prepareString(yytext.substr(1, yytext.length-2)); 
break;
}
},
table: [{"3":1,"4":2,"6":[2,6],"15":[2,6],"13":[2,6]},{"1":[3]},{"5":3,"10":4,"9":5,"11":6,"15":[1,7],"13":[1,8],"6":[2,4]},{"6":[1,9]},{"6":[2,5],"15":[2,5],"13":[2,5]},{"6":[2,3]},{"12":10,"16":11,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"6":[2,12],"8":[2,12],"20":[2,12],"25":[2,12],"26":[2,12],"30":[2,12],"31":[2,12],"32":[2,12],"35":[2,12],"37":[2,12],"40":[2,12],"38":[2,12]},{"20":[2,8],"25":[2,8],"26":[2,8],"30":[2,8],"31":[2,8],"32":[2,8],"35":[2,8],"37":[2,8],"40":[2,8],"38":[2,8],"36":[2,8]},{"7":28,"14":29,"12":30,"16":11,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"13":[2,7],"15":[2,7],"6":[2,7]},{"17":[1,31],"6":[2,13],"15":[2,13],"13":[2,13]},{"19":32,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27],"13":[2,15],"15":[2,15],"6":[2,15],"17":[2,15],"21":[2,15]},{"22":[1,33],"23":[1,34],"24":[1,35],"28":36,"39":[1,37],"17":[2,17],"6":[2,17],"15":[2,17],"13":[2,17],"20":[2,17],"25":[2,17],"26":[2,17],"30":[2,17],"31":[2,17],"32":[2,17],"35":[2,17],"37":[2,17],"40":[2,17],"38":[2,17],"21":[2,17]},{"16":38,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"19":39,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"19":40,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"38":[2,24],"40":[2,24],"37":[2,24],"35":[2,24],"32":[2,24],"31":[2,24],"30":[2,24],"26":[2,24],"25":[2,24],"20":[2,24],"13":[2,24],"15":[2,24],"6":[2,24],"17":[2,24],"22":[2,24],"23":[2,24],"24":[2,24],"39":[2,24],"21":[2,24]},{"38":[2,26],"40":[2,26],"37":[2,26],"35":[2,26],"32":[2,26],"31":[2,26],"30":[2,26],"26":[2,26],"25":[2,26],"20":[2,26],"13":[2,26],"15":[2,26],"6":[2,26],"17":[2,26],"22":[2,26],"23":[2,26],"24":[2,26],"39":[2,26],"21":[2,26]},{"38":[2,27],"40":[2,27],"37":[2,27],"35":[2,27],"32":[2,27],"31":[2,27],"30":[2,27],"26":[2,27],"25":[2,27],"20":[2,27],"13":[2,27],"15":[2,27],"6":[2,27],"17":[2,27],"22":[2,27],"23":[2,27],"24":[2,27],"39":[2,27],"21":[2,27]},{"38":[2,28],"40":[2,28],"37":[2,28],"35":[2,28],"32":[2,28],"31":[2,28],"30":[2,28],"26":[2,28],"25":[2,28],"20":[2,28],"13":[2,28],"15":[2,28],"6":[2,28],"17":[2,28],"22":[2,28],"23":[2,28],"24":[2,28],"39":[2,28],"21":[2,28]},{"38":[2,29],"40":[2,29],"37":[2,29],"35":[2,29],"32":[2,29],"31":[2,29],"30":[2,29],"26":[2,29],"25":[2,29],"20":[2,29],"13":[2,29],"15":[2,29],"6":[2,29],"17":[2,29],"22":[2,29],"23":[2,29],"24":[2,29],"39":[2,29],"21":[2,29]},{"38":[2,30],"40":[2,30],"37":[2,30],"35":[2,30],"32":[2,30],"31":[2,30],"30":[2,30],"26":[2,30],"25":[2,30],"20":[2,30],"13":[2,30],"15":[2,30],"6":[2,30],"17":[2,30],"22":[2,30],"23":[2,30],"24":[2,30],"39":[2,30],"21":[2,30]},{"38":[2,31],"40":[2,31],"37":[2,31],"35":[2,31],"32":[2,31],"31":[2,31],"30":[2,31],"26":[2,31],"25":[2,31],"20":[2,31],"13":[2,31],"15":[2,31],"6":[2,31],"17":[2,31],"22":[2,31],"23":[2,31],"24":[2,31],"39":[2,31],"21":[2,31]},{"11":41,"13":[1,8]},{"39":[2,33],"24":[2,33],"23":[2,33],"22":[2,33],"17":[2,33],"6":[2,33],"15":[2,33],"13":[2,33],"20":[2,33],"25":[2,33],"26":[2,33],"30":[2,33],"31":[2,33],"32":[2,33],"35":[2,33],"37":[2,33],"40":[2,33],"38":[2,33],"21":[2,33]},{"39":[2,36],"24":[2,36],"23":[2,36],"22":[2,36],"17":[2,36],"6":[2,36],"15":[2,36],"13":[2,36],"20":[2,36],"25":[2,36],"26":[2,36],"30":[2,36],"31":[2,36],"32":[2,36],"35":[2,36],"37":[2,36],"40":[2,36],"38":[2,36],"21":[2,36]},{"39":[2,34],"24":[2,34],"23":[2,34],"22":[2,34],"17":[2,34],"6":[2,34],"15":[2,34],"13":[2,34],"20":[2,34],"25":[2,34],"26":[2,34],"30":[2,34],"31":[2,34],"32":[2,34],"35":[2,34],"37":[2,34],"40":[2,34],"38":[2,34],"21":[2,34]},{"6":[1,42],"8":[1,43],"14":44,"12":30,"16":11,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"6":[2,10],"8":[2,10],"20":[2,10],"25":[2,10],"26":[2,10],"30":[2,10],"31":[2,10],"32":[2,10],"35":[2,10],"37":[2,10],"40":[2,10],"38":[2,10]},{"9":45,"15":[1,7]},{"16":46,"18":12,"19":13,"20":[1,14],"25":[1,15],"26":[1,16],"27":17,"29":18,"30":[1,19],"31":[1,20],"32":[1,21],"33":22,"34":23,"35":[1,24],"37":[1,25],"40":[1,26],"38":[1,27]},{"22":[1,33],"23":[1,34],"24":[1,35],"28":36,"39":[1,37],"17":[2,16],"6":[2,16],"15":[2,16],"13":[2,16],"20":[2,16],"25":[2,16],"26":[2,16],"30":[2,16],"31":[2,16],"32":[2,16],"35":[2,16],"37":[2,16],"40":[2,16],"38":[2,16],"21":[2,16]},{"38":[2,19],"40":[2,19],"37":[2,19],"35":[2,19],"32":[2,19],"31":[2,19],"30":[2,19],"26":[2,19],"25":[2,19],"20":[2,19],"13":[2,19],"15":[2,19],"6":[2,19],"17":[2,19],"22":[2,19],"23":[2,19],"24":[2,19],"39":[2,19],"21":[2,19]},{"38":[2,20],"40":[2,20],"37":[2,20],"35":[2,20],"32":[2,20],"31":[2,20],"30":[2,20],"26":[2,20],"25":[2,20],"20":[2,20],"13":[2,20],"15":[2,20],"6":[2,20],"17":[2,20],"22":[2,20],"23":[2,20],"24":[2,20],"39":[2,20],"21":[2,20]},{"38":[2,21],"40":[2,21],"37":[2,21],"35":[2,21],"32":[2,21],"31":[2,21],"30":[2,21],"26":[2,21],"25":[2,21],"20":[2,21],"13":[2,21],"15":[2,21],"6":[2,21],"17":[2,21],"22":[2,21],"23":[2,21],"24":[2,21],"39":[2,21],"21":[2,21]},{"38":[2,25],"40":[2,25],"37":[2,25],"35":[2,25],"32":[2,25],"31":[2,25],"30":[2,25],"26":[2,25],"25":[2,25],"20":[2,25],"13":[2,25],"15":[2,25],"6":[2,25],"17":[2,25],"22":[2,25],"23":[2,25],"24":[2,25],"39":[2,25],"21":[2,25]},{"39":[2,35],"24":[2,35],"23":[2,35],"22":[2,35],"17":[2,35],"6":[2,35],"15":[2,35],"13":[2,35],"20":[2,35],"25":[2,35],"26":[2,35],"30":[2,35],"31":[2,35],"32":[2,35],"35":[2,35],"37":[2,35],"40":[2,35],"38":[2,35],"21":[2,35]},{"21":[1,47],"17":[1,31]},{"22":[1,33],"23":[1,34],"24":[1,35],"28":36,"39":[1,37],"38":[2,22],"40":[2,22],"37":[2,22],"35":[2,22],"32":[2,22],"31":[2,22],"30":[2,22],"26":[2,22],"25":[2,22],"20":[2,22],"13":[2,22],"15":[2,22],"6":[2,22],"17":[2,22],"21":[2,22]},{"22":[1,33],"23":[1,34],"24":[1,35],"28":36,"39":[1,37],"38":[2,23],"40":[2,23],"37":[2,23],"35":[2,23],"32":[2,23],"31":[2,23],"30":[2,23],"26":[2,23],"25":[2,23],"20":[2,23],"13":[2,23],"15":[2,23],"6":[2,23],"17":[2,23],"21":[2,23]},{"36":[1,48]},{"8":[1,49]},{"1":[2,2]},{"6":[2,9],"8":[2,9],"20":[2,9],"25":[2,9],"26":[2,9],"30":[2,9],"31":[2,9],"32":[2,9],"35":[2,9],"37":[2,9],"40":[2,9],"38":[2,9]},{"38":[2,11],"40":[2,11],"37":[2,11],"35":[2,11],"32":[2,11],"31":[2,11],"30":[2,11],"26":[2,11],"25":[2,11],"20":[2,11],"8":[2,11],"6":[2,11]},{"17":[1,31],"13":[2,14],"15":[2,14],"6":[2,14],"21":[2,14]},{"38":[2,18],"40":[2,18],"37":[2,18],"35":[2,18],"32":[2,18],"31":[2,18],"30":[2,18],"26":[2,18],"25":[2,18],"20":[2,18],"13":[2,18],"15":[2,18],"6":[2,18],"17":[2,18],"22":[2,18],"23":[2,18],"24":[2,18],"39":[2,18],"21":[2,18]},{"24":[2,32],"23":[2,32],"22":[2,32],"17":[2,32],"6":[2,32],"15":[2,32],"13":[2,32],"20":[2,32],"25":[2,32],"26":[2,32],"30":[2,32],"31":[2,32],"32":[2,32],"35":[2,32],"37":[2,32],"40":[2,32],"38":[2,32],"39":[2,32],"21":[2,32]},{"1":[2,1]}],
defaultActions: {"5":[2,3],"43":[2,2],"49":[2,1]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        shifts = 0,
        reductions = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;

    var parseError = this.yy.parseError = typeof this.yy.parseError == 'function' ? this.yy.parseError : this.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected, recovered = false;
    while (true) {
        // retreive state number from top of stack
        state = stack[stack.length-1];

        // use default actions if available
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            // read action for current state and first input
            action = table[state] && table[state][symbol];
        }

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                var errStr = '';
                if (this.lexer.showPosition) {
                    errStr = 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', ');
                } else {
                    errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
                                  (symbol == 1 /*EOF*/ ? "end of input" :
                                              ("'"+(this.terminals_[symbol] || symbol)+"'"));
                }
                    parseError.call(this, errStr,
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || 'Parsing halted.');
                }

                // discard current lookahead and grab another
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }

            // try to recover from error
            while (1) {
                // check for error recovery rule in this state
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || 'Parsing halted.');
                }
                popStack(1);
                state = stack[stack.length-1];
            }
            
            preErrorSymbol = symbol; // save the lookahead token
            symbol = TERROR;         // insert generic error symbol as new lookahead
            state = stack[stack.length-1];
            action = table[state] && table[state][TERROR];
            recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
        }

        // this shouldn't happen, unless resolve defaults are off
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
        }

        a = action; 

        switch (a[0]) {

            case 1: // shift
                shifts++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext); // semantic values or junk only, no terminals
                stack.push(a[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                reductions++;

                len = this.productions_[a[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, a[1], vstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                }

                stack.push(this.productions_[a[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept

                this.reductionCount = reductions;
                this.shiftCount = shifts;
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:"",
parseError:function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        this._input = ch + this._input;
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        for (var i=0;i < this.rules.length; i++) {
            match = this._input.match(this.rules[i]);
            if (match) {
                lines = match[0].match(/\n/g);
                if (lines) this.yylineno += lines.length;
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, i);
                if (token) return token;
                else return;
            }
        }
        if (this._input == this.EOF) {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function () {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    }});
lexer.performAction = function anonymous(yy, yy_) { 
switch(arguments[2]) {
case 0:yy.freshLine = true;
break;
case 1:if (yy.ruleSection) yy.freshLine = false;
break;
case 2:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-3);return 15;
break;
case 3:return 13;
break;
case 4:yy_.yytext = yy_.yytext.replace(/\\"/g,'"');return 40;
break;
case 5:yy_.yytext = yy_.yytext.replace(/\\'/g,"'");return 40;
break;
case 6:return 17;
break;
case 7:return 37;
break;
case 8:return 20;
break;
case 9:return 21;
break;
case 10:return 22;
break;
case 11:return 23;
break;
case 12:return 24;
break;
case 13:return 31;
break;
case 14:return 26;
break;
case 15:return 25;
break;
case 16:return 38;
break;
case 17:return 32;
break;
case 18:return 32;
break;
case 19:return 30;
break;
case 20:yy.ruleSection = true; return 6;
break;
case 21:return 39;
break;
case 22:if (yy.freshLine) {this.input('{');return 35;} else this.unput('y');
break;
case 23:return 36;
break;
case 24:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 15;
break;
case 25:/* ignore bad characters */
break;
case 26:return 8;
break;
}
};
lexer.rules = [/^\n+/,/^\s+/,/^y\{[^}]*\}/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^\/!/,/^\//,/^\\[a-zA-Z0]/,/^\$/,/^<<EOF>>/,/^\./,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^(?=\{)/,/^\}/,/^%\{(.|\n)*?%\}/,/^./,/^$/];return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined') {
exports.parser = jisonlex;
exports.parse = function () { return jisonlex.parse.apply(jisonlex, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    if (typeof process !== 'undefined') {
        var source = require('fs').readFileSync(require('path').join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}