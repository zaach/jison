var Jison = require("../setup").Jison,
    RegExpLexer = require("../setup").RegExpLexer,
    assert = require("assert");

var lexData = {
    rules: [
       ["x", "return 'x';"],
       ["\\+", "return '+';"],
       ["$", "return 'EOF';"]
    ]
};

exports["test Left associative rule"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["\\+", "return '+';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: [ "x", "+", "EOF" ],
        startSymbol: "S",
        operators: [
            ["left", "+"]
        ],
        bnf: {
            "S" :[ [ 'E EOF',   "return $1;" ] ],
            "E" :[ [ "E + E",   "$$ = ['+', $1, $3];" ],
                   [ "x",       "$$ = ['x'];"] ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new RegExpLexer(lexData);

    var expectedAST = ["+", ["+", ["x"], ["x"]], ["x"]];

    var r = parser.parse("x+x+x");
    assert.deepEqual(r, expectedAST);
};

exports["test Right associative rule"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["\\+", "return '+';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: [ "x", "+", "EOF" ],
        startSymbol: "S",
        operators: [
            ["right", "+"]
        ],
        bnf: {
            "S" :[ [ "E EOF",   "return $1;"          ] ],
            "E" :[ [ "E + E",   "$$ = ['+', $1, $3];" ],
                   [ "x",       "$$ = ['x'];"         ] ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new RegExpLexer(lexData);

    var expectedAST = ["+", ["x"], ["+", ["x"], ["x"]]];

    var r = parser.parse("x+x+x");
    assert.deepEqual(r, expectedAST);
};

exports["test Multiple precedence operators"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["\\+", "return '+';"],
           ["\\*", "return '*';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: [ "x", "+", "*", "EOF" ],
        startSymbol: "S",
        operators: [
            ["left", "+"],
            ["left", "*"]
        ],
        bnf: {
            "S" :[ [ "E EOF",   "return $1;"          ] ],
            "E" :[ [ "E + E",   "$$ = ['+', $1, $3];" ],
                   [ "E * E",   "$$ = ['*', $1, $3];" ],
                   [ "x",       "$$ = ['x'];"         ] ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new RegExpLexer(lexData);

    var expectedAST = ["+", ["*", ["x"], ["x"]], ["x"]];

    var r = parser.parse("x*x+x");
    assert.deepEqual(r, expectedAST);
};

exports["test Multiple precedence operators"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["\\+", "return '+';"],
           ["\\*", "return '*';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: [ "x", "+", "*", "EOF" ],
        startSymbol: "S",
        operators: [
            ["left", "+"],
            ["left", "*"]
        ],
        bnf: {
            "S" :[ [ "E EOF",   "return $1;"          ] ],
            "E" :[ [ "E + E",   "$$ = [$1,'+', $3];" ],
                   [ "E * E",   "$$ = [$1, '*', $3];" ],
                   [ "x",       "$$ = ['x'];"         ] ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new RegExpLexer(lexData);

    var expectedAST = [["x"], "+", [["x"], "*", ["x"]]];

    var r = parser.parse("x+x*x");
    assert.deepEqual(r, expectedAST);
};

exports["test Non-associative operator"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["=", "return '=';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: [ "x", "=", "EOF" ],
        startSymbol: "S",
        operators: [
            ["nonassoc", "="]
        ],
        bnf: {
            "S" :[ "E EOF" ],
            "E" :[ "E = E",
                   "x" ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new RegExpLexer(lexData);

    var thrown = false;
    try{
        parser.parse("x=x=x");
    }catch(e) {
        thrown = true;
    }
    assert.ok(thrown, "throws parse error when operator used twice.");
    assert.ok(parser.parse("x=x"), "normal use is okay.");
};

exports["test Context-dependent precedence"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'x';"],
           ["-", "return '-';"],
           ["\\+", "return '+';"],
           ["\\*", "return '*';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: [ "x", "-", "+", "*", "EOF" ],
        startSymbol: "S",
        operators: [
            ["left", "-", "+"],
            ["left", "*"],
            ["left", "UMINUS"]
        ],
        bnf: {
            "S" :[ [ "E EOF",   "return $1;"       ] ],
            "E" :[ [ "E - E",   "$$ = [$1,'-', $3];" ],
                   [ "E + E",   "$$ = [$1,'+', $3];" ],
                   [ "E * E",   "$$ = [$1,'*', $3];" ],
                   [ "- E",     "$$ = ['#', $2];", {prec: "UMINUS"} ],
                   [ "x",       "$$ = ['x'];"         ] ]
        }
    };

    var parser = new Jison.Parser(grammer);
    parser.lexer = new RegExpLexer(lexData);

    var expectedAST = [[[["#", ["x"]], "*", ["#", ["x"]]], "*", ["x"]], "-", ["x"]];

    var r = parser.parse("-x*-x*x-x");
    assert.deepEqual(r, expectedAST);
};

exports["test multi-operator rules"] = function () {
    var lexData = {
        rules: [
           ["x", "return 'ID';"],
           ["\\.", "return 'DOT';"],
           ["=", "return 'ASSIGN';"],
           ["\\(", "return 'LPAREN';"],
           ["\\)", "return 'RPAREN';"],
           ["$", "return 'EOF';"]
        ]
    };
    var grammer = {
        tokens: "ID DOT ASSIGN LPAREN RPAREN EOF",
        startSymbol: "S",
        operators: [
            ["right", "ASSIGN"],
            ["left", "DOT"]
        ],
        bnf: {
            "S" :[ [ "e EOF",   "return $1;"       ] ],
            "id":[ [ "ID", "$$ = ['ID'];"] ],
            "e" :[ [ "e DOT id",   "$$ = [$1,'-', $3];" ],
                   [ "e DOT id ASSIGN e",   "$$ = [$1,'=', $3];" ],
                   [ "e DOT id LPAREN e RPAREN",   "$$ = [$1,'+', $3];" ],
                   [ "id ASSIGN e",   "$$ = [$1,'+', $3];" ],
                   [ "id LPAREN E RPAREN",   "$$ = [$1,'+', $3];" ],
                   [ "id",       "$$ = $1;"         ] ]
        }
    };

    var parser = new Jison.Parser(grammer, {type: 'slr', debug:false});
    parser.lexer = new RegExpLexer(lexData);

    assert.equal(parser.conflicts, 0);
};
