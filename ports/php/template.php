<?php
require_once('base.php');
/**/class Definition/**/ extends Jison_Base
{
	public $type = "Cell";

	function __construct()
    {
        //Setup Parser
        //@@PARSER_INJECT@@

        //Setup Lexer
        //@@LEXER_INJECT@@
    }

    function parserPerformAction(&$thisS, $yy, $yystate, $s)
	{
		$o = count($s) - 1;//@@ParserPerformActionInjection@@
	}

	function LexerPerformAction($avoidingNameCollisions, $Yy_Start)
	{
		//@@LexerPerformActionInjection@@
	}
}
