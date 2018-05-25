// title: Test mutiple action chunks per rule lexing/parsing
//
// ...
//


%%

%{
	block0A();   // init chunk 1
%}
%include "dummy001.include"
%include dummy002.include
%{
	block0B();   // init chunk 2
%}

					%{
						block0C();   // init chunk 3
					%}
					%include "dummy001.include"
					%include dummy002.include

\s+                 // ignore

[a-z]+              %{
						block1();
					%}

					%include "dummy001.include"
					%include dummy002.include

					%{
						block2();   // also belong to the rule above; we don't care about empty lines in between chunks...
					%}

