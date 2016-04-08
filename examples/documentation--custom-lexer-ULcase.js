
// a scanner that looks for upper and lower case letters, ignoring all whitespace:

// myscanner.js
function AlphabetScanner() {
    var text = "";
    this.yytext = "";
    this.yylloc = {
        first_column: 0,
        first_line: 1,
        last_line: 1,
        last_column: 0
    };
    this.yylloc = this.yylloc;
    this.setInput = function(text_) {
        text = text_;
    };
    this.lex = function() {
        // Return the EOF token when we run out of text.
        if (text === "") {
            return "EOF";
        }

        // Consume a single character and increment our column numbers.
        var c = text.charAt(0);
        text = text.substring(1);
        this.yytext = c;
        this.yylloc.first_column++;
        this.yylloc.last_column++;

        if (c === "\n") {
            // Increment our line number when we hit newlines.
            this.yylloc.first_line++;
            this.yylloc.last_line++;
            // Try to keep lexing because we aren't interested
            // in newlines.
            return this.lex();
        } else if (/[a-z]/.test(c)) {
            return "LOWER_CASE";
        } else if (/[A-Z]/.test(c)) {
            return "UPPER_CASE";
        } else if (/\s/.test(c)) {
            // Try to keep lexing because we aren't interested
            // in whitespace.
            return this.lex();
        } else {
            return "INVALID";
        }
    };
}

parser.lexer = new AlphabetScanner();

