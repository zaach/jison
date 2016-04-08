//option parserValue:Expression
//option namespace:jQuerySheet

/* description: Parses end evaluates mathematical expressions. */
/* lexical grammar */
%lex
%%
\s+									{/* skip whitespace */}
'"'("\\"["]|[^"])*'"'				{return 'STRING';}
"'"('\\'[']|[^'])*"'"				{return 'STRING';}
[A-Za-z]{1,}[A-Za-z_0-9]+(?=[(])    {return 'FUNCTION';}
([0]?[1-9]|1[0-2])[:][0-5][0-9]([:][0-5][0-9])?[ ]?(AM|am|aM|Am|PM|pm|pM|Pm)
									{return 'TIME_AMPM';}
([0]?[0-9]|1[0-9]|2[0-3])[:][0-5][0-9]([:][0-5][0-9])?
									{return 'TIME_24';}
'SHEET'[0-9]+
%{
	//js
	if (yy.obj.type == 'cell') return 'SHEET';
	return 'VARIABLE';
	
	/*php
		if ($this->type == 'cell') return 'SHEET';
		return 'VARIABLE';
	*/
	
	/*cs
		return 'SHEET';
		//return 'VARIABLE';
	*/
%}
'$'[A-Za-z]+'$'[0-9]+
%{
	//js
	if (yy.obj.type == 'cell') return 'FIXEDCELL';
	return 'VARIABLE';

	/*php
		if ($this->type == 'cell') return 'FIXEDCELL';
		return 'VARIABLE';
	*/
	
	/*cs
		return 'FIXEDCELL';
		//return 'VARIABLE';
	*/
%}
[A-Za-z]+[0-9]+
%{
	//js
	if (yy.obj.type == 'cell') return 'CELL';
	return 'VARIABLE';

	/*php
		if ($this->type == 'cell') return 'CELL';
		return 'VARIABLE';
	*/
	
	/*cs
		return 'CELL';
		//return 'VARIABLE';
	*/
%}
[A-Za-z]+(?=[(])    				{return 'FUNCTION';}
[A-Za-z]{1,}[A-Za-z_0-9]+			{return 'VARIABLE';}
[A-Za-z_]+           				{return 'VARIABLE';}
[0-9]+          			  		{return 'NUMBER';}
"\s"								{/* skip whitespace */}
[.]									{return 'DECIMAL';}
":"									{return ':';}
";"									{return ';';}
","									{return ',';}
"*" 								{return '*';}
"/" 								{return '/';}
"-" 								{return '-';}
"+" 								{return '+';}
"^" 								{return '^';}
"(" 								{return '(';}
")" 								{return ')';}
">" 								{return '>';}
"<" 								{return '<';}
"NOT"								{return 'NOT';}
"E"									{return 'E';}
'"'									{return '"';}
"'"									{return "'";}
"!"									{return "!";}
"="									{return '=';}
"%"									{return '%';}
[#]									{return '#';}
<<EOF>>								{return 'EOF';}


/lex

/* operator associations and precedence (low-top, high- bottom) */
%left '='
%left '<=' '>=' '<>' 'NOT' '||'
%left '>' '<'
%left '+' '-'
%left '*' '/'
%left '^'
%left '%'
%left UMINUS

%start expressions

%% /* language grammar */

expressions
: expression EOF
     {return $1;}
 ;

expression :
	variableSequence
		{
			//js
			$$ = yy.handler.variable.apply(yy.obj, $1);
            
			//php $$ = $this->variable($1);
			
			/*cs
				$$ = $1;
			*/
		}
	| TIME_AMPM
		{
			//js
			$$ = yy.handler.time.apply(yy.obj, [$1, true]);
			//
		}
	| TIME_24
		{
			//js
			$$ = yy.handler.time.apply(yy.obj, [$1]);
			//
		}
	| number
		{
			//js
			$$ = yy.handler.number.apply(yy.obj, [$1]);
			
			//php $$ = $1 * 1;
			
			/*cs
				$1.ToDouble();
				$$ = $1;
			*/
		}
	| STRING
		{
			//js
			$$ = $1.substring(1, $1.length - 1);
			
			//php $$ = substr($1, 1, -1);
			
			/*cs
				$1.ToString();
				$$ = $1;
			*/
		}
	| expression '=' expression
		{
			//js
			yy.obj.html.pop();
			$$ = yy.handler.callFunction.apply(yy.obj, ['EQUAL', [$1, $3]]);
			
			//php $$ = $1 == $3;
			
			/*cs
				$1.Set($1.Text == $3.Text);
				$$ = $1;
			*/
		}
	| expression '+' expression
		{
			//js
			$$ = yy.handler.performMath.apply(yy.obj, ['+', $1, $3]);
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);

			/*php
				if (is_numeric($1) && is_numeric($3)) {
					$$ = $1 + $3;
				} else {
					$$ = $1 . $3;
				}
			*/
			
			/*cs
				if ($1.IsNumeric()) {
					$1.ToDouble();
					$1.Add($3);
					$$ = $1;
				} else {
					$1.ToString();
					$1.Concat($3);
					$$ = $1;
				}
			*/
		}
	| '(' expression ')'
		{
			//js
			$$ = yy.handler.number.apply(yy.obj, [$2]);
			//
		}
	| expression '<' '=' expression
		{
			//js
			$$ = yy.handler.callFunction.apply(yy.obj, ['LESS_EQUAL', [$1, $3]]);
			
			//php $$ = ($1 * 1) <= ($4 * 1);
			
			/*cs
				$1.Set($1.ToDouble() <= $4.ToDouble());
				$$ = $1;
			*/
		}
	| expression '>' '=' expression
		{
			//js
			$$ = yy.handler.callFunction.apply(yy.obj, ['GREATER_EQUAL', [$1, $3]]);
			
			//php $$ = ($1 * 1) >= ($4 * 1);
			
			/*cs
				$1.Set($1.ToDouble() >= $4.ToDouble());
				$$ = $1;
			*/
		}
	| expression '<' '>' expression
		{
			//js|php
			$$ = ($1 * 1) != ($4 * 1);
			
			//js
			if (isNaN($$)) $$ = 0;
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);
			//
			
			/*cs
				$1.Set($1.Text != $4.Text);
				$$ = $1;
			*/
		}
	| expression NOT expression
		{
			//js|php
			$$ = $1 != $3;

			//js
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);
			//
			
			/*cs
				$1.Set($1.Text != $3.Text);
				$$ = $1;
			*/
		}
	| expression '>' expression
		{
			//js
			$$ = yy.handler.callFunction.apply(yy.obj, ['GREATER', [$1, $3]]);
			
			//php $$ = ($1 * 1) > ($3 * 1);
			
			/*cs
				$1.Set($1.ToDouble() > $3.ToDouble());
				$$ = $1;
			*/
		}
	| expression '<' expression
		{
			//js
			$$ = yy.handler.callFunction.apply(yy.obj, ['LESS', [$1, $3]]);
			
			//php $$ = ($1 * 1) < ($3 * 1);
			
			/*cs
				$1.Set($1.ToDouble() < $3.ToDouble());
				$$ = $1;
			*/
		}
	| expression '-' expression
		{
			//js|php
			$$ = ($1 * 1) - ($3 * 1);

			//js
			$$ = yy.handler.performMath.apply(yy.obj, ['-', $1, $3]);
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);
			
			/*cs
				$1.Set($1.ToDouble() - $3.ToDouble());
				$$ = $1;
			*/
		}
	| expression '*' expression
		{
			//js
			$$ = yy.handler.performMath.apply(yy.obj, ['*', $1, $3]);
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);
			
			//php $$ = ($1 * 1) * ($3 * 1);
			
			/*cs
				$1.Set($1.ToDouble() * $3.ToDouble());
				$$ = $1;
			*/
		}
	| expression '/' expression
		{
			//js
			$$ = yy.handler.performMath.apply(yy.obj, ['/', $1, $3]);
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);
			
			//php $$ = ($1 * 1) / ($3 * 1);
			
			/*cs
				$1.Set($1.ToDouble() / $3.ToDouble());
				$$ = $1;
			*/
		}
	| expression '^' expression
		{
			//js
			var n1 = yy.handler.number.apply(yy.obj, [$1]),
				n2 = yy.handler.number.apply(yy.obj, [$3]);

			$$ = yy.handler.performMath.apply(yy.obj, ['^', $1, $3]);
			yy.obj.html.pop();
			yy.obj.html.pop();
			yy.obj.html.push(null);

			//php $$ = pow(($1 * 1), ($3 * 1));
			
			/*cs
				$1.Set(Math.Pow($1.ToDouble(), $3.ToDouble()));
				$$ = $1;
			*/
		}
	| '-' expression
		{
			//js
			var n1 = yy.handler.number.apply(yy.obj, [$2]);
			$$ = n1 * -1;
			if (isNaN($$)) $$ = 0;

			//php $$ = $1 * 1;
			
			/*cs
				$2.Set(-$2.ToDouble());
				$$ = $2;
			*/
		}
	| '+' expression
		{
			//js
			var n1 = yy.handler.number.apply(yy.obj, [$2]);
			$$ = n1 * 1;
			if (isNaN($$)) $$ = 0;

			//php $$ = $1 * 1;
			
			/*cs
				$2.Set($2.ToDouble());
				$$ = $2;
			*/
		}
	| E
		{/*$$ = Math.E;*/;}
	| FUNCTION '(' ')'
		{
			//js
			$$ = yy.handler.callFunction.apply(yy.obj, [$1, '']);
			
			//php $$ = $this->callFunction($1);
			
			/*cs
				$$ = Functions.Call($1.Text);
			*/
		}
	| FUNCTION '(' expseq ')'
		{
			//js
			$$ = yy.handler.callFunction.apply(yy.obj, [$1, $3]);
			
			//php $$ = $this->callFunction($1, $3);
			
			/*cs
				$$ = Functions.Call($1.Text, $3);
			*/
		}
	| cell
	| error
	| error error
