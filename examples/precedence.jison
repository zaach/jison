
/* description: Grammar showing precedence operators and semantic actions. */

%lex

%include precedence.prelude1.js

%%
\s+             {/* skip whitespace */}
[0-9]+          %include "precedence.returnNAT.js"  // demonstrate the ACTION block include and the ability to comment on it right here.

"+"             {return '+';}
"-"             {return '-';}
"*"             {return '*';}
<<EOF>>         {return 'EOF';}

%%

%include precedence.prelude2.js

/lex

%left '+' '-'
%left '*'
%left UNARY_PLUS UNARY_MINUS

%include precedence.prelude3.js

%%

%include precedence.prelude4.js

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
        %include "precedence.parseInt.js"  // demonstrate the ACTION block include and the ability to comment on it right here.
    ;


%%

%include precedence.main.js
