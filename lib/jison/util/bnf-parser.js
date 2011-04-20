/* Jison generated parser */
var bnf = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"spec":3,"declaration_list":4,"%%":5,"grammar":6,"EOF":7,"declaration":8,"START":9,"id":10,"LEX_BLOCK":11,"operator":12,"associativity":13,"token_list":14,"LEFT":15,"RIGHT":16,"NONASSOC":17,"symbol":18,"production_list":19,"production":20,":":21,"handle_list":22,";":23,"|":24,"handle_action":25,"handle":26,"prec":27,"action":28,"PREC":29,"STRING":30,"ID":31,"ACTION":32,"$accept":0,"$end":1},
terminals_: {2:"error",5:"%%",7:"EOF",9:"START",11:"LEX_BLOCK",15:"LEFT",16:"RIGHT",17:"NONASSOC",21:":",23:";",24:"|",29:"PREC",30:"STRING",31:"ID",32:"ACTION"},
productions_: [0,[3,4],[3,5],[4,2],[4,0],[8,2],[8,1],[8,1],[12,2],[13,1],[13,1],[13,1],[14,2],[14,1],[6,1],[19,2],[19,1],[20,4],[22,3],[22,1],[25,3],[26,2],[26,0],[27,2],[27,0],[18,1],[18,1],[10,1],[28,1],[28,0]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = $$[$0-3]; this.$.bnf = $$[$0-1]; return this.$;
break;
case 2:this.$ = $$[$0-4]; this.$.bnf = $$[$0-2]; return this.$;
break;
case 3:this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);
break;
case 4:this.$ = {};
break;
case 5:this.$ = {start: $$[$0]};
break;
case 6:this.$ = {lex: $$[$0]};
break;
case 7:this.$ = {operator: $$[$0]};
break;
case 8:this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);
break;
case 9:this.$ = 'left';
break;
case 10:this.$ = 'right';
break;
case 11:this.$ = 'nonassoc';
break;
case 12:this.$ = $$[$0-1]; this.$.push($$[$0]);
break;
case 13:this.$ = [$$[$0]];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = $$[$0-1];
          if($$[$0][0] in this.$) this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
          else  this.$[$$[$0][0]] = $$[$0][1];
break;
case 16:this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];
break;
case 17:this.$ = [$$[$0-3], $$[$0-1]];
break;
case 18:this.$ = $$[$0-2]; this.$.push($$[$0]);
break;
case 19:this.$ = [$$[$0]];
break;
case 20:this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if($$[$0]) this.$.push($$[$0]);
            if($$[$0-1]) this.$.push($$[$0-1]);
            if (this.$.length === 1) this.$ = this.$[0];
        
