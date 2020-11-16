
// title: test advanced grammar
// 
// ...
// 

%% test: foo bar {action} | baz ; hello: world %prec UMINUS ;extra: foo %prec '-' {action} ;

