//
// title: "regex pipe symbol in JS action code: a | b"
// 
// ...
// 
// test a large set of action code patterns which are specifically targetting particular
// lexer rules: these serve as regression tests and power checks to ensure our lexer
// does indeed handle these as one might (or might not) expect; when it doesn't cope
// well, these should cause a failure in the parser, ideally...
//

%%
"a" return a | b
  //
"b" return 1;
  //
