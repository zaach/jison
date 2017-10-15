import XRegExp from '@gerhobbelt/xregexp';
import fs from 'fs';
import path from 'path';
import recast from '@gerhobbelt/recast';
import assert from 'assert';

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
function rmCommonWS$1(strings, ...values) {
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
        
        indent_str = a.reduce(function analyzeLine(indent_str, line, index) {
            // only check indentation of parts which follow a NEWLINE:
            if (index !== 0) {
                var m = /^(\s*)\S/.exec(line);
                // only non-empty ~ content-carrying lines matter re common indent calculus:
                if (m) {
                    if (!indent_str) {
                        indent_str = m[1];
                    } else if (m[1].length < indent_str.length) {
                        indent_str = m[1];
                    }
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
    // Process template string partials now, but only when there's
    // some actual UNindenting to do:
    if (indent_str) {
        for (var i = 0, len = src.length; i < len; i++) {
            var a = src[i];
            // only correct indentation at start of line, i.e. only check for
            // the indent after every NEWLINE ==> start at j=1 rather than j=0
            for (var j = 1, linecnt = a.length; j < linecnt; j++) {
                if (startsWith(a[j], indent_str)) {
                    a[j] = a[j].substr(indent_str.length);
                }
            }
        }
    }

    // now merge everything to construct the template result:
    var rv = [];
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
    })
    .replace(/-\w/g, function (match) {
        return match.charAt(1).toUpperCase();
    });
}

// properly quote and escape the given input string
function dquote(s) {
    var sq = (s.indexOf('\'') >= 0);
    var dq = (s.indexOf('"') >= 0);
    if (sq && dq) {
        s = s.replace(/"/g, '\\"');
        dq = false;
    }
    if (dq) {
        s = '\'' + s + '\'';
    }
    else {
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
        var dumpPaths = [(options.outfile ? path.dirname(options.outfile) : null), options.inputPath, process.cwd()];
        var dumpName = path.basename(options.inputFilename || options.moduleName || (options.outfile ? path.dirname(options.outfile) : null) || options.defaultModuleName || errname)
        .replace(/\.[a-z]{1,5}$/i, '')          // remove extension .y, .yacc, .jison, ...whatever
        .replace(/[^a-z0-9_]/ig, '_');          // make sure it's legal in the destination filesystem: the least common denominator.
        if (dumpName === '' || dumpName === '_') {
            dumpName = '__bugger__';
        }
        err_id = err_id || 'XXX';

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
    const debug = 0;

    if (debug) console.warn('generated ' + errname + ' code under EXEC TEST.');
    if (debug > 1) console.warn(`
        ######################## source code ##########################
        ${sourcecode}
        ######################## source code ##########################
        `);

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






var code_exec = {
    exec: exec_and_diagnose_this_stuff,
    dump: dumpSourceToFile
};

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







var parse2AST = {
    parseCodeChunkToAST,
    prettyPrintAST
};

/// HELPER FUNCTION: print the function in source code form, properly indented.
/** @public */
function printFunctionSourceCode(f) {
    return String(f);
}

/// HELPER FUNCTION: print the function **content** in source code form, properly indented.
/** @public */
function printFunctionSourceCodeContainer(f) {
    return String(f).replace(/^[\s\r\n]*function\b[^\{]+\{/, '').replace(/\}[\s\r\n]*$/, '');
}



var stringifier = {
	printFunctionSourceCode,
	printFunctionSourceCodeContainer,
};

var helpers = {
    rmCommonWS: rmCommonWS$1,
    camelCase,
    dquote,

    exec: code_exec.exec,
    dump: code_exec.dump,

    parseCodeChunkToAST: parse2AST.parseCodeChunkToAST,
    prettyPrintAST: parse2AST.prettyPrintAST,

	printFunctionSourceCode: stringifier.printFunctionSourceCode,
	printFunctionSourceCodeContainer: stringifier.printFunctionSourceCodeContainer,
};

// hack:
var assert$1;

/* parser generated by jison 0.6.1-200 */

/*
 * Returns a Parser object of the following structure:
 *
 *  Parser: {
 *    yy: {}     The so-called "shared state" or rather the *source* of it;
 *               the real "shared state" `yy` passed around to
 *               the rule actions, etc. is a derivative/copy of this one,
 *               not a direct reference!
 *  }
 *
 *  Parser.prototype: {
 *    yy: {},
 *    EOF: 1,
 *    TERROR: 2,
 *
 *    trace: function(errorMessage, ...),
 *
 *    JisonParserError: function(msg, hash),
 *
 *    quoteName: function(name),
 *               Helper function which can be overridden by user code later on: put suitable
 *               quotes around literal IDs in a description string.
 *
 *    originalQuoteName: function(name),
 *               The basic quoteName handler provided by JISON.
 *               `cleanupAfterParse()` will clean up and reset `quoteName()` to reference this function
 *               at the end of the `parse()`.
 *
 *    describeSymbol: function(symbol),
 *               Return a more-or-less human-readable description of the given symbol, when
 *               available, or the symbol itself, serving as its own 'description' for lack
 *               of something better to serve up.
 *
 *               Return NULL when the symbol is unknown to the parser.
 *
 *    symbols_: {associative list: name ==> number},
 *    terminals_: {associative list: number ==> name},
 *    nonterminals: {associative list: rule-name ==> {associative list: number ==> rule-alt}},
 *    terminal_descriptions_: (if there are any) {associative list: number ==> description},
 *    productions_: [...],
 *
 *    performAction: function parser__performAction(yytext, yyleng, yylineno, yyloc, yystate, yysp, yyvstack, yylstack, yystack, yysstack),
 *
 *               The function parameters and `this` have the following value/meaning:
 *               - `this`    : reference to the `yyval` internal object, which has members (`$` and `_$`)
 *                             to store/reference the rule value `$$` and location info `@$`.
 *
 *                 One important thing to note about `this` a.k.a. `yyval`: every *reduce* action gets
 *                 to see the same object via the `this` reference, i.e. if you wish to carry custom
 *                 data from one reduce action through to the next within a single parse run, then you
 *                 may get nasty and use `yyval` a.k.a. `this` for storing you own semi-permanent data.
 *
 *                 `this.yy` is a direct reference to the `yy` shared state object.
 *
 *                 `%parse-param`-specified additional `parse()` arguments have been added to this `yy`
 *                 object at `parse()` start and are therefore available to the action code via the
 *                 same named `yy.xxxx` attributes (where `xxxx` represents a identifier name from
 *                 the %parse-param` list.
 *
 *               - `yytext`  : reference to the lexer value which belongs to the last lexer token used
 *                             to match this rule. This is *not* the look-ahead token, but the last token
 *                             that's actually part of this rule.
 *
 *                 Formulated another way, `yytext` is the value of the token immediately preceeding
 *                 the current look-ahead token.
 *                 Caveats apply for rules which don't require look-ahead, such as epsilon rules.
 *
 *               - `yyleng`  : ditto as `yytext`, only now for the lexer.yyleng value.
 *
 *               - `yylineno`: ditto as `yytext`, only now for the lexer.yylineno value.
 *
 *               - `yyloc`   : ditto as `yytext`, only now for the lexer.yylloc lexer token location info.
 *
 *                               WARNING: since jison 0.4.18-186 this entry may be NULL/UNDEFINED instead
 *                               of an empty object when no suitable location info can be provided.
 *
 *               - `yystate` : the current parser state number, used internally for dispatching and
 *                               executing the action code chunk matching the rule currently being reduced.
 *
 *               - `yysp`    : the current state stack position (a.k.a. 'stack pointer')
 *
 *                 This one comes in handy when you are going to do advanced things to the parser
 *                 stacks, all of which are accessible from your action code (see the next entries below).
 *
 *                 Also note that you can access this and other stack index values using the new double-hash
 *                 syntax, i.e. `##$ === ##0 === yysp`, while `##1` is the stack index for all things
 *                 related to the first rule term, just like you have `$1`, `@1` and `#1`.
 *                 This is made available to write very advanced grammar action rules, e.g. when you want
 *                 to investigate the parse state stack in your action code, which would, for example,
 *                 be relevant when you wish to implement error diagnostics and reporting schemes similar
 *                 to the work described here:
 *
 *                 + Pottier, F., 2016. Reachability and error diagnosis in LR(1) automata.
 *                   In Journées Francophones des Languages Applicatifs.
 *
 *                 + Jeffery, C.L., 2003. Generating LR syntax error messages from examples.
 *                   ACM Transactions on Programming Languages and Systems (TOPLAS), 25(5), pp.631–640.
 *
 *               - `yyrulelength`: the current rule's term count, i.e. the number of entries occupied on the stack.
 *
 *                 This one comes in handy when you are going to do advanced things to the parser
 *                 stacks, all of which are accessible from your action code (see the next entries below).
 *
 *               - `yyvstack`: reference to the parser value stack. Also accessed via the `$1` etc.
 *                             constructs.
 *
 *               - `yylstack`: reference to the parser token location stack. Also accessed via
 *                             the `@1` etc. constructs.
 *
 *                             WARNING: since jison 0.4.18-186 this array MAY contain slots which are
 *                             UNDEFINED rather than an empty (location) object, when the lexer/parser
 *                             action code did not provide a suitable location info object when such a
 *                             slot was filled!
 *
 *               - `yystack` : reference to the parser token id stack. Also accessed via the
 *                             `#1` etc. constructs.
 *
 *                 Note: this is a bit of a **white lie** as we can statically decode any `#n` reference to
 *                 its numeric token id value, hence that code wouldn't need the `yystack` but *you* might
 *                 want access this array for your own purposes, such as error analysis as mentioned above!
 *
 *                 Note that this stack stores the current stack of *tokens*, that is the sequence of
 *                 already parsed=reduced *nonterminals* (tokens representing rules) and *terminals*
 *                 (lexer tokens *shifted* onto the stack until the rule they belong to is found and
 *                 *reduced*.
 *
 *               - `yysstack`: reference to the parser state stack. This one carries the internal parser
 *                             *states* such as the one in `yystate`, which are used to represent
 *                             the parser state machine in the *parse table*. *Very* *internal* stuff,
 *                             what can I say? If you access this one, you're clearly doing wicked things
 *
 *               - `...`     : the extra arguments you specified in the `%parse-param` statement in your
 *                             grammar definition file.
 *
 *    table: [...],
 *               State transition table
 *               ----------------------
 *
 *               index levels are:
 *               - `state`  --> hash table
 *               - `symbol` --> action (number or array)
 *
 *                 If the `action` is an array, these are the elements' meaning:
 *                 - index [0]: 1 = shift, 2 = reduce, 3 = accept
 *                 - index [1]: GOTO `state`
 *
 *                 If the `action` is a number, it is the GOTO `state`
 *
 *    defaultActions: {...},
 *
 *    parseError: function(str, hash, ExceptionClass),
 *    yyError: function(str, ...),
 *    yyRecovering: function(),
 *    yyErrOk: function(),
 *    yyClearIn: function(),
 *
 *    constructParseErrorInfo: function(error_message, exception_object, expected_token_set, is_recoverable),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               Produces a new errorInfo 'hash object' which can be passed into `parseError()`.
 *               See it's use in this parser kernel in many places; example usage:
 *
 *                   var infoObj = parser.constructParseErrorInfo('fail!', null,
 *                                     parser.collect_expected_token_set(state), true);
 *                   var retVal = parser.parseError(infoObj.errStr, infoObj, parser.JisonParserError);
 *
 *    originalParseError: function(str, hash, ExceptionClass),
 *               The basic `parseError` handler provided by JISON.
 *               `cleanupAfterParse()` will clean up and reset `parseError()` to reference this function
 *               at the end of the `parse()`.
 *
 *    options: { ... parser %options ... },
 *
 *    parse: function(input[, args...]),
 *               Parse the given `input` and return the parsed value (or `true` when none was provided by
 *               the root action, in which case the parser is acting as a *matcher*).
 *               You MAY use the additional `args...` parameters as per `%parse-param` spec of this grammar:
 *               these extra `args...` are added verbatim to the `yy` object reference as member variables.
 *
 *               WARNING:
 *               Parser's additional `args...` parameters (via `%parse-param`) MAY conflict with
 *               any attributes already added to `yy` by the jison run-time;
 *               when such a collision is detected an exception is thrown to prevent the generated run-time
 *               from silently accepting this confusing and potentially hazardous situation!
 *
 *               The lexer MAY add its own set of additional parameters (via the `%parse-param` line in
 *               the lexer section of the grammar spec): these will be inserted in the `yy` shared state
 *               object and any collision with those will be reported by the lexer via a thrown exception.
 *
 *    cleanupAfterParse: function(resultValue, invoke_post_methods, do_not_nuke_errorinfos),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               This helper API is invoked at the end of the `parse()` call, unless an exception was thrown
 *               and `%options no-try-catch` has been defined for this grammar: in that case this helper MAY
 *               be invoked by calling user code to ensure the `post_parse` callbacks are invoked and
 *               the internal parser gets properly garbage collected under these particular circumstances.
 *
 *    yyMergeLocationInfo: function(first_index, last_index, first_yylloc, last_yylloc, dont_look_back),
 *               Helper function **which will be set up during the first invocation of the `parse()` method**.
 *               This helper API can be invoked to calculate a spanning `yylloc` location info object.
 *
 *               Note: %epsilon rules MAY specify no `first_index` and `first_yylloc`, in which case
 *               this function will attempt to obtain a suitable location marker by inspecting the location stack
 *               backwards.
 *
 *               For more info see the documentation comment further below, immediately above this function's
 *               implementation.
 *
 *    lexer: {
 *        yy: {...},           A reference to the so-called "shared state" `yy` once
 *                             received via a call to the `.setInput(input, yy)` lexer API.
 *        EOF: 1,
 *        ERROR: 2,
 *        JisonLexerError: function(msg, hash),
 *        parseError: function(str, hash, ExceptionClass),
 *        setInput: function(input, [yy]),
 *        input: function(),
 *        unput: function(str),
 *        more: function(),
 *        reject: function(),
 *        less: function(n),
 *        pastInput: function(n),
 *        upcomingInput: function(n),
 *        showPosition: function(),
 *        test_match: function(regex_match_array, rule_index, ...),
 *        next: function(...),
 *        lex: function(...),
 *        begin: function(condition),
 *        pushState: function(condition),
 *        popState: function(),
 *        topState: function(),
 *        _currentRules: function(),
 *        stateStackSize: function(),
 *        cleanupAfterLex: function()
 *
 *        options: { ... lexer %options ... },
 *
 *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START, ...),
 *        rules: [...],
 *        conditions: {associative list: name ==> set},
 *    }
 *  }
 *
 *
 *  token location info (@$, _$, etc.): {
 *    first_line: n,
 *    last_line: n,
 *    first_column: n,
 *    last_column: n,
 *    range: [start_number, end_number]
 *               (where the numbers are indexes into the input string, zero-based)
 *  }
 *
 * ---
 *
 * The `parseError` function receives a 'hash' object with these members for lexer and
 * parser errors:
 *
 *  {
 *    text:        (matched text)
 *    token:       (the produced terminal token, if any)
 *    token_id:    (the produced terminal token numeric ID, if any)
 *    line:        (yylineno)
 *    loc:         (yylloc)
 *  }
 *
 * parser (grammar) errors will also provide these additional members:
 *
 *  {
 *    expected:    (array describing the set of expected tokens;
 *                  may be UNDEFINED when we cannot easily produce such a set)
 *    state:       (integer (or array when the table includes grammar collisions);
 *                  represents the current internal state of the parser kernel.
 *                  can, for example, be used to pass to the `collect_expected_token_set()`
 *                  API to obtain the expected token set)
 *    action:      (integer; represents the current internal action which will be executed)
 *    new_state:   (integer; represents the next/planned internal state, once the current
 *                  action has executed)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule
 *                  available for this particular error)
 *    state_stack: (array: the current parser LALR/LR internal state stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    value_stack: (array: the current parser LALR/LR internal `$$` value stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    location_stack: (array: the current parser LALR/LR internal location stack; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    yy:          (object: the current parser internal "shared state" `yy`
 *                  as is also available in the rule actions; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    lexer:       (reference to the current lexer instance used by the parser)
 *    parser:      (reference to the current parser instance)
 *  }
 *
 * while `this` will reference the current parser instance.
 *
 * When `parseError` is invoked by the lexer, `this` will still reference the related *parser*
 * instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    lexer:       (reference to the current lexer instance which reported the error)
 *  }
 *
 * When `parseError` is invoked by the parser due to a **JavaScript exception** being fired
 * from either the parser or lexer, `this` will still reference the related *parser*
 * instance, while these additional `hash` fields will also be provided:
 *
 *  {
 *    exception:   (reference to the exception thrown)
 *  }
 *
 * Please do note that in the latter situation, the `expected` field will be omitted as
 * this type of failure is assumed not to be due to *parse errors* but rather due to user
 * action code in either parser or lexer failing unexpectedly.
 *
 * ---
 *
 * You can specify parser options by setting / modifying the `.yy` object of your Parser instance.
 * These options are available:
 *
 * ### options which are global for all parser instances
 *
 *  Parser.pre_parse: function(yy)
 *                 optional: you can specify a pre_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`.
 *  Parser.post_parse: function(yy, retval, parseInfo) { return retval; }
 *                 optional: you can specify a post_parse() function in the chunk following
 *                 the grammar, i.e. after the last `%%`. When it does not return any value,
 *                 the parser will return the original `retval`.
 *
 * ### options which can be set up per parser instance
 *
 *  yy: {
 *      pre_parse:  function(yy)
 *                 optional: is invoked before the parse cycle starts (and before the first
 *                 invocation of `lex()`) but immediately after the invocation of
 *                 `parser.pre_parse()`).
 *      post_parse: function(yy, retval, parseInfo) { return retval; }
 *                 optional: is invoked when the parse terminates due to success ('accept')
 *                 or failure (even when exceptions are thrown).
 *                 `retval` contains the return value to be produced by `Parser.parse()`;
 *                 this function can override the return value by returning another.
 *                 When it does not return any value, the parser will return the original
 *                 `retval`.
 *                 This function is invoked immediately before `parser.post_parse()`.
 *
 *      parseError: function(str, hash, ExceptionClass)
 *                 optional: overrides the default `parseError` function.
 *      quoteName: function(name),
 *                 optional: overrides the default `quoteName` function.
 *  }
 *
 *  parser.lexer.options: {
 *      pre_lex:  function()
 *                 optional: is invoked before the lexer is invoked to produce another token.
 *                 `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                 optional: is invoked when the lexer has produced a token `token`;
 *                 this function can override the returned token value by returning another.
 *                 When it does not return any (truthy) value, the lexer will return
 *                 the original `token`.
 *                 `this` refers to the Lexer object.
 *
 *      ranges: boolean
 *                 optional: `true` ==> token location info will include a .range[] member.
 *      flex: boolean
 *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested
 *                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                 optional: `true` ==> lexer regexes are tested in order and for invoked;
 *                 the lexer terminates the scan when a token is returned by the action code.
 *      xregexp: boolean
 *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the
 *                 `XRegExp` library. When this `%option` has not been specified at compile time, all lexer
 *                 rule regexes have been written as standard JavaScript RegExp expressions.
 *  }
 */


// See also:
// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
// with userland code which might access the derived class in a 'classic' way.
function JisonParserError(msg, hash) {
    Object.defineProperty(this, 'name', {
        enumerable: false,
        writable: false,
        value: 'JisonParserError'
    });

    if (msg == null) msg = '???';

    Object.defineProperty(this, 'message', {
        enumerable: false,
        writable: true,
        value: msg
    });

    this.hash = hash;

    var stacktrace;
    if (hash && hash.exception instanceof Error) {
        var ex2 = hash.exception;
        this.message = ex2.message || msg;
        stacktrace = ex2.stack;
    }
    if (!stacktrace) {
        if (Error.hasOwnProperty('captureStackTrace')) {        // V8/Chrome engine
            Error.captureStackTrace(this, this.constructor);
        } else {
            stacktrace = (new Error(msg)).stack;
        }
    }
    if (stacktrace) {
        Object.defineProperty(this, 'stack', {
            enumerable: false,
            writable: false,
            value: stacktrace
        });
    }
}

if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
} else {
    JisonParserError.prototype = Object.create(Error.prototype);
}
JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError';



        // helper: reconstruct the productions[] table
        function bp(s) {
            var rv = [];
            var p = s.pop;
            var r = s.rule;
            for (var i = 0, l = p.length; i < l; i++) {
                rv.push([
                    p[i],
                    r[i]
                ]);
            }
            return rv;
        }
    


        // helper: reconstruct the defaultActions[] table
        function bda(s) {
            var rv = {};
            var d = s.idx;
            var g = s.goto;
            for (var i = 0, l = d.length; i < l; i++) {
                var j = d[i];
                rv[j] = g[i];
            }
            return rv;
        }
    


        // helper: reconstruct the 'goto' table
        function bt(s) {
            var rv = [];
            var d = s.len;
            var y = s.symbol;
            var t = s.type;
            var a = s.state;
            var m = s.mode;
            var g = s.goto;
            for (var i = 0, l = d.length; i < l; i++) {
                var n = d[i];
                var q = {};
                for (var j = 0; j < n; j++) {
                    var z = y.shift();
                    switch (t.shift()) {
                    case 2:
                        q[z] = [
                            m.shift(),
                            g.shift()
                        ];
                        break;

                    case 0:
                        q[z] = a.shift();
                        break;

                    default:
                        // type === 1: accept
                        q[z] = [
                            3
                        ];
                    }
                }
                rv.push(q);
            }
            return rv;
        }
    


        // helper: runlength encoding with increment step: code, length: step (default step = 0)
        // `this` references an array
        function s(c, l, a) {
            a = a || 0;
            for (var i = 0; i < l; i++) {
                this.push(c);
                c += a;
            }
        }

        // helper: duplicate sequence from *relative* offset and length.
        // `this` references an array
        function c(i, l) {
            i = this.length - i;
            for (l += i; i < l; i++) {
                this.push(this[i]);
            }
        }

        // helper: unpack an array using helpers and data, all passed in an array argument 'a'.
        function u(a) {
            var rv = [];
            for (var i = 0, l = a.length; i < l; i++) {
                var e = a[i];
                // Is this entry a helper function?
                if (typeof e === 'function') {
                    i++;
                    e.apply(rv, a[i]);
                } else {
                    rv.push(e);
                }
            }
            return rv;
        }
    

var parser = {
    // Code Generator Information Report
    // ---------------------------------
    //
    // Options:
    //
    //   default action mode: ............. classic,merge
    //   no try..catch: ................... false
    //   no default resolve on conflict:    false
    //   on-demand look-ahead: ............ false
    //   error recovery token skip maximum: 3
    //   yyerror in parse actions is: ..... NOT recoverable,
    //   yyerror in lexer actions and other non-fatal lexer are:
    //   .................................. NOT recoverable,
    //   debug grammar/output: ............ false
    //   has partial LR conflict upgrade:   true
    //   rudimentary token-stack support:   false
    //   parser table compression mode: ... 2
    //   export debug tables: ............. false
    //   export *all* tables: ............. false
    //   module type: ..................... es
    //   parser engine type: .............. lalr
    //   output main() in the module: ..... true
    //   has user-specified main(): ....... false
    //   has user-specified require()/import modules for main(): 
    //   .................................. false
    //   number of expected conflicts: .... 0
    //
    //
    // Parser Analysis flags:
    //
    //   no significant actions (parser is a language matcher only):
    //   .................................. false
    //   uses yyleng: ..................... false
    //   uses yylineno: ................... false
    //   uses yytext: ..................... false
    //   uses yylloc: ..................... false
    //   uses ParseError API: ............. false
    //   uses YYERROR: .................... true
    //   uses YYRECOVERING: ............... false
    //   uses YYERROK: .................... false
    //   uses YYCLEARIN: .................. false
    //   tracks rule values: .............. true
    //   assigns rule values: ............. true
    //   uses location tracking: .......... true
    //   assigns location: ................ true
    //   uses yystack: .................... false
    //   uses yysstack: ................... false
    //   uses yysp: ....................... true
    //   uses yyrulelength: ............... false
    //   uses yyMergeLocationInfo API: .... true
    //   has error recovery: .............. true
    //   has error reporting: ............. true
    //
    // --------- END OF REPORT -----------

trace: function no_op_trace() {},
JisonParserError: JisonParserError,
yy: {},
options: {
  type: "lalr",
  hasPartialLrUpgradeOnConflict: true,
  errorRecoveryTokenDiscardCount: 3
},
symbols_: {
  "$": 17,
  "$accept": 0,
  "$end": 1,
  "%%": 19,
  "(": 10,
  ")": 11,
  "*": 7,
  "+": 12,
  ",": 8,
  ".": 15,
  "/": 14,
  "/!": 39,
  "<": 5,
  "=": 18,
  ">": 6,
  "?": 13,
  "ACTION": 32,
  "ACTION_BODY": 33,
  "ACTION_BODY_CPP_COMMENT": 35,
  "ACTION_BODY_C_COMMENT": 34,
  "ACTION_BODY_WHITESPACE": 36,
  "ACTION_END": 31,
  "ACTION_START": 28,
  "BRACKET_MISSING": 29,
  "BRACKET_SURPLUS": 30,
  "CHARACTER_LIT": 46,
  "CODE": 53,
  "EOF": 1,
  "ESCAPE_CHAR": 44,
  "IMPORT": 24,
  "INCLUDE": 51,
  "INCLUDE_PLACEMENT_ERROR": 37,
  "INIT_CODE": 25,
  "NAME": 20,
  "NAME_BRACE": 40,
  "OPTIONS": 47,
  "OPTIONS_END": 48,
  "OPTION_STRING_VALUE": 49,
  "OPTION_VALUE": 50,
  "PATH": 52,
  "RANGE_REGEX": 45,
  "REGEX_SET": 43,
  "REGEX_SET_END": 42,
  "REGEX_SET_START": 41,
  "SPECIAL_GROUP": 38,
  "START_COND": 27,
  "START_EXC": 22,
  "START_INC": 21,
  "STRING_LIT": 26,
  "UNKNOWN_DECL": 23,
  "^": 16,
  "action": 68,
  "action_body": 69,
  "any_group_regex": 78,
  "definition": 58,
  "definitions": 57,
  "error": 2,
  "escape_char": 81,
  "extra_lexer_module_code": 87,
  "import_name": 60,
  "import_path": 61,
  "include_macro_code": 88,
  "init": 56,
  "init_code_name": 59,
  "lex": 54,
  "module_code_chunk": 89,
  "name_expansion": 77,
  "name_list": 71,
  "names_exclusive": 63,
  "names_inclusive": 62,
  "nonempty_regex_list": 74,
  "option": 86,
  "option_list": 85,
  "optional_module_code_chunk": 90,
  "options": 84,
  "range_regex": 82,
  "regex": 72,
  "regex_base": 76,
  "regex_concat": 75,
  "regex_list": 73,
  "regex_set": 79,
  "regex_set_atom": 80,
  "rule": 67,
  "rule_block": 66,
  "rules": 64,
  "rules_and_epilogue": 55,
  "rules_collective": 65,
  "start_conditions": 70,
  "string": 83,
  "{": 3,
  "|": 9,
  "}": 4
},
terminals_: {
  1: "EOF",
  2: "error",
  3: "{",
  4: "}",
  5: "<",
  6: ">",
  7: "*",
  8: ",",
  9: "|",
  10: "(",
  11: ")",
  12: "+",
  13: "?",
  14: "/",
  15: ".",
  16: "^",
  17: "$",
  18: "=",
  19: "%%",
  20: "NAME",
  21: "START_INC",
  22: "START_EXC",
  23: "UNKNOWN_DECL",
  24: "IMPORT",
  25: "INIT_CODE",
  26: "STRING_LIT",
  27: "START_COND",
  28: "ACTION_START",
  29: "BRACKET_MISSING",
  30: "BRACKET_SURPLUS",
  31: "ACTION_END",
  32: "ACTION",
  33: "ACTION_BODY",
  34: "ACTION_BODY_C_COMMENT",
  35: "ACTION_BODY_CPP_COMMENT",
  36: "ACTION_BODY_WHITESPACE",
  37: "INCLUDE_PLACEMENT_ERROR",
  38: "SPECIAL_GROUP",
  39: "/!",
  40: "NAME_BRACE",
  41: "REGEX_SET_START",
  42: "REGEX_SET_END",
  43: "REGEX_SET",
  44: "ESCAPE_CHAR",
  45: "RANGE_REGEX",
  46: "CHARACTER_LIT",
  47: "OPTIONS",
  48: "OPTIONS_END",
  49: "OPTION_STRING_VALUE",
  50: "OPTION_VALUE",
  51: "INCLUDE",
  52: "PATH",
  53: "CODE"
},
TERROR: 2,
EOF: 1,

// internals: defined here so the object *structure* doesn't get modified by parse() et al,
// thus helping JIT compilers like Chrome V8.
originalQuoteName: null,
originalParseError: null,
cleanupAfterParse: null,
constructParseErrorInfo: null,
yyMergeLocationInfo: null,

__reentrant_call_depth: 0, // INTERNAL USE ONLY
__error_infos: [], // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup
__error_recovery_infos: [], // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup

// APIs which will be set up depending on user action code analysis:
//yyRecovering: 0,
//yyErrOk: 0,
//yyClearIn: 0,

// Helper APIs
// -----------

// Helper function which can be overridden by user code later on: put suitable quotes around
// literal IDs in a description string.
quoteName: function parser_quoteName(id_str) {
    return '"' + id_str + '"';
},

// Return the name of the given symbol (terminal or non-terminal) as a string, when available.
//
// Return NULL when the symbol is unknown to the parser.
getSymbolName: function parser_getSymbolName(symbol) {
    if (this.terminals_[symbol]) {
        return this.terminals_[symbol];
    }

    // Otherwise... this might refer to a RULE token i.e. a non-terminal: see if we can dig that one up.
    //
    // An example of this may be where a rule's action code contains a call like this:
    //
    //      parser.getSymbolName(#$)
    //
    // to obtain a human-readable name of the current grammar rule.
    var s = this.symbols_;
    for (var key in s) {
        if (s[key] === symbol) {
            return key;
        }
    }
    return null;
},

// Return a more-or-less human-readable description of the given symbol, when available,
// or the symbol itself, serving as its own 'description' for lack of something better to serve up.
//
// Return NULL when the symbol is unknown to the parser.
describeSymbol: function parser_describeSymbol(symbol) {
    if (symbol !== this.EOF && this.terminal_descriptions_ && this.terminal_descriptions_[symbol]) {
        return this.terminal_descriptions_[symbol];
    } else if (symbol === this.EOF) {
        return 'end of input';
    }
    var id = this.getSymbolName(symbol);
    if (id) {
        return this.quoteName(id);
    }
    return null;
},

// Produce a (more or less) human-readable list of expected tokens at the point of failure.
//
// The produced list may contain token or token set descriptions instead of the tokens
// themselves to help turning this output into something that easier to read by humans
// unless `do_not_describe` parameter is set, in which case a list of the raw, *numeric*,
// expected terminals and nonterminals is produced.
//
// The returned list (array) will not contain any duplicate entries.
collect_expected_token_set: function parser_collect_expected_token_set(state, do_not_describe) {
    var TERROR = this.TERROR;
    var tokenset = [];
    var check = {};
    // Has this (error?) state been outfitted with a custom expectations description text for human consumption?
    // If so, use that one instead of the less palatable token set.
    if (!do_not_describe && this.state_descriptions_ && this.state_descriptions_[state]) {
        return [this.state_descriptions_[state]];
    }
    for (var p in this.table[state]) {
        p = +p;
        if (p !== TERROR) {
            var d = do_not_describe ? p : this.describeSymbol(p);
            if (d && !check[d]) {
                tokenset.push(d);
                check[d] = true; // Mark this token description as already mentioned to prevent outputting duplicate entries.
            }
        }
    }
    return tokenset;
},
productions_: bp({
  pop: u([
  54,
  54,
  s,
  [55, 3],
  56,
  57,
  57,
  s,
  [58, 11],
  59,
  59,
  60,
  60,
  61,
  61,
  62,
  62,
  63,
  63,
  64,
  64,
  s,
  [65, 4],
  66,
  66,
  67,
  67,
  s,
  [68, 3],
  s,
  [69, 9],
  s,
  [70, 4],
  71,
  71,
  72,
  s,
  [73, 4],
  s,
  [74, 4],
  75,
  75,
  s,
  [76, 17],
  77,
  78,
  78,
  79,
  79,
  80,
  s,
  [80, 4, 1],
  83,
  84,
  85,
  85,
  s,
  [86, 6],
  87,
  87,
  88,
  88,
  s,
  [89, 3],
  90,
  90
]),
  rule: u([
  s,
  [4, 3],
  2,
  0,
  0,
  2,
  0,
  s,
  [2, 3],
  s,
  [1, 3],
  3,
  3,
  2,
  3,
  3,
  s,
  [1, 7],
  2,
  1,
  2,
  c,
  [23, 3],
  4,
  4,
  3,
  c,
  [29, 4],
  s,
  [3, 3],
  s,
  [2, 8],
  0,
  s,
  [3, 3],
  0,
  1,
  3,
  1,
  s,
  [3, 4, -1],
  c,
  [21, 3],
  c,
  [40, 3],
  s,
  [3, 4],
  s,
  [2, 5],
  c,
  [12, 3],
  s,
  [1, 6],
  c,
  [16, 3],
  c,
  [10, 8],
  c,
  [9, 3],
  s,
  [3, 4],
  c,
  [10, 4],
  c,
  [32, 5],
  0
])
}),
performAction: function parser__PerformAction(yyloc, yystate /* action[1] */, yysp, yyvstack, yylstack) {

          /* this == yyval */

          // the JS engine itself can go and remove these statements when `yy` turns out to be unused in any action code!
          var yy = this.yy;
          var yyparser = yy.parser;
          var yylexer = yy.lexer;

          

          switch (yystate) {
case 0:
    /*! Production::    $accept : lex $end */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 1];
    this._$ = yylstack[yysp - 1];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    break;

case 1:
    /*! Production::    lex : init definitions rules_and_epilogue EOF */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1];
    this.$.macros = yyvstack[yysp - 2].macros;
    this.$.startConditions = yyvstack[yysp - 2].startConditions;
    this.$.unknownDecls = yyvstack[yysp - 2].unknownDecls;
    
    // if there are any options, add them all, otherwise set options to NULL:
    // can't check for 'empty object' by `if (yy.options) ...` so we do it this way:
    for (var k in yy.options) {
      this.$.options = yy.options;
      break;
    }
    
    if (yy.actionInclude) {
      var asrc = yy.actionInclude.join('\n\n');
      // Only a non-empty action code chunk should actually make it through:
      if (asrc.trim() !== '') {
        this.$.actionInclude = asrc;
      }
    }
    
    delete yy.options;
    delete yy.actionInclude;
    return this.$;
    break;

case 2:
    /*! Production::    lex : init definitions error EOF */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 3];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Maybe you did not correctly separate the lexer sections with a '%%'
        on an otherwise empty line?
        The lexer spec file should have this structure:
    
                definitions
                %%
                rules
                %%                  // <-- optional!
                extra_module_code   // <-- optional!
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp - 1].errStr}
    `);
    break;

case 3:
    /*! Production::    rules_and_epilogue : "%%" rules "%%" extra_lexer_module_code */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    if (yyvstack[yysp] && yyvstack[yysp].trim() !== '') {
      this.$ = { rules: yyvstack[yysp - 2], moduleInclude: yyvstack[yysp] };
    } else {
      this.$ = { rules: yyvstack[yysp - 2] };
    }
    break;

case 4:
    /*! Production::    rules_and_epilogue : "%%" rules */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = { rules: yyvstack[yysp] };
    break;

case 5:
    /*! Production::    rules_and_epilogue : %epsilon */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = { rules: [] };
    break;

case 6:
    /*! Production::    init : %epsilon */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = undefined;
    this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yy.actionInclude = [];
    if (!yy.options) yy.options = {};
    break;

case 7:
    /*! Production::    definitions : definitions definition */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1];
    if (yyvstack[yysp] != null) {
      if ('length' in yyvstack[yysp]) {
        this.$.macros[yyvstack[yysp][0]] = yyvstack[yysp][1];
      } else if (yyvstack[yysp].type === 'names') {
        for (var name in yyvstack[yysp].names) {
          this.$.startConditions[name] = yyvstack[yysp].names[name];
        }
      } else if (yyvstack[yysp].type === 'unknown') {
        this.$.unknownDecls.push(yyvstack[yysp].body);
      }
    }
    break;

case 8:
    /*! Production::    definitions : %epsilon */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = {
      macros: {},           // { hash table }
      startConditions: {},  // { hash table }
      unknownDecls: []      // [ array of [key,value] pairs }
    };
    break;

case 9:
    /*! Production::    definition : NAME regex */
case 38:
    /*! Production::    rule : regex action */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = [yyvstack[yysp - 1], yyvstack[yysp]];
    break;

case 10:
    /*! Production::    definition : START_INC names_inclusive */
case 11:
    /*! Production::    definition : START_EXC names_exclusive */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp];
    break;

case 12:
    /*! Production::    definition : action */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    yy.actionInclude.push(yyvstack[yysp]); this.$ = null;
    break;

case 13:
    /*! Production::    definition : options */
case 99:
    /*! Production::    option_list : option */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = null;
    break;

case 14:
    /*! Production::    definition : UNKNOWN_DECL */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = {type: 'unknown', body: yyvstack[yysp]};
    break;

case 15:
    /*! Production::    definition : IMPORT import_name import_path */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = {type: 'imports', name: yyvstack[yysp - 1], path: yyvstack[yysp]};
    break;

case 16:
    /*! Production::    definition : IMPORT import_name error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        You did not specify a legal file path for the '%import' initialization code statement, which must have the format:
            %import qualifier_name file_path
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 17:
    /*! Production::    definition : IMPORT error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 1];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        %import name or source filename missing maybe?
    
        Note: each '%import'-ed initialization code section must be qualified by a name, e.g. 'required' before the import path itself:
            %import qualifier_name file_path
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 18:
    /*! Production::    definition : INIT_CODE init_code_name action */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = {
    type: 'codesection',
        qualifier: yyvstack[yysp - 1],
        include: yyvstack[yysp]
    };
    break;

case 19:
    /*! Production::    definition : INIT_CODE error action */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Each '%code' initialization code section must be qualified by a name, e.g. 'required' before the action code itself:
            %code qualifier_name {action code}
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp - 1], yylstack[yysp - 2], yylstack[yysp])}
    
          Technical error report:
        ${yyvstack[yysp - 1].errStr}
    `);
    break;

case 20:
    /*! Production::    init_code_name : NAME */
case 21:
    /*! Production::    init_code_name : STRING_LIT */
case 22:
    /*! Production::    import_name : NAME */
case 23:
    /*! Production::    import_name : STRING_LIT */
case 24:
    /*! Production::    import_path : NAME */
case 25:
    /*! Production::    import_path : STRING_LIT */
case 61:
    /*! Production::    regex_list : regex_concat */
case 66:
    /*! Production::    nonempty_regex_list : regex_concat */
case 68:
    /*! Production::    regex_concat : regex_base */
case 93:
    /*! Production::    escape_char : ESCAPE_CHAR */
case 94:
    /*! Production::    range_regex : RANGE_REGEX */
case 106:
    /*! Production::    extra_lexer_module_code : optional_module_code_chunk */
case 110:
    /*! Production::    module_code_chunk : CODE */
case 113:
    /*! Production::    optional_module_code_chunk : module_code_chunk */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp];
    break;

case 26:
    /*! Production::    names_inclusive : START_COND */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = {type: 'names', names: {}}; this.$.names[yyvstack[yysp]] = 0;
    break;

case 27:
    /*! Production::    names_inclusive : names_inclusive START_COND */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1]; this.$.names[yyvstack[yysp]] = 0;
    break;

