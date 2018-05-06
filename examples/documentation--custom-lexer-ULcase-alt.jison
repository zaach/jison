
// no `%lex../lex` lexer section; specify a custom lexer in the trailing action code chunk...


%token LOWER_CASE UPPER_CASE INVALID

%%

S
    : e EOF
        {
            console.log("parsing ends at EOF...");
            $$ = $e + '.';
        }
    ;

e
    : %epsilon
        {
            console.log("%epsilon");
            $$ = '';
        }
    | e LOWER_CASE
        {
            console.log("lcase:", $LOWER_CASE);
            $$ = $e + ',' + $LOWER_CASE;
        }
    | e UPPER_CASE
        {
            console.log("lcase:", $UPPER_CASE);
            $$ = $e + '+' + $UPPER_CASE;
        }
    | e error
        {
            console.log("whoops! invalid input?");
            $$ = $e + '@';
        }
    ;


%%


 

// a scanner that looks for upper and lower case letters, ignoring all whitespace:

// myscanner.js
function AlphabetScanner() {
    var text = '';
    this.yytext = '';

    // fix: Error: your lexer class MUST have an .options member object or it won't fly!
    this.options = {};
    // fix: Error: your lexer class MUST have these constants defined: lexer.EOF = 1 and lexer.ERROR = 2 or it won't fly!
    this.EOF = 1;
    this.ERROR = 2;

    this.yylloc = {
        first_column: 0,
        first_line: 1,
        last_line: 1,
        last_column: 0
    };
    this.setInput = function(text_) {
        text = text_;
    };
    this.lex = function() {
        // Return the EOF token when we run out of text.
        if (text === '') {
            return 'EOF';
        }

        // Consume a single character and increment our column numbers.
        var c = text.charAt(0);
        text = text.substring(1);
        this.yytext = c;
        this.yylloc.first_column++;
        this.yylloc.last_column++;

        if (c === '\n') {
            // Increment our line number when we hit newlines.
            this.yylloc.first_line++;
            this.yylloc.last_line++;
            // Try to keep lexing because we aren't interested
            // in newlines.
            return this.lex();
        } else if (/[a-z]/.test(c)) {
            return 'LOWER_CASE';
        } else if (/[A-Z]/.test(c)) {
            return 'UPPER_CASE';
        } else if (/\s/.test(c)) {
            // Try to keep lexing because we aren't interested
            // in whitespace.
            return this.lex();
        } else {
            return 'INVALID';
        }
    };
}


parser.lexer = new AlphabetScanner();











// feature of the GH fork: specify your own main.
//
// compile with
//
//      jison -o test.js --main that/will/be/me.jison
//
// then run
//
//      node ./test.js
//
// to see the output.

var assert = require("assert");

parser.main = function () {
    var rv = parser.parse("a B cDeF\nGh ij K\n");

    console.log("(parse)\n\n  a B cDeF[LF]Gh ij K[LF] ==> ", rv);

    assert.equal(rv, ",a+B,c+D,e+F+G,h,i,j+K.");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

