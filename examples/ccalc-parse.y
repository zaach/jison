%{
/*! @file lex.l
 * @brief Lexical Analysis
 *********************************************************************
 * a simple calculator with variables
 *
 * sample-files for an article in developerworks.ibm.com
 * Author: Christian Hagen, chagen@de.ibm.com
 * 
 * @par parse.l & parse.c
 * grammar for the parser-generator bison
 * 
 *********************************************************************
 */

// #define YYERROR_VERBOSE 1
// #define YYDEBUG 1
// int yydebug=0;

/*--------------------------------------------------------------------
 * 
 * global variables
 * 
 *------------------------------------------------------------------*/
// static Variable *var;
%}

/*--------------------------------------------------------------------
 * 
 * definitions
 * 
 *------------------------------------------------------------------*/
/* generate include-file with symbols and types */
//%defines

/* a more advanced semantic type */
//%union {
//  double      value;
//  char        *string;
//}

/*--------------------------------------------------------------------
 *
 * terminal-symbols
 *
 *------------------------------------------------------------------*/
//%token <string>   IDENTIFIER
//%token <value>    VALUE
//%type <value>     expression

%token    IDENTIFIER
%token     VALUE

%token LBRACE
%token RBRACE
%token SEMICOLON
%token ASSIGN

/*
 * operator-precedence
 * top-0: -
 *     1: * /
 *     2: + -
 */
%left ADD SUB
%left MULT DIV
%left NEG

/*------------------------------------------------------------------------------
 *
 * start of grammar
 *
 *----------------------------------------------------------------------------*/
%start program

%%

/*------------------------------------------------------------------------------
 * 
 * rules
 * 
 *----------------------------------------------------------------------------*/
program
    : statement SEMICOLON program
    | statement SEMICOLON
    | statement error SEMICOLON program
      {
      yyerrok;
      }
    ;
statement
    : IDENTIFIER 
      { 
//        var = VarGet($1, &@1);
      }
      ASSIGN expression
      {
//        VarSetValue(var, $3);
      }
    | expression
    ;
expression
    : LBRACE expression RBRACE
      {
        $$ = $2;
      }
    | SUB expression %prec NEG
      {
        $$ = - $2;
      }
    | expression ADD expression
      {
        $$ = ReduceAdd($1, $3, &@3);
        if (  debug  )
          printf("reduce %lf + %lf => %lf\n", $1, $3, $$);
      }
    | expression SUB expression
      {
        $$ = ReduceSub($1, $3, &@3);
        if (  debug  )
          printf("reduce %lf - %lf => %lf\n", $1, $3, $$);
      }
    | expression MULT expression
      {
        $$ = ReduceMult($1, $3, &@3);
        if (  debug  )
          printf("reduce %lf * %lf => %lf\n", $1, $3, $$);
      }
    | expression DIV expression
      {
        $$ = ReduceDiv($1, $3, &@3);
        if (  debug  )
          printf("reduce %lf / %lf => %lf\n", $1, $3, $$);
      }
    | VALUE
      {
        $$ = $1;
      }
    | IDENTIFIER
      {
        $$ = VarGetValue($1, &@1);
        if (  debug  )
          printf("identifier %s => %lf\n", $1, $$);
      }
    ;
%%

/*------------------------------------------------------------------------------
 * 
 * functions
 * 
 *----------------------------------------------------------------------------*/
//extern
//void yyerror(char *s) {
// // simple error-message
// //  printf("Error '%s'\n", s);
// //  a more sophisticated error-function
//  PrintError(s);
//}

/*--------------------------------------------------------------------
 * parse.y
 *------------------------------------------------------------------*/
