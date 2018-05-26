// title: Test action code block lexing
// ...
//


%code imports %{
  import helpers from '../../helpers-lib';
%}



%%

\s+                 // ignore

[a-z]+		        {{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{...%}\`) shrimp 
			            `);
			            return yytext;
			        }}

%%

var rmCommonWS = helpers.rmCommonWS;

function log(msg) {}

