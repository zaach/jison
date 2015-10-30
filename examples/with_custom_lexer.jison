
/* 
 * description: One way to provide a custom lexer with a jison grammar.
 *
 * The grammar itself is a copy of the precedence grammar which shows precedence operators 
 * and semantic actions. 
 */

%lex

%options ranges

%include with-includes.prelude1.js

%%

%%

%include with-includes.prelude2.js

/lex

%left '+' '-'
%left '*'
%left UNARY_PLUS UNARY_MINUS

%include with-includes.prelude3.js

%%

%include with-includes.prelude4.js

S
    : e EOF
        {return $1;}
    ;

e
    : e '+' e
        {$$ = [$1, '+', $3];}
    | e '-' e
        {$$ = [$1, '-', $3];}
    | e '*' e
        {$$ = [$1, '*', $3];}
    | '+' e                     %prec UNARY_PLUS 
        {$$ = ['+', $2];}
    | '-' e                     %prec UNARY_MINUS 
        {$$ = ['-', $2];}
    | NAT
        %include "with-includes.parseInt.js"  // demonstrate the ACTION block include and the ability to comment on it right here.
    ;


%%

%include with-includes.main.js
