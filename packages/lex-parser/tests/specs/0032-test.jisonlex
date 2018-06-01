//
// title: test include
//
// ...
//

RULE [0-9]

%{
 hi; {stuff;} 
%}
%%
"["[^\]]"]" %{
return true;
%}

