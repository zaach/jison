
//
// title: test lex grammar with macros in regex sets
//
// ...
//

D [0-9]
L [a-zA-Z]
ID [{L}_][{L}{D}_]+
%%
[{D}]"ohhai" {print(9);}
"{" return '{';

