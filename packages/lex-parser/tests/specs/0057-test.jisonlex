//
// title: test [^\\\\]
//
// ...
//

%%
"["[^\\]"]" {return true;}
'f"oo\'bar'  {return 'baz2';}
"fo\"obar"  {return 'baz';}

