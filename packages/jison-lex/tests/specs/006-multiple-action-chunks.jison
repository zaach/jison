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
						block0C();   // indented, hence SHOULD barf a hairball as there's no rule to relate it to! Or it should become init chunk 3...
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
		block4();   // indented, hence belongs to [a-z]+ rule
	%}
	%{
		block5();   // indented, hence belongs to [a-z]+ rule
	%}


%{
	block0D();   // not indented, hence init chunk 3
%}
%{
	block0E();   // not indented, hence init chunk 4
%}







%%

function block1() { }
function block2() { }
function block3() { }
function block4() { }
function block5() { }

function block0A() { }
function block0B() { }
function block0C() { }
function block0D() { }
function block0E() { }
