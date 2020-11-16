// https://stackoverflow.com/questions/58891186/custom-location-tracking-in-jison-gho

%{

/*  After reading a lexeme go to "delimit" state to
      expect delimiter and return the lexeme. Arrow function
    is used to bind this. */
var delimit = (terminal) => { this.begin('delimit'); return terminal }

%}



DELIMITER                   ";"

%x delimit
%x string_literal

%%

"LT"                        { return delimit('LT') }
"LE"                        { return delimit('LE') }
"EQ"                        { return delimit('EQ') }
"NE"                        { return delimit('NE') }
"GE"                        { return delimit('GE') }
"GT"                        { return delimit('GT') }

"PLUS"                      { return delimit('PLUS') }
"MINUS"                     { return delimit('MINUS') }
"MUL"                       { return delimit('MUL') }
"DIV"                       { return delimit('DIV') }
"MOD"                       { return delimit('MOD') }

"TRUE"                      { return delimit('TRUE') }
"FALSE"                     { return delimit('FALSE') }
"NOT"                       { return delimit('NOT') }
"OR"                        { return delimit('OR') }
"AND"                       { return delimit('AND') }

"ASSIGN"                    { return delimit('ASSIGN') }
"NONE"                      { return delimit('NONE') }

"LPAR"                      { return delimit('LPAR') }
"RPAR"                      { return delimit('RPAR') }
"LBRA"                      { return delimit('LBRA') }
"RBRA"                      { return delimit('RBRA') }
"LCURLY"                    { return delimit('LCURLY') }
"RCURLY"                    { return delimit('RCURLY') }

"IF"                        { return delimit('IF') }
"ELSE"                      { return delimit('ELSE') }
"WHILE"                     { return delimit('WHILE') }
"FOR"                       { return delimit('FOR') }

"CLASS"                     { return delimit('CLASS') }
"FUNCTION"                  { return delimit('FUNCTION') }
"RETURN"                    { return delimit('RETURN') }
"CONTINUE"                  { return delimit('CONTINUE') }
"BREAK"                     { return delimit('BREAK') }

"SPACE"                     {
                                /* ignore spaces unless in string literal */
                                this.begin('delimit')
                            }
<string_literal>"SPACE"     { yytext = ' '; return delimit('LETTER') }
"SEMICOLON"                 { return delimit('SEMICOLON') }
"DOT"                       { return delimit('DOT') }
"PROP"                      { return delimit('PROP') }
"COMMA"                     { return delimit('COMMA') }
"QUOTE"                     { this.begin('string_literal'); return delimit('QUOTE') }
<string_literal>"QUOTE"     { this.popState(); return delimit('QUOTE') }
<INITIAL,string_literal>D[0-9]
                            { yytext = yytext.substr(1); return delimit('DIGIT') }
<INITIAL,string_literal>[A-Z_]
                            { return delimit('LETTER') }

<delimit>{DELIMITER}        { this.popState() }

<INITIAL,delimit,string_literal>\s+		/* ignore whitespace */
<delimit>.                  { throw new Error('Delimiter expected: ' + yytext) }
<string_literal>.           { throw new Error('End of string literal expected: ' + yytext) }
<INITIAL>.                  { throw new Error(`Unknown gifcode "${yytext}"`) }

<delimit><<EOF>>            { throw new Error('Delimiter expected') }
<<EOF>>                     { return 'EOF' }





%%

// feature of the GH fork: specify your own main.
//
// compile with
// 
//      jison-lex --main that/will/be/me.lex
//
// to generate a parser in `./me.js`, then run
//
//      node ./me.js
//
// to see the output.

var assert = require("assert");

lexer.main = function () {
    var rv = lexer.parse('A;B;A;D0;ASSIGN;X;\n');
    console.log("test #1: 'A;B;A;D0;ASSIGN;X;\\n' ==> ", rv, lexer.yy);
    assert.equal(rv, '+aDabX:a');

    rv = lexer.parse('a-b');
    console.log("test #2: 'a-b' ==> ", rv);
    assert.equal(rv, 'XE');

    console.log("\nAnd now the failing inputs: even these deliver a result:\n");

    // set up an aborting error handler which does not throw an exception
    // but returns a special parse 'result' instead:
    var errmsg = null;
    var errReturnValue = '@@@';
    lexer.yy.parseError = function (msg, hash) {
        errmsg = msg;
        return errReturnValue + (hash.parser ? hash.value_stack.slice(0, hash.stack_pointer).join('.') : '???');
    };

    rv = lexer.parse('aa');
    console.log("test #3: 'aa' ==> ", rv);
    assert.equal(rv, '@@@.T.a');

    rv = lexer.parse('a');
    console.log("test #4: 'a' ==> ", rv);
    assert.equal(rv, '@@@.a');

    rv = lexer.parse(';');
    console.log("test #5: ';' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = lexer.parse('?');
    console.log("test #6: '?' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = lexer.parse('a?');
    console.log("test #7: 'a?' ==> ", rv);
    assert.equal(rv, '@@@.a');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

