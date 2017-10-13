// TODO real tests
var assert = require('chai').assert;
var jison2json = require('../jison2json');

describe("JISON2JSON", function () {
  it("should convert a simple jison grammar file correctly", function () {
    var grammar = "%% foo: bar { return true; };";

    var json = jison2json.convert(grammar);
    var expected = {
      "bnf": {
        "foo": [
          [
            "bar",
            " return true; "
          ]
        ]
      }
    };
    var rv = JSON.parse(json);
    assert.deepEqual(rv, expected);
  });
});

