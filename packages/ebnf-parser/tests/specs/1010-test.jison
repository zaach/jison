//
// title: test group () with multiple options on first option 
// input: "hi there"
//
// ...
//

%ebnf
%%
top : ((word word) | word) EOF;

