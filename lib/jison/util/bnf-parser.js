/* Jison generated parser */
var bnf = (function(){

var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"spec":3,"declaration_list":4,"%%":5,"grammar":6,"EOF":7,"CODE":8,"declaration":9,"START":10,"id":11,"LEX_BLOCK":12,"operator":13,"ACTION":14,"associativity":15,"token_list":16,"LEFT":17,"RIGHT":18,"NONASSOC":19,"symbol":20,"production_list":21,"production":22,":":23,"handle_list":24,";":25,"|":26,"handle_action":27,"handle":28,"prec":29,"action":30,"PREC":31,"STRING":32,"ID":33,"{":34,"action_body":35,"}":36,"ARROW_ACTION":37,"ACTION_BODY":38,"$accept":0,"$end":1},
terminals_: {2:"error",5:"%%",7:"EOF",8:"CODE",10:"START",12:"LEX_BLOCK",14:"ACTION",17:"LEFT",18:"RIGHT",19:"NONASSOC",23:":",25:";",26:"|",31:"PREC",32:"STRING",33:"ID",34:"{",36:"}",37:"ARROW_ACTION",38:"ACTION_BODY"},
productions_: [0,[3,4],[3,5],[3,6],[4,2],[4,0],[9,2],[9,1],[9,1],[9,1],[13,2],[15,1],[15,1],[15,1],[16,2],[16,1],[6,1],[21,2],[21,1],[22,4],[24,3],[24,1],[27,3],[28,2],[28,0],[29,2],[29,0],[20,1],[20,1],[11,1],[30,3],[30,1],[30,1],[30,0],[35,0],[35,1],[35,5]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = $$[$0-3]; this.$.bnf = $$[$0-1]; return this.$;
break;
case 2:this.$ = $$[$0-4]; this.$.bnf = $$[$0-2]; return this.$;
break;
case 3:this.$ = $$[$0-5]; this.$.bnf = $$[$0-3]; yy.addDeclaration(this.$,{include:$$[$0-1]}); return this.$;
break;
case 4:this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);
break;
case 5:this.$ = {};
break;
case 6:this.$ = {start: $$[$0]};
break;
case 7:this.$ = {lex: $$[$0]};
break;
case 8:this.$ = {operator: $$[$0]};
break;
case 9:this.$ = {include: $$[$0]};
break;
case 10:this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);
break;
case 11:this.$ = 'left';
break;
case 12:this.$ = 'right';
break;
case 13:this.$ = 'nonassoc';
break;
case 14:this.$ = $$[$0-1]; this.$.push($$[$0]);
break;
case 15:this.$ = [$$[$0]];
break;
case 16:this.$ = $$[$0];
break;
case 17:this.$ = $$[$0-1];
          if($$[$0][0] in this.$) this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
          else  this.$[$$[$0][0]] = $$[$0][1];
break;
case 18:this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];
break;
case 19:this.$ = [$$[$0-3], $$[$0-1]];
break;
case 20:this.$ = $$[$0-2]; this.$.push($$[$0]);
break;
case 21:this.$ = [$$[$0]];
break;
case 22:this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if($$[$0]) this.$.push($$[$0]);
            if($$[$0-1]) this.$.push($$[$0-1]);
            if (this.$.length === 1) this.$ = this.$[0];
        
