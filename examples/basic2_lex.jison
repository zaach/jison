
/* description: Basic grammar that contains a nullable A nonterminal. */

%lex
%%

\s+         {/* skip whitespace */}
"x"         {return 'x';}

/lex

%%

A
    : A x
    | 
    ;

