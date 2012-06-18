/* Jison generated parser */
var jisonlex = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"lex":3,"definitions":4,"%%":5,"rules":6,"epilogue":7,"EOF":8,"CODE":9,"definition":10,"ACTION":11,"NAME":12,"regex":13,"START_INC":14,"names_inclusive":15,"START_EXC":16,"names_exclusive":17,"START_COND":18,"rule":19,"start_conditions":20,"action":21,"{":22,"action_body":23,"}":24,"ACTION_BODY":25,"<":26,"name_list":27,">":28,"*":29,",":30,"regex_list":31,"|":32,"regex_concat":33,"regex_base":34,"(":35,")":36,"SPECIAL_GROUP":37,"+":38,"?":39,"/":40,"/!":41,"name_expansion":42,"range_regex":43,"any_group_regex":44,".":45,"^":46,"$":47,"string":48,"escape_char":49,"NAME_BRACE":50,"ANY_GROUP_REGEX":51,"ESCAPE_CHAR":52,"RANGE_REGEX":53,"STRING_LIT":54,"CHARACTER_LIT":55,"$accept":0,"$end":1},
terminals_: {2:"error",5:"%%",8:"EOF",9:"CODE",11:"ACTION",12:"NAME",14:"START_INC",16:"START_EXC",18:"START_COND",22:"{",24:"}",25:"ACTION_BODY",26:"<",28:">",29:"*",30:",",32:"|",35:"(",36:")",37:"SPECIAL_GROUP",38:"+",39:"?",40:"/",41:"/!",45:".",46:"^",47:"$",50:"NAME_BRACE",51:"ANY_GROUP_REGEX",52:"ESCAPE_CHAR",53:"RANGE_REGEX",54:"STRING_LIT",55:"CHARACTER_LIT"},
productions_: [0,[3,4],[7,1],[7,2],[7,3],[4,2],[4,2],[4,0],[10,2],[10,2],[10,2],[15,1],[15,2],[17,1],[17,2],[6,2],[6,1],[19,3],[21,3],[21,1],[23,0],[23,1],[23,5],[23,4],[20,3],[20,3],[20,0],[27,1],[27,3],[13,1],[31,3],[31,2],[31,1],[31,0],[33,2],[33,1],[34,3],[34,3],[34,2],[34,2],[34,2],[34,2],[34,2],[34,1],[34,2],[34,1],[34,1],[34,1],[34,1],[34,1],[34,1],[42,1],[44,1],[49,1],[43,1],[48,1],[48,1]],
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
case 18:this.$ = $$[$0-1];
break;
case 19:this.$ = $$[$0];
break;
case 20:this.$ = '';
break;
case 21:this.$ = yytext;
break;
case 22:this.$ = $$[$0-4]+$$[$0-3]+$$[$0-2]+$$[$0-1]+$$[$0];
break;
case 23:this.$ = $$[$0-3]+$$[$0-2]+$$[$0-1]+$$[$0];
break;
case 24: this.$ = $$[$0-1]; 
break;
case 25: this.$ = ['*']; 
break;
case 27: this.$ = [$$[$0]]; 
break;
case 28: this.$ = $$[$0-2]; this.$.push($$[$0]); 
break;
case 29: this.$ = $$[$0];
          if (!(yy.options && yy.options.flex) && this.$.match(/[\w\d]$/) && !this.$.match(/\\(b|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}|[0-7]{1,3})$/))
              this.$ += "\\b";
        