;

cell :
	FIXEDCELL
		{
			//js
			$$ = yy.handler.fixedCellValue.apply(yy.obj, [$1]);
			
			//php $$ = $this->fixedCellValue($1);
			
			/*cs
				$$ = Spreadsheet.CellValue(Location.ParseFixed($1.Text));
			*/
		}
	| FIXEDCELL ':' FIXEDCELL
		{
			//js
			$$ = yy.handler.fixedCellRangeValue.apply(yy.obj, [$1, $3]);
			
			//php $$ = $this->fixedCellRangeValue($1, $3);
			
			/*cs
				$$ = Spreadsheet.CellValue(Location.ParseFixed($1.Text), Location.ParseFixed($3.Text));
			*/
		}
	| CELL
		{
			//js
			$$ = yy.handler.cellValue.apply(yy.obj, [$1]);
			
			//php $$ = $this->cellValue($1);
			
			/*cs
				$$ = Spreadsheet.CellValue(Location.Parse($1.Text));
			*/
		}
	| CELL ':' CELL
		{
			//js
			$$ = yy.handler.cellRangeValue.apply(yy.obj, [$1, $3]);
			
			//php $$ = $this->cellRangeValue($1, $3);
			
			/*cs
				$$ = Spreadsheet.CellValue(Location.Parse($1.Text), Location.Parse($3.Text));
			*/
		}
	| SHEET '!' CELL
		{
			//js
			$$ = yy.handler.remoteCellValue.apply(yy.obj, [$1, $3]);
			
			//php $$ = $this->remoteCellValue($1, $3);
			
			/*cs
				$$ = Spreadsheet.CellValue(Location.ParseRemote($1.Text, $3.Text));
			*/
		}
	| SHEET '!' CELL ':' CELL
		{
			//js
			$$ = yy.handler.remoteCellRangeValue.apply(yy.obj, [$1, $3, $5]);
			
			//php $$ = $this->remoteCellRangeValue($1, $3, $5);
			
			/*cs
				$$ = Spreadsheet.CellValue(Location.ParseRemote($1.Text, $3.Text), Location.ParseRemote($1.Text, $5.Text));
			*/
		}
