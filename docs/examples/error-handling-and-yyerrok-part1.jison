/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Using the Error Token in Bison
 * ------------------------------
 *
 * By: Robert Heckendorn -- Computer Science Department -- University of Idaho
 *
 * Here is various information on how Bison handles errors and how you can use
 * the error token to control how errors are processed.
 *
 *
 * The Error Token
 * ---------------
 *
 * When an error occurs a predefined token error (token number 256) is generated.
 * If your grammar handles the token error then you can program your grammar to have
 * error recovery. For example:
 *
 *
 *
 * stmts : //empty//
 *      | stmts '\n'
 *      | stmts exp '\n'
 *      | stmts error '\n'  <- error followed by a newline is a stmt
 *      ;
 *
 *
 * Error recovery is handled by messing with the state machine in order to keep it running.
 * Specifically, Bison handles errors by this process in this order:
 *
 * - Discard terminals and nonterminals plus state off the parse stack until it finds
 *   a place where the error token is allowed in the current state.
 *   The error token is shifted on.
 * - Discard input tokens until an acceptable input token is found based on the
 *   parse stack including the error token.
 * - To prevent cascades of errors only after 3 new tokens are read will the error
 *   messaging be turned back on. yyerrok statement turns on error messaging immediately
 *   indicating you have handled the error. In particular the tokens on input are
 *   not discarded (See infinite loop).
 *
 * Remember that Bison is an LALR parser so the lookahead token is not removed from
 * input until it is ready to be put on the stack or discarded by the error routine.
 * The lookahead token is in yychar. If you want to throw it away then you use
 * the yyclearin macro.
 *
 *
 * Examples of Bison Error Processing
 * ----------------------------------
 *
 * A simple grammar with resynchronizing token: semicolon
 *
 * Consider this grammar:
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
      | error ';'      { console.log("** ERROR!!!");  yyerrok; }
      ;

stmt  : ZZ stmt
      | ZZ
      ;

%%


/*
 * Which produces this state machine:
 *
 * Rules:
 *     0 $accept: slist $end
 *     1 slist: slist stmt ';'
 *     2      | stmt ';'
 *     3      | error ';'                  <---- this is the addition
 *     4 stmt: ZZ stmt
 *     5     | ZZ
 *
 * State Machine:
 * state 0
 *     0 $accept: . slist $end
 *
 *     error  shift, and go to state 1     <---- jump to new state
 *     ZZ     shift, and go to state 2
 *     slist  go to state 3
 *     stmt   go to state 4
 *
 * state 1
 *     3 slist: error . ';'                <---- new state to handle error
 *
 *     ';'  shift, and go to state 5
 *
 * state 2
 *     4 stmt: ZZ . stmt
 *     5     | ZZ .
 *
 *     ZZ  shift, and go to state 2
 *     $default  reduce using rule 5 (stmt)  <--- Note that invalid token will do a reduce
 *     stmt  go to state 6
 *
 * state 3
 *     0 $accept: slist . $end
 *     1 slist: slist . stmt ';'
 *
 *     $end  shift, and go to state 7
 *     ZZ    shift, and go to state 2
 *     stmt  go to state 8
 *
 * state 4
 *     2 slist: stmt . ';'
 *
 *     ';'  shift, and go to state 9
 *
 * state 5
 *     3 slist: error ';' .              <---- new state to handle error
 *
 *     $default  reduce using rule 3 (slist)
 *
 * state 6
 *     4 stmt: ZZ stmt .
 *
 *     $default  reduce using rule 4 (stmt)
 *
 * state 7
 *     0 $accept: slist $end .
 *
 *     $default  accept
 *
 * state 8
 *     1 slist: slist stmt . ';'
 *
 *     ';'  shift, and go to state 10
 *
 * state 9
 *     2 slist: stmt ';' .
 *
 *     $default  reduce using rule 2 (slist)
 *
 * state 10
 *     1 slist: slist stmt ';' .
 *
 *     $default  reduce using rule 1 (slist)
 *
 *
 * Consider the input
 *
 *      zz zz yy zz zz ;
 *
 * which has an error in the middle. We expect Bison to shift and reduce the initial zz's
 * and then arrive and the bad token yy. Then put on an error token until we get to the ;.
 * It effectively does that.
 *
 * Note: each version of Bison seems to generate different debug output but the actions
 * are the same.
 *
 * Starting parse
 * Entering state 0
 * Reading a token: zz zz yy zz zz ;
 * Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2
 * state stack now 0 2
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2
 * state stack now 0 2 2
 * Reading a token: Next token is 257 (YY)
 * Reducing via rule 5 (line 34), ZZ  -> stmt  <-- use default on invalid token
 * state stack now 0 2
 * Entering state 6
 * state stack now 0 2 6
 * Reducing via rule 4 (line 33), ZZ stmt  -> stmt
 * state stack now 0
 * Entering state 4
 * state stack now 0 4
 * Next token is 257 (YY)
 * ERROR lineno(1):parse error, expecting `';''.  I got: yy
 * Error: state stack now 0                    <--- pop off until and error token on input works
 * Shifting error token, Entering state 1
 * state stack now 0 1
 * Next token is 257 (YY)
 * Discarding token 257 (YY).          <--- discard from input until putting a error will work
 * Error: state stack now 0
 * Shifting error token, Entering state 1
 * Error: state stack now 0 1
 * Reading a token: Next token is 258 (ZZ)  <--- doesn't accept "error ZZ"
 * Discarding token 258 (ZZ).
 * Error: state stack now 0
 * Shifting error token, Entering state 1
 * Error: state stack now 0 1
 * Reading a token: Next token is 258 (ZZ)  <--- doesn't accept "error ZZ"
 * Discarding token 258 (ZZ).
 * Error: state stack now 0
 * Shifting error token, Entering state 1
 * Error: state stack now 0 1
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 5 <---  state 1 + ';' works!
 * Reducing via rule 3 (line 30), error ';'  -> slist
 * ERROR!!!
 * state stack now 0
 * Entering state 3
 *
 *
 * Notice the matched production is the error production and the print statement is
 * executed giving the line "error".
 *
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
 * Continued in error-handling-and-yyerrok-part2.jison ...
 */

