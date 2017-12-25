

function chkBugger(src) {
    src = String(src);
    if (src.match(/\bcov_\w+/)) {
        console.error('### ISTANBUL COVERAGE CODE DETECTED ###\n', src);
    }
}


/// HELPER FUNCTION: print the function in source code form, properly indented.
/** @public */
function printFunctionSourceCode(f) {
    var src = String(f);
    chkBugger(src);
    return src;
}



const funcRe = /^function[\s\r\n]*[^\(]*\(([^\)]*)\)[\s\r\n]*\{([^]*?)\}$/;
const arrowFuncRe = /^(?:(?:\(([^\)]*)\))|(?:([^\(\)]+)))[\s\r\n]*=>[\s\r\n]*(?:(?:\{([^]*?)\})|(?:(([^\s\r\n\{)])[^]*?)))$/;

/// HELPER FUNCTION: print the function **content** in source code form, properly indented,
/// ergo: produce the code for inlining the function.
/// 
/// Also supports ES6's Arrow Functions:
/// 
/// ```
/// function a(x) { return x; }        ==> 'return x;'
/// function (x)  { return x; }        ==> 'return x;'
/// (x) => { return x; }               ==> 'return x;'
/// (x) => x;                          ==> 'return x;'
/// (x) => do(1), do(2), x;            ==> 'return (do(1), do(2), x);'
/// 
/** @public */
function printFunctionSourceCodeContainer(f) {
    var action = printFunctionSourceCode(f).trim();
    var args;

    // Also cope with Arrow Functions (and inline those as well?).
    // See also https://github.com/zaach/jison-lex/issues/23
    var m = funcRe.exec(action);
    if (m) {
        args = m[1].trim();
        action = m[2].trim();
    } else {
        m = arrowFuncRe.exec(action);
        if (m) {
            if (m[2]) {
                // non-bracketed arguments:
                args = m[2].trim();
            } else {
                // bracketed arguments: may be empty args list!
                args = m[1].trim();
            }
            if (m[5]) {
                // non-bracketed version: implicit `return` statement!
                //
                // Q: Must we make sure we have extra braces around the return value 
                // to prevent JavaScript from inserting implit EOS (End Of Statement) 
                // markers when parsing this, when there are newlines in the code?
                // A: No, we don't have to as arrow functions rvalues suffer from this
                // same problem, hence the arrow function's programmer must already
                // have formatted the code correctly.
                action = m[4].trim();
                action = 'return ' + action + ';';
            } else {
                action = m[3].trim();
            }
        } else {
            var e = new Error('Cannot extract code from function');
            e.subject = action;
            throw e;
        }
    }
    return {
        args: args,
        code: action,
    };
}







export default {
	printFunctionSourceCode,
	printFunctionSourceCodeContainer,
};
