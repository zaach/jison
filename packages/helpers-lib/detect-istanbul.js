
// code to detect whether we're running under istanbul/nyc coverage environment...

function chkBugger() {
    return 1;
}



// 
// 
// 
function detectIstanbulGlobal() {
    const gcv = "__coverage__";
    const globalvar = new Function('return this')();
    var coverage = globalvar[gcv];
    return coverage || false;
}

// const istanbulGlobalRe = /(\bcov_\w+)\.s\[/;
//
// var test_function = chkBugger;
// if (typeof test_function === 'function') {
//     var src = String(test_function);
//     var m = istanbulGlobalRe.exec(src);
//     if (m) {
//         console.warn('Istanbul Global Name:', m[1]);
//         // return reference to istanbul's global AFTER patching it to have
//         // its own name included as a member value known to us!
//         var rv;
//         try {
//             rv = eval(m[1]);
//             rv.__istanbul_global_var_name__ = m[1];
//         } catch (e) {
//             ...
//         }
//     }
// }




export default detectIstanbulGlobal;
