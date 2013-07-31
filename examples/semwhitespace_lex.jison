/* Demonstrates semantic whitespace pseudo-tokens, INDENT/DEDENT. */

id			[a-zA-Z][a-zA-Z0-9]*

%s EXPR

%%
"if"				return 'IF';
"else"				return 'ELSE';
"print"				return 'PRINT';
":"				return 'COLON';
"("				this.begin('EXPR'); return 'LPAREN';
")"				this.popState(); return 'RPAREN';
\"[^\"]*\"|\'[^\']*\'		yytext = yytext.substr(1,yyleng-2); return 'STRING';
"+"				return 'PLUS';
"-"				return 'MINUS';
{id}				return 'ID';
\d+				return 'NATLITERAL';
<INITIAL>[\n\r\s]+<<EOF>>	%{
					var tokens = [];
				
					while (0 < _iemitstack[0]) {
						this.popState();
						tokens.push("DEDENT");
						_iemitstack.shift();
					}
					tokens.push("ENDOFFILE");

					return tokens;
				%}
[\n\r]+\s*/![^\n\r]		/* eat blank lines */
<INITIAL>[\n\r]\s*		%{
					var indentation = yytext.length - yytext.search(/\s/) - 1;
					if (indentation > _iemitstack[0]) {
						_iemitstack.unshift(indentation);
						return 'INDENT';
					}
				
					var tokens = [];
				
					while (indentation < _iemitstack[0]) {
						this.popState();
						tokens.push("DEDENT");
						_iemitstack.shift();
					}

					if (tokens.length) return tokens;
				%}
\s+				/* ignore all other whitespace */

%%
/* initialize the pseudo-token stack with 0 indents */
_iemitstack = [0];

