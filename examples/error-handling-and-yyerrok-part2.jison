/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Continued from the error-handling-and-yyerrok-part1.jison example:
 */


/*
 * A simple grammar without yyerrok
 * -----------------------------------------
 *
 * Same as the grammar in part1 but without the yyerrok macro.
 *
 * Compare the output with the output of the part1 grammar.
 *
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





%token YY ZZ

%options debug=0
         output-debug-tables=0
         default-action-mode=none,none


%%

slist : slist stmt ';' { console.log("** slist stmt"); }
      | stmt ';'       { console.log("** stmt"); }
      | error ';'      { console.log("** ERROR!!!"); }
      ;

stmt  : ZZ stmt
      | ZZ
      ;

%%


/*
 *
 * A simple grammar with and without yyerrok
 * -----------------------------------------
 *
 * What follows is a side by side comparison (using UNIX sdiff) of the above code run
 * on this input:
 *
 *
 *      zz ;
 *      yy ;
 *      yy ;
 *      yy ;
 *      yy ;
 *      yy ;
 *      yy ;
 *
 * The results on the left are with yyerrok and the results on the right are without.
 * Since the yyerrok is saying we know when we are at a semicolon we are in sync the extra
 * errors are in that sense "correct". The lack of errors on the right are because
 * the 3 token count for error reporting restarts with each error processed.
 *
 * Notice the same number of errors are processed on both sides.
 *
 * Starting parse                                                          Starting parse
 * Entering state 0                                                        Entering state 0
 * Reading a token: Next token is 258 (ZZ)                                 Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2                               Shifting token 258 (ZZ), Entering state 2
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Reducing via rule 5 (line 34), ZZ  -> stmt                              Reducing via rule 5 (line 34), ZZ  -> stmt
 * state stack now 0                                                       state stack now 0
 * Entering state 4                                                        Entering state 4
 * Next token is 59 (';')                                                  Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 8                               Shifting token 59 (';'), Entering state 8
 * Reducing via rule 2 (line 29), stmt ';'  -> slist                       Reducing via rule 2 (line 29), stmt ';'  -> slist
 * stmt                                                                    stmt
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy          ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5                               Shifting token 59 (';'), Entering state 5
 * Reducing via rule 3 (line 30), error ';'  -> slist                      Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!                                                                ERROR!!!
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy       <
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5                               Shifting token 59 (';'), Entering state 5
 * Reducing via rule 3 (line 30), error ';'  -> slist                      Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!                                                                ERROR!!!
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy       <
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5                               Shifting token 59 (';'), Entering state 5
 * Reducing via rule 3 (line 30), error ';'  -> slist                      Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!                                                                ERROR!!!
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy       <
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5                               Shifting token 59 (';'), Entering state 5
 * Reducing via rule 3 (line 30), error ';'  -> slist                      Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!                                                                ERROR!!!
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy       <
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5                               Shifting token 59 (';'), Entering state 5
 * Reducing via rule 3 (line 30), error ';'  -> slist                      Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!                                                                ERROR!!!
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Next token is 257 (YY)                                 Reading a token: Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `$' or `ZZ'.  I got: yy       <
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * Discarding token 257 (YY).                                              Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')                                 Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5                               Shifting token 59 (';'), Entering state 5
 * Reducing via rule 3 (line 30), error ';'  -> slist                      Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!                                                                ERROR!!!
 * state stack now 0                                                       state stack now 0
 * Entering state 3                                                        Entering state 3
 * Reading a token: Now at end of input.                                   Reading a token: Now at end of input.
 * Shifting token 0 ($), Entering state 10                                 Shifting token 0 ($), Entering state 10
 * Now at end of input.                                                    Now at end of input.
 *
 *
 * Notice that the only difference is the presence of reported errors.
 *
 */


/*
 * Continued in error-handling-and-yyerrok-part3.jison ...
 */

