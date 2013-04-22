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
		//cs PopState();
		this.popState();//js
		return 'tagClose';
	%}

{tagClose}
	%{//close
    	return 'tagClose';
	%}

{tagOpen}
	%{//open
		//cs Begin("htmlElement");
		this.begin("htmlElement");//js
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
		//php $$ = "";
		//cs $$ = new ParserValue("");
		$$ = "";//js
	}
 ;

contents
 : content
	{
		//php $$ = $1;
		//cs $1.StringValue = $1.Text;
		//cs $$ = $1;
		$$ = $1;//js
	}
 | contents content
	{
		//php $$ = $1 . $2;
		//cs $1.StringValue = $1.Text = $1.Text + $2.Text;
		//cs $$ = $1;
		$$ = $1 + $2;//js
	}
 ;

content
 : string
    {
        //php $$ = $1;
		//string
		//cs $$ = $1;
		$$ = "";//js
    }
 | lineEnd
    {
        //php $$ = $1;
		//cs $$ = $1;
		$$ = "";//js
    }
 | tag
	{
	    //php $$ = $1;
		//cs $$ = $1;
		$$ = $1;//js
	}
 | tagOpen contents tagClose
	{
	    //php $$ = $1 . $2 . $3;
		//cs $1.StringValue = $1.Text = $1.Text + $2.Text + $3.Text;
		//cs $$ = $1;
		$$ = $1 + $2 + $3;//js
	}
 | tagOpen tagClose
	{
	    //php $$ = $1 . $2;
		//cs $1.StringValue = $1.Text = $1.Text + $2.Text;
		//cs $$ = $1;
		$$ = $1 + $2;//js
	}
;