//
// title: test escape things
//
// ...
//

%%
\"\'\\\\\\*\i return 1;
"a"\b return 2;
\cA {}
\012 {}
\xFF ;

