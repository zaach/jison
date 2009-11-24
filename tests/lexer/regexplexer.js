var Lex = require("../setup").Lex,
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

    var lexer = new Lex.RegExpLexer(dict, input);
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

    var lexer = new Lex.RegExpLexer(dict);
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
           ["x", function(){ return "X" } ],
           ["y", function(){ return "Y" } ],
           ["$", function(){return "EOF"} ]
       ]
    };

    var input = "xa";

    var lexer = new Lex.RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.throws(function(){lexer.lex()}, "bad char");
};

exports["test macro"] = function() {
    var dict = {
        macros: {
            "digit": "[0-9]"
        },
        rules: [
           ["x", function(){ return "X" } ],
           ["y", function(){ return "Y" } ],
           ["{digit}+", function(){ return "NAT" } ],
           ["$", function(){ return "EOF"} ]
       ]
    };

    var input = "x12234y42";

    var lexer = new Lex.RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "NAT");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "NAT");
    assert.equal(lexer.lex(), "EOF");
};

exports["test ignored"] = function() {
    var dict = {
        rules: [
           ["x", function(){ return "X" } ],
           ["y", function(){ return "Y" } ],
           ["\\s+", function (){ /* skip whitespace */ }],
           ["$", function(){return "EOF"} ]
       ]
    };

    var input = "x x   y x";

    var lexer = new Lex.RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "Y");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};

exports["test dissambiguate"] = function() {
    var dict = {
        rules: [
           ["for\\b", function(){ return "FOR" } ],
           ["if\\b", function(){ return "IF" } ],
           ["[a-z]+", function(){ return "IDENTIFIER" } ],
           ["\\s+", function (){ /* skip whitespace */ }],
           ["$", function(){ return "EOF"} ]
       ]
    };

    var input = "if forever for for";

    var lexer = new Lex.RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "IF");
    assert.equal(lexer.lex(), "IDENTIFIER");
    assert.equal(lexer.lex(), "FOR");
    assert.equal(lexer.lex(), "FOR");
    assert.equal(lexer.lex(), "EOF");
};

exports["test more()"] = function() {
    var dict = {
        rules: [
           ["x", function(){ return "X" } ],
           ['"[^"]*', function(){
               if(this.yytext.charAt(this.yyleng-1) == '\\') {
                   this.more();
               } else {
                   this.yytext += this.input(); // swallow end quote
                   return "STRING";
               }
            } ],
           ["$", function(){return "EOF"} ]
       ]
    };

    var input = 'x"fgjdrtj\\"sdfsdf"x';

    var lexer = new Lex.RegExpLexer(dict, input);
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "STRING");
    assert.equal(lexer.lex(), "X");
    assert.equal(lexer.lex(), "EOF");
};
