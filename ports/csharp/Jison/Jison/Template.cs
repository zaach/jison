using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;

/**/namespace Jison/**/
{
	public /**/class Definition/**/ : Base
	{
        new public ParserSymbols Symbols;
		new public Dictionary<int, ParserSymbol> Terminals;
		new public Dictionary<int, ParserProduction> Productions;
		new public Dictionary<int, ParserState> Table;
		new public Dictionary<int, ParserAction> DefaultActions;
		new public bool Debug = false;

		/**/public Definition/**/()
        {
            //Setup Parser
            //@@PARSER_INJECT@@

            //Setup Lexer
            //@@LEXER_INJECT@@
        }

        public ParserValue ParserPerformAction(ref ParserValue thisS, ref ParserValue yy, ref int yystate, ref JList<ParserValue> ss)
		{
			var so = ss.Count - 1;//@@ParserPerformActionInjection@@
            return null;
		}
		
		public dynamic LexerPerformAction(int avoidingNameCollisions, string Yy_Start)
		{
			//@@LexerPerformActionInjection@@
			return -1;
		}
	}
}
