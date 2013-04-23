//phpOption parserClass:JisonParser_Html

//Lexical Grammer
%lex

lineEnd (\n\r|\r\n|[\n\r])
tag "<"(.|\n)[^>]*?"/>"
tagClose "</"(.|\n)[^>]*?">"
tagOpen "<"(.|\n)[^>]*?">"

%s htmlElement

%%
{tag}
	%{
        return 'tag';
	%}

<htmlElement><<EOF>>
	%{
		return 'eof';
	%}

<htmlElement>{tagClose}
	%{
		//js
		this.popState();
		return 'tagClose';

		//cs PopState();
	%}

{tagClose}
	%{
    	return 'tagClose';
	%}

{tagOpen}
	%{
		//js
		this.begin("htmlElement");
		
		//cs Begin("htmlElement");
		
		return 'tagOpen';
	%}

([A-Za-z0-9 .,?;]+) return 'string';

([ ]) return 'string';

{lineEnd}
	%{
		return 'lineEnd';
	%}

(.) return 'string';
<<EOF>> return 'eof';

/lex

//Parsing Grammer
%%

wiki
 : contents
 	{return $1;}
 | contents eof
	{return $1;}
 | eof
    {
		//js
		$$ = "";
		
		//php $$ = "";
		
		//cs $$ = new ParserValue("");
	}
 ;

contents
 : content
	{
		//js
		$$ = $1;
		
		//php $$ = $1;
		
		/*cs
			$1.StringValue = $1.Text;
			$$ = $1;
		*/
	}
 | contents content
	{
		//js
		$$ = $1 + $2;

		//php $$ = $1 . $2;

		/*cs
			$1.StringValue = $1.Text = $1.Text + $2.Text;
			$$ = $1;
		*/
	}
 ;

content
 : string
    {
        //js
		$$ = "";
		
		//php $$ = $1;
		
		//cs $$ = $1;
    }
 | lineEnd
    {
        //js
		$$ = "";
		
		//php $$ = $1;
		
		//cs $$ = $1;
    }
 | tag
	{
	    //js
		$$ = $1;
		
		//php $$ = $1;
		
		//cs $$ = $1;
	}
 | tagOpen contents tagClose
	{
	    //js
		$$ = $1 + $2 + $3;
		
		//php $$ = $1 . $2 . $3;
		
		/*cs
			$1.StringValue = $1.Text = $1.Text + $2.Text + $3.Text;
			$$ = $1;
		*/
	}
 | tagOpen tagClose
	{
	    //js
		$$ = $1 + $2;
		
		//php $$ = $1 . $2;
		
		/*cs
			$1.StringValue = $1.Text = $1.Text + $2.Text;
			$$ = $1;
		*/
	}
;