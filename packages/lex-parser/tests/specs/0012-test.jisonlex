//
// title: test multiline action with braces in regexp
//
// ...
//

%%
"["[^\]]"]" {
var b=/{/; // {
return 2 / 3;
}

