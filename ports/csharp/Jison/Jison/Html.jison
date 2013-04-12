//phpOption parserClass:JisonParser_Html

//Lexical Grammer
%lex

REG_LINE_END                        (\n\r|\r\n|[\n\r])
REG_HTML_TAG_INLINE                 "<"(.|\n)[^>]*?"/>"
REG_HTML_TAG_CLOSE                  "</"(.|\n)[^>]*?">"
REG_HTML_TAG_OPEN                   "<"(.|\n)[^>]*?">"

%s htmlElement

%%
{REG_HTML_TAG_INLINE}
	%{
		//A tag that doesn't need to track state
		return "HTML_TAG_INLINE";
	%}


<htmlElement><<EOF>>
	%{
		//A tag that was left open, and needs to close
		//php $this->popState();
		//cs PopState();
		this.popState();//js

		return "EOF";
	%}
<htmlElement>{REG_HTML_TAG_CLOSE}
	%{
		//A tag that is open and we just found the close for it
		//php $this->popState();
		//cs PopState();
		this.popState();//js

		return "HTML_TAG_CLOSE";
	%}
{REG_HTML_TAG_OPEN}
	%{
		//An tag open

		//php $this->begin("htmlElement");

		//cs Begin("htmlElement");

		this.begin("htmlElement");//js

		return "HTML_TAG_OPEN";
	%}
{REG_HTML_TAG_CLOSE}
	%{
		//A tag that was not opened, needs to be ignored
		return "HTML_TAG_CLOSE";
	%}
([A-Za-z0-9 .,?;]+)                         return "CONTENT";

([ ])                                       return "CONTENT";
{REG_LINE_END}
	%{
		//Line end
		return "LINE_END";
	%}
(.)                                         return "CONTENT";
<<EOF>>										return "EOF";

/lex

//Parsing Grammer
%%

wiki
 : contents
 	{return $1;}
 | contents EOF
	{return $1;}
 | EOF
    {
		return ""; //js
		//php return "";
		//cs return new ParserValue("");
	}
 ;

contents
 : content
	{$$ = $1;}
 | contents content
	{
		//php $$ = $1 . $2;
		
		//cs $$ = new ParserValue($1.StringValue + $2.StringValue);

		$$ = $1 + $2;//js
	}
 ;

content
 : CONTENT
    {
        //php $$ = $this->content($1);
		//cs $$ = new ParserValue($1);
		$$ = $1;//js
    }
 | LINE_END
    {
        //php $$ = $this->lineEnd($1);
		//cs $$ = new ParserValue($1);
		$$ = $1;//js
    }
 | HTML_TAG_INLINE
	{
	    //php $$ = $this->toWiki($1);
		//cs $$ = new ParserValue("");
		$$ = '';//js
	}
 | HTML_TAG_OPEN contents HTML_TAG_CLOSE
	{
	    //php $$ = $2;
		//cs $$ = new ParserValue($2);
		$$ = $2;//js
	}
 | HTML_TAG_OPEN HTML_TAG_CLOSE
	{
	    //php $$ = $this->toWiki($2);
		//cs $$ = new ParserValue("");
		$$ = '';//js
	}
 ;