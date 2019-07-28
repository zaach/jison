// title: Test merged lexer rules using pipe symbol
// test_input: a 1 b 2
// ...
//


%%

\s+                 // ignore

\d+                 |
[a-z]+              -> 'TOKEN';

