//
// title: test multiline action with alternative markers 2
//
// ...
//

%%
"["[^\]]"]" {{
return "%{..%}";
}}

