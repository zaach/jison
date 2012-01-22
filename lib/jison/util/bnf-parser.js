/* Jison generated parser */
var bnf = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"spec":3,"declaration_list":4,"%%":5,"grammar":6,"optional_end_block":7,"EOF":8,"CODE":9,"declaration":10,"START":11,"id":12,"LEX_BLOCK":13,"operator":14,"ACTION":15,"associativity":16,"token_list":17,"LEFT":18,"RIGHT":19,"NONASSOC":20,"symbol":21,"production_list":22,"production":23,":":24,"handle_list":25,";":26,"|":27,"handle_action":28,"handle":29,"prec":30,"action":31,"expression_suffix":32,"handle_sublist":33,"expression":34,"suffix":35,"ID":36,"STRING":37,"(":38,")":39,"*":40,"?":41,"+":42,"PREC":43,"{":44,"action_body":45,"}":46,"ARROW_ACTION":47,"ACTION_BODY":48,"$accept":0,"$end":1},
terminals_: {2:"error",5:"%%",8:"EOF",9:"CODE",11:"START",13:"LEX_BLOCK",15:"ACTION",18:"LEFT",19:"RIGHT",20:"NONASSOC",24:":",26:";",27:"|",36:"ID",37:"STRING",38:"(",39:")",40:"*",41:"?",42:"+",43:"PREC",44:"{",46:"}",47:"ARROW_ACTION",48:"ACTION_BODY"},
productions_: [0,[3,5],[3,6],[7,0],[7,1],[4,2],[4,0],[10,2],[10,1],[10,1],[10,1],[14,2],[16,1],[16,1],[16,1],[17,2],[17,1],[6,1],[22,2],[22,1],[23,4],[25,3],[25,1],[28,3],[29,2],[29,0],[33,3],[33,1],[32,2],[34,1],[34,1],[34,3],[35,0],[35,1],[35,1],[35,1],[30,2],[30,0],[21,1],[21,1],[12,1],[31,3],[31,1],[31,1],[31,0],[45,0],[45,1],[45,5],[45,4]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1:this.$ = $$[$0-4]; this.$[ebnf ? 'ebnf':'bnf'] = $$[$0-2]; return this.$;
break;
case 2:this.$ = $$[$0-5]; this.$[ebnf ? 'ebnf':'bnf'] = $$[$0-3]; yy.addDeclaration(this.$,{include:$$[$0-1]}); return this.$;
break;
case 5:this.$ = $$[$0-1]; yy.addDeclaration(this.$, $$[$0]);
break;
case 6:this.$ = {};
break;
case 7:this.$ = {start: $$[$0]};
break;
case 8:this.$ = {lex: $$[$0]};
break;
case 9:this.$ = {operator: $$[$0]};
break;
case 10:this.$ = {include: $$[$0]};
break;
case 11:this.$ = [$$[$0-1]]; this.$.push.apply(this.$, $$[$0]);
break;
case 12:this.$ = 'left';
break;
case 13:this.$ = 'right';
break;
case 14:this.$ = 'nonassoc';
break;
case 15:this.$ = $$[$0-1]; this.$.push($$[$0]);
break;
case 16:this.$ = [$$[$0]];
break;
case 17:this.$ = $$[$0];
break;
case 18:this.$ = $$[$0-1];
          if($$[$0][0] in this.$) this.$[$$[$0][0]] = this.$[$$[$0][0]].concat($$[$0][1]);
          else  this.$[$$[$0][0]] = $$[$0][1];
break;
case 19:this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];
break;
case 20:this.$ = [$$[$0-3], $$[$0-1]];
break;
case 21:this.$ = $$[$0-2]; this.$.push($$[$0]);
break;
case 22:this.$ = [$$[$0]];
break;
case 23:this.$ = [($$[$0-2].length ? $$[$0-2].join(' ') : '')];
            if($$[$0]) this.$.push($$[$0]);
            if($$[$0-1]) this.$.push($$[$0-1]);
            if (this.$.length === 1) this.$ = this.$[0];
        
