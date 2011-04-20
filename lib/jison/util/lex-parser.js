/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"include":5,"%%":6,"rules":7,"epilogue":8,"EOF":9,"action":10,"definition":11,"name":12,"regex":13,"START_INC":14,"names_inclusive":15,"START_EXC":16,"names_exclusive":17,"NAME":18,"rule":19,"start_conditions":20,"<":21,"name_list":22,">":23,"*":24,",":25,"ACTION":26,"regex_list":27,"|":28,"regex_concat":29,"regex_base":30,"(":31,")":32,"+":33,"?":34,"/":35,"/!":36,"name_expansion":37,"range_regex":38,"any_group_regex":39,".":40,"^":41,"$":42,"string":43,"escape_char":44,"{":45,"}":46,"ANY_GROUP_REGEX":47,"ESCAPE_CHAR":48,"RANGE_REGEX":49,"STRING_LIT":50,"$accept":0,"$end":1},
terminals_: {2:"error",6:"%%",9:"EOF",14:"START_INC",16:"START_EXC",18:"NAME",21:"<",23:">",24:"*",25:",",26:"ACTION",28:"|",31:"(",32:")",33:"+",34:"?",35:"/",36:"/!",40:".",41:"^",42:"$",45:"{",46:"}",47:"ANY_GROUP_REGEX",48:"ESCAPE_CHAR",49:"RANGE_REGEX",50:"STRING_LIT"},
productions_: [0,[3,5],[8,1],[8,2],[5,1],[5,0],[4,2],[4,0],[11,2],[11,2],[11,2],[15,1],[15,2],[17,1],[17,2],[12,1],[7,2],[7,1],[19,3],[20,3],[20,3],[20,0],[22,1],[22,3],[10,1],[13,1],[27,3],[27,1],[29,2],[29,1],[30,3],[30,2],[30,2],[30,2],[30,2],[30,2],[30,1],[30,2],[30,1],[30,1],[30,1],[30,1],[30,1],[30,1],[37,3],[39,1],[44,1],[38,1],[43,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: this.$ = {rules: $$[$0-1]};
          if ($$[$0-4][0]) this.$.macros = $$[$0-4][0];
          if ($$[$0-4][1]) this.$.startConditions = $$[$0-4][1];
          if ($$[$0-3]) this.$.actionInclude = $$[$0-3];
          return this.$; 
break;
case 6: 
          this.$ = $$[$0-1];
          if ('length' in $$[$0]) {
            this.$[0] = this.$[0] || {};
            this.$[0][$$[$0][0]] = $$[$0][1];
          } else {
            this.$[1] = this.$[1] || {};
            for (var name in $$[$0]) {
              this.$[1][name] = $$[$0][name];
            }
          }
        
break;
case 7: this.$ = [null,null]; 
break;
case 8: this.$ = [$$[$0-1], $$[$0]]; 
break;
case 9: this.$ = $$[$0]; 
break;
case 10: this.$ = $$[$0]; 
break;
case 11: this.$ = {}; this.$[$$[$0]] = 0; 
break;
case 12: this.$ = $$[$0-1]; this.$[$$[$0]] = 0; 
break;
case 13: this.$ = {}; this.$[$$[$0]] = 1; 
break;
case 14: this.$ = $$[$0-1]; this.$[$$[$0]] = 1; 
break;
case 15: this.$ = yytext; 
break;
case 16: this.$ = $$[$0-1]; this.$.push($$[$0]); 
break;
case 17: this.$ = [$$[$0]]; 
break;
case 18: this.$ = $$[$0-2] ? [$$[$0-2], $$[$0-1], $$[$0]] : [$$[$0-1],$$[$0]]; 
break;
case 19: this.$ = $$[$0-1]; 
break;
case 20: this.$ = ['*']; 
break;
case 22: this.$ = [$$[$0]]; 
break;
case 23: this.$ = $$[$0-2]; this.$.push($$[$0]); 
break;
case 24: this.$ = yytext; 
break;
case 25: this.$ = $$[$0]; 
          if (this.$.match(/[\w\d]$/) && !this.$.match(/\\u[a-fA-F0-9]{4}$/))
              this.$ += "\\b";
        
break;
case 26: this.$ = $$[$0-2]+'|'+$$[$0]; 
break;
case 28: this.$ = $$[$0-1]+$$[$0]; 
break;
case 30: this.$ = '('+$$[$0-1]+')'; 
break;
case 31: this.$ = $$[$0-1]+'+'; 
break;
case 32: this.$ = $$[$0-1]+'*'; 
break;
case 33: this.$ = $$[$0-1]+'?'; 
break;
case 34: this.$ = '(?='+$$[$0]+')'; 
break;
case 35: this.$ = '(?!'+$$[$0]+')'; 
break;
case 37: this.$ = $$[$0-1]+$$[$0]; 
break;
case 39: this.$ = '.'; 
break;
case 40: this.$ = '^'; 
break;
case 41: this.$ = '$'; 
break;
case 44: this.$ = '{'+$$[$0-1]+'}'; 
break;
case 45: this.$ = yytext; 
break;
case 46: this.$ = yytext; 
break;
case 47: this.$ = yytext; 
break;
case 48: this.$ = yy.prepareString(yytext.substr(1, yytext.length-2)); 
break;
}
},
table: [{3:1,4:2,6:[2,7],14:[2,7],16:[2,7],18:[2,7],26:[2,7]},{1:[3]},{5:3,6:[2,5],10:5,11:4,12:6,14:[1,7],16:[1,8],18:[1,10],26:[1,9]},{6:[1,11]},{6:[2,6],14:[2,6],16:[2,6],18:[2,6],26:[2,6]},{6:[2,4]},{13:12,27:13,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{15:30,18:[1,31]},{17:32,18:[1,33]},{6:[2,24],9:[2,24],21:[2,24],31:[2,24],35:[2,24],36:[2,24],40:[2,24],41:[2,24],42:[2,24],45:[2,24],47:[2,24],48:[2,24],50:[2,24]},{31:[2,15],35:[2,15],36:[2,15],40:[2,15],41:[2,15],42:[2,15],45:[2,15],46:[2,15],47:[2,15],48:[2,15],50:[2,15]},{7:34,19:35,20:36,21:[1,37],31:[2,21],35:[2,21],36:[2,21],40:[2,21],41:[2,21],42:[2,21],45:[2,21],47:[2,21],48:[2,21],50:[2,21]},{6:[2,8],14:[2,8],16:[2,8],18:[2,8],26:[2,8]},{6:[2,25],14:[2,25],16:[2,25],18:[2,25],26:[2,25],28:[1,38]},{6:[2,27],14:[2,27],16:[2,27],18:[2,27],26:[2,27],28:[2,27],30:39,31:[1,16],32:[2,27],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{6:[2,29],14:[2,29],16:[2,29],18:[2,29],24:[1,41],26:[2,29],28:[2,29],31:[2,29],32:[2,29],33:[1,40],34:[1,42],35:[2,29],36:[2,29],38:43,40:[2,29],41:[2,29],42:[2,29],45:[2,29],47:[2,29],48:[2,29],49:[1,44],50:[2,29]},{27:45,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{30:46,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{30:47,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{6:[2,36],14:[2,36],16:[2,36],18:[2,36],24:[2,36],26:[2,36],28:[2,36],31:[2,36],32:[2,36],33:[2,36],34:[2,36],35:[2,36],36:[2,36],40:[2,36],41:[2,36],42:[2,36],45:[2,36],47:[2,36],48:[2,36],49:[2,36],50:[2,36]},{6:[2,38],14:[2,38],16:[2,38],18:[2,38],24:[2,38],26:[2,38],28:[2,38],31:[2,38],32:[2,38],33:[2,38],34:[2,38],35:[2,38],36:[2,38],40:[2,38],41:[2,38],42:[2,38],45:[2,38],47:[2,38],48:[2,38],49:[2,38],50:[2,38]},{6:[2,39],14:[2,39],16:[2,39],18:[2,39],24:[2,39],26:[2,39],28:[2,39],31:[2,39],32:[2,39],33:[2,39],34:[2,39],35:[2,39],36:[2,39],40:[2,39],41:[2,39],42:[2,39],45:[2,39],47:[2,39],48:[2,39],49:[2,39],50:[2,39]},{6:[2,40],14:[2,40],16:[2,40],18:[2,40],24:[2,40],26:[2,40],28:[2,40],31:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],41:[2,40],42:[2,40],45:[2,40],47:[2,40],48:[2,40],49:[2,40],50:[2,40]},{6:[2,41],14:[2,41],16:[2,41],18:[2,41],24:[2,41],26:[2,41],28:[2,41],31:[2,41],32:[2,41],33:[2,41],34:[2,41],35:[2,41],36:[2,41],40:[2,41],41:[2,41],42:[2,41],45:[2,41],47:[2,41],48:[2,41],49:[2,41],50:[2,41]},{6:[2,42],14:[2,42],16:[2,42],18:[2,42],24:[2,42],26:[2,42],28:[2,42],31:[2,42],32:[2,42],33:[2,42],34:[2,42],35:[2,42],36:[2,42],40:[2,42],41:[2,42],42:[2,42],45:[2,42],47:[2,42],48:[2,42],49:[2,42],50:[2,42]},{6:[2,43],14:[2,43],16:[2,43],18:[2,43],24:[2,43],26:[2,43],28:[2,43],31:[2,43],32:[2,43],33:[2,43],34:[2,43],35:[2,43],36:[2,43],40:[2,43],41:[2,43],42:[2,43],45:[2,43],47:[2,43],48:[2,43],49:[2,43],50:[2,43]},{12:48,18:[1,10]},{6:[2,45],14:[2,45],16:[2,45],18:[2,45],24:[2,45],26:[2,45],28:[2,45],31:[2,45],32:[2,45],33:[2,45],34:[2,45],35:[2,45],36:[2,45],40:[2,45],41:[2,45],42:[2,45],45:[2,45],47:[2,45],48:[2,45],49:[2,45],50:[2,45]},{6:[2,48],14:[2,48],16:[2,48],18:[2,48],24:[2,48],26:[2,48],28:[2,48],31:[2,48],32:[2,48],33:[2,48],34:[2,48],35:[2,48],36:[2,48],40:[2,48],41:[2,48],42:[2,48],45:[2,48],47:[2,48],48:[2,48],49:[2,48],50:[2,48]},{6:[2,46],14:[2,46],16:[2,46],18:[2,46],24:[2,46],26:[2,46],28:[2,46],31:[2,46],32:[2,46],33:[2,46],34:[2,46],35:[2,46],36:[2,46],40:[2,46],41:[2,46],42:[2,46],45:[2,46],47:[2,46],48:[2,46],49:[2,46],50:[2,46]},{6:[2,9],14:[2,9],16:[2,9],18:[1,49],26:[2,9]},{6:[2,11],14:[2,11],16:[2,11],18:[2,11],26:[2,11]},{6:[2,10],14:[2,10],16:[2,10],18:[1,50],26:[2,10]},{6:[2,13],14:[2,13],16:[2,13],18:[2,13],26:[2,13]},{6:[1,54],8:51,9:[1,53],19:52,20:36,21:[1,37],31:[2,21],35:[2,21],36:[2,21],40:[2,21],41:[2,21],42:[2,21],45:[2,21],47:[2,21],48:[2,21],50:[2,21]},{6:[2,17],9:[2,17],21:[2,17],31:[2,17],35:[2,17],36:[2,17],40:[2,17],41:[2,17],42:[2,17],45:[2,17],47:[2,17],48:[2,17],50:[2,17]},{13:55,27:13,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{18:[1,58],22:56,24:[1,57]},{27:59,29:14,30:15,31:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],48:[1,29],50:[1,28]},{6:[2,28],14:[2,28],16:[2,28],18:[2,28],24:[1,41],26:[2,28],28:[2,28],31:[2,28],32:[2,28],33:[1,40],34:[1,42],35:[2,28],36:[2,28],38:43,40:[2,28],41:[2,28],42:[2,28],45:[2,28],47:[2,28],48:[2,28],49:[1,44],50:[2,28]},{6:[2,31],14:[2,31],16:[2,31],18:[2,31],24:[2,31],26:[2,31],28:[2,31],31:[2,31],32:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[2,31],40:[2,31],41:[2,31],42:[2,31],45:[2,31],47:[2,31],48:[2,31],49:[2,31],50:[2,31]},{6:[2,32],14:[2,32],16:[2,32],18:[2,32],24:[2,32],26:[2,32],28:[2,32],31:[2,32],32:[2,32],33:[2,32],34:[2,32],35:[2,32],36:[2,32],40:[2,32],41:[2,32],42:[2,32],45:[2,32],47:[2,32],48:[2,32],49:[2,32],50:[2,32]},{6:[2,33],14:[2,33],16:[2,33],18:[2,33],24:[2,33],26:[2,33],28:[2,33],31:[2,33],32:[2,33],33:[2,33],34:[2,33],35:[2,33],36:[2,33],40:[2,33],41:[2,33],42:[2,33],45:[2,33],47:[2,33],48:[2,33],49:[2,33],50:[2,33]},{6:[2,37],14:[2,37],16:[2,37],18:[2,37],24:[2,37],26:[2,37],28:[2,37],31:[2,37],32:[2,37],33:[2,37],34:[2,37],35:[2,37],36:[2,37],40:[2,37],41:[2,37],42:[2,37],45:[2,37],47:[2,37],48:[2,37],49:[2,37],50:[2,37]},{6:[2,47],14:[2,47],16:[2,47],18:[2,47],24:[2,47],26:[2,47],28:[2,47],31:[2,47],32:[2,47],33:[2,47],34:[2,47],35:[2,47],36:[2,47],40:[2,47],41:[2,47],42:[2,47],45:[2,47],47:[2,47],48:[2,47],49:[2,47],50:[2,47]},{28:[1,38],32:[1,60]},{6:[2,34],14:[2,34],16:[2,34],18:[2,34],24:[1,41],26:[2,34],28:[2,34],31:[2,34],32:[2,34],33:[1,40],34:[1,42],35:[2,34],36:[2,34],38:43,40:[2,34],41:[2,34],42:[2,34],45:[2,34],47:[2,34],48:[2,34],49:[1,44],50:[2,34]},{6:[2,35],14:[2,35],16:[2,35],18:[2,35],24:[1,41],26:[2,35],28:[2,35],31:[2,35],32:[2,35],33:[1,40],34:[1,42],35:[2,35],36:[2,35],38:43,40:[2,35],41:[2,35],42:[2,35],45:[2,35],47:[2,35],48:[2,35],49:[1,44],50:[2,35]},{46:[1,61]},{6:[2,12],14:[2,12],16:[2,12],18:[2,12],26:[2,12]},{6:[2,14],14:[2,14],16:[2,14],18:[2,14],26:[2,14]},{1:[2,1]},{6:[2,16],9:[2,16],21:[2,16],31:[2,16],35:[2,16],36:[2,16],40:[2,16],41:[2,16],42:[2,16],45:[2,16],47:[2,16],48:[2,16],50:[2,16]},{1:[2,2]},{9:[1,62]},{10:63,26:[1,9]},{23:[1,64],25:[1,65]},{23:[1,66]},{23:[2,22],25:[2,22]},{6:[2,26],14:[2,26],16:[2,26],18:[2,26],26:[2,26],28:[1,38],32:[2,26]},{6:[2,30],14:[2,30],16:[2,30],18:[2,30],24:[2,30],26:[2,30],28:[2,30],31:[2,30],32:[2,30],33:[2,30],34:[2,30],35:[2,30],36:[2,30],40:[2,30],41:[2,30],42:[2,30],45:[2,30],47:[2,30],48:[2,30],49:[2,30],50:[2,30]},{6:[2,44],14:[2,44],16:[2,44],18:[2,44],24:[2,44],26:[2,44],28:[2,44],31:[2,44],32:[2,44],33:[2,44],34:[2,44],35:[2,44],36:[2,44],40:[2,44],41:[2,44],42:[2,44],45:[2,44],47:[2,44],48:[2,44],49:[2,44],50:[2,44]},{1:[2,3]},{6:[2,18],9:[2,18],21:[2,18],31:[2,18],35:[2,18],36:[2,18],40:[2,18],41:[2,18],42:[2,18],45:[2,18],47:[2,18],48:[2,18],50:[2,18]},{31:[2,19],35:[2,19],36:[2,19],40:[2,19],41:[2,19],42:[2,19],45:[2,19],47:[2,19],48:[2,19],50:[2,19]},{18:[1,67]},{31:[2,20],35:[2,20],36:[2,20],40:[2,20],41:[2,20],42:[2,20],45:[2,20],47:[2,20],48:[2,20],50:[2,20]},{23:[2,23],25:[2,23]}],
defaultActions: {5:[2,4],51:[2,1],53:[2,2],62:[2,3]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this,
        stack = [0],
        vstack = [null], // semantic value stack
        lstack = [], // location stack
        table = this.table,
        yytext = '',
        yylineno = 0,
        yyleng = 0,
        recovering = 0,
        TERROR = 2,
        EOF = 1;

    //this.reductionCount = this.shiftCount = 0;

    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == 'undefined')
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);

    if (typeof this.yy.parseError === 'function')
        this.parseError = this.yy.parseError;

    function popStack (n) {
        stack.length = stack.length - 2*n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
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

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected;
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
                this.parseError(errStr,
                    {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
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
                yyloc = this.lexer.yylloc;
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

        switch (action[0]) {

            case 1: // shift
                //this.shiftCount++;

                stack.push(symbol);
                vstack.push(this.lexer.yytext);
                lstack.push(this.lexer.yylloc);
                stack.push(action[1]); // push state
                symbol = null;
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    yyloc = this.lexer.yylloc;
                    if (recovering > 0)
                        recovering--;
                } else { // error just occurred, resume old lookahead f/ before error
                    symbol = preErrorSymbol;
                    preErrorSymbol = null;
                }
                break;

            case 2: // reduce
                //this.reductionCount++;

                len = this.productions_[action[1]][1];

                // perform semantic action
                yyval.$ = vstack[vstack.length-len]; // default to $$ = $1
                // default location, uses first token for firsts, last for lasts
                yyval._$ = {
                    first_line: lstack[lstack.length-(len||1)].first_line,
                    last_line: lstack[lstack.length-1].last_line,
                    first_column: lstack[lstack.length-(len||1)].first_column,
                    last_column: lstack[lstack.length-1].last_column
                };
                r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);

                if (typeof r !== 'undefined') {
                    return r;
                }

                // pop off stack
                if (len) {
                    stack = stack.slice(0,-1*len*2);
                    vstack = vstack.slice(0, -1*len);
                    lstack = lstack.slice(0, -1*len);
                }

                stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
                vstack.push(yyval.$);
                lstack.push(yyval._$);
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[stack[stack.length-2]][stack[stack.length-1]];
                stack.push(newState);
                break;

            case 3: // accept
                return true;
        }

    }

    return true;
}};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:1,
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
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
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
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    }});
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:this.begin('INITIAL')
break;
case 1:this.begin('trail'); yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length-2);return 26;
break;
case 2:this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 26;
break;
case 3:this.begin('INITIAL'); return 26
break;
case 4:this.begin('INITIAL')
break;
case 5:if (yy.ruleSection) this.begin('indented')
break;
case 6:return 18
break;
case 7:yy_.yytext = yy_.yytext.replace(/\\"/g,'"');return 50;
break;
case 8:yy_.yytext = yy_.yytext.replace(/\\'/g,"'");return 50;
break;
case 9:return 28
break;
case 10:return 47
break;
case 11:return 31
break;
case 12:return 32
break;
case 13:return 33
break;
case 14:return 24
break;
case 15:return 34
break;
case 16:return 41
break;
case 17:return 25
break;
case 18:return 42
break;
case 19:return 21
break;
case 20:return 23
break;
case 21:return 36
break;
case 22:return 35
break;
case 23:yy_.yytext = yy_.yytext.replace(/\\"/g,'"'); return 48
break;
case 24:return 42
break;
case 25:return 40
break;
case 26:return 14
break;
case 27:return 16
break;
case 28:yy.ruleSection = true; return 6
break;
case 29:return 49
break;
case 30:return 45
break;
case 31:return 46
break;
case 32:/* ignore bad characters */
break;
case 33:return 9
break;
}
};
lexer.rules = [/^.*\n+/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^.+/,/^\n+/,/^\s+/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^,/,/^<<EOF>>/,/^</,/^>/,/^\/!/,/^\//,/^\\[a-zA-Z0"]/,/^\$/,/^\./,/^%s\b/,/^%x\b/,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^\{/,/^\}/,/^./,/^$/];
lexer.conditions = {"indented":{"rules":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],"inclusive":true},"trail":{"rules":[0,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],"inclusive":true},"INITIAL":{"rules":[2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
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