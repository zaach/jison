/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Continued from the error-handling-and-yyerrok-part3.jison example:
 */





%lex
%%

yy          return 'YY';
zz          return 'ZZ';
";"         return ';';
"("         return '(';
")"         return ')';
[\r\n\s]+   // ignore
<<EOF>>     return 'EOF';

/lex





/*
 * Resetting on a nonsynchronizing token
 * -------------------------------------
 *
 * In this simple grammar we deal with a optional list of elements and resync when we see
 * the next reliable element in the list (in this case ZZ.
 *
 */


%token YY ZZ

%options debug=0
         output-debug-tables=0
         default-action-mode=none,none


%%

seq   : %epsilon
      | seq ZZ        { yyerrok; }
      | seq error
      ;

%%


/*
 * The left code produces both errors on an input of
 *
 *      yy zz yy
 *
 * while the right code syncs but does clear the error count.
 *
 *
 * Starting parse                                                          Starting parse
 * Entering state 0                                                        Entering state 0
 * Reducing via rule 1 (line 28),  -> seq                                  Reducing via rule 1 (line 28),  -> seq
 * state stack now 0                                                       state stack now 0
 * Entering state 1                                                        Entering state 1
 * Reading a token: yy zz yy                                               Reading a token: yy zz yy
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `error' or `ZZ'.  I       ERROR lineno(1):parse error, expecting `$' or `error' or `ZZ'.  I
 * Shifting error token, Entering state 2                                  Shifting error token, Entering state 2
 * Reducing via rule 3 (line 30), seq error  -> seq                        Reducing via rule 3 (line 30), seq error  -> seq
 * state stack now 0                                                       state stack now 0
 * Entering state 1                                                        Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Shifting error token, Entering state 2                                  Shifting error token, Entering state 2
 * Reducing via rule 3 (line 30), seq error  -> seq                        Reducing via rule 3 (line 30), seq error  -> seq
 * state stack now 0                                                       state stack now 0
 * Entering state 1                                                        Entering state 1
 * Reading a token: Next token is 258 (ZZ)                                 Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 3                               Shifting token 258 (ZZ), Entering state 3
 * Reducing via rule 2 (line 29), seq ZZ  -> seq                           Reducing via rule 2 (line 29), seq ZZ  -> seq
 * state stack now 0                                                       state stack now 0
 * Entering state 1                                                        Entering state 1
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `error' or `ZZ'.  I    <
 * Shifting error token, Entering state 2                                  Shifting error token, Entering state 2
 * Reducing via rule 3 (line 30), seq error  -> seq                        Reducing via rule 3 (line 30), seq error  -> seq
 * state stack now 0                                                       state stack now 0
 * Entering state 1                                                        Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Shifting error token, Entering state 2                                  Shifting error token, Entering state 2
 * Reducing via rule 3 (line 30), seq error  -> seq                        Reducing via rule 3 (line 30), seq error  -> seq
 * state stack now 0                                                       state stack now 0
 * Entering state 1                                                        Entering state 1
 *
 */


/*
 * Continued in error-handling-and-yyerrok-part4b.jison ...
 */

