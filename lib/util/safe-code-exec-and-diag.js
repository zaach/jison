//
// Helper library for safe code execution/compilation, including dumping offending code to file for further error analysis
// (the idea was originally coded in https://github.com/GerHobbelt/jison/commit/85e367d03b977780516d2b643afbe6f65ee758f2 )
//
// MIT Licensed
//
//
// This code is intended to help test and diagnose arbitrary chunks of code, answering questions like this:
//
// the given code fails, but where exactly and why? It's precise failure conditions are 'hidden' due to 
// the stuff running inside an `eval()` or `Function(...)` call, so we want the code dumped to file so that
// we can test the code in a different environment so that we can see what precisely is causing the failure.
// 

'use strict';

var fs = require('fs');
var path = require('path');

var assert = require('assert');




// Helper function: pad number with leading zeroes
function pad(n, p) {
    p = p || 2;
    var rv = '0000' + n;
    return rv.slice(-p);
}



//
// `code_execution_rig` is a function which gets executed, while it is fed the `sourcecode` as a parameter.
// When the `code_execution_rig` crashes, its failure is caught and (using the `options`) the sourcecode
// is dumped to file for later diagnosis.
//
// Two options drive the internal behaviour:
//
// - options.dumpSourceCodeOnFailure        -- default: FALSE
// - options.throwErrorOnCompileFailure     -- default: FALSE
//
// Dumpfile naming and path are determined through these options:
//
// - options.outfile
// - options.inputPath
// - options.inputFilename
// - options.moduleName
// - options.defaultModuleName
//
function exec_and_diagnose_this_stuff(sourcecode, code_execution_rig, options, title) {
    options = options || {};
    var errname = "" + title;
    var err_id = errname.replace(/[^a-z0-9_]/ig, "_");
    if (err_id.length === 0) {
        err_id = "exec_crash";
    }
    const debug = false;

    if (debug) console.warn('generated ' + errname + ' code under EXEC TEST:\n', sourcecode);

    var p;
    try {
        // p = eval(sourcecode);
        if (typeof code_execution_rig !== 'function') {
            throw new Error("safe-code-exec-and-diag: code_execution_rig MUST be a JavaScript function");
        }
        p = code_execution_rig.call(this, sourcecode, options, errname, debug);
    } catch (ex) {
        console.error("generated " + errname + " source code fatal error: ", ex.message);

        var dumpfile;

        if (options.dumpSourceCodeOnFailure) {
            // attempt to dump in one of several locations: first winner is *it*!
            try {
                var dumpPaths = [(options.outfile ? path.dirname(options.outfile) : null), options.inputPath, process.cwd()];
                var dumpName = (options.inputFilename || options.moduleName || options.defaultModuleName || errname).replace(/[^a-z0-9_]/ig, "_");

                var ts = new Date();
                var tm = ts.getUTCFullYear() +
                    '_' + pad(ts.getUTCMonth() + 1) +
                    '_' + pad(ts.getUTCDate()) +
                    'T' + pad(ts.getUTCHours()) +
                    '' + pad(ts.getUTCMinutes()) +
                    '' + pad(ts.getUTCSeconds()) +
                    '.' + pad(ts.getUTCMilliseconds(), 3) +
                    'Z';

                dumpName += '.fatal_' + err_id + '_dump_' + tm + '.js';

                for (var i = 0, l = dumpPaths.length; i < l; i++) {
                    if (!dumpPaths[i]) {
                        continue;
                    }

                    try {
                        dumpfile = path.normalize(dumpPaths[i] + '/' + dumpName);
                        fs.writeFileSync(dumpfile, sourcecode, 'utf8');
                        console.error("****** offending generated " + errname + " source code dumped into file: ", dumpfile);
                        break;          // abort loop once a dump action was successful!
                    } catch (ex3) {
                        //console.error("generated " + errname + " source code fatal DUMPING error ATTEMPT: ", i, " = ", ex3.message, " -- while attempting to dump into file: ", dumpfile, "\n", ex3.stack);
                        if (i === l - 1) {
                            throw ex3;
                        }
                    }
                }
            } catch (ex2) {
                console.error("generated " + errname + " source code fatal DUMPING error: ", ex2.message, " -- while attempting to dump into file: ", dumpfile, "\n", ex2.stack);
            }
        }

        ex.offending_source_code = sourcecode;
        ex.offending_source_title = errname;
        ex.offending_source_dumpfile = dumpfile;
        
        if (options.throwErrorOnCompileFailure) {
            throw ex;
        }
    }
    return p;
}








module.exports = exec_and_diagnose_this_stuff;

