/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Continued from the error-handling-and-yyerrok-part4b.jison example:
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
 * Fixation on a lower level error
 * -------------------------------
 *
 * In this experiment we try to correct the problems we have seen where an error is
 * not trapped or where we wait for a closing parenthesis. We are only partially successful.
 * Here is the code:
 *
 */


%token YY ZZ

%options debug=0
         output-debug-tables=0
         default-action-mode=none,none


%%

slist : slist stmt ';' { console.log("** slist stmt"); }
      | stmt ';'       { console.log("** stmt"); }
      | error ';'      { console.log("** error stmt"); }
      ;

stmt  : ZZ
      | '(' stmt ')'
      | '(' error ')'  { console.log("** nested error"); }
      ;

%%


/*
 * The input is:
 *
 *      zz ;
 *      ( zz ;
 *      zz ;
 *      ) ;
 *      zz );
 *      zz ;
 *
 * In the output we see that when it finds an ( zz ; and commits to finding ( error ) .
 * So again we wait for the ')' even though if we popped another token (namely '(') off
 * the parse stack we could match the statement level error message.
 * However we no longer die on zz );
 *
 *
 * Starting parse
 * Entering state 0
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2
 * Reducing via rule 4 (line 33), ZZ  -> stmt
 * state stack now 0
 * Entering state 5
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 10
 * Reducing via rule 2 (line 29), stmt ';'  -> slist
 * ** stmt
 * state stack now 0
 * Entering state 4
 * Reading a token: Next token is 40 ('(')
 * Shifting token 40 ('('), Entering state 3
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2
 * Reducing via rule 4 (line 33), ZZ  -> stmt
 * state stack now 0 4 3
 * Entering state 8
 * Reading a token: Next token is 59 (';')
 * ERROR lineno(1):parse error, expecting `')''.  I got: ;
 * Error: state stack now 0 4 3
 * Shifting error token, Entering state 7
 * Next token is 59 (';')
 * Discarding token 59 (';').
 * Error: state stack now 0 4 3
 * Shifting error token, Entering state 7
 * Reading a token: Next token is 258 (ZZ)
 * Discarding token 258 (ZZ).
 * Error: state stack now 0 4 3
 * Shifting error token, Entering state 7
 * Reading a token: Next token is 59 (';')
 * Discarding token 59 (';').
 * Error: state stack now 0 4 3
 * Shifting error token, Entering state 7
 * Reading a token: Next token is 41 (')')
 * Shifting token 41 (')'), Entering state 11
 * Reducing via rule 6 (line 35), '(' error ')'  -> stmt
 * ** nested error
 * state stack now 0 4
 * Entering state 9
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 13
 * Reducing via rule 1 (line 28), slist stmt ';'  -> slist
 * ** stmt
 * state stack now 0
 * Entering state 4
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2
 * Reducing via rule 4 (line 33), ZZ  -> stmt
 * state stack now 0 4
 * Entering state 9
 * Reading a token: Next token is 41 (')')
 * ERROR lineno(1):parse error, expecting `';''.  I got: )
 * Error: state stack now 0 4
 * Error: state stack now 0
 * Shifting error token, Entering state 1
 * Next token is 41 (')')
 * Discarding token 41 (')').
 * Error: state stack now 0
 * Shifting error token, Entering state 1
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 6
 * Reducing via rule 3 (line 30), error ';'  -> slist
 * ** error stmt
 * state stack now 0
 * Entering state 4
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 2
 * Reducing via rule 4 (line 33), ZZ  -> stmt
 * state stack now 0 4
 * Entering state 9
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 13
 * Reducing via rule 1 (line 28), slist stmt ';'  -> slist
 * ** stmt
 * state stack now 0
 * Entering state 4
 * Reading a token: Now at end of input.
 * Shifting token 0 ($), Entering state 14
 * Now at end of input.
 *
 */


/*
 * Continued in error-handling-and-yyerrok-looping1.jison ...
 */