break;
case 21:this.$ = $$[$0-1]; this.$.push($$[$0])
break;
case 22:this.$ = [];
break;
case 23:this.$ = {prec: $$[$0]};
break;
case 24:this.$ = null;
break;
case 25:this.$ = $$[$0];
break;
case 26:this.$ = yytext;
break;
case 27:this.$ = yytext;
break;
case 28:this.$ = yytext;
break;
case 29:this.$ = '';
break;
}
},
table: [{3:1,4:2,5:[2,4],9:[2,4],11:[2,4],15:[2,4],16:[2,4],17:[2,4]},{1:[3]},{5:[1,3],8:4,9:[1,5],11:[1,6],12:7,13:8,15:[1,9],16:[1,10],17:[1,11]},{6:12,10:15,19:13,20:14,31:[1,16]},{5:[2,3],9:[2,3],11:[2,3],15:[2,3],16:[2,3],17:[2,3]},{10:17,31:[1,16]},{5:[2,6],9:[2,6],11:[2,6],15:[2,6],16:[2,6],17:[2,6]},{5:[2,7],9:[2,7],11:[2,7],15:[2,7],16:[2,7],17:[2,7]},{10:20,14:18,18:19,30:[1,21],31:[1,16]},{30:[2,9],31:[2,9]},{30:[2,10],31:[2,10]},{30:[2,11],31:[2,11]},{5:[1,23],7:[1,22]},{5:[2,14],7:[2,14],10:15,20:24,31:[1,16]},{5:[2,16],7:[2,16],31:[2,16]},{21:[1,25]},{5:[2,27],9:[2,27],11:[2,27],15:[2,27],16:[2,27],17:[2,27],21:[2,27],23:[2,27],24:[2,27],29:[2,27],30:[2,27],31:[2,27],32:[2,27]},{5:[2,5],9:[2,5],11:[2,5],15:[2,5],16:[2,5],17:[2,5]},{5:[2,8],9:[2,8],10:20,11:[2,8],15:[2,8],16:[2,8],17:[2,8],18:26,30:[1,21],31:[1,16]},{5:[2,13],9:[2,13],11:[2,13],15:[2,13],16:[2,13],17:[2,13],30:[2,13],31:[2,13]},{5:[2,25],9:[2,25],11:[2,25],15:[2,25],16:[2,25],17:[2,25],23:[2,25],24:[2,25],29:[2,25],30:[2,25],31:[2,25],32:[2,25]},{5:[2,26],9:[2,26],11:[2,26],15:[2,26],16:[2,26],17:[2,26],23:[2,26],24:[2,26],29:[2,26],30:[2,26],31:[2,26],32:[2,26]},{1:[2,1]},{7:[1,27]},{5:[2,15],7:[2,15],31:[2,15]},{22:28,23:[2,22],24:[2,22],25:29,26:30,29:[2,22],30:[2,22],31:[2,22],32:[2,22]},{5:[2,12],9:[2,12],11:[2,12],15:[2,12],16:[2,12],17:[2,12],30:[2,12],31:[2,12]},{1:[2,2]},{23:[1,31],24:[1,32]},{23:[2,19],24:[2,19]},{10:20,18:34,23:[2,24],24:[2,24],27:33,29:[1,35],30:[1,21],31:[1,16],32:[2,24]},{5:[2,17],7:[2,17],31:[2,17]},{23:[2,22],24:[2,22],25:36,26:30,29:[2,22],30:[2,22],31:[2,22],32:[2,22]},{23:[2,29],24:[2,29],28:37,32:[1,38]},{23:[2,21],24:[2,21],29:[2,21],30:[2,21],31:[2,21],32:[2,21]},{10:20,18:39,30:[1,21],31:[1,16]},{23:[2,18],24:[2,18]},{23:[2,20],24:[2,20]},{23:[2,28],24:[2,28]},{23:[2,23],24:[2,23],32:[2,23]}],
defaultActions: {22:[2,1],27:[2,2]},
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
case 0:/* skip whitespace */
break;
case 1:/* skip comment */
break;
case 2:return yy.lexComment(this);
break;
case 3:return 31;
break;
case 4:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 30;
break;
case 5:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 30;
break;
case 6:return 21;
break;
case 7:return 23;
break;
case 8:return 24;
break;
case 9:return 5;
break;
case 10:return 29;
break;
case 11:return 9;
break;
case 12:return 15;
break;
case 13:return 16;
break;
case 14:return 17;
break;
case 15:return 11;
break;
case 16:/* ignore unrecognized decl */
break;
case 17: /* ignore type */
break;
case 18:yy_.yytext = yy_.yytext.substr(2, yy_.yyleng-4); return 32;
break;
case 19:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 32;
break;
case 20:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 32;
break;
case 21:/* ignore bad characters */
break;
case 22:return 7;
break;
}
};
lexer.rules = [/^\s+/,/^\/\/.*/,/^\/\*[^*]*\*/,/^[a-zA-Z][a-zA-Z0-9_-]*/,/^"[^"]+"/,/^'[^']+'/,/^:/,/^;/,/^\|/,/^%%/,/^%prec\b/,/^%start\b/,/^%left\b/,/^%right\b/,/^%nonassoc\b/,/^%lex[\w\W]*?\/lex\b/,/^%[a-zA-Z]+[^\n]*/,/^<[a-zA-Z]*>/,/^\{\{[\w\W]*?\}\}/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^./,/^$/];
lexer.conditions = {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],"inclusive":true}};return lexer;})()
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