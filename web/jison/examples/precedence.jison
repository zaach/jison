
/* description: Grammar showing precedence operators and semantic actions. */

%left '+' '-'
%left '*'

%%

S
    : e EOF
        {return $1;}
    ;

e
    : e '+' e
        {$$ = [$1,'+', $3];}
    | e '-' e
        {$$ = [$1,'-', $3];}
    | e '*' e
        {$$ = [$1, '*', $3];}
    | NAT
        {$$ = parseInt(yytext);}
    ;

