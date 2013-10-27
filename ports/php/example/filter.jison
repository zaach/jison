
/* description: Parses end executes mathematical expressions with strings. */

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?\b  return 'NUMBER';
"*"                   return '*';
"/"                   return '/';
"-"                   return '-';
"+"                   return '+';
"^"                   return '^';
"!"                   return '!';
"%"                   return '%';
"("                   return '(';
")"                   return ')';
"["                   return '[';
"]"                   return ']';
","                   return ',';
"PI"                  return 'PI';
"E"                   return 'E';
"SUM"                 return 'SUM';
"LIKE"                return 'LIKE';
\"([^"]*)\"              %{
						//js
							yytext = yytext.substr(1,yyleng-2);
							return 'STRING';
						/*php
							$yytext = substr($yytext, 1, strlen($yytext) - 2);
							return 'STRING';
						*/
						%}
\'([^']*)\'              %{
						//js
							yytext = yytext.substr(1,yyleng-2);
							return 'STRING';
						/*php
							$yytext = substr($yytext, 1, strlen($yytext) - 2);
							return 'STRING';
						*/
						%}
'AND'                 return 'AND';
'OR'                  return 'OR';
'NOT'                 return 'NOT';
'>'                   return '>';
'<'                   return '<';
'='                   return '=';
'<>'                  return '<>';
'>='                  return '>=';
'=>'                  return '>=';
'<='                  return '=<';
'=<'                  return '=<';
'true'                return 'true';
'false'               return 'false';
<<EOF>>               return 'EOF';
.                     return 'INVALID';

/lex

/* operator associations and precedence */

%right ','
%left 'OR',
%left 'AND'
%left 'NOT'
%left '>','<','=<','>=', '<>','='
%left '+' '-'
%left '*' '/'
%left '^'
%right '!'
%right '%'
%left UMINUS

%start expressions

%% /* language grammar */
expressions
	: e EOF
		{
		//js
		  typeof console !== 'undefined' ? console.log($1) : print($1);
		  return $1;
		/*php
			return $1;
		*/
		}
	;

sub_list
	: sub_list ',' e
		{
			//js
				var A = $1;
				A.push($3);
				$$ = A;
			/*php
				$a = $1;
				array_push($a, $3);
				$$ = $a;
			*/
		}
	| e
		{
			//js
				$$ = [ $1 ];
			//php $$ = array($1);
		}
	;

list
	: '[' sub_list ']'
		{
			$$ = $2;
		}
	;

e
	: e '+' e
		{
			$$ = ( $1 + $3 );
		}
	| e '-' e
		{
			$$ = ($1 - $3);
		}
	| e '*' e
		{
			$$ = ( $1*$3 );
		}

	| e '/' e
		{
			$$ = ( $1 /$3 );
		}
	| e '^' e
		{
			//js
				$$ = Math.pow($1, $3);
			//php $$ = pow( $1,  $3);
		}
	| e '!'
		{
			//js
			$$ = (function fact (n) { return n==0 ? 1 : fact(n-1) * n })($1);
			/*php
				$f = function($n) use (&$f) { return ($n<1) ? 1 : ($f($n-1) * $n); };
				$$ = $f((int) $1);
			*/
		}
	| e '%'
		{
			$$ = $1/100;
		}
	| '-' e %prec UMINUS
		{
			$$ = -$2;
		}
	| '(' e ')'
		{
			//js
				$$ = $2;
			//php $$ = $2;
		}
	| NUMBER
		{
			//js
				$$ = Number(yytext);
			//php $$ =  $1;
		}
	| STRING
		{
			//js
				$$ = yytext;
			//php $$ = $1;
		}
	| E
		{
		//js
			$$ = Math.E;
		//php $$ = exp(1);
		}
	| PI
		{
		//js
			$$ = Math.PI;
		//php $$ = 3.141592653589793;
		}
	| 'SUM' list
		{
			//js
				var sum = 0;
				$2.forEach(function(item) { sum+= Number(item); });
				$$ = sum;
			/*php
				$sum = 0;
				foreach($2 as $value) {
					$sum +=  $value;
				}
				$$ = $sum;
			*/
		}
	| e 'LIKE' list
		{
			//js
				var flag = false;
				var escape = function(text) {
                    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
				}
				$3.forEach(function(item) {
					var regexp = new RegExp(escape(item).replace('%', '(.*)'),'gi');
					flag = flag || regexp.test($1);
				});
				$$ = flag;
			/*php
				// TODO: Синхронизировать метод с JS
				$flag = false;
				$template = $1;
				foreach($3 as $item) {
					$flag = $flag || (mb_stripos($template, $item,0, 'utf-8') !== false);
					if ($flag) break;
				}
				$$ = $flag;
			*/
		}
	| e 'AND' e
		{
			//js
				$$ = ($1!=false) && ($3!=false);
			//php $$ = ($1 !== false) && ($3 !== false);
		}
	| e 'OR' e
		{
			//js
				$$ = ($1!=false) || ($3!=false);
			/*php
				$$ = ($1 !== false) || ($3 !== false);
			*/
		}
	| 'NOT' e
		{
			//js
				$$ = !($2!=false) ;
			//php $$ = ! ($2 !== false) ;
		}
	| 'true'
		{
			$$ = true;
		}
	| 'false'
		{
			$$ = false;
		}
	| e '>' e
		{
			$$ = ( $1 > $3 );
		}
	| e '<' e
		{
			$$ = ( $1 < $3 );
		}
	| e '>=' e
		{
			$$ = ( $1 >= $3 );
		}
	| e '=<' e
		{
			$$ = ( $1 <= $3 );
		}
	| e '=' e
		{
			$$ = ( $1 == $3 );
		}
	| e '<>' e
		{
			$$ = ( $1 != $3 );
		}
	;