;

expseq : 
	expression
		{
			//js
			$$ = [$1];
			
			//php $$ = array($1);
			
			/*cs
				$$ = $1;
			*/
		}
	| expseq ';' expression
	    {
			//js
	        $1.push($3);
	        $$ = $1;

			/*php
				$1[] = $3;
				$$ = $1;
			*/
			
			/*cs
				$1.Push($3);
				$$ = $1;
			*/
	    }
 	| expseq ',' expression
		{
			//js
	        $1.push($3);
	        $$ = $1;

			/*php
				$1[] = $3;
				$$ = $1;
			*/
			
			/*cs
				$1.Push($3);
				$$ = $1;
			*/
	    }
 ;


variableSequence :
	VARIABLE
		{
			//js
			$$ = [$1];
			
			//php $$ = array($1);
			
			/*cs
				$$ = $1;
			*/
		}
	| variableSequence DECIMAL VARIABLE
		{
			//js
			$$ = ($.isArray($1) ? $1 : [$1]);
            $$.push($3);

            /*php
				$$ = (is_array($1) ? $1 : array());
				$$[] = $3;
			*/
			
			/*cs
				$1.Push($3);
				$$ = $1;
			*/
		}
;

number :
	NUMBER
		{
			//js|php
			$$ = $1 * 1;
			
			/*cs
				$1.ToDouble();
				$$ = $1;
			*/
		}
	| NUMBER DECIMAL NUMBER
		{
			//js
			$$ =($1 + '.' + $3) * 1;
			
			//php $$ = $1 . '.' . $3;
			
			/*cs
				$1.Text += "." + $3.Text;
				$1.ToDouble();
				$$ = $1;
			*/
		}
	| number '%'
		{
			//js
			yy.obj.html.push($1 + $2);
			
			//js|php
			$$ = $1 * 0.01;
			
			/*cs
				$1.Set($1.ToDouble() * 0.01);
				$$ = $1;
			*/
		}
;

error :
	'#' VARIABLE '!' {
			//js
			$$ = $1 + $2 + $3;
			
			//php $$ = $1 . $2 . $3;
			
			/*cs
				$1.Set($1.Text + $2.Text + $3.Text);
				$$ = $1;
			*/
      	}
    | VARIABLE '#' VARIABLE '!' {
			//js
			$$ = $2 + $3 + $4;
			
			//php $$ = $2 . $3 . $4;
			
			/*cs
				$1.Set($1.Text + $2.Text + $3.Text + $4.Text);
				$$ = $1;
			*/
		}
;

%%
if (typeof(window) !== 'undefined') {
	window.Formula = function(handler) {
		var formulaLexer = function () {};
		formulaLexer.prototype = formula.lexer;

		var formulaParser = function () {
			this.lexer = new formulaLexer();
			this.yy = {};
		};

		formulaParser.prototype = formula;
		var newParser = new formulaParser;
		newParser.setObj = function(obj) {
			newParser.yy.obj = obj;
		};
		newParser.yy.handler = handler;
		return newParser;
	};
}
