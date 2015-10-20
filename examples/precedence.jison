
/* description: Grammar showing precedence operators and semantic actions. */

%lex
%%
\s+         {/* skip whitespace */}
[0-9]+         {return 'NAT';}
"+"         {return '+';}
"-"         {return '-';}
"*"         {return '*';}
<<EOF>>         {return 'EOF';}

/lex

%left '+' '-'
%left '*'
%left UNARY_PLUS UNARY_MINUS

%%

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
        {$$ = ['+', $3];}
    | '-' e                     %prec UNARY_MINUS 
        {$$ = ['-', $3];}
    | NAT
        {$$ = parseInt(yytext);}
    ;