case 28:
    /*! Production::    names_exclusive : START_COND */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = {type: 'names', names: {}}; this.$.names[yyvstack[yysp]] = 1;
    break;

case 29:
    /*! Production::    names_exclusive : names_exclusive START_COND */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1]; this.$.names[yyvstack[yysp]] = 1;
    break;

case 30:
    /*! Production::    rules : rules rules_collective */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1].concat(yyvstack[yysp]);
    break;

case 31:
    /*! Production::    rules : %epsilon */
case 37:
    /*! Production::    rule_block : %epsilon */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = [];
    break;

case 32:
    /*! Production::    rules_collective : start_conditions rule */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    if (yyvstack[yysp - 1]) {
        yyvstack[yysp].unshift(yyvstack[yysp - 1]);
    }
    this.$ = [yyvstack[yysp]];
    break;

case 33:
    /*! Production::    rules_collective : start_conditions "{" rule_block "}" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    if (yyvstack[yysp - 3]) {
        yyvstack[yysp - 1].forEach(function (d) {
            d.unshift(yyvstack[yysp - 3]);
        });
    }
    this.$ = yyvstack[yysp - 1];
    break;

case 34:
    /*! Production::    rules_collective : start_conditions "{" error "}" */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 3];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Seems you made a mistake while specifying one of the lexer rules inside
        the start condition
           <${yyvstack[yysp - 3].join(',')}> { rules... }
        block.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylexer, yylexer.mergeLocationInfo((yysp - 3), (yysp)), yylstack[yysp - 3])}
    
          Technical error report:
        ${yyvstack[yysp - 1].errStr}
    `);
    break;

case 35:
    /*! Production::    rules_collective : start_conditions "{" error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Seems you did not correctly bracket a lexer rules set inside
        the start condition
          <${yyvstack[yysp - 2].join(',')}> { rules... }
        as a terminating curly brace '}' could not be found.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 36:
    /*! Production::    rule_block : rule_block rule */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1]; this.$.push(yyvstack[yysp]);
    break;

case 39:
    /*! Production::    rule : regex error */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = [yyvstack[yysp - 1], yyvstack[yysp]];
    yyparser.yyError(rmCommonWS`
        Lexer rule regex action code declaration error?
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 40:
    /*! Production::    action : ACTION_START action_body BRACKET_MISSING */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Missing curly braces: seems you did not correctly bracket a lexer rule action block in curly braces: '{ ... }'.
    
          Offending action body:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    `);
    break;

case 41:
    /*! Production::    action : ACTION_START action_body BRACKET_SURPLUS */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Too many curly braces: seems you did not correctly bracket a lexer rule action block in curly braces: '{ ... }'.
    
          Offending action body:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    `);
    break;

case 42:
    /*! Production::    action : ACTION_START action_body ACTION_END */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    var s = yyvstack[yysp - 1].trim();
    // remove outermost set of braces UNLESS there's 
    // a curly brace in there anywhere: in that case
    // we should leave it up to the sophisticated
    // code analyzer to simplify the code!
    //
    // This is a very rough check as it will also look
    // inside code comments, which should not have
    // any influence.
    //
    // Nevertheless: this is a *safe* transform!
    if (s[0] === '{' && s.indexOf('}') === s.length - 1) {
        this.$ = s.substring(1, s.length - 1).trim();
    } else {
        this.$ = s;
    }
    break;

case 43:
    /*! Production::    action_body : action_body ACTION */
case 48:
    /*! Production::    action_body : action_body include_macro_code */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1] + '\n\n' + yyvstack[yysp] + '\n\n';
    break;

case 44:
    /*! Production::    action_body : action_body ACTION_BODY */
case 45:
    /*! Production::    action_body : action_body ACTION_BODY_C_COMMENT */
case 46:
    /*! Production::    action_body : action_body ACTION_BODY_CPP_COMMENT */
case 47:
    /*! Production::    action_body : action_body ACTION_BODY_WHITESPACE */
case 67:
    /*! Production::    regex_concat : regex_concat regex_base */
case 79:
    /*! Production::    regex_base : regex_base range_regex */
case 89:
    /*! Production::    regex_set : regex_set regex_set_atom */
case 111:
    /*! Production::    module_code_chunk : module_code_chunk CODE */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1] + yyvstack[yysp];
    break;

