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
//import prettier from '@gerhobbelt/prettier-miscellaneous';
//import assert from 'assert';

// assert(recast);
// var types = recast.types;
// assert(types);
// var namedTypes = types.namedTypes;
// assert(namedTypes);
// var b = types.builders;
// assert(b);
// //assert(astUtils);




function parseCodeChunkToAST(src, options) {
    src = src
    .replace(/@/g, '$')
    .replace(/#/g, '$')
    ;
    var ast = recast.parse(src);
    return ast;
}




function prettyPrintAST(ast, options) {
    var new_src;

    if (1) {
        var s = recast.prettyPrint(ast, { 
            tabWidth: 2,
            quote: 'single',
            arrowParensAlways: true,

            // Do not reuse whitespace (or anything else, for that matter)
            // when printing generically.
            reuseWhitespace: false
        });
        new_src = s.code;
    } else {
        new_src = prettier.format(ast);
    }

    new_src = new_src.replace(/\r\n|\n|\r/g, '\n');    // platform dependent EOL fixup
    return new_src;
}







export {
    parseCodeChunkToAST,
    prettyPrintAST
};
