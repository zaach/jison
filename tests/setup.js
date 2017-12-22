
//var Jison = require("../dist/jison-cjs-es5");
var Jison = require("../dist/jison-cjs");
//exports.Jison = require("../dist/jison").Jison;
//exports.Lexer = exports.RegExpLexer = require("../lib/util/regexp-lexer");

var assert = require("assert");
assert(Jison);
assert(Jison.Parser);
assert(Jison.Lexer);


module.exports = {
	Jison,
	Lexer: Jison.Lexer,
	RegExpLexer: Jison.Lexer,
};
