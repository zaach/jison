
/* description: Produces a reduce-reduce conflict unless using LR(1). */


%start S

%%

S
    : a A c
    | a B d
    | b A d
    | b B c
    ;

A
    : z
    ;

B
    : z
    ;

