// title: Recognize failure to specify a start condition which is used in the lexer
// test_input: A a B C 1 + 2 + 3
// ...
//  
// This is the FAILING lexer spec
// 


%%

\s+                 // ignore
\d                  this.pushState('NUMBER');

<NUMBER>\d+         -> 'NUMBER';

