/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: 
function trace() {
}
,
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"include":5,"%%":6,"rules":7,"epilogue":8,"EOF":9,"action":10,"definition":11,"name":12,"regex":13,"START_INC":14,"names_inclusive":15,"START_EXC":16,"names_exclusive":17,"NAME":18,"rule":19,"start_conditions":20,"<":21,"name_list":22,">":23,",":24,"ACTION":25,"regex_list":26,"|":27,"regex_concat":28,"regex_base":29,"(":30,")":31,"+":32,"*":33,"?":34,"/":35,"/!":36,"name_expansion":37,"range_regex":38,"any_group_regex":39,".":40,"^":41,"$":42,"string":43,"escape_char":44,"{":45,"}":46,"ANY_GROUP_REGEX":47,"ESCAPE_CHAR":48,"RANGE_REGEX":49,"STRING_LIT":50,"$accept":0,"$end":1},
terminals_: {2:"error",6:"%%",9:"EOF",14:"START_INC",16:"START_EXC",18:"NAME",21:"<",23:">",24:",",25:"ACTION",27:"|",30:"(",31:")",32:"+",33:"*",34:"?",35:"/",36:"/!",40:".",41:"^",42:"$",45:"{",46:"}",47:"ANY_GROUP_REGEX",48:"ESCAPE_CHAR",49:"RANGE_REGEX",50:"STRING_LIT"},
productions_: [0,[3,5],[8,1],[8,2],[5,1],[5,0],[4,2],[4,0],[11,2],[11,2],[11,2],[15,1],[15,2],[17,1],[17,2],[12,1],[7,2],[7,1],[19,3],[20,3],[20,0],[22,1],[22,3],[10,1],[13,1],[26,3],[26,1],[28,2],[28,1],[29,3],[29,2],[29,2],[29,2],[29,2],[29,2],[29,1],[29,2],[29,1],[29,1],[29,1],[29,1],[29,1],[29,1],[37,3],[39,1],[44,1],[38,1],[43,1]],
performAction: 
function anonymous(yytext, yyleng, yylineno, yy, yystate, $$) {
    var $0 = $$.length - 1;
    switch (yystate) {
      case 1:
        this.$ = {rules:$$[$0 - 1]};
        if ($$[$0 - 4][0]) {
            this.$.macros = $$[$0 - 4][0];
        }
        if ($$[$0 - 4][1]) {
            this.$.startConditions = $$[$0 - 4][1];
        }
        if ($$[$0 - 3]) {
            this.$.actionInclude = $$[$0 - 3];
        }
        return this.$;
        break;
      case 6:
        this.$ = $$[$0 - 1];
        if ("length" in $$[$0]) {
            this.$[0] = this.$[0] || {};
            this.$[0][$$[$0][0]] = $$[$0][1];
        } else {
            this.$[1] = this.$[1] || {};
            for (var name in $$[$0]) {
                this.$[1][name] = $$[$0][name];
            }
        }
        break;
      case 7:
        this.$ = [null, null];
        break;
      case 8:
        this.$ = [$$[$0 - 1], $$[$0]];
        break;
      case 9:
        this.$ = $$[$0];
        break;
      case 10:
        this.$ = $$[$0];
        break;
      case 11:
        this.$ = {};
        this.$[$$[$0]] = 0;
        break;
      case 12:
        this.$ = $$[$0 - 1];
        this.$[$$[$0]] = 0;
        break;
      case 13:
        this.$ = {};
        this.$[$$[$0]] = 1;
        break;
      case 14:
        this.$ = $$[$0 - 1];
        this.$[$$[$0]] = 1;
        break;
      case 15:
        this.$ = yytext;
        break;
      case 16:
        this.$ = $$[$0 - 1];
        this.$.push($$[$0]);
        break;
      case 17:
        this.$ = [$$[$0]];
        break;
      case 18:
        this.$ = $$[$0 - 2] ? [$$[$0 - 2], $$[$0 - 1], $$[$0]] : [$$[$0 - 1], $$[$0]];
        break;
      case 19:
        this.$ = $$[$0 - 1];
        break;
      case 21:
        this.$ = [$$[$0]];
        break;
      case 22:
        this.$ = $$[$0 - 2];
        this.$.push($$[$0]);
        break;
      case 23:
        this.$ = yytext;
        break;
      case 24:
        this.$ = $$[$0];
        if (this.$.match(/[\w\d]$/)) {
            this.$ += "\\b";
        }
        break;
      case 25:
        this.$ = $$[$0 - 2] + "|" + $$[$0];
        break;
      case 27:
        this.$ = $$[$0 - 1] + $$[$0];
        break;
      case 29:
        this.$ = "(" + $$[$0 - 1] + ")";
        break;
      case 30:
        this.$ = $$[$0 - 1] + "+";
        break;
      case 31:
        this.$ = $$[$0 - 1] + "*";
        break;
      case 32:
        this.$ = $$[$0 - 1] + "?";
        break;
      case 33:
        this.$ = "(?=" + $$[$0] + ")";
        break;
      case 34:
        this.$ = "(?!" + $$[$0] + ")";
        break;
      case 36:
        this.$ = $$[$0 - 1] + $$[$0];
        break;
      case 38:
        this.$ = ".";
        break;
      case 39:
        this.$ = "^";
        break;
      case 40:
        this.$ = "$";
        break;
      case 43:
        this.$ = "{" + $$[$0 - 1] + "}";
        break;
      case 44:
        this.$ = yytext;
        break;
      case 45:
        this.$ = yytext;
        break;
      case 46:
        this.$ = yytext;
        break;
      case 47:
        this.$ = yy.prepareString(yytext.substr(1, yytext.length - 2));
        break;
    }
}
,
table: [{3:1,4:2,6:[2,7],25:[2,7],18:[2,7],14:[2,7],16:[2,7]},{1:[3]},{5:3,11:4,10:5,12:6,14:[1,7],16:[1,8],25:[1,9],18:[1,10],6:[2,5]},{6:[1,11]},{6:[2,6],25:[2,6],18:[2,6],14:[2,6],16:[2,6]},{6:[2,4]},{13:12,26:13,28:14,29:15,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29]},{15:30,18:[1,31]},{17:32,18:[1,33]},{6:[2,23],9:[2,23],30:[2,23],35:[2,23],36:[2,23],40:[2,23],41:[2,23],42:[2,23],45:[2,23],47:[2,23],50:[2,23],48:[2,23],21:[2,23]},{30:[2,15],35:[2,15],36:[2,15],40:[2,15],41:[2,15],42:[2,15],45:[2,15],47:[2,15],50:[2,15],48:[2,15],46:[2,15]},{7:34,19:35,20:36,21:[1,37],30:[2,20],35:[2,20],36:[2,20],40:[2,20],41:[2,20],42:[2,20],45:[2,20],47:[2,20],50:[2,20],48:[2,20]},{16:[2,8],14:[2,8],18:[2,8],25:[2,8],6:[2,8]},{27:[1,38],6:[2,24],25:[2,24],18:[2,24],14:[2,24],16:[2,24]},{29:39,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29],16:[2,26],14:[2,26],18:[2,26],25:[2,26],6:[2,26],27:[2,26],31:[2,26]},{32:[1,40],33:[1,41],34:[1,42],38:43,49:[1,44],27:[2,28],6:[2,28],25:[2,28],18:[2,28],14:[2,28],16:[2,28],30:[2,28],35:[2,28],36:[2,28],40:[2,28],41:[2,28],42:[2,28],45:[2,28],47:[2,28],50:[2,28],48:[2,28],31:[2,28]},{26:45,28:14,29:15,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29]},{29:46,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29]},{29:47,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29]},{48:[2,35],50:[2,35],47:[2,35],45:[2,35],42:[2,35],41:[2,35],40:[2,35],36:[2,35],35:[2,35],30:[2,35],16:[2,35],14:[2,35],18:[2,35],25:[2,35],6:[2,35],27:[2,35],32:[2,35],33:[2,35],34:[2,35],49:[2,35],31:[2,35]},{48:[2,37],50:[2,37],47:[2,37],45:[2,37],42:[2,37],41:[2,37],40:[2,37],36:[2,37],35:[2,37],30:[2,37],16:[2,37],14:[2,37],18:[2,37],25:[2,37],6:[2,37],27:[2,37],32:[2,37],33:[2,37],34:[2,37],49:[2,37],31:[2,37]},{48:[2,38],50:[2,38],47:[2,38],45:[2,38],42:[2,38],41:[2,38],40:[2,38],36:[2,38],35:[2,38],30:[2,38],16:[2,38],14:[2,38],18:[2,38],25:[2,38],6:[2,38],27:[2,38],32:[2,38],33:[2,38],34:[2,38],49:[2,38],31:[2,38]},{48:[2,39],50:[2,39],47:[2,39],45:[2,39],42:[2,39],41:[2,39],40:[2,39],36:[2,39],35:[2,39],30:[2,39],16:[2,39],14:[2,39],18:[2,39],25:[2,39],6:[2,39],27:[2,39],32:[2,39],33:[2,39],34:[2,39],49:[2,39],31:[2,39]},{48:[2,40],50:[2,40],47:[2,40],45:[2,40],42:[2,40],41:[2,40],40:[2,40],36:[2,40],35:[2,40],30:[2,40],16:[2,40],14:[2,40],18:[2,40],25:[2,40],6:[2,40],27:[2,40],32:[2,40],33:[2,40],34:[2,40],49:[2,40],31:[2,40]},{48:[2,41],50:[2,41],47:[2,41],45:[2,41],42:[2,41],41:[2,41],40:[2,41],36:[2,41],35:[2,41],30:[2,41],16:[2,41],14:[2,41],18:[2,41],25:[2,41],6:[2,41],27:[2,41],32:[2,41],33:[2,41],34:[2,41],49:[2,41],31:[2,41]},{48:[2,42],50:[2,42],47:[2,42],45:[2,42],42:[2,42],41:[2,42],40:[2,42],36:[2,42],35:[2,42],30:[2,42],16:[2,42],14:[2,42],18:[2,42],25:[2,42],6:[2,42],27:[2,42],32:[2,42],33:[2,42],34:[2,42],49:[2,42],31:[2,42]},{12:48,18:[1,10]},{49:[2,44],34:[2,44],33:[2,44],32:[2,44],27:[2,44],6:[2,44],25:[2,44],18:[2,44],14:[2,44],16:[2,44],30:[2,44],35:[2,44],36:[2,44],40:[2,44],41:[2,44],42:[2,44],45:[2,44],47:[2,44],50:[2,44],48:[2,44],31:[2,44]},{49:[2,47],34:[2,47],33:[2,47],32:[2,47],27:[2,47],6:[2,47],25:[2,47],18:[2,47],14:[2,47],16:[2,47],30:[2,47],35:[2,47],36:[2,47],40:[2,47],41:[2,47],42:[2,47],45:[2,47],47:[2,47],50:[2,47],48:[2,47],31:[2,47]},{49:[2,45],34:[2,45],33:[2,45],32:[2,45],27:[2,45],6:[2,45],25:[2,45],18:[2,45],14:[2,45],16:[2,45],30:[2,45],35:[2,45],36:[2,45],40:[2,45],41:[2,45],42:[2,45],45:[2,45],47:[2,45],50:[2,45],48:[2,45],31:[2,45]},{18:[1,49],16:[2,9],14:[2,9],25:[2,9],6:[2,9]},{6:[2,11],25:[2,11],18:[2,11],14:[2,11],16:[2,11]},{18:[1,50],16:[2,10],14:[2,10],25:[2,10],6:[2,10]},{6:[2,13],25:[2,13],18:[2,13],14:[2,13],16:[2,13]},{8:51,19:52,9:[1,53],6:[1,54],20:36,21:[1,37],30:[2,20],35:[2,20],36:[2,20],40:[2,20],41:[2,20],42:[2,20],45:[2,20],47:[2,20],50:[2,20],48:[2,20]},{9:[2,17],6:[2,17],30:[2,17],35:[2,17],36:[2,17],40:[2,17],41:[2,17],42:[2,17],45:[2,17],47:[2,17],50:[2,17],48:[2,17],21:[2,17]},{13:55,26:13,28:14,29:15,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29]},{22:56,18:[1,57]},{26:58,28:14,29:15,30:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],47:[1,27],50:[1,28],48:[1,29]},{32:[1,40],33:[1,41],34:[1,42],38:43,49:[1,44],27:[2,27],6:[2,27],25:[2,27],18:[2,27],14:[2,27],16:[2,27],30:[2,27],35:[2,27],36:[2,27],40:[2,27],41:[2,27],42:[2,27],45:[2,27],47:[2,27],50:[2,27],48:[2,27],31:[2,27]},{48:[2,30],50:[2,30],47:[2,30],45:[2,30],42:[2,30],41:[2,30],40:[2,30],36:[2,30],35:[2,30],30:[2,30],16:[2,30],14:[2,30],18:[2,30],25:[2,30],6:[2,30],27:[2,30],32:[2,30],33:[2,30],34:[2,30],49:[2,30],31:[2,30]},{48:[2,31],50:[2,31],47:[2,31],45:[2,31],42:[2,31],41:[2,31],40:[2,31],36:[2,31],35:[2,31],30:[2,31],16:[2,31],14:[2,31],18:[2,31],25:[2,31],6:[2,31],27:[2,31],32:[2,31],33:[2,31],34:[2,31],49:[2,31],31:[2,31]},{48:[2,32],50:[2,32],47:[2,32],45:[2,32],42:[2,32],41:[2,32],40:[2,32],36:[2,32],35:[2,32],30:[2,32],16:[2,32],14:[2,32],18:[2,32],25:[2,32],6:[2,32],27:[2,32],32:[2,32],33:[2,32],34:[2,32],49:[2,32],31:[2,32]},{48:[2,36],50:[2,36],47:[2,36],45:[2,36],42:[2,36],41:[2,36],40:[2,36],36:[2,36],35:[2,36],30:[2,36],16:[2,36],14:[2,36],18:[2,36],25:[2,36],6:[2,36],27:[2,36],32:[2,36],33:[2,36],34:[2,36],49:[2,36],31:[2,36]},{49:[2,46],34:[2,46],33:[2,46],32:[2,46],27:[2,46],6:[2,46],25:[2,46],18:[2,46],14:[2,46],16:[2,46],30:[2,46],35:[2,46],36:[2,46],40:[2,46],41:[2,46],42:[2,46],45:[2,46],47:[2,46],50:[2,46],48:[2,46],31:[2,46]},{31:[1,59],27:[1,38]},{32:[1,40],33:[1,41],34:[1,42],38:43,49:[1,44],48:[2,33],50:[2,33],47:[2,33],45:[2,33],42:[2,33],41:[2,33],40:[2,33],36:[2,33],35:[2,33],30:[2,33],16:[2,33],14:[2,33],18:[2,33],25:[2,33],6:[2,33],27:[2,33],31:[2,33]},{32:[1,40],33:[1,41],34:[1,42],38:43,49:[1,44],48:[2,34],50:[2,34],47:[2,34],45:[2,34],42:[2,34],41:[2,34],40:[2,34],36:[2,34],35:[2,34],30:[2,34],16:[2,34],14:[2,34],18:[2,34],25:[2,34],6:[2,34],27:[2,34],31:[2,34]},{46:[1,60]},{6:[2,12],25:[2,12],18:[2,12],14:[2,12],16:[2,12]},{6:[2,14],25:[2,14],18:[2,14],14:[2,14],16:[2,14]},{1:[2,1]},{9:[2,16],6:[2,16],30:[2,16],35:[2,16],36:[2,16],40:[2,16],41:[2,16],42:[2,16],45:[2,16],47:[2,16],50:[2,16],48:[2,16],21:[2,16]},{1:[2,2]},{9:[1,61]},{10:62,25:[1,9]},{23:[1,63],24:[1,64]},{23:[2,21],24:[2,21]},{27:[1,38],16:[2,25],14:[2,25],18:[2,25],25:[2,25],6:[2,25],31:[2,25]},{48:[2,29],50:[2,29],47:[2,29],45:[2,29],42:[2,29],41:[2,29],40:[2,29],36:[2,29],35:[2,29],30:[2,29],16:[2,29],14:[2,29],18:[2,29],25:[2,29],6:[2,29],27:[2,29],32:[2,29],33:[2,29],34:[2,29],49:[2,29],31:[2,29]},{34:[2,43],33:[2,43],32:[2,43],27:[2,43],6:[2,43],25:[2,43],18:[2,43],14:[2,43],16:[2,43],30:[2,43],35:[2,43],36:[2,43],40:[2,43],41:[2,43],42:[2,43],45:[2,43],47:[2,43],50:[2,43],48:[2,43],49:[2,43],31:[2,43]},{1:[2,3]},{21:[2,18],48:[2,18],50:[2,18],47:[2,18],45:[2,18],42:[2,18],41:[2,18],40:[2,18],36:[2,18],35:[2,18],30:[2,18],6:[2,18],9:[2,18]},{30:[2,19],35:[2,19],36:[2,19],40:[2,19],41:[2,19],42:[2,19],45:[2,19],47:[2,19],50:[2,19],48:[2,19]},{18:[1,65]},{23:[2,22],24:[2,22]}],
defaultActions: {5:[2,4],51:[2,1],53:[2,2],61:[2,3]},
parseError: 
function parseError(str, hash) {
    throw new Error(str);
}
,
parse: 
function parse(input) {
    var self = this, stack = [0], vstack = [null], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    if (typeof this.yy.parseError === "function") {
        this.parseError = this.yy.parseError;
    }
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
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
            if (symbol == null) {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            if (!recovering) {
                expected = [];
                for (p in table[state]) {
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                }
                var errStr = "";
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ");
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1 ? "end of input" : ("'" + (this.terminals_[symbol] || symbol) + "'"));
                }
                this.parseError(errStr, {text:this.lexer.match, token:this.terminals_[symbol] || symbol, line:this.lexer.yylineno, expected:expected});
            }
            if (recovering == 3) {
                if (symbol == EOF) {
                    throw new Error(errStr || "Parsing halted.");
                }
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                symbol = lex();
            }
            while (1) {
                if ((TERROR.toString()) in table[state]) {
                    break;
                }
                if (state == 0) {
                    throw new Error(errStr || "Parsing halted.");
                }
                popStack(1);
                state = stack[stack.length - 1];
            }
            preErrorSymbol = symbol;
            symbol = TERROR;
            state = stack[stack.length - 1];
            action = table[state] && table[state][TERROR];
            recovering = 3;
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
          case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                if (recovering > 0) {
                    recovering--;
                }
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
          case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
          case 3:
            return true;
        }
    }
    return true;
}
};/* Jison generated lexer */
var lexer = (function(){var lexer = ({EOF:1,
parseError:
function parseError(str, hash) {
    if (this.yy.parseError) {
        this.yy.parseError(str, hash);
    } else {
        throw new Error(str);
    }
}
,
setInput:
function (input) {
    this._input = input;
    this._more = this._less = this.done = false;
    this.yylineno = this.yyleng = 0;
    this.yytext = this.matched = this.match = "";
    this.conditionStack = ["INITIAL"];
    return this;
}
,
input:
function () {
    var ch = this._input[0];
    this.yytext += ch;
    this.yyleng++;
    this.match += ch;
    this.matched += ch;
    var lines = ch.match(/\n/);
    if (lines) {
        this.yylineno++;
    }
    this._input = this._input.slice(1);
    return ch;
}
,
unput:
function (ch) {
    this._input = ch + this._input;
    return this;
}
,
more:
function () {
    this._more = true;
    return this;
}
,
pastInput:
function () {
    var past = this.matched.substr(0, this.matched.length - this.match.length);
    return (past.length > 20 ? "..." : "") + past.substr(-20).replace(/\n/g, "");
}
,
upcomingInput:
function () {
    var next = this.match;
    if (next.length < 20) {
        next += this._input.substr(0, 20 - next.length);
    }
    return (next.substr(0, 20) + (next.length > 20 ? "..." : "")).replace(/\n/g, "");
}
,
showPosition:
function () {
    var pre = this.pastInput();
    var c = new Array(pre.length + 1).join("-");
    return pre + this.upcomingInput() + "\n" + c + "^";
}
,
next:
function () {
    if (this.done) {
        return this.EOF;
    }
    if (!this._input) {
        this.done = true;
    }
    var token, match, lines;
    if (!this._more) {
        this.yytext = "";
        this.match = "";
    }
    var rules = this._currentRules();
    for (var i = 0; i < rules.length; i++) {
        match = this._input.match(this.rules[rules[i]]);
        if (match) {
            lines = match[0].match(/\n/g);
            if (lines) {
                this.yylineno += lines.length;
            }
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[i]);
            if (token) {
                return token;
            } else {
                return;
            }
        }
    }
    if (this._input === "") {
        return this.EOF;
    } else {
        this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {text:"", token:null, line:this.yylineno});
    }
}
,
lex:
function lex() {
    var r = this.next();
    if (typeof r !== "undefined") {
        return r;
    } else {
        return this.lex();
    }
}
,
begin:
function begin(condition) {
    this.conditionStack.push(condition);
}
,
popState:
function popState() {
    return this.conditionStack.pop();
}
,
_currentRules:
function _currentRules() {
    return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
}
});
lexer.performAction = 
function anonymous(yy, yy_, $avoiding_name_collisions) {
    switch ($avoiding_name_collisions) {
      case 0:
        yy.freshLine = true;
        break;
      case 1:
        if (yy.ruleSection) {
            yy.freshLine = false;
        }
        break;
      case 2:
        yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 3);
        return 25;
        break;
      case 3:
        return 18;
        break;
      case 4:
        yy_.yytext = yy_.yytext.replace(/\\"/g, "\"");
        return 50;
        break;
      case 5:
        yy_.yytext = yy_.yytext.replace(/\\'/g, "'");
        return 50;
        break;
      case 6:
        return 27;
        break;
      case 7:
        return 47;
        break;
      case 8:
        return 30;
        break;
      case 9:
        return 31;
        break;
      case 10:
        return 32;
        break;
      case 11:
        return 33;
        break;
      case 12:
        return 34;
        break;
      case 13:
        return 41;
        break;
      case 14:
        return 24;
        break;
      case 15:
        return 42;
        break;
      case 16:
        return 21;
        break;
      case 17:
        return 23;
        break;
      case 18:
        return 36;
        break;
      case 19:
        return 35;
        break;
      case 20:
        return 48;
        break;
      case 21:
        return 42;
        break;
      case 22:
        return 40;
        break;
      case 23:
        return 14;
        break;
      case 24:
        return 16;
        break;
      case 25:
        yy.ruleSection = true;
        return 6;
        break;
      case 26:
        return 49;
        break;
      case 27:
        if (yy.freshLine) {
            this.input("{");
            return 45;
        } else {
            this.unput("y");
        }
        break;
      case 28:
        return 46;
        break;
      case 29:
        yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length - 4);
        return 25;
        break;
      case 30:
        break;
      case 31:
        return 9;
        break;
    }
}
;
lexer.rules = [/^\n+/,/^\s+/,/^y\{[^}]*\}/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^,/,/^<<EOF>>/,/^</,/^>/,/^\/!/,/^\//,/^\\[a-zA-Z0]/,/^\$/,/^\./,/^%s\b/,/^%x\b/,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^(?=\{)/,/^\}/,/^%\{(.|\n)*?%\}/,/^./,/^$/];
lexer.conditions = {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],"inclusive":true}};return lexer;})()
parser.lexer = lexer;
return parser;
})();
if (typeof require !== 'undefined') {
exports.parser = jisonlex;
exports.parse = function () { return jisonlex.parse.apply(jisonlex, arguments); }
exports.main = 
function commonjsMain(args) {
    if (!args[1]) {
        throw new Error("Usage: " + args[0] + " FILE");
    }
    if (typeof process !== "undefined") {
        var source = require("fs").readFileSync(require("path").join(process.cwd(), args[1]), "utf8");
    } else {
        var cwd = require("file").path(require("file").cwd());
        var source = cwd.join(args[1]).read({charset:"utf-8"});
    }
    return exports.parser.parse(source);
}

if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}