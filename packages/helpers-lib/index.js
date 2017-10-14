
import rmCommonWS from './rmCommonWS';
import camelCase from './camelCase';
import dquote from './dquote';
import code_exec from './safe-code-exec-and-diag';
import parse2AST from './parse-code-chunk-to-AST';
import stringifier from './code-stringification';


export default {
    rmCommonWS,
    camelCase,
    dquote,

    exec: code_exec.exec,
    dump: code_exec.dump,

    parseCodeChunkToAST: parse2AST.parseCodeChunkToAST,
    prettyPrintAST: parse2AST.prettyPrintAST,

	printFunctionSourceCode: stringifier.printFunctionSourceCode,
	printFunctionSourceCodeContainer: stringifier.printFunctionSourceCodeContainer,
};
