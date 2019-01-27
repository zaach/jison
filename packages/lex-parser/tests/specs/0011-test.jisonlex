//
// title: test multiline action with braces in strings
//
// ...
//

%%
"["[^\]]"]" {
var b='{' + "{"; // {
return 2 / 3;
}

