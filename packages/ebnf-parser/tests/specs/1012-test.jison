//
// title: test complex expression ( *, ?, () ) 
// input: 
//   - ""
//   - "hi"
//   - "hi, there"
//
// ...
//

%ebnf
%%
top : (word ("," word)*)? EOF;
