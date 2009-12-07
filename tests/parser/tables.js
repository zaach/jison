var Jison = require("../setup").Jison,
    assert = require("assert");

exports["test right-recursive nullable grammer"] = function () {

    var grammer = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammer, {type: "slr"});
    var parser2 = new Jison.Parser(grammer, {type: "lalr"});

    assert.equal(parser.table.length, 4, "table has 4 states");
    assert.equal(parser.nullable('A'), true, "A is nullable");
    assert.equal(parser.conflicts, 0, "should have no conflict");
    assert.deepEqual(parser.table, parser2.table, "should have identical tables");
};

exports["test slr lalr lr tables are equal"] = function () {
    var grammer = {
        tokens: [ "ZERO", "PLUS"],
        startSymbol: "E",
        bnf: {
            "E" :[ "E PLUS T",
                   "T"      ],
            "T" :[ "ZERO" ]
        }
    };

    var parser = new Jison.Parser(grammer, {type: "slr"});
    var parser2 = new Jison.Parser(grammer, {type: "lalr"});
    var parser3 = new Jison.Parser(grammer, {type: "lr"});

    assert.deepEqual(parser.table, parser2.table, "slr lalr should have identical tables");
    assert.deepEqual(parser2.table, parser3.table, "lalr lr should have identical tables");
};

exports["test LL prase table"] = function () {

    var grammer = {
        tokens: [ 'x' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'x A',
                   ''      ]
        }
    };

    var parser = new Jison.Parser(grammer, {type: "ll"});

    assert.deepEqual(parser.table, {$accept:{x:[0], $end:[0]}, A:{x:[1], $end:[2]}}, "ll table has 2 states");
};

exports["test LL prase table with conflict"] = function () {

    var grammer = {
        tokens: [ 'x' ],
        startSymbol: "L",
        bnf: {
            "L" :[ 'T L T',
                   ''      ],
            "T" :[ "x" ]
        }
    };

    var parser = new Jison.Parser(grammer, {type: "ll"});
    assert.equal(parser.conflicts, 1, "should have 1 conflict");
};

exports["test Ambigous grammer"] = function () {

    var grammer = {
        tokens: [ 'x', 'y' ],
        startSymbol: "A",
        bnf: {
            "A" :[ 'A B A',
                   'x'      ],
            "B" :[ '',
                   'y'      ]
        }
    };

    var parser = new Jison.Parser(grammer, {type: "lr"});
    assert.equal(parser.conflicts, 2, "should have 2 conflict");
};