break;
case 23:this.$ = $$[$0-1]; this.$.push($$[$0])
break;
case 24:this.$ = [];
break;
case 25:this.$ = {prec: $$[$0]};
break;
case 26:this.$ = null;
break;
case 27:this.$ = $$[$0];
break;
case 28:this.$ = yytext;
break;
case 29:this.$ = yytext;
break;
case 30:this.$ = $$[$0-1];
break;
case 31:this.$ = $$[$0];
break;
case 32:this.$ = '$$ ='+$$[$0]+';';
break;
case 33:this.$ = '';
break;
case 34:this.$ = '';
break;
case 35:this.$ = yytext;
break;
case 36:this.$ = $$[$0-4]+$$[$0-3]+$$[$0-2]+$$[$0-1]+$$[$0];
break;
}
},
table: [{3:1,4:2,5:[2,5],10:[2,5],12:[2,5],14:[2,5],17:[2,5],18:[2,5],19:[2,5]},{1:[3]},{5:[1,3],9:4,10:[1,5],12:[1,6],13:7,14:[1,8],15:9,17:[1,10],18:[1,11],19:[1,12]},{6:13,11:16,21:14,22:15,33:[1,17]},{5:[2,4],10:[2,4],12:[2,4],14:[2,4],17:[2,4],18:[2,4],19:[2,4]},{11:18,33:[1,17]},{5:[2,7],10:[2,7],12:[2,7],14:[2,7],17:[2,7],18:[2,7],19:[2,7]},{5:[2,8],10:[2,8],12:[2,8],14:[2,8],17:[2,8],18:[2,8],19:[2,8]},{5:[2,9],10:[2,9],12:[2,9],14:[2,9],17:[2,9],18:[2,9],19:[2,9]},{11:21,16:19,20:20,32:[1,22],33:[1,17]},{32:[2,11],33:[2,11]},{32:[2,12],33:[2,12]},{32:[2,13],33:[2,13]},{5:[1,24],7:[1,23]},{5:[2,16],7:[2,16],11:16,22:25,33:[1,17]},{5:[2,18],7:[2,18],33:[2,18]},{23:[1,26]},{5:[2,29],10:[2,29],12:[2,29],14:[2,29],17:[2,29],18:[2,29],19:[2,29],23:[2,29],25:[2,29],26:[2,29],31:[2,29],32:[2,29],33:[2,29],34:[2,29],37:[2,29]},{5:[2,6],10:[2,6],12:[2,6],14:[2,6],17:[2,6],18:[2,6],19:[2,6]},{5:[2,10],10:[2,10],11:21,12:[2,10],14:[2,10],17:[2,10],18:[2,10],19:[2,10],20:27,32:[1,22],33:[1,17]},{5:[2,15],10:[2,15],12:[2,15],14:[2,15],17:[2,15],18:[2,15],19:[2,15],32:[2,15],33:[2,15]},{5:[2,27],10:[2,27],12:[2,27],14:[2,27],17:[2,27],18:[2,27],19:[2,27],25:[2,27],26:[2,27],31:[2,27],32:[2,27],33:[2,27],34:[2,27],37:[2,27]},{5:[2,28],10:[2,28],12:[2,28],14:[2,28],17:[2,28],18:[2,28],19:[2,28],25:[2,28],26:[2,28],31:[2,28],32:[2,28],33:[2,28],34:[2,28],37:[2,28]},{1:[2,1]},{7:[1,28],8:[1,29]},{5:[2,17],7:[2,17],33:[2,17]},{14:[2,24],24:30,25:[2,24],26:[2,24],27:31,28:32,31:[2,24],32:[2,24],33:[2,24],34:[2,24],37:[2,24]},{5:[2,14],10:[2,14],12:[2,14],14:[2,14],17:[2,14],18:[2,14],19:[2,14],32:[2,14],33:[2,14]},{1:[2,2]},{7:[1,33]},{25:[1,34],26:[1,35]},{25:[2,21],26:[2,21]},{11:21,14:[2,26],20:37,25:[2,26],26:[2,26],29:36,31:[1,38],32:[1,22],33:[1,17],34:[2,26],37:[2,26]},{1:[2,3]},{5:[2,19],7:[2,19],33:[2,19]},{14:[2,24],25:[2,24],26:[2,24],27:39,28:32,31:[2,24],32:[2,24],33:[2,24],34:[2,24],37:[2,24]},{14:[1,42],25:[2,33],26:[2,33],30:40,34:[1,41],37:[1,43]},{14:[2,23],25:[2,23],26:[2,23],31:[2,23],32:[2,23],33:[2,23],34:[2,23],37:[2,23]},{11:21,20:44,32:[1,22],33:[1,17]},{25:[2,20],26:[2,20]},{25:[2,22],26:[2,22]},{34:[2,34],35:45,36:[2,34],38:[1,46]},{25:[2,31],26:[2,31]},{25:[2,32],26:[2,32]},{14:[2,25],25:[2,25],26:[2,25],34:[2,25],37:[2,25]},{34:[1,48],36:[1,47]},{34:[2,35],36:[2,35]},{25:[2,30],26:[2,30]},{34:[2,34],35:49,36:[2,34],38:[1,46]},{34:[1,48],36:[1,50]},{34:[2,34],35:51,36:[2,34],38:[1,46]},{34:[1,48],36:[2,36]}],
defaultActions: {23:[2,1],28:[2,2],33:[2,3]},
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
var lexer = (function(){



var lexer = ({EOF:1,
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
case 0:this.begin('code');return 5;
break;
case 1:/* skip whitespace */
break;
case 2:/* skip comment */
break;
case 3:return yy.lexComment(this);
break;
case 4:return 33;
break;
case 5:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 32;
break;
case 6:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 32;
break;
case 7:return 23;
break;
case 8:return 25;
break;
case 9:return 26;
break;
case 10:this.begin('grammar');return 5;
break;
case 11:return 31;
break;
case 12:return 10;
break;
case 13:return 17;
break;
case 14:return 18;
break;
case 15:return 19;
break;
case 16:return 12;
break;
case 17:/* ignore unrecognized decl */
break;
case 18:/* ignore type */
break;
case 19:yy_.yytext = yy_.yytext.substr(2, yy_.yyleng-4); return 14;
break;
case 20:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 14;
break;
case 21:yy.depth=0; this.begin('action'); return 34;
break;
case 22:yy_.yytext = yy_.yytext.substr(2, yy_.yyleng-2); return 37;
break;
case 23:/* ignore bad characters */
break;
case 24:return 7;
break;
case 25:return 38;
break;
case 26:yy.depth++; return 34;
break;
case 27:yy.depth==0? this.begin('grammar') : yy.depth--; return 36;
break;
case 28:return 8;
break;
}
};
lexer.rules = [/^%%/,/^\s+/,/^\/\/.*/,/^\/\*[^*]*\*/,/^[a-zA-Z][a-zA-Z0-9_-]*/,/^"[^"]+"/,/^'[^']+'/,/^:/,/^;/,/^\|/,/^%%/,/^%prec\b/,/^%start\b/,/^%left\b/,/^%right\b/,/^%nonassoc\b/,/^%lex[\w\W]*?\/lex\b/,/^%[a-zA-Z]+[^\n]*/,/^<[a-zA-Z]*>/,/^\{\{[\w\W]*?\}\}/,/^%\{(.|\n)*?%\}/,/^\{/,/^->.*/,/^./,/^$/,/^[^{}]+/,/^\{/,/^\}/,/^(.|\n)+/];
lexer.conditions = {"grammar":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],"inclusive":true},"action":{"rules":[24,25,26,27],"inclusive":false},"code":{"rules":[24,28],"inclusive":false},"INITIAL":{"rules":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = bnf;
exports.parse = function () { return bnf.parse.apply(bnf, arguments); }
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