//
// title: test stability across lexer invocations as we patch lexer rules under the hood
//
// ...
//

%%
"["[^\]]"]" %{{{{{
return "%{..%}";
%}}}}}
a %{ return "A"; %}

