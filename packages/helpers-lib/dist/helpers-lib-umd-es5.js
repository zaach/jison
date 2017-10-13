'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function (global, factory) {
    (typeof exports === 'undefined' ? 'undefined' : _typeof(exports)) === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('@gerhobbelt/recast')) : typeof define === 'function' && define.amd ? define(['@gerhobbelt/recast'], factory) : global['jison-helpers-lib'] = factory(global.recast);
})(undefined, function (recast) {
    'use strict';

    recast = recast && recast.hasOwnProperty('default') ? recast['default'] : recast;

    // Return TRUE if `src` starts with `searchString`. 
    function startsWith(src, searchString) {
        return src.substr(0, searchString.length) === searchString;
    }

    // tagged template string helper which removes the indentation common to all
    // non-empty lines: that indentation was added as part of the source code
    // formatting of this lexer spec file and must be removed to produce what
    // we were aiming for.
    //
    // Each template string starts with an optional empty line, which should be
    // removed entirely, followed by a first line of error reporting content text,
    // which should not be indented at all, i.e. the indentation of the first
    // non-empty line should be treated as the 'common' indentation and thus
    // should also be removed from all subsequent lines in the same template string.
    //
    // See also: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Template_literals
    function rmCommonWS(strings) {
        // As `strings[]` is an array of strings, each potentially consisting
        // of multiple lines, followed by one(1) value, we have to split each
        // individual string into lines to keep that bit of information intact.
        // 
        // We assume clean code style, hence no random mix of tabs and spaces, so every
        // line MUST have the same indent style as all others, so `length` of indent
        // should suffice, but the way we coded this is stricter checking as we look
        // for the *exact* indenting=leading whitespace in each line.
        var indent_str = null;
        var src = strings.map(function splitIntoLines(s) {
            var a = s.split('\n');

            indent_str = a.reduce(function analyzeLine(indent_str, line) {
                var m = /^(\s*)\S/gm.exec(line);
                // only non-empty ~ content-carrying lines matter re common indent calculus:
                if (m) {
                    if (!indent_str) {
                        indent_str = m[1];
                    } else if (m[1].length < indent_str.length) {
                        indent_str = m[1];
                    }
                }
                return indent_str;
            }, indent_str);

            return a;
        });

        // Also note: due to the way we format the template strings in our sourcecode,
        // the last line in the entire template must be empty when it has ANY trailing
        // whitespace:
        var a = src[src.length - 1];
        a[a.length - 1] = a[a.length - 1].replace(/\s+$/, '');

        // Done removing common indentation.
        // 
        // Process template string partials now:
        for (var i = 0, len = src.length; i < len; i++) {
            var a = src[i];
            for (var j = 0, linecnt = a.length; j < linecnt; j++) {
                if (startsWith(a[j], indent_str)) {
                    a[j] = a[j].substr(indent_str.length);
                }
            }
        }

        // now merge everything to construct the template result:
        var rv = [];

        for (var _len = arguments.length, values = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            values[_key - 1] = arguments[_key];
        }

        for (var i = 0, len = values.length; i < len; i++) {
            rv.push(src[i].join('\n'));
            rv.push(values[i]);
        }
        // the last value is always followed by a last template string partial:
        rv.push(src[i].join('\n'));

        var sv = rv.join('');
        return sv;
    }

    // Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
    /** @public */
    function camelCase(s) {
        // Convert first character to lowercase
        return s.replace(/^\w/, function (match) {
            return match.toLowerCase();
        }).replace(/-\w/g, function (match) {
            return match.charAt(1).toUpperCase();
        });
    }

    // properly quote and escape the given input string
    function dquote(s) {
        var sq = s.indexOf('\'') >= 0;
        var dq = s.indexOf('"') >= 0;
        if (sq && dq) {
            s = s.replace(/"/g, '\\"');
            dq = false;
        }
        if (dq) {
            s = '\'' + s + '\'';
        } else {
            s = '"' + s + '"';
        }
        return s;
    }

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


    var fs = require('fs');
    var path = require('path');

    // Helper function: pad number with leading zeroes
    function pad(n, p) {
        p = p || 2;
        var rv = '0000' + n;
        return rv.slice(-p);
    }

    // attempt to dump in one of several locations: first winner is *it*!
    function dumpSourceToFile(sourcecode, errname, err_id, options, ex) {
        var dumpfile;

        try {
            var dumpPaths = [options.outfile ? path.dirname(options.outfile) : null, options.inputPath, process.cwd()];
            var dumpName = path.basename(options.inputFilename || options.moduleName || (options.outfile ? path.dirname(options.outfile) : null) || options.defaultModuleName || errname).replace(/\.[a-z]{1,5}$/i, '') // remove extension .y, .yacc, .jison, ...whatever
            .replace(/[^a-z0-9_]/ig, '_'); // make sure it's legal in the destination filesystem: the least common denominator.
            if (dumpName === '' || dumpName === '_') {
                dumpName = '__bugger__';
            }
            err_id = err_id || 'XXX';

            var ts = new Date();
            var tm = ts.getUTCFullYear() + '_' + pad(ts.getUTCMonth() + 1) + '_' + pad(ts.getUTCDate()) + 'T' + pad(ts.getUTCHours()) + '' + pad(ts.getUTCMinutes()) + '' + pad(ts.getUTCSeconds()) + '.' + pad(ts.getUTCMilliseconds(), 3) + 'Z';

            dumpName += '.fatal_' + err_id + '_dump_' + tm + '.js';

            for (var i = 0, l = dumpPaths.length; i < l; i++) {
                if (!dumpPaths[i]) {
                    continue;
                }

                try {
                    dumpfile = path.normalize(dumpPaths[i] + '/' + dumpName);
                    fs.writeFileSync(dumpfile, sourcecode, 'utf8');
                    console.error("****** offending generated " + errname + " source code dumped into file: ", dumpfile);
                    break; // abort loop once a dump action was successful!
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

        // augment the exception info, when available:
        if (ex) {
            ex.offending_source_code = sourcecode;
            ex.offending_source_title = errname;
            ex.offending_source_dumpfile = dumpfile;
        }
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
        var errname = "" + (title || "exec_test");
        var err_id = errname.replace(/[^a-z0-9_]/ig, "_");
        if (err_id.length === 0) {
            err_id = "exec_crash";
        }
        var debug = 0;

        if (debug) console.warn('generated ' + errname + ' code under EXEC TEST.');
        if (debug > 1) console.warn('\n        ######################## source code ##########################\n        ' + sourcecode + '\n        ######################## source code ##########################\n        ');

        var p;
        try {
            // p = eval(sourcecode);
            if (typeof code_execution_rig !== 'function') {
                throw new Error("safe-code-exec-and-diag: code_execution_rig MUST be a JavaScript function");
            }
            p = code_execution_rig.call(this, sourcecode, options, errname, debug);
        } catch (ex) {
            if (debug > 1) console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");

            if (debug) console.log("generated " + errname + " source code fatal error: ", ex.message);

            if (debug > 1) console.log("exec-and-diagnose options:", options);

            if (debug > 1) console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");

            if (options.dumpSourceCodeOnFailure) {
                dumpSourceToFile(sourcecode, errname, err_id, options, ex);
            }

            if (options.throwErrorOnCompileFailure) {
                throw ex;
            }
        }
        return p;
    }

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
        src = src.replace(/@/g, '$').replace(/#/g, '$');
        var ast = recast.parse(src);
        return ast;
    }

    function prettyPrintAST(ast, options) {
        var new_src;

        {
            var s = recast.prettyPrint(ast, {
                tabWidth: 2,
                quote: 'single',
                arrowParensAlways: true,

                // Do not reuse whitespace (or anything else, for that matter)
                // when printing generically.
                reuseWhitespace: false
            });
            new_src = s.code;
        }

        new_src = new_src.replace(/\r\n|\n|\r/g, '\n'); // platform dependent EOL fixup
        return new_src;
    }

    var index = {
        rmCommonWS: rmCommonWS,
        camelCase: camelCase,
        dquote: dquote,

        exec: exec_and_diagnose_this_stuff,
        dump: dumpSourceToFile,

        parseCodeChunkToAST: parseCodeChunkToAST,
        prettyPrintAST: prettyPrintAST
    };

    return index;
});
