//
// title: test multiline action with brace in a single-line-comment
//
// ...
//

%%
"["[^\]]"]" {
var b={}; // {
return 2 / 3;
}

