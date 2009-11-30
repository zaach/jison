var Jison = exports.Jison = require("../lib/jison").Jison;
var Lex = exports.Lex = require("../lib/jison/lex").Lex;
exports.Lexer = exports.RegExpLexer = Lex.RegExpLexer;
Lex.Lexer_ = Lex.RegExpLexer;