break;
case 24:this.$ = $$[$0-1]; this.$.push($$[$0])
break;
case 25:this.$ = [];
break;
case 26:this.$ = $$[$0-2]; this.$.push($$[$0].join(' '));
break;
case 27:this.$ = [$$[$0].join(' ')];
break;
case 28:this.$ = $$[$0-1] + $$[$0]; 
break;
case 29:this.$ = $$[$0]; 
break;
case 30:this.$ = ebnf ? "'"+$$[$0]+"'" : $$[$0]; 
break;
case 31:this.$ = '(' + $$[$0-1].join(' | ') + ')'; 
break;
case 32:this.$ = ''
break;
case 36:this.$ = {prec: $$[$0]};
break;
case 37:this.$ = null;
break;
case 38:this.$ = $$[$0];
break;
case 39:this.$ = yytext;
break;
case 40:this.$ = yytext;
break;
case 41:this.$ = $$[$0-1];
break;
case 42:this.$ = $$[$0];
break;
case 43:this.$ = '$$ ='+$$[$0]+';';
break;
case 44:this.$ = '';
break;
case 45:this.$ = '';
break;
case 46:this.$ = yytext;
break;
case 47:this.$ = $$[$0-4]+$$[$0-3]+$$[$0-2]+$$[$0-1]+$$[$0];
break;
case 48:this.$ = $$[$0-3]+$$[$0-2]+$$[$0-1]+$$[$0];
break;
}
},
table: [{3:1,4:2,5:[2,6],11:[2,6],13:[2,6],15:[2,6],18:[2,6],19:[2,6],20:[2,6]},{1:[3]},{5:[1,3],10:4,11:[1,5],13:[1,6],14:7,15:[1,8],16:9,18:[1,10],19:[1,11],20:[1,12]},{6:13,12:16,22:14,23:15,36:[1,17]},{5:[2,5],11:[2,5],13:[2,5],15:[2,5],18:[2,5],19:[2,5],20:[2,5]},{12:18,36:[1,17]},{5:[2,8],11:[2,8],13:[2,8],15:[2,8],18:[2,8],19:[2,8],20:[2,8]},{5:[2,9],11:[2,9],13:[2,9],15:[2,9],18:[2,9],19:[2,9],20:[2,9]},{5:[2,10],11:[2,10],13:[2,10],15:[2,10],18:[2,10],19:[2,10],20:[2,10]},{12:21,17:19,21:20,36:[1,17],37:[1,22]},{36:[2,12],37:[2,12]},{36:[2,13],37:[2,13]},{36:[2,14],37:[2,14]},{5:[1,24],7:23,8:[2,3]},{5:[2,17],8:[2,17],12:16,23:25,36:[1,17]},{5:[2,19],8:[2,19],36:[2,19]},{24:[1,26]},{5:[2,40],11:[2,40],13:[2,40],15:[2,40],18:[2,40],19:[2,40],20:[2,40],24:[2,40],26:[2,40],27:[2,40],36:[2,40],37:[2,40],44:[2,40],47:[2,40]},{5:[2,7],11:[2,7],13:[2,7],15:[2,7],18:[2,7],19:[2,7],20:[2,7]},{5:[2,11],11:[2,11],12:21,13:[2,11],15:[2,11],18:[2,11],19:[2,11],20:[2,11],21:27,36:[1,17],37:[1,22]},{5:[2,16],11:[2,16],13:[2,16],15:[2,16],18:[2,16],19:[2,16],20:[2,16],36:[2,16],37:[2,16]},{5:[2,38],11:[2,38],13:[2,38],15:[2,38],18:[2,38],19:[2,38],20:[2,38],26:[2,38],27:[2,38],36:[2,38],37:[2,38],44:[2,38],47:[2,38]},{5:[2,39],11:[2,39],13:[2,39],15:[2,39],18:[2,39],19:[2,39],20:[2,39],26:[2,39],27:[2,39],36:[2,39],37:[2,39],44:[2,39],47:[2,39]},{8:[1,28]},{8:[2,4],9:[1,29]},{5:[2,18],8:[2,18],36:[2,18]},{15:[2,25],25:30,26:[2,25],27:[2,25],28:31,29:32,36:[2,25],37:[2,25],38:[2,25],43:[2,25],44:[2,25],47:[2,25]},{5:[2,15],11:[2,15],13:[2,15],15:[2,15],18:[2,15],19:[2,15],20:[2,15],36:[2,15],37:[2,15]},{1:[2,1]},{8:[1,33]},{26:[1,34],27:[1,35]},{26:[2,22],27:[2,22]},{15:[2,37],26:[2,37],27:[2,37],30:36,32:37,34:39,36:[1,40],37:[1,41],38:[1,42],43:[1,38],44:[2,37],47:[2,37]},{1:[2,2]},{5:[2,20],8:[2,20],36:[2,20]},{15:[2,25],26:[2,25],27:[2,25],28:43,29:32,36:[2,25],37:[2,25],38:[2,25],43:[2,25],44:[2,25],47:[2,25]},{15:[1,46],26:[2,44],27:[2,44],31:44,44:[1,45],47:[1,47]},{15:[2,24],26:[2,24],27:[2,24],36:[2,24],37:[2,24],38:[2,24],39:[2,24],43:[2,24],44:[2,24],47:[2,24]},{12:21,21:48,36:[1,17],37:[1,22]},{15:[2,32],26:[2,32],27:[2,32],35:49,36:[2,32],37:[2,32],38:[2,32],39:[2,32],40:[1,50],41:[1,51],42:[1,52],43:[2,32],44:[2,32],47:[2,32]},{15:[2,29],26:[2,29],27:[2,29],36:[2,29],37:[2,29],38:[2,29],39:[2,29],40:[2,29],41:[2,29],42:[2,29],43:[2,29],44:[2,29],47:[2,29]},{15:[2,30],26:[2,30],27:[2,30],36:[2,30],37:[2,30],38:[2,30],39:[2,30],40:[2,30],41:[2,30],42:[2,30],43:[2,30],44:[2,30],47:[2,30]},{27:[2,25],29:54,33:53,36:[2,25],37:[2,25],38:[2,25],39:[2,25]},{26:[2,21],27:[2,21]},{26:[2,23],27:[2,23]},{44:[2,45],45:55,46:[2,45],48:[1,56]},{26:[2,42],27:[2,42]},{26:[2,43],27:[2,43]},{15:[2,36],26:[2,36],27:[2,36],44:[2,36],47:[2,36]},{15:[2,28],26:[2,28],27:[2,28],36:[2,28],37:[2,28],38:[2,28],39:[2,28],43:[2,28],44:[2,28],47:[2,28]},{15:[2,33],26:[2,33],27:[2,33],36:[2,33],37:[2,33],38:[2,33],39:[2,33],43:[2,33],44:[2,33],47:[2,33]},{15:[2,34],26:[2,34],27:[2,34],36:[2,34],37:[2,34],38:[2,34],39:[2,34],43:[2,34],44:[2,34],47:[2,34]},{15:[2,35],26:[2,35],27:[2,35],36:[2,35],37:[2,35],38:[2,35],39:[2,35],43:[2,35],44:[2,35],47:[2,35]},{27:[1,58],39:[1,57]},{27:[2,27],32:37,34:39,36:[1,40],37:[1,41],38:[1,42],39:[2,27]},{44:[1,60],46:[1,59]},{44:[2,46],46:[2,46]},{15:[2,31],26:[2,31],27:[2,31],36:[2,31],37:[2,31],38:[2,31],39:[2,31],40:[2,31],41:[2,31],42:[2,31],43:[2,31],44:[2,31],47:[2,31]},{27:[2,25],29:61,36:[2,25],37:[2,25],38:[2,25],39:[2,25]},{26:[2,41],27:[2,41]},{44:[2,45],45:62,46:[2,45],48:[1,56]},{27:[2,26],32:37,34:39,36:[1,40],37:[1,41],38:[1,42],39:[2,26]},{44:[1,60],46:[1,63]},{44:[2,48],46:[2,48],48:[1,64]},{44:[2,47],46:[2,47]}],
defaultActions: {28:[2,1],33:[2,2]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol == null)
                symbol = lex();
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                var errStr = "";
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + this.terminals_[symbol] + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};

