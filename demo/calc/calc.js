/* Jison generated parser */
var calc = (function(){
var parser = {log: function log() {
    if (this.DEBUG) {
        print.apply(null, arguments);
    }
},
EOF: '$end',
yy: {},
symbols: ["$accept","$end","S","e","EOF","+","-","*","/","^","(",")","NUMBER","E","PI"],
nonterminals_: {"S":2,"e":3},
productions_: [0,[2,2],[3,3],[3,3],[3,3],[3,3],[3,3],[3,2],[3,3],[3,1],[3,1],[3,1]],
performAction: function anonymous(yytext, yylineno, yy) {
    switch (arguments[3]) {
      case 1:
        return arguments[4][arguments[4].length - 2 + 1 - 1];
        break;
      case 2:
        this.yyval = arguments[4][arguments[4].length - 3 + 1 - 1] + arguments[4][arguments[4].length - 3 + 3 - 1];
        break;
      case 3:
        this.yyval = arguments[4][arguments[4].length - 3 + 1 - 1] - arguments[4][arguments[4].length - 3 + 3 - 1];
        break;
      case 4:
        this.yyval = arguments[4][arguments[4].length - 3 + 1 - 1] * arguments[4][arguments[4].length - 3 + 3 - 1];
        break;
      case 5:
        this.yyval = arguments[4][arguments[4].length - 3 + 1 - 1] / arguments[4][arguments[4].length - 3 + 3 - 1];
        break;
      case 6:
        this.yyval = Math.pow(arguments[4][arguments[4].length - 3 + 1 - 1], arguments[4][arguments[4].length - 3 + 3 - 1]);
        break;
      case 7:
        this.yyval = - arguments[4][arguments[4].length - 2 + 2 - 1];
        break;
      case 8:
        this.yyval = arguments[4][arguments[4].length - 3 + 2 - 1];
        break;
      case 9:
        this.yyval = Number(yytext);
        break;
      case 10:
        this.yyval = Math.E;
        break;
      case 11:
        this.yyval = Math.PI;
        break;
      default:;
    }
},
table: [{"S":1,"e":2,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"$end":[["a"]]},{"EOF":[["s",8]],"+":[["s",9]],"-":[["s",10]],"*":[["s",11]],"/":[["s",12]],"^":[["s",13]]},{"e":14,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"e":15,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"EOF":[["r",9]],"+":[["r",9]],"-":[["r",9]],"*":[["r",9]],"/":[["r",9]],"^":[["r",9]],")":[["r",9]]},{"EOF":[["r",10]],"+":[["r",10]],"-":[["r",10]],"*":[["r",10]],"/":[["r",10]],"^":[["r",10]],")":[["r",10]]},{"EOF":[["r",11]],"+":[["r",11]],"-":[["r",11]],"*":[["r",11]],"/":[["r",11]],"^":[["r",11]],")":[["r",11]]},{"$end":[["r",1]]},{"e":16,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"e":17,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"e":18,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"e":19,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"e":20,"-":[["s",3]],"(":[["s",4]],"NUMBER":[["s",5]],"E":[["s",6]],"PI":[["s",7]]},{"+":[["r",7]],"-":[["r",7]],"*":[["r",7]],"/":[["r",7]],"^":[["r",7]],"EOF":[["r",7]],")":[["r",7]]},{")":[["s",21]],"+":[["s",9]],"-":[["s",10]],"*":[["s",11]],"/":[["s",12]],"^":[["s",13]]},{"+":[["r",2]],"-":[["r",2]],"*":[["s",11]],"/":[["s",12]],"^":[["s",13]],"EOF":[["r",2]],")":[["r",2]]},{"+":[["r",3]],"-":[["r",3]],"*":[["s",11]],"/":[["s",12]],"^":[["s",13]],"EOF":[["r",3]],")":[["r",3]]},{"+":[["r",4]],"-":[["r",4]],"*":[["r",4]],"/":[["r",4]],"^":[["s",13]],"EOF":[["r",4]],")":[["r",4]]},{"+":[["r",5]],"-":[["r",5]],"*":[["r",5]],"/":[["r",5]],"^":[["s",13]],"EOF":[["r",5]],")":[["r",5]]},{"+":[["r",6]],"-":[["r",6]],"*":[["r",6]],"/":[["r",6]],"^":[["r",6]],"EOF":[["r",6]],")":[["r",6]]},{"EOF":[["r",8]],"+":[["r",8]],"-":[["r",8]],"*":[["r",8]],"/":[["r",8]],"^":[["r",8]],")":[["r",8]]}],
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], table = this.table, yytext = "", yylineno = 0, EOF = this.EOF;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    var parseError = this.yy.parseError = this.yy.parseError || this.parseError;

    function lex() {
        var token;
        token = self.lexer.lex();
        return token || EOF;
    }

    var symbol, state, action, a, r, yyval = {}, p, len, ip = 0, newState, expected;
    symbol = lex();
    while (true) {
        this.log("stack:", JSON.stringify(stack), "\n\t\t\tinput:", this.lexer._input);
        this.log("vstack:", JSON.stringify(vstack));
        state = stack[stack.length - 1];
        action = table[state] && table[state][symbol];
        if (typeof action == "undefined" || !action.length || !action[0]) {
            expected = [];
            for (p in table[state]) {
                if (!this.nonterminals_[p] && p !== this.EOF) {
                    expected.push("'" + p + "'");
                }
            }
            self.log("stack:", JSON.stringify(stack), "symbol:", symbol, "input", this.lexer.upcomingInput());
            parseError("Parse error on line " + (yylineno + 1) + ". Expecting: " + expected.join(", ") + "\n" + this.lexer.showPosition(), {text: this.lexer.match, token: symbol, line: this.lexer.yylineno});
        }
        this.log("action:", action);
        if (action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        a = action[0];
        switch (a[0]) {
          case "s":
            stack.push(symbol);
            ++ip;
            yytext = this.lexer.yytext;
            yylineno = this.lexer.yylineno;
            symbol = lex();
            vstack.push(null);
            stack.push(a[1]);
            break;
          case "r":
            len = this.productions_[a[1]][1];
            this.log("reduce by: ", this.productions ? this.productions[a[1]] : a[1]);
            yyval.yyval = vstack[vstack.length - len];
            r = this.performAction.call(yyval, yytext, yylineno, this.yy, a[1], vstack);
            if (r != undefined) {
                return r;
            }
            this.log("yyval=", JSON.stringify(yyval.yyval));
            if (len) {
                this.log("production length:", len);
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
            }
            stack.push(this.symbols[this.productions_[a[1]][0]]);
            vstack.push(yyval.yyval);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
          case "a":
            this.log("stack:", stack, "\n\tinput:", this.lexer._input);
            this.log("vstack:", JSON.stringify(vstack));
            return true;
          default:;
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
    this.yytext = this.matched = this.match = "";
    return this;
},
input:function () {
    var ch = this._input[0];
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
    return (this.matched.length > 20 ? "..." : "") + this.matched.substr(-20).replace(/\n/g, "");
},
upcomingInput:function () {
    return (this._input.substr(0, 20) + (this._input.length > 20 ? "..." : "")).replace(/\n/g, "");
},
showPosition:function () {
    var pre = this.pastInput();
    var c = (new Array(pre.length - this.match.length + 1)).join("-");
    return pre + this.upcomingInput() + "\n" + c + "^";
},
next:function () {
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
    for (var i = 0; i < this.rules.length; i++) {
        match = this._input.match(this.rules[i]);
        if (match) {
            lines = match[0].match(/\n/g);
            if (lines) {
                this.yylineno += lines.length;
            }
            this.yytext += match[0];
            this.match += match[0];
            this.yyleng = this.yytext.length;
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, i);
            if (token) {
                return token;
            } else {
                return;
            }
        }
    }
    if (this._input == this.EOF) {
        return this.EOF;
    } else {
        this.parseError("Lexical error on line " + (this.yylineno + 1) + ". Unrecognized text.\n" + this.showPosition(), {text: "", token: null, line: this.yylineno});
    }
},
lex:function () {
    var r = this.next();
    if (r != undefined) {
        return r;
    } else {
        return this.lex();
    }
}});
lexer.performAction = function anonymous(yy, yy_) {
    switch (arguments[2]) {
      case 0:
        break;
      case 1:
        return "NUMBER";
        break;
      case 2:
        return "*";
        break;
      case 3:
        return "/";
        break;
      case 4:
        return "-";
        break;
      case 5:
        return "+";
        break;
      case 6:
        return "^";
        break;
      case 7:
        return "(";
        break;
      case 8:
        return ")";
        break;
      case 9:
        return "PI";
        break;
      case 10:
        return "E";
        break;
      case 11:
        return "EOF";
        break;
      default:;
    }
};
lexer.rules = [/^\s+/, /^[0-9]+(?:\.[0-9]+)?\b/, /^\*/, /^\//, /^-/, /^\+/, /^\^/, /^\(/, /^\)/, /^PI\b/, /^E\b/, /^$/];return lexer;})()
parser.lexer = lexer; return parser; })();
if (typeof exports !== 'undefined') {
exports.parser = calc;
exports.parse = function () { return calc.parse.apply(calc, arguments); }
exports.main = function commonjsMain(args) {
    var cwd = require("file").path(require("file").cwd());
    if (!args[1]) {
        throw new Error("Usage: " + args[0] + " FILE");
    }
    var source = cwd.join(args[1]).read({charset: "utf-8"});
    this.parse(source);
}
if (require.main === module.id) {
	exports.main(require("system").args);
}
}
