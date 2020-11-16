
// title: test parser %options easy_keyword_rules
// 
// ...
// 

%lex 
%options easy_keyword_rules
%%
'foo' return 'foo';
'bar' {return 'bar';}
'baz' {return 'baz';}
'world' {return 'world';}
/lex                   %% test: foo bar | baz ; hello: world ;