var ebnf = false;


/* Jison generated lexer */
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
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/\n.*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
            this.yytext += match[0];
            this.match += match[0];
            this.yyleng = this.yytext.length;
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (token) return token;
            else return;
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
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {

var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:this.begin('code');return 5;
break;
case 1:return 38
break;
case 2:return 39
break;
case 3:return 40
break;
case 4:return 41
break;
case 5:return 42
break;
case 6:/* skip whitespace */
break;
case 7:/* skip comment */
break;
case 8:return yy.lexComment(this);
break;
case 9:return 36;
break;
case 10:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 37;
break;
case 11:yy_.yytext = yy_.yytext.substr(1, yy_.yyleng-2); return 37;
break;
case 12:return 24;
break;
case 13:return 26;
break;
case 14:return 27;
break;
case 15:this.begin(ebnf ? 'ebnf' : 'bnf');return 5;
break;
case 16:if (!yy.options) yy.options = {}; ebnf = yy.options.ebnf = true;
break;
case 17:return 43;
break;
case 18:return 11;
break;
case 19:return 18;
break;
case 20:return 19;
break;
case 21:return 20;
break;
case 22:return 13;
break;
case 23:/* ignore unrecognized decl */
break;
case 24:/* ignore type */
break;
case 25:yy_.yytext = yy_.yytext.substr(2, yy_.yyleng-4); return 15;
break;
case 26:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 15;
break;
case 27:yy.depth=0; this.begin('action'); return 44;
break;
case 28:yy_.yytext = yy_.yytext.substr(2, yy_.yyleng-2); return 47;
break;
case 29:/* ignore bad characters */
break;
case 30:return 8;
break;
case 31:return 48;
break;
case 32:yy.depth++; return 44;
break;
case 33:yy.depth==0? this.begin(ebnf ? 'ebnf' : 'bnf') : yy.depth--; return 46;
break;
case 34:return 9;
break;
}
};
lexer.rules = [/^%%/,/^\(/,/^\)/,/^\*/,/^\?/,/^\+/,/^\s+/,/^\/\/.*/,/^\/\*[^*]*\*/,/^[a-zA-Z][a-zA-Z0-9_-]*/,/^"[^"]+"/,/^'[^']+'/,/^:/,/^;/,/^\|/,/^%%/,/^%ebnf\b/,/^%prec\b/,/^%start\b/,/^%left\b/,/^%right\b/,/^%nonassoc\b/,/^%lex[\w\W]*?\/lex\b/,/^%[a-zA-Z]+[^\n]*/,/^<[a-zA-Z]*>/,/^\{\{[\w\W]*?\}\}/,/^%\{(.|\n)*?%\}/,/^\{/,/^->.*/,/^./,/^$/,/^[^{}]+/,/^\{/,/^\}/,/^(.|\n)+/];
lexer.conditions = {"bnf":{"rules":[0,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],"inclusive":true},"ebnf":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],"inclusive":true},"action":{"rules":[30,31,32,33],"inclusive":false},"code":{"rules":[30,34],"inclusive":false},"INITIAL":{"rules":[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],"inclusive":true}};

;
return lexer;})()
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