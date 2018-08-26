
import rmCommonWS from './rmCommonWS';
import camelCase from './camelCase';
import mkIdentifier from './mkIdentifier';
import scanRegExp from './scanRegExp';
import isLegalIdentifierInput from './isLegalIdentifierInput';
import dquote from './dquote';
import code_exec from './safe-code-exec-and-diag';
import parse2AST from './parse-code-chunk-to-AST';
import stringifier from './code-stringification';
import detectIstanbulGlobal from './detect-istanbul';
import reHelpers from './validate-regex';
import trimErrorForTestReporting from './trimErrorForTestReporting';


export default {
    rmCommonWS,
    camelCase,
    mkIdentifier,
    isLegalIdentifierInput,
    scanRegExp,
    dquote,
    trimErrorForTestReporting,

    checkRegExp: reHelpers.checkRegExp,
    getRegExpInfo: reHelpers.getRegExpInfo,

    exec: code_exec.exec,
    dump: code_exec.dump,

    parseCodeChunkToAST: parse2AST.parseCodeChunkToAST,
    compileCodeToES5: parse2AST.compileCodeToES5,
    prettyPrintAST: parse2AST.prettyPrintAST,
    checkActionBlock: parse2AST.checkActionBlock,
    trimActionCode: parse2AST.trimActionCode,

    printFunctionSourceCode: stringifier.printFunctionSourceCode,
    printFunctionSourceCodeContainer: stringifier.printFunctionSourceCodeContainer,

    detectIstanbulGlobal,
};
