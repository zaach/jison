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



