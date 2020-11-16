/*
 * From:
 *
 * The yyerrok macro
 *
 * z/OS UNIX System Services Programming Tools
 * SA22-7805-08
 */





%lex
%%

A           return 'A';
B           return 'B';
C           return 'C';
\n          return '\n';
\s+         /* skip */

/lex






%options debug=0
         output-debug-tables=0
         default-action-mode=none,none


%%

start : lines
      ;

lines : lines line
      | '\n'
      | %epsilon
      ;


line  : error '\n'
        {
            yyerrok();
            yyclearin();
        }
      | A '\n'
      ;



/*
 * In some situations, you may want yyerror() to be called
 * even if the parser has not seen three correct tokens since the last
 * error.
 *
 * For example, suppose you have a parser for a line-by-line desk
 * calculator. A line of input contains errors, so yyerror() is
 * called. yyerror() displays an error message to the user,
 * throws away the rest of the line, and prompts for new input. If the
 * next line contains an error in the first three tokens, the parser
 * normally starts discarding input without calling yyerror() again.
 * This means that yyerror() does not display an error message
 * for the user, even though the input line is wrong.
 *
 * To avoid this problem, you can explicitly tell the parser to leave
 * its potential error state, even if it has not yet seen three correct
 * tokens. Simply code:
 *
 *     yyerrok;
 *
 * as part of the error recognition action.
 *
 * For example, you might have the rule:
 *
 *     expr : error {
 *                yyerrok;
 *                printf("Please re-enter line.\n");
 *                yyclearin;
 *            }
 *
 * yyerrok expands into code that takes the
 * parser out of its potential error state and lets it start fresh.
 */

