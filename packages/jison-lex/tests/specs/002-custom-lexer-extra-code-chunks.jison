// title: Baseline for Custom Lexer - a lexer spec without any errors
//
// ...
//  
// This lexer represents the MVP (Minimum Viable Product) where
// 'defining custom lexers through JISON / JISON-LEX' are concerned.
// 
// Subsequent test cases, specified in other spec files, serve to
// test various code generation and input validation / error handling
// capabilities of JISON-LEX.

%code init %{
  console.log('init');
%}
%code __misc__ %{
  console.log('_x_misc_x_');
%}
%{
  // custom lexer...
  console.log('The moment the custom lexer gets defined...');
  var lexer = {
    lex: function () {
      return 1;
    },
    setInput: function (s, yy) {
      console.log('setInput: ', s, yy);
    },
    options: {

    },
    ERROR: 2,
    EOF: 1, 
  };
%}
%%
%%