case 49:
    /*! Production::    action_body : action_body INCLUDE_PLACEMENT_ERROR */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 1];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        You may place the '%include' instruction only at the start/front of a line.
    
          It's use is not permitted at this position:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 1])}
    `);
    break;

case 50:
    /*! Production::    action_body : action_body error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 1];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Seems you did not correctly match curly braces '{ ... }' in a lexer rule action block.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 51:
    /*! Production::    action_body : %epsilon */
case 62:
    /*! Production::    regex_list : %epsilon */
case 114:
    /*! Production::    optional_module_code_chunk : %epsilon */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '';
    break;

case 52:
    /*! Production::    start_conditions : "<" name_list ">" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1];
    break;

case 53:
    /*! Production::    start_conditions : "<" name_list error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Seems you did not correctly terminate the start condition set <${yyvstack[yysp - 1].join(',')},???> with a terminating '>'
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 54:
    /*! Production::    start_conditions : "<" "*" ">" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = ['*'];
    break;

case 55:
    /*! Production::    start_conditions : %epsilon */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = undefined;
    this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    break;

case 56:
    /*! Production::    name_list : NAME */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = [yyvstack[yysp]];
    break;

case 57:
    /*! Production::    name_list : name_list "," NAME */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 2]; this.$.push(yyvstack[yysp]);
    break;

case 58:
    /*! Production::    regex : nonempty_regex_list */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    // Detect if the regex ends with a pure (Unicode) word;
    // we *do* consider escaped characters which are 'alphanumeric'
    // to be equivalent to their non-escaped version, hence these are
    // all valid 'words' for the 'easy keyword rules' option:
    //
    // - hello_kitty
    // - γεια_σου_γατούλα
    // - \u03B3\u03B5\u03B9\u03B1_\u03C3\u03BF\u03C5_\u03B3\u03B1\u03C4\u03BF\u03CD\u03BB\u03B1
    //
    // http://stackoverflow.com/questions/7885096/how-do-i-decode-a-string-with-escaped-unicode#12869914
    //
    // As we only check the *tail*, we also accept these as
    // 'easy keywords':
    //
    // - %options
    // - %foo-bar
    // - +++a:b:c1
    //
    // Note the dash in that last example: there the code will consider
    // `bar` to be the keyword, which is fine with us as we're only
    // interested in the trailing boundary and patching that one for
    // the `easy_keyword_rules` option.
    this.$ = yyvstack[yysp];
    if (yy.options.easy_keyword_rules) {
      // We need to 'protect' `eval` here as keywords are allowed
      // to contain double-quotes and other leading cruft.
      // `eval` *does* gobble some escapes (such as `\b`) but
      // we protect against that through a simple replace regex:
      // we're not interested in the special escapes' exact value
      // anyway.
      // It will also catch escaped escapes (`\\`), which are not
      // word characters either, so no need to worry about
      // `eval(str)` 'correctly' converting convoluted constructs
      // like '\\\\\\\\\\b' in here.
      this.$ = this.$
      .replace(/\\\\/g, '.')
      .replace(/"/g, '.')
      .replace(/\\c[A-Z]/g, '.')
      .replace(/\\[^xu0-9]/g, '.');
    
      try {
        // Convert Unicode escapes and other escapes to their literal characters
        // BEFORE we go and check whether this item is subject to the
        // `easy_keyword_rules` option.
        this.$ = JSON.parse('"' + this.$ + '"');
      }
      catch (ex) {
        yyparser.warn('easy-keyword-rule FAIL on eval: ', ex);
    
        // make the next keyword test fail:
        this.$ = '.';
      }
      // a 'keyword' starts with an alphanumeric character,
      // followed by zero or more alphanumerics or digits:
      var re = new XRegExp('\\w[\\w\\d]*$');
      if (XRegExp.match(this.$, re)) {
        this.$ = yyvstack[yysp] + "\\b";
      } else {
        this.$ = yyvstack[yysp];
      }
    }
    break;

case 59:
    /*! Production::    regex_list : regex_list "|" regex_concat */
case 63:
    /*! Production::    nonempty_regex_list : nonempty_regex_list "|" regex_concat */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 2] + '|' + yyvstack[yysp];
    break;

case 60:
    /*! Production::    regex_list : regex_list "|" */
case 64:
    /*! Production::    nonempty_regex_list : nonempty_regex_list "|" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1] + '|';
    break;

case 65:
    /*! Production::    nonempty_regex_list : "|" regex_concat */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '|' + yyvstack[yysp];
    break;

case 69:
    /*! Production::    regex_base : "(" regex_list ")" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '(' + yyvstack[yysp - 1] + ')';
    break;

case 70:
    /*! Production::    regex_base : SPECIAL_GROUP regex_list ")" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 2] + yyvstack[yysp - 1] + ')';
    break;

case 71:
    /*! Production::    regex_base : "(" regex_list error */
case 72:
    /*! Production::    regex_base : SPECIAL_GROUP regex_list error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Seems you did not correctly bracket a lex rule regex part in '(...)' braces.
    
          Unterminated regex part:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 73:
    /*! Production::    regex_base : regex_base "+" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1] + '+';
    break;

case 74:
    /*! Production::    regex_base : regex_base "*" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1] + '*';
    break;

case 75:
    /*! Production::    regex_base : regex_base "?" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 1] + '?';
    break;

case 76:
    /*! Production::    regex_base : "/" regex_base */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '(?=' + yyvstack[yysp] + ')';
    break;

case 77:
    /*! Production::    regex_base : "/!" regex_base */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '(?!' + yyvstack[yysp] + ')';
    break;

case 78:
    /*! Production::    regex_base : name_expansion */
case 80:
    /*! Production::    regex_base : any_group_regex */
case 84:
    /*! Production::    regex_base : string */
case 85:
    /*! Production::    regex_base : escape_char */
case 86:
    /*! Production::    name_expansion : NAME_BRACE */
case 90:
    /*! Production::    regex_set : regex_set_atom */
case 91:
    /*! Production::    regex_set_atom : REGEX_SET */
case 96:
    /*! Production::    string : CHARACTER_LIT */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp];
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    break;

case 81:
    /*! Production::    regex_base : "." */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '.';
    break;

case 82:
    /*! Production::    regex_base : "^" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '^';
    break;

case 83:
    /*! Production::    regex_base : "$" */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = '$';
    break;

case 87:
    /*! Production::    any_group_regex : REGEX_SET_START regex_set REGEX_SET_END */
case 107:
    /*! Production::    extra_lexer_module_code : extra_lexer_module_code include_macro_code optional_module_code_chunk */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = yyvstack[yysp - 2] + yyvstack[yysp - 1] + yyvstack[yysp];
    break;

case 88:
    /*! Production::    any_group_regex : REGEX_SET_START regex_set error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        Seems you did not correctly bracket a lex rule regex set in '[...]' brackets.
    
          Unterminated regex set:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 92:
    /*! Production::    regex_set_atom : name_expansion */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    if (XRegExp._getUnicodeProperty(yyvstack[yysp].replace(/[{}]/g, ''))
        && yyvstack[yysp].toUpperCase() !== yyvstack[yysp]
    ) {
        // treat this as part of an XRegExp `\p{...}` Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories
        this.$ = yyvstack[yysp];
    } else {
        this.$ = yyvstack[yysp];
    }
    //yyparser.log("name expansion for: ", { name: $name_expansion, redux: $name_expansion.replace(/[{}]/g, ''), output: $$ });
    break;

case 95:
    /*! Production::    string : STRING_LIT */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = prepareString(yyvstack[yysp]);
    break;

case 97:
    /*! Production::    options : OPTIONS option_list OPTIONS_END */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = null;
    break;

case 98:
    /*! Production::    option_list : option option_list */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    this.$ = null;
    break;

case 100:
    /*! Production::    option : NAME */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp];
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yy.options[yyvstack[yysp]] = true;
    break;

case 101:
    /*! Production::    option : NAME "=" OPTION_STRING_VALUE */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yy.options[yyvstack[yysp - 2]] = yyvstack[yysp];
    break;

case 102:
    /*! Production::    option : NAME "=" OPTION_VALUE */
case 103:
    /*! Production::    option : NAME "=" NAME */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yy.options[yyvstack[yysp - 2]] = parseValue(yyvstack[yysp]);
    break;

case 104:
    /*! Production::    option : NAME "=" error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 2];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    // TODO ...
    yyparser.yyError(rmCommonWS`
        Internal error: option "${$option}" value assignment failure.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 105:
    /*! Production::    option : error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp];
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    // TODO ...
    yyparser.yyError(rmCommonWS`
        Expected a valid option name (with optional value assignment).
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 108:
    /*! Production::    include_macro_code : INCLUDE PATH */

    // default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-):
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,VU,-,LT,LA,-,-)
    
    
    var fileContent = fs.readFileSync(yyvstack[yysp], { encoding: 'utf-8' });
    // And no, we don't support nested '%include':
    this.$ = '\n// Included by Jison: ' + yyvstack[yysp] + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + yyvstack[yysp] + '\n\n';
    break;

