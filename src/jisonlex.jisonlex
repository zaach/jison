%s indented trail
%%

<trail>.*\n+                    this.begin('INITIAL')
<indented>"{"[^}]*"}"           {this.begin('trail'); yytext = yytext.substr(1, yytext.length-2);return 'ACTION';}
"%{"(.|\n)*?"%}"                {this.begin('trail'); yytext = yytext.substr(2, yytext.length-4);return 'ACTION';}
<indented>.+                    this.begin('INITIAL'); return 'ACTION'

\n+                             this.begin('INITIAL')
\s+                             if (yy.ruleSection) this.begin('indented')
[a-zA-Z_][a-zA-Z0-9_-]*         return 'NAME'
\"("\\\\"|'\"'|[^"])*\"         yytext = yytext.replace(/\\"/g,'"');return 'STRING_LIT';
"'"("\\\\"|"\'"|[^'])*"'"       yytext = yytext.replace(/\\'/g,"'");return 'STRING_LIT';
"|"                             return '|'
"["("\]"|[^\]])*"]"             return 'ANY_GROUP_REGEX'
"(?:"                           return 'SPECIAL_GROUP'
"(?="                           return 'SPECIAL_GROUP'
"(?!"                           return 'SPECIAL_GROUP'
"("                             return '('
")"                             return ')'
"+"                             return '+'
"*"                             return '*'
"?"                             return '?'
"^"                             return '^'
","                             return ','
"<<EOF>>"                       return '$'
"<"                             return '<'
">"                             return '>'
"/!"                            return '/!'
"/"                             return '/'
"\\"([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|"c"[A-Z]|"x"[0-9A-F]{2}|"u"[a-fA-F0-9]{4}) return 'ESCAPE_CHAR'
"\\".                           yytext = yytext.replace(/^\\/g,''); return 'ESCAPE_CHAR'
"$"                             return '$'
"."                             return '.'
"%s"                            return 'START_INC'
"%x"                            return 'START_EXC'
"%%"                            yy.ruleSection = true; return '%%'
"{"\d+(","\s?\d+|",")?"}"       return 'RANGE_REGEX'
"{"                             return '{'
"}"                             return '}'
.                               /* ignore bad characters */
<*><<EOF>>                      return 'EOF'

%%

