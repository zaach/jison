
// title: test embedded lexical block
// 
// ...
// 

%lex 
%%
'foo' return 'foo';
'bar' {return 'bar';}
'baz' {return 'baz';}
'world' {return 'world';}
/lex                   %% test: foo bar | baz ; hello: world ;

