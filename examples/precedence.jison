
/* description: Grammar showing precedence operators and semantic actions. */

%lex


digits          [0-9]
whitespace      \s


%%

{whitespace}+   {/* skip whitespace */}
[{digits}]+     {return 'NAT';}
"+"             {return '+';}
"-"             {return '-';}
"*"             {return '*';}
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
        {$$ = ['+', $2];}
    | '-' e                     %prec UNARY_MINUS 
        {$$ = ['-', $2];}
    | NAT
        {$$ = parseInt(yytext);}
    ;

