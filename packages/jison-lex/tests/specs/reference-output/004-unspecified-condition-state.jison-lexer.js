{
  error: {
    message: `Could not parse jison lexer spec in JSON AUTODETECT mode:
in JISON Mode we get Error: 
You specified an unknown lexer condition state 'NUMBER'.
Is this a typo or did you forget to include this one in the '%s' and '%x'
inclusive and exclusive condition state sets specifications at the top of
the lexer spec?
    
As a rough example, things should look something like this in your lexer
spec file:
    
    %s NUMBER
    %%
    <NUMBER>LEXER_RULE_REGEX    return 'TOK';
    
  Erroneous code:
7: <NUMBER>\\d+         -> 'NUMBER';
^...^^^^^^
8: 


while JSON5 Mode produces Error: JSON5: invalid character '%' at 2:1`,
    type: 'Error',
    stack: `SyntaxError: JSON5: invalid character '%' at 2:1
    at syntaxError (\index.js:1325:21)
    at invalidChar (\index.js:1270:16)
    at Object.value (\index.js:349:19)
    at lex (\index.js:128:46)
    at Object.parse (\index.js:74:21)
    at autodetectAndConvertToJSONformat (\regexp-lexer-cjs-es5.js:8839:31)
    at processGrammar (\regexp-lexer-cjs-es5.js:9962:12)
    at test_me (\regexp-lexer-cjs-es5.js:9643:16)
    at new RegExpLexer (\regexp-lexer-cjs-es5.js:9733:17)
    at Context.testEachLexerExample (\regexplexer.js:3407:17)
    at callFn (\runnable.js:372:21)
    at Test.Runnable.run (\runnable.js:364:7)
    at Runner.runTest (\runner.js:455:10)
    at \runner.js:573:12
    at next (\runner.js:369:14)
    at \runner.js:379:7
    at next (\runner.js:303:14)
    at \runner.js:342:7
    at done (\runnable.js:319:5)
    at callFn (\runnable.js:395:7)
    at Hook.Runnable.run (\runnable.js:364:7)
    at next (\runner.js:317:10)
    at Immediate.<anonymous> (\runner.js:347:5)
    at runCallback (timers.js:794:20)
    at tryOnImmediate (timers.js:752:5)
    at processImmediate [as _immediateCallback] (timers.js:729:5)`,
  },
}