/* Jison generated parser */
var calculator = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"expressions":3,"e":4,"EOF":5,"+":6,"-":7,"*":8,"/":9,"^":10,"(":11,")":12,"NUMBER":13,"E":14,"PI":15,"$accept":0,"$end":1},
terminals_: {"2":"error","5":"EOF","6":"+","7":"-","8":"*","9":"/","10":"^","11":"(","12":")","13":"NUMBER","14":"E","15":"PI"},
productions_: [0,[3,2],[4,3],[4,3],[4,3],[4,3],[4,3],[4,2],[4,3],[4,1],[4,1],[4,1]],
performAction: function anonymous(yytext, yyleng, yylineno, yy) { 
var $$ = arguments[5],$0=arguments[5].length;
switch(arguments[4]) {
case 1:return $$[$0-2+1-1];
break;
case 2:this.$ = $$[$0-3+1-1]+$$[$0-3+3-1];
break;
case 3:this.$ = $$[$0-3+1-1]-$$[$0-3+3-1];
break;
case 4:this.$ = $$[$0-3+1-1]*$$[$0-3+3-1];
break;
case 5:this.$ = $$[$0-3+1-1]/$$[$0-3+3-1];
break;
case 6:this.$ = Math.pow($$[$0-3+1-1], $$[$0-3+3-1]);
break;
case 7:this.$ = -$$[$0-2+2-1];
break;
case 8:this.$ = $$[$0-3+2-1];
break;
case 9:this.$ = Number(yytext);
break;
case 10:this.$ = Math.E;
break;
case 11:this.$ = Math.PI;
break;
}
},
table: [{"3":1,"4":2,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"1":[3]},{"5":[1,8],"6":[1,9],"7":[1,10],"8":[1,11],"9":[1,12],"10":[1,13]},{"4":14,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"4":15,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"5":[2,9],"6":[2,9],"7":[2,9],"8":[2,9],"9":[2,9],"10":[2,9],"12":[2,9]},{"5":[2,10],"6":[2,10],"7":[2,10],"8":[2,10],"9":[2,10],"10":[2,10],"12":[2,10]},{"5":[2,11],"6":[2,11],"7":[2,11],"8":[2,11],"9":[2,11],"10":[2,11],"12":[2,11]},{"1":[2,1]},{"4":16,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"4":17,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"4":18,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"4":19,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"4":20,"7":[1,3],"11":[1,4],"13":[1,5],"14":[1,6],"15":[1,7]},{"6":[2,7],"7":[2,7],"8":[2,7],"9":[2,7],"10":[2,7],"5":[2,7],"12":[2,7]},{"12":[1,21],"6":[1,9],"7":[1,10],"8":[1,11],"9":[1,12],"10":[1,13]},{"6":[2,2],"7":[2,2],"8":[1,11],"9":[1,12],"10":[1,13],"5":[2,2],"12":[2,2]},{"6":[2,3],"7":[2,3],"8":[1,11],"9":[1,12],"10":[1,13],"5":[2,3],"12":[2,3]},{"6":[2,4],"7":[2,4],"8":[2,4],"9":[2,4],"10":[1,13],"5":[2,4],"12":[2,4]},{"6":[2,5],"7":[2,5],"8":[2,5],"9":[2,5],"10":[1,13],"5":[2,5],"12":[2,5]},{"6":[2,6],"7":[2,6],"8":[2,6],"9":[2,6],"10":[2,6],"5":[2,6],"12":[2,6]},{"5":[2,8],"6":[2,8],"7":[2,8],"8":[2,8],"9":[2,8],"10":[2,8],"12":[2,8]}],
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

    function checkRecover (st) {
        for (var p in table[st]) if (p == TERROR) {
            //print('RECOVER!!');
            return true;
        }
        return false;
    }

    function lex() {
        var token;
        token = self.lexer.lex() || 1; // $end = 1
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token];
        }
        return token;
    };

    var symbol, preErrorSymbol, state, action, a, r, yyval={},p,len,newState, expected, recovered = false;
    symbol = lex(); 
    while (true) {
        // set first input
        state = stack[stack.length-1];
        // read action for current state and first input
        action = table[state] && table[state][symbol];

        // handle parse error
        if (typeof action === 'undefined' || !action.length || !action[0]) {

            if (!recovering) {
                // Report error
                expected = [];
                for (p in table[state]) if (this.terminals_[p] && p > 2) {
                    expected.push("'"+this.terminals_[p]+"'");
                }
                if (this.lexer.showPosition) {
                    parseError.call(this, 'Parse error on line '+(yylineno+1)+":\n"+this.lexer.showPosition()+'\nExpecting '+expected.join(', '),
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                } else {
                    parseError.call(this, 'Parse error on line '+(yylineno+1)+": Unexpected '"+this.terminals_[symbol]+"'",
                        {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, expected: expected});
                }
            }

            // just recovered from another error
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw 'Parsing halted.'
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
                if (checkRecover(state)) {
                    break;
                }
                if (state == 0) {
                    throw 'Parsing halted.'
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
                if (!preErrorSymbol) { // normal execution/no error
                    yyleng = this.lexer.yyleng;
                    yytext = this.lexer.yytext;
                    yylineno = this.lexer.yylineno;
                    symbol = lex(); 
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
case 0:/* skip whitespace */
break;
case 1:return 13;
break;
case 2:return 8;
break;
case 3:return 9;
break;
case 4:return 7;
break;
case 5:return 6;
break;
case 6:return 10;
break;
case 7:return 11;
break;
case 8:return 12;
break;
case 9:return 15;
break;
case 10:return 14;
break;
case 11:return 5;
break;
}
};
lexer.rules = [/^\s+/,/^[0-9]+(\.[0-9]+)?\b\b/,/^\*/,/^\//,/^-/,/^\+/,/^\^/,/^\(/,/^\)/,/^PI\b/,/^E\b/,/^$/];return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined') {
exports.parser = calculator;
exports.parse = function () { return calculator.parse.apply(calculator, arguments); }
exports.main = function commonjsMain(args) {
    var cwd = require("file").path(require("file").cwd());
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    var source = cwd.join(args[1]).read({charset: "utf-8"});
    exports.parser.parse(source);
}
if (require.main === module) {
	exports.main(require("system").args);
}
}
