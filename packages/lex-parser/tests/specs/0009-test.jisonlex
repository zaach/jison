//
// title: test multiline action with brace in a multi-line-comment
//
// ...
//

%%
"["[^\]]"]" {
var b=7; /* { */ return true;
}

