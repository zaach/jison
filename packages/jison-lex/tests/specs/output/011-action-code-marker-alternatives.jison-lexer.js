{
  error: {
    message: `Could not parse jison lexer spec in JSON AUTODETECT mode:
in JISON Mode we get Error: Lexical error on line 65: 
Incorrectly terminated action code block. We're expecting the
'%}' end marker to go with the given start marker.
Regrettably, it does not exist in the remainder of the input.

  Erroneous area:
62:                return yytext;
63:            }}}}}
64: 
65: g             %{
^^................^^
66:       var msg = 'millenium hand';
67:                log(rmCommonWS\`

while JSON5 Mode produces Error: JSON5: invalid character '%' at 7:1`,
    type: 'Error',
    stack: `SyntaxError: JSON5: invalid character '%' at 7:1
    at syntaxError (\index.js:1325:21)
    at invalidChar (\index.js:1270:16)
    at Object.value (\index.js:349:19)
    at lex (\index.js:128:46)
    at Object.parse (\index.js:74:21)
    at autodetectAndConvertToJSONformat (\regexp-lexer-cjs-es5.js:8518:31)
    at processGrammar (\regexp-lexer-cjs-es5.js:9641:12)
    at test_me (\regexp-lexer-cjs-es5.js:9322:16)
    at new RegExpLexer (\regexp-lexer-cjs-es5.js:9412:17)
    at Context.testEachLexerExample (\regexplexer.js:3053:17)
    at callFn (\runnable.js:372:21)
    at Test.Runnable.run (\runnable.js:364:7)
    at Runner.runTest (\runner.js:455:10)
    at \runner.js:573:12
    at next (\runner.js:369:14)
    at \runner.js:379:7
    at next (\runner.js:303:14)
    at Immediate.<anonymous> (\runner.js:347:5)
    at runCallback (timers.js:794:20)
    at tryOnImmediate (timers.js:752:5)
    at processImmediate [as _immediateCallback] (timers.js:729:5)`,
  },
}