break;
case 30: this.$ = $$[$0-2]+'|'+$$[$0]; 
break;
case 31: this.$ = $$[$0-1]+'|'; 
break;
case 33: this.$ = '' 
break;
case 34: this.$ = $$[$0-1]+$$[$0]; 
break;
case 36: this.$ = '('+$$[$0-1]+')'; 
break;
case 37: this.$ = $$[$0-2]+$$[$0-1]+')'; 
break;
case 38: this.$ = $$[$0-1]+'+'; 
break;
case 39: this.$ = $$[$0-1]+'*'; 
break;
case 40: this.$ = $$[$0-1]+'?'; 
break;
case 41: this.$ = '(?='+$$[$0]+')'; 
break;
case 42: this.$ = '(?!'+$$[$0]+')'; 
break;
case 44: this.$ = $$[$0-1]+$$[$0]; 
break;
case 46: this.$ = '.'; 
break;
case 47: this.$ = '^'; 
break;
case 48: this.$ = '$'; 
break;
case 52: this.$ = yytext; 
break;
case 53: this.$ = yytext; 
break;
case 54: this.$ = yytext; 
break;
case 55: this.$ = yy.prepareString(yytext.substr(1, yytext.length-2)); 
break;
}
},
table: [{3:1,4:2,5:[2,7],10:3,11:[1,4],12:[1,5],14:[1,6],16:[1,7]},{1:[3]},{5:[1,8]},{4:9,5:[2,7],10:3,11:[1,4],12:[1,5],14:[1,6],16:[1,7]},{4:10,5:[2,7],10:3,11:[1,4],12:[1,5],14:[1,6],16:[1,7]},{5:[2,33],11:[2,33],12:[2,33],13:11,14:[2,33],16:[2,33],31:12,32:[2,33],33:13,34:14,35:[1,15],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{15:31,18:[1,32]},{17:33,18:[1,34]},{6:35,11:[2,26],19:36,20:37,22:[2,26],26:[1,38],32:[2,26],35:[2,26],37:[2,26],40:[2,26],41:[2,26],45:[2,26],46:[2,26],47:[2,26],50:[2,26],51:[2,26],52:[2,26],54:[2,26],55:[2,26]},{5:[2,5]},{5:[2,6]},{5:[2,8],11:[2,8],12:[2,8],14:[2,8],16:[2,8]},{5:[2,29],11:[2,29],12:[2,29],14:[2,29],16:[2,29],22:[2,29],32:[1,39]},{5:[2,32],11:[2,32],12:[2,32],14:[2,32],16:[2,32],22:[2,32],32:[2,32],34:40,35:[1,15],36:[2,32],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{5:[2,35],11:[2,35],12:[2,35],14:[2,35],16:[2,35],22:[2,35],29:[1,42],32:[2,35],35:[2,35],36:[2,35],37:[2,35],38:[1,41],39:[1,43],40:[2,35],41:[2,35],43:44,45:[2,35],46:[2,35],47:[2,35],50:[2,35],51:[2,35],52:[2,35],53:[1,45],54:[2,35],55:[2,35]},{31:46,32:[2,33],33:13,34:14,35:[1,15],36:[2,33],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{31:47,32:[2,33],33:13,34:14,35:[1,15],36:[2,33],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{34:48,35:[1,15],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{34:49,35:[1,15],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{5:[2,43],11:[2,43],12:[2,43],14:[2,43],16:[2,43],22:[2,43],29:[2,43],32:[2,43],35:[2,43],36:[2,43],37:[2,43],38:[2,43],39:[2,43],40:[2,43],41:[2,43],45:[2,43],46:[2,43],47:[2,43],50:[2,43],51:[2,43],52:[2,43],53:[2,43],54:[2,43],55:[2,43]},{5:[2,45],11:[2,45],12:[2,45],14:[2,45],16:[2,45],22:[2,45],29:[2,45],32:[2,45],35:[2,45],36:[2,45],37:[2,45],38:[2,45],39:[2,45],40:[2,45],41:[2,45],45:[2,45],46:[2,45],47:[2,45],50:[2,45],51:[2,45],52:[2,45],53:[2,45],54:[2,45],55:[2,45]},{5:[2,46],11:[2,46],12:[2,46],14:[2,46],16:[2,46],22:[2,46],29:[2,46],32:[2,46],35:[2,46],36:[2,46],37:[2,46],38:[2,46],39:[2,46],40:[2,46],41:[2,46],45:[2,46],46:[2,46],47:[2,46],50:[2,46],51:[2,46],52:[2,46],53:[2,46],54:[2,46],55:[2,46]},{5:[2,47],11:[2,47],12:[2,47],14:[2,47],16:[2,47],22:[2,47],29:[2,47],32:[2,47],35:[2,47],36:[2,47],37:[2,47],38:[2,47],39:[2,47],40:[2,47],41:[2,47],45:[2,47],46:[2,47],47:[2,47],50:[2,47],51:[2,47],52:[2,47],53:[2,47],54:[2,47],55:[2,47]},{5:[2,48],11:[2,48],12:[2,48],14:[2,48],16:[2,48],22:[2,48],29:[2,48],32:[2,48],35:[2,48],36:[2,48],37:[2,48],38:[2,48],39:[2,48],40:[2,48],41:[2,48],45:[2,48],46:[2,48],47:[2,48],50:[2,48],51:[2,48],52:[2,48],53:[2,48],54:[2,48],55:[2,48]},{5:[2,49],11:[2,49],12:[2,49],14:[2,49],16:[2,49],22:[2,49],29:[2,49],32:[2,49],35:[2,49],36:[2,49],37:[2,49],38:[2,49],39:[2,49],40:[2,49],41:[2,49],45:[2,49],46:[2,49],47:[2,49],50:[2,49],51:[2,49],52:[2,49],53:[2,49],54:[2,49],55:[2,49]},{5:[2,50],11:[2,50],12:[2,50],14:[2,50],16:[2,50],22:[2,50],29:[2,50],32:[2,50],35:[2,50],36:[2,50],37:[2,50],38:[2,50],39:[2,50],40:[2,50],41:[2,50],45:[2,50],46:[2,50],47:[2,50],50:[2,50],51:[2,50],52:[2,50],53:[2,50],54:[2,50],55:[2,50]},{5:[2,51],11:[2,51],12:[2,51],14:[2,51],16:[2,51],22:[2,51],29:[2,51],32:[2,51],35:[2,51],36:[2,51],37:[2,51],38:[2,51],39:[2,51],40:[2,51],41:[2,51],45:[2,51],46:[2,51],47:[2,51],50:[2,51],51:[2,51],52:[2,51],53:[2,51],54:[2,51],55:[2,51]},{5:[2,52],11:[2,52],12:[2,52],14:[2,52],16:[2,52],22:[2,52],29:[2,52],32:[2,52],35:[2,52],36:[2,52],37:[2,52],38:[2,52],39:[2,52],40:[2,52],41:[2,52],45:[2,52],46:[2,52],47:[2,52],50:[2,52],51:[2,52],52:[2,52],53:[2,52],54:[2,52],55:[2,52]},{5:[2,55],11:[2,55],12:[2,55],14:[2,55],16:[2,55],22:[2,55],29:[2,55],32:[2,55],35:[2,55],36:[2,55],37:[2,55],38:[2,55],39:[2,55],40:[2,55],41:[2,55],45:[2,55],46:[2,55],47:[2,55],50:[2,55],51:[2,55],52:[2,55],53:[2,55],54:[2,55],55:[2,55]},{5:[2,56],11:[2,56],12:[2,56],14:[2,56],16:[2,56],22:[2,56],29:[2,56],32:[2,56],35:[2,56],36:[2,56],37:[2,56],38:[2,56],39:[2,56],40:[2,56],41:[2,56],45:[2,56],46:[2,56],47:[2,56],50:[2,56],51:[2,56],52:[2,56],53:[2,56],54:[2,56],55:[2,56]},{5:[2,53],11:[2,53],12:[2,53],14:[2,53],16:[2,53],22:[2,53],29:[2,53],32:[2,53],35:[2,53],36:[2,53],37:[2,53],38:[2,53],39:[2,53],40:[2,53],41:[2,53],45:[2,53],46:[2,53],47:[2,53],50:[2,53],51:[2,53],52:[2,53],53:[2,53],54:[2,53],55:[2,53]},{5:[2,9],11:[2,9],12:[2,9],14:[2,9],16:[2,9],18:[1,50]},{5:[2,11],11:[2,11],12:[2,11],14:[2,11],16:[2,11],18:[2,11]},{5:[2,10],11:[2,10],12:[2,10],14:[2,10],16:[2,10],18:[1,51]},{5:[2,13],11:[2,13],12:[2,13],14:[2,13],16:[2,13],18:[2,13]},{5:[1,55],7:52,8:[1,54],11:[2,26],19:53,20:37,22:[2,26],26:[1,38],32:[2,26],35:[2,26],37:[2,26],40:[2,26],41:[2,26],45:[2,26],46:[2,26],47:[2,26],50:[2,26],51:[2,26],52:[2,26],54:[2,26],55:[2,26]},{5:[2,16],8:[2,16],11:[2,16],22:[2,16],26:[2,16],32:[2,16],35:[2,16],37:[2,16],40:[2,16],41:[2,16],45:[2,16],46:[2,16],47:[2,16],50:[2,16],51:[2,16],52:[2,16],54:[2,16],55:[2,16]},{11:[2,33],13:56,22:[2,33],31:12,32:[2,33],33:13,34:14,35:[1,15],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{12:[1,59],27:57,29:[1,58]},{5:[2,31],11:[2,31],12:[2,31],14:[2,31],16:[2,31],22:[2,31],32:[2,31],33:60,34:14,35:[1,15],36:[2,31],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{5:[2,34],11:[2,34],12:[2,34],14:[2,34],16:[2,34],22:[2,34],29:[1,42],32:[2,34],35:[2,34],36:[2,34],37:[2,34],38:[1,41],39:[1,43],40:[2,34],41:[2,34],43:44,45:[2,34],46:[2,34],47:[2,34],50:[2,34],51:[2,34],52:[2,34],53:[1,45],54:[2,34],55:[2,34]},{5:[2,38],11:[2,38],12:[2,38],14:[2,38],16:[2,38],22:[2,38],29:[2,38],32:[2,38],35:[2,38],36:[2,38],37:[2,38],38:[2,38],39:[2,38],40:[2,38],41:[2,38],45:[2,38],46:[2,38],47:[2,38],50:[2,38],51:[2,38],52:[2,38],53:[2,38],54:[2,38],55:[2,38]},{5:[2,39],11:[2,39],12:[2,39],14:[2,39],16:[2,39],22:[2,39],29:[2,39],32:[2,39],35:[2,39],36:[2,39],37:[2,39],38:[2,39],39:[2,39],40:[2,39],41:[2,39],45:[2,39],46:[2,39],47:[2,39],50:[2,39],51:[2,39],52:[2,39],53:[2,39],54:[2,39],55:[2,39]},{5:[2,40],11:[2,40],12:[2,40],14:[2,40],16:[2,40],22:[2,40],29:[2,40],32:[2,40],35:[2,40],36:[2,40],37:[2,40],38:[2,40],39:[2,40],40:[2,40],41:[2,40],45:[2,40],46:[2,40],47:[2,40],50:[2,40],51:[2,40],52:[2,40],53:[2,40],54:[2,40],55:[2,40]},{5:[2,44],11:[2,44],12:[2,44],14:[2,44],16:[2,44],22:[2,44],29:[2,44],32:[2,44],35:[2,44],36:[2,44],37:[2,44],38:[2,44],39:[2,44],40:[2,44],41:[2,44],45:[2,44],46:[2,44],47:[2,44],50:[2,44],51:[2,44],52:[2,44],53:[2,44],54:[2,44],55:[2,44]},{5:[2,54],11:[2,54],12:[2,54],14:[2,54],16:[2,54],22:[2,54],29:[2,54],32:[2,54],35:[2,54],36:[2,54],37:[2,54],38:[2,54],39:[2,54],40:[2,54],41:[2,54],45:[2,54],46:[2,54],47:[2,54],50:[2,54],51:[2,54],52:[2,54],53:[2,54],54:[2,54],55:[2,54]},{32:[1,39],36:[1,61]},{32:[1,39],36:[1,62]},{5:[2,41],11:[2,41],12:[2,41],14:[2,41],16:[2,41],22:[2,41],29:[1,42],32:[2,41],35:[2,41],36:[2,41],37:[2,41],38:[1,41],39:[1,43],40:[2,41],41:[2,41],43:44,45:[2,41],46:[2,41],47:[2,41],50:[2,41],51:[2,41],52:[2,41],53:[1,45],54:[2,41],55:[2,41]},{5:[2,42],11:[2,42],12:[2,42],14:[2,42],16:[2,42],22:[2,42],29:[1,42],32:[2,42],35:[2,42],36:[2,42],37:[2,42],38:[1,41],39:[1,43],40:[2,42],41:[2,42],43:44,45:[2,42],46:[2,42],47:[2,42],50:[2,42],51:[2,42],52:[2,42],53:[1,45],54:[2,42],55:[2,42]},{5:[2,12],11:[2,12],12:[2,12],14:[2,12],16:[2,12],18:[2,12]},{5:[2,14],11:[2,14],12:[2,14],14:[2,14],16:[2,14],18:[2,14]},{1:[2,1]},{5:[2,15],8:[2,15],11:[2,15],22:[2,15],26:[2,15],32:[2,15],35:[2,15],37:[2,15],40:[2,15],41:[2,15],45:[2,15],46:[2,15],47:[2,15],50:[2,15],51:[2,15],52:[2,15],54:[2,15],55:[2,15]},{1:[2,2]},{8:[1,63],9:[1,64]},{11:[1,67],21:65,22:[1,66]},{28:[1,68],30:[1,69]},{28:[1,70]},{28:[2,27],30:[2,27]},{5:[2,30],11:[2,30],12:[2,30],14:[2,30],16:[2,30],22:[2,30],32:[2,30],34:40,35:[1,15],36:[2,30],37:[1,16],40:[1,17],41:[1,18],42:19,44:20,45:[1,21],46:[1,22],47:[1,23],48:24,49:25,50:[1,26],51:[1,27],52:[1,30],54:[1,28],55:[1,29]},{5:[2,36],11:[2,36],12:[2,36],14:[2,36],16:[2,36],22:[2,36],29:[2,36],32:[2,36],35:[2,36],36:[2,36],37:[2,36],38:[2,36],39:[2,36],40:[2,36],41:[2,36],45:[2,36],46:[2,36],47:[2,36],50:[2,36],51:[2,36],52:[2,36],53:[2,36],54:[2,36],55:[2,36]},{5:[2,37],11:[2,37],12:[2,37],14:[2,37],16:[2,37],22:[2,37],29:[2,37],32:[2,37],35:[2,37],36:[2,37],37:[2,37],38:[2,37],39:[2,37],40:[2,37],41:[2,37],45:[2,37],46:[2,37],47:[2,37],50:[2,37],51:[2,37],52:[2,37],53:[2,37],54:[2,37],55:[2,37]},{1:[2,3]},{8:[1,71]},{5:[2,17],8:[2,17],11:[2,17],22:[2,17],26:[2,17],32:[2,17],35:[2,17],37:[2,17],40:[2,17],41:[2,17],45:[2,17],46:[2,17],47:[2,17],50:[2,17],51:[2,17],52:[2,17],54:[2,17],55:[2,17]},{22:[2,20],23:72,24:[2,20],25:[1,73]},{5:[2,19],8:[2,19],11:[2,19],22:[2,19],26:[2,19],32:[2,19],35:[2,19],37:[2,19],40:[2,19],41:[2,19],45:[2,19],46:[2,19],47:[2,19],50:[2,19],51:[2,19],52:[2,19],54:[2,19],55:[2,19]},{11:[2,24],22:[2,24],32:[2,24],35:[2,24],37:[2,24],40:[2,24],41:[2,24],45:[2,24],46:[2,24],47:[2,24],50:[2,24],51:[2,24],52:[2,24],54:[2,24],55:[2,24]},{12:[1,74]},{11:[2,25],22:[2,25],32:[2,25],35:[2,25],37:[2,25],40:[2,25],41:[2,25],45:[2,25],46:[2,25],47:[2,25],50:[2,25],51:[2,25],52:[2,25],54:[2,25],55:[2,25]},{1:[2,4]},{22:[1,76],24:[1,75]},{22:[2,21],24:[2,21]},{28:[2,28],30:[2,28]},{5:[2,18],8:[2,18],11:[2,18],22:[2,18],26:[2,18],32:[2,18],35:[2,18],37:[2,18],40:[2,18],41:[2,18],45:[2,18],46:[2,18],47:[2,18],50:[2,18],51:[2,18],52:[2,18],54:[2,18],55:[2,18]},{22:[2,20],23:77,24:[2,20],25:[1,73]},{22:[1,76],24:[1,78]},{22:[2,23],24:[2,23],25:[1,79]},{22:[2,22],24:[2,22]}],
defaultActions: {9:[2,5],10:[2,6],52:[2,1],54:[2,2],63:[2,3],71:[2,4]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
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
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
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
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
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
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
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
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
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
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
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
case 0:return 25
break;
case 1:yy.depth++; return 22
break;
case 2:yy.depth == 0 ? this.begin('trail') : yy.depth--; return 24
break;
case 3:return 12
break;
case 4:this.popState(); return 28
break;
case 5:return 30
break;
case 6:return 29
break;
case 7:/* */
break;
case 8:this.begin('indented')
break;
case 9:this.begin('code'); return 5
break;
case 10:return 55
break;
case 11:yy.options[yy_.yytext] = true
break;
case 12:this.begin('INITIAL')
break;
case 13:this.begin('INITIAL')
break;
case 14:/* empty */
break;
case 15:return 18
break;
case 16:this.begin('INITIAL')
break;
case 17:this.begin('INITIAL')
break;
case 18:/* empty */
break;
case 19:this.begin('rules')
break;
case 20:yy.depth = 0; this.begin('action'); return 22
break;
case 21:this.begin('trail'); yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4);return 11
break;
case 22:yy_.yytext = yy_.yytext.substr(2, yy_.yytext.length-4); return 11
break;
case 23:this.begin('rules'); return 11
break;
case 24:/* ignore */
break;
case 25:/* ignore */
break;
case 26:/* */
break;
case 27:/* */
break;
case 28:return 12
break;
case 29:yy_.yytext = yy_.yytext.replace(/\\"/g,'"');return 54
break;
case 30:yy_.yytext = yy_.yytext.replace(/\\'/g,"'");return 54
break;
case 31:return 32
break;
case 32:return 51
break;
case 33:return 37
break;
case 34:return 37
break;
case 35:return 37
break;
case 36:return 35
break;
case 37:return 36
break;
case 38:return 38
break;
case 39:return 29
break;
case 40:return 39
break;
case 41:return 46
break;
case 42:return 30
break;
case 43:return 47
break;
case 44:this.begin('conditions'); return 26
break;
case 45:return 41
break;
case 46:return 40
break;
case 47:return 52
break;
case 48:yy_.yytext = yy_.yytext.replace(/^\\/g,''); return 52
break;
case 49:return 47
break;
case 50:return 45
break;
case 51:yy.options = {}; this.begin('options')
break;
case 52:this.begin('start_condition');return 14
break;
case 53:this.begin('start_condition');return 16
break;
case 54:this.begin('rules'); return 5
break;
case 55:return 53
break;
case 56:return 50
break;
case 57:return 22
break;
case 58:return 24
break;
case 59:/* ignore bad characters */
break;
case 60:return 8
break;
case 61:return 9
break;
}
};
lexer.rules = [/^(?:[^{}]+)/,/^(?:\{)/,/^(?:\})/,/^(?:([a-zA-Z_][a-zA-Z0-9_-]*))/,/^(?:>)/,/^(?:,)/,/^(?:\*)/,/^(?:\n+)/,/^(?:\s+)/,/^(?:%%)/,/^(?:[a-zA-Z0-9_]+)/,/^(?:([a-zA-Z_][a-zA-Z0-9_-]*))/,/^(?:\n+)/,/^(?:\s+\n+)/,/^(?:\s+)/,/^(?:([a-zA-Z_][a-zA-Z0-9_-]*))/,/^(?:\n+)/,/^(?:\s+\n+)/,/^(?:\s+)/,/^(?:.*\n+)/,/^(?:\{)/,/^(?:%\{(.|\n)*?%\})/,/^(?:%\{(.|\n)*?%\})/,/^(?:.+)/,/^(?:\/\*(.|\n|\r)*?\*\/)/,/^(?:\/\/.*)/,/^(?:\n+)/,/^(?:\s+)/,/^(?:([a-zA-Z_][a-zA-Z0-9_-]*))/,/^(?:"(\\\\|\\"|[^"])*")/,/^(?:'(\\\\|\\'|[^'])*')/,/^(?:\|)/,/^(?:\[(\\\\|\\\]|[^\]])*\])/,/^(?:\(\?:)/,/^(?:\(\?=)/,/^(?:\(\?!)/,/^(?:\()/,/^(?:\))/,/^(?:\+)/,/^(?:\*)/,/^(?:\?)/,/^(?:\^)/,/^(?:,)/,/^(?:<<EOF>>)/,/^(?:<)/,/^(?:\/!)/,/^(?:\/)/,/^(?:\\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}))/,/^(?:\\.)/,/^(?:\$)/,/^(?:\.)/,/^(?:%options\b)/,/^(?:%s\b)/,/^(?:%x\b)/,/^(?:%%)/,/^(?:\{\d+(,\s?\d+|,)?\})/,/^(?:\{([a-zA-Z_][a-zA-Z0-9_-]*)\})/,/^(?:\{)/,/^(?:\})/,/^(?:.)/,/^(?:$)/,/^(?:(.|\n)+)/];
lexer.conditions = {"code":{"rules":[60,61],"inclusive":false},"start_condition":{"rules":[15,16,17,18,60],"inclusive":false},"options":{"rules":[11,12,13,14,60],"inclusive":false},"conditions":{"rules":[3,4,5,6,60],"inclusive":false},"action":{"rules":[0,1,2,60],"inclusive":false},"indented":{"rules":[20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60],"inclusive":true},"trail":{"rules":[19,22,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60],"inclusive":true},"rules":{"rules":[7,8,9,10,22,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60],"inclusive":true},"INITIAL":{"rules":[22,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60],"inclusive":true}};


;
return lexer;})()
parser.lexer = lexer;function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();
if (typeof require !== 'undefined' && typeof exports !== 'undefined') {
exports.parser = jisonlex;
exports.Parser = jisonlex.Parser;
exports.parse = function () { return jisonlex.parse.apply(jisonlex, arguments); }
exports.main = function commonjsMain(args) {
    if (!args[1])
        throw new Error('Usage: '+args[0]+' FILE');
    var source, cwd;
    if (typeof process !== 'undefined') {
        source = require('fs').readFileSync(require('path').resolve(args[1]), "utf8");
    } else {
        source = require("file").path(require("file").cwd()).join(args[1]).read({charset: "utf-8"});
    }
    return exports.parser.parse(source);
}
if (typeof module !== 'undefined' && require.main === module) {
  exports.main(typeof process !== 'undefined' ? process.argv.slice(1) : require("system").args);
}
}