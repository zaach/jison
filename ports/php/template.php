<?php
/* Jison base parser */

/**/require_once('base.php');/**/

/**/class Definition/**/ extends Jison_Base
{
	function __construct()
    {
        //Setup Parser
        //@@PARSER_INJECT@@

        //Setup Lexer
        //@@LEXER_INJECT@@
    }

    function parserPerformAction(&$thisS, &$yy, $yystate, &$s, $o)
	{
		//@@ParserPerformActionInjection@@
	}

	function LexerPerformAction($avoidingNameCollisions, $YY_START = null)
	{
		//@@LexerPerformActionInjection@@
	}
}
