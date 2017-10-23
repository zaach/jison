//
// Parse a given chunk of code to an AST.
//
// MIT Licensed
//
//
// This code is intended to help test and diagnose arbitrary chunks of code, answering questions like this:
//
// would the given code compile and possibly execute correctly, when included in a lexer, parser or other engine?
// 


import recast from '@gerhobbelt/recast';
//import astUtils from '@gerhobbelt/ast-util';
import assert from 'assert';

assert(recast);
var types = recast.types;
assert(types);
var namedTypes = types.namedTypes;
assert(namedTypes);
var b = types.builders;
assert(b);
// //assert(astUtils);




function parseCodeChunkToAST(src, options) {
    src = src
    .replace(/@/g, '\uFFDA')
    .replace(/#/g, '\uFFDB')
    ;
    var ast = recast.parse(src);
    return ast;
}




function prettyPrintAST(ast, options) {
    var new_src;
    var options = options || {};
    const defaultOptions = { 
        tabWidth: 2,
        quote: 'single',
        arrowParensAlways: true,

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        reuseWhitespace: false
    };
    for (var key in defaultOptions) {
        if (options[key] === undefined) {
            options[key] = defaultOptions[key];
        }
    }

    var s = recast.prettyPrint(ast, { 
        tabWidth: 2,
        quote: 'single',
        arrowParensAlways: true,

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        reuseWhitespace: false
    });
    new_src = s.code;

    new_src = new_src
    .replace(/\r\n|\n|\r/g, '\n')    // platform dependent EOL fixup
    // backpatch possible jison variables extant in the prettified code:
    .replace(/\uFFDA/g, '@')
    .replace(/\uFFDB/g, '#')
    ;

    return new_src;
}




// validate the given JavaScript snippet: does it compile?
function checkActionBlock(src, yylloc) {
    // make sure reasonable line numbers, etc. are reported in any
    // potential parse errors by pushing the source code down:
    if (yylloc && yylloc.first_line > 0) {
        var cnt = yylloc.first_line + 1;
        var lines = new Array(cnt);
        src = lines.join('\n') + src;
    } 
    if (!src.trim()) {
        return false;
    }

    try {
        parseCodeChunkToAST(src);
        return false;
    } catch (ex) {
        return ex.message || "code snippet cannot be parsed";
    }
}







export default {
    parseCodeChunkToAST,
    prettyPrintAST,
    checkActionBlock,
};
