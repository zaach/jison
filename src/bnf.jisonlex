%x action code
%s bnf ebnf

%%

<bnf,ebnf>"%%"           this.begin('code');return '%%';

<ebnf>"("                 return '('
<ebnf>")"                 return ')'
<ebnf>"*"                 return '*'
<ebnf>"?"                 return '?'
<ebnf>"+"                 return '+'

\s+                     /* skip whitespace */
"//".*                  /* skip comment */
"/*"[^*]*"*"            return yy.lexComment(this);
[a-zA-Z][a-zA-Z0-9_-]*  return 'ID';
'"'[^"]+'"'             yytext = yytext.substr(1, yyleng-2); return 'STRING';
"'"[^']+"'"             yytext = yytext.substr(1, yyleng-2); return 'STRING';
":"                     return ':';
";"                     return ';';
"|"                     return '|';
"%%"                    this.begin(ebnf ? 'ebnf' : 'bnf');return '%%';
"%ebnf"                 if (!yy.options) yy.options = {}; ebnf = yy.options.ebnf = true;
"%prec"                 return 'PREC';
"%start"                return 'START';
"%left"                 return 'LEFT';
"%right"                return 'RIGHT';
"%nonassoc"             return 'NONASSOC';
"%lex"[\w\W]*?"/lex"    return 'LEX_BLOCK';
"%"[a-zA-Z]+[^\n]*      /* ignore unrecognized decl */
"<"[a-zA-Z]*">"         /* ignore type */
"{{"[\w\W]*?"}}"        yytext = yytext.substr(2, yyleng-4); return 'ACTION';
"%{"(.|\n)*?"%}"        yytext = yytext.substr(2, yytext.length-4);return 'ACTION';
"{"                     yy.depth=0; this.begin('action'); return '{';
"->".*                  yytext = yytext.substr(2, yyleng-2); return 'ARROW_ACTION';
.                       /* ignore bad characters */
<*><<EOF>>              return 'EOF';

<action>[^{}]+          return 'ACTION_BODY';
<action>"{"             yy.depth++; return '{';
<action>"}"             yy.depth==0? this.begin(ebnf ? 'ebnf' : 'bnf') : yy.depth--; return '}';

<code>(.|\n)+           return 'CODE';

%%
