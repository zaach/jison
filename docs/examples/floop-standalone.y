/* Stand-alone FlooP lexer - http://en.wikipedia.org/wiki/BlooP_and_FlooP */

%option just-gimme-a-lexer-dammit

%%

bogus
    :   /* just list all the terminals here: */
        NUMBER DEFINE PROCEDURE BLOCK BEGIN OUTPUT CELL IF THEN LOOP INVALID MU_LOOP AT MOST
        TIMES ABORT END QUIT AND YES NO IDENT '.' QUOTE '[' ']' '(' ')'
        '{' '}' ':' ';' ',' '+' '*'  '<=' '<' '>' '=' INVALID
        EOF
    ;


%%

