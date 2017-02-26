
/* description: Basic grammar that contains a nullable A nonterminal. */

%%

A
    : A x
    | 
    ;

