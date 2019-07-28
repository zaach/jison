//
// title: test multiline action with single braces
//
// ...
//

%%
"["[^\]]"]" {
var b={};
return true;
}

