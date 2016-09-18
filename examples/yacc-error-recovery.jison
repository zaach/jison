/* https://luv.asn.au/overheads/lex_yacc/yacc.html */



%token       BACK_SELN
%token       COLUMNS
%token       DEFAULT
%token       DIRMENU
%token       END
%token       EXIT
%token       EXIT_NO_CONFIRM
%token       FLIPDRAG
%token       FLIPFOCUS
%token       FULL_RESTORE_SIZE_SELN
%token       INCLUDE
%token       MENU
%token       MOVE_DESKTOP
%token       NOP
%token       OPEN_CLOSE_SELN
%token       QUIT_SELN
%token       PIN
%token       PROPERTIES
%token       REFRESH
%token       REREAD_MENU_FILE
%token       RESTART
%token       SAVE_WORKSPACE
%token       SEPARATOR
%token       START_DSDM
%token       STICK_UNSTICK_SELN
%token       STOP_DSDM
%token       TITLE
%token       WINMENU
%token       WMEXIT
%token       LABEL
%token       EXEC
%token       INT

 
%start menufile

%%

menufile  : menu_items
        { @1; /* See: adding line numbers */ }
    ;
menu_items  : menu_item
    | menu_items menu_item
    ;







/*
 * Error Handling
 * -------------- 
 * 
 * As it stands, when our parser encounters an incorrect syntax, it will simply print 
 * the message "parse error" and exits.
 * 
 * We've just added line-number information, but even this is a bit vague. Also, 
 * we may not want our parser to simply give up at the first syntax error, in 
 * the same way the C-compiler gives you more than one error message at a 
 * single invocation.
 * 
 * Yacc provides a special symbol for handling errors. The symbol is called error and 
 * it should appear within a grammar-rule. For example, we could have:
 * 
 */

menu_item:   menu_command
  |    option       '\n'
  |    SEPARATOR    '\n'
  |    menu_file    '\n'
  |    submenu      '\n'
  |                 '\n'
  |    error
    { printf("Invalid menu item at line %d\n",
       @1.first_line);
    }
  ;


/*
 * Now, when the parser encounters an invalid syntax while processing the rule 
 * menu_item, it will
 * 
 * - Discard the current token
 * - Execute the error action
 * - Continue parsing as if the discarded token was really a valid menu_item
 * 
 * Unfortunately, we cannot vouch for the next token that the parser gets, so 
 * typically this error rule will generate several error messages.
 * 
 * Yacc is also capable of more sophisticated error-handling. For example, we can 
 * tell the parser to discard some of the subsequent tokens, too, simply by 
 * putting a token after the error token.
 * 
 */

 
menu_command :    label  default  EXEC          '\n'
             |    label  default  olvwm_cmd     '\n'
             |    label  default  olvwm_cmd_arg '\n'
             |    label  error                  '\n'
          { printf("Invalid menu item (%s) at line %d is invalid\n",
                    $1, @1.first_line);
          }
             ;


/*
 * In this case, the parser
 * 
 * - Discards everything on the stack going back to the label token
 * - Keeps reading tokens up till the next '\n', and discards them, too.
 * - Uses the tokens label error and '\n' to complete the rule for menu_command.
 * 
 * In this case, the rule
 * 
 *     label error '\n'
 * 
 * is not much different to just having
 * 
 *     error '\n'
 * 
 * except that the former lets us make use of the value of label to give a more 
 * informative error message.
 * 
 * This approach is often used when there a "balanced" symbols in the syntax. 
 *
 * Consider the rule:
 * 
 */

label :   LABEL
  |   '<'  LABEL  '>'
    { $$=$2; }
  |   '<'  error  '>'
    { printf("Bad icon-label at line %d\n",
      @1.first_line);
    }
  ;


/*
 * If the parser encounters something other than a LABEL after a '<', it will 
 * discard all tokens up to the next '>'. This technique can be useful for 
 * keeping brackets balanced during error-recovery.
 * 
 * In our case, keep in mind that any unidentifiable text after a valid LABEL 
 * is converted to an EXEC token by the lexer, and the EXEC token would swallow 
 * any subsequent '>'. So this rule in unlikely to trap any real errors, 
 * except something like < keyword >
 * 
 * In fact, it is likely to work against us, because we may not see another '>' 
 * at all, so we will miss out on a lot of input!
 * 
 * Error recovery is a tricky business, and we don't always get the results 
 * we really wanted. It doesn't pay to be too fussy about this aspect of 
 * the parser.
 * 
 * See the sections "Error Recovery" and "Action Features" in the Bison 
 * documentation for further explanations and examples.
 * 
 * 
 * 
 * Building the 2nd Prototype: olmenu-proto2.y
 * 
 * This prototype contains the neccessary rules and actions for handling errors 
 * in a reasonable way. Building it should be as simple as typing:
 * 
 *     make olmenu-proto2
 * 
 * We want to test it with both correct input, and incorrect input. We need to 
 * check that it generate meaningful error messages and does not cause any 
 * segv errors or the like.
 * 
 * At this stage, our grammar rules should be complete, so so that we can start 
 * populating them with actions. Hopefully, we will not need to change them 
 * from here on.
 * 
 */
 



menu_file : label default include filename
        { }
    ;
filename  : EXEC
    ;
include   : MENU
    | INCLUDE
    ;
submenu   : label default MENU '\n' menu_items end '\n'
        { }
    ;
default   : /* empty */
    | DEFAULT
    ;
end   : label END pin
        { }
    ;
pin   : /* emtpy */
    | PIN
    ;

option    : COLUMNS  INT
        { }
    | TITLE  pin
        { }
    ;

olvwm_cmd : BACK_SELN
    | EXIT
    | EXIT_NO_CONFIRM
    | FLIPDRAG
    | FLIPFOCUS
    | FULL_RESTORE_SIZE_SELN
    | NOP
    | OPEN_CLOSE_SELN
    | QUIT_SELN
    | PROPERTIES
    | REFRESH
    | REREAD_MENU_FILE
    | RESTART
    | SAVE_WORKSPACE
    | SEPARATOR
    | START_DSDM
    | STICK_UNSTICK_SELN
    | STOP_DSDM
    | WINMENU
    | WMEXIT
    ;
olvwm_cmd_arg : DIRMENU EXEC
    | MOVE_DESKTOP INT
    | WINMENU INT
    ;

%%


function printf(str /* , ... */) {
  console.log.apply(null, arguments);
}


