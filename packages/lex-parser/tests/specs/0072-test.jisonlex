//
// title: test braced action with surplus whitespace between rules
//
// ...
//

%%
"a" %{  //
return true;
%}  //
  //
"b" %{    return 1;
%}  //
  //

