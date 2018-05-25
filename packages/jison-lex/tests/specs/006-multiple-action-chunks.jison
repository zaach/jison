// title: Test mutiple action chunks per rule lexing/parsing
//
// ...
//


%%

%{
	block0A();   // init chunk 1
%}
%{
	block0B();   // init chunk 2
%}

					%{
						block0C();   // init chunk 3
					%}

\s+                 // ignore

[a-z]+              %{
						block1();
					%}
					%{
						block2();   // belong to the rule above...
					%}

					%{
						block3();   // also belong to the rule above; we don't care about empty lines in between chunks...
					%}

%{
	block0C();   // init chunk 3
%}
%{
	block0D();   // init chunk 4
%}


