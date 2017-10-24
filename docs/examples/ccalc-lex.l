/*! @file lex.l
 * @brief Lexical Analysis
 *********************************************************************
 * a simple calculator with variables
 * 
 * sample-files for a artikel in developerworks.ibm.com
 * Author: Christian Hagen, chagen@de.ibm.com
 * 
 * @par lex.l & lex.c
 * input for flex the lexical analysis generator
 * 
 *********************************************************************
 */

// %option noyywrap

%{
%}

/*--------------------------------------------------------------------
 * 
 * flex definitions
 * 
 *------------------------------------------------------------------*/
DIGIT    [0-9]
ID       [_a-zA-Z][_a-zA-Z0-9]*

%%

[ \t\r\n]+  {
    /* eat up whitespace */
    BeginToken(yytext); 
    }
{DIGIT}+  {
    BeginToken(yytext); 
    yylval.value = atof(yytext);
    return VALUE;
    }
{DIGIT}+"."{DIGIT}*        {
    BeginToken(yytext);
    yylval.value = atof(yytext);
    return VALUE;
    }
{DIGIT}+[eE]["+""-"]?{DIGIT}*        {
    BeginToken(yytext);
    yylval.value = atof(yytext);
    return VALUE;
    }
{DIGIT}+"."{DIGIT}*[eE]["+""-"]?{DIGIT}*        {
    BeginToken(yytext);
    yylval.value = atof(yytext);
    return VALUE;
    }
{ID}        {
    BeginToken(yytext);
    yylval.string = malloc(strlen(yytext)+1);
    strcpy(yylval.string, yytext);
    return IDENTIFIER;
    }
"+"       { BeginToken(yytext); return ADD; }
"-"       { BeginToken(yytext); return SUB; }
"*"       { BeginToken(yytext); return MULT; }
"/"       { BeginToken(yytext); return DIV; }
"("       { BeginToken(yytext); return LBRACE; }
")"       { BeginToken(yytext); return RBRACE; }
";"       { BeginToken(yytext); return SEMICOLON; }
"="       { BeginToken(yytext); return ASSIGN; }

.         {
    BeginToken(yytext);
    return yytext[0];
    }
%%

/*--------------------------------------------------------------------
 * lex.l
 *------------------------------------------------------------------*/
