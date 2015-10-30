
/* description: Grammar showing precedence operators and semantic actions. */

%lex
%%
\s+         {/* skip whitespace */}
[0-9]+         {return 'NAT';}
"+"         {return '+';}
"*"         {return '*';}
<<EOF>>         {return 'EOF';}

/lex

%left '+'
%left '*'

%%

S
    : e EOF
        {return $1;}
    ;

e
    : e '+' e
        {$$ = [$1,'+', $3];}
    | e '*' e
        {$$ = [$1, '*', $3];}
    | NAT
        {$$ = parseInt(yytext);}
    ;

