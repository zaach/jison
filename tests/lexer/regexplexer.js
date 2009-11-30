var RegExpLexer = require("../setup").RegExpLexer,
    assert = require("assert"),
    jsDump = require("test/jsdump").jsDump;

exports["test basic matchers"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test set input after"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer = new RegExpLexer(dict);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test unrecognized char"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xa";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.throws(function(){lexer.lex()}, "bad char");
};

exports["test macro"] = function() {
    var dict = {
        macros: {
            "digit": "[0-9]"
        },
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["{digit}+", "return 'NAT';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "x12234y42";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "NAT");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "NAT");
    assert.equal(lexer.lex(), "EOF");
};

exports["test ignored"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["\\s+", "/* skip whitespace */" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "x x   y x";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test dissambiguate"] = function() {
    var dict = {
        rules: [
           ["for\\b", "return 'FOR';" ],
           ["if\\b", "return 'IF';" ],
           ["[a-z]+", "return 'IDENTIFIER';" ],
           ["\\s+", "/* skip whitespace */" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "if forever for for";

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "IF");
    assert.equal(lexer.lex(), "IDENTIFIER");
    assert.equal(lexer.lex(), "FOR");
    assert.equal(lexer.lex(), "FOR");
    assert.equal(lexer.lex(), "EOF");
};

exports["test more()"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ['"[^"]*', function(){
               if(this.yytext.charAt(this.yyleng-1) == '\\') {
                   this.more();
               } else {
                   this.yytext += this.input(); // swallow end quote
                   return "STRING";
               }
            } ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = 'x"fgjdrtj\\"sdfsdf"x';

    var lexer = new RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "STRING");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test module generator"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateModule();
    eval(lexerSource);
    lexer.setInput(input);
    
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test generator with more complex lexer"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ['"[^"]*', function(){
               if(this.yytext.charAt(this.yyleng-1) == '\\') {
                   this.more();
               } else {
                   this.yytext += this.input(); // swallow end quote
                   return "STRING";
               }
            } ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = 'x"fgjdrtj\\"sdfsdf"x';

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateModule();
    eval(lexerSource);
    lexer.setInput(input);

    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "STRING");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test commonjs module generator"] = function() {
    var dict = {
        rules: [
           ["x", "return 'X';" ],
           ["y", "return 'Y';" ],
           ["$", "return 'EOF';" ]
       ]
    };

    var input = "xxyx";

    var lexer_ = new RegExpLexer(dict);
    var lexerSource = lexer_.generateCommonJSModule();
    var exports = {};
    eval(lexerSource);
    exports.lexer.setInput(input);
    
    assert.equal(exports.lex(), "X");
    assert.equal(exports.lex(), "X");
    assert.equal(exports.lex(), "Y");
    assert.equal(exports.lex(), "X");
    assert.equal(exports.lex(), "EOF");
};
