// title: Simple lexer example - a lexer spec without any errors
// test_input: (a|bcd)
// ...
//  

/*
Copyright 2015 Mathew Reny

Regular expression parser for Jison Yacc.
*/


%%



[a-zA-Z0-9]  return 'TERMINAL'
"|"          return '|'
"*"          return '*'
"+"          return '+'
"?"          return '?'
"("          return '('
")"          return ')'
<<EOF>>      return 'EOF'



