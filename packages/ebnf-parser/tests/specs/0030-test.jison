
// title: test quote in rule
// 
// ...
// 

%lex
%% 
\' return "'" 
\" return '"' 
/lex 
%% test: foo bar "'";

