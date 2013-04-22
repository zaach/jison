//phpOption parserClass:Formula
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
	if (yy.obj.type == 'cell') return 'SHEET';//js
	return 'VARIABLE';//js

	//php if ($this->type == 'cell') return 'SHEET';
	//php return 'VARIABLE';
%}
'$'[A-Za-z]+'$'[0-9]+
%{
	if (yy.obj.type == 'cell') return 'FIXEDCELL';//js
	return 'VARIABLE';//js

	//php if ($this->type == 'cell') return 'FIXEDCELL';
    //php return 'VARIABLE';
%}
[A-Za-z]+[0-9]+
%{
	if (yy.obj.type == 'cell') return 'CELL';//js
	return 'VARIABLE';//js

	//php if ($this->type == 'cell') return 'CELL';
    //php return 'VARIABLE';
%}
[A-Za-z]+(?=[(])    				{return 'FUNCTION';}
[A-Za-z]{1,}[A-Za-z_0-9]+			{return 'VARIABLE';}
[A-Za-z_]+           				{return 'VARIABLE';}
[0-9]+          			  		{return 'NUMBER';}
"$"									{/* skip whitespace */}
" "									{return ' ';}
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
"PI"								{return 'PI';}
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
			$$ = yy.handler.variable.apply(yy.obj, $1);//js
            //php $$ = $this->variable($1);
		}
	| TIME_AMPM
		{
			$$ = yy.handler.time.apply(yy.obj, [$1, true]);//js
		}
	| TIME_24
		{
			$$ = yy.handler.time.apply(yy.obj, [$1]);//js
		}
	| number
		{
			//php $$ = $1 * 1;

			$$ = yy.handler.number.apply(yy.obj, [$1]);//js
		}
	| STRING
		{
			$$ = $1.substring(1, $1.length - 1);//js
			//php $$ = substr($1, 1, -1);
		}
	| expression '=' expression
		{
			//php $$ = $1 == $3;

			yy.obj.html.pop();//js
			$$ = yy.handler.callFunction.apply(yy.obj, ['EQUAL', [$1, $3]]);//js
		}
	| expression '+' expression
		{
			$$ = yy.handler.performMath.apply(yy.obj, ['+', $1, $3]);//js
			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js

			//php if (is_numeric($1) && is_numeric($3)) {
			//php   $$ = $1 + $3;
			//php } else {
			//php   $$ = $1 . $3;
			//php }
		}
	| '(' expression ')'
		{$$ = yy.handler.number.apply(yy.obj, [$2]);//js}
	| expression '<' '=' expression
		{
			//php $$ = ($1 * 1) <= ($4 * 1);
			$$ = yy.handler.callFunction.apply(yy.obj, ['LESS_EQUAL', [$1, $3]]);//js
		}
	| expression '>' '=' expression
		{
			//php $$ = ($1 * 1) >= ($4 * 1);
			$$ = yy.handler.callFunction.apply(yy.obj, ['GREATER_EQUAL', [$1, $3]]);//js
		}
	| expression '<' '>' expression
		{
			$$ = ($1 * 1) != ($4 * 1);

			if (isNaN($$)) $$ = 0;//js

			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js
		}
	| expression NOT expression
		{
			$$ = $1 != $3;

			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js
		}
	| expression '>' expression
		{
			//php $$ = ($1 * 1) > ($3 * 1);

			$$ = yy.handler.callFunction.apply(yy.obj, ['GREATER', [$1, $3]]);//js
		}
	| expression '<' expression
		{
			//php $$ = ($1 * 1) < ($3 * 1);

			$$ = yy.handler.callFunction.apply(yy.obj, ['LESS', [$1, $3]]);//js
		}
	| expression '-' expression
		{
			$$ = ($1 * 1) - ($3 * 1);

			$$ = yy.handler.performMath.apply(yy.obj, ['-', $1, $3]);//js
			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js
		}
	| expression '*' expression
		{
			//php $$ = ($1 * 1) * ($3 * 1);

			$$ = yy.handler.performMath.apply(yy.obj, ['*', $1, $3]);//js
			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js
		}
	| expression '/' expression
		{
			//php $$ = ($1 * 1) / ($3 * 1);

			$$ = yy.handler.performMath.apply(yy.obj, ['/', $1, $3]);//js
			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js
		}
	| expression '^' expression
		{
			var n1 = yy.handler.number.apply(yy.obj, [$1]),//js
				n2 = yy.handler.number.apply(yy.obj, [$3]);//js

			$$ = yy.handler.performMath.apply(yy.obj, ['^', $1, $3]);//js
			yy.obj.html.pop();//js
			yy.obj.html.pop();//js
			yy.obj.html.push(null);//js

			//php $$ = pow(($1 * 1), ($3 * 1));
		}
	| '-' expression
		{
			var n1 = yy.handler.number.apply(yy.obj, [$2]);//js
			$$ = n1 * -1;//js
			if (isNaN($$)) $$ = 0;//js

			//php $$ = $1 * 1;
		}
	| '+' expression
		{
			var n1 = yy.handler.number.apply(yy.obj, [$2]);//js
			$$ = n1 * 1;//js
			if (isNaN($$)) $$ = 0;//js

			//php $$ = $1 * 1;
		}
	| E
		{/*$$ = Math.E;*/;}
	| FUNCTION '(' ')'
		{
			$$ = yy.handler.callFunction.apply(yy.obj, [$1, '']);//js
			//php $$ = $this->callFunction($1);
		}
	| FUNCTION '(' expseq ')'
		{
			$$ = yy.handler.callFunction.apply(yy.obj, [$1, $3]);//js
			//php $$ = $this->callFunction($1, $3);
		}
	| cell
	| error
	| error error
;

cell :
	FIXEDCELL
		{
			$$ = yy.handler.fixedCellValue.apply(yy.obj, [$1]);//js
			//php $$ = $this->fixedCellValue($1);
		}
	| FIXEDCELL ':' FIXEDCELL
		{
			$$ = yy.handler.fixedCellRangeValue.apply(yy.obj, [$1, $3]);//js
			//php $$ = $this->fixedCellRangeValue($1, $3);
		}
	| CELL
		{
			$$ = yy.handler.cellValue.apply(yy.obj, [$1]);//js
			//php $$ = $this->cellValue($1);
		}
	| CELL ':' CELL
		{
			$$ = yy.handler.cellRangeValue.apply(yy.obj, [$1, $3]);//js
			//php $$ = $this->cellRangeValue($1, $3);
		}
	| SHEET '!' CELL
		{
			$$ = yy.handler.remoteCellValue.apply(yy.obj, [$1, $3]);//js
			//php $$ = $this->remoteCellValue($1, $3);
		}
	| SHEET '!' CELL ':' CELL
		{
			$$ = yy.handler.remoteCellRangeValue.apply(yy.obj, [$1, $3, $5]);//js
			//php $$ = $this->remoteCellRangeValue($1, $3, $5);
		}
;

expseq : 
	expression
		{
			$$ = [$1];//js
			//php $$ = array($1);
		}
	| expseq ';' expression
	    {
	        $1.push($3);//js
	        $$ = $1;//js

			//php $1[] = $3;
			//php $$ = $1;
	    }
 	| expseq ',' expression
		{
	        $1.push($3);//js
	        $$ = $1;//js

			//php $1[] = $3;
			//php $$ = $1;
	    }
 ;


variableSequence :
	VARIABLE
		{
			$$ = [$1];//js
			//php $$ = array($1);
		}
	| variableSequence DECIMAL VARIABLE
		{
			$$ = ($.isArray($1) ? $1 : [$1]);//js
            $$.push($3);//js

            //php $$ = (is_array($1) ? $1 : array());
            //php $$[] = $3;
		}
;

number :
	NUMBER
		{
			$$ = $1 * 1;
		}
	| NUMBER DECIMAL NUMBER
		{
			$$ = ($1 + '.' + $3) * 1;//js
			//php $$ = $1 . '.' . $3;
		}
	| number '%'
		{
			yy.obj.html.push($1 + $2);//js
			$$ = $1 * 0.01;
		}
;

error :
	'#' VARIABLE '!' {
			$$ = $1 + $2 + $3;
      	}
    | VARIABLE '#' VARIABLE '!' {
			$$ = $2 + $3 + $4;
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