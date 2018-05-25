// title: Simple lexer example - a lexer spec without any errors
// test_input: x x x
// ...
//  

%%

\s+         {/* skip whitespace */}
"x"         {return 'x';}

%%

