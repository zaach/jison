%lex

%%
\s+         {/* skip whitespace */}
[0-9]+         {return 'NAT';}
"+"         {return '+';}

/lex

%%

E
    : E '+' T
    | T
    ;

T
    : NAT
    ;

