/*
 * From:
 *
 * Error recognition actions
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


/*
 * The easiest way to generate an error message is to associate a
 * recognition action with the grammar rule that recognizes the error.
 * You can do something simple:
 *
 *     statement : error
 *         {
 *             console.log("You made an error!\n");
 *         }
 *     ;
 *
 * or you can be fancier:
 */

line : error '\n' prompt line
        { $$ = $4; }
      | A '\n'
      ;

prompt 
      : %epsilon
        { console.log("Please reenter line.\n"); }
      ;

/*
 * If an error occurs, the parser skips until it finds a newline character.
 * After the newline, it always finds a null token matching prompt,
 * and the recognition action for prompt displays the message:
 *
 *      Please reenter line.
 *
 * The final symbol in the rule is another line, and the action
 * after the error rule shows that the result of the rule ($$)
 * should be the material associated with the second input line.
 *
 * All this means that if the user makes a mistake entering an input
 * line, the parser displays an error message and accepts a second input
 * line in place of the first. This allows for an interactive user to
 * correct an input line that was incorrectly typed the first time.
 *
 * Of course, this setup works only if the user does not make an error
 * the second time the line is typed too. If the next token he or she
 * types is also incorrect, the parser discards the token and decides
 * that it is still gobbling up the original error.
 *
 *
 * Now this example is simple, but it has its drawbacks. It gets you
 * into trouble if the grammar has any concept of block structure or
 * parenthesization. Why? Once an error occurs, the rule:
 *
 *      statement : error ';'
 *
 * effectively tells the parser to discard absolutely everything until
 * it finds a semicolon character. If you have a parser for C, for example, it would
 * skip over important characters such as ) or } until
 * it found a semicolon. Your parentheses and braces would be out of
 * balance for the rest of the input, and the whole parsing process would
 * be a waste of time. The same principle applies to any rule that shows
 * the error token followed by some other non-null symbol: It
 * can lead to hopeless confusion in a lot of grammars.
 *
 * It is safer to write the rule in a form like this:
 *
 *     statement : error
 *          | ';'
 *          | // other stuff //
 *
 * In this case, the error token
 * matches material only until the parser finds something else it recognizes
 * (for example, the semicolon). After this happens, the error state
 * is reduced to a statement symbol and popped off the stack.
 * Parsing can then proceed as usual.
 */

