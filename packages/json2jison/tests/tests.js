var assert = require("chai").assert;
var json2jison = require('../json2jison.js');

// TODO real tests

describe("JSON2JISON", function () {
  it("should be able to convert an appropriate JSON file to a JISON grammar", function () {
    var grammar = "%% foo : bar { return true; } ;";
    var json = {
      "bnf": {
        "foo": [
          [
            "bar",
            " return true; "
          ]
        ]
      }
    };

    var rv = json2jison.convert(json);
    assert.equal(rv.trim().replace(/\s+/g, ' '), grammar.replace(/\s+/g, ' '));
  });
});

