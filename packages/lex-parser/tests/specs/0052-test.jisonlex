//
// title: test if %options names with a hyphen are correctly recognized
//
// ...
//

%options token-stack        // option name camel-casing is done very early in the game: see lex.y source code.

%%
"foo" return 1;

