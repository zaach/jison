%{
/*
 * scan.l
 *
 * lex input file for pascal scanner
 *
 * extensions: to ways to spell "external" and "->" ok for "^".
 */

var line_no = 1;

%}

A [aA]
B [bB]
C [cC]
D [dD]
E [eE]
F [fF]
G [gG]
H [hH]
I [iI]
J [jJ]
K [kK]
L [lL]
M [mM]
N [nN]
O [oO]
P [pP]
Q [qQ]
R [rR]
S [sS]
T [tT]
U [uU]
V [vV]
W [wW]
X [xX]
Y [yY]
Z [zZ]
NQUOTE [^']

%%

{A}{N}{D}                                return(AND);
{A}{R}{R}{A}{Y}                          return(ARRAY);
{C}{A}{S}{E}                             return(CASE);
{C}{O}{N}{S}{T}                          return(CONST);
{D}{I}{V}                                return(DIV);
{D}{O}                                   return(DO);
{D}{O}{W}{N}{T}{O}                       return(DOWNTO);
{E}{L}{S}{E}                             return(ELSE);
{E}{N}{D}                                return(END);
{E}{X}{T}{E}{R}{N}                       return(EXTERNAL);
{E}{X}{T}{E}{R}{N}{A}{L}                 return(EXTERNAL);
{F}{O}{R}                                return(FOR);
{F}{O}{R}{W}{A}{R}{D}                    return(FORWARD);
{F}{U}{N}{C}{T}{I}{O}{N}                 return(FUNCTION);
{G}{O}{T}{O}                             return(GOTO);
{I}{F}                                   return(IF);
{I}{N}                                   return(IN);
{L}{A}{B}{E}{L}                          return(LABEL);
{M}{O}{D}                                return(MOD);
{N}{I}{L}                                return(NIL);
{N}{O}{T}                                return(NOT);
{O}{F}                                   return(OF);
{O}{R}                                   return(OR);
{O}{T}{H}{E}{R}{W}{I}{S}{E}              return(OTHERWISE);
{P}{A}{C}{K}{E}{D}                       return(PACKED);
{B}{E}{G}{I}{N}                          return(PBEGIN);
{F}{I}{L}{E}                             return(PFILE);
{P}{R}{O}{C}{E}{D}{U}{R}{E}              return(PROCEDURE);
{P}{R}{O}{G}{R}{A}{M}                    return(PROGRAM);
{R}{E}{C}{O}{R}{D}                       return(RECORD);
{R}{E}{P}{E}{A}{T}                       return(REPEAT);
{S}{E}{T}                                return(SET);
{T}{H}{E}{N}                             return(THEN);
{T}{O}                                   return(TO);
{T}{Y}{P}{E}                             return(TYPE);
{U}{N}{T}{I}{L}                          return(UNTIL);
{V}{A}{R}                                return(VAR);
{W}{H}{I}{L}{E}                          return(WHILE);
{W}{I}{T}{H}                             return(WITH);
[a-zA-Z]([a-zA-Z0-9])+                   return(IDENTIFIER);

":="                                     return(ASSIGNMENT);
'({NQUOTE}|'')+'                         return(CHARACTER_STRING);
":"                                      return(COLON);
","                                      return(COMMA);
[0-9]+                                   return(DIGSEQ);
"."                                      return(DOT);
".."                                     return(DOTDOT);
"="                                      return(EQUAL);
">="                                     return(GE);
">"                                      return(GT);
"["                                      return(LBRAC);
"<="                                     return(LE);
"("                                      return(LPAREN);
"<"                                      return(LT);
"-"                                      return(MINUS);
"<>"                                     return(NOTEQUAL);
"+"                                      return(PLUS);
"]"                                      return(RBRAC);
[0-9]+"."[0-9]+                          return(REALNUMBER);
")"                                      return(RPAREN);
";"                                      return(SEMICOLON);
"/"                                      return(SLASH);
"*"                                      return(STAR);
"**"                                     return(STARSTAR);
"->"                                     return(UPARROW);
"^"                                      return(UPARROW);

"(*"|"{"                              { 
     var c;
     while ((c = input()))
     {
      if (c == '}')
       break;
      else if (c == '*')
      {
       if ((c = input()) == ')')
        break;
       else
        unput (c);
      }
      else if (c == '\n')
       line_no++;
      else if (c == 0)
       commenteof();
     }
    }

[ \t\f]                                   ;

\n                                        line_no++;

.    { 
    fprintf (stderr, "'%c' (0%o): illegal charcter at line %d\n", yytext[0], yytext[0], line_no);
    }

%%

function commenteof() {
 fprintf (stderr, "unexpected EOF inside comment at line %d\n", line_no);
 exit(1);
}

function yywrap() {
 return (1);
}


