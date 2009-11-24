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

    assert.equal(parser.table.length, 4, "table has 4 states");
    assert.equal(parser.nonterms['A'].nullable, true, "A is nullable");
    assert.equal(parser.conflicts, 0, "should have no conflict");
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
