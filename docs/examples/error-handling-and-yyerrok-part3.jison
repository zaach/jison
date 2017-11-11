/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Continued from the error-handling-and-yyerrok-part2.jison example:
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
 * The long wait
 * -------------
 *
 * Consider this grammar:
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

stmt  :  ZZ
      | '(' stmt ')'
      | '(' error ')'
      ;

%%


/*
 * and this input:
 *
 *      zz ;
 *      ( zz ) ;
 *      ( zz ;
 *      zz ;
 *      zz ;
 *      zz );
 *      zz ;
 *
 * you get this result:
 *
 * Starting parse
 * Entering state 0
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 1
 * Reducing via rule 3 (line 32), ZZ  -> stmt
 * state stack now 0
 * Entering state 4
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 8
 * Reducing via rule 2 (line 29), stmt ';'  -> slist
 * stmt
 * state stack now 0
 * Entering state 3
 * Reading a token: Next token is 40 ('(')
 * Shifting token 40 ('('), Entering state 2
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 1
 * Reducing via rule 3 (line 32), ZZ  -> stmt
 * state stack now 0 3 2
 * Entering state 6
 * Reading a token: Next token is 41 (')')
 * Shifting token 41 (')'), Entering state 10
 * Reducing via rule 4 (line 33), '(' stmt ')'  -> stmt
 * state stack now 0 3
 * Entering state 7
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 11
 * Reducing via rule 1 (line 28), slist stmt ';'  -> slist
 * stmt
 * state stack now 0
 * Entering state 3
 * Reading a token: Next token is 40 ('(')
 * Shifting token 40 ('('), Entering state 2
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 1
 * Reducing via rule 3 (line 32), ZZ  -> stmt
 * state stack now 0 3 2
 * Entering state 6
 * Reading a token: Next token is 59 (';')
 * ERROR lineno(1):parse error, expecting `')''.  I got: ;
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5 <--- SHIFT ERROR TOKEN AND WAIT FOR ')'
 * Next token is 59 (';')
 * Discarding token 59 (';').
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5
 * Reading a token: Next token is 258 (ZZ)
 * Discarding token 258 (ZZ).
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5
 * Reading a token: Next token is 59 (';')
 * Discarding token 59 (';').
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5
 * Reading a token: Next token is 258 (ZZ)
 * Discarding token 258 (ZZ).
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5
 * Reading a token: Next token is 59 (';')
 * Discarding token 59 (';').
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5
 * Reading a token: Next token is 258 (ZZ)
 * Discarding token 258 (ZZ).
 * Error: state stack now 0 3 2
 * Shifting error token, Entering state 5
 * Reading a token: Next token is 41 (')')
 * Shifting token 41 (')'), Entering state 9
 * Reducing via rule 5 (line 34), '(' error ')'  -> stmt
 * state stack now 0 3
 * Entering state 7
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 11
 * Reducing via rule 1 (line 28), slist stmt ';'  -> slist
 * stmt
 * state stack now 0
 * Entering state 3
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 1
 * Reducing via rule 3 (line 32), ZZ  -> stmt
 * state stack now 0 3
 * Entering state 7
 * Reading a token: Next token is 59 (';')
 * Shifting token 59 (';'), Entering state 11
 * Reducing via rule 1 (line 28), slist stmt ';'  -> slist
 * stmt
 * state stack now 0
 * Entering state 3
 * Reading a token: Now at end of input.
 * Shifting token 0 ($), Entering state 12
 * Now at end of input.
 *
 *
 * Notice how this grammar is forced to wait for the closing ')' throwing away useful statements.
 *
 *
 * Insufficient coverage
 * ---------------------
 *
 * If the input is now:
 *
 *      zz );
 *      zz ;
 *
 * You aren't covered if there is an error not between parentheses
 *
 * Starting parse
 * Entering state 0
 * Reading a token: Next token is 258 (ZZ)
 * Shifting token 258 (ZZ), Entering state 1
 * Reducing via rule 3 (line 32), ZZ  -> stmt
 * state stack now 0
 * Entering state 4
 * Reading a token: Next token is 41 (')')
 * ERROR lineno(1):parse error, expecting `';''.  I got: )
 * Error: state stack now 0
 *
 *
 * The error on the closing parenthesis is the last thing the parser does.
 *
 */


/*
 * Continued in error-handling-and-yyerrok-part4a.jison ...
 */

