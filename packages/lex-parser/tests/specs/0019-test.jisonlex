//
// title: test multiline action with alternative markers 1
//
// ...
//

%%
"["[^\]]"]" %{{
return "%{..%}";
%}}

