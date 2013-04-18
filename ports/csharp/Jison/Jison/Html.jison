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
		return 'tagClose';
	%}
{tagClose}
	%{//close
    	return 'tagClose';
	%}
{tagOpen}
	%{//open
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
		//php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("");
		$$ = "";//js
	}
 ;

contents
 : content
	{
		//php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("content");
		$$ = "";//js
	}
 | contents content
	{
		//php $$ = $this->toWiki("");
		//cs $$ = new ParserValue($1.StringValue + "content");
		$$ = "";//js
	}
 ;

content
 : string
    {
        //php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("string");
		$$ = "";//js
    }
 | lineEnd
    {
        //php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("lineEnd");
		$$ = "";//js
    }
 | tag
	{
	    //php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("tag");
		$$ = "";//js
	}
 | tagOpen contents tagClose
	{
	    //php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("open");
		$$ = "";//js
	}
 | tagOpen tagClose
	{
	    //php $$ = $this->toWiki("");
		//cs $$ = new ParserValue("tag");
		$$ = "";//js
	}
 ;