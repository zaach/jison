/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Continued from the error-handling-and-yyerrok-part1.jison example:
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
 * Infinite Loop Example
 * ---------------------
 *
 * In this case we have an infinite loop because yyerrok will cause the Bison error
 * scanning to prematurely leave the error processing loop.
 *
 */


%token YY ZZ

%options debug=0
         output-debug-tables=0
         default-action-mode=none,none


%%

slist : slist stmt ';' { console.log("** slist stmt"); }
      | stmt ';'       { console.log("** stmt"); }
      ;

stmt  : ZZ
      | error          {
                         if (!yy.error_count) { yy.error_count = 1; } else { yy.error_count++; }

                         console.log("** yyerrok #" + yy.error_count);
                         yyerrok;            // <-- abort error process when error found

                         if (yy.error_count > 42) { throw new Error('kaboom! loop!'); }
                       }
      ;

%%


/*
 *
 * The input is simply
 *
 *      yy
 *
 * On the left with the call to yyerrok we find an infinite loop! On the right without
 * yyerrok we find the input token is discarded and the parser moves on to the next
 * statement. However, the error count is set and an error immediately following will be
 * missed as in
 *
 *      yy ; yy ;
 *
 * I find the response on the left to look very much like a bug to me. It should never
 * let me build an infinite loop in the parser.
 *
 *
 * Starting parse                                                          Starting parse
 * Entering state 0                                                        Entering state 0
 * Reading a token: yy                                                     Reading a token: yy
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `error' or `ZZ'.  I got: yy      ERROR lineno(1):parse error, expecting `error' or `ZZ'.  I got: y
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reducing via rule 4 (line 33), error  -> stmt                           Reducing via rule 4 (line 33), error  -> stmt
 * state stack now 0                                                       state stack now 0
 * Entering state 4                                                        Entering state 4
 * Next token is 257 (YY)                                                  Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `';''.  I got: yy             |  Discarding token 257 (YY).
 * Error: state stack now 0                                                Error: state stack now 0
 * Shifting error token, Entering state 1                                  Shifting error token, Entering state 1
 * Reducing via rule 4 (line 33), error  -> stmt                           Reducing via rule 4 (line 33), error  -> stmt
 * state stack now 0                                                       state stack now 0
 * Entering state 4                                                        Entering state 4
 * Next token is 257 (YY)                                               <
 * ERROR lineno(1):parse error, expecting `';''.  I got: yy             <
 * Error: state stack now 0                                             <
 * Shifting error token, Entering state 1                               <
 * Reducing via rule 4 (line 33), error  -> stmt                        <
 * state stack now 0                                                    <
 * Entering state 4                                                     <
 * Next token is 257 (YY)                                               <
 * ERROR lineno(1):parse error, expecting `';''.  I got: yy             <
 * Error: state stack now 0                                             <
 * Shifting error token, Entering state 1                               <
 * Reducing via rule 4 (line 33), error  -> stmt                        <
 * state stack now 0                                                    <
 * Entering state 4                                                     <
 * Next token is 257 (YY)                                               <
 * ERROR lineno(1):parse error, expecting `';''.  I got: yy             <
 * Error: state stack now 0                                             <
 * Shifting error token, Entering state 1                               <
 * Reducing via rule 4 (line 33), error  -> stmt                        <
 * state stack now 0                                                    <
 *      .                                                               <
 *      .                                                               <
 *      .                                                               <
 *                                                                      <
 *   forever!                                                           <
 *
 */


/*
 * Continued in error-handling-and-yyerrok-looping2.jison ...
 */