case 109:
    /*! Production::    include_macro_code : INCLUDE error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp - 1];
    this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp);
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    yyparser.yyError(rmCommonWS`
        %include MUST be followed by a valid file path.
    
          Erroneous path:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 112:
    /*! Production::    module_code_chunk : error */

    // default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-):
    this.$ = yyvstack[yysp];
    this._$ = yylstack[yysp];
    // END of default action (generated by JISON mode classic/merge :: VT,VA,-,-,LT,LA,-,-)
    
    
    // TODO ...
    yyparser.yyError(rmCommonWS`
        Module code declaration error?
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylexer, yylstack[yysp])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
    break;

case 145:       // === NO_ACTION[1] :: ensures that anyone (but us) using this new state will fail dramatically!
                // error recovery reduction action (action generated by jison,
                // using the user-specified `%code error_recovery_reduction` %{...%}
                // code chunk below.

                
                break;
            
}
},
table: bt({
  len: u([
  13,
  1,
  12,
  15,
  1,
  1,
  11,
  18,
  21,
  2,
  2,
  s,
  [11, 3],
  4,
  4,
  12,
  4,
  1,
  1,
  19,
  11,
  12,
  18,
  29,
  30,
  22,
  22,
  17,
  17,
  s,
  [29, 7],
  31,
  5,
  s,
  [29, 3],
  s,
  [12, 4],
  4,
  11,
  3,
  3,
  2,
  2,
  1,
  1,
  12,
  1,
  5,
  4,
  3,
  7,
  17,
  23,
  3,
  30,
  29,
  30,
  s,
  [29, 5],
  3,
  20,
  3,
  30,
  30,
  6,
  s,
  [4, 3],
  12,
  12,
  s,
  [11, 6],
  s,
  [27, 3],
  s,
  [11, 8],
  2,
  11,
  1,
  4,
  3,
  2,
  s,
  [3, 3],
  17,
  16,
  3,
  3,
  1,
  3,
  s,
  [29, 3],
  21,
  s,
  [29, 4],
  4,
  13,
  13,
  s,
  [3, 4],
  6,
  3,
  23,
  s,
  [18, 3],
  14,
  14,
  1,
  14,
  20,
  2,
  17,
  14,
  17,
  3
]),
  symbol: u([
  1,
  2,
  s,
  [19, 7, 1],
  28,
  47,
  54,
  56,
  1,
  c,
  [14, 11],
  57,
  c,
  [12, 11],
  55,
  58,
  68,
  84,
  s,
  [1, 3],
  c,
  [17, 10],
  1,
  3,
  5,
  9,
  10,
  s,
  [14, 4, 1],
  19,
  26,
  s,
  [38, 4, 1],
  44,
  46,
  64,
  c,
  [15, 6],
  c,
  [14, 7],
  72,
  s,
  [74, 5, 1],
  81,
  83,
  27,
  62,
  27,
  63,
  c,
  [54, 12],
  c,
  [11, 21],
  2,
  20,
  26,
  60,
  c,
  [4, 3],
  59,
  2,
  s,
  [29, 9, 1],
  51,
  69,
  2,
  20,
  85,
  86,
  s,
  [1, 3],
  c,
  [102, 16],
  65,
  70,
  c,
  [67, 13],
  9,
  c,
  [12, 9],
  c,
  [125, 12],
  c,
  [123, 6],
  c,
  [30, 3],
  c,
  [59, 6],
  s,
  [20, 7, 1],
  28,
  c,
  [29, 6],
  47,
  c,
  [29, 7],
  7,
  s,
  [9, 9, 1],
  c,
  [33, 14],
  45,
  46,
  47,
  82,
  c,
  [58, 3],
  11,
  c,
  [80, 11],
  73,
  c,
  [81, 6],
  c,
  [22, 22],
  c,
  [121, 12],
  c,
  [17, 22],
  c,
  [108, 29],
  c,
  [29, 199],
  s,
  [42, 6, 1],
  40,
  43,
  77,
  79,
  80,
  c,
  [123, 89],
  c,
  [19, 7],
  27,
  c,
  [572, 11],
  c,
  [12, 27],
  c,
  [593, 3],
  61,
  c,
  [612, 14],
  c,
  [3, 3],
  28,
  68,
  28,
  68,
  28,
  28,
  c,
  [616, 11],
  88,
  48,
  2,
  20,
  48,
  85,
  86,
  2,
  18,
  20,
  c,
  [9, 4],
  1,
  2,
  51,
  53,
  87,
  89,
  90,
  c,
  [630, 17],
  3,
  c,
  [732, 13],
  67,
  c,
  [733, 8],
  7,
  20,
  71,
  c,
  [613, 24],
  c,
  [643, 65],
  c,
  [507, 145],
  2,
  9,
  11,
  c,
  [769, 15],
  c,
  [789, 7],
  11,
  c,
  [201, 59],
  82,
  2,
  40,
  42,
  43,
  77,
  80,
  c,
  [6, 4],
  c,
  [4, 8],
  c,
  [476, 33],
  c,
  [11, 59],
  3,
  4,
  c,
  [473, 8],
  c,
  [401, 15],
  c,
  [27, 54],
  c,
  [584, 11],
  c,
  [11, 78],
  52,
  c,
  [182, 11],
  c,
  [664, 3],
  49,
  50,
  1,
  51,
  88,
  1,
  51,
  1,
  51,
  53,
  c,
  [3, 7],
  c,
  [672, 16],
  2,
  4,
  c,
  [673, 13],
  66,
  2,
  28,
  68,
  2,
  6,
  8,
  6,
  c,
  [4, 3],
  c,
  [642, 58],
  c,
  [525, 31],
  c,
  [522, 13],
  c,
  [750, 8],
  c,
  [662, 115],
  c,
  [562, 5],
  c,
  [315, 10],
  53,
  c,
  [13, 13],
  c,
  [979, 3],
  c,
  [3, 9],
  c,
  [988, 4],
  c,
  [987, 3],
  51,
  53,
  c,
  [300, 14],
  c,
  [973, 9],
  1,
  c,
  [487, 10],
  c,
  [27, 7],
  c,
  [18, 36],
  c,
  [1050, 14],
  c,
  [14, 14],
  20,
  c,
  [15, 14],
  c,
  [830, 20],
  c,
  [469, 3],
  c,
  [460, 16],
  c,
  [159, 14],
  c,
  [491, 18],
  6,
  8
]),
  type: u([
  s,
  [2, 11],
  0,
  0,
  1,
  c,
  [14, 12],
  c,
  [26, 13],
  0,
  c,
  [15, 12],
  s,
  [2, 19],
  c,
  [31, 14],
  s,
  [0, 8],
  c,
  [23, 3],
  c,
  [56, 31],
  c,
  [62, 10],
  c,
  [112, 13],
  c,
  [67, 4],
  c,
  [40, 20],
  c,
  [78, 36],
  c,
  [123, 7],
  c,
  [30, 28],
  c,
  [203, 43],
  c,
  [205, 9],
  c,
  [22, 34],
  c,
  [17, 34],
  s,
  [2, 224],
  c,
  [239, 141],
  c,
  [139, 19],
  c,
  [655, 16],
  c,
  [14, 5],
  c,
  [180, 13],
  c,
  [194, 34],
  s,
  [0, 9],
  c,
  [98, 21],
  c,
  [643, 86],
  c,
  [492, 151],
  c,
  [494, 34],
  c,
  [231, 35],
  c,
  [802, 238],
  c,
  [716, 74],
  c,
  [44, 28],
  c,
  [708, 37],
  c,
  [522, 78],
  c,
  [454, 163],
  c,
  [164, 19],
  c,
  [973, 11],
  c,
  [830, 147],
  s,
  [2, 21]
]),
  state: u([
  s,
  [1, 4, 1],
  6,
  11,
  12,
  20,
  21,
  22,
  24,
  25,
  30,
  31,
  36,
  35,
  42,
  44,
  46,
  50,
  54,
  55,
  56,
  60,
  61,
  64,
  c,
  [15, 5],
  65,
  c,
  [5, 4],
  69,
  71,
  72,
  c,
  [13, 5],
  73,
  c,
  [7, 6],
  74,
  c,
  [5, 4],
  75,
  c,
  [5, 4],
  79,
  76,
  77,
  82,
  86,
  87,
  96,
  101,
  56,
  103,
  105,
  104,
  108,
  110,
  c,
  [66, 7],
  111,
  114,
  c,
  [58, 11],
  c,
  [6, 6],
  69,
  79,
  122,
  129,
  131,
  133,
  c,
  [12, 5],
  139,
  c,
  [29, 5],
  105,
  140,
  142,
  c,
  [47, 8],
  c,
  [22, 5]
]),
  mode: u([
  s,
  [2, 23],
  s,
  [1, 12],
  s,
  [2, 28],
  s,
  [1, 15],
  s,
  [2, 33],
  c,
  [39, 17],
  c,
  [13, 6],
  c,
  [18, 7],
  c,
  [64, 21],
  c,
  [21, 10],
  c,
  [106, 15],
  c,
  [75, 12],
  1,
  c,
  [90, 10],
  c,
  [27, 6],
  c,
  [72, 23],
  c,
  [40, 8],
  c,
  [45, 7],
  c,
  [15, 13],
  s,
  [1, 24],
  s,
  [2, 234],
  c,
  [236, 98],
  c,
  [97, 24],
  c,
  [24, 15],
  c,
  [374, 20],
  c,
  [432, 5],
  c,
  [409, 15],
  c,
  [568, 9],
  c,
  [47, 20],
  c,
  [454, 17],
  c,
  [561, 23],
  c,
  [585, 53],
  c,
  [442, 145],
  c,
  [718, 19],
  c,
  [780, 33],
  c,
  [29, 25],
  c,
  [759, 238],
  c,
  [796, 51],
  c,
  [289, 5],
  c,
  [1211, 12],
  c,
  [722, 35],
  c,
  [340, 9],
  c,
  [648, 24],
  c,
  [854, 59],
  c,
  [1199, 170],
  c,
  [311, 6],
  c,
  [969, 23],
  c,
  [1128, 90],
  c,
  [291, 66]
]),
  goto: u([
  s,
  [6, 11],
  s,
  [8, 11],
  5,
  5,
  s,
  [7, 4, 1],
  s,
  [13, 7, 1],
  s,
  [7, 11],
  s,
  [31, 17],
  23,
  26,
  28,
  32,
  33,
  34,
  39,
  27,
  29,
  37,
  38,
  41,
  40,
  43,
  45,
  s,
  [12, 11],
  s,
  [13, 11],
  s,
  [14, 11],
  47,
  48,
  49,
  51,
  52,
  53,
  s,
  [51, 11],
  58,
  57,
  1,
  2,
  4,
  55,
  62,
  s,
  [55, 6],
  59,
  s,
  [55, 7],
  s,
  [9, 11],
  58,
  58,
  63,
  s,
  [58, 9],
  c,
  [108, 12],
  s,
  [66, 3],
  c,
  [15, 5],
  s,
  [66, 7],
  39,
  66,
  c,
  [23, 7],
  68,
  68,
  67,
  s,
  [68, 3],
  c,
  [7, 3],
  s,
  [68, 17],
  70,
  68,
  68,
  62,
  62,
  26,
  62,
  c,
  [68, 11],
  c,
  [15, 15],
  c,
  [95, 12],
  c,
  [12, 12],
  s,
  [78, 29],
  s,
  [80, 29],
  s,
  [81, 29],
  s,
  [82, 29],
  s,
  [83, 29],
  s,
  [84, 29],
  s,
  [85, 29],
  s,
  [86, 31],
  37,
  78,
  s,
  [95, 29],
  s,
  [96, 29],
  s,
  [93, 29],
  s,
  [10, 9],
  80,
  10,
  10,
  s,
  [26, 12],
  s,
  [11, 9],
  81,
  11,
  11,
  s,
  [28, 12],
  83,
  84,
  85,
  s,
  [17, 11],
  s,
  [22, 3],
  s,
  [23, 3],
  16,
  16,
  20,
  21,
  98,
  s,
  [88, 8, 1],
  97,
  99,
  100,
  58,
  57,
  99,
  100,
  102,
  100,
  100,
  s,
  [105, 3],
  114,
  107,
  114,
  106,
  s,
  [30, 17],
  109,
  c,
  [667, 13],
  112,
  113,
  s,
  [64, 3],
  c,
  [17, 5],
  s,
  [64, 7],
  39,
  64,
  c,
  [25, 6],
  64,
  s,
  [65, 3],
  c,
  [24, 5],
  s,
  [65, 7],
  39,
  65,
  c,
  [24, 6],
  65,
  s,
  [67, 6],
  66,
  68,
  s,
  [67, 18],
  70,
  67,
  67,
  s,
  [73, 29],
  s,
  [74, 29],
  s,
  [75, 29],
  s,
  [79, 29],
  s,
  [94, 29],
  116,
  117,
  115,
  61,
  61,
  26,
  61,
  c,
  [242, 11],
  119,
  117,
  118,
  76,
  76,
  67,
  s,
  [76, 3],
  66,
  68,
  s,
  [76, 18],
  70,
  76,
  76,
  77,
  77,
  67,
  s,
  [77, 3],
  66,
  68,
  s,
  [77, 18],
  70,
  77,
  77,
  121,
  37,
  120,
  78,
  s,
  [90, 4],
  s,
  [91, 4],
  s,
  [92, 4],
  s,
  [27, 12],
  s,
  [29, 12],
  s,
  [15, 11],
  s,
  [16, 11],
  s,
  [24, 11],
  s,
  [25, 11],
  s,
  [18, 11],
  s,
  [19, 11],
  s,
  [40, 27],
  s,
  [41, 27],
  s,
  [42, 27],
  s,
  [43, 11],
  s,
  [44, 11],
  s,
  [45, 11],
  s,
  [46, 11],
  s,
  [47, 11],
  s,
  [48, 11],
  s,
  [49, 11],
  s,
  [50, 11],
  124,
  123,
  s,
  [97, 11],
  98,
  128,
  127,
  125,
  126,
  3,
  99,
  106,
  106,
  113,
  113,
  130,
  s,
  [110, 3],
  s,
  [112, 3],
  s,
  [32, 17],
  132,
  s,
  [37, 14],
  134,
  16,
  136,
  135,
  137,
  138,
  s,
  [56, 3],
  s,
  [63, 3],
  c,
  [624, 5],
  s,
  [63, 7],
  39,
  63,
  c,
  [431, 6],
  63,
  s,
  [69, 29],
  s,
  [71, 29],
  60,
  60,
  26,
  60,
  c,
  [505, 11],
  s,
  [70, 29],
  s,
  [72, 29],
  s,
  [87, 29],
  s,
  [88, 29],
  s,
  [89, 4],
  s,
  [108, 13],
  s,
  [109, 13],
  s,
  [101, 3],
  s,
  [102, 3],
  s,
  [103, 3],
  s,
  [104, 3],
  c,
  [940, 4],
  s,
  [111, 3],
  141,
  c,
  [926, 13],
  35,
  35,
  143,
  s,
  [35, 15],
  s,
  [38, 18],
  s,
  [39, 18],
  s,
  [52, 14],
  s,
  [53, 14],
  144,
  s,
  [54, 14],
  59,
  59,
  26,
  59,
  c,
  [112, 11],
  107,
  107,
  s,
  [33, 17],
  s,
  [36, 14],
  s,
  [34, 17],
  s,
  [57, 3]
])
}),
defaultActions: bda({
  idx: u([
  0,
  2,
  6,
  7,
  11,
  12,
  13,
  16,
  18,
  19,
  21,
  s,
  [30, 8, 1],
  39,
  40,
  s,
  [41, 4, 2],
  48,
  49,
  52,
  53,
  58,
  60,
  s,
  [66, 5, 1],
  s,
  [77, 22, 1],
  100,
  101,
  104,
  106,
  107,
  108,
  113,
  115,
  116,
  s,
  [118, 11, 1],
  130,
  s,
  [133, 4, 1],
  138,
  s,
  [140, 5, 1]
]),
  goto: u([
  6,
  8,
  7,
  31,
  12,
  13,
  14,
  51,
  1,
  2,
  9,
  78,
  s,
  [80, 7, 1],
  95,
  96,
  93,
  26,
  28,
  17,
  22,
  23,
  20,
  21,
  105,
  30,
  73,
  74,
  75,
  79,
  94,
  90,
  91,
  92,
  27,
  29,
  15,
  16,
  24,
  25,
  18,
  19,
  s,
  [40, 11, 1],
  97,
  98,
  106,
  110,
  112,
  32,
  56,
  69,
  71,
  70,
  72,
  87,
  88,
  89,
  108,
  109,
  s,
  [101, 4, 1],
  111,
  38,
  39,
  52,
  53,
  54,
  107,
  33,
  36,
  34,
  57
])
}),
parseError: function parseError(str, hash, ExceptionClass) {
    if (hash.recoverable && typeof this.trace === 'function') {
        this.trace(str);
        hash.destroy(); // destroy... well, *almost*!
    } else {
        if (!ExceptionClass) {
            ExceptionClass = this.JisonParserError;
        }
        throw new ExceptionClass(str, hash);
    }
},
parse: function parse(input) {
    var self = this;
    var stack = new Array(128);         // token stack: stores token which leads to state at the same index (column storage)
    var sstack = new Array(128);        // state stack: stores states (column storage)

    var vstack = new Array(128);        // semantic value stack
    var lstack = new Array(128);        // location stack
    var table = this.table;
    var sp = 0;                         // 'stack pointer': index into the stacks
    var yyloc;

    var symbol = 0;
    var preErrorSymbol = 0;
    var lastEofErrorStateDepth = 0;
    var recoveringErrorInfo = null;
    var recovering = 0;                 // (only used when the grammar contains error recovery rules)
    var TERROR = this.TERROR;
    var EOF = this.EOF;
    var ERROR_RECOVERY_TOKEN_DISCARD_COUNT = (this.options.errorRecoveryTokenDiscardCount | 0) || 3;
    var NO_ACTION = [0, 145 /* === table.length :: ensures that anyone using this new state will fail dramatically! */];

    var lexer;
    if (this.__lexer__) {
        lexer = this.__lexer__;
    } else {
        lexer = this.__lexer__ = Object.create(this.lexer);
    }

    var sharedState_yy = {
        parseError: undefined,
        quoteName: undefined,
        lexer: undefined,
        parser: undefined,
        pre_parse: undefined,
        post_parse: undefined,
        pre_lex: undefined,
        post_lex: undefined      // WARNING: must be written this way for the code expanders to work correctly in both ES5 and ES6 modes!
    };

    var ASSERT;
    if (typeof assert$1 !== 'function') {
        ASSERT = function JisonAssert(cond, msg) {
            if (!cond) {
                throw new Error('assertion failed: ' + (msg || '***'));
            }
        };
    } else {
        ASSERT = assert$1;
    }

    this.yyGetSharedState = function yyGetSharedState() {
        return sharedState_yy;
    };


    this.yyGetErrorInfoTrack = function yyGetErrorInfoTrack() {
        return recoveringErrorInfo;
    };


    // shallow clone objects, straight copy of simple `src` values
    // e.g. `lexer.yytext` MAY be a complex value object,
    // rather than a simple string/value.
    function shallow_copy(src) {
        if (typeof src === 'object') {
            var dst = {};
            for (var k in src) {
                if (Object.prototype.hasOwnProperty.call(src, k)) {
                    dst[k] = src[k];
                }
            }
            return dst;
        }
        return src;
    }
    function shallow_copy_noclobber(dst, src) {
        for (var k in src) {
            if (typeof dst[k] === 'undefined' && Object.prototype.hasOwnProperty.call(src, k)) {
                dst[k] = src[k];
            }
        }
    }
    function copy_yylloc(loc) {
        var rv = shallow_copy(loc);
        if (rv && rv.range) {
            rv.range = rv.range.slice(0);
        }
        return rv;
    }

    // copy state
    shallow_copy_noclobber(sharedState_yy, this.yy);

    sharedState_yy.lexer = lexer;
    sharedState_yy.parser = this;





    // *Always* setup `yyError`, `YYRECOVERING`, `yyErrOk` and `yyClearIn` functions as it is paramount
    // to have *their* closure match ours -- if we only set them up once,
    // any subsequent `parse()` runs will fail in very obscure ways when
    // these functions are invoked in the user action code block(s) as
    // their closure will still refer to the `parse()` instance which set
    // them up. Hence we MUST set them up at the start of every `parse()` run!
    if (this.yyError) {
        this.yyError = function yyError(str /*, ...args */) {











            var error_rule_depth = (this.options.parserErrorsAreRecoverable ? locateNearestErrorRecoveryRule(state) : -1);
            var expected = this.collect_expected_token_set(state);
            var hash = this.constructParseErrorInfo(str, null, expected, (error_rule_depth >= 0));
            // append to the old one?
            if (recoveringErrorInfo) {
                var esp = recoveringErrorInfo.info_stack_pointer;

                recoveringErrorInfo.symbol_stack[esp] = symbol;
                var v = this.shallowCopyErrorInfo(hash);
                v.yyError = true;
                v.errorRuleDepth = error_rule_depth;
                v.recovering = recovering;
                // v.stackSampleLength = error_rule_depth + EXTRA_STACK_SAMPLE_DEPTH;

                recoveringErrorInfo.value_stack[esp] = v;
                recoveringErrorInfo.location_stack[esp] = copy_yylloc(lexer.yylloc);
                recoveringErrorInfo.state_stack[esp] = newState || NO_ACTION[1];

                ++esp;
                recoveringErrorInfo.info_stack_pointer = esp;
            } else {
                recoveringErrorInfo = this.shallowCopyErrorInfo(hash);
                recoveringErrorInfo.yyError = true;
                recoveringErrorInfo.errorRuleDepth = error_rule_depth;
                recoveringErrorInfo.recovering = recovering;
            }


            // Add any extra args to the hash under the name `extra_error_attributes`:
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length) {
                hash.extra_error_attributes = args;
            }

            var r = this.parseError(str, hash, this.JisonParserError);
            return r;
        };
    }







    // Does the shared state override the default `parseError` that already comes with this instance?
    if (typeof sharedState_yy.parseError === 'function') {
        this.parseError = function parseErrorAlt(str, hash, ExceptionClass) {
            if (!ExceptionClass) {
                ExceptionClass = this.JisonParserError;
            }
            return sharedState_yy.parseError.call(this, str, hash, ExceptionClass);
        };
    } else {
        this.parseError = this.originalParseError;
    }

    // Does the shared state override the default `quoteName` that already comes with this instance?
    if (typeof sharedState_yy.quoteName === 'function') {
        this.quoteName = function quoteNameAlt(id_str) {
            return sharedState_yy.quoteName.call(this, id_str);
        };
    } else {
        this.quoteName = this.originalQuoteName;
    }

    // set up the cleanup function; make it an API so that external code can re-use this one in case of
    // calamities or when the `%options no-try-catch` option has been specified for the grammar, in which
    // case this parse() API method doesn't come with a `finally { ... }` block any more!
    //
    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `sharedState`, etc. references will be *wrong*!
    this.cleanupAfterParse = function parser_cleanupAfterParse(resultValue, invoke_post_methods, do_not_nuke_errorinfos) {
        var rv;

        if (invoke_post_methods) {
            var hash;

            if (sharedState_yy.post_parse || this.post_parse) {
                // create an error hash info instance: we re-use this API in a **non-error situation**
                // as this one delivers all parser internals ready for access by userland code.
                hash = this.constructParseErrorInfo(null /* no error! */, null /* no exception! */, null, false);
            }

            if (sharedState_yy.post_parse) {
                rv = sharedState_yy.post_parse.call(this, sharedState_yy, resultValue, hash);
                if (typeof rv !== 'undefined') resultValue = rv;
            }
            if (this.post_parse) {
                rv = this.post_parse.call(this, sharedState_yy, resultValue, hash);
                if (typeof rv !== 'undefined') resultValue = rv;
            }

            // cleanup:
            if (hash && hash.destroy) {
                hash.destroy();
            }
        }

        if (this.__reentrant_call_depth > 1) return resultValue;        // do not (yet) kill the sharedState when this is a reentrant run.

        // clean up the lingering lexer structures as well:
        if (lexer.cleanupAfterLex) {
            lexer.cleanupAfterLex(do_not_nuke_errorinfos);
        }

        // prevent lingering circular references from causing memory leaks:
        if (sharedState_yy) {
            sharedState_yy.lexer = undefined;
            sharedState_yy.parser = undefined;
            if (lexer.yy === sharedState_yy) {
                lexer.yy = undefined;
            }
        }
        sharedState_yy = undefined;
        this.parseError = this.originalParseError;
        this.quoteName = this.originalQuoteName;

        // nuke the vstack[] array at least as that one will still reference obsoleted user values.
        // To be safe, we nuke the other internal stack columns as well...
        stack.length = 0;               // fastest way to nuke an array without overly bothering the GC
        sstack.length = 0;
        lstack.length = 0;
        vstack.length = 0;
        sp = 0;

        // nuke the error hash info instances created during this run.
        // Userland code must COPY any data/references
        // in the error hash instance(s) it is more permanently interested in.
        if (!do_not_nuke_errorinfos) {
            for (var i = this.__error_infos.length - 1; i >= 0; i--) {
                var el = this.__error_infos[i];
                if (el && typeof el.destroy === 'function') {
                    el.destroy();
                }
            }
            this.__error_infos.length = 0;


            for (var i = this.__error_recovery_infos.length - 1; i >= 0; i--) {
                var el = this.__error_recovery_infos[i];
                if (el && typeof el.destroy === 'function') {
                    el.destroy();
                }
            }
            this.__error_recovery_infos.length = 0;

            if (recoveringErrorInfo && typeof recoveringErrorInfo.destroy === 'function') {
                recoveringErrorInfo.destroy();
                recoveringErrorInfo = undefined;
            }


        }

        return resultValue;
    };

    // merge yylloc info into a new yylloc instance.
    //
    // `first_index` and `last_index` MAY be UNDEFINED/NULL or these are indexes into the `lstack[]` location stack array.
    //
    // `first_yylloc` and `last_yylloc` MAY be UNDEFINED/NULL or explicit (custom or regular) `yylloc` instances, in which
    // case these override the corresponding first/last indexes.
    //
    // `dont_look_back` is an optional flag (default: FALSE), which instructs this merge operation NOT to search
    // through the parse location stack for a location, which would otherwise be used to construct the new (epsilon!)
    // yylloc info.
    //
    // Note: epsilon rule's yylloc situation is detected by passing both `first_index` and `first_yylloc` as UNDEFINED/NULL.
    this.yyMergeLocationInfo = function parser_yyMergeLocationInfo(first_index, last_index, first_yylloc, last_yylloc, dont_look_back) {
        var i1 = first_index | 0,
            i2 = last_index | 0;
        var l1 = first_yylloc,
            l2 = last_yylloc;
        var rv;

        // rules:
        // - first/last yylloc entries override first/last indexes

        if (!l1) {
            if (first_index != null) {
                for (var i = i1; i <= i2; i++) {
                    l1 = lstack[i];
                    if (l1) {
                        break;
                    }
                }
            }
        }

        if (!l2) {
            if (last_index != null) {
                for (var i = i2; i >= i1; i--) {
                    l2 = lstack[i];
                    if (l2) {
                        break;
                    }
                }
            }
        }

        // - detect if an epsilon rule is being processed and act accordingly:
        if (!l1 && first_index == null) {
            // epsilon rule span merger. With optional look-ahead in l2.
            if (!dont_look_back) {
                for (var i = (i1 || sp) - 1; i >= 0; i--) {
                    l1 = lstack[i];
                    if (l1) {
                        break;
                    }
                }
            }
            if (!l1) {
                if (!l2) {
                    // when we still don't have any valid yylloc info, we're looking at an epsilon rule
                    // without look-ahead and no preceding terms and/or `dont_look_back` set:
                    // in that case we ca do nothing but return NULL/UNDEFINED:
                    return undefined;
                } else {
                    // shallow-copy L2: after all, we MAY be looking
                    // at unconventional yylloc info objects...
                    rv = shallow_copy(l2);
                    if (rv.range) {
                        // shallow copy the yylloc ranges info to prevent us from modifying the original arguments' entries:
                        rv.range = rv.range.slice(0);
                    }
                    return rv;
                }
            } else {
                // shallow-copy L1, then adjust first col/row 1 column past the end.
                rv = shallow_copy(l1);
                rv.first_line = rv.last_line;
                rv.first_column = rv.last_column;
                if (rv.range) {
                    // shallow copy the yylloc ranges info to prevent us from modifying the original arguments' entries:
                    rv.range = rv.range.slice(0);
                    rv.range[0] = rv.range[1];
                }

                if (l2) {
                    // shallow-mixin L2, then adjust last col/row accordingly.
                    shallow_copy_noclobber(rv, l2);
                    rv.last_line = l2.last_line;
                    rv.last_column = l2.last_column;
                    if (rv.range && l2.range) {
                        rv.range[1] = l2.range[1];
                    }
                }
                return rv;
            }
        }

        if (!l1) {
            l1 = l2;
            l2 = null;
        }
        if (!l1) {
            return undefined;
        }

        // shallow-copy L1|L2, before we try to adjust the yylloc values: after all, we MAY be looking
        // at unconventional yylloc info objects...
        rv = shallow_copy(l1);

        // first_line: ...,
        // first_column: ...,
        // last_line: ...,
        // last_column: ...,
        if (rv.range) {
            // shallow copy the yylloc ranges info to prevent us from modifying the original arguments' entries:
            rv.range = rv.range.slice(0);
        }

        if (l2) {
            shallow_copy_noclobber(rv, l2);
            rv.last_line = l2.last_line;
            rv.last_column = l2.last_column;
            if (rv.range && l2.range) {
                rv.range[1] = l2.range[1];
            }
        }

        return rv;
    };

    // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
    //       or else your `lexer`, `sharedState`, etc. references will be *wrong*!
    this.constructParseErrorInfo = function parser_constructParseErrorInfo(msg, ex, expected, recoverable) {
        var pei = {
            errStr: msg,
            exception: ex,
            text: lexer.match,
            value: lexer.yytext,
            token: this.describeSymbol(symbol) || symbol,
            token_id: symbol,
            line: lexer.yylineno,
            loc: copy_yylloc(lexer.yylloc),
            expected: expected,
            recoverable: recoverable,
            state: state,
            action: action,
            new_state: newState,
            symbol_stack: stack,
            state_stack: sstack,
            value_stack: vstack,
            location_stack: lstack,
            stack_pointer: sp,
            yy: sharedState_yy,
            lexer: lexer,
            parser: this,

            // and make sure the error info doesn't stay due to potential
            // ref cycle via userland code manipulations.
            // These would otherwise all be memory leak opportunities!
            //
            // Note that only array and object references are nuked as those
            // constitute the set of elements which can produce a cyclic ref.
            // The rest of the members is kept intact as they are harmless.
            destroy: function destructParseErrorInfo() {
                // remove cyclic references added to error info:
                // info.yy = null;
                // info.lexer = null;
                // info.value = null;
                // info.value_stack = null;
                // ...
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this.hasOwnProperty(key) && typeof key === 'object') {
                        this[key] = undefined;
                    }
                }
                this.recoverable = rec;
            }
        };
        // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!
        this.__error_infos.push(pei);
        return pei;
    };

    // clone some parts of the (possibly enhanced!) errorInfo object
    // to give them some persistence.
    this.shallowCopyErrorInfo = function parser_shallowCopyErrorInfo(p) {
        var rv = shallow_copy(p);

        // remove the large parts which can only cause cyclic references
        // and are otherwise available from the parser kernel anyway.
        delete rv.sharedState_yy;
        delete rv.parser;
        delete rv.lexer;

        // lexer.yytext MAY be a complex value object, rather than a simple string/value:
        rv.value = shallow_copy(rv.value);

        // yylloc info:
        rv.loc = copy_yylloc(rv.loc);

        // the 'expected' set won't be modified, so no need to clone it:
        //rv.expected = rv.expected.slice(0);

        //symbol stack is a simple array:
        rv.symbol_stack = rv.symbol_stack.slice(0);
        // ditto for state stack:
        rv.state_stack = rv.state_stack.slice(0);
        // clone the yylloc's in the location stack?:
        rv.location_stack = rv.location_stack.map(copy_yylloc);
        // and the value stack may carry both simple and complex values:
        // shallow-copy the latter.
        rv.value_stack = rv.value_stack.map(shallow_copy);

        // and we don't bother with the sharedState_yy reference:
        //delete rv.yy;

        // now we prepare for tracking the COMBINE actions
        // in the error recovery code path:
        //
        // as we want to keep the maximum error info context, we
        // *scan* the state stack to find the first *empty* slot.
        // This position will surely be AT OR ABOVE the current
        // stack pointer, but we want to keep the 'used but discarded'
        // part of the parse stacks *intact* as those slots carry
        // error context that may be useful when you want to produce
        // very detailed error diagnostic reports.
        //
        // ### Purpose of each stack pointer:
        //
        // - stack_pointer: points at the top of the parse stack
        //                  **as it existed at the time of the error
        //                  occurrence, i.e. at the time the stack
        //                  snapshot was taken and copied into the
        //                  errorInfo object.**
        // - base_pointer:  the bottom of the **empty part** of the
        //                  stack, i.e. **the start of the rest of
        //                  the stack space /above/ the existing
        //                  parse stack. This section will be filled
        //                  by the error recovery process as it
        //                  travels the parse state machine to
        //                  arrive at the resolving error recovery rule.**
        // - info_stack_pointer:
        //                  this stack pointer points to the **top of
        //                  the error ecovery tracking stack space**, i.e.
        //                  this stack pointer takes up the role of
        //                  the `stack_pointer` for the error recovery
        //                  process. Any mutations in the **parse stack**
        //                  are **copy-appended** to this part of the
        //                  stack space, keeping the bottom part of the
        //                  stack (the 'snapshot' part where the parse
        //                  state at the time of error occurrence was kept)
        //                  intact.
        // - root_failure_pointer:
        //                  copy of the `stack_pointer`...
        //
        for (var i = rv.stack_pointer; typeof rv.state_stack[i] !== 'undefined'; i++) {
            // empty
        }
        rv.base_pointer = i;
        rv.info_stack_pointer = i;

        rv.root_failure_pointer = rv.stack_pointer;

        // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!
        this.__error_recovery_infos.push(rv);

        return rv;
    };

    function getNonTerminalFromCode(symbol) {
        var tokenName = self.getSymbolName(symbol);
        if (!tokenName) {
            tokenName = symbol;
        }
        return tokenName;
    }


    function lex() {
        var token = lexer.lex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }

        if (typeof Jison !== 'undefined' && Jison.lexDebugger) {
            var tokenName = self.getSymbolName(token || EOF);
            if (!tokenName) {
                tokenName = token;
            }

            Jison.lexDebugger.push({
                tokenName: tokenName,
                tokenText: lexer.match,
                tokenValue: lexer.yytext
            });
        }

        return token || EOF;
    }


    var state, action, r, t;
    var yyval = {
        $: true,
        _$: undefined,
        yy: sharedState_yy
    };
    var p;
    var yyrulelen;
    var this_production;
    var newState;
    var retval = false;


    // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = sp - 1;
        var depth = 0;

        // try to recover from error
        for (;;) {
            // check for error recovery rule in this state









            var t = table[state][TERROR] || NO_ACTION;
            if (t[0]) {
                // We need to make sure we're not cycling forever:
                // once we hit EOF, even when we `yyerrok()` an error, we must
                // prevent the core from running forever,
                // e.g. when parent rules are still expecting certain input to
                // follow after this, for example when you handle an error inside a set
                // of braces which are matched by a parent rule in your grammar.
                //
                // Hence we require that every error handling/recovery attempt
                // *after we've hit EOF* has a diminishing state stack: this means
                // we will ultimately have unwound the state stack entirely and thus
                // terminate the parse in a controlled fashion even when we have
                // very complex error/recovery code interplay in the core + user
                // action code blocks:









                if (symbol === EOF) {
                    if (!lastEofErrorStateDepth) {
                        lastEofErrorStateDepth = sp - 1 - depth;
                    } else if (lastEofErrorStateDepth <= sp - 1 - depth) {









                        --stack_probe; // popStack(1): [symbol, action]
                        state = sstack[stack_probe];
                        ++depth;
                        continue;
                    }
                }
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 1) {









                return -1; // No suitable error recovery rule available.
            }
            --stack_probe; // popStack(1): [symbol, action]
            state = sstack[stack_probe];
            ++depth;
        }
    }


    try {
        this.__reentrant_call_depth++;

        lexer.setInput(input, sharedState_yy);

        yyloc = lexer.yylloc;
        lstack[sp] = yyloc;
        vstack[sp] = null;
        sstack[sp] = 0;
        stack[sp] = 0;
        ++sp;





        if (this.pre_parse) {
            this.pre_parse.call(this, sharedState_yy);
        }
        if (sharedState_yy.pre_parse) {
            sharedState_yy.pre_parse.call(this, sharedState_yy);
        }

        newState = sstack[sp - 1];
        for (;;) {
            // retrieve state number from top of stack
            state = newState;               // sstack[sp - 1];

            // use default actions if available
            if (this.defaultActions[state]) {
                action = 2;
                newState = this.defaultActions[state];
            } else {
                // The single `==` condition below covers both these `===` comparisons in a single
                // operation:
                //
                //     if (symbol === null || typeof symbol === 'undefined') ...
                if (!symbol) {
                    symbol = lex();
                }
                // read action for current state and first input
                t = (table[state] && table[state][symbol]) || NO_ACTION;
                newState = t[1];
                action = t[0];











                // handle parse error
                if (!action) {
                    // first see if there's any chance at hitting an error recovery rule:
                    var error_rule_depth = locateNearestErrorRecoveryRule(state);
                    var errStr = null;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

                    if (!recovering) {
                        // Report error
                        if (typeof lexer.yylineno === 'number') {
                            errStr = 'Parse error on line ' + (lexer.yylineno + 1) + ': ';
                        } else {
                            errStr = 'Parse error: ';
                        }

                        if (typeof lexer.showPosition === 'function') {
                            errStr += '\n' + lexer.showPosition(79 - 10, 10) + '\n';
                        }
                        if (expected.length) {
                            errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
                        } else {
                            errStr += 'Unexpected ' + errSymbolDescr;
                        }

                        p = this.constructParseErrorInfo(errStr, null, expected, (error_rule_depth >= 0));

                        // cleanup the old one before we start the new error info track:
                        if (recoveringErrorInfo && typeof recoveringErrorInfo.destroy === 'function') {
                            recoveringErrorInfo.destroy();
                        }
                        recoveringErrorInfo = this.shallowCopyErrorInfo(p);

                        r = this.parseError(p.errStr, p, this.JisonParserError);









                        // Protect against overly blunt userland `parseError` code which *sets*
                        // the `recoverable` flag without properly checking first:
                        // we always terminate the parse when there's no recovery rule available anyhow!
                        if (!p.recoverable || error_rule_depth < 0) {
                            retval = r;
                            break;
                        } else {
                            // TODO: allow parseError callback to edit symbol and or state at the start of the error recovery process...
                        }
                    }










                    var esp = recoveringErrorInfo.info_stack_pointer;

                    // just recovered from another error
                    if (recovering === ERROR_RECOVERY_TOKEN_DISCARD_COUNT && error_rule_depth >= 0) {
                        // SHIFT current lookahead and grab another
                        recoveringErrorInfo.symbol_stack[esp] = symbol;
                        recoveringErrorInfo.value_stack[esp] = shallow_copy(lexer.yytext);
                        recoveringErrorInfo.location_stack[esp] = copy_yylloc(lexer.yylloc);
                        recoveringErrorInfo.state_stack[esp] = newState; // push state
                        ++esp;

                        // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:



                        yyloc = lexer.yylloc;

                        preErrorSymbol = 0;
                        symbol = lex();









                    }

                    // try to recover from error
                    if (error_rule_depth < 0) {
                        ASSERT(recovering > 0);
                        recoveringErrorInfo.info_stack_pointer = esp;

                        // barf a fatal hairball when we're out of look-ahead symbols and none hit a match
                        // while we are still busy recovering from another error:
                        var po = this.__error_infos[this.__error_infos.length - 1];
                        if (!po) {
                            p = this.constructParseErrorInfo('Parsing halted while starting to recover from another error.', null, expected, false);
                        } else {
                            p = this.constructParseErrorInfo('Parsing halted while starting to recover from another error. Previous error which resulted in this fatal result: ' + po.errStr, null, expected, false);
                            p.extra_error_attributes = po;
                        }
                        retval = this.parseError(p.errStr, p, this.JisonParserError);
                        break;
                    }

                    preErrorSymbol = (symbol === TERROR ? 0 : symbol); // save the lookahead token
                    symbol = TERROR;            // insert generic error symbol as new lookahead

                    const EXTRA_STACK_SAMPLE_DEPTH = 3;

                    // REDUCE/COMBINE the pushed terms/tokens to a new ERROR token:
                    recoveringErrorInfo.symbol_stack[esp] = preErrorSymbol;
                    if (errStr) {
                        recoveringErrorInfo.value_stack[esp] = {
                            yytext: shallow_copy(lexer.yytext),
                            errorRuleDepth: error_rule_depth,
                            errorStr: errStr,
                            errorSymbolDescr: errSymbolDescr,
                            expectedStr: expected,
                            stackSampleLength: error_rule_depth + EXTRA_STACK_SAMPLE_DEPTH
                        };









                    } else {
                        recoveringErrorInfo.value_stack[esp] = {
                            yytext: shallow_copy(lexer.yytext),
                            errorRuleDepth: error_rule_depth,
                            stackSampleLength: error_rule_depth + EXTRA_STACK_SAMPLE_DEPTH
                        };
                    }
                    recoveringErrorInfo.location_stack[esp] = copy_yylloc(lexer.yylloc);
                    recoveringErrorInfo.state_stack[esp] = newState || NO_ACTION[1];

                    ++esp;
                    recoveringErrorInfo.info_stack_pointer = esp;

                    yyval.$ = recoveringErrorInfo;
                    yyval._$ = undefined;

                    yyrulelen = error_rule_depth;









                    r = this.performAction.call(yyval, yyloc, NO_ACTION[1], sp - 1, vstack, lstack);

                    if (typeof r !== 'undefined') {
                        retval = r;
                        break;
                    }

                    // pop off stack
                    sp -= yyrulelen;

                    // and move the top entries + discarded part of the parse stacks onto the error info stack:
                    for (var idx = sp - EXTRA_STACK_SAMPLE_DEPTH, top = idx + yyrulelen; idx < top; idx++, esp++) {
                        recoveringErrorInfo.symbol_stack[esp] = stack[idx];
                        recoveringErrorInfo.value_stack[esp] = shallow_copy(vstack[idx]);
                        recoveringErrorInfo.location_stack[esp] = copy_yylloc(lstack[idx]);
                        recoveringErrorInfo.state_stack[esp] = sstack[idx];
                    }

                    recoveringErrorInfo.symbol_stack[esp] = TERROR;
                    recoveringErrorInfo.value_stack[esp] = shallow_copy(yyval.$);
                    recoveringErrorInfo.location_stack[esp] = copy_yylloc(yyval._$);

                    // goto new state = table[STATE][NONTERMINAL]
                    newState = sstack[sp - 1];

                    if (this.defaultActions[newState]) {
                        recoveringErrorInfo.state_stack[esp] = this.defaultActions[newState];
                    } else {
                        t = (table[newState] && table[newState][symbol]) || NO_ACTION;
                        recoveringErrorInfo.state_stack[esp] = t[1];
                    }

                    ++esp;
                    recoveringErrorInfo.info_stack_pointer = esp;

                    // allow N (default: 3) real symbols to be shifted before reporting a new error
                    recovering = ERROR_RECOVERY_TOKEN_DISCARD_COUNT;










                    // Now duplicate the standard parse machine here, at least its initial
                    // couple of rounds until the TERROR symbol is **pushed onto the parse stack**,
                    // as we wish to push something special then!


                    // Run the state machine in this copy of the parser state machine
                    // until we *either* consume the error symbol (and its related information)
                    // *or* we run into another error while recovering from this one
                    // *or* we execute a `reduce` action which outputs a final parse
                    // result (yes, that MAY happen!)...

                    ASSERT(recoveringErrorInfo);
                    ASSERT(symbol === TERROR);
                    while (symbol) {
                        // retrieve state number from top of stack
                        state = newState;               // sstack[sp - 1];

                        // use default actions if available
                        if (this.defaultActions[state]) {
                            action = 2;
                            newState = this.defaultActions[state];
                        } else {
                            // read action for current state and first input
                            t = (table[state] && table[state][symbol]) || NO_ACTION;
                            newState = t[1];
                            action = t[0];










                            // encountered another parse error? If so, break out to main loop
                            // and take it from there!
                            if (!action) {
                                newState = state;
                                break;
                            }
                        }










                        switch (action) {
                        // catch misc. parse failures:
                        default:
                            // this shouldn't happen, unless resolve defaults are off
                            if (action instanceof Array) {
                                p = this.constructParseErrorInfo('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, null, null, false);
                                retval = this.parseError(p.errStr, p, this.JisonParserError);
                                // signal end of error recovery loop AND end of outer parse loop
                                action = 3;
                                break;
                            }
                            // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                            // or a buggy LUT (LookUp Table):
                            p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                            retval = this.parseError(p.errStr, p, this.JisonParserError);
                            // signal end of error recovery loop AND end of outer parse loop
                            action = 3;
                            break;

                        // shift:
                        case 1:
                            stack[sp] = symbol;
                            //vstack[sp] = lexer.yytext;
                            ASSERT(recoveringErrorInfo);
                            vstack[sp] = recoveringErrorInfo;
                            //lstack[sp] = copy_yylloc(lexer.yylloc);
                            lstack[sp] = this.yyMergeLocationInfo(null, null, recoveringErrorInfo.loc, lexer.yylloc, true);
                            sstack[sp] = newState; // push state
                            ++sp;
                            symbol = 0;
                            if (!preErrorSymbol) { // normal execution / no error
                                // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:



                                yyloc = lexer.yylloc;

                                if (recovering > 0) {
                                    recovering--;









                                }
                            } else {
                                // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                                symbol = preErrorSymbol;
                                preErrorSymbol = 0;









                                // read action for current state and first input
                                t = (table[newState] && table[newState][symbol]) || NO_ACTION;
                                if (!t[0] || symbol === TERROR) {
                                    // forget about that symbol and move forward: this wasn't a 'forgot to insert' error type where
                                    // (simple) stuff might have been missing before the token which caused the error we're
                                    // recovering from now...
                                    //
                                    // Also check if the LookAhead symbol isn't the ERROR token we set as part of the error
                                    // recovery, for then this we would we idling (cycling) on the error forever.
                                    // Yes, this does not take into account the possibility that the *lexer* may have
                                    // produced a *new* TERROR token all by itself, but that would be a very peculiar grammar!









                                    symbol = 0;
                                }
                            }

                            // once we have pushed the special ERROR token value, we're done in this inner loop!
                            break;

                        // reduce:
                        case 2:
                            this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                            yyrulelen = this_production[1];










                            r = this.performAction.call(yyval, yyloc, newState, sp - 1, vstack, lstack);

                            if (typeof r !== 'undefined') {
                                // signal end of error recovery loop AND end of outer parse loop
                                action = 3;
                                retval = r;
                                break;
                            }

                            // pop off stack
                            sp -= yyrulelen;

                            // don't overwrite the `symbol` variable: use a local var to speed things up:
                            var ntsymbol = this_production[0];    // push nonterminal (reduce)
                            stack[sp] = ntsymbol;
                            vstack[sp] = yyval.$;
                            lstack[sp] = yyval._$;
                            // goto new state = table[STATE][NONTERMINAL]
                            newState = table[sstack[sp - 1]][ntsymbol];
                            sstack[sp] = newState;
                            ++sp;









                            continue;

                        // accept:
                        case 3:
                            retval = true;
                            // Return the `$accept` rule's `$$` result, if available.
                            //
                            // Also note that JISON always adds this top-most `$accept` rule (with implicit,
                            // default, action):
                            //
                            //     $accept: <startSymbol> $end
                            //                  %{ $$ = $1; @$ = @1; %}
                            //
                            // which, combined with the parse kernel's `$accept` state behaviour coded below,
                            // will produce the `$$` value output of the <startSymbol> rule as the parse result,
                            // IFF that result is *not* `undefined`. (See also the parser kernel code.)
                            //
                            // In code:
                            //
                            //                  %{
                            //                      @$ = @1;            // if location tracking support is included
                            //                      if (typeof $1 !== 'undefined')
                            //                          return $1;
                            //                      else
                            //                          return true;           // the default parse result if the rule actions don't produce anything
                            //                  %}
                            sp--;
                            if (typeof vstack[sp] !== 'undefined') {
                                retval = vstack[sp];
                            }
                            break;
                        }

                        // break out of loop: we accept or fail with error
                        break;
                    }

                    // should we also break out of the regular/outer parse loop,
                    // i.e. did the parser already produce a parse result in here?!
                    if (action === 3) {
                        break;
                    }
                    continue;
                }


            }










            switch (action) {
            // catch misc. parse failures:
            default:
                // this shouldn't happen, unless resolve defaults are off
                if (action instanceof Array) {
                    p = this.constructParseErrorInfo('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, null, null, false);
                    retval = this.parseError(p.errStr, p, this.JisonParserError);
                    break;
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
                // or a buggy LUT (LookUp Table):
                p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
                retval = this.parseError(p.errStr, p, this.JisonParserError);
                break;

            // shift:
            case 1:
                stack[sp] = symbol;
                vstack[sp] = lexer.yytext;
                lstack[sp] = copy_yylloc(lexer.yylloc);
                sstack[sp] = newState; // push state

                if (typeof Jison !== 'undefined' && Jison.parserDebugger) {
                    var tokenName = self.getSymbolName(symbol || EOF);
                    if (!tokenName) {
                        tokenName = symbol;
                    }

                    Jison.parserDebugger.push({
                        action: 'shift',
                        text: lexer.yytext,
                        terminal: tokenName,
                        terminal_id: symbol
                    });
                }

                ++sp;
                symbol = 0;
                ASSERT(preErrorSymbol === 0);
                if (!preErrorSymbol) { // normal execution / no error
                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:



                    yyloc = lexer.yylloc;

                    if (recovering > 0) {
                        recovering--;









                    }
                } else {
                    // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                    symbol = preErrorSymbol;
                    preErrorSymbol = 0;









                    // read action for current state and first input
                    t = (table[newState] && table[newState][symbol]) || NO_ACTION;
                    if (!t[0] || symbol === TERROR) {
                        // forget about that symbol and move forward: this wasn't a 'forgot to insert' error type where
                        // (simple) stuff might have been missing before the token which caused the error we're
                        // recovering from now...
                        //
                        // Also check if the LookAhead symbol isn't the ERROR token we set as part of the error
                        // recovery, for then this we would we idling (cycling) on the error forever.
                        // Yes, this does not take into account the possibility that the *lexer* may have
                        // produced a *new* TERROR token all by itself, but that would be a very peculiar grammar!









                        symbol = 0;
                    }
                }

                continue;

            // reduce:
            case 2:
                this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                yyrulelen = this_production[1];










                r = this.performAction.call(yyval, yyloc, newState, sp - 1, vstack, lstack);

                if (yyrulelen && typeof Jison !== 'undefined' && Jison.parserDebugger) {
                    var prereduceValue = vstack.slice(sp - yyrulelen, sp);
                    var debuggableProductions = [];
                    for (var debugIdx = yyrulelen - 1; debugIdx >= 0; debugIdx--) {
                        var debuggableProduction = getNonTerminalFromCode(stack[sp - debugIdx]);
                        debuggableProductions.push(debuggableProduction);
                    }
                    // find the current nonterminal name (- nolan)
                    var currentNonterminalCode = this_production[0];     // WARNING: nolan's original code takes this one instead:   this.productions_[newState][0];
                    var currentNonterminal = getNonTerminalFromCode(currentNonterminalCode);

                    Jison.parserDebugger.push({
                        action: 'reduce',
                        nonterminal: currentNonterminal,
                        nonterminal_id: currentNonterminalCode,
                        prereduce: prereduceValue,
                        result: r,
                        productions: debuggableProductions,
                        text: yyval.$
                    });
                }

                if (typeof r !== 'undefined') {
                    retval = r;
                    break;
                }

                // pop off stack
                sp -= yyrulelen;

                // don't overwrite the `symbol` variable: use a local var to speed things up:
                var ntsymbol = this_production[0];    // push nonterminal (reduce)
                stack[sp] = ntsymbol;
                vstack[sp] = yyval.$;
                lstack[sp] = yyval._$;
                // goto new state = table[STATE][NONTERMINAL]
                newState = table[sstack[sp - 1]][ntsymbol];
                sstack[sp] = newState;
                ++sp;









                continue;

            // accept:
            case 3:
                retval = true;
                // Return the `$accept` rule's `$$` result, if available.
                //
                // Also note that JISON always adds this top-most `$accept` rule (with implicit,
                // default, action):
                //
                //     $accept: <startSymbol> $end
                //                  %{ $$ = $1; @$ = @1; %}
                //
                // which, combined with the parse kernel's `$accept` state behaviour coded below,
                // will produce the `$$` value output of the <startSymbol> rule as the parse result,
                // IFF that result is *not* `undefined`. (See also the parser kernel code.)
                //
                // In code:
                //
                //                  %{
                //                      @$ = @1;            // if location tracking support is included
                //                      if (typeof $1 !== 'undefined')
                //                          return $1;
                //                      else
                //                          return true;           // the default parse result if the rule actions don't produce anything
                //                  %}
                sp--;
                if (typeof vstack[sp] !== 'undefined') {
                    retval = vstack[sp];
                }

                if (typeof Jison !== 'undefined' && Jison.parserDebugger) {
                    Jison.parserDebugger.push({
                        action: 'accept',
                        text: retval
                    });
                    console.log(Jison.parserDebugger[Jison.parserDebugger.length - 1]);
                }

                break;
            }

            // break out of loop: we accept or fail with error
            break;
        }
    } catch (ex) {
        // report exceptions through the parseError callback too, but keep the exception intact
        // if it is a known parser or lexer error which has been thrown by parseError() already:
        if (ex instanceof this.JisonParserError) {
            throw ex;
        }
        else if (lexer && typeof lexer.JisonLexerError === 'function' && ex instanceof lexer.JisonLexerError) {
            throw ex;
        }
        else {
            p = this.constructParseErrorInfo('Parsing aborted due to exception.', ex, null, false);
            retval = this.parseError(p.errStr, p, this.JisonParserError);
        }
    } finally {
        retval = this.cleanupAfterParse(retval, true, true);
        this.__reentrant_call_depth--;

        if (typeof Jison !== 'undefined' && Jison.parserDebugger) {
            Jison.parserDebugger.push({
                action: 'return',
                text: retval
            });
            console.log(Jison.parserDebugger[Jison.parserDebugger.length - 1]);
        }
    }   // /finally

    return retval;
},
yyError: 1
};
parser.originalParseError = parser.parseError;
parser.originalQuoteName = parser.quoteName;

var rmCommonWS = helpers.rmCommonWS;

function encodeRE(s) {
    return s.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1').replace(/\\\\u([a-fA-F0-9]{4})/g, '\\u$1');
}

function prepareString(s) {
    // unescape slashes
    s = s.replace(/\\\\/g, "\\");
    s = encodeRE(s);
    return s;
}

// convert string value to number or boolean value, when possible
// (and when this is more or less obviously the intent)
// otherwise produce the string itself as value.
function parseValue(v) {
    if (v === 'false') {
        return false;
    }
    if (v === 'true') {
        return true;
    }
    // http://stackoverflow.com/questions/175739/is-there-a-built-in-way-in-javascript-to-check-if-a-string-is-a-valid-number
    // Note that the `v` check ensures that we do not convert `undefined`, `null` and `''` (empty string!)
    if (v && !isNaN(v)) {
        var rv = +v;
        if (isFinite(rv)) {
            return rv;
        }
    }
    return v;
}


parser.warn = function p_warn() {
    console.warn.apply(console, arguments);
};

parser.log = function p_log() {
    console.log.apply(console, arguments);
};

parser.pre_parse = function p_lex() {
    if (parser.yydebug) parser.log('pre_parse:', arguments);
};

parser.yy.pre_parse = function p_lex() {
    if (parser.yydebug) parser.log('pre_parse YY:', arguments);
};

parser.yy.post_lex = function p_lex() {
    if (parser.yydebug) parser.log('post_lex:', arguments);
};
/* lexer generated by jison-lex 0.6.1-200 */

/*
 * Returns a Lexer object of the following structure:
 *
 *  Lexer: {
 *    yy: {}     The so-called "shared state" or rather the *source* of it;
 *               the real "shared state" `yy` passed around to
 *               the rule actions, etc. is a direct reference!
 *
 *               This "shared context" object was passed to the lexer by way of 
 *               the `lexer.setInput(str, yy)` API before you may use it.
 *
 *               This "shared context" object is passed to the lexer action code in `performAction()`
 *               so userland code in the lexer actions may communicate with the outside world 
 *               and/or other lexer rules' actions in more or less complex ways.
 *
 *  }
 *
 *  Lexer.prototype: {
 *    EOF: 1,
 *    ERROR: 2,
 *
 *    yy:        The overall "shared context" object reference.
 *
 *    JisonLexerError: function(msg, hash),
 *
 *    performAction: function lexer__performAction(yy, yyrulenumber, YY_START),
 *
 *               The function parameters and `this` have the following value/meaning:
 *               - `this`    : reference to the `lexer` instance. 
 *                               `yy_` is an alias for `this` lexer instance reference used internally.
 *
 *               - `yy`      : a reference to the `yy` "shared state" object which was passed to the lexer
 *                             by way of the `lexer.setInput(str, yy)` API before.
 *
 *                             Note:
 *                             The extra arguments you specified in the `%parse-param` statement in your
 *                             **parser** grammar definition file are passed to the lexer via this object
 *                             reference as member variables.
 *
 *               - `yyrulenumber`   : index of the matched lexer rule (regex), used internally.
 *
 *               - `YY_START`: the current lexer "start condition" state.
 *
 *    parseError: function(str, hash, ExceptionClass),
 *
 *    constructLexErrorInfo: function(error_message, is_recoverable),
 *               Helper function.
 *               Produces a new errorInfo 'hash object' which can be passed into `parseError()`.
 *               See it's use in this lexer kernel in many places; example usage:
 *
 *                   var infoObj = lexer.constructParseErrorInfo('fail!', true);
 *                   var retVal = lexer.parseError(infoObj.errStr, infoObj, lexer.JisonLexerError);
 *
 *    options: { ... lexer %options ... },
 *
 *    lex: function(),
 *               Produce one token of lexed input, which was passed in earlier via the `lexer.setInput()` API.
 *               You MAY use the additional `args...` parameters as per `%parse-param` spec of the **lexer** grammar:
 *               these extra `args...` are added verbatim to the `yy` object reference as member variables.
 *
 *               WARNING:
 *               Lexer's additional `args...` parameters (via lexer's `%parse-param`) MAY conflict with
 *               any attributes already added to `yy` by the **parser** or the jison run-time; 
 *               when such a collision is detected an exception is thrown to prevent the generated run-time 
 *               from silently accepting this confusing and potentially hazardous situation! 
 *
 *    cleanupAfterLex: function(do_not_nuke_errorinfos),
 *               Helper function.
 *
 *               This helper API is invoked when the **parse process** has completed: it is the responsibility
 *               of the **parser** (or the calling userland code) to invoke this method once cleanup is desired. 
 *
 *               This helper may be invoked by user code to ensure the internal lexer gets properly garbage collected.
 *
 *    setInput: function(input, [yy]),
 *
 *
 *    input: function(),
 *
 *
 *    unput: function(str),
 *
 *
 *    more: function(),
 *
 *
 *    reject: function(),
 *
 *
 *    less: function(n),
 *
 *
 *    pastInput: function(n),
 *
 *
 *    upcomingInput: function(n),
 *
 *
 *    showPosition: function(),
 *
 *
 *    test_match: function(regex_match_array, rule_index),
 *
 *
 *    next: function(),
 *
 *
 *    begin: function(condition),
 *
 *
 *    pushState: function(condition),
 *
 *
 *    popState: function(),
 *
 *
 *    topState: function(),
 *
 *
 *    _currentRules: function(),
 *
 *
 *    stateStackSize: function(),
 *
 *
 *    performAction: function(yy, yy_, yyrulenumber, YY_START),
 *
 *
 *    rules: [...],
 *
 *
 *    conditions: {associative list: name ==> set},
 *  }
 *
 *
 *  token location info (`yylloc`): {
 *    first_line: n,
 *    last_line: n,
 *    first_column: n,
 *    last_column: n,
 *    range: [start_number, end_number]
 *               (where the numbers are indexes into the input string, zero-based)
 *  }
 *
 * ---
 *
 * The `parseError` function receives a 'hash' object with these members for lexer errors:
 *
 *  {
 *    text:        (matched text)
 *    token:       (the produced terminal token, if any)
 *    token_id:    (the produced terminal token numeric ID, if any)
 *    line:        (yylineno)
 *    loc:         (yylloc)
 *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule
 *                  available for this particular error)
 *    yy:          (object: the current parser internal "shared state" `yy`
 *                  as is also available in the rule actions; this can be used,
 *                  for instance, for advanced error analysis and reporting)
 *    lexer:       (reference to the current lexer instance used by the parser)
 *  }
 *
 * while `this` will reference the current lexer instance.
 *
 * When `parseError` is invoked by the lexer, the default implementation will
 * attempt to invoke `yy.parser.parseError()`; when this callback is not provided
 * it will try to invoke `yy.parseError()` instead. When that callback is also not
 * provided, a `JisonLexerError` exception will be thrown containing the error
 * message and `hash`, as constructed by the `constructLexErrorInfo()` API.
 *
 * Note that the lexer's `JisonLexerError` error class is passed via the
 * `ExceptionClass` argument, which is invoked to construct the exception
 * instance to be thrown, so technically `parseError` will throw the object
 * produced by the `new ExceptionClass(str, hash)` JavaScript expression.
 *
 * ---
 *
 * You can specify lexer options by setting / modifying the `.options` object of your Lexer instance.
 * These options are available:
 *
 * (Options are permanent.)
 *  
 *  yy: {
 *      parseError: function(str, hash, ExceptionClass)
 *                 optional: overrides the default `parseError` function.
 *  }
 *
 *  lexer.options: {
 *      pre_lex:  function()
 *                 optional: is invoked before the lexer is invoked to produce another token.
 *                 `this` refers to the Lexer object.
 *      post_lex: function(token) { return token; }
 *                 optional: is invoked when the lexer has produced a token `token`;
 *                 this function can override the returned token value by returning another.
 *                 When it does not return any (truthy) value, the lexer will return
 *                 the original `token`.
 *                 `this` refers to the Lexer object.
 *
 * WARNING: the next set of options are not meant to be changed. They echo the abilities of
 * the lexer as per when it was compiled!
 *
 *      ranges: boolean
 *                 optional: `true` ==> token location info will include a .range[] member.
 *      flex: boolean
 *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested
 *                 exhaustively to find the longest match.
 *      backtrack_lexer: boolean
 *                 optional: `true` ==> lexer regexes are tested in order and for invoked;
 *                 the lexer terminates the scan when a token is returned by the action code.
 *      xregexp: boolean
 *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the
 *                 `XRegExp` library. When this %option has not been specified at compile time, all lexer
 *                 rule regexes have been written as standard JavaScript RegExp expressions.
 *  }
 */


var lexer = function() {
  /**
   * See also:
   * http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
   * but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
   * with userland code which might access the derived class in a 'classic' way.
   *
   * @public
   * @constructor
   * @nocollapse
   */
  function JisonLexerError(msg, hash) {
    Object.defineProperty(this, 'name', {
      enumerable: false,
      writable: false,
      value: 'JisonLexerError'
    });

    if (msg == null)
      msg = '???';

    Object.defineProperty(this, 'message', {
      enumerable: false,
      writable: true,
      value: msg
    });

    this.hash = hash;
    var stacktrace;

    if (hash && hash.exception instanceof Error) {
      var ex2 = hash.exception;
      this.message = ex2.message || msg;
      stacktrace = ex2.stack;
    }

    if (!stacktrace) {
      if (Error.hasOwnProperty('captureStackTrace')) {
        // V8
        Error.captureStackTrace(this, this.constructor);
      } else {
        stacktrace = new Error(msg).stack;
      }
    }

    if (stacktrace) {
      Object.defineProperty(this, 'stack', {
        enumerable: false,
        writable: false,
        value: stacktrace
      });
    }
  }

  if (typeof Object.setPrototypeOf === 'function') {
    Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
  } else {
    JisonLexerError.prototype = Object.create(Error.prototype);
  }

  JisonLexerError.prototype.constructor = JisonLexerError;
  JisonLexerError.prototype.name = 'JisonLexerError';

  var lexer = {
    
// Code Generator Information Report
// ---------------------------------
//
// Options:
//
//   backtracking: .................... false
//   location.ranges: ................. true
//   location line+column tracking: ... true
//
//
// Forwarded Parser Analysis flags:
//
//   uses yyleng: ..................... false
//   uses yylineno: ................... false
//   uses yytext: ..................... false
//   uses yylloc: ..................... false
//   uses lexer values: ............... true / true
//   location tracking: ............... true
//   location assignment: ............. true
//
//
// Lexer Analysis flags:
//
//   uses yyleng: ..................... ???
//   uses yylineno: ................... ???
//   uses yytext: ..................... ???
//   uses yylloc: ..................... ???
//   uses ParseError API: ............. ???
//   uses yyerror: .................... ???
//   uses location tracking & editing:  ???
//   uses more() API: ................. ???
//   uses unput() API: ................ ???
//   uses reject() API: ............... ???
//   uses less() API: ................. ???
//   uses display APIs pastInput(), upcomingInput(), showPosition():
//        ............................. ???
//   uses describeYYLLOC() API: ....... ???
//
// --------- END OF REPORT -----------

EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,        /// <-- injected by the code generator

    // options: {},                             /// <-- injected by the code generator

    // yy: ...,                                 /// <-- injected by setInput()

    __currentRuleSet__: null,                   /// INTERNAL USE ONLY: internal rule set cache for the current lexer state  

    __error_infos: [],                          /// INTERNAL USE ONLY: the set of lexErrorInfo objects created since the last cleanup  
    __decompressed: false,                      /// INTERNAL USE ONLY: mark whether the lexer instance has been 'unfolded' completely and is now ready for use  
    done: false,                                /// INTERNAL USE ONLY  
    _backtrack: false,                          /// INTERNAL USE ONLY  
    _input: '',                                 /// INTERNAL USE ONLY  
    _more: false,                               /// INTERNAL USE ONLY  
    _signaled_error_token: false,               /// INTERNAL USE ONLY  
    conditionStack: [],                         /// INTERNAL USE ONLY; managed via `pushState()`, `popState()`, `topState()` and `stateStackSize()`  
    match: '',                                  /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction. `match` is identical to `yytext` except that this one still contains the matched input string after `lexer.performAction()` has been invoked, where userland code MAY have changed/replaced the `yytext` value entirely!  
    matched: '',                                /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks entire input which has been matched so far  
    matches: false,                             /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks RE match result for last (successful) match attempt  
    yytext: '',                                 /// ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction; this value is transferred to the parser as the 'token value' when the parser consumes the lexer token produced through a call to the `lex()` API.  
    offset: 0,                                  /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks the 'cursor position' in the input string, i.e. the number of characters matched so far  
    yyleng: 0,                                  /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: length of matched input for the token under construction (`yytext`)  
    yylineno: 0,                                /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: 'line number' at which the token under construction is located  
    yylloc: null,                               /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks location info (lines + columns) for the token under construction  

    /**
     * INTERNAL USE: construct a suitable error info hash object instance for `parseError`.
     * 
     * @public
     * @this {RegExpLexer}
     */
    constructLexErrorInfo: function lexer_constructLexErrorInfo(msg, recoverable) {
      /** @constructor */
      var pei = {
        errStr: msg,
        recoverable: !!recoverable,
        text: this.match,           // This one MAY be empty; userland code should use the `upcomingInput` API to obtain more text which follows the 'lexer cursor position'...  
        token: null,
        line: this.yylineno,
        loc: this.yylloc,
        yy: this.yy,
        lexer: this,

        /**
         * and make sure the error info doesn't stay due to potential
         * ref cycle via userland code manipulations.
         * These would otherwise all be memory leak opportunities!
         * 
         * Note that only array and object references are nuked as those
         * constitute the set of elements which can produce a cyclic ref.
         * The rest of the members is kept intact as they are harmless.
         * 
         * @public
         * @this {LexErrorInfo}
         */
        destroy: function destructLexErrorInfo() {
          // remove cyclic references added to error info:
          // info.yy = null;
          // info.lexer = null;
          // ...
          var rec = !!this.recoverable;

          for (var key in this) {
            if (this.hasOwnProperty(key) && typeof key === 'object') {
              this[key] = undefined;
            }
          }

          this.recoverable = rec;
        }
      };

      // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!
      this.__error_infos.push(pei);

      return pei;
    },

    /**
     * handler which is invoked when a lexer error occurs.
     * 
     * @public
     * @this {RegExpLexer}
     */
    parseError: function lexer_parseError(str, hash, ExceptionClass) {
      if (!ExceptionClass) {
        ExceptionClass = this.JisonLexerError;
      }

      if (this.yy) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
          return this.yy.parser.parseError.call(this, str, hash, ExceptionClass) || this.ERROR;
        } else if (typeof this.yy.parseError === 'function') {
          return this.yy.parseError.call(this, str, hash, ExceptionClass) || this.ERROR;
        }
      }

      throw new ExceptionClass(str, hash);
    },

    /**
     * method which implements `yyerror(str, ...args)` functionality for use inside lexer actions.
     * 
     * @public
     * @this {RegExpLexer}
     */
    yyerror: function yyError(str /*, ...args */) {
      var lineno_msg = '';

      if (this.options.trackPosition) {
        lineno_msg = ' on line ' + (this.yylineno + 1);
      }

      var p = this.constructLexErrorInfo(
        'Lexical error' + lineno_msg + ': ' + str,
        this.options.lexerErrorsAreRecoverable
      );

      // Add any extra args to the hash under the name `extra_error_attributes`:
      var args = Array.prototype.slice.call(arguments, 1);

      if (args.length) {
        p.extra_error_attributes = args;
      }

      return this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
    },

    /**
     * final cleanup function for when we have completed lexing the input;
     * make it an API so that external code can use this one once userland
     * code has decided it's time to destroy any lingering lexer error
     * hash object instances and the like: this function helps to clean
     * up these constructs, which *may* carry cyclic references which would
     * otherwise prevent the instances from being properly and timely
     * garbage-collected, i.e. this function helps prevent memory leaks!
     * 
     * @public
     * @this {RegExpLexer}
     */
    cleanupAfterLex: function lexer_cleanupAfterLex(do_not_nuke_errorinfos) {
      // prevent lingering circular references from causing memory leaks:
      this.setInput('', {});

      // nuke the error hash info instances created during this run.
      // Userland code must COPY any data/references
      // in the error hash instance(s) it is more permanently interested in.
      if (!do_not_nuke_errorinfos) {
        for (var i = this.__error_infos.length - 1; i >= 0; i--) {
          var el = this.__error_infos[i];

          if (el && typeof el.destroy === 'function') {
            el.destroy();
          }
        }

        this.__error_infos.length = 0;
      }

      return this;
    },

    /**
     * clear the lexer token context; intended for internal use only
     * 
     * @public
     * @this {RegExpLexer}
     */
    clear: function lexer_clear() {
      this.yytext = '';
      this.yyleng = 0;
      this.match = '';

      // - DO NOT reset `this.matched`
      this.matches = false;

      this._more = false;
      this._backtrack = false;
      var col = (this.yylloc ? this.yylloc.last_column : 0);

      this.yylloc = {
        first_line: this.yylineno + 1,
        first_column: col,
        last_line: this.yylineno + 1,
        last_column: col,
        range: [this.offset, this.offset]
      };
    },

    /**
     * resets the lexer, sets new input
     * 
     * @public
     * @this {RegExpLexer}
     */
    setInput: function lexer_setInput(input, yy) {
      this.yy = yy || this.yy || {};

      // also check if we've fully initialized the lexer instance,
      // including expansion work to be done to go from a loaded
      // lexer to a usable lexer:
      if (!this.__decompressed) {
        // step 1: decompress the regex list:
        var rules = this.rules;

        for (var i = 0, len = rules.length; i < len; i++) {
          var rule_re = rules[i];

          // compression: is the RE an xref to another RE slot in the rules[] table?
          if (typeof rule_re === 'number') {
            rules[i] = rules[rule_re];
          }
        }

        // step 2: unfold the conditions[] set to make these ready for use:
        var conditions = this.conditions;

        for (var k in conditions) {
          var spec = conditions[k];
          var rule_ids = spec.rules;
          var len = rule_ids.length;
          var rule_regexes = new Array(len + 1);             // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in `lexer_next()` fast and simple! 
          var rule_new_ids = new Array(len + 1);

          for (var i = 0; i < len; i++) {
            var idx = rule_ids[i];
            var rule_re = rules[idx];
            rule_regexes[i + 1] = rule_re;
            rule_new_ids[i + 1] = idx;
          }

          spec.rules = rule_new_ids;
          spec.__rule_regexes = rule_regexes;
          spec.__rule_count = len;
        }

        this.__decompressed = true;
      }

      this._input = input || '';
      this.clear();
      this._signaled_error_token = false;
      this.done = false;
      this.yylineno = 0;
      this.matched = '';
      this.conditionStack = ['INITIAL'];
      this.__currentRuleSet__ = null;

      this.yylloc = {
        first_line: 1,
        first_column: 0,
        last_line: 1,
        last_column: 0,
        range: [0, 0]
      };

      this.offset = 0;
      return this;
    },

    /**
     * edit the remaining input via user-specified callback.
     * This can be used to forward-adjust the input-to-parse, 
     * e.g. inserting macro expansions and alike in the
     * input which has yet to be lexed.
     * The behaviour of this API contrasts the `unput()` et al
     * APIs as those act on the *consumed* input, while this
     * one allows one to manipulate the future, without impacting
     * the current `yyloc` cursor location or any history. 
     * 
     * Use this API to help implement C-preprocessor-like
     * `#include` statements, etc.
     * 
     * The provided callback must be synchronous and is
     * expected to return the edited input (string).
     *
     * The `cpsArg` argument value is passed to the callback
     * as-is.
     *
     * `callback` interface: 
     * `function callback(input, cpsArg)`
     * 
     * - `input` will carry the remaining-input-to-lex string
     *   from the lexer.
     * - `cpsArg` is `cpsArg` passed into this API.
     * 
     * The `this` reference for the callback will be set to
     * reference this lexer instance so that userland code
     * in the callback can easily and quickly access any lexer
     * API. 
     *
     * When the callback returns a non-string-type falsey value,
     * we assume the callback did not edit the input and we
     * will using the input as-is.
     *
     * When the callback returns a non-string-type value, it
     * is converted to a string for lexing via the `"" + retval`
     * operation. (See also why: http://2ality.com/2012/03/converting-to-string.html 
     * -- that way any returned object's `toValue()` and `toString()`
     * methods will be invoked in a proper/desirable order.)
     * 
     * @public
     * @this {RegExpLexer}
     */
    editRemainingInput: function lexer_editRemainingInput(callback, cpsArg) {
      var rv = callback.call(this, this._input, cpsArg);

      if (typeof rv !== 'string') {
        if (rv) {
          this._input = '' + rv;
        } 
        // else: keep `this._input` as is.  
      } else {
        this._input = rv;
      }

      return this;
    },

    /**
     * consumes and returns one char from the input
     * 
     * @public
     * @this {RegExpLexer}
     */
    input: function lexer_input() {
      if (!this._input) {
        //this.done = true;    -- don't set `done` as we want the lex()/next() API to be able to produce one custom EOF token match after this anyhow. (lexer can match special <<EOF>> tokens and perform user action code for a <<EOF>> match, but only does so *once*)
        return null;
      }

      var ch = this._input[0];
      this.yytext += ch;
      this.yyleng++;
      this.offset++;
      this.match += ch;
      this.matched += ch;

      // Count the linenumber up when we hit the LF (or a stand-alone CR).
      // On CRLF, the linenumber is incremented when you fetch the CR or the CRLF combo
      // and we advance immediately past the LF as well, returning both together as if
      // it was all a single 'character' only.
      var slice_len = 1;

      var lines = false;

      if (ch === '\n') {
        lines = true;
      } else if (ch === '\r') {
        lines = true;
        var ch2 = this._input[1];

        if (ch2 === '\n') {
          slice_len++;
          ch += ch2;
          this.yytext += ch2;
          this.yyleng++;
          this.offset++;
          this.match += ch2;
          this.matched += ch2;
          this.yylloc.range[1]++;
        }
      }

      if (lines) {
        this.yylineno++;
        this.yylloc.last_line++;
        this.yylloc.last_column = 0;
      } else {
        this.yylloc.last_column++;
      }

      this.yylloc.range[1]++;
      this._input = this._input.slice(slice_len);
      return ch;
    },

    /**
     * unshifts one char (or an entire string) into the input
     * 
     * @public
     * @this {RegExpLexer}
     */
    unput: function lexer_unput(ch) {
      var len = ch.length;
      var lines = ch.split(/(?:\r\n?|\n)/g);
      this._input = ch + this._input;
      this.yytext = this.yytext.substr(0, this.yytext.length - len);
      this.yyleng = this.yytext.length;
      this.offset -= len;
      this.match = this.match.substr(0, this.match.length - len);
      this.matched = this.matched.substr(0, this.matched.length - len);

      if (lines.length > 1) {
        this.yylineno -= lines.length - 1;
        this.yylloc.last_line = this.yylineno + 1;
        var pre = this.match;
        var pre_lines = pre.split(/(?:\r\n?|\n)/g);

        if (pre_lines.length === 1) {
          pre = this.matched;
          pre_lines = pre.split(/(?:\r\n?|\n)/g);
        }

        this.yylloc.last_column = pre_lines[pre_lines.length - 1].length;
      } else {
        this.yylloc.last_column -= len;
      }

      this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng;
      this.done = false;
      return this;
    },

    /**
     * cache matched text and append it on next action
     * 
     * @public
     * @this {RegExpLexer}
     */
    more: function lexer_more() {
      this._more = true;
      return this;
    },

    /**
     * signal the lexer that this rule fails to match the input, so the
     * next matching rule (regex) should be tested instead.
     * 
     * @public
     * @this {RegExpLexer}
     */
    reject: function lexer_reject() {
      if (this.options.backtrack_lexer) {
        this._backtrack = true;
      } else {
        // when the `parseError()` call returns, we MUST ensure that the error is registered.
        // We accomplish this by signaling an 'error' token to be produced for the current
        // `.lex()` run.
        var lineno_msg = '';

        if (this.options.trackPosition) {
          lineno_msg = ' on line ' + (this.yylineno + 1);
        }

        var pos_str = '';

        if (typeof this.showPosition === 'function') {
          pos_str = this.showPosition();

          if (pos_str && pos_str[0] !== '\n') {
            pos_str = '\n' + pos_str;
          }
        }

        var p = this.constructLexErrorInfo(
          'Lexical error' + lineno_msg + ': You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).' + pos_str,
          false
        );

        this._signaled_error_token = this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
      }

      return this;
    },

    /**
     * retain first n characters of the match
     * 
     * @public
     * @this {RegExpLexer}
     */
    less: function lexer_less(n) {
      return this.unput(this.match.slice(n));
    },

    /**
     * return (part of the) already matched input, i.e. for error
     * messages.
     * 
     * Limit the returned string length to `maxSize` (default: 20).
     * 
     * Limit the returned string to the `maxLines` number of lines of
     * input (default: 1).
     * 
     * Negative limit values equal *unlimited*.
     * 
     * @public
     * @this {RegExpLexer}
     */
    pastInput: function lexer_pastInput(maxSize, maxLines) {
      var past = this.matched.substring(0, this.matched.length - this.match.length);

      if (maxSize < 0)
        maxSize = past.length;
      else if (!maxSize)
        maxSize = 20;

      if (maxLines < 0)
        maxLines = past.length;          // can't ever have more input lines than this! 
      else if (!maxLines)
        maxLines = 1;

      // `substr` anticipation: treat \r\n as a single character and take a little
      // more than necessary so that we can still properly check against maxSize
      // after we've transformed and limited the newLines in here:
      past = past.substr(-maxSize * 2 - 2);

      // now that we have a significantly reduced string to process, transform the newlines
      // and chop them, then limit them:
      var a = past.replace(/\r\n|\r/g, '\n').split('\n');

      a = a.slice(-maxLines);
      past = a.join('\n');

      // When, after limiting to maxLines, we still have too much to return,
      // do add an ellipsis prefix...
      if (past.length > maxSize) {
        past = '...' + past.substr(-maxSize);
      }

      return past;
    },

    /**
     * return (part of the) upcoming input, i.e. for error messages.
     * 
     * Limit the returned string length to `maxSize` (default: 20).
     * 
     * Limit the returned string to the `maxLines` number of lines of input (default: 1).
     * 
     * Negative limit values equal *unlimited*.
     *
     * > ### NOTE ###
     * >
     * > *"upcoming input"* is defined as the whole of the both
     * > the *currently lexed* input, together with any remaining input
     * > following that. *"currently lexed"* input is the input 
     * > already recognized by the lexer but not yet returned with
     * > the lexer token. This happens when you are invoking this API
     * > from inside any lexer rule action code block. 
     * >
     * 
     * @public
     * @this {RegExpLexer}
     */
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
      var next = this.match;

      if (maxSize < 0)
        maxSize = next.length + this._input.length;
      else if (!maxSize)
        maxSize = 20;

      if (maxLines < 0)
        maxLines = maxSize;          // can't ever have more input lines than this! 
      else if (!maxLines)
        maxLines = 1;

      // `substring` anticipation: treat \r\n as a single character and take a little
      // more than necessary so that we can still properly check against maxSize
      // after we've transformed and limited the newLines in here:
      if (next.length < maxSize * 2 + 2) {
        next += this._input.substring(0, maxSize * 2 + 2);   // substring is faster on Chrome/V8 
      }

      // now that we have a significantly reduced string to process, transform the newlines
      // and chop them, then limit them:
      var a = next.replace(/\r\n|\r/g, '\n').split('\n');

      a = a.slice(0, maxLines);
      next = a.join('\n');

      // When, after limiting to maxLines, we still have too much to return,
      // do add an ellipsis postfix...
      if (next.length > maxSize) {
        next = next.substring(0, maxSize) + '...';
      }

      return next;
    },

    /**
     * return a string which displays the character position where the
     * lexing error occurred, i.e. for error messages
     * 
     * @public
     * @this {RegExpLexer}
     */
    showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
      var pre = this.pastInput(maxPrefix).replace(/\s/g, ' ');
      var c = new Array(pre.length + 1).join('-');
      return pre + this.upcomingInput(maxPostfix).replace(/\s/g, ' ') + '\n' + c + '^';
    },

    /**
     * return a string which displays the lines & columns of input which are referenced 
     * by the given location info range, plus a few lines of context.
     * 
     * This function pretty-prints the indicated section of the input, with line numbers 
     * and everything!
     * 
     * This function is very useful to provide highly readable error reports, while
     * the location range may be specified in various flexible ways:
     * 
     * - `loc` is the location info object which references the area which should be
     *   displayed and 'marked up': these lines & columns of text are marked up by `^`
     *   characters below each character in the entire input range.
     * 
     * - `context_loc` is the *optional* location info object which instructs this
     *   pretty-printer how much *leading* context should be displayed alongside
     *   the area referenced by `loc`. This can help provide context for the displayed
     *   error, etc.
     * 
     *   When this location info is not provided, a default context of 3 lines is
     *   used.
     * 
     * - `context_loc2` is another *optional* location info object, which serves
     *   a similar purpose to `context_loc`: it specifies the amount of *trailing*
     *   context lines to display in the pretty-print output.
     * 
     *   When this location info is not provided, a default context of 1 line only is
     *   used.
     * 
     * Special Notes:
     * 
     * - when the `loc`-indicated range is very large (about 5 lines or more), then
     *   only the first and last few lines of this block are printed while a
     *   `...continued...` message will be printed between them.
     * 
     *   This serves the purpose of not printing a huge amount of text when the `loc`
     *   range happens to be huge: this way a manageable & readable output results
     *   for arbitrary large ranges.
     * 
     * - this function can display lines of input which whave not yet been lexed.
     *   `prettyPrintRange()` can access the entire input!
     * 
     * @public
     * @this {RegExpLexer}
     */
    prettyPrintRange: function lexer_prettyPrintRange(loc, context_loc, context_loc2) {
      const CONTEXT = 3;
      const CONTEXT_TAIL = 1;
      const MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT = 2;
      var input = this.matched + this._input;
      var lines = input.split('\n');

      //var show_context = (error_size < 5 || context_loc);
      var l0 = Math.max(1, (context_loc ? context_loc.first_line : loc.first_line - CONTEXT));

      var l1 = Math.max(1, (context_loc2 ? context_loc2.last_line : loc.last_line + CONTEXT_TAIL));
      var lineno_display_width = 1 + Math.log10(l1 | 1) | 0;
      var ws_prefix = new Array(lineno_display_width).join(' ');
      var nonempty_line_indexes = [];

      var rv = lines.slice(l0 - 1, l1 + 1).map(function injectLineNumber(line, index) {
        var lno = index + l0;
        var lno_pfx = (ws_prefix + lno).substr(-lineno_display_width);
        var rv = lno_pfx + ': ' + line;
        var errpfx = new Array(lineno_display_width + 1).join('^');

        if (lno === loc.first_line) {
          var offset = loc.first_column + 2;

          var len = Math.max(
            2,
            ((lno === loc.last_line ? loc.last_column : line.length)) - loc.first_column + 1
          );

          var lead = new Array(offset).join('.');
          var mark = new Array(len).join('^');
          rv += '\n' + errpfx + lead + mark;

          if (line.trim().length > 0) {
            nonempty_line_indexes.push(index);
          }
        } else if (lno === loc.last_line) {
          var offset = 2 + 1;
          var len = Math.max(2, loc.last_column + 1);
          var lead = new Array(offset).join('.');
          var mark = new Array(len).join('^');
          rv += '\n' + errpfx + lead + mark;

          if (line.trim().length > 0) {
            nonempty_line_indexes.push(index);
          }
        } else if (lno > loc.first_line && lno < loc.last_line) {
          var offset = 2 + 1;
          var len = Math.max(2, line.length + 1);
          var lead = new Array(offset).join('.');
          var mark = new Array(len).join('^');
          rv += '\n' + errpfx + lead + mark;

          if (line.trim().length > 0) {
            nonempty_line_indexes.push(index);
          }
        }

        rv = rv.replace(/\t/g, ' ');
        return rv;
      });

      // now make sure we don't print an overly large amount of error area: limit it 
      // to the top and bottom line count:
      if (nonempty_line_indexes.length > 2 * MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT) {
        var clip_start = nonempty_line_indexes[MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT - 1] + 1;
        var clip_end = nonempty_line_indexes[nonempty_line_indexes.length - MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT] - 1;

        console.log('clip off: ', {
          start: clip_start,
          end: clip_end,
          len: clip_end - clip_start + 1,
          arr: nonempty_line_indexes,
          rv
        });

        var intermediate_line = new Array(lineno_display_width + 1).join(' ') + '  (...continued...)';
        intermediate_line += '\n' + new Array(lineno_display_width + 1).join('-') + '  (---------------)';
        rv.splice(clip_start, clip_end - clip_start + 1, intermediate_line);
      }

      return rv.join('\n');
    },

    /**
     * helper function, used to produce a human readable description as a string, given
     * the input `yylloc` location object.
     * 
     * Set `display_range_too` to TRUE to include the string character index position(s)
     * in the description if the `yylloc.range` is available.
     * 
     * @public
     * @this {RegExpLexer}
     */
    describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
      var l1 = yylloc.first_line;
      var l2 = yylloc.last_line;
      var c1 = yylloc.first_column;
      var c2 = yylloc.last_column;
      var dl = l2 - l1;
      var dc = c2 - c1;
      var rv;

      if (dl === 0) {
        rv = 'line ' + l1 + ', ';

        if (dc <= 1) {
          rv += 'column ' + c1;
        } else {
          rv += 'columns ' + c1 + ' .. ' + c2;
        }
      } else {
        rv = 'lines ' + l1 + '(column ' + c1 + ') .. ' + l2 + '(column ' + c2 + ')';
      }

      if (yylloc.range && display_range_too) {
        var r1 = yylloc.range[0];
        var r2 = yylloc.range[1] - 1;

        if (r2 <= r1) {
          rv += ' {String Offset: ' + r1 + '}';
        } else {
          rv += ' {String Offset range: ' + r1 + ' .. ' + r2 + '}';
        }
      }

      return rv;
    },

    /**
     * test the lexed token: return FALSE when not a match, otherwise return token.
     * 
     * `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
     * contains the actually matched text string.
     * 
     * Also move the input cursor forward and update the match collectors:
     * 
     * - `yytext`
     * - `yyleng`
     * - `match`
     * - `matches`
     * - `yylloc`
     * - `offset`
     * 
     * @public
     * @this {RegExpLexer}
     */
    test_match: function lexer_test_match(match, indexed_rule) {
      var token, lines, backup, match_str, match_str_len;

      if (this.options.backtrack_lexer) {
        // save context
        backup = {
          yylineno: this.yylineno,

          yylloc: {
            first_line: this.yylloc.first_line,
            last_line: this.yylloc.last_line,
            first_column: this.yylloc.first_column,
            last_column: this.yylloc.last_column,
            range: this.yylloc.range.slice(0)
          },

          yytext: this.yytext,
          match: this.match,
          matches: this.matches,
          matched: this.matched,
          yyleng: this.yyleng,
          offset: this.offset,
          _more: this._more,
          _input: this._input,

          //_signaled_error_token: this._signaled_error_token,
          yy: this.yy,

          conditionStack: this.conditionStack.slice(0),
          done: this.done
        };
      }

      match_str = match[0];
      match_str_len = match_str.length;

      // if (match_str.indexOf('\n') !== -1 || match_str.indexOf('\r') !== -1) {
      lines = match_str.split(/(?:\r\n?|\n)/g);

      if (lines.length > 1) {
        this.yylineno += lines.length - 1;
        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = lines[lines.length - 1].length;
      } else {
        this.yylloc.last_column += match_str_len;
      }

      // }
      this.yytext += match_str;

      this.match += match_str;
      this.matched += match_str;
      this.matches = match;
      this.yyleng = this.yytext.length;
      this.yylloc.range[1] += match_str_len;

      // previous lex rules MAY have invoked the `more()` API rather than producing a token:
      // those rules will already have moved this `offset` forward matching their match lengths,
      // hence we must only add our own match length now:
      this.offset += match_str_len;

      this._more = false;
      this._backtrack = false;
      this._input = this._input.slice(match_str_len);

      // calling this method:
      //
      //   function lexer__performAction(yy, yyrulenumber, YY_START) {...}
      token = this.performAction.call(
        this,
        this.yy,
        indexed_rule,
        this.conditionStack[this.conditionStack.length - 1] /* = YY_START */
      );

      // otherwise, when the action codes are all simple return token statements:
      //token = this.simpleCaseActionClusters[indexed_rule];

      if (this.done && this._input) {
        this.done = false;
      }

      if (token) {
        return token;
      } else if (this._backtrack) {
        // recover context
        for (var k in backup) {
          this[k] = backup[k];
        }

        this.__currentRuleSet__ = null;
        return false;  // rule action called reject() implying the next rule should be tested instead. 
      } else if (this._signaled_error_token) {
        // produce one 'error' token as `.parseError()` in `reject()`
        // did not guarantee a failure signal by throwing an exception!
        token = this._signaled_error_token;

        this._signaled_error_token = false;
        return token;
      }

      return false;
    },

    /**
     * return next match in input
     * 
     * @public
     * @this {RegExpLexer}
     */
    next: function lexer_next() {
      if (this.done) {
        this.clear();
        return this.EOF;
      }

      if (!this._input) {
        this.done = true;
      }

      var token, match, tempMatch, index;

      if (!this._more) {
        this.clear();
      }

      var spec = this.__currentRuleSet__;

      if (!spec) {
        // Update the ruleset cache as we apparently encountered a state change or just started lexing.
        // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
        // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
        // speed up those activities a tiny bit.
        spec = this.__currentRuleSet__ = this._currentRules();

        // Check whether a *sane* condition has been pushed before: this makes the lexer robust against
        // user-programmer bugs such as https://github.com/zaach/jison-lex/issues/19
        if (!spec || !spec.rules) {
          var lineno_msg = '';

          if (this.options.trackPosition) {
            lineno_msg = ' on line ' + (this.yylineno + 1);
          }

          var pos_str = '';

          if (typeof this.showPosition === 'function') {
            pos_str = this.showPosition();

            if (pos_str && pos_str[0] !== '\n') {
              pos_str = '\n' + pos_str;
            }
          }

          var p = this.constructLexErrorInfo(
            'Internal lexer engine error' + lineno_msg + ': The lex grammar programmer pushed a non-existing condition name "' + this.topState() + '"; this is a fatal error and should be reported to the application programmer team!' + pos_str,
            false
          );

          // produce one 'error' token until this situation has been resolved, most probably by parse termination!
          return this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
        }
      }

      var rule_ids = spec.rules;
      var regexes = spec.__rule_regexes;
      var len = spec.__rule_count;

      // Note: the arrays are 1-based, while `len` itself is a valid index,
      // hence the non-standard less-or-equal check in the next loop condition!
      for (var i = 1; i <= len; i++) {
        tempMatch = this._input.match(regexes[i]);

        if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
          match = tempMatch;
          index = i;

          if (this.options.backtrack_lexer) {
            token = this.test_match(tempMatch, rule_ids[i]);

            if (token !== false) {
              return token;
            } else if (this._backtrack) {
              match = undefined;
              continue;  // rule action called reject() implying a rule MISmatch. 
            } else {
              // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
              return false;
            }
          } else if (!this.options.flex) {
            break;
          }
        }
      }

      if (match) {
        token = this.test_match(match, rule_ids[index]);

        if (token !== false) {
          return token;
        }

        // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
        return false;
      }

      if (!this._input) {
        this.done = true;
        this.clear();
        return this.EOF;
      } else {
        var lineno_msg = '';

        if (this.options.trackPosition) {
          lineno_msg = ' on line ' + (this.yylineno + 1);
        }

        var pos_str = '';

        if (typeof this.showPosition === 'function') {
          pos_str = this.showPosition();

          if (pos_str && pos_str[0] !== '\n') {
            pos_str = '\n' + pos_str;
          }
        }

        var p = this.constructLexErrorInfo(
          'Lexical error' + lineno_msg + ': Unrecognized text.' + pos_str,
          this.options.lexerErrorsAreRecoverable
        );

        token = this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;

        if (token === this.ERROR) {
          // we can try to recover from a lexer error that `parseError()` did not 'recover' for us
          // by moving forward at least one character at a time:
          if (!this.match.length) {
            this.input();
          }
        }

        return token;
      }
    },

    /**
     * return next match that has a token
     * 
     * @public
     * @this {RegExpLexer}
     */
    lex: function lexer_lex() {
      var r;

      // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
      if (typeof this.options.pre_lex === 'function') {
        r = this.options.pre_lex.call(this);
      }

      while (!r) {
        r = this.next();
      }

      if (typeof this.options.post_lex === 'function') {
        // (also account for a userdef function which does not return any value: keep the token as is)
        r = this.options.post_lex.call(this, r) || r;
      }

      return r;
    },

    /**
     * backwards compatible alias for `pushState()`;
     * the latter is symmetrical with `popState()` and we advise to use
     * those APIs in any modern lexer code, rather than `begin()`.
     * 
     * @public
     * @this {RegExpLexer}
     */
    begin: function lexer_begin(condition) {
      return this.pushState(condition);
    },

    /**
     * activates a new lexer condition state (pushes the new lexer
     * condition state onto the condition stack)
     * 
     * @public
     * @this {RegExpLexer}
     */
    pushState: function lexer_pushState(condition) {
      this.conditionStack.push(condition);
      this.__currentRuleSet__ = null;
      return this;
    },

    /**
     * pop the previously active lexer condition state off the condition
     * stack
     * 
     * @public
     * @this {RegExpLexer}
     */
    popState: function lexer_popState() {
      var n = this.conditionStack.length - 1;

      if (n > 0) {
        this.__currentRuleSet__ = null;
        return this.conditionStack.pop();
      } else {
        return this.conditionStack[0];
      }
    },

    /**
     * return the currently active lexer condition state; when an index
     * argument is provided it produces the N-th previous condition state,
     * if available
     * 
     * @public
     * @this {RegExpLexer}
     */
    topState: function lexer_topState(n) {
      n = this.conditionStack.length - 1 - Math.abs(n || 0);

      if (n >= 0) {
        return this.conditionStack[n];
      } else {
        return 'INITIAL';
      }
    },

    /**
     * (internal) determine the lexer rule set which is active for the
     * currently active lexer condition state
     * 
     * @public
     * @this {RegExpLexer}
     */
    _currentRules: function lexer__currentRules() {
      if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
        return this.conditions[this.conditionStack[this.conditionStack.length - 1]];
      } else {
        return this.conditions['INITIAL'];
      }
    },

    /**
     * return the number of states currently on the stack
     * 
     * @public
     * @this {RegExpLexer}
     */
    stateStackSize: function lexer_stateStackSize() {
      return this.conditionStack.length;
    },

    options: {
      xregexp: true,
      ranges: true,
      trackPosition: true,
      parseActionsUseYYMERGELOCATIONINFO: true,
      easy_keyword_rules: true
    },

    JisonLexerError: JisonLexerError,

    performAction: function lexer__performAction(yy, yyrulenumber, YY_START) {
      var yy_ = this;
      switch (yyrulenumber) {
      case 0:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %\{ */
        yy.dept = 0;

        yy.include_command_allowed = false;
        this.pushState('action');
        this.unput(yy_.yytext);
        yy_.yytext = '';
        return 28;
        break;

      case 1:
        /*! Conditions:: action */
        /*! Rule::       %\{([^]*?)%\} */
        yy_.yytext = this.matches[1];

        yy.include_command_allowed = true;
        return 32;
        break;

      case 2:
        /*! Conditions:: action */
        /*! Rule::       %include\b */
        if (yy.include_command_allowed) {
          // This is an include instruction in place of an action:
          //
          // - one %include per action chunk
          // - one %include replaces an entire action chunk
          this.pushState('path');

          return 51;
        } else {
          // TODO
          yy_.yyerror('oops!');

          return 37;
        }

        break;

      case 3:
        /*! Conditions:: action */
        /*! Rule::       {WS}*\/\*[^]*?\*\/ */
        //yy.include_command_allowed = false; -- doesn't impact include-allowed state 
        return 34;

        break;

      case 4:
        /*! Conditions:: action */
        /*! Rule::       {WS}*\/\/.* */
        yy.include_command_allowed = false;

        return 35;
        break;

      case 6:
        /*! Conditions:: action */
        /*! Rule::       \| */
        if (yy.include_command_allowed) {
          this.popState();
          this.unput(yy_.yytext);
          yy_.yytext = '';
          return 31;
        } else {
          return 33;
        }

        break;

      case 7:
        /*! Conditions:: action */
        /*! Rule::       %% */
        if (yy.include_command_allowed) {
          this.popState();
          this.unput(yy_.yytext);
          yy_.yytext = '';
          return 31;
        } else {
          return 33;
        }

        break;

      case 9:
        /*! Conditions:: action */
        /*! Rule::       \/[^\s/]*?(?:['"`{}][^\s/]*?)*\/ */
        yy.include_command_allowed = false;

        return 33;
        break;

      case 10:
        /*! Conditions:: action */
        /*! Rule::       \/[^}{BR}]* */
        yy.include_command_allowed = false;

        return 33;
        break;

      case 11:
        /*! Conditions:: action */
        /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */
        yy.include_command_allowed = false;

        return 33;
        break;

      case 12:
        /*! Conditions:: action */
        /*! Rule::       '{QUOTED_STRING_CONTENT}' */
        yy.include_command_allowed = false;

        return 33;
        break;

      case 13:
        /*! Conditions:: action */
        /*! Rule::       `{ES2017_STRING_CONTENT}` */
        yy.include_command_allowed = false;

        return 33;
        break;

      case 14:
        /*! Conditions:: action */
        /*! Rule::       [^{}/"'`|%\{\}{BR}{WS}]+ */
        yy.include_command_allowed = false;

        return 33;
        break;

      case 15:
        /*! Conditions:: action */
        /*! Rule::       \{ */
        yy.depth++;

        yy.include_command_allowed = false;
        return 33;
        break;

      case 16:
        /*! Conditions:: action */
        /*! Rule::       \} */
        yy.include_command_allowed = false;

        if (yy.depth <= 0) {
          yy_.yyerror(rmCommonWS`
                                                    too many closing curly braces in lexer rule action block.

                                                    Note: the action code chunk may be too complex for jison to parse
                                                    easily; we suggest you wrap the action code chunk in '%{...%\}'
                                                    to help jison grok more or less complex action code chunks.

                                                      Erroneous area:
                                                    ` + this.prettyPrintRange(this, yy_.yylloc));

          return 'BRACKETS_SURPLUS';
        } else {
          yy.depth--;
        }

        return 33;
        break;

      case 17:
        /*! Conditions:: action */
        /*! Rule::       (?:{BR}{WS}+)+(?=[^{WS}{BR}|]) */
        yy.include_command_allowed = true;

        return 36;            // keep empty lines as-is inside action code blocks.  
        break;

      case 18:
        /*! Conditions:: action */
        /*! Rule::       {BR} */
        if (yy.depth > 0) {
          yy.include_command_allowed = true;
          return 36;        // keep empty lines as-is inside action code blocks. 
        } else {
          // end of action code chunk
          this.popState();

          this.unput(yy_.yytext);
          yy_.yytext = '';
          return 31;
        }

        break;

      case 19:
        /*! Conditions:: action */
        /*! Rule::       $ */
        yy.include_command_allowed = false;

        if (yy.depth !== 0) {
          yy_.yyerror(rmCommonWS`
                                                    missing ${yy.depth} closing curly braces in lexer rule action block.

                                                    Note: the action code chunk may be too complex for jison to parse
                                                    easily; we suggest you wrap the action code chunk in '%{...%\}'
                                                    to help jison grok more or less complex action code chunks.

                                                      Erroneous area:
                                                    ` + this.prettyPrintRange(this, yy_.yylloc));

          yy_.yytext = '';
          return 'BRACKETS_MISSING';
        }

        this.popState();
        yy_.yytext = '';
        return 31;
        break;

      case 21:
        /*! Conditions:: conditions */
        /*! Rule::       > */
        this.popState();

        return 6;
        break;

      case 24:
        /*! Conditions:: INITIAL start_condition macro path options */
        /*! Rule::       {WS}*\/\/[^\r\n]* */
        /* skip single-line comment */
        break;

      case 25:
        /*! Conditions:: INITIAL start_condition macro path options */
        /*! Rule::       {WS}*\/\*[^]*?\*\/ */
        /* skip multi-line comment */
        break;

      case 26:
        /*! Conditions:: rules */
        /*! Rule::       {BR}+ */
        /* empty */
        break;

      case 27:
        /*! Conditions:: rules */
        /*! Rule::       {WS}+{BR}+ */
        /* empty */
        break;

      case 28:
        /*! Conditions:: rules */
        /*! Rule::       \/\/[^\r\n]* */
        /* skip single-line comment */
        break;

      case 29:
        /*! Conditions:: rules */
        /*! Rule::       \/\*[^]*?\*\/ */
        /* skip multi-line comment */
        break;

      case 30:
        /*! Conditions:: rules */
        /*! Rule::       {WS}+(?=[^{WS}{BR}|%]) */
        yy.depth = 0;

        yy.include_command_allowed = true;
        this.pushState('action');
        return 28;
        break;

      case 31:
        /*! Conditions:: rules */
        /*! Rule::       %% */
        this.popState();

        this.pushState('code');
        return 19;
        break;

      case 32:
        /*! Conditions:: rules */
        /*! Rule::       {ANY_LITERAL_CHAR}+ */
        // accept any non-regex, non-lex, non-string-delim,
        // non-escape-starter, non-space character as-is
        return 46;

        break;

      case 35:
        /*! Conditions:: options */
        /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */
        yy_.yytext = unescQuote(this.matches[1], /\\"/g);

        return 49;    // value is always a string type  
        break;

      case 36:
        /*! Conditions:: options */
        /*! Rule::       '{QUOTED_STRING_CONTENT}' */
        yy_.yytext = unescQuote(this.matches[1], /\\'/g);

        return 49;    // value is always a string type  
        break;

      case 37:
        /*! Conditions:: options */
        /*! Rule::       `{ES2017_STRING_CONTENT}` */
        yy_.yytext = unescQuote(this.matches[1], /\\`/g);

        return 49;    // value is always a string type  
        break;

      case 39:
        /*! Conditions:: options */
        /*! Rule::       {BR}{WS}+(?=\S) */
        /* skip leading whitespace on the next line of input, when followed by more options */
        break;

      case 40:
        /*! Conditions:: options */
        /*! Rule::       {BR} */
        this.popState();

        return 48;
        break;

      case 41:
        /*! Conditions:: options */
        /*! Rule::       {WS}+ */
        /* skip whitespace */
        break;

      case 43:
        /*! Conditions:: start_condition */
        /*! Rule::       {BR}+ */
        this.popState();

        break;

      case 44:
        /*! Conditions:: start_condition */
        /*! Rule::       {WS}+ */
        /* empty */
        break;

      case 46:
        /*! Conditions:: INITIAL */
        /*! Rule::       {ID} */
        this.pushState('macro');

        return 20;
        break;

      case 47:
        /*! Conditions:: macro named_chunk */
        /*! Rule::       {BR}+ */
        this.popState();

        break;

      case 48:
        /*! Conditions:: macro */
        /*! Rule::       {ANY_LITERAL_CHAR}+ */
        // accept any non-regex, non-lex, non-string-delim,
        // non-escape-starter, non-space character as-is
        return 46;

        break;

      case 49:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       {BR}+ */
        /* empty */
        break;

      case 50:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       \s+ */
        /* empty */
        break;

      case 51:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */
        yy_.yytext = unescQuote(this.matches[1], /\\"/g);

        return 26;
        break;

      case 52:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       '{QUOTED_STRING_CONTENT}' */
        yy_.yytext = unescQuote(this.matches[1], /\\'/g);

        return 26;
        break;

      case 53:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       \[ */
        this.pushState('set');

        return 41;
        break;

      case 66:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       < */
        this.pushState('conditions');

        return 5;
        break;

      case 67:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       \/! */
        return 39;                     // treated as `(?!atom)`  

        break;

      case 68:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       \/ */
        return 14;                      // treated as `(?=atom)`  

        break;

      case 70:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       \\. */
        yy_.yytext = yy_.yytext.replace(/^\\/g, '');

        return 44;
        break;

      case 73:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %options\b */
        this.pushState('options');

        return 47;
        break;

      case 74:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %s\b */
        this.pushState('start_condition');

        return 21;
        break;

      case 75:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %x\b */
        this.pushState('start_condition');

        return 22;
        break;

      case 76:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %code\b */
        this.pushState('named_chunk');

        return 25;
        break;

      case 77:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %import\b */
        this.pushState('named_chunk');

        return 24;
        break;

      case 78:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %include\b */
        yy.depth = 0;

        yy.include_command_allowed = true;
        this.pushState('action');
        this.unput(yy_.yytext);
        yy_.yytext = '';
        return 28;
        break;

      case 79:
        /*! Conditions:: code */
        /*! Rule::       %include\b */
        this.pushState('path');

        return 51;
        break;

      case 80:
        /*! Conditions:: INITIAL rules code */
        /*! Rule::       %{NAME}([^\r\n]*) */
        /* ignore unrecognized decl */
        this.warn(rmCommonWS`
                                                LEX: ignoring unsupported lexer option ${dquote(yy_.yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(this, yy_.yylloc));

        yy_.yytext = [
          this.matches[1],            // {NAME}  
          this.matches[2].trim()       // optional value/parameters 
        ];

        return 23;
        break;

      case 81:
        /*! Conditions:: rules macro named_chunk INITIAL */
        /*! Rule::       %% */
        this.pushState('rules');

        return 19;
        break;

      case 89:
        /*! Conditions:: set */
        /*! Rule::       \] */
        this.popState();

        return 42;
        break;

      case 91:
        /*! Conditions:: code */
        /*! Rule::       [^\r\n]+ */
        return 53;       // the bit of CODE just before EOF...  

        break;

      case 92:
        /*! Conditions:: path */
        /*! Rule::       {BR} */
        this.popState();

        this.unput(yy_.yytext);
        break;

      case 93:
        /*! Conditions:: path */
        /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */
        yy_.yytext = unescQuote(this.matches[1]);

        this.popState();
        return 52;
        break;

      case 94:
        /*! Conditions:: path */
        /*! Rule::       '{QUOTED_STRING_CONTENT}' */
        yy_.yytext = unescQuote(this.matches[1]);

        this.popState();
        return 52;
        break;

      case 95:
        /*! Conditions:: path */
        /*! Rule::       {WS}+ */
        // skip whitespace in the line 
        break;

      case 96:
        /*! Conditions:: path */
        /*! Rule::       [^\s\r\n]+ */
        this.popState();

        return 52;
        break;

      case 97:
        /*! Conditions:: action */
        /*! Rule::       " */
        yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 98:
        /*! Conditions:: action */
        /*! Rule::       ' */
        yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 99:
        /*! Conditions:: action */
        /*! Rule::       ` */
        yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 100:
        /*! Conditions:: options */
        /*! Rule::       " */
        yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 101:
        /*! Conditions:: options */
        /*! Rule::       ' */
        yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 102:
        /*! Conditions:: options */
        /*! Rule::       ` */
        yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 103:
        /*! Conditions:: * */
        /*! Rule::       " */
        var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());

        yy_.yyerror(rmCommonWS`
                                            unterminated string constant  encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 104:
        /*! Conditions:: * */
        /*! Rule::       ' */
        var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());

        yy_.yyerror(rmCommonWS`
                                            unterminated string constant  encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 105:
        /*! Conditions:: * */
        /*! Rule::       ` */
        var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());

        yy_.yyerror(rmCommonWS`
                                            unterminated string constant  encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yy_.yylloc));

        return 2;
        break;

      case 106:
        /*! Conditions:: macro rules */
        /*! Rule::       . */
        /* b0rk on bad characters */
        var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());

        yy_.yyerror(rmCommonWS`
                                                unsupported lexer input encountered while lexing
                                                ${rules} (i.e. jison lex regexes).

                                                    NOTE: When you want this input to be interpreted as a LITERAL part
                                                          of a lex rule regex, you MUST enclose it in double or
                                                          single quotes.

                                                          If not, then know that this input is not accepted as a valid
                                                          regex expression here in jison-lex ${rules}.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(this, yy_.yylloc));

        break;

      case 107:
        /*! Conditions:: * */
        /*! Rule::       . */
        yy_.yyerror(rmCommonWS`
                                                unsupported lexer input: ${dquote(yy_.yytext)} 
                        while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(this, yy_.yylloc));

        break;

      default:
        return this.simpleCaseActionClusters[yyrulenumber];
      }
    },

    simpleCaseActionClusters: {
      /*! Conditions:: action */
      /*! Rule::       {WS}+ */
      5: 36,

      /*! Conditions:: action */
      /*! Rule::       % */
      8: 33,

      /*! Conditions:: conditions */
      /*! Rule::       {NAME} */
      20: 20,

      /*! Conditions:: conditions */
      /*! Rule::       , */
      22: 8,

      /*! Conditions:: conditions */
      /*! Rule::       \* */
      23: 7,

      /*! Conditions:: options */
      /*! Rule::       {NAME} */
      33: 20,

      /*! Conditions:: options */
      /*! Rule::       = */
      34: 18,

      /*! Conditions:: options */
      /*! Rule::       [^\s\r\n]+ */
      38: 50,

      /*! Conditions:: start_condition */
      /*! Rule::       {ID} */
      42: 27,

      /*! Conditions:: named_chunk */
      /*! Rule::       {ID} */
      45: 20,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \| */
      54: 9,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \(\?: */
      55: 38,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \(\?= */
      56: 38,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \(\?! */
      57: 38,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \( */
      58: 10,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \) */
      59: 11,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \+ */
      60: 12,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \* */
      61: 7,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \? */
      62: 13,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \^ */
      63: 16,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       , */
      64: 8,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       <<EOF>> */
      65: 17,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \\([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}) */
      69: 44,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \$ */
      71: 17,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \. */
      72: 15,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \{\d+(,\s*\d+|,)?\} */
      82: 45,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \{{ID}\} */
      83: 40,

      /*! Conditions:: set options */
      /*! Rule::       \{{ID}\} */
      84: 40,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \{ */
      85: 3,

      /*! Conditions:: rules macro named_chunk INITIAL */
      /*! Rule::       \} */
      86: 4,

      /*! Conditions:: set */
      /*! Rule::       (?:\\\\|\\\]|[^\]{])+ */
      87: 43,

      /*! Conditions:: set */
      /*! Rule::       \{ */
      88: 43,

      /*! Conditions:: code */
      /*! Rule::       [^\r\n]*(\r|\n)+ */
      90: 53,

      /*! Conditions:: * */
      /*! Rule::       $ */
      108: 1
    },

    rules: [
      /*   0: */  /^(?:%\{)/,
      /*   1: */  new XRegExp('^(?:%\\{([^]*?)%\\})', ''),
      /*   2: */  /^(?:%include\b)/,
      /*   3: */  new XRegExp('^(?:([^\\S\\n\\r])*\\/\\*[^]*?\\*\\/)', ''),
      /*   4: */  /^(?:([^\S\n\r])*\/\/.*)/,
      /*   5: */  /^(?:([^\S\n\r])+)/,
      /*   6: */  /^(?:\|)/,
      /*   7: */  /^(?:%%)/,
      /*   8: */  /^(?:%)/,
      /*   9: */  /^(?:\/[^\s\/]*?(?:['"`{}][^\s\/]*?)*\/)/,
      /*  10: */  /^(?:\/[^\n\r}]*)/,
      /*  11: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
      /*  12: */  /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
      /*  13: */  /^(?:`((?:\\`|\\[^`]|[^\\`])*)`)/,
      /*  14: */  /^(?:[^\s"%'\/`{-}]+)/,
      /*  15: */  /^(?:\{)/,
      /*  16: */  /^(?:\})/,
      /*  17: */  /^(?:(?:(\r\n|\n|\r)([^\S\n\r])+)+(?=[^\s|]))/,
      /*  18: */  /^(?:(\r\n|\n|\r))/,
      /*  19: */  /^(?:$)/,
      /*  20: */  new XRegExp(
        '^(?:([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}\\-_]*(?:[\\p{Alphabetic}\\p{Number}_]))?))',
        ''
      ),
      /*  21: */  /^(?:>)/,
      /*  22: */  /^(?:,)/,
      /*  23: */  /^(?:\*)/,
      /*  24: */  /^(?:([^\S\n\r])*\/\/[^\n\r]*)/,
      /*  25: */  new XRegExp('^(?:([^\\S\\n\\r])*\\/\\*[^]*?\\*\\/)', ''),
      /*  26: */  /^(?:(\r\n|\n|\r)+)/,
      /*  27: */  /^(?:([^\S\n\r])+(\r\n|\n|\r)+)/,
      /*  28: */  /^(?:\/\/[^\r\n]*)/,
      /*  29: */  new XRegExp('^(?:\\/\\*[^]*?\\*\\/)', ''),
      /*  30: */  /^(?:([^\S\n\r])+(?=[^\s%|]))/,
      /*  31: */  /^(?:%%)/,
      /*  32: */  /^(?:([^\s!"$%'-,.\/:-?\[-\^{-}])+)/,
      /*  33: */  new XRegExp(
        '^(?:([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}\\-_]*(?:[\\p{Alphabetic}\\p{Number}_]))?))',
        ''
      ),
      /*  34: */  /^(?:=)/,
      /*  35: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
      /*  36: */  /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
      /*  37: */  /^(?:`((?:\\`|\\[^`]|[^\\`])*)`)/,
      /*  38: */  /^(?:\S+)/,
      /*  39: */  /^(?:(\r\n|\n|\r)([^\S\n\r])+(?=\S))/,
      /*  40: */  /^(?:(\r\n|\n|\r))/,
      /*  41: */  /^(?:([^\S\n\r])+)/,
      /*  42: */  new XRegExp('^(?:([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*))', ''),
      /*  43: */  /^(?:(\r\n|\n|\r)+)/,
      /*  44: */  /^(?:([^\S\n\r])+)/,
      /*  45: */  new XRegExp('^(?:([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*))', ''),
      /*  46: */  new XRegExp('^(?:([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*))', ''),
      /*  47: */  /^(?:(\r\n|\n|\r)+)/,
      /*  48: */  /^(?:([^\s!"$%'-,.\/:-?\[-\^{-}])+)/,
      /*  49: */  /^(?:(\r\n|\n|\r)+)/,
      /*  50: */  /^(?:\s+)/,
      /*  51: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
      /*  52: */  /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
      /*  53: */  /^(?:\[)/,
      /*  54: */  /^(?:\|)/,
      /*  55: */  /^(?:\(\?:)/,
      /*  56: */  /^(?:\(\?=)/,
      /*  57: */  /^(?:\(\?!)/,
      /*  58: */  /^(?:\()/,
      /*  59: */  /^(?:\))/,
      /*  60: */  /^(?:\+)/,
      /*  61: */  /^(?:\*)/,
      /*  62: */  /^(?:\?)/,
      /*  63: */  /^(?:\^)/,
      /*  64: */  /^(?:,)/,
      /*  65: */  /^(?:<<EOF>>)/,
      /*  66: */  /^(?:<)/,
      /*  67: */  /^(?:\/!)/,
      /*  68: */  /^(?:\/)/,
      /*  69: */  /^(?:\\([0-7]{1,3}|[$(-+.\/?BDSW\[-\^bdfnr-tvw{-}]|c[A-Z]|x[\dA-F]{2}|u[\dA-Fa-f]{4}))/,
      /*  70: */  /^(?:\\.)/,
      /*  71: */  /^(?:\$)/,
      /*  72: */  /^(?:\.)/,
      /*  73: */  /^(?:%options\b)/,
      /*  74: */  /^(?:%s\b)/,
      /*  75: */  /^(?:%x\b)/,
      /*  76: */  /^(?:%code\b)/,
      /*  77: */  /^(?:%import\b)/,
      /*  78: */  /^(?:%include\b)/,
      /*  79: */  /^(?:%include\b)/,
      /*  80: */  new XRegExp(
        '^(?:%([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}\\-_]*(?:[\\p{Alphabetic}\\p{Number}_]))?)([^\\n\\r]*))',
        ''
      ),
      /*  81: */  /^(?:%%)/,
      /*  82: */  /^(?:\{\d+(,\s*\d+|,)?\})/,
      /*  83: */  new XRegExp('^(?:\\{([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*)\\})', ''),
      /*  84: */  new XRegExp('^(?:\\{([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*)\\})', ''),
      /*  85: */  /^(?:\{)/,
      /*  86: */  /^(?:\})/,
      /*  87: */  /^(?:(?:\\\\|\\\]|[^\]{])+)/,
      /*  88: */  /^(?:\{)/,
      /*  89: */  /^(?:\])/,
      /*  90: */  /^(?:[^\r\n]*(\r|\n)+)/,
      /*  91: */  /^(?:[^\r\n]+)/,
      /*  92: */  /^(?:(\r\n|\n|\r))/,
      /*  93: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
      /*  94: */  /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
      /*  95: */  /^(?:([^\S\n\r])+)/,
      /*  96: */  /^(?:\S+)/,
      /*  97: */  /^(?:")/,
      /*  98: */  /^(?:')/,
      /*  99: */  /^(?:`)/,
      /* 100: */  /^(?:")/,
      /* 101: */  /^(?:')/,
      /* 102: */  /^(?:`)/,
      /* 103: */  /^(?:")/,
      /* 104: */  /^(?:')/,
      /* 105: */  /^(?:`)/,
      /* 106: */  /^(?:.)/,
      /* 107: */  /^(?:.)/,
      /* 108: */  /^(?:$)/
    ],

    conditions: {
      'rules': {
        rules: [
          0,
          26,
          27,
          28,
          29,
          30,
          31,
          32,
          49,
          50,
          51,
          52,
          53,
          54,
          55,
          56,
          57,
          58,
          59,
          60,
          61,
          62,
          63,
          64,
          65,
          66,
          67,
          68,
          69,
          70,
          71,
          72,
          73,
          74,
          75,
          76,
          77,
          78,
          80,
          81,
          82,
          83,
          85,
          86,
          103,
          104,
          105,
          106,
          107,
          108
        ],

        inclusive: true
      },

      'macro': {
        rules: [
          0,
          24,
          25,
          47,
          48,
          49,
          50,
          51,
          52,
          53,
          54,
          55,
          56,
          57,
          58,
          59,
          60,
          61,
          62,
          63,
          64,
          65,
          66,
          67,
          68,
          69,
          70,
          71,
          72,
          73,
          74,
          75,
          76,
          77,
          78,
          81,
          82,
          83,
          85,
          86,
          103,
          104,
          105,
          106,
          107,
          108
        ],

        inclusive: true
      },

      'named_chunk': {
        rules: [
          0,
          45,
          47,
          49,
          50,
          51,
          52,
          53,
          54,
          55,
          56,
          57,
          58,
          59,
          60,
          61,
          62,
          63,
          64,
          65,
          66,
          67,
          68,
          69,
          70,
          71,
          72,
          73,
          74,
          75,
          76,
          77,
          78,
          81,
          82,
          83,
          85,
          86,
          103,
          104,
          105,
          107,
          108
        ],

        inclusive: true
      },

      'code': {
        rules: [79, 80, 90, 91, 103, 104, 105, 107, 108],
        inclusive: false
      },

      'start_condition': {
        rules: [24, 25, 42, 43, 44, 103, 104, 105, 107, 108],
        inclusive: false
      },

      'options': {
        rules: [
          24,
          25,
          33,
          34,
          35,
          36,
          37,
          38,
          39,
          40,
          41,
          84,
          100,
          101,
          102,
          103,
          104,
          105,
          107,
          108
        ],

        inclusive: false
      },

      'conditions': {
        rules: [20, 21, 22, 23, 103, 104, 105, 107, 108],
        inclusive: false
      },

      'action': {
        rules: [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          16,
          17,
          18,
          19,
          97,
          98,
          99,
          103,
          104,
          105,
          107,
          108
        ],

        inclusive: false
      },

      'path': {
        rules: [24, 25, 92, 93, 94, 95, 96, 103, 104, 105, 107, 108],
        inclusive: false
      },

      'set': {
        rules: [84, 87, 88, 89, 103, 104, 105, 107, 108],
        inclusive: false
      },

      'INITIAL': {
        rules: [
          0,
          24,
          25,
          46,
          49,
          50,
          51,
          52,
          53,
          54,
          55,
          56,
          57,
          58,
          59,
          60,
          61,
          62,
          63,
          64,
          65,
          66,
          67,
          68,
          69,
          70,
          71,
          72,
          73,
          74,
          75,
          76,
          77,
          78,
          80,
          81,
          82,
          83,
          85,
          86,
          103,
          104,
          105,
          107,
          108
        ],

        inclusive: true
      }
    }
  };

  var rmCommonWS = helpers.rmCommonWS;
  var dquote = helpers.dquote;

  function unescQuote(str) {
    str = '' + str;
    var a = str.split('\\\\');

    a = a.map(function(s) {
      return s.replace(/\\'/g, '\'').replace(/\\"/g, '"');
    });

    str = a.join('\\\\');
    return str;
  }

  lexer.warn = function l_warn() {
    if (this.yy && this.yy.parser && typeof this.yy.parser.warn === 'function') {
      return this.yy.parser.warn.apply(this, arguments);
    } else {
      console.warn.apply(console, arguments);
    }
  };

  lexer.log = function l_log() {
    if (this.yy && this.yy.parser && typeof this.yy.parser.log === 'function') {
      return this.yy.parser.log.apply(this, arguments);
    } else {
      console.log.apply(console, arguments);
    }
  };

  return lexer;
}();
parser.lexer = lexer;

function Parser() {
    this.yy = {};
}
Parser.prototype = parser;
parser.Parser = Parser;

function yyparse() {
    return parser.parse.apply(parser, arguments);
}



var lexParser = {
    parser,
    Parser,
    parse: yyparse,
    
};

export default lexParser;
