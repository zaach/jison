//
// title: test multiline action with alternative markers 3
//
// ...
//

%%
"["[^\]]"]" %{{
return "%{..%}";
%}}

