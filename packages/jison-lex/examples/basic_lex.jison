// title: Simple lexer example - a lexer spec without any errors
// test_input: 1 +25 1000
// ...
//  

%%
\s+         {/* skip whitespace */}
[0-9]+      {return 'NAT';}
"+"         {return '+';}

