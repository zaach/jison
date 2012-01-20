/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"%%":5,"rules":6,"epilogue":7,"EOF":8,"CODE":9,"definition":10,"ACTION":11,"NAME":12,"regex":13,"START_INC":14,"names_inclusive":15,"START_EXC":16,"names_exclusive":17,"START_COND":18,"rule":19,"start_conditions":20,"<":21,"name_list":22,">":23,"*":24,",":25,"regex_list":26,"|":27,"regex_concat":28,"regex_base":29,"(":30,")":31,"SPECIAL_GROUP":32,"+":33,"?":34,"/":35,"/!":36,"name_expansion":37,"range_regex":38,"any_group_regex":39,".":40,"^":41,"$":42,"string":43,"escape_char":44,"NAME_BRACE":45,"ANY_GROUP_REGEX":46,"ESCAPE_CHAR":47,"RANGE_REGEX":48,"STRING_LIT":49,"CHARACTER_LIT":50,"$accept":0,"$end":1},
terminals_: {2:"error",5:"%%",8:"EOF",9:"CODE",11:"ACTION",12:"NAME",14:"START_INC",16:"START_EXC",18:"START_COND",21:"<",23:">",24:"*",25:",",27:"|",30:"(",31:")",32:"SPECIAL_GROUP",33:"+",34:"?",35:"/",36:"/!",40:".",41:"^",42:"$",45:"NAME_BRACE",46:"ANY_GROUP_REGEX",47:"ESCAPE_CHAR",48:"RANGE_REGEX",49:"STRING_LIT",50:"CHARACTER_LIT"},
productions_: [0,[3,4],[7,1],[7,2],[7,3],[4,2],[4,2],[4,0],[10,2],[10,2],[10,2],[15,1],[15,2],[17,1],[17,2],[6,2],[6,1],[19,3],[20,3],[20,3],[20,0],[22,1],[22,3],[13,1],[26,3],[26,2],[26,1],[26,0],[28,2],[28,1],[29,3],[29,3],[29,2],[29,2],[29,2],[29,2],[29,2],[29,1],[29,2],[29,1],[29,1],[29,1],[29,1],[29,1],[29,1],[37,1],[39,1],[44,1],[38,1],[43,1],[43,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: this.$ = {rules: $$[$0-1]};
          if ($$[$0-3][0]) this.$.macros = $$[$0-3][0];
          if ($$[$0-3][1]) this.$.startConditions = $$[$0-3][1];
          if ($$[$0]) this.$.moduleInclude = $$[$0];
          if (yy.options) this.$.options = yy.options;
          if (yy.actionInclude) this.$.actionInclude = yy.actionInclude;
          delete yy.options;
          delete yy.actionInclude;
          return this.$; 
break;
case 2: this.$ = null; 
break;
case 3: this.$ = null; 
break;
case 4: this.$ = $$[$0-1]; 
break;
case 5:
          this.$ = $$[$0];
          if ('length' in $$[$0-1]) {
            this.$[0] = this.$[0] || {};
            this.$[0][$$[$0-1][0]] = $$[$0-1][1];
          } else {
            this.$[1] = this.$[1] || {};
            for (var name in $$[$0-1]) {
              this.$[1][name] = $$[$0-1][name];
            }
          }
        
break;
case 6: yy.actionInclude += $$[$0-1]; this.$ = $$[$0]; 
break;
case 7: yy.actionInclude = ''; this.$ = [null,null]; 
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
case 15: this.$ = $$[$0-1]; this.$.push($$[$0]); 
break;
case 16: this.$ = [$$[$0]]; 
break;
case 17: this.$ = $$[$0-2] ? [$$[$0-2], $$[$0-1], $$[$0]] : [$$[$0-1],$$[$0]]; 
break;
case 18: this.$ = $$[$0-1]; 
break;
case 19: this.$ = ['*']; 
break;
case 21: this.$ = [$$[$0]]; 
break;
case 22: this.$ = $$[$0-2]; this.$.push($$[$0]); 
break;
case 23: this.$ = $$[$0];
          if (!(yy.options && yy.options.flex) && this.$.match(/[\w\d]$/) && !this.$.match(/\\(b|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}|[0-7]{1,3})$/))
              this.$ += "\\b";
        
break;
case 24: this.$ = $$[$0-2]+'|'+$$[$0]; 
break;
case 25: this.$ = $$[$0-1]+'|'; 
break;
case 27: this.$ = '' 
break;
case 28: this.$ = $$[$0-1]+$$[$0]; 
break;
case 30: this.$ = '('+$$[$0-1]+')'; 
break;
case 31: this.$ = $$[$0-2]+$$[$0-1]+')'; 
break;
case 32: this.$ = $$[$0-1]+'+'; 
break;
case 33: this.$ = $$[$0-1]+'*'; 
break;
case 34: this.$ = $$[$0-1]+'?'; 
break;
case 35: this.$ = '(?='+$$[$0]+')'; 
break;
case 36: this.$ = '(?!'+$$[$0]+')'; 
break;
case 38: this.$ = $$[$0-1]+$$[$0]; 
break;
case 40: this.$ = '.'; 
break;
case 41: this.$ = '^'; 
break;
case 42: this.$ = '$'; 
break;
case 46: this.$ = yytext; 
break;
case 47: this.$ = yytext; 
break;
case 48: this.$ = yytext; 
break;
case 49: this.$ = yy.prepareString(yytext.substr(1, yytext.length-2)); 
break;
}
},
table: [{3:1,4:2,5:[2,7],10:3,11:[1,4],12:[1,5],14:[1,6],16:[1,7]},{1:[3]},{5:[1,8]},{4:9,5:[2,7],10:3,11:[1,4],12:[1,5],14:[1,6],16:[1,7]},{4:10,5:[2,7],10:3,11:[1,4],12:[1,5],14:[1,6],16:[1,7]},{5:[2,27],11:[2,27],12:[2,27],13:11,14:[2,27],16:[2,27],26:12,27:[2,27],28:13,29:14,30:[1,15],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{15:31,18:[1,32]},{17:33,18:[1,34]},{6:35,11:[2,20],19:36,20:37,21:[1,38],27:[2,20],30:[2,20],32:[2,20],35:[2,20],36:[2,20],40:[2,20],41:[2,20],42:[2,20],45:[2,20],46:[2,20],47:[2,20],49:[2,20],50:[2,20]},{5:[2,5]},{5:[2,6]},{5:[2,8],11:[2,8],12:[2,8],14:[2,8],16:[2,8]},{5:[2,23],11:[2,23],12:[2,23],14:[2,23],16:[2,23],27:[1,39]},{5:[2,26],11:[2,26],12:[2,26],14:[2,26],16:[2,26],27:[2,26],29:40,30:[1,15],31:[2,26],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{5:[2,29],11:[2,29],12:[2,29],14:[2,29],16:[2,29],24:[1,42],27:[2,29],30:[2,29],31:[2,29],32:[2,29],33:[1,41],34:[1,43],35:[2,29],36:[2,29],38:44,40:[2,29],41:[2,29],42:[2,29],45:[2,29],46:[2,29],47:[2,29],48:[1,45],49:[2,29],50:[2,29]},{26:46,27:[2,27],28:13,29:14,30:[1,15],31:[2,27],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{26:47,27:[2,27],28:13,29:14,30:[1,15],31:[2,27],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{29:48,30:[1,15],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{29:49,30:[1,15],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{5:[2,37],11:[2,37],12:[2,37],14:[2,37],16:[2,37],24:[2,37],27:[2,37],30:[2,37],31:[2,37],32:[2,37],33:[2,37],34:[2,37],35:[2,37],36:[2,37],40:[2,37],41:[2,37],42:[2,37],45:[2,37],46:[2,37],47:[2,37],48:[2,37],49:[2,37],50:[2,37]},{5:[2,39],11:[2,39],12:[2,39],14:[2,39],16:[2,39],24:[2,39],27:[2,39],30:[2,39],31:[2,39],32:[2,39],33:[2,39],34:[2,39],35:[2,39],36:[2,39],40:[2,39],41:[2,39],42:[2,39],45:[2,39],46:[2,39],47:[2,39],48:[2,39],49:[2,39],50:[2,39]},{5:[2,40],11:[2,40],12:[2,40],14:[2,40],16:[2,40],24:[2,40],27:[2,40],30:[2,40],31:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],41:[2,40],42:[2,40],45:[2,40],46:[2,40],47:[2,40],48:[2,40],49:[2,40],50:[2,40]},{5:[2,41],11:[2,41],12:[2,41],14:[2,41],16:[2,41],24:[2,41],27:[2,41],30:[2,41],31:[2,41],32:[2,41],33:[2,41],34:[2,41],35:[2,41],36:[2,41],40:[2,41],41:[2,41],42:[2,41],45:[2,41],46:[2,41],47:[2,41],48:[2,41],49:[2,41],50:[2,41]},{5:[2,42],11:[2,42],12:[2,42],14:[2,42],16:[2,42],24:[2,42],27:[2,42],30:[2,42],31:[2,42],32:[2,42],33:[2,42],34:[2,42],35:[2,42],36:[2,42],40:[2,42],41:[2,42],42:[2,42],45:[2,42],46:[2,42],47:[2,42],48:[2,42],49:[2,42],50:[2,42]},{5:[2,43],11:[2,43],12:[2,43],14:[2,43],16:[2,43],24:[2,43],27:[2,43],30:[2,43],31:[2,43],32:[2,43],33:[2,43],34:[2,43],35:[2,43],36:[2,43],40:[2,43],41:[2,43],42:[2,43],45:[2,43],46:[2,43],47:[2,43],48:[2,43],49:[2,43],50:[2,43]},{5:[2,44],11:[2,44],12:[2,44],14:[2,44],16:[2,44],24:[2,44],27:[2,44],30:[2,44],31:[2,44],32:[2,44],33:[2,44],34:[2,44],35:[2,44],36:[2,44],40:[2,44],41:[2,44],42:[2,44],45:[2,44],46:[2,44],47:[2,44],48:[2,44],49:[2,44],50:[2,44]},{5:[2,45],11:[2,45],12:[2,45],14:[2,45],16:[2,45],24:[2,45],27:[2,45],30:[2,45],31:[2,45],32:[2,45],33:[2,45],34:[2,45],35:[2,45],36:[2,45],40:[2,45],41:[2,45],42:[2,45],45:[2,45],46:[2,45],47:[2,45],48:[2,45],49:[2,45],50:[2,45]},{5:[2,46],11:[2,46],12:[2,46],14:[2,46],16:[2,46],24:[2,46],27:[2,46],30:[2,46],31:[2,46],32:[2,46],33:[2,46],34:[2,46],35:[2,46],36:[2,46],40:[2,46],41:[2,46],42:[2,46],45:[2,46],46:[2,46],47:[2,46],48:[2,46],49:[2,46],50:[2,46]},{5:[2,49],11:[2,49],12:[2,49],14:[2,49],16:[2,49],24:[2,49],27:[2,49],30:[2,49],31:[2,49],32:[2,49],33:[2,49],34:[2,49],35:[2,49],36:[2,49],40:[2,49],41:[2,49],42:[2,49],45:[2,49],46:[2,49],47:[2,49],48:[2,49],49:[2,49],50:[2,49]},{5:[2,50],11:[2,50],12:[2,50],14:[2,50],16:[2,50],24:[2,50],27:[2,50],30:[2,50],31:[2,50],32:[2,50],33:[2,50],34:[2,50],35:[2,50],36:[2,50],40:[2,50],41:[2,50],42:[2,50],45:[2,50],46:[2,50],47:[2,50],48:[2,50],49:[2,50],50:[2,50]},{5:[2,47],11:[2,47],12:[2,47],14:[2,47],16:[2,47],24:[2,47],27:[2,47],30:[2,47],31:[2,47],32:[2,47],33:[2,47],34:[2,47],35:[2,47],36:[2,47],40:[2,47],41:[2,47],42:[2,47],45:[2,47],46:[2,47],47:[2,47],48:[2,47],49:[2,47],50:[2,47]},{5:[2,9],11:[2,9],12:[2,9],14:[2,9],16:[2,9],18:[1,50]},{5:[2,11],11:[2,11],12:[2,11],14:[2,11],16:[2,11],18:[2,11]},{5:[2,10],11:[2,10],12:[2,10],14:[2,10],16:[2,10],18:[1,51]},{5:[2,13],11:[2,13],12:[2,13],14:[2,13],16:[2,13],18:[2,13]},{5:[1,55],7:52,8:[1,54],11:[2,20],19:53,20:37,21:[1,38],27:[2,20],30:[2,20],32:[2,20],35:[2,20],36:[2,20],40:[2,20],41:[2,20],42:[2,20],45:[2,20],46:[2,20],47:[2,20],49:[2,20],50:[2,20]},{5:[2,16],8:[2,16],11:[2,16],21:[2,16],27:[2,16],30:[2,16],32:[2,16],35:[2,16],36:[2,16],40:[2,16],41:[2,16],42:[2,16],45:[2,16],46:[2,16],47:[2,16],49:[2,16],50:[2,16]},{11:[2,27],13:56,26:12,27:[2,27],28:13,29:14,30:[1,15],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{12:[1,59],22:57,24:[1,58]},{5:[2,25],11:[2,25],12:[2,25],14:[2,25],16:[2,25],27:[2,25],28:60,29:14,30:[1,15],31:[2,25],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{5:[2,28],11:[2,28],12:[2,28],14:[2,28],16:[2,28],24:[1,42],27:[2,28],30:[2,28],31:[2,28],32:[2,28],33:[1,41],34:[1,43],35:[2,28],36:[2,28],38:44,40:[2,28],41:[2,28],42:[2,28],45:[2,28],46:[2,28],47:[2,28],48:[1,45],49:[2,28],50:[2,28]},{5:[2,32],11:[2,32],12:[2,32],14:[2,32],16:[2,32],24:[2,32],27:[2,32],30:[2,32],31:[2,32],32:[2,32],33:[2,32],34:[2,32],35:[2,32],36:[2,32],40:[2,32],41:[2,32],42:[2,32],45:[2,32],46:[2,32],47:[2,32],48:[2,32],49:[2,32],50:[2,32]},{5:[2,33],11:[2,33],12:[2,33],14:[2,33],16:[2,33],24:[2,33],27:[2,33],30:[2,33],31:[2,33],32:[2,33],33:[2,33],34:[2,33],35:[2,33],36:[2,33],40:[2,33],41:[2,33],42:[2,33],45:[2,33],46:[2,33],47:[2,33],48:[2,33],49:[2,33],50:[2,33]},{5:[2,34],11:[2,34],12:[2,34],14:[2,34],16:[2,34],24:[2,34],27:[2,34],30:[2,34],31:[2,34],32:[2,34],33:[2,34],34:[2,34],35:[2,34],36:[2,34],40:[2,34],41:[2,34],42:[2,34],45:[2,34],46:[2,34],47:[2,34],48:[2,34],49:[2,34],50:[2,34]},{5:[2,38],11:[2,38],12:[2,38],14:[2,38],16:[2,38],24:[2,38],27:[2,38],30:[2,38],31:[2,38],32:[2,38],33:[2,38],34:[2,38],35:[2,38],36:[2,38],40:[2,38],41:[2,38],42:[2,38],45:[2,38],46:[2,38],47:[2,38],48:[2,38],49:[2,38],50:[2,38]},{5:[2,48],11:[2,48],12:[2,48],14:[2,48],16:[2,48],24:[2,48],27:[2,48],30:[2,48],31:[2,48],32:[2,48],33:[2,48],34:[2,48],35:[2,48],36:[2,48],40:[2,48],41:[2,48],42:[2,48],45:[2,48],46:[2,48],47:[2,48],48:[2,48],49:[2,48],50:[2,48]},{27:[1,39],31:[1,61]},{27:[1,39],31:[1,62]},{5:[2,35],11:[2,35],12:[2,35],14:[2,35],16:[2,35],24:[1,42],27:[2,35],30:[2,35],31:[2,35],32:[2,35],33:[1,41],34:[1,43],35:[2,35],36:[2,35],38:44,40:[2,35],41:[2,35],42:[2,35],45:[2,35],46:[2,35],47:[2,35],48:[1,45],49:[2,35],50:[2,35]},{5:[2,36],11:[2,36],12:[2,36],14:[2,36],16:[2,36],24:[1,42],27:[2,36],30:[2,36],31:[2,36],32:[2,36],33:[1,41],34:[1,43],35:[2,36],36:[2,36],38:44,40:[2,36],41:[2,36],42:[2,36],45:[2,36],46:[2,36],47:[2,36],48:[1,45],49:[2,36],50:[2,36]},{5:[2,12],11:[2,12],12:[2,12],14:[2,12],16:[2,12],18:[2,12]},{5:[2,14],11:[2,14],12:[2,14],14:[2,14],16:[2,14],18:[2,14]},{1:[2,1]},{5:[2,15],8:[2,15],11:[2,15],21:[2,15],27:[2,15],30:[2,15],32:[2,15],35:[2,15],36:[2,15],40:[2,15],41:[2,15],42:[2,15],45:[2,15],46:[2,15],47:[2,15],49:[2,15],50:[2,15]},{1:[2,2]},{8:[1,63],9:[1,64]},{11:[1,65]},{23:[1,66],25:[1,67]},{23:[1,68]},{23:[2,21],25:[2,21]},{5:[2,24],11:[2,24],12:[2,24],14:[2,24],16:[2,24],27:[2,24],29:40,30:[1,15],31:[2,24],32:[1,16],35:[1,17],36:[1,18],37:19,39:20,40:[1,21],41:[1,22],42:[1,23],43:24,44:25,45:[1,26],46:[1,27],47:[1,30],49:[1,28],50:[1,29]},{5:[2,30],11:[2,30],12:[2,30],14:[2,30],16:[2,30],24:[2,30],27:[2,30],30:[2,30],31:[2,30],32:[2,30],33:[2,30],34:[2,30],35:[2,30],36:[2,30],40:[2,30],41:[2,30],42:[2,30],45:[2,30],46:[2,30],47:[2,30],48:[2,30],49:[2,30],50:[2,30]},{5:[2,31],11:[2,31],12:[2,31],14:[2,31],16:[2,31],24:[2,31],27:[2,31],30:[2,31],31:[2,31],32:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[2,31],40:[2,31],41:[2,31],42:[2,31],45:[2,31],46:[2,31],47:[2,31],48:[2,31],49:[2,31],50:[2,31]},{1:[2,3]},{8:[1,69]},{5:[2,17],8:[2,17],11:[2,17],21:[2,17],27:[2,17],30:[2,17],32:[2,17],35:[2,17],36:[2,17],40:[2,17],41:[2,17],42:[2,17],45:[2,17],46:[2,17],47:[2,17],49:[2,17],50:[2,17]},{11:[2,18],27:[2,18],30:[2,18],32:[2,18],35:[2,18],36:[2,18],40:[2,18],41:[2,18],42:[2,18],45:[2,18],46:[2,18],47:[2,18],49:[2,18],50:[2,18]},{12:[1,70]},{11:[2,19],27:[2,19],30:[2,19],32:[2,19],35:[2,19],36:[2,19],40:[2,19],41:[2,19],42:[2,19],45:[2,19],46:[2,19],47:[2,19],49:[2,19],50:[2,19]},{1:[2,4]},{23:[2,22],25:[2,22]}],
defaultActions: {9:[2,5],10:[2,6],52:[2,1],54:[2,2],63:[2,3],69:[2,4]},
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
case 0:return 12
break;
case 1:this.popState(); return 23
break;
case 2:return 25
break;
case 3:return 24
break;
case 4:/* */
break;
case 5:this.begin('indented')
break;
case 6:this.begin('code'); return 5
break;
case 7:return 50
break;
case 8:yy.options[yy_.yytext] = true
break;
case 9:this.begin('INITIAL')
break;
case 10:this.begin('INITIAL')
break;
case 11:/* empty */
break;
case 12:return 18
break;
case 13:this.begin('INITIAL')
break;
case 14:this.begin('INITIAL')
break;
case 15:/* empty */
break;
case 16:this.begin('rules')
break;
case 17:this.begin('trail'); yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length-2);return 11
break;
case 18:this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 11
break;
case 19:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4); return 11
break;
case 20:this.begin('rules'); return 11
break;
case 21:/* */
break;
case 22:/* */
break;
case 23:return 12
break;
case 24:yy_.yytext = yy_.yytext.replace(/\\"/g,'"');return 49
break;
case 25:yy_.yytext = yy_.yytext.replace(/\\'/g,"'");return 49
break;
case 26:return 27
break;
case 27:return 46
break;
case 28:return 32
break;
case 29:return 32
break;
case 30:return 32
break;
case 31:return 30
break;
case 32:return 31
break;
case 33:return 33
break;
case 34:return 24
break;
case 35:return 34
break;
case 36:return 41
break;
case 37:return 25
break;
case 38:return 42
break;
case 39:this.begin('conditions'); return 21
break;
case 40:return 36
break;
case 41:return 35
break;
case 42:return 47
break;
case 43:yy_.yytext = yy_.yytext.replace(/^\\/g,''); return 47
break;
case 44:return 42
break;
case 45:return 40
break;
case 46:yy.options = {}; this.begin('options')
break;
case 47:this.begin('start_condition');return 14
break;
case 48:this.begin('start_condition');return 16
break;
case 49:this.begin('rules'); return 5
break;
case 50:return 48
break;
case 51:return 45
break;
case 52:return '{'
break;
case 53:return '}'
break;
case 54:/* ignore bad characters */
break;
case 55:return 8
break;
case 56:return 9
break;
}
};
lexer.rules = [/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^>/,/^,/,/^\*/,/^\n+/,/^\s+/,/^%%/,/^[a-zA-Z0-9_]+/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^\n+/,/^\s+\n+/,/^\s+/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^\n+/,/^\s+\n+/,/^\s+/,/^.*\n+/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^%\{(.|\n)*?%\}/,/^.+/,/^\n+/,/^\s+/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(\?:/,/^\(\?=/,/^\(\?!/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^,/,/^<<EOF>>/,/^</,/^\/!/,/^\//,/^\\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4})/,/^\\./,/^\$/,/^\./,/^%options\b/,/^%s\b/,/^%x\b/,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^\{[a-zA-Z_][a-zA-Z0-9_-]*\}/,/^\{/,/^\}/,/^./,/^$/,/^(.|\n)+/];
lexer.conditions = {"code":{"rules":[55,56],"inclusive":false},"start_condition":{"rules":[12,13,14,15,55],"inclusive":false},"options":{"rules":[8,9,10,11,55],"inclusive":false},"conditions":{"rules":[0,1,2,3,55],"inclusive":false},"indented":{"rules":[17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55],"inclusive":true},"trail":{"rules":[16,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55],"inclusive":true},"rules":{"rules":[4,5,6,7,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55],"inclusive":true},"INITIAL":{"rules":[19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55],"inclusive":true}};


;
return lexer;})()
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