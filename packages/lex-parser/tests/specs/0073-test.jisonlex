//
// title: test %options easy_keyword_rules
//
// ...
//

%options easy_keyword_rules
%s TEST TEST2
%x EAT
%%
"enter-test" {this.begin('TEST');}
"enter_test" {this.begin('TEST');}
<TEST,EAT>"x" {return 'T';}
<*>"z" {return 'Z';}
<TEST>"y" {this.begin('INITIAL'); return 'TY';}
\"\'"a" return 1;
\"\'\\\*\i return 1;
"a"\b return 2;
\cA {}
\012 {}
\xFF {}
"["[^\\]"]" {return true;}
'f"oo\'bar'  {return 'baz2';}
"fo\"obar"  {return 'baz';}

