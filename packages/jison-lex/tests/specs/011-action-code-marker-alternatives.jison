// title: Test action code block lexing
// test_input: a b c d e f g 
// ...
//


%code imports %{
  import helpers from '../../helpers-lib';
%}



%%

\s+                 // ignore

a   		        %{{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{...%}\`) shrimp 
			            `);
			            return yytext;
			        %}}

b   		        {{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{...%}\`) shrimp 
			            `);
			            return yytext;
			        }}

c   		        %{{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{...%}\` ~ \`{{...}}\`) shrimp 
			            `);
			            return yytext;
			        %}}

d   		        %{{{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{...%}\` ~ \`%{{...%}}\`) shrimp 
			            `);
			            return yytext;
			        %}}}

e   		        %{{{{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{...%}\` ~ \`%{{...%}}\`) shrimp 
			            `);
			            return yytext;
			        %}}}}

f   		        {{{{{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{{{{...%}}}}\` ~ \`%{{...%}}\`) shrimp 
			            `);
			            return yytext;
			        }}}}}

g   		        %{
						var msg = 'millenium hand';
			            log(rmCommonWS`
			                bugger (\`%{\`${msg} ~ \`%{{{{...%}}}}\` ~ \`{{{{{...}}}}}\`) shrimp 
			            `);
			            return yytext;
			        %}

%%

var rmCommonWS = helpers.rmCommonWS;

function log(msg) {}

