//phpOption parserClass:JisonParser_Html

//Lexical Grammer
%lex

LINE_END                        (\n\r|\r\n|[\n\r])
HTML_TAG_INLINE                 "<"(.|\n)[^>]*?"/>"
HTML_TAG_CLOSE                  "</"(.|\n)[^>]*?">"
HTML_TAG_OPEN                   "<"(.|\n)[^>]*?">"

%s htmlElement

%%
{HTML_TAG_INLINE}
	%{
		//A tag that doesn't need to track state
		//php if (JisonParser_Html_Handler::isHtmlTag($yytext) == true) {
		//php   $yytext = $this->inlineTag($yytext);
		//php   return "HTML_TAG_INLINE";
		//php }

		//A non-valid html tag, return "<" put the rest back into the parser
        //php if (isset($yytext{0})) {
        //php   $tag = $yytext;
        //php   $yytext = $yytext{0};
        //php   $this->unput(substr($tag, 1));
        //php }
        //php return 'CONTENT';
		//cs return 'CONTENT';
	%}


<htmlElement><<EOF>>
	%{
		//A tag that was left open, and needs to close
		//php $name = end($this->htmlElementsStack);
		//php $keyStack = key($this->htmlElementStack);
		//php end($this->htmlElementStack[$keyStack]);
		//php $keyElement = key($this->htmlElementStack[$keyStack]);
		//php $tag = &$this->htmlElementStack[$keyStack][$keyElement];
		//php $tag['state'] = 'repaired';
		//php if (!empty($tag['name'])) {
		//php   $this->unput('</' . $tag['name'] . '>');
		//php }
		//php return 'CONTENT';
		
		//cs return 'CONTENT';
	%}
<htmlElement>{HTML_TAG_CLOSE}
	%{
		//A tag that is open and we just found the close for it
		//php $element = $this->unStackHtmlElement($yytext);
		//php if ($this->compareElementClosingToYytext($element, $yytext) && $this->htmlElementsStackCount == 0) {
		//php   $yytext = $element;
		//php   $this->popState();
    	//php   return "HTML_TAG_CLOSE";
    	//php }
    	//php return 'CONTENT';
		
		//cs return 'CONTENT';
	%}
{HTML_TAG_OPEN}
	%{
		//An tag open
		//php if (JisonParser_Html_Handler::isHtmlTag($yytext) == true) {
		//php   if ($this->stackHtmlElement($yytext)) {
		//php       if ($this->htmlElementsStackCount == 1) {
		//php           $this->begin('htmlElement');
    	//php           return "HTML_TAG_OPEN";
    	//php       }
    	//php   }
    	//php   return 'CONTENT';
    	//php }

    	//A non-valid html tag, return the first character in the stack and put the rest back into the parser
    	//php if (isset($yytext{0})) {
        //php   $tag = $yytext;
        //php   $yytext = $yytext{0};
        //php   $this->unput(substr($tag, 1));
        //php }
        //php return 'CONTENT';
		
		//cs return 'CONTENT';
	%}
{HTML_TAG_CLOSE}
	%{
		//A tag that was not opened, needs to be ignored
    	//php return 'CONTENT';
		
		//cs return 'CONTENT';
	%}
([A-Za-z0-9 .,?;]+)                         return 'CONTENT';

([ ])                                       return 'CONTENT';
{LINE_END}
	%{
		//php if ($this->htmlElementsStackCount == 0 || $this->isStaticTag == true) {
		//php   return 'LINE_END';
		//php }
		//php return 'CONTENT';
		
		//cs return 'CONTENT';
	%}
(.)                                         return 'CONTENT';
<<EOF>>										return 'EOF';

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
		return new ParserValue(""); //js
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
		
		//cs $1.StringValue += $2.StringValue;
		//cs $$ = $1;
	}
 ;

content
 : CONTENT
    {
        //php $$ = $this->content($1);
		//cs $$ = $1;
    }
 | LINE_END
    {
        //php $$ = $this->lineEnd($1);
		//cs $$ = $1;
    }
 | HTML_TAG_INLINE
	{
	    //php $$ = $this->toWiki($1);
		//cs $$ = $1;
	}
 | HTML_TAG_OPEN contents HTML_TAG_CLOSE
	{
	    //php $$ = $this->toWiki($3, $2);
		//cs $$ = $1;
	}
 | HTML_TAG_OPEN HTML_TAG_CLOSE
	{
	    //php $$ = $this->toWiki($2);
		//cs $$ = $2;
	}
 ;