/*
 * From:
 *
 * The yyclearin macro
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
         default-action-mode=none,merge


%%



start : lines
      ;

lines : lines line
      | '\n'
      | %epsilon
      ;


line  : error '\n' prompt
        { yyclearin(); }
      | A '\n'
      ;

prompt 
      : %epsilon
        { console.log("Please reenter line.\n"); }
      ;

/*
 * After an Error action, the parser restores
 * the lookahead symbol to the value it had at the time the error was
 * detected; however, this is sometimes undesirable.
 *
 * For example, your grammar may have a recognition action associated
 * with the error symbol, and this may read through the next
 * lot of input until it finds the next sure-to-be-valid data. If this
 * happens, you certainly do not want the parser to pick up the old lookahead
 * symbol again once error recovery is finished.
 *
 * If you want the parser to throw away the old lookahead symbol after
 * an error, put:
 *
 *     yyclearin;
 *
 * in the recognition action associated
 * with the error symbol. yyclearin is a macro that
 * expands into code that discards the lookahead symbol.
 */

