// title: Test mutiple action chunks per rule lexing/parsing
//
// ...
//


%%

%{
	block0A();   // init chunk 1
%}
%include "includes/dummy001.include"
%{
	block0B();   // init chunk 2
%}

					%{
						block0C();   // indented, hence SHOULD barf a hairball as there's no rule to relate it to! Or it should become init chunk 3...
					%}
					%include "includes/dummy002.include"

\s+                 // ignore

[a-z]+              %{
						block1();
					%}

					%include "includes/dummy003.include"

					%{
						block2();   // also belong to the rule above; we don't care about empty lines in between chunks...
					%}








%%

%include "includes/dummydecl.include"
