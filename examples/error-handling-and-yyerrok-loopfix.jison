/* http://marvin.cs.uidaho.edu/Teaching/CS445/bisonErrorToken.html */

/*
 * Continued from the error-handling-and-yyerrok-looping2.jison example:
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
 * The fix is to put the yyerrok with the synchronizing token as in:
 *
 */


%token YY ZZ

%options debug=0
         output-debug-tables=0
         default-action-mode=none,merge


%%

slist : slist stmt ';' { console.log("** slist stmt"); }
      | stmt ';'       {
                         yyerrok;
                         console.log("** stmt");
                       }
      ;

stmt  : ZZ
      | error
      ;

%%


/*
 *
 * References
 * ----------
 *
 * A good brief description of Bison error token usage can be found in the bison manual:
 * The Bison Manual (2002 version of the book) for version 1.35.
 *
 * Also information can be found our book:
 * Compiler Construction: Principles and Practice by Kenneth Louden, ISBN: 0534939724,
 * Published by Brooks and Cole. Pages 247-250.
 *
 *
 * Robert Heckendorn Up One Level  Last updated: Mar 22, 2006 22:27
 */

