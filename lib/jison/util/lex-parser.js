/* Jison generated parser */
var jisonlex = (function(){

var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"include":5,"%%":6,"rules":7,"epilogue":8,"EOF":9,"CODE":10,"action":11,"definition":12,"NAME":13,"regex":14,"START_INC":15,"names_inclusive":16,"START_EXC":17,"names_exclusive":18,"START_COND":19,"name":20,"rule":21,"start_conditions":22,"<":23,"name_list":24,">":25,"*":26,",":27,"ACTION":28,"regex_list":29,"|":30,"regex_concat":31,"regex_base":32,"(":33,")":34,"SPECIAL_GROUP":35,"+":36,"?":37,"/":38,"/!":39,"name_expansion":40,"range_regex":41,"any_group_regex":42,".":43,"^":44,"$":45,"string":46,"escape_char":47,"{":48,"}":49,"ANY_GROUP_REGEX":50,"ESCAPE_CHAR":51,"RANGE_REGEX":52,"STRING_LIT":53,"$accept":0,"$end":1},
terminals_: {2:"error",6:"%%",9:"EOF",10:"CODE",13:"NAME",15:"START_INC",17:"START_EXC",19:"START_COND",23:"<",25:">",26:"*",27:",",28:"ACTION",30:"|",33:"(",34:")",35:"SPECIAL_GROUP",36:"+",37:"?",38:"/",39:"/!",43:".",44:"^",45:"$",48:"{",49:"}",50:"ANY_GROUP_REGEX",51:"ESCAPE_CHAR",52:"RANGE_REGEX",53:"STRING_LIT"},
productions_: [0,[3,5],[8,1],[8,2],[8,3],[5,1],[5,0],[4,2],[4,0],[12,2],[12,2],[12,2],[16,1],[16,2],[18,1],[18,2],[20,1],[7,2],[7,1],[21,3],[22,3],[22,3],[22,0],[24,1],[24,3],[11,1],[14,1],[29,3],[29,2],[29,1],[29,0],[31,2],[31,1],[32,3],[32,3],[32,2],[32,2],[32,2],[32,2],[32,2],[32,1],[32,2],[32,1],[32,1],[32,1],[32,1],[32,1],[32,1],[40,3],[42,1],[47,1],[41,1],[46,1]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: this.$ = {rules: $$[$0-1]};
          if ($$[$0-4][0]) this.$.macros = $$[$0-4][0];
          if ($$[$0-4][1]) this.$.startConditions = $$[$0-4][1];
          if ($$[$0-3]) this.$.actionInclude = $$[$0-3];
          if ($$[$0]) this.$.moduleInclude = $$[$0];
          return this.$; 
break;
case 2: this.$ = null; 
break;
case 3: this.$ = null; 
break;
case 4: this.$ = $$[$0-1]; 
break;
case 7:
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
case 8: this.$ = [null,null]; 
break;
case 9: this.$ = [$$[$0-1], $$[$0]]; 
break;
case 10: this.$ = $$[$0]; 
break;
case 11: this.$ = $$[$0]; 
break;
case 12: this.$ = {}; this.$[$$[$0]] = 0; 
break;
case 13: this.$ = $$[$0-1]; this.$[$$[$0]] = 0; 
break;
case 14: this.$ = {}; this.$[$$[$0]] = 1; 
break;
case 15: this.$ = $$[$0-1]; this.$[$$[$0]] = 1; 
break;
case 16: this.$ = yytext; 
break;
case 17: this.$ = $$[$0-1]; this.$.push($$[$0]); 
break;
case 18: this.$ = [$$[$0]]; 
break;
case 19: this.$ = $$[$0-2] ? [$$[$0-2], $$[$0-1], $$[$0]] : [$$[$0-1],$$[$0]]; 
break;
case 20: this.$ = $$[$0-1]; 
break;
case 21: this.$ = ['*']; 
break;
case 23: this.$ = [$$[$0]]; 
break;
case 24: this.$ = $$[$0-2]; this.$.push($$[$0]); 
break;
case 25: this.$ = yytext; 
break;
case 26: this.$ = $$[$0];
          if (this.$.match(/[\w\d]$/) && !this.$.match(/\\(b|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}|[0-7]{1,3})$/))
              this.$ += "\\b";
        
break;
case 27: this.$ = $$[$0-2]+'|'+$$[$0]; 
break;
case 28: this.$ = $$[$0-1]+'|'; 
break;
case 30: this.$ = '' 
break;
case 31: this.$ = $$[$0-1]+$$[$0]; 
break;
case 33: this.$ = '('+$$[$0-1]+')'; 
break;
case 34: this.$ = $$[$0-2]+$$[$0-1]+')'; 
break;
case 35: this.$ = $$[$0-1]+'+'; 
break;
case 36: this.$ = $$[$0-1]+'*'; 
break;
case 37: this.$ = $$[$0-1]+'?'; 
break;
case 38: this.$ = '(?='+$$[$0]+')'; 
break;
case 39: this.$ = '(?!'+$$[$0]+')'; 
break;
case 41: this.$ = $$[$0-1]+$$[$0]; 
break;
case 43: this.$ = '.'; 
break;
case 44: this.$ = '^'; 
break;
case 45: this.$ = '$'; 
break;
case 48: this.$ = '{'+$$[$0-1]+'}'; 
break;
case 49: this.$ = yytext; 
break;
case 50: this.$ = yytext; 
break;
case 51: this.$ = yytext; 
break;
case 52: this.$ = yy.prepareString(yytext.substr(1, yytext.length-2)); 
break;
}
},
table: [{3:1,4:2,6:[2,8],12:3,13:[1,4],15:[1,5],17:[1,6],28:[2,8]},{1:[3]},{5:7,6:[2,6],11:8,28:[1,9]},{4:10,6:[2,8],12:3,13:[1,4],15:[1,5],17:[1,6],28:[2,8]},{6:[2,30],13:[2,30],14:11,15:[2,30],17:[2,30],28:[2,30],29:12,30:[2,30],31:13,32:14,33:[1,15],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{16:30,19:[1,31]},{18:32,19:[1,33]},{6:[1,34]},{6:[2,5]},{6:[2,25],9:[2,25],23:[2,25],28:[2,25],30:[2,25],33:[2,25],35:[2,25],38:[2,25],39:[2,25],43:[2,25],44:[2,25],45:[2,25],48:[2,25],50:[2,25],51:[2,25],53:[2,25]},{6:[2,7],28:[2,7]},{6:[2,9],13:[2,9],15:[2,9],17:[2,9],28:[2,9]},{6:[2,26],13:[2,26],15:[2,26],17:[2,26],28:[2,26],30:[1,35]},{6:[2,29],13:[2,29],15:[2,29],17:[2,29],28:[2,29],30:[2,29],32:36,33:[1,15],34:[2,29],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{6:[2,32],13:[2,32],15:[2,32],17:[2,32],26:[1,38],28:[2,32],30:[2,32],33:[2,32],34:[2,32],35:[2,32],36:[1,37],37:[1,39],38:[2,32],39:[2,32],41:40,43:[2,32],44:[2,32],45:[2,32],48:[2,32],50:[2,32],51:[2,32],52:[1,41],53:[2,32]},{29:42,30:[2,30],31:13,32:14,33:[1,15],34:[2,30],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{29:43,30:[2,30],31:13,32:14,33:[1,15],34:[2,30],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{32:44,33:[1,15],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{32:45,33:[1,15],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{6:[2,40],13:[2,40],15:[2,40],17:[2,40],26:[2,40],28:[2,40],30:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],37:[2,40],38:[2,40],39:[2,40],43:[2,40],44:[2,40],45:[2,40],48:[2,40],50:[2,40],51:[2,40],52:[2,40],53:[2,40]},{6:[2,42],13:[2,42],15:[2,42],17:[2,42],26:[2,42],28:[2,42],30:[2,42],33:[2,42],34:[2,42],35:[2,42],36:[2,42],37:[2,42],38:[2,42],39:[2,42],43:[2,42],44:[2,42],45:[2,42],48:[2,42],50:[2,42],51:[2,42],52:[2,42],53:[2,42]},{6:[2,43],13:[2,43],15:[2,43],17:[2,43],26:[2,43],28:[2,43],30:[2,43],33:[2,43],34:[2,43],35:[2,43],36:[2,43],37:[2,43],38:[2,43],39:[2,43],43:[2,43],44:[2,43],45:[2,43],48:[2,43],50:[2,43],51:[2,43],52:[2,43],53:[2,43]},{6:[2,44],13:[2,44],15:[2,44],17:[2,44],26:[2,44],28:[2,44],30:[2,44],33:[2,44],34:[2,44],35:[2,44],36:[2,44],37:[2,44],38:[2,44],39:[2,44],43:[2,44],44:[2,44],45:[2,44],48:[2,44],50:[2,44],51:[2,44],52:[2,44],53:[2,44]},{6:[2,45],13:[2,45],15:[2,45],17:[2,45],26:[2,45],28:[2,45],30:[2,45],33:[2,45],34:[2,45],35:[2,45],36:[2,45],37:[2,45],38:[2,45],39:[2,45],43:[2,45],44:[2,45],45:[2,45],48:[2,45],50:[2,45],51:[2,45],52:[2,45],53:[2,45]},{6:[2,46],13:[2,46],15:[2,46],17:[2,46],26:[2,46],28:[2,46],30:[2,46],33:[2,46],34:[2,46],35:[2,46],36:[2,46],37:[2,46],38:[2,46],39:[2,46],43:[2,46],44:[2,46],45:[2,46],48:[2,46],50:[2,46],51:[2,46],52:[2,46],53:[2,46]},{6:[2,47],13:[2,47],15:[2,47],17:[2,47],26:[2,47],28:[2,47],30:[2,47],33:[2,47],34:[2,47],35:[2,47],36:[2,47],37:[2,47],38:[2,47],39:[2,47],43:[2,47],44:[2,47],45:[2,47],48:[2,47],50:[2,47],51:[2,47],52:[2,47],53:[2,47]},{13:[1,47],20:46},{6:[2,49],13:[2,49],15:[2,49],17:[2,49],26:[2,49],28:[2,49],30:[2,49],33:[2,49],34:[2,49],35:[2,49],36:[2,49],37:[2,49],38:[2,49],39:[2,49],43:[2,49],44:[2,49],45:[2,49],48:[2,49],50:[2,49],51:[2,49],52:[2,49],53:[2,49]},{6:[2,52],13:[2,52],15:[2,52],17:[2,52],26:[2,52],28:[2,52],30:[2,52],33:[2,52],34:[2,52],35:[2,52],36:[2,52],37:[2,52],38:[2,52],39:[2,52],43:[2,52],44:[2,52],45:[2,52],48:[2,52],50:[2,52],51:[2,52],52:[2,52],53:[2,52]},{6:[2,50],13:[2,50],15:[2,50],17:[2,50],26:[2,50],28:[2,50],30:[2,50],33:[2,50],34:[2,50],35:[2,50],36:[2,50],37:[2,50],38:[2,50],39:[2,50],43:[2,50],44:[2,50],45:[2,50],48:[2,50],50:[2,50],51:[2,50],52:[2,50],53:[2,50]},{6:[2,10],13:[2,10],15:[2,10],17:[2,10],19:[1,48],28:[2,10]},{6:[2,12],13:[2,12],15:[2,12],17:[2,12],19:[2,12],28:[2,12]},{6:[2,11],13:[2,11],15:[2,11],17:[2,11],19:[1,49],28:[2,11]},{6:[2,14],13:[2,14],15:[2,14],17:[2,14],19:[2,14],28:[2,14]},{7:50,21:51,22:52,23:[1,53],28:[2,22],30:[2,22],33:[2,22],35:[2,22],38:[2,22],39:[2,22],43:[2,22],44:[2,22],45:[2,22],48:[2,22],50:[2,22],51:[2,22],53:[2,22]},{6:[2,28],13:[2,28],15:[2,28],17:[2,28],28:[2,28],30:[2,28],31:54,32:14,33:[1,15],34:[2,28],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{6:[2,31],13:[2,31],15:[2,31],17:[2,31],26:[1,38],28:[2,31],30:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[1,37],37:[1,39],38:[2,31],39:[2,31],41:40,43:[2,31],44:[2,31],45:[2,31],48:[2,31],50:[2,31],51:[2,31],52:[1,41],53:[2,31]},{6:[2,35],13:[2,35],15:[2,35],17:[2,35],26:[2,35],28:[2,35],30:[2,35],33:[2,35],34:[2,35],35:[2,35],36:[2,35],37:[2,35],38:[2,35],39:[2,35],43:[2,35],44:[2,35],45:[2,35],48:[2,35],50:[2,35],51:[2,35],52:[2,35],53:[2,35]},{6:[2,36],13:[2,36],15:[2,36],17:[2,36],26:[2,36],28:[2,36],30:[2,36],33:[2,36],34:[2,36],35:[2,36],36:[2,36],37:[2,36],38:[2,36],39:[2,36],43:[2,36],44:[2,36],45:[2,36],48:[2,36],50:[2,36],51:[2,36],52:[2,36],53:[2,36]},{6:[2,37],13:[2,37],15:[2,37],17:[2,37],26:[2,37],28:[2,37],30:[2,37],33:[2,37],34:[2,37],35:[2,37],36:[2,37],37:[2,37],38:[2,37],39:[2,37],43:[2,37],44:[2,37],45:[2,37],48:[2,37],50:[2,37],51:[2,37],52:[2,37],53:[2,37]},{6:[2,41],13:[2,41],15:[2,41],17:[2,41],26:[2,41],28:[2,41],30:[2,41],33:[2,41],34:[2,41],35:[2,41],36:[2,41],37:[2,41],38:[2,41],39:[2,41],43:[2,41],44:[2,41],45:[2,41],48:[2,41],50:[2,41],51:[2,41],52:[2,41],53:[2,41]},{6:[2,51],13:[2,51],15:[2,51],17:[2,51],26:[2,51],28:[2,51],30:[2,51],33:[2,51],34:[2,51],35:[2,51],36:[2,51],37:[2,51],38:[2,51],39:[2,51],43:[2,51],44:[2,51],45:[2,51],48:[2,51],50:[2,51],51:[2,51],52:[2,51],53:[2,51]},{30:[1,35],34:[1,55]},{30:[1,35],34:[1,56]},{6:[2,38],13:[2,38],15:[2,38],17:[2,38],26:[1,38],28:[2,38],30:[2,38],33:[2,38],34:[2,38],35:[2,38],36:[1,37],37:[1,39],38:[2,38],39:[2,38],41:40,43:[2,38],44:[2,38],45:[2,38],48:[2,38],50:[2,38],51:[2,38],52:[1,41],53:[2,38]},{6:[2,39],13:[2,39],15:[2,39],17:[2,39],26:[1,38],28:[2,39],30:[2,39],33:[2,39],34:[2,39],35:[2,39],36:[1,37],37:[1,39],38:[2,39],39:[2,39],41:40,43:[2,39],44:[2,39],45:[2,39],48:[2,39],50:[2,39],51:[2,39],52:[1,41],53:[2,39]},{49:[1,57]},{49:[2,16]},{6:[2,13],13:[2,13],15:[2,13],17:[2,13],19:[2,13],28:[2,13]},{6:[2,15],13:[2,15],15:[2,15],17:[2,15],19:[2,15],28:[2,15]},{6:[1,61],8:58,9:[1,60],21:59,22:52,23:[1,53],28:[2,22],30:[2,22],33:[2,22],35:[2,22],38:[2,22],39:[2,22],43:[2,22],44:[2,22],45:[2,22],48:[2,22],50:[2,22],51:[2,22],53:[2,22]},{6:[2,18],9:[2,18],23:[2,18],28:[2,18],30:[2,18],33:[2,18],35:[2,18],38:[2,18],39:[2,18],43:[2,18],44:[2,18],45:[2,18],48:[2,18],50:[2,18],51:[2,18],53:[2,18]},{14:62,28:[2,30],29:12,30:[2,30],31:13,32:14,33:[1,15],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{13:[1,65],24:63,26:[1,64]},{6:[2,27],13:[2,27],15:[2,27],17:[2,27],28:[2,27],30:[2,27],32:36,33:[1,15],34:[2,27],35:[1,16],38:[1,17],39:[1,18],40:19,42:20,43:[1,21],44:[1,22],45:[1,23],46:24,47:25,48:[1,26],50:[1,27],51:[1,29],53:[1,28]},{6:[2,33],13:[2,33],15:[2,33],17:[2,33],26:[2,33],28:[2,33],30:[2,33],33:[2,33],34:[2,33],35:[2,33],36:[2,33],37:[2,33],38:[2,33],39:[2,33],43:[2,33],44:[2,33],45:[2,33],48:[2,33],50:[2,33],51:[2,33],52:[2,33],53:[2,33]},{6:[2,34],13:[2,34],15:[2,34],17:[2,34],26:[2,34],28:[2,34],30:[2,34],33:[2,34],34:[2,34],35:[2,34],36:[2,34],37:[2,34],38:[2,34],39:[2,34],43:[2,34],44:[2,34],45:[2,34],48:[2,34],50:[2,34],51:[2,34],52:[2,34],53:[2,34]},{6:[2,48],13:[2,48],15:[2,48],17:[2,48],26:[2,48],28:[2,48],30:[2,48],33:[2,48],34:[2,48],35:[2,48],36:[2,48],37:[2,48],38:[2,48],39:[2,48],43:[2,48],44:[2,48],45:[2,48],48:[2,48],50:[2,48],51:[2,48],52:[2,48],53:[2,48]},{1:[2,1]},{6:[2,17],9:[2,17],23:[2,17],28:[2,17],30:[2,17],33:[2,17],35:[2,17],38:[2,17],39:[2,17],43:[2,17],44:[2,17],45:[2,17],48:[2,17],50:[2,17],51:[2,17],53:[2,17]},{1:[2,2]},{9:[1,66],10:[1,67]},{11:68,28:[1,9]},{25:[1,69],27:[1,70]},{25:[1,71]},{25:[2,23],27:[2,23]},{1:[2,3]},{9:[1,72]},{6:[2,19],9:[2,19],23:[2,19],28:[2,19],30:[2,19],33:[2,19],35:[2,19],38:[2,19],39:[2,19],43:[2,19],44:[2,19],45:[2,19],48:[2,19],50:[2,19],51:[2,19],53:[2,19]},{28:[2,20],30:[2,20],33:[2,20],35:[2,20],38:[2,20],39:[2,20],43:[2,20],44:[2,20],45:[2,20],48:[2,20],50:[2,20],51:[2,20],53:[2,20]},{13:[1,73]},{28:[2,21],30:[2,21],33:[2,21],35:[2,21],38:[2,21],39:[2,21],43:[2,21],44:[2,21],45:[2,21],48:[2,21],50:[2,21],51:[2,21],53:[2,21]},{1:[2,4]},{25:[2,24],27:[2,24]}],
defaultActions: {8:[2,5],47:[2,16],58:[2,1],60:[2,2],66:[2,3],72:[2,4]},
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
case 0:return 19
break;
case 1:this.begin('INITIAL')
break;
case 2:/* empty */
break;
case 3:this.begin('INITIAL')
break;
case 4:this.begin('trail'); yy_.yytext = yy_.yytext.substr(1, yy_.yytext.length-2);return 28;
break;
case 5:this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 28;
break;
case 6:this.begin('INITIAL'); return 28
break;
case 7:this.begin('INITIAL')
break;
case 8:if (yy.ruleSection) this.begin('indented')
break;
case 9:return 13
break;
case 10:yy_.yytext = yy_.yytext.replace(/\\"/g,'"');return 53;
break;
case 11:yy_.yytext = yy_.yytext.replace(/\\'/g,"'");return 53;
break;
case 12:return 30
break;
case 13:return 50
break;
case 14:return 35
break;
case 15:return 35
break;
case 16:return 35
break;
case 17:return 33
break;
case 18:return 34
break;
case 19:return 36
break;
case 20:return 26
break;
case 21:return 37
break;
case 22:return 44
break;
case 23:return 27
break;
case 24:return 45
break;
case 25:return 23
break;
case 26:return 25
break;
case 27:return 39
break;
case 28:return 38
break;
case 29:return 51
break;
case 30:yy_.yytext = yy_.yytext.replace(/^\\/g,''); return 51
break;
case 31:return 45
break;
case 32:return 43
break;
case 33:this.begin('start_condition');return 15
break;
case 34:this.begin('start_condition');return 17
break;
case 35:if (yy.ruleSection) this.begin('code'); yy.ruleSection = true; return 6
break;
case 36:return 52
break;
case 37:return 48
break;
case 38:return 49
break;
case 39:/* ignore bad characters */
break;
case 40:return 9
break;
case 41:return 10;
break;
}
};
lexer.rules = [/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^\n+/,/^\s+/,/^.*\n+/,/^\{[^}]*\}/,/^%\{(.|\n)*?%\}/,/^.+/,/^\n+/,/^\s+/,/^[a-zA-Z_][a-zA-Z0-9_-]*/,/^"(\\\\|\\"|[^"])*"/,/^'(\\\\|\\'|[^'])*'/,/^\|/,/^\[(\\\]|[^\]])*\]/,/^\(\?:/,/^\(\?=/,/^\(\?!/,/^\(/,/^\)/,/^\+/,/^\*/,/^\?/,/^\^/,/^,/,/^<<EOF>>/,/^</,/^>/,/^\/!/,/^\//,/^\\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4})/,/^\\./,/^\$/,/^\./,/^%s\b/,/^%x\b/,/^%%/,/^\{\d+(,\s?\d+|,)?\}/,/^\{/,/^\}/,/^./,/^$/,/^(.|\n)+/];
lexer.conditions = {"code":{"rules":[40,41],"inclusive":false},"start_condition":{"rules":[0,1,2,40],"inclusive":false},"indented":{"rules":[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],"inclusive":true},"trail":{"rules":[3,5,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],"inclusive":true},"INITIAL":{"rules":[5,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],"inclusive":true}};return lexer;})()
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