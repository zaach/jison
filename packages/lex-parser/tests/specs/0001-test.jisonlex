
//
// title: test lex grammar with macros
//
// ...
//

D [0-9]
ID [a-zA-Z_][a-zA-Z0-9_]+

%%

{D}"ohhai" {print(9);}
"{" return '{';

