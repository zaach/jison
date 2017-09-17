
var Lexer      = require('./regexp-lexer.js');
var ebnfParser = require('./ebnf-parser.js');
var lexParser  = require('./lex-parser.js');
var camelCase  = Lexer.camelCase;
var XRegExp    = require('@gerhobbelt/xregexp');
var recast     = require('@gerhobbelt/recast');
var astUtils   = require('@gerhobbelt/ast-util');
var prettier   = require("@gerhobbelt/prettier-miscellaneous");
var json5      = require('@gerhobbelt/json5');
var assert     = require('assert');

var version = require('../../package.json').version;

var devDebug = 0;


/**
 * Output the `raw` input (JSON format or plain STRING containing JSON-formatted data)
 * as JISON source file format in the returned string.
 *
 * @returns a string containing the file contents of an input-equivalent JISON parser/lexer source file.
 * @public
 */
function grammarPrinter(raw, options) {
	if (typeof raw !== 'object') {
		raw = json5.parse(raw);
	}
	options = options || {};
	
	return 'bogus';
}

exports.prettyPrint = grammarPrinter;
