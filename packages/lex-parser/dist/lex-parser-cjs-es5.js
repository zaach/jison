'use strict';

function _interopDefault(ex) {
  return ex && typeof ex === 'object' && 'default' in ex ? ex['default'] : ex;
}

var fs = _interopDefault(require('fs'));

var path = _interopDefault(require('path'));

var recast = _interopDefault(require('@gerhobbelt/recast'));

var babel = require('@babel/core');

require('@babel/parser');

var assert$1 = _interopDefault(require('assert'));

var XRegExp = _interopDefault(require('@gerhobbelt/xregexp'));

var JSON5 = _interopDefault(require('@gerhobbelt/json5')); // Return TRUE if `src` starts with `searchString`. 


function startsWith(src, searchString) {
  return src.substr(0, searchString.length) === searchString;
} // tagged template string helper which removes the indentation common to all
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


function rmCommonWS(strings, ...values) {
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
        var m = /^(\s*)\S/.exec(line); // only non-empty ~ content-carrying lines matter re common indent calculus:

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
  }); // Also note: due to the way we format the template strings in our sourcecode,
  // the last line in the entire template must be empty when it has ANY trailing
  // whitespace:

  var a = src[src.length - 1];
  a[a.length - 1] = a[a.length - 1].replace(/\s+$/, ''); // Done removing common indentation.
  // 
  // Process template string partials now, but only when there's
  // some actual UNindenting to do:

  if (indent_str) {
    for (var i = 0, len = src.length; i < len; i++) {
      var a = src[i]; // only correct indentation at start of line, i.e. only check for
      // the indent after every NEWLINE ==> start at j=1 rather than j=0

      for (var j = 1, linecnt = a.length; j < linecnt; j++) {
        if (startsWith(a[j], indent_str)) {
          a[j] = a[j].substr(indent_str.length);
        }
      }
    }
  } // now merge everything to construct the template result:


  var rv = [];

  for (var i = 0, len = values.length; i < len; i++) {
    rv.push(src[i].join('\n'));
    rv.push(values[i]);
  } // the last value is always followed by a last template string partial:


  rv.push(src[i].join('\n'));
  var sv = rv.join('');
  return sv;
} // Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`

/** @public */


function camelCase(s) {
  // Convert first character to lowercase
  return s.replace(/^\w/, function (match) {
    return match.toLowerCase();
  }).replace(/-\w/g, function (match) {
    var c = match.charAt(1);
    var rv = c.toUpperCase(); // do not mutate 'a-2' to 'a2':

    if (c === rv && c.match(/\d/)) {
      return match;
    }

    return rv;
  });
} // Convert dashed option keys and other inputs to Camel Cased legal JavaScript identifiers

/** @public */


function mkIdentifier(s) {
  s = '' + s;
  return s // Convert dashed ids to Camel Case (though NOT lowercasing the initial letter though!), 
  // e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
  .replace(/-\w/g, function (match) {
    var c = match.charAt(1);
    var rv = c.toUpperCase(); // do not mutate 'a-2' to 'a2':

    if (c === rv && c.match(/\d/)) {
      return match;
    }

    return rv;
  }) // cleanup: replace any non-suitable character series to a single underscore:
  .replace(/^[^\w_]/, '_') // do not accept numerics at the leading position, despite those matching regex `\w`:
  .replace(/^\d/, '_').replace(/[^\w\d_]/g, '_') // and only accept multiple (double, not triple) underscores at start or end of identifier name:
  .replace(/^__+/, '#').replace(/__+$/, '#').replace(/_+/g, '_').replace(/#/g, '__');
} // Check if the start of the given input matches a regex expression.
// Return the length of the regex expression or -1 if none was found.

/** @public */


function scanRegExp(s) {
  s = '' + s; // code based on Esprima scanner: `Scanner.prototype.scanRegExpBody()`

  var index = 0;
  var length = s.length;
  var ch = s[index]; //assert.assert(ch === '/', 'Regular expression literal must start with a slash');

  var str = s[index++];
  var classMarker = false;
  var terminated = false;

  while (index < length) {
    ch = s[index++];
    str += ch;

    if (ch === '\\') {
      ch = s[index++]; // https://tc39.github.io/ecma262/#sec-literals-regular-expression-literals

      if (isLineTerminator(ch.charCodeAt(0))) {
        break; // UnterminatedRegExp
      }

      str += ch;
    } else if (isLineTerminator(ch.charCodeAt(0))) {
      break; // UnterminatedRegExp
    } else if (classMarker) {
      if (ch === ']') {
        classMarker = false;
      }
    } else {
      if (ch === '/') {
        terminated = true;
        break;
      } else if (ch === '[') {
        classMarker = true;
      }
    }
  }

  if (!terminated) {
    return -1; // UnterminatedRegExp
  }

  return index;
} // https://tc39.github.io/ecma262/#sec-line-terminators


function isLineTerminator(cp) {
  return cp === 0x0A || cp === 0x0D || cp === 0x2028 || cp === 0x2029;
} // Check if the given input can be a legal identifier-to-be-camelcased:
// use this function to check if the way the identifier is written will
// produce a sensible & comparable identifier name using the `mkIdentifier'
// API - for humans that transformation should be obvious/trivial in
// order to prevent confusion.

/** @public */


function isLegalIdentifierInput(s) {
  s = '' + s; // Convert dashed ids to Camel Case (though NOT lowercasing the initial letter though!), 
  // e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`

  s = s.replace(/-\w/g, function (match) {
    var c = match.charAt(1);
    var rv = c.toUpperCase(); // do not mutate 'a-2' to 'a2':

    if (c === rv && c.match(/\d/)) {
      return match;
    }

    return rv;
  });
  var alt = mkIdentifier(s);
  return alt === s;
} // properly quote and escape the given input string


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
} //


function chkBugger(src) {
  src = String(src);

  if (src.match(/\bcov_\w+/)) {
    console.error('### ISTANBUL COVERAGE CODE DETECTED ###\n', src);
  }
} // Helper function: pad number with leading zeroes


function pad(n, p) {
  p = p || 2;
  var rv = '0000' + n;
  return rv.slice(-p);
} // attempt to dump in one of several locations: first winner is *it*!


function dumpSourceToFile(sourcecode, errname, err_id, options, ex) {
  var dumpfile;
  options = options || {};

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
  } // augment the exception info, when available:


  if (ex) {
    ex.offending_source_code = sourcecode;
    ex.offending_source_title = errname;
    ex.offending_source_dumpfile = dumpfile;
  }
} //
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
  var p;

  try {
    // p = eval(sourcecode);
    if (typeof code_execution_rig !== 'function') {
      throw new Error("safe-code-exec-and-diag: code_execution_rig MUST be a JavaScript function");
    }

    chkBugger(sourcecode);
    p = code_execution_rig.call(this, sourcecode, options, errname, debug);
  } catch (ex) {
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
}; //

assert$1(recast);
var types = recast.types;
assert$1(types);
var namedTypes = types.namedTypes;
assert$1(namedTypes);
var b = types.builders;
assert$1(b); // //assert(astUtils);

function parseCodeChunkToAST(src, options) {
  // src = src
  // .replace(/@/g, '\uFFDA')
  // .replace(/#/g, '\uFFDB')
  // ;
  var ast = recast.parse(src);
  return ast;
}

function compileCodeToES5(src, options) {
  options = Object.assign({}, {
    ast: true,
    code: true,
    sourceMaps: true,
    comments: true,
    filename: 'compileCodeToES5.js',
    sourceFileName: 'compileCodeToES5.js',
    sourceRoot: '.',
    sourceType: 'module',
    babelrc: false,
    ignore: ["node_modules/**/*.js"],
    compact: false,
    retainLines: false,
    presets: [["@babel/preset-env", {
      targets: {
        browsers: ["last 2 versions", "safari >= 7"],
        node: "4.0"
      }
    }]]
  }, options);
  return babel.transformSync(src, options); // => { code, map, ast }
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
  new_src = new_src.replace(/\r\n|\n|\r/g, '\n') // platform dependent EOL fixup
  // // backpatch possible jison variables extant in the prettified code:
  // .replace(/\uFFDA/g, '@')
  // .replace(/\uFFDB/g, '#')
  ;
  return new_src;
} // validate the given JavaScript snippet: does it compile?
// 
// Return either the parsed AST (object) or an error message (string). 


function checkActionBlock(src, yylloc) {
  // make sure reasonable line numbers, etc. are reported in any
  // potential parse errors by pushing the source code down:
  if (yylloc && yylloc.first_line > 0) {
    var cnt = yylloc.first_line;
    var lines = new Array(cnt);
    src = lines.join('\n') + src;
  }

  if (!src.trim()) {
    return false;
  }

  try {
    var rv = parseCodeChunkToAST(src);
    return false;
  } catch (ex) {
    return ex.message || "code snippet cannot be parsed";
  }
} // The rough-and-ready preprocessor for any action code block:
// this one trims off any surplus whitespace and removes any
// trailing semicolons and/or wrapping `{...}` braces,
// when such is easily possible *without having to actually
// **parse** the `src` code block in order to do this safely*.
// 
// Returns the trimmed sourcecode which was provided via `src`.
// 
// Note: the `startMarker` argument is special in that a lexer/parser
// can feed us the delimiter which started the code block here:
// when the starting delimiter actually is `{` we can safely
// remove the outer `{...}` wrapper (which then *will* be present!),
// while otherwise we may *not* do so as complex/specially-crafted
// code will fail when it was wrapped in other delimiters, e.g.
// action code specs like this one:
// 
//              %{
//                  {  // trimActionCode sees this one as outer-starting: WRONG
//                      a: 1
//                  };
//                  {
//                      b: 2
//                  }  // trimActionCode sees this one as outer-ending: WRONG
//              %}
//              
// Of course the example would be 'ludicrous' action code but the
// key point here is that users will certainly be able to come up with 
// convoluted code that is smarter than our simple regex-based
// `{...}` trimmer in here!
// 


function trimActionCode(src, startMarker) {
  var s = src.trim(); // remove outermost set of braces UNLESS there's
  // a curly brace in there anywhere: in that case
  // we should leave it up to the sophisticated
  // code analyzer to simplify the code!
  //
  // This is a very rough check as it will also look
  // inside code comments, which should not have
  // any influence.
  //
  // Nevertheless: this is a *safe* transform as
  // long as the code doesn't end with a C++-style
  // comment which happens to contain that closing
  // curly brace at the end!
  //
  // Also DO strip off any trailing optional semicolon,
  // which might have ended up here due to lexer rules
  // like this one:
  //
  //     [a-z]+              -> 'TOKEN';
  //
  // We can safely ditch any trailing semicolon(s) as
  // our code generator reckons with JavaScript's
  // ASI rules (Automatic Semicolon Insertion).
  //
  //
  // TODO: make this is real code edit without that
  // last edge case as a fault condition.

  if (startMarker === '{') {
    // code is wrapped in `{...}` for sure: remove the wrapping braces.
    s = s.replace(/^\{([^]*?)\}$/, '$1').trim();
  } else {
    // code may not be wrapped or otherwise non-simple: only remove
    // wrapping braces when we can guarantee they're the only ones there,
    // i.e. only exist as outer wrapping.
    s = s.replace(/^\{([^}]*)\}$/, '$1').trim();
  }

  s = s.replace(/;+$/, '').trim();
  return s;
}

var parse2AST = {
  parseCodeChunkToAST,
  compileCodeToES5,
  prettyPrintAST,
  checkActionBlock,
  trimActionCode
};

function chkBugger$1(src) {
  src = String(src);

  if (src.match(/\bcov_\w+/)) {
    console.error('### ISTANBUL COVERAGE CODE DETECTED ###\n', src);
  }
} /// HELPER FUNCTION: print the function in source code form, properly indented.

/** @public */


function printFunctionSourceCode(f) {
  var src = String(f);
  chkBugger$1(src);
  return src;
}

const funcRe = /^function[\s\r\n]*[^\(]*\(([^\)]*)\)[\s\r\n]*\{([^]*?)\}$/;
const arrowFuncRe = /^(?:(?:\(([^\)]*)\))|(?:([^\(\)]+)))[\s\r\n]*=>[\s\r\n]*(?:(?:\{([^]*?)\})|(?:(([^\s\r\n\{)])[^]*?)))$/; /// HELPER FUNCTION: print the function **content** in source code form, properly indented,
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
  var args; // Also cope with Arrow Functions (and inline those as well?).
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
    code: action
  };
}

var stringifier = {
  printFunctionSourceCode,
  printFunctionSourceCodeContainer
}; // 
// 
// 

function detectIstanbulGlobal() {
  const gcv = "__coverage__";
  const globalvar = new Function('return this')();
  var coverage = globalvar[gcv];
  return coverage || false;
} //
// Helper library for safe code execution/compilation
//
// MIT Licensed
//
//
// This code is intended to help test and diagnose arbitrary regexes, answering questions like this:
//
// - is this a valid regex, i.e. does it compile?
// - does it have captures, and if yes, how many?
//
//import XRegExp from '@gerhobbelt/xregexp';
// validate the given regex.
//
// You can specify an (advanced or regular) regex class as a third parameter.
// The default assumed is the standard JavaScript `RegExp` class.
//
// Return FALSE when there's no failure, otherwise return an `Error` info object.


function checkRegExp(re_src, re_flags, XRegExp$$1) {
  var re; // were we fed a RegExp object or a string?

  if (re_src && typeof re_src.source === 'string' && typeof re_src.flags === 'string' && typeof re_src.toString === 'function' && typeof re_src.test === 'function' && typeof re_src.exec === 'function') {
    // we're looking at a RegExp (or XRegExp) object, so we can trust the `.source` member
    // and the `.toString()` method to produce something that's compileable by XRegExp
    // at least...
    if (!re_flags || re_flags === re_src.flags) {
      // no change of flags: we assume it's okay as it's already contained
      // in an RegExp or XRegExp object
      return false;
    }
  } // we DO accept empty regexes: `''` but we DO NOT accept null/undefined


  if (re_src == null) {
    return new Error('invalid regular expression source: ' + re_src);
  }

  re_src = '' + re_src;

  if (re_flags == null) {
    re_flags = undefined; // `new RegExp(..., flags)` will barf a hairball when `flags===null`
  } else {
    re_flags = '' + re_flags;
  }

  XRegExp$$1 = XRegExp$$1 || RegExp;

  try {
    re = new XRegExp$$1(re_src, re_flags);
  } catch (ex) {
    return ex;
  }

  return false;
} // provide some info about the given regex.
//
// You can specify an (advanced or regular) regex class as a third parameter.
// The default assumed is the standard JavaScript `RegExp` class.
//
// Return FALSE when the input is not a legal regex.


function getRegExpInfo(re_src, re_flags, XRegExp$$1) {
  var re1, re2, m1, m2; // were we fed a RegExp object or a string?

  if (re_src && typeof re_src.source === 'string' && typeof re_src.flags === 'string' && typeof re_src.toString === 'function' && typeof re_src.test === 'function' && typeof re_src.exec === 'function') {
    // we're looking at a RegExp (or XRegExp) object, so we can trust the `.source` member
    // and the `.toString()` method to produce something that's compileable by XRegExp
    // at least...
    if (!re_flags || re_flags === re_src.flags) {
      // no change of flags: we assume it's okay as it's already contained
      // in an RegExp or XRegExp object
      re_flags = undefined;
    }
  } else if (re_src == null) {
    // we DO NOT accept null/undefined
    return false;
  } else {
    re_src = '' + re_src;

    if (re_flags == null) {
      re_flags = undefined; // `new RegExp(..., flags)` will barf a hairball when `flags===null`
    } else {
      re_flags = '' + re_flags;
    }
  }

  XRegExp$$1 = XRegExp$$1 || RegExp;

  try {
    // A little trick to obtain the captures from a regex:
    // wrap it and append `(?:)` to ensure it matches
    // the empty string, then match it against it to
    // obtain the `match` array.
    re1 = new XRegExp$$1(re_src, re_flags);
    re2 = new XRegExp$$1('(?:' + re_src + ')|(?:)', re_flags);
    m1 = re1.exec('');
    m2 = re2.exec('');
    return {
      acceptsEmptyString: !!m1,
      captureCount: m2.length - 1
    };
  } catch (ex) {
    return false;
  }
}

var reHelpers = {
  checkRegExp: checkRegExp,
  getRegExpInfo: getRegExpInfo
};
var cycleref = [];
var cyclerefpath = [];
var linkref = [];
var linkrefpath = [];
var path$1 = [];

function shallow_copy(src) {
  if (typeof src === 'object') {
    if (src instanceof Array) {
      return src.slice();
    }

    var dst = {};

    if (src instanceof Error) {
      dst.name = src.name;
      dst.message = src.message;
      dst.stack = src.stack;
    }

    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) {
        dst[k] = src[k];
      }
    }

    return dst;
  }

  return src;
}

function shallow_copy_and_strip_depth(src, parentKey) {
  if (typeof src === 'object') {
    var dst;

    if (src instanceof Array) {
      dst = src.slice();

      for (var i = 0, len = dst.length; i < len; i++) {
        path$1.push('[' + i + ']');
        dst[i] = shallow_copy_and_strip_depth(dst[i], parentKey + '[' + i + ']');
        path$1.pop();
      }
    } else {
      dst = {};

      if (src instanceof Error) {
        dst.name = src.name;
        dst.message = src.message;
        dst.stack = src.stack;
      }

      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
          var el = src[k];

          if (el && typeof el === 'object') {
            dst[k] = '[cyclic reference::attribute --> ' + parentKey + '.' + k + ']';
          } else {
            dst[k] = src[k];
          }
        }
      }
    }

    return dst;
  }

  return src;
}

function trim_array_tail(arr) {
  if (arr instanceof Array) {
    for (var len = arr.length; len > 0; len--) {
      if (arr[len - 1] != null) {
        break;
      }
    }

    arr.length = len;
  }
}

function treat_value_stack(v) {
  if (v instanceof Array) {
    var idx = cycleref.indexOf(v);

    if (idx >= 0) {
      v = '[cyclic reference to parent array --> ' + cyclerefpath[idx] + ']';
    } else {
      idx = linkref.indexOf(v);

      if (idx >= 0) {
        v = '[reference to sibling array --> ' + linkrefpath[idx] + ', length = ' + v.length + ']';
      } else {
        cycleref.push(v);
        cyclerefpath.push(path$1.join('.'));
        linkref.push(v);
        linkrefpath.push(path$1.join('.'));
        v = treat_error_infos_array(v);
        cycleref.pop();
        cyclerefpath.pop();
      }
    }
  } else if (v) {
    v = treat_object(v);
  }

  return v;
}

function treat_error_infos_array(arr) {
  var inf = arr.slice();
  trim_array_tail(inf);

  for (var key = 0, len = inf.length; key < len; key++) {
    var err = inf[key];

    if (err) {
      path$1.push('[' + key + ']');
      err = treat_object(err);

      if (typeof err === 'object') {
        if (err.lexer) {
          err.lexer = '[lexer]';
        }

        if (err.parser) {
          err.parser = '[parser]';
        }

        trim_array_tail(err.symbol_stack);
        trim_array_tail(err.state_stack);
        trim_array_tail(err.location_stack);

        if (err.value_stack) {
          path$1.push('value_stack');
          err.value_stack = treat_value_stack(err.value_stack);
          path$1.pop();
        }
      }

      inf[key] = err;
      path$1.pop();
    }
  }

  return inf;
}

function treat_lexer(l) {
  // shallow copy object:
  l = shallow_copy(l);
  delete l.simpleCaseActionClusters;
  delete l.rules;
  delete l.conditions;
  delete l.__currentRuleSet__;

  if (l.__error_infos) {
    path$1.push('__error_infos');
    l.__error_infos = treat_value_stack(l.__error_infos);
    path$1.pop();
  }

  return l;
}

function treat_parser(p) {
  // shallow copy object:
  p = shallow_copy(p);
  delete p.productions_;
  delete p.table;
  delete p.defaultActions;

  if (p.__error_infos) {
    path$1.push('__error_infos');
    p.__error_infos = treat_value_stack(p.__error_infos);
    path$1.pop();
  }

  if (p.__error_recovery_infos) {
    path$1.push('__error_recovery_infos');
    p.__error_recovery_infos = treat_value_stack(p.__error_recovery_infos);
    path$1.pop();
  }

  if (p.lexer) {
    path$1.push('lexer');
    p.lexer = treat_lexer(p.lexer);
    path$1.pop();
  }

  return p;
}

function treat_hash(h) {
  // shallow copy object:
  h = shallow_copy(h);

  if (h.parser) {
    path$1.push('parser');
    h.parser = treat_parser(h.parser);
    path$1.pop();
  }

  if (h.lexer) {
    path$1.push('lexer');
    h.lexer = treat_lexer(h.lexer);
    path$1.push();
  }

  return h;
}

function treat_error_report_info(e) {
  // shallow copy object:
  e = shallow_copy(e);

  if (e && e.hash) {
    path$1.push('hash');
    e.hash = treat_hash(e.hash);
    path$1.pop();
  }

  if (e.parser) {
    path$1.push('parser');
    e.parser = treat_parser(e.parser);
    path$1.pop();
  }

  if (e.lexer) {
    path$1.push('lexer');
    e.lexer = treat_lexer(e.lexer);
    path$1.pop();
  }

  if (e.__error_infos) {
    path$1.push('__error_infos');
    e.__error_infos = treat_value_stack(e.__error_infos);
    path$1.pop();
  }

  if (e.__error_recovery_infos) {
    path$1.push('__error_recovery_infos');
    e.__error_recovery_infos = treat_value_stack(e.__error_recovery_infos);
    path$1.pop();
  }

  trim_array_tail(e.symbol_stack);
  trim_array_tail(e.state_stack);
  trim_array_tail(e.location_stack);

  if (e.value_stack) {
    path$1.push('value_stack');
    e.value_stack = treat_value_stack(e.value_stack);
    path$1.pop();
  }

  return e;
}

function treat_object(e) {
  if (e && typeof e === 'object') {
    var idx = cycleref.indexOf(e);

    if (idx >= 0) {
      // cyclic reference, most probably an error instance.
      // we still want it to be READABLE in a way, though:
      e = shallow_copy_and_strip_depth(e, cyclerefpath[idx]);
    } else {
      idx = linkref.indexOf(e);

      if (idx >= 0) {
        e = '[reference to sibling --> ' + linkrefpath[idx] + ']';
      } else {
        cycleref.push(e);
        cyclerefpath.push(path$1.join('.'));
        linkref.push(e);
        linkrefpath.push(path$1.join('.'));
        e = treat_error_report_info(e);
        cycleref.pop();
        cyclerefpath.pop();
      }
    }
  }

  return e;
} // strip off large chunks from the Error exception object before
// it will be fed to a test log or other output.
// 
// Internal use in the unit test rigs.


function trimErrorForTestReporting(e) {
  cycleref.length = 0;
  cyclerefpath.length = 0;
  linkref.length = 0;
  linkrefpath.length = 0;
  path$1 = ['*'];

  if (e) {
    e = treat_object(e);
  }

  cycleref.length = 0;
  cyclerefpath.length = 0;
  linkref.length = 0;
  linkrefpath.length = 0;
  path$1 = ['*'];
  return e;
}

var helpers = {
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
  detectIstanbulGlobal
}; // See also:
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
    if (Error.hasOwnProperty('captureStackTrace')) {
      // V8/Chrome engine
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
  Object.setPrototypeOf(JisonParserError.prototype, Error.prototype);
} else {
  JisonParserError.prototype = Object.create(Error.prototype);
}

JisonParserError.prototype.constructor = JisonParserError;
JisonParserError.prototype.name = 'JisonParserError'; // helper: reconstruct the productions[] table

function bp(s) {
  var rv = [];
  var p = s.pop;
  var r = s.rule;

  for (var i = 0, l = p.length; i < l; i++) {
    rv.push([p[i], r[i]]);
  }

  return rv;
} // helper: reconstruct the defaultActions[] table


function bda(s) {
  var rv = {};
  var d = s.idx;
  var g = s.goto;

  for (var i = 0, l = d.length; i < l; i++) {
    var j = d[i];
    rv[j] = g[i];
  }

  return rv;
} // helper: reconstruct the 'goto' table


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
          q[z] = [m.shift(), g.shift()];
          break;

        case 0:
          q[z] = a.shift();
          break;

        default:
          // type === 1: accept
          q[z] = [3];
      }
    }

    rv.push(q);
  }

  return rv;
} // helper: runlength encoding with increment step: code, length: step (default step = 0)
// `this` references an array


function s(c, l, a) {
  a = a || 0;

  for (var i = 0; i < l; i++) {
    this.push(c);
    c += a;
  }
} // helper: duplicate sequence from *relative* offset and length.
// `this` references an array


function c(i, l) {
  i = this.length - i;

  for (l += i; i < l; i++) {
    this.push(this[i]);
  }
} // helper: unpack an array using helpers and data, all passed in an array argument 'a'.


function u(a) {
  var rv = [];

  for (var i = 0, l = a.length; i < l; i++) {
    var e = a[i]; // Is this entry a helper function?

    if (typeof e === 'function') {
      i++;
      e.apply(rv, a[i]);
    } else {
      rv.push(e);
    }
  }

  return rv;
}

var parser$1 = {
  // Code Generator Information Report
  // ---------------------------------
  //
  // Options:
  //
  //   default action mode: ............. ["classic","merge"]
  //   test-compile action mode: ........ "parser:*,lexer:*"
  //   try..catch: ...................... true
  //   default resolve on conflict: ..... true
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
    errorRecoveryTokenDiscardCount: 3,
    ebnf: true
  },
  symbols_: {
    "$": 16,
    "$accept": 0,
    "$end": 1,
    "%%": 19,
    "(": 8,
    ")": 9,
    "*": 11,
    "+": 10,
    ",": 17,
    ".": 14,
    "/": 13,
    "/!": 42,
    "<": 3,
    "=": 18,
    ">": 6,
    "?": 12,
    "ACTION_BODY": 36,
    "ACTION_END": 24,
    "ACTION_START": 26,
    "ACTION_START_AT_SOL": 23,
    "ARROW_ACTION_START": 35,
    "BRACKET_MISSING": 38,
    "BRACKET_SURPLUS": 39,
    "CHARACTER_LIT": 51,
    "CODE": 31,
    "DUMMY": 27,
    "DUMMY3": 52,
    "EOF": 1,
    "ESCAPED_CHAR": 44,
    "IMPORT": 30,
    "INCLUDE": 32,
    "INCLUDE_PLACEMENT_ERROR": 37,
    "MACRO_END": 21,
    "MACRO_NAME": 20,
    "NAME_BRACE": 45,
    "OPTIONS": 29,
    "OPTIONS_END": 22,
    "OPTION_STRING": 53,
    "OPTION_VALUE": 54,
    "RANGE_REGEX": 49,
    "REGEX_SET": 48,
    "REGEX_SET_END": 47,
    "REGEX_SET_START": 46,
    "REGEX_SPECIAL_CHAR": 43,
    "SPECIAL_GROUP": 41,
    "START_EXC": 34,
    "START_INC": 33,
    "STRING_LIT": 50,
    "TRAILING_CODE_CHUNK": 55,
    "UNKNOWN_DECL": 28,
    "UNTERMINATED_ACTION_BLOCK": 25,
    "UNTERMINATED_STRING_ERROR": 40,
    "^": 15,
    "action": 72,
    "any_group_regex": 80,
    "definition": 60,
    "definitions": 59,
    "epilogue": 89,
    "epilogue_chunk": 91,
    "epilogue_chunks": 90,
    "error": 2,
    "import_keyword": 62,
    "include_keyword": 64,
    "include_macro_code": 92,
    "init": 58,
    "init_code_keyword": 63,
    "lex": 56,
    "literal_string": 84,
    "name_expansion": 79,
    "nonempty_regex_list": 76,
    "option": 86,
    "option_keyword": 61,
    "option_list": 85,
    "option_name": 87,
    "option_value": 88,
    "range_regex": 83,
    "regex": 74,
    "regex_base": 78,
    "regex_concat": 77,
    "regex_list": 75,
    "regex_set": 81,
    "regex_set_atom": 82,
    "rule": 71,
    "rule_block": 70,
    "rules": 68,
    "rules_and_epilogue": 57,
    "scoped_rules_collective": 69,
    "start_conditions": 73,
    "start_conditions_marker": 67,
    "start_exclusive_keyword": 66,
    "start_inclusive_keyword": 65,
    "{": 4,
    "|": 7,
    "}": 5
  },
  terminals_: {
    1: "EOF",
    2: "error",
    3: "<",
    4: "{",
    5: "}",
    6: ">",
    7: "|",
    8: "(",
    9: ")",
    10: "+",
    11: "*",
    12: "?",
    13: "/",
    14: ".",
    15: "^",
    16: "$",
    17: ",",
    18: "=",
    19: "%%",
    20: "MACRO_NAME",
    21: "MACRO_END",
    22: "OPTIONS_END",
    23: "ACTION_START_AT_SOL",
    24: "ACTION_END",
    25: "UNTERMINATED_ACTION_BLOCK",
    26: "ACTION_START",
    27: "DUMMY",
    28: "UNKNOWN_DECL",
    29: "OPTIONS",
    30: "IMPORT",
    31: "CODE",
    32: "INCLUDE",
    33: "START_INC",
    34: "START_EXC",
    35: "ARROW_ACTION_START",
    36: "ACTION_BODY",
    37: "INCLUDE_PLACEMENT_ERROR",
    38: "BRACKET_MISSING",
    39: "BRACKET_SURPLUS",
    40: "UNTERMINATED_STRING_ERROR",
    41: "SPECIAL_GROUP",
    42: "/!",
    43: "REGEX_SPECIAL_CHAR",
    44: "ESCAPED_CHAR",
    45: "NAME_BRACE",
    46: "REGEX_SET_START",
    47: "REGEX_SET_END",
    48: "REGEX_SET",
    49: "RANGE_REGEX",
    50: "STRING_LIT",
    51: "CHARACTER_LIT",
    52: "DUMMY3",
    53: "OPTION_STRING",
    54: "OPTION_VALUE",
    55: "TRAILING_CODE_CHUNK"
  },
  terminal_descriptions_: {
    45: "macro name in '{...}' curly braces"
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
  __reentrant_call_depth: 0,
  // INTERNAL USE ONLY
  __error_infos: [],
  // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup
  __error_recovery_infos: [],
  // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup
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
    } // Otherwise... this might refer to a RULE token i.e. a non-terminal: see if we can dig that one up.
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
    var check = {}; // Has this (error?) state been outfitted with a custom expectations description text for human consumption?
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
    pop: u([56, s, [57, 5], 58, 59, 59, s, [60, 21], s, [61, 8, 1], s, [68, 13], s, [69, 5], 70, 70, s, [71, 5], s, [72, 7], 73, 73, 74, 75, 75, s, [76, 5], 77, 77, s, [78, 18], 79, 80, 80, 81, 81, 82, 82, 83, 84, 84, s, [85, 3], s, [86, 4], 87, 87, 88, 88, s, [89, 3], s, [90, 3], s, [91, 5], 92, 92]),
    rule: u([4, 3, 3, 2, 2, 0, 0, 2, 0, 3, 2, 3, 2, c, [4, 3], 1, c, [5, 3], c, [3, 3], 1, 3, 2, 6, 4, 2, s, [1, 8], 2, 2, 4, 2, 3, 4, c, [25, 3], s, [2, 4], 0, 2, 4, c, [53, 4], 0, c, [6, 5], c, [19, 7], 4, 3, 1, 1, c, [66, 3], c, [49, 3], c, [58, 3], s, [3, 3], s, [2, 5], c, [12, 3], s, [1, 7], c, [17, 3], c, [9, 7], c, [8, 3], c, [13, 8], c, [35, 5], c, [13, 5], 3, 2])
  }),
  performAction: function parser__PerformAction(yyloc, yystate
  /* action[1] */
  , yysp, yyvstack, yylstack) {
    /* this == yyval */
    // the JS engine itself can go and remove these statements when `yy` turns out to be unused in any action code!
    var yy = this.yy;
    var yyparser = yy.parser;
    var yylexer = yy.lexer;
    const OPTION_DOES_NOT_ACCEPT_VALUE = 0x0001;
    const OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES = 0x0002;
    const OPTION_ALSO_ACCEPTS_STAR_AS_IDENTIFIER_NAME = 0x0004;
    const OPTION_DOES_NOT_ACCEPT_MULTIPLE_OPTIONS = 0x0008;
    const OPTION_DOES_NOT_ACCEPT_COMMA_SEPARATED_OPTIONS = 0x0010;

    switch (yystate) {
      case 0:
        /*! Production::    $accept : lex $end */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yylstack[yysp - 1]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        break;

      case 1:
        /*! Production::    lex : init definitions rules_and_epilogue EOF */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1];

        for (var key in yyvstack[yysp - 2]) {
          this.$[key] = yyvstack[yysp - 2][key];
        } // if there are any options, add them all, otherwise set options to NULL:
        // can't check for 'empty object' by `if (yy.options) ...` so we do it this way:


        for (key in yy.options) {
          this.$.options = yy.options;
          break;
        }

        if (yy.actionInclude) {
          var asrc = yy.actionInclude.join('\n\n'); // Only a non-empty action code chunk should actually make it through:

          if (asrc.trim() !== '') {
            this.$.actionInclude = asrc;
          }
        }

        delete yy.options;
        delete yy.actionInclude;
        return this.$;
        break;

      case 2:
        /*! Production::    rules_and_epilogue : "%%" rules epilogue */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        if (yyvstack[yysp]) {
          this.$ = {
            rules: yyvstack[yysp - 1],
            moduleInclude: yyvstack[yysp]
          };
        } else {
          this.$ = {
            rules: yyvstack[yysp - 1]
          };
        }

        break;

      case 3:
        /*! Production::    rules_and_epilogue : "%%" error epilogue */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        There's probably an error in one or more of your lexer regex rules.
        The lexer rule spec should have this structure:
    
                regex  action_code
    
        where 'regex' is a lex-style regex expression (see the
        jison and jison-lex documentation) which is intended to match a chunk
        of the input to lex, while the 'action_code' block is the JS code
        which will be invoked when the regex is matched. The 'action_code' block
        may be any (indented!) set of JS statements, optionally surrounded
        by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp - 1].errStr}
    `);
        break;

      case 4:
        /*! Production::    rules_and_epilogue : "%%" rules */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = {
          rules: yyvstack[yysp]
        };
        break;

      case 5:
        /*! Production::    rules_and_epilogue : "%%" error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        There's probably an error in one or more of your lexer regex rules.
        There's an error in your lexer regex rules section.
        Maybe you did not correctly separate the lexer sections with
        a '%%' on an otherwise empty line? Did you correctly 
        delimit every rule's action code block?
        The lexer spec file should have this structure:
    
            definitions
            %%
            rules
            %%                  // <-- only needed if ...
            extra_module_code   // <-- ... epilogue is present.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 6:
        /*! Production::    rules_and_epilogue : %epsilon */
        // default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true); // END of default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-)

        this.$ = {
          rules: []
        };
        break;

      case 7:
        /*! Production::    init : %epsilon */
        // default action (generated by JISON mode classic/merge :: 0,VT,VA,-,-,LT,LA,-,-):
        this.$ = undefined;
        this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true); // END of default action (generated by JISON mode classic/merge :: 0,VT,VA,-,-,LT,LA,-,-)

        yy.actionInclude = [];
        if (!yy.options) yy.options = {};
        yy.__options_flags__ = 0;
        yy.__options_category_description__ = '???'; // Store the `%s` and `%x` condition states in `yy` to ensure the rules section of the
        // lex language parser can reach these and use them for validating whether the lexer
        // rules written by the user actually reference *known* condition states.

        yy.startConditions = {}; // hash table
        // The next attribute + API set is a 'lexer/parser hack' in the sense that
        // it assumes zero look-ahead at some points during the parse
        // when a parser rule production's action code pushes or pops a value
        // on/off the context description stack to help the lexer produce
        // better informing error messages in case of a subsequent lexer
        // fail.

        yy.__context_description__ = ['???CONTEXT???'];

        yy.pushContextDescription = function (str) {
          yy.__context_description__.push(str);
        };

        yy.popContextDescription = function () {
          if (yy.__context_description__.length > 1) {
            yy.__context_description__.pop();
          } else {
            yyparser.yyError('__context_description__ stack depleted! Contact a developer!');
          }
        };

        yy.getContextDescription = function () {
          return yy.__context_description__[yy.__context_description__.length - 1];
        };

        break;

      case 8:
        /*! Production::    definitions : definitions definition */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1];

        if (yyvstack[yysp]) {
          switch (yyvstack[yysp].type) {
            case 'macro':
              this.$.macros[yyvstack[yysp].name] = yyvstack[yysp].body;
              break;

            case 'names':
              var condition_defs = yyvstack[yysp].names;

              for (var i = 0, len = condition_defs.length; i < len; i++) {
                var name = condition_defs[i][0];

                if (name in this.$.startConditions && this.$.startConditions[name] !== condition_defs[i][1]) {
                  yyparser.yyError(rmCommonWS$1`
                        You have specified the lexer condition state '${name}' as both
                        EXCLUSIVE ('%x') and INCLUSIVE ('%s'). Pick one, please, e.g.:
    
                            %x ${name}
                            %%
                            <${name}>LEXER_RULE_REGEX    return 'TOK';
    
                          Erroneous code:
                        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
                          Technical error report:
                        ${yyvstack[yysp].errStr}
                    `);
                }

                this.$.startConditions[name] = condition_defs[i][1]; // flag as 'exclusive'/'inclusive'
              } // and update the `yy.startConditions` hash table as well, so we have a full set
              // by the time this parser arrives at the lexer rules in the input-to-parse:


              yy.startConditions = this.$.startConditions;
              break;

            case 'unknown':
              this.$.unknownDecls.push(yyvstack[yysp].body);
              break;

            case 'imports':
              this.$.importDecls.push(yyvstack[yysp].body);
              break;

            case 'codeSection':
              this.$.codeSections.push(yyvstack[yysp].body);
              break;

            default:
              yyparser.yyError(rmCommonWS$1`
              Encountered an unsupported definition type: ${yyvstack[yysp].type}.
    
                Erroneous area:
              ${yylexer.prettyPrintRange(yylstack[yysp])}
            `);
              break;
          }
        }

        break;

      case 9:
        /*! Production::    definitions : %epsilon */
        // default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true); // END of default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-)

        this.$ = {
          macros: {},
          // { hash table }
          startConditions: {},
          // { hash table }
          codeSections: [],
          // [ array of {qualifier,include} pairs ]
          importDecls: [],
          // [ array of {name,path} pairs ]
          unknownDecls: [] // [ array of {name,value} pairs ]

        };
        break;

      case 10:
        /*! Production::    definition : MACRO_NAME regex MACRO_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)
        // Note: make sure we don't try re-define/override any XRegExp `\p{...}` or `\P{...}`
        // macros here:

        if (XRegExp._getUnicodeProperty(yyvstack[yysp - 2])) {
          // Work-around so that you can use `\p{ascii}` for a XRegExp slug, a.k.a.
          // Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories,
          // while using `\p{ASCII}` as a *macro expansion* of the `ASCII`
          // macro:
          if (yyvstack[yysp - 2].toUpperCase() !== yyvstack[yysp - 2]) {
            yyparser.yyError(rmCommonWS$1`
              Cannot use name "${$MACRO_NAME}" as a macro name
              as it clashes with the same XRegExp "\\p{..}" Unicode \'General Category\'
              Property name.
              Use all-uppercase macro names, e.g. name your macro
              "${$MACRO_NAME.toUpperCase()}" to work around this issue
              or give your offending macro a different name.
    
                Erroneous area:
              ${yylexer.prettyPrintRange(yylstack[yysp - 2])}
            `);
          }
        }

        this.$ = {
          type: 'macro',
          name: yyvstack[yysp - 2],
          body: yyvstack[yysp - 1]
        };
        break;

      case 11:
        /*! Production::    definition : MACRO_NAME error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        ill defined macro definition.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 12:
        /*! Production::    definition : start_inclusive_keyword option_list OPTIONS_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var lst = yyvstack[yysp - 1];

        for (var i = 0, len = lst.length; i < len; i++) {
          lst[i][1] = 0; // flag as 'inclusive'
        }

        this.$ = {
          type: 'names',
          names: lst // 'inclusive' conditions have value 0, 'exclusive' conditions have value 1

        };
        break;

      case 13:
        /*! Production::    definition : start_inclusive_keyword error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        ill defined '%s' inclusive lexer condition set specification.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 14:
        /*! Production::    definition : start_exclusive_keyword option_list OPTIONS_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var lst = yyvstack[yysp - 1];

        for (var i = 0, len = lst.length; i < len; i++) {
          lst[i][1] = 1; // flag as 'exclusive'
        }

        this.$ = {
          type: 'names',
          names: lst // 'inclusive' conditions have value 0, 'exclusive' conditions have value 1

        };
        break;

      case 15:
        /*! Production::    definition : start_exclusive_keyword error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        ill defined '%x' exclusive lexer condition set specification.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 16:
        /*! Production::    definition : ACTION_START_AT_SOL action ACTION_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var srcCode = trimActionCode$1(yyvstack[yysp - 1], yyvstack[yysp - 2]);

        if (srcCode) {
          var rv = checkActionBlock$1(srcCode, yylstack[yysp - 1]);

          if (rv) {
            yyparser.yyError(rmCommonWS$1`
                The '%{...%}' lexer setup action code section does not compile: ${rv}
    
                  Erroneous area:
                ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
            `);
          }

          yy.actionInclude.push(srcCode);
        }

        this.$ = null;
        break;

      case 17:
      /*! Production::    definition : UNTERMINATED_ACTION_BLOCK */

      case 131:
        /*! Production::    epilogue_chunk : UNTERMINATED_ACTION_BLOCK */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)
        // The issue has already been reported by the lexer. No need to repeat
        // ourselves with another error report from here.

        this.$ = null;
        break;

      case 18:
        /*! Production::    definition : ACTION_START_AT_SOL error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        var start_marker = yyvstack[yysp - 1].trim();
        var marker_msg = start_marker ? ' or similar, such as ' + start_marker : '';
        yyparser.yyError(rmCommonWS$1`
        There's very probably a problem with this '%{...%}' lexer setup action code section.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        this.$ = null;
        break;

      case 19:
        /*! Production::    definition : ACTION_START include_macro_code ACTION_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        yy.actionInclude.push(yyvstack[yysp - 1]);
        this.$ = null;
        break;

      case 20:
        /*! Production::    definition : ACTION_START error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        var start_marker = yyvstack[yysp - 1].trim();
        var marker_msg = start_marker ? ' or similar, such as ' + start_marker : '';
        yyparser.yyError(rmCommonWS$1`
        The '%{...%}' lexer setup action code section MUST have its action
        block start marker (\`%{\`${marker_msg}) positioned 
        at the start of a line to be accepted: *indented* action code blocks
        (such as this one) are always related to an immediately preceding lexer spec item, 
        e.g. a lexer match rule expression (see 'lexer rules').
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        this.$ = null;
        break;

      case 21:
        /*! Production::    definition : ACTION_START DUMMY */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        var start_marker = yyvstack[yysp - 1].trim();
        var marker_msg = start_marker ? ' or similar, such as ' + start_marker : '';
        yyparser.yyError(rmCommonWS$1`
        The '%{...%}' lexer setup action code section MUST have its action
        block start marker (\`%{\`${marker_msg}) positioned 
        at the start of a line to be accepted: *indented* action code blocks
        (such as this one) are always related to an immediately preceding lexer spec item, 
        e.g. a lexer match rule expression (see 'lexer rules').
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    `);
        this.$ = null;
        break;

      case 22:
        /*! Production::    definition : option_keyword option_list OPTIONS_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var lst = yyvstack[yysp - 1];

        for (var i = 0, len = lst.length; i < len; i++) {
          yy.options[lst[i][0]] = lst[i][1];
        }

        this.$ = null;
        break;

      case 23:
        /*! Production::    definition : option_keyword error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        ill defined %options line.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 24:
        /*! Production::    definition : UNKNOWN_DECL */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = {
          type: 'unknown',
          body: yyvstack[yysp]
        };
        break;

      case 25:
        /*! Production::    definition : import_keyword option_list OPTIONS_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)
        // check if there are two unvalued options: 'name path'

        var lst = yyvstack[yysp - 1];
        var len = lst.length;
        var body;

        if (len === 2 && lst[0][1] === true && lst[1][1] === true) {
          // `name path`:
          body = {
            name: lst[0][0],
            path: lst[1][0]
          };
        } else if (len <= 2) {
          yyparser.yyError(rmCommonWS$1`
            You did not specify a legal qualifier name and/or file path for the '%import' statement, which must have the format:
                %import qualifier_name file_path
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
        `);
        } else {
          yyparser.yyError(rmCommonWS$1`
            You did specify too many attributes for the '%import' statement, which must have the format:
                %import qualifier_name file_path
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
        `);
        }

        this.$ = {
          type: 'imports',
          body: body
        };
        break;

      case 26:
        /*! Production::    definition : import_keyword error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        %import name or source filename missing maybe?
    
        Note: each '%import' must be qualified by a name, e.g. 'required' before the import path itself:
            %import qualifier_name file_path
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 27:
        /*! Production::    definition : init_code_keyword option_list ACTION_START action ACTION_END OPTIONS_END */
        // default action (generated by JISON mode classic/merge :: 6,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 5, yysp); // END of default action (generated by JISON mode classic/merge :: 6,VT,VA,VU,-,LT,LA,-,-)
        // check there's only 1 option which is an identifier

        var lst = yyvstack[yysp - 4];
        var len = lst.length;
        var name;

        if (len === 1 && lst[0][1] === true) {
          // `name`:
          name = lst[0][0];
        } else if (len <= 1) {
          yyparser.yyError(rmCommonWS$1`
            You did not specify a legal qualifier name for the '%code' initialization code statement, which must have the format:
                %code qualifier_name %{...code...%}
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp - 4], yylstack[yysp - 5])}
        `);
        } else {
          yyparser.yyError(rmCommonWS$1`
            You did specify too many attributes for the '%code' initialization code statement, which must have the format:
                %code qualifier_name %{...code...%}
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp - 4], yylstack[yysp - 5])}
        `);
        }

        var srcCode = trimActionCode$1(yyvstack[yysp - 2], yyvstack[yysp - 3]);
        var rv = checkActionBlock$1(srcCode, yylstack[yysp - 2]);

        if (rv) {
          yyparser.yyError(rmCommonWS$1`
            The '%code ${name}' initialization code section does not compile: ${rv}
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylstack[yysp - 2], yylstack[yysp - 5])}
        `);
        }

        this.$ = {
          type: 'codeSection',
          body: {
            qualifier: name,
            include: srcCode
          }
        };
        break;

      case 28:
        /*! Production::    definition : init_code_keyword option_list ACTION_START error */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 3];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,-,-,LT,LA,-,-)

        break;

      case 29:
        /*! Production::    definition : init_code_keyword error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Each '%code' initialization code section must be qualified by a name, e.g. 'required' before the action code itself:
            %code qualifier_name {action code}
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 30:
        /*! Production::    definition : error */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        illegal input in the lexer spec definitions section.
    
        This might be stuff incorrectly dangling off the previous 
        '${yy.__options_category_description__}' definition statement, so please do check above 
        when the mistake isn't immediately obvious from this error spot itself.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 31:
        /*! Production::    option_keyword : OPTIONS */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yy.__options_flags__ = OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES;
        yy.__options_category_description__ = yyvstack[yysp];
        break;

      case 32:
      /*! Production::    import_keyword : IMPORT */

      case 34:
        /*! Production::    include_keyword : INCLUDE */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yy.__options_flags__ = OPTION_DOES_NOT_ACCEPT_VALUE | OPTION_DOES_NOT_ACCEPT_COMMA_SEPARATED_OPTIONS;
        yy.__options_category_description__ = yyvstack[yysp];
        break;

      case 33:
        /*! Production::    init_code_keyword : CODE */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yy.__options_flags__ = OPTION_DOES_NOT_ACCEPT_VALUE | OPTION_DOES_NOT_ACCEPT_MULTIPLE_OPTIONS | OPTION_DOES_NOT_ACCEPT_COMMA_SEPARATED_OPTIONS;
        yy.__options_category_description__ = yyvstack[yysp];
        break;

      case 35:
        /*! Production::    start_inclusive_keyword : START_INC */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yy.__options_flags__ = OPTION_DOES_NOT_ACCEPT_VALUE | OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES;
        yy.__options_category_description__ = 'the inclusive lexer start conditions set (%s)';
        break;

      case 36:
        /*! Production::    start_exclusive_keyword : START_EXC */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yy.__options_flags__ = OPTION_DOES_NOT_ACCEPT_VALUE | OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES;
        yy.__options_category_description__ = 'the exclusive lexer start conditions set (%x)';
        break;

      case 37:
        /*! Production::    start_conditions_marker : "<" */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        yy.__options_flags__ = OPTION_DOES_NOT_ACCEPT_VALUE | OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES | OPTION_ALSO_ACCEPTS_STAR_AS_IDENTIFIER_NAME;
        yy.__options_category_description__ = 'the <...> delimited set of lexer start conditions';
        break;

      case 38:
        /*! Production::    rules : rules scoped_rules_collective */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1].concat(yyvstack[yysp]);
        break;

      case 39:
        /*! Production::    rules : rules rule */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1].concat([yyvstack[yysp]]);
        break;

      case 40:
        /*! Production::    rules : rules ACTION_START_AT_SOL action ACTION_END */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)

        var srcCode = trimActionCode$1(yyvstack[yysp - 1], yyvstack[yysp - 2]);

        if (srcCode) {
          var rv = checkActionBlock$1(srcCode, yylstack[yysp - 1]);

          if (rv) {
            yyparser.yyError(rmCommonWS$1`
                The '%{...%}' lexer setup action code section does not compile: ${rv}
    
                  Erroneous area:
                ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
            `);
          }

          yy.actionInclude.push(srcCode);
        }

        this.$ = yyvstack[yysp - 3];
        break;

      case 41:
        /*! Production::    rules : rules UNTERMINATED_ACTION_BLOCK */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)
        // The issue has already been reported by the lexer. No need to repeat
        // ourselves with another error report from here.

        this.$ = yyvstack[yysp - 1];
        break;

      case 42:
        /*! Production::    rules : rules ACTION_START_AT_SOL error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var start_marker = yyvstack[yysp - 1].trim();
        var marker_msg = start_marker ? ' or similar, such as ' + start_marker : '';
        yyparser.yyError(rmCommonWS$1`
        There's very probably a problem with this '%{...%}' lexer setup action code section.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        this.$ = yyvstack[yysp - 2];
        break;

      case 43:
        /*! Production::    rules : rules ACTION_START include_macro_code ACTION_END */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)

        yy.actionInclude.push(yyvstack[yysp - 1]);
        this.$ = yyvstack[yysp - 3];
        break;

      case 44:
        /*! Production::    rules : rules ACTION_START error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var start_marker = yyvstack[yysp - 1].trim(); // When the start_marker is not an explicit `%{`, `{` or similar, the error
        // is more probably due to indenting the rule regex, rather than an error
        // in writing the action code block:

        console.error("*** error! marker:", start_marker);

        if (start_marker.indexOf('{') >= 0) {
          var marker_msg = start_marker ? ' or similar, such as ' + start_marker : '';
          yyparser.yyError(rmCommonWS$1`
            The '%{...%}' lexer setup action code section MUST have its action
            block start marker (\`%{\`${marker_msg}) positioned 
            at the start of a line to be accepted: *indented* action code blocks
            (such as this one) are always related to an immediately preceding lexer spec item, 
            e.g. a lexer match rule expression (see 'lexer rules').
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    
              Technical error report:
            ${yyvstack[yysp].errStr}
        `);
        } else {
          yyparser.yyError(rmCommonWS$1`
            There's probably an error in one or more of your lexer regex rules.
            Did you perhaps indent the rule regex? Note that all rule regexes 
            MUST start at the start of the line, i.e. text column 1. Indented text
            is perceived as JavaScript action code related to the last lexer
            rule regex.
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp])}
    
              Technical error report:
            ${yyvstack[yysp].errStr}
        `);
        }

        this.$ = yyvstack[yysp - 2];
        break;

      case 45:
      /*! Production::    rules : rules start_inclusive_keyword */

      case 46:
      /*! Production::    rules : rules start_exclusive_keyword */

      case 47:
      /*! Production::    rules : rules option_keyword */

      case 48:
      /*! Production::    rules : rules UNKNOWN_DECL */

      case 49:
      /*! Production::    rules : rules import_keyword */

      case 50:
        /*! Production::    rules : rules init_code_keyword */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        \`${yy.__options_category_description__}\` statements must be placed in
        the top section of the lexer spec file, above the first '%%'
        separator. You cannot specify any in the second section as has been
        done here.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp])}
    `);
        this.$ = yyvstack[yysp - 1];
        break;

      case 51:
      /*! Production::    rules : %epsilon */

      case 58:
        /*! Production::    rule_block : %epsilon */
        // default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true); // END of default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-)

        this.$ = [];
        break;

      case 52:
        /*! Production::    scoped_rules_collective : start_conditions rule */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        if (yyvstack[yysp - 1]) {
          yyvstack[yysp].unshift(yyvstack[yysp - 1]);
        }

        this.$ = [yyvstack[yysp]];
        break;

      case 53:
        /*! Production::    scoped_rules_collective : start_conditions "{" rule_block "}" */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)

        if (yyvstack[yysp - 3]) {
          yyvstack[yysp - 1].forEach(function (d) {
            d.unshift(yyvstack[yysp - 3]);
          });
        }

        this.$ = yyvstack[yysp - 1];
        break;

      case 54:
        /*! Production::    scoped_rules_collective : start_conditions "{" error "}" */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 3];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Seems you made a mistake while specifying one of the lexer rules inside
        the start condition
           <${yyvstack[yysp - 3].join(',')}> { rules... }
        block.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yyparser.mergeLocationInfo(yysp - 3, yysp), yylstack[yysp - 3])}
    
          Technical error report:
        ${yyvstack[yysp - 1].errStr}
    `);
        break;

      case 55:
        /*! Production::    scoped_rules_collective : start_conditions "{" error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Seems you did not correctly bracket a lexer rules set inside
        the start condition
          <${yyvstack[yysp - 2].join(',')}> { rules... }
        as a terminating curly brace '}' could not be found.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 56:
        /*! Production::    scoped_rules_collective : start_conditions error "}" */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Seems you did not correctly bracket a lexer rules set inside
        the start condition
          <${yyvstack[yysp - 2].join(',')}> { rules... }
        as a terminating curly brace '}' could not be found.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp - 1].errStr}
    `);
        break;

      case 57:
        /*! Production::    rule_block : rule_block rule */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1];
        this.$.push(yyvstack[yysp]);
        break;

      case 59:
        /*! Production::    rule : regex ACTION_START action ACTION_END */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)

        var srcCode = trimActionCode$1(yyvstack[yysp - 1], yyvstack[yysp - 2]);
        var rv = checkActionBlock$1(srcCode, yylstack[yysp - 1]);

        if (rv) {
          yyparser.yyError(rmCommonWS$1`
            The lexer rule's action code section does not compile: ${rv}
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 3])}
        `);
        }

        this.$ = [yyvstack[yysp - 3], srcCode];
        break;

      case 60:
        /*! Production::    rule : regex ARROW_ACTION_START action ACTION_END */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)

        var srcCode = trimActionCode$1(yyvstack[yysp - 1]); // add braces around ARROW_ACTION_CODE so that the action chunk test/compiler
        // will uncover any illegal action code following the arrow operator, e.g.
        // multiple statements separated by semicolon.
        //
        // Note/Optimization:
        // there's no need for braces in the generated expression when we can
        // already see the given action is an identifier string or something else
        // that's a sure simple thing for a JavaScript `return` statement to carry.
        // By doing this, we simplify the token return replacement code replacement
        // process which will be applied to the parsed lexer before its code
        // will be generated by JISON.

        if (/^[^\r\n;\/]+$/.test(srcCode)) {
          srcCode = 'return ' + srcCode;
        } else {
          srcCode = 'return (' + srcCode + '\n)';
        }

        var rv = checkActionBlock$1(srcCode, yylstack[yysp - 1]);

        if (rv) {
          yyparser.yyError(rmCommonWS$1`
            The lexer rule's 'arrow' action code section does not compile: ${rv}
    
            # NOTE that the arrow action automatically wraps the action code
            # in a \`return (...);\` statement to prevent hard-to-diagnose run-time
            # errors down the line.
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 3])}
        `);
        }

        this.$ = [yyvstack[yysp - 3], srcCode];
        break;

      case 61:
        /*! Production::    rule : regex ARROW_ACTION_START error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        this.$ = [yyvstack[yysp - 2], yyvstack[yysp]];
        yyparser.yyError(rmCommonWS$1`
        A lexer rule action arrow must be followed by a JavaScript expression specifying the lexer token to produce, e.g.:
    
            /rule/   -> 'BUGGABOO'    // eqv. to \`return 'BUGGABOO';\`
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 62:
        /*! Production::    rule : regex ACTION_START error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)
        // TODO: REWRITE

        this.$ = [yyvstack[yysp - 2], yyvstack[yysp]];
        yyparser.yyError(rmCommonWS$1`
        A lexer rule regex action code must be properly terminated and must contain a JavaScript statement block (or anything that does parse as such), e.g.:
    
            /rule/      %{ invokeHooHaw(); return 'TOKEN'; %}
    
        NOTE: when you have very simple action code, wrapping it in '%{...}%' or equivalent is not required as long as you keep the code indented, e.g.:
    
            /rule/      invokeHooHaw();
                        return 'TOKEN';
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 63:
        /*! Production::    rule : regex error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = [yyvstack[yysp - 1], yyvstack[yysp]];
        yyparser.yyError(rmCommonWS$1`
        Lexer rule regex action code declaration error?
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 64:
      /*! Production::    action : action ACTION_BODY */

      case 81:
      /*! Production::    regex_concat : regex_concat regex_base */

      case 93:
      /*! Production::    regex_base : regex_base range_regex */

      case 104:
      /*! Production::    regex_set : regex_set regex_set_atom */

      case 125:
        /*! Production::    epilogue_chunks : epilogue_chunks epilogue_chunk */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1] + yyvstack[yysp];
        break;

      case 65:
        /*! Production::    action : action include_macro_code */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1] + '\n\n' + yyvstack[yysp] + '\n\n';
        break;

      case 66:
        /*! Production::    action : action INCLUDE_PLACEMENT_ERROR */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        You may place the '%include' instruction only at the start/front of a line.
    
          Its use is not permitted at this position:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 3])}
    `);
        break;

      case 67:
        /*! Production::    action : action BRACKET_MISSING */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Missing curly braces: seems you did not correctly bracket a lexer rule action block in curly braces: '{ ... }'.
    
          Offending action body:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 3])}
    `);
        break;

      case 68:
        /*! Production::    action : action BRACKET_SURPLUS */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Too many curly braces: seems you did not correctly bracket a lexer rule action block in curly braces: '{ ... }'.
    
          Offending action body:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 3])}
    `);
        break;

      case 69:
        /*! Production::    action : action UNTERMINATED_STRING_ERROR */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Unterminated string constant in lexer rule action block.
    
        When your action code is as intended, it may help to enclose
        your rule action block code in a '%{...%}' block.
    
          Offending action body:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 3])}
    `);
        break;

      case 70:
      /*! Production::    action : %epsilon */

      case 75:
        /*! Production::    regex_list : %epsilon */
        // default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(null, null, null, null, true); // END of default action (generated by JISON mode classic/merge :: 0,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '';
        break;

      case 71:
        /*! Production::    start_conditions : start_conditions_marker option_list OPTIONS_END ">" */
        // default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 3, yysp); // END of default action (generated by JISON mode classic/merge :: 4,VT,VA,VU,-,LT,LA,-,-)
        // rewrite + accept star '*' as name + check if we allow empty list?

        this.$ = yyvstack[yysp - 2].map(function (el) {
          var name = el[0]; // Validate the given condition state: when it isn't known, print an error message
          // accordingly:

          if (name !== '*' && name !== 'INITIAL' && !(name in yy.startConditions)) {
            yyparser.yyError(rmCommonWS$1`
                You specified an unknown lexer condition state '${name}'.
                Is this a typo or did you forget to include this one in the '%s' and '%x'
                inclusive and exclusive condition state sets specifications at the top of
                the lexer spec?
    
                As a rough example, things should look something like this in your lexer
                spec file:
    
                    %s ${name}
                    %%
                    <${name}>LEXER_RULE_REGEX    return 'TOK';
    
                  Erroneous code:
                ${yylexer.prettyPrintRange(yylstack[yysp - 2], yylstack[yysp - 3], yylstack[yysp])}
            `);
          }

          return name;
        }); // '<' '*' '>'
        //    { $$ = ['*']; }

        break;

      case 72:
        /*! Production::    start_conditions : start_conditions_marker option_list error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)
        // rewrite + accept star '*' as name + check if we allow empty list?

        var lst = yyvstack[yysp - 1].map(function (el) {
          return el[0];
        });
        yyparser.yyError(rmCommonWS$1`
        Seems you did not correctly terminate the start condition set
            <${lst.join(',')},???>
        with a terminating '>'
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 73:
        /*! Production::    regex : nonempty_regex_list */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)
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
          this.$ = this.$.replace(/\\\\/g, '.').replace(/"/g, '.').replace(/\\c[A-Z]/g, '.').replace(/\\[^xu0-7]/g, '.');

          try {
            // Convert Unicode escapes and other escapes to their literal characters
            // BEFORE we go and check whether this item is subject to the
            // `easy_keyword_rules` option.
            this.$ = JSON.parse('"' + this.$ + '"');
          } catch (ex) {
            yyparser.warn('easy-keyword-rule FAIL on eval: ', ex); // make the next keyword test fail:

            this.$ = '.';
          } // a 'keyword' starts with an alphanumeric character,
          // followed by zero or more alphanumerics or digits:


          var re = new XRegExp('\\w[\\w\\d]*$');

          if (XRegExp.match(this.$, re)) {
            this.$ = yyvstack[yysp] + "\\b";
          } else {
            this.$ = yyvstack[yysp];
          }
        }

        break;

      case 74:
      /*! Production::    regex_list : nonempty_regex_list */

      case 80:
      /*! Production::    nonempty_regex_list : regex_concat */

      case 82:
      /*! Production::    regex_concat : regex_base */

      case 101:
      /*! Production::    name_expansion : NAME_BRACE */

      case 108:
      /*! Production::    range_regex : RANGE_REGEX */

      case 127:
        /*! Production::    epilogue_chunks : epilogue_chunk */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp];
        break;

      case 76:
        /*! Production::    nonempty_regex_list : nonempty_regex_list "|" regex_concat */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 2] + '|' + yyvstack[yysp];
        break;

      case 77:
        /*! Production::    nonempty_regex_list : nonempty_regex_list "|" */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1] + '|';
        break;

      case 78:
        /*! Production::    nonempty_regex_list : "|" regex_concat */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '|' + yyvstack[yysp];
        break;

      case 79:
        /*! Production::    nonempty_regex_list : "|" */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '|';
        break;

      case 83:
        /*! Production::    regex_base : "(" regex_list ")" */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '(' + yyvstack[yysp - 1] + ')';
        break;

      case 84:
        /*! Production::    regex_base : SPECIAL_GROUP regex_list ")" */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 2] + yyvstack[yysp - 1] + ')';
        break;

      case 85:
      /*! Production::    regex_base : "(" regex_list error */

      case 86:
        /*! Production::    regex_base : SPECIAL_GROUP regex_list error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Seems you did not correctly bracket a lex rule regex part in '(...)' braces.
    
          Unterminated regex part:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 87:
        /*! Production::    regex_base : regex_base "+" */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1] + '+';
        break;

      case 88:
        /*! Production::    regex_base : regex_base "*" */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1] + '*';
        break;

      case 89:
        /*! Production::    regex_base : regex_base "?" */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 1] + '?';
        break;

      case 90:
        /*! Production::    regex_base : "/" regex_base */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '(?=' + yyvstack[yysp] + ')';
        break;

      case 91:
        /*! Production::    regex_base : "/!" regex_base */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '(?!' + yyvstack[yysp] + ')';
        break;

      case 92:
      /*! Production::    regex_base : name_expansion */

      case 94:
      /*! Production::    regex_base : any_group_regex */

      case 98:
      /*! Production::    regex_base : REGEX_SPECIAL_CHAR */

      case 99:
      /*! Production::    regex_base : literal_string */

      case 105:
      /*! Production::    regex_set : regex_set_atom */

      case 106:
        /*! Production::    regex_set_atom : REGEX_SET */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp];
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,-,-,LT,LA,-,-)

        break;

      case 95:
        /*! Production::    regex_base : "." */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '.';
        break;

      case 96:
        /*! Production::    regex_base : "^" */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '^';
        break;

      case 97:
        /*! Production::    regex_base : "$" */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '$';
        break;

      case 100:
        /*! Production::    regex_base : ESCAPED_CHAR */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = encodeRegexLiteralStr(encodeUnicodeCodepoint(yyvstack[yysp]));
        break;

      case 102:
        /*! Production::    any_group_regex : REGEX_SET_START regex_set REGEX_SET_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        this.$ = yyvstack[yysp - 2] + yyvstack[yysp - 1] + yyvstack[yysp];
        break;

      case 103:
        /*! Production::    any_group_regex : REGEX_SET_START regex_set error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        Seems you did not correctly bracket a lex rule regex set in '[...]' brackets.
    
          Unterminated regex set:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 107:
        /*! Production::    regex_set_atom : name_expansion */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        if (XRegExp._getUnicodeProperty(yyvstack[yysp].replace(/[{}]/g, '')) && yyvstack[yysp].toUpperCase() !== yyvstack[yysp]) {
          // treat this as part of an XRegExp `\p{...}` Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories
          this.$ = yyvstack[yysp];
        } else {
          this.$ = yyvstack[yysp];
        } //yyparser.log("name expansion for: ", { name: $name_expansion, redux: $name_expansion.replace(/[{}]/g, ''), output: $$ });


        break;

      case 109:
        /*! Production::    literal_string : STRING_LIT */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        var src = yyvstack[yysp];
        var s = src.substring(1, src.length - 1);
        var edge = src[0];
        this.$ = encodeRegexLiteralStr(s, edge);
        break;

      case 110:
        /*! Production::    literal_string : CHARACTER_LIT */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        var s = yyvstack[yysp];
        this.$ = encodeRegexLiteralStr(s);
        break;

      case 111:
        /*! Production::    option_list : option_list "," option */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)
        // validate that this is legal behaviour under the given circumstances, i.e. parser context:

        if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_MULTIPLE_OPTIONS) {
          yyparser.yyError(rmCommonWS$1`
            You may only specify one name/argument in a ${yy.__options_category_description__} statement.
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylexer.deriveLocationInfo(yylstack[yysp - 1], yylstack[yysp]), yylstack[yysp - 4])}
        `);
        }

        if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_COMMA_SEPARATED_OPTIONS) {
          var optlist = yyvstack[yysp - 2].map(function (opt) {
            return opt[0];
          });
          optlist.push(yyvstack[yysp][0]);
          yyparser.yyError(rmCommonWS$1`
            You may not separate entries in a ${yy.__options_category_description__} statement using commas.
            Use whitespace instead, e.g.:
    
                ${yyvstack[yysp - 4]} ${optlist.join(' ')} ...
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylexer.deriveLocationInfo(yylstack[yysp - 1], yylstack[yysp - 2]), yylstack[yysp - 4])}
        `);
        }

        this.$ = yyvstack[yysp - 2];
        this.$.push(yyvstack[yysp]);
        break;

      case 112:
        /*! Production::    option_list : option_list option */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)
        // validate that this is legal behaviour under the given circumstances, i.e. parser context:

        if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_MULTIPLE_OPTIONS) {
          yyparser.yyError(rmCommonWS$1`
            You may only specify one name/argument in a ${yy.__options_category_description__} statement.
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylexer.deriveLocationInfo(yylstack[yysp]), yylstack[yysp - 3])}
        `);
        }

        this.$ = yyvstack[yysp - 1];
        this.$.push(yyvstack[yysp]);
        break;

      case 113:
        /*! Production::    option_list : option */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = [yyvstack[yysp]];
        break;

      case 114:
        /*! Production::    option : option_name */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = [yyvstack[yysp], true];
        break;

      case 115:
        /*! Production::    option : option_name "=" option_value */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)
        // validate that this is legal behaviour under the given circumstances, i.e. parser context:

        if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_VALUE) {
          yyparser.yyError(rmCommonWS$1`
            The entries in a ${yy.__options_category_description__} statement MUST NOT be assigned values, such as '${$option_name}=${$option_value}'.
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylexer.deriveLocationInfo(yylstack[yysp], yylstack[yysp - 2]), yylstack[yysp - 4])}
        `);
        }

        this.$ = [yyvstack[yysp - 2], yyvstack[yysp]];
        break;

      case 116:
        /*! Production::    option : option_name "=" error */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 2];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,-,-,LT,LA,-,-)
        // TODO ...

        yyparser.yyError(rmCommonWS$1`
        Internal error: option "${$option}" value assignment failure in a ${yy.__options_category_description__} statement.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 4])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 117:
        /*! Production::    option : DUMMY3 error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        var with_value_msg = ' (with optional value assignment)';

        if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_VALUE) {
          with_value_msg = '';
        }

        yyparser.yyError(rmCommonWS$1`
        Expected a valid option name${with_value_msg} in a ${yy.__options_category_description__} statement.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 3])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 118:
        /*! Production::    option_name : option_value */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)
        // validate that this is legal input under the given circumstances, i.e. parser context:

        if (yy.__options_flags__ & OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES) {
          this.$ = mkIdentifier$1(yyvstack[yysp]); // check if the transformation is obvious & trivial to humans;
          // if not, report an error as we don't want confusion due to
          // typos and/or garbage input here producing something that
          // is usable from a machine perspective.

          if (!isLegalIdentifierInput$1(yyvstack[yysp])) {
            var with_value_msg = ' (with optional value assignment)';

            if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_VALUE) {
              with_value_msg = '';
            }

            yyparser.yyError(rmCommonWS$1`
                Expected a valid name/argument${with_value_msg} in a ${yy.__options_category_description__} statement.
                Entries (names) must look like regular programming language
                identifiers, with the addition that option names MAY contain
                '-' dashes, e.g. 'example-option-1'.
    
                  Erroneous area:
                ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
            `);
          }
        } else {
          this.$ = yyvstack[yysp];
        }

        break;

      case 119:
        /*! Production::    option_name : "*" */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)
        // validate that this is legal input under the given circumstances, i.e. parser context:

        if (!(yy.__options_flags__ & OPTION_EXPECTS_ONLY_IDENTIFIER_NAMES) || yy.__options_flags__ & OPTION_ALSO_ACCEPTS_STAR_AS_IDENTIFIER_NAME) {
          this.$ = yyvstack[yysp];
        } else {
          var with_value_msg = ' (with optional value assignment)';

          if (yy.__options_flags__ & OPTION_DOES_NOT_ACCEPT_VALUE) {
            with_value_msg = '';
          }

          yyparser.yyError(rmCommonWS$1`
            Expected a valid name/argument${with_value_msg} in a ${yy.__options_category_description__} statement.
            Entries (names) must look like regular programming language
            identifiers, with the addition that option names MAY contain
            '-' dashes, e.g. 'example-option-1'
    
              Erroneous area:
            ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 2])}
        `);
        }

        break;

      case 120:
        /*! Production::    option_value : OPTION_STRING */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = JSON5.parse(yyvstack[yysp]);
        break;

      case 121:
        /*! Production::    option_value : OPTION_VALUE */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = parseValue(yyvstack[yysp]);
        break;

      case 122:
        /*! Production::    epilogue : "%%" */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '';
        break;

      case 123:
        /*! Production::    epilogue : "%%" epilogue_chunks */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        var srcCode = trimActionCode$1(yyvstack[yysp]);

        if (srcCode) {
          var rv = checkActionBlock$1(srcCode, yylstack[yysp]);

          if (rv) {
            yyparser.yyError(rmCommonWS$1`
                The '%%' lexer epilogue code does not compile: ${rv}
    
                  Erroneous area:
                ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
            `);
          }
        }

        this.$ = srcCode;
        break;

      case 124:
        /*! Production::    epilogue : "%%" error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        There's an error in your lexer epilogue code block.
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 126:
        /*! Production::    epilogue_chunks : epilogue_chunks error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)
        // TODO ...

        yyparser.yyError(rmCommonWS$1`
        Module code declaration error?
    
          Erroneous code:
        ${yylexer.prettyPrintRange(yylstack[yysp])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        this.$ = '';
        break;

      case 128:
        /*! Production::    epilogue_chunk : ACTION_START include_macro_code ACTION_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        this.$ = '\n\n' + yyvstack[yysp - 1] + '\n\n';
        break;

      case 129:
        /*! Production::    epilogue_chunk : ACTION_START_AT_SOL action ACTION_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,-,-)

        var srcCode = trimActionCode$1(yyvstack[yysp - 1], yyvstack[yysp - 2]);

        if (srcCode) {
          var rv = checkActionBlock$1(srcCode, yylstack[yysp - 1]);

          if (rv) {
            yyparser.yyError(rmCommonWS$1`
                The '%{...%}' lexer epilogue code chunk does not compile: ${rv}
    
                  Erroneous area:
                ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
            `);
          }
        } // Since the epilogue is concatenated as-is (see the `epilogue_chunks` rule above)
        // we append those protective double newlines right now, as the calling site
        // won't do it for us: 


        this.$ = '\n\n' + srcCode + '\n\n';
        break;

      case 130:
        /*! Production::    epilogue_chunk : ACTION_START_AT_SOL error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,VU,-,LT,LA,-,-)

        var start_marker = yyvstack[yysp - 1].trim();
        var marker_msg = start_marker ? ' or similar, such as ' + start_marker : '';
        yyparser.yyError(rmCommonWS$1`
        There's very probably a problem with this '%{...%}' lexer setup action code section.
    
          Erroneous area:
        ${yylexer.prettyPrintRange(yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        this.$ = '';
        break;

      case 132:
        /*! Production::    epilogue_chunk : TRAILING_CODE_CHUNK */
        // default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-):
        this._$ = yylstack[yysp]; // END of default action (generated by JISON mode classic/merge :: 1,VT,VA,VU,-,LT,LA,-,-)
        // these code chunks are very probably incomplete, hence compile-testing
        // for these should be deferred until we've collected the entire epilogue. 

        this.$ = yyvstack[yysp];
        break;

      case 133:
        /*! Production::    include_macro_code : include_keyword option_list OPTIONS_END */
        // default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,LU,LUbA):
        this._$ = yyparser.yyMergeLocationInfo(yysp - 2, yysp); // END of default action (generated by JISON mode classic/merge :: 3,VT,VA,VU,-,LT,LA,LU,LUbA)
        // check if there is only 1 unvalued options: 'path'

        var lst = yyvstack[yysp - 1];
        var len = lst.length;
        var path$$1;

        if (len === 1 && lst[0][1] === true) {
          // `path`:
          path$$1 = lst[0][0];
        } else if (len <= 1) {
          yyparser.yyError(rmCommonWS$1`
            You did not specify a legal file path for the '%include' statement, which must have the format:
                %include file_path
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
    
              Technical error report:
            ${$error.errStr}
        `);
        } else {
          yyparser.yyError(rmCommonWS$1`
            You did specify too many attributes for the '%include' statement, which must have the format:
                %include file_path
    
              Erroneous code:
            ${yylexer.prettyPrintRange(yylstack[yysp - 1], yylstack[yysp - 2])}
    
              Technical error report:
            ${$error.errStr}
        `);
        } // **Aside**: And no, we don't support nested '%include'!


        var fileContent = fs.readFileSync(path$$1, {
          encoding: 'utf-8'
        });
        var srcCode = trimActionCode$1(fileContent);

        if (srcCode) {
          var rv = checkActionBlock$1(srcCode, this._$);

          if (rv) {
            yyparser.yyError(rmCommonWS$1`
                The source code included from file '${path$$1}' does not compile: ${rv}
    
                  Erroneous area:
                ${yylexer.prettyPrintRange(this._$)}
            `);
          }
        }

        this.$ = '\n// Included by Jison: ' + path$$1 + ':\n\n' + srcCode + '\n\n// End Of Include by Jison: ' + path$$1 + '\n\n';
        break;

      case 134:
        /*! Production::    include_macro_code : include_keyword error */
        // default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-):
        this.$ = yyvstack[yysp - 1];
        this._$ = yyparser.yyMergeLocationInfo(yysp - 1, yysp); // END of default action (generated by JISON mode classic/merge :: 2,VT,VA,-,-,LT,LA,-,-)

        yyparser.yyError(rmCommonWS$1`
        %include MUST be followed by a valid file path.
    
          Erroneous path:
        ${yylexer.prettyPrintRange(yylstack[yysp], yylstack[yysp - 1])}
    
          Technical error report:
        ${yyvstack[yysp].errStr}
    `);
        break;

      case 185:
        // === NO_ACTION[1] :: ensures that anyone (but us) using this new state will fail dramatically!
        // error recovery reduction action (action generated by jison,
        // using the user-specified `%code error_recovery_reduction` %{...%}
        // code chunk below.
        break;
    }
  },
  table: bt({
    len: u([15, 1, 14, 20, 1, 13, 28, 22, s, [9, 3], 13, 5, 9, 13, c, [6, 3], s, [31, 5], 1, 43, 3, 1, 13, 5, 24, 23, 24, 23, 23, 17, 17, s, [23, 8], 25, 5, 23, 23, 9, 13, 8, 9, 1, s, [9, 5], 13, 9, 13, 1, 13, 13, 9, c, [53, 4], c, [11, 4], 26, 26, 9, 26, 4, s, [26, 6], 8, 24, 3, 8, 4, 1, 13, c, [62, 5], s, [23, 3], 2, 3, 2, 24, 24, 6, s, [4, 3], 13, 7, 8, 4, 8, 13, 13, s, [7, 6], 13, 9, 7, c, [62, 3], 9, 26, 1, 26, 7, 1, 6, 3, 9, 6, 6, 26, 17, c, [88, 3], 27, 10, s, [23, 7], 4, s, [8, 3], 7, 9, 13, 26, 26, 6, 6, 1, 9, 6, 23, 27, 26, 9, 27, 9, 27, 1, 16, 1, c, [40, 3], 15, 26, 27, 27, 16, 13]),
    symbol: u([1, 2, 19, 20, 23, 25, 26, s, [28, 4, 1], 33, 34, 56, 58, 1, c, [16, 13], 59, c, [14, 13], 57, s, [60, 4, 1], 65, 66, c, [35, 14], 1, 2, 3, 7, 8, s, [13, 4, 1], 19, c, [19, 9], s, [41, 6, 1], 50, 51, 68, 2, c, [26, 6], c, [16, 8], 74, s, [76, 5, 1], 84, 2, 11, 52, 53, 54, s, [85, 4, 1], c, [9, 10], 24, 32, s, [36, 5, 1], 72, c, [90, 13], 2, 27, 32, 64, 92, c, [36, 9], c, [27, 14], c, [67, 17], c, [148, 18], 11, c, [149, 22], c, [48, 3], c, [31, 125], 1, c, [303, 25], c, [349, 5], s, [67, 4, 2], c, [296, 7], 89, 1, 19, 89, 21, c, [247, 14], 7, 21, 26, 35, c, [341, 3], 9, c, [65, 4], c, [11, 3], c, [58, 8], c, [343, 6], c, [24, 18], c, [23, 8], s, [10, 7, 1], c, [26, 9], 49, 50, 51, 83, c, [47, 8], c, [44, 8], s, [75, 6, 1], c, [70, 9], c, [23, 15], c, [456, 13], c, [17, 21], c, [104, 23], c, [23, 181], s, [47, 5, 1], 45, 48, 79, 81, 82, c, [76, 46], 11, 17, 22, c, [483, 3], c, [685, 18], 17, 22, 26, c, [24, 3], c, [8, 3], 18, c, [9, 6], c, [10, 10], c, [9, 26], c, [76, 22], c, [809, 7], 64, 92, c, [22, 14], c, [766, 15], c, [810, 25], c, [85, 22], c, [22, 24], c, [135, 4], c, [859, 17], c, [704, 26], c, [26, 26], c, [992, 10], c, [35, 26], c, [1004, 3], c, [91, 52], c, [26, 105], 2, c, [19, 3], 55, 90, 91, 2, 4, c, [1236, 14], 71, c, [1237, 8], 26, 35, c, [362, 8], c, [8, 4], c, [1316, 14], c, [947, 75], c, [798, 112], 9, 2, 7, 9, c, [5, 4], c, [146, 45], 83, 2, 45, 47, 48, 79, 82, c, [6, 4], c, [4, 8], c, [603, 14], c, [601, 6], c, [793, 9], 53, 54, c, [12, 9], c, [714, 26], c, [580, 7], c, [7, 35], c, [733, 22], c, [29, 20], c, [422, 14], c, [678, 8], c, [869, 10], c, [527, 25], 24, c, [554, 32], 91, c, [514, 3], c, [8, 4], c, [1731, 4], c, [1758, 10], c, [18, 4], c, [6, 7], c, [778, 26], 5, c, [610, 14], 70, 5, c, [65, 9], c, [840, 11], c, [37, 7], c, [63, 19], c, [241, 9], c, [606, 46], c, [23, 116], c, [540, 4], c, [1309, 10], c, [8, 13], c, [466, 14], c, [1264, 15], c, [961, 58], c, [6, 6], 24, c, [87, 11], c, [16, 4], c, [370, 15], c, [980, 8], c, [358, 27], c, [538, 27], c, [573, 10], c, [62, 25], c, [36, 36], 6, c, [1130, 16], 22, c, [575, 38], c, [204, 15], c, [299, 28], c, [222, 27], c, [607, 26], c, [150, 15], c, [408, 13]]),
    type: u([s, [2, 13], 0, 0, 1, c, [16, 14], c, [30, 15], s, [0, 5], s, [2, 41], c, [42, 16], c, [64, 12], c, [9, 18], c, [49, 19], c, [29, 3], c, [36, 17], c, [79, 14], c, [31, 27], s, [2, 177], s, [0, 17], c, [273, 19], c, [58, 27], c, [24, 23], c, [412, 39], c, [477, 24], c, [23, 20], c, [17, 34], s, [2, 198], c, [214, 55], c, [269, 76], c, [76, 23], c, [98, 47], c, [416, 15], c, [557, 25], c, [205, 95], c, [719, 30], c, [579, 164], c, [800, 25], c, [24, 8], c, [778, 41], c, [947, 68], c, [271, 130], c, [24, 28], c, [265, 31], c, [659, 15], c, [971, 139], c, [460, 10], c, [283, 68], c, [1758, 27], c, [357, 48], c, [74, 44], c, [606, 49], c, [888, 175], c, [87, 92], c, [980, 15], c, [178, 89], c, [1845, 209]]),
    state: u([s, [1, 5, 1], 13, 15, 16, 8, 9, s, [24, 4, 2], 31, 36, 37, 42, 48, 50, 51, 53, 57, c, [4, 3], 59, 64, 61, 66, c, [7, 3], 68, c, [4, 3], 70, c, [4, 3], 80, 82, 83, 78, 79, 87, 73, 74, 85, 86, c, [39, 6], 72, 89, 92, c, [7, 4], 93, c, [4, 3], 97, 99, 100, c, [19, 5], 101, c, [7, 6], 102, c, [4, 3], 103, c, [4, 3], 107, 104, 105, 110, 51, 53, c, [3, 3], 64, 116, 122, c, [65, 3], c, [12, 6], c, [3, 3], 127, 64, 129, 131, 133, 138, c, [71, 7], 144, c, [26, 3], 145, c, [73, 9], 97, 97, 107, 152, 153, 51, 53, 154, c, [38, 3], 157, 64, 116, 161, 64, 163, 164, 166, 169, 171, c, [13, 3], c, [29, 4], 64, 116, 64, 116, 179, c, [54, 7], c, [12, 4]]),
    mode: u([s, [2, 27], s, [1, 13], c, [27, 15], c, [53, 38], c, [66, 27], c, [46, 14], c, [67, 23], s, [2, 170], c, [246, 26], c, [315, 22], c, [24, 4], c, [26, 5], c, [235, 10], c, [19, 19], c, [12, 5], c, [62, 17], c, [85, 5], c, [98, 14], s, [1, 38], s, [2, 209], c, [211, 48], c, [263, 30], c, [410, 8], c, [73, 54], c, [714, 21], c, [66, 31], c, [76, 30], c, [187, 43], c, [259, 43], c, [341, 81], c, [874, 136], c, [1123, 24], c, [874, 59], c, [722, 117], c, [1075, 8], c, [145, 23], c, [23, 19], c, [538, 29], c, [29, 12], c, [1028, 92], c, [673, 39], c, [34, 8], c, [1171, 33], c, [75, 28], c, [59, 12], c, [211, 47], c, [46, 16], c, [72, 10], c, [635, 41], c, [577, 23], c, [1708, 176], c, [918, 85], c, [932, 21], c, [845, 53], c, [166, 34], c, [34, 35], c, [1278, 50], s, [2, 129]]),
    goto: u([s, [7, 13], s, [9, 13], 6, 17, 6, 7, 10, 11, 12, 14, 20, 21, 22, 18, 19, 23, s, [8, 13], 51, 25, s, [51, 25], 27, 29, 32, 34, 38, 39, 40, 33, 35, 41, s, [43, 5, 1], 49, 54, 52, 55, 56, 58, c, [5, 4], 60, s, [70, 7], s, [17, 13], 62, 63, 65, 67, c, [29, 4], s, [24, 13], 69, c, [18, 4], 71, c, [5, 4], s, [30, 13], s, [35, 31], s, [36, 31], s, [31, 31], s, [32, 31], s, [33, 31], 1, 4, 88, c, [247, 6], 84, 75, 76, 77, 81, c, [305, 5], c, [257, 8], 5, 84, 90, s, [11, 13], 73, 91, s, [73, 3], 79, 79, 32, 79, c, [47, 4], s, [79, 3], c, [40, 8], 80, 80, 32, 80, c, [19, 4], s, [80, 3], c, [19, 8], s, [82, 4], 94, 95, 96, s, [82, 13], 98, 82, 82, 75, 29, 32, 75, c, [355, 12], c, [16, 16], c, [384, 13], c, [13, 13], s, [92, 23], s, [94, 23], s, [95, 23], s, [96, 23], s, [97, 23], s, [98, 23], s, [99, 23], s, [100, 23], s, [101, 25], 44, 106, s, [109, 23], s, [110, 23], 54, 109, 108, c, [598, 3], s, [13, 13], s, [113, 8], s, [114, 3], 111, s, [114, 5], 112, s, [118, 9], s, [119, 9], s, [120, 9], s, [121, 9], 54, 109, 113, c, [73, 3], s, [15, 13], 114, 65, 115, s, [117, 4, 1], s, [18, 13], 121, s, [20, 13], s, [21, 13], 123, c, [736, 4], s, [34, 5], 54, 109, 124, c, [11, 3], s, [23, 13], 54, 109, 125, c, [19, 3], s, [26, 13], 54, 109, 126, c, [19, 3], s, [29, 13], 2, s, [38, 26], s, [39, 26], 128, s, [70, 7], s, [41, 26], 130, 65, s, [45, 26], s, [46, 26], s, [47, 26], s, [48, 26], s, [49, 26], s, [50, 26], 122, 132, 135, 136, 134, 137, 140, 139, c, [1127, 14], 143, 141, 142, c, [336, 4], s, [37, 4], 3, s, [10, 13], 77, 77, 32, 77, c, [41, 4], s, [77, 3], c, [44, 8], 78, 78, 32, 78, c, [19, 4], s, [78, 3], c, [19, 8], s, [81, 4], c, [874, 3], s, [81, 13], 98, 81, 81, s, [87, 23], s, [88, 23], s, [89, 23], s, [93, 23], s, [108, 23], 147, 146, 74, 91, 74, 149, 148, s, [90, 4], c, [145, 3], s, [90, 13], 98, 90, 90, s, [91, 4], c, [23, 3], s, [91, 13], 98, 91, 91, 151, 44, 150, 106, s, [105, 4], s, [106, 4], s, [107, 4], s, [12, 13], c, [280, 4], s, [112, 8], 155, 55, 56, s, [117, 8], s, [14, 13], s, [16, 13], s, [64, 7], s, [65, 7], s, [66, 7], s, [67, 7], s, [68, 7], s, [69, 7], s, [19, 13], 54, 109, 156, c, [106, 3], s, [134, 7], s, [22, 13], s, [25, 13], 158, s, [70, 7], 159, c, [815, 6], s, [42, 26], 160, s, [44, 26], 123, 162, c, [516, 4], 124, s, [127, 6], 65, 165, s, [70, 7], s, [131, 6], s, [132, 6], s, [52, 26], 167, s, [58, 15], 168, 170, s, [70, 7], 172, s, [70, 7], s, [63, 27], 174, 54, 109, 173, c, [228, 3], 76, 76, 32, 76, c, [577, 4], s, [76, 3], c, [577, 8], s, [83, 23], s, [85, 23], s, [84, 23], s, [86, 23], s, [102, 23], s, [103, 23], s, [104, 4], s, [111, 8], s, [115, 8], s, [116, 8], s, [133, 7], 175, c, [379, 6], s, [28, 13], s, [40, 26], s, [43, 26], s, [125, 6], s, [126, 6], 176, 177, c, [85, 6], s, [130, 6], 178, c, [926, 14], 55, 55, 180, s, [55, 24], s, [56, 26], 181, c, [81, 6], s, [62, 27], 182, c, [34, 6], s, [61, 27], 183, s, [72, 16], 184, s, [128, 6], s, [129, 6], s, [53, 26], s, [57, 15], s, [54, 26], s, [59, 27], s, [60, 27], s, [71, 16], s, [27, 13]])
  }),
  defaultActions: bda({
    idx: u([0, 2, 5, 11, 14, s, [17, 7, 1], 27, s, [36, 9, 1], 46, 47, 49, 50, s, [53, 4, 1], 58, 60, 62, s, [63, 5, 2], 72, 73, 74, 76, s, [78, 6, 1], 88, 89, 90, s, [94, 5, 1], s, [105, 4, 1], 110, s, [112, 10, 1], 123, 124, 125, 128, 130, 132, 133, 136, 137, 138, 143, s, [146, 11, 1], s, [158, 5, 1], 165, s, [168, 5, 2], s, [177, 8, 1]]),
    goto: u([7, 9, 8, 17, 24, 30, 35, 36, 31, 32, 33, 1, 11, 92, s, [94, 8, 1], 109, 110, 13, 113, s, [118, 4, 1], 15, 18, 20, 21, 34, 23, 26, 29, 2, 38, 39, 41, s, [45, 6, 1], 37, 3, 10, 87, 88, 89, 93, 108, 105, 106, 107, 12, 112, 117, 14, 16, s, [64, 6, 1], 19, 134, 22, 25, 42, 44, 124, 127, 131, 132, 52, 63, 83, 85, 84, 86, 102, 103, 104, 111, 115, 116, 133, 28, 40, 43, 125, 126, 130, 56, 62, 61, 72, 128, 129, 53, 57, 54, 59, 60, 71, 27])
  }),
  parseError: function parseError(str, hash, ExceptionClass) {
    if (hash.recoverable) {
      if (typeof this.trace === 'function') {
        this.trace(str);
      }

      hash.destroy(); // destroy... well, *almost*!
    } else {
      if (typeof this.trace === 'function') {
        this.trace(str);
      }

      if (!ExceptionClass) {
        ExceptionClass = this.JisonParserError;
      }

      throw new ExceptionClass(str, hash);
    }
  },
  parse: function parse(input) {
    var self = this;
    var stack = new Array(128); // token stack: stores token which leads to state at the same index (column storage)

    var sstack = new Array(128); // state stack: stores states (column storage)

    var vstack = new Array(128); // semantic value stack

    var lstack = new Array(128); // location stack

    var table = this.table;
    var sp = 0; // 'stack pointer': index into the stacks

    var yyloc;
    var symbol = 0;
    var preErrorSymbol = 0;
    var lastEofErrorStateDepth = Infinity;
    var recoveringErrorInfo = null;
    var recovering = 0; // (only used when the grammar contains error recovery rules)

    var TERROR = this.TERROR;
    var EOF = this.EOF;
    var ERROR_RECOVERY_TOKEN_DISCARD_COUNT = this.options.errorRecoveryTokenDiscardCount | 0 || 3;
    var NO_ACTION = [0, 185
    /* === table.length :: ensures that anyone using this new state will fail dramatically! */
    ];
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
      post_lex: undefined // WARNING: must be written this way for the code expanders to work correctly in both ES5 and ES6 modes!

    };
    var ASSERT;

    if (typeof assert !== 'function') {
      ASSERT = function JisonAssert(cond, msg) {
        if (!cond) {
          throw new Error('assertion failed: ' + (msg || '***'));
        }
      };
    } else {
      ASSERT = assert;
    }

    this.yyGetSharedState = function yyGetSharedState() {
      return sharedState_yy;
    };

    this.yyGetErrorInfoTrack = function yyGetErrorInfoTrack() {
      return recoveringErrorInfo;
    }; // shallow clone objects, straight copy of simple `src` values
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
    } // copy state


    shallow_copy_noclobber(sharedState_yy, this.yy);
    sharedState_yy.lexer = lexer;
    sharedState_yy.parser = this; // *Always* setup `yyError`, `YYRECOVERING`, `yyErrOk` and `yyClearIn` functions as it is paramount
    // to have *their* closure match ours -- if we only set them up once,
    // any subsequent `parse()` runs will fail in very obscure ways when
    // these functions are invoked in the user action code block(s) as
    // their closure will still refer to the `parse()` instance which set
    // them up. Hence we MUST set them up at the start of every `parse()` run!

    if (this.yyError) {
      this.yyError = function yyError(str
      /*, ...args */
      ) {
        var error_rule_depth = this.options.parserErrorsAreRecoverable ? locateNearestErrorRecoveryRule(state) : -1;
        var expected = this.collect_expected_token_set(state);
        var hash = this.constructParseErrorInfo(str, null, expected, error_rule_depth >= 0); // append to the old one?

        if (recoveringErrorInfo) {
          var esp = recoveringErrorInfo.info_stack_pointer;
          recoveringErrorInfo.symbol_stack[esp] = symbol;
          var v = this.shallowCopyErrorInfo(hash);
          v.yyError = true;
          v.errorRuleDepth = error_rule_depth;
          v.recovering = recovering; // v.stackSampleLength = error_rule_depth + EXTRA_STACK_SAMPLE_DEPTH;

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
        } // Add any extra args to the hash under the name `extra_error_attributes`:


        var args = Array.prototype.slice.call(arguments, 1);

        if (args.length) {
          hash.extra_error_attributes = args;
        }

        return this.parseError(str, hash, this.JisonParserError);
      };
    } // Does the shared state override the default `parseError` that already comes with this instance?


    if (typeof sharedState_yy.parseError === 'function') {
      this.parseError = function parseErrorAlt(str, hash, ExceptionClass) {
        if (!ExceptionClass) {
          ExceptionClass = this.JisonParserError;
        }

        return sharedState_yy.parseError.call(this, str, hash, ExceptionClass);
      };
    } else {
      this.parseError = this.originalParseError;
    } // Does the shared state override the default `quoteName` that already comes with this instance?


    if (typeof sharedState_yy.quoteName === 'function') {
      this.quoteName = function quoteNameAlt(id_str) {
        return sharedState_yy.quoteName.call(this, id_str);
      };
    } else {
      this.quoteName = this.originalQuoteName;
    } // set up the cleanup function; make it an API so that external code can re-use this one in case of
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
          hash = this.constructParseErrorInfo(null
          /* no error! */
          , null
          /* no exception! */
          , null, false);
        }

        if (sharedState_yy.post_parse) {
          rv = sharedState_yy.post_parse.call(this, sharedState_yy, resultValue, hash);
          if (typeof rv !== 'undefined') resultValue = rv;
        }

        if (this.post_parse) {
          rv = this.post_parse.call(this, sharedState_yy, resultValue, hash);
          if (typeof rv !== 'undefined') resultValue = rv;
        } // cleanup:


        if (hash && hash.destroy) {
          hash.destroy();
        }
      }

      if (this.__reentrant_call_depth > 1) return resultValue; // do not (yet) kill the sharedState when this is a reentrant run.
      // clean up the lingering lexer structures as well:

      if (lexer.cleanupAfterLex) {
        lexer.cleanupAfterLex(do_not_nuke_errorinfos);
      } // prevent lingering circular references from causing memory leaks:


      if (sharedState_yy) {
        sharedState_yy.lexer = undefined;
        sharedState_yy.parser = undefined;

        if (lexer.yy === sharedState_yy) {
          lexer.yy = undefined;
        }
      }

      sharedState_yy = undefined;
      this.parseError = this.originalParseError;
      this.quoteName = this.originalQuoteName; // nuke the vstack[] array at least as that one will still reference obsoleted user values.
      // To be safe, we nuke the other internal stack columns as well...

      stack.length = 0; // fastest way to nuke an array without overly bothering the GC

      sstack.length = 0;
      lstack.length = 0;
      vstack.length = 0;
      sp = 0; // nuke the error hash info instances created during this run.
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

        this.__error_recovery_infos.length = 0; // `recoveringErrorInfo` is also part of the `__error_recovery_infos` array,
        // hence has been destroyed already: no need to do that *twice*.

        if (recoveringErrorInfo) {
          recoveringErrorInfo = undefined;
        }
      }

      return resultValue;
    }; // merge yylloc info into a new yylloc instance.
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
      var rv; // rules:
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
      } // - detect if an epsilon rule is being processed and act accordingly:


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
      } // shallow-copy L1|L2, before we try to adjust the yylloc values: after all, we MAY be looking
      // at unconventional yylloc info objects...


      rv = shallow_copy(l1); // first_line: ...,
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
    }; // NOTE: as this API uses parse() as a closure, it MUST be set again on every parse() invocation,
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
      }; // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!

      this.__error_infos.push(pei);

      return pei;
    }; // clone some parts of the (possibly enhanced!) errorInfo object
    // to give them some persistence.


    this.shallowCopyErrorInfo = function parser_shallowCopyErrorInfo(p) {
      var rv = shallow_copy(p); // remove the large parts which can only cause cyclic references
      // and are otherwise available from the parser kernel anyway.

      delete rv.sharedState_yy;
      delete rv.parser;
      delete rv.lexer; // lexer.yytext MAY be a complex value object, rather than a simple string/value:

      rv.value = shallow_copy(rv.value); // yylloc info:

      rv.loc = copy_yylloc(rv.loc); // the 'expected' set won't be modified, so no need to clone it:
      //rv.expected = rv.expected.slice(0);
      //symbol stack is a simple array:

      rv.symbol_stack = rv.symbol_stack.slice(0); // ditto for state stack:

      rv.state_stack = rv.state_stack.slice(0); // clone the yylloc's in the location stack?:

      rv.location_stack = rv.location_stack.map(copy_yylloc); // and the value stack may carry both simple and complex values:
      // shallow-copy the latter.

      rv.value_stack = rv.value_stack.map(shallow_copy); // and we don't bother with the sharedState_yy reference:
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

      for (var i = rv.stack_pointer; typeof rv.state_stack[i] !== 'undefined'; i++) {// empty
      }

      rv.base_pointer = i;
      rv.info_stack_pointer = i;
      rv.root_failure_pointer = rv.stack_pointer; // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!

      this.__error_recovery_infos.push(rv);

      return rv;
    };

    function stdLex() {
      var token = lexer.lex(); // if token isn't its numeric value, convert

      if (typeof token !== 'number') {
        token = self.symbols_[token] || token;
      }

      return token || EOF;
    }

    function fastLex() {
      var token = lexer.fastLex(); // if token isn't its numeric value, convert

      if (typeof token !== 'number') {
        token = self.symbols_[token] || token;
      }

      return token || EOF;
    }

    var lex = stdLex;
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
    var retval = false; // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.

    function locateNearestErrorRecoveryRule(state) {
      var stack_probe = sp - 1;
      var depth = 0; // try to recover from error

      while (stack_probe >= 0) {
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
            if (lastEofErrorStateDepth > sp - 1 - depth) {
              lastEofErrorStateDepth = sp - 1 - depth;
            } else {
              --stack_probe; // popStack(1): [symbol, action]

              state = sstack[stack_probe];
              ++depth;
              continue;
            }
          }

          return depth;
        }

        if (state === 0
        /* $accept rule */
        || stack_probe < 1) {
          return -1; // No suitable error recovery rule available.
        }

        --stack_probe; // popStack(1): [symbol, action]

        state = sstack[stack_probe];
        ++depth;
      }

      return -1; // No suitable error recovery rule available.
    }

    try {
      this.__reentrant_call_depth++;
      lexer.setInput(input, sharedState_yy); // NOTE: we *assume* no lexer pre/post handlers are set up *after* 
      // this initial `setInput()` call: hence we can now check and decide
      // whether we'll go with the standard, slower, lex() API or the
      // `fast_lex()` one:

      if (typeof lexer.canIUse === 'function') {
        var lexerInfo = lexer.canIUse();

        if (lexerInfo.fastLex && typeof fastLex === 'function') {
          lex = fastLex;
        }
      }

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
        state = newState; // sstack[sp - 1];
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
          } // read action for current state and first input


          t = table[state] && table[state][symbol] || NO_ACTION;
          newState = t[1];
          action = t[0]; // handle parse error

          if (!action) {
            // first see if there's any chance at hitting an error recovery rule:
            var error_rule_depth = locateNearestErrorRecoveryRule(state);
            var errStr = null;
            var errSymbolDescr = this.describeSymbol(symbol) || symbol;
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

              p = this.constructParseErrorInfo(errStr, null, expected, error_rule_depth >= 0); // DO NOT cleanup the old one before we start the new error info track:
              // the old one will *linger* on the error stack and stay alive until we 
              // invoke the parser's cleanup API!

              recoveringErrorInfo = this.shallowCopyErrorInfo(p);
              r = this.parseError(p.errStr, p, this.JisonParserError);

              if (typeof r !== 'undefined') {
                retval = r;
                break;
              } // Protect against overly blunt userland `parseError` code which *sets*
              // the `recoverable` flag without properly checking first:
              // we always terminate the parse when there's no recovery rule available anyhow!


              if (!p.recoverable || error_rule_depth < 0) {
                break;
              }
            }

            var esp = recoveringErrorInfo.info_stack_pointer; // just recovered from another error

            if (recovering === ERROR_RECOVERY_TOKEN_DISCARD_COUNT && error_rule_depth >= 0) {
              // SHIFT current lookahead and grab another
              recoveringErrorInfo.symbol_stack[esp] = symbol;
              recoveringErrorInfo.value_stack[esp] = shallow_copy(lexer.yytext);
              recoveringErrorInfo.location_stack[esp] = copy_yylloc(lexer.yylloc);
              recoveringErrorInfo.state_stack[esp] = newState; // push state

              ++esp; // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:

              yyloc = lexer.yylloc;
              preErrorSymbol = 0;
              symbol = lex();
            } // try to recover from error


            if (error_rule_depth < 0) {
              ASSERT(recovering > 0, "line 897");
              recoveringErrorInfo.info_stack_pointer = esp; // barf a fatal hairball when we're out of look-ahead symbols and none hit a match
              // while we are still busy recovering from another error:

              var po = this.__error_infos[this.__error_infos.length - 1]; // Report error

              if (typeof lexer.yylineno === 'number') {
                errStr = 'Parsing halted on line ' + (lexer.yylineno + 1) + ' while starting to recover from another error';
              } else {
                errStr = 'Parsing halted while starting to recover from another error';
              }

              if (po) {
                errStr += ' -- previous error which resulted in this fatal result: ' + po.errStr;
              } else {
                errStr += ': ';
              }

              if (typeof lexer.showPosition === 'function') {
                errStr += '\n' + lexer.showPosition(79 - 10, 10) + '\n';
              }

              if (expected.length) {
                errStr += 'Expecting ' + expected.join(', ') + ', got unexpected ' + errSymbolDescr;
              } else {
                errStr += 'Unexpected ' + errSymbolDescr;
              }

              p = this.constructParseErrorInfo(errStr, null, expected, false);

              if (po) {
                p.extra_error_attributes = po;
              }

              r = this.parseError(p.errStr, p, this.JisonParserError);

              if (typeof r !== 'undefined') {
                retval = r;
              }

              break;
            }

            preErrorSymbol = symbol === TERROR ? 0 : symbol; // save the lookahead token

            symbol = TERROR; // insert generic error symbol as new lookahead

            const EXTRA_STACK_SAMPLE_DEPTH = 3; // REDUCE/COMBINE the pushed terms/tokens to a new ERROR token:

            recoveringErrorInfo.symbol_stack[esp] = preErrorSymbol;

            if (errStr) {
              recoveringErrorInfo.value_stack[esp] = {
                yytext: shallow_copy(lexer.yytext),
                errorRuleDepth: error_rule_depth,
                errStr: errStr,
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
            } // pop off stack


            sp -= yyrulelen; // and move the top entries + discarded part of the parse stacks onto the error info stack:

            for (var idx = sp - EXTRA_STACK_SAMPLE_DEPTH, top = idx + yyrulelen; idx < top; idx++, esp++) {
              recoveringErrorInfo.symbol_stack[esp] = stack[idx];
              recoveringErrorInfo.value_stack[esp] = shallow_copy(vstack[idx]);
              recoveringErrorInfo.location_stack[esp] = copy_yylloc(lstack[idx]);
              recoveringErrorInfo.state_stack[esp] = sstack[idx];
            }

            recoveringErrorInfo.symbol_stack[esp] = TERROR;
            recoveringErrorInfo.value_stack[esp] = shallow_copy(yyval.$);
            recoveringErrorInfo.location_stack[esp] = copy_yylloc(yyval._$); // goto new state = table[STATE][NONTERMINAL]

            newState = sstack[sp - 1];

            if (this.defaultActions[newState]) {
              recoveringErrorInfo.state_stack[esp] = this.defaultActions[newState];
            } else {
              t = table[newState] && table[newState][symbol] || NO_ACTION;
              recoveringErrorInfo.state_stack[esp] = t[1];
            }

            ++esp;
            recoveringErrorInfo.info_stack_pointer = esp; // allow N (default: 3) real symbols to be shifted before reporting a new error

            recovering = ERROR_RECOVERY_TOKEN_DISCARD_COUNT; // Now duplicate the standard parse machine here, at least its initial
            // couple of rounds until the TERROR symbol is **pushed onto the parse stack**,
            // as we wish to push something special then!
            //
            // Run the state machine in this copy of the parser state machine
            // until we *either* consume the error symbol (and its related information)
            // *or* we run into another error while recovering from this one
            // *or* we execute a `reduce` action which outputs a final parse
            // result (yes, that MAY happen!).
            //
            // We stay in this secondary parse loop until we have completed
            // the *error recovery phase* as the main parse loop (further below)
            // is optimized for regular parse operation and DOES NOT cope with
            // error recovery *at all*.
            //
            // We call the secondary parse loop just below the "slow parse loop",
            // while the main parse loop, which is an almost-duplicate of this one,
            // yet optimized for regular parse operation, is called the "fast
            // parse loop".
            //
            // Compare this to `bison` & (vanilla) `jison`, both of which have
            // only a single parse loop, which handles everything. Our goal is
            // to eke out every drop of performance in the main parse loop...

            ASSERT(recoveringErrorInfo, "line 1049");
            ASSERT(symbol === TERROR, "line 1050");
            ASSERT(!action, "line 1051");
            var errorSymbolFromParser = true;

            for (;;) {
              // retrieve state number from top of stack
              state = newState; // sstack[sp - 1];
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
                  symbol = lex(); // **Warning: Edge Case**: the *lexer* may produce
                  // TERROR tokens of its own volition: *those* TERROR
                  // tokens should be treated like *regular tokens*
                  // i.e. tokens which have a lexer-provided `yyvalue`
                  // and `yylloc`:

                  errorSymbolFromParser = false;
                } // read action for current state and first input


                t = table[state] && table[state][symbol] || NO_ACTION;
                newState = t[1];
                action = t[0]; // encountered another parse error? If so, break out to main loop
                // and take it from there!

                if (!action) {
                  ASSERT(recoveringErrorInfo, "line 1087"); // Prep state variables so that upon breaking out of
                  // this "slow parse loop" and hitting the `continue;`
                  // statement in the outer "fast parse loop" we redo
                  // the exact same state table lookup as the one above
                  // so that the outer=main loop will also correctly
                  // detect the 'parse error' state (`!action`) we have
                  // just encountered above.

                  newState = state;
                  break;
                }
              }

              switch (action) {
                // catch misc. parse failures:
                default:
                  // this shouldn't happen, unless resolve defaults are off
                  //
                  // SILENTLY SIGNAL that the outer "fast parse loop" should
                  // take care of this internal error condition:
                  // prevent useless code duplication now/here.
                  break;
                // shift:

                case 1:
                  stack[sp] = symbol; // ### Note/Warning ###
                  //
                  // The *lexer* may also produce TERROR tokens on its own,
                  // so we specifically test for the TERROR we did set up
                  // in the error recovery logic further above!

                  if (symbol === TERROR && errorSymbolFromParser) {
                    // Push a special value onto the stack when we're
                    // shifting the `error` symbol that is related to the
                    // error we're recovering from.
                    ASSERT(recoveringErrorInfo, "line 1131");
                    vstack[sp] = recoveringErrorInfo;
                    lstack[sp] = this.yyMergeLocationInfo(null, null, recoveringErrorInfo.loc, lexer.yylloc, true);
                  } else {
                    ASSERT(symbol !== 0, "line 1135");
                    ASSERT(preErrorSymbol === 0, "line 1136");
                    vstack[sp] = lexer.yytext;
                    lstack[sp] = copy_yylloc(lexer.yylloc);
                  }

                  sstack[sp] = newState; // push state

                  ++sp;
                  symbol = 0; // **Warning: Edge Case**: the *lexer* may have produced
                  // TERROR tokens of its own volition: *those* TERROR
                  // tokens should be treated like *regular tokens*
                  // i.e. tokens which have a lexer-provided `yyvalue`
                  // and `yylloc`:

                  errorSymbolFromParser = false;

                  if (!preErrorSymbol) {
                    // normal execution / no error
                    // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:
                    yyloc = lexer.yylloc;

                    if (recovering > 0) {
                      recovering--;
                    }
                  } else {
                    // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                    ASSERT(recovering > 0, "line 1163");
                    symbol = preErrorSymbol;
                    preErrorSymbol = 0; // read action for current state and first input

                    t = table[newState] && table[newState][symbol] || NO_ACTION;

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
                  } // once we have pushed the special ERROR token value,
                  // we REMAIN in this inner, "slow parse loop" until
                  // the entire error recovery phase has completed.
                  //
                  // ### Note About Edge Case ###
                  //
                  // Userland action code MAY already have 'reset' the
                  // error recovery phase marker `recovering` to ZERO(0)
                  // while the error symbol hasn't been shifted onto
                  // the stack yet. Hence we only exit this "slow parse loop"
                  // when *both* conditions are met!


                  ASSERT(preErrorSymbol === 0, "line 1194");

                  if (recovering === 0) {
                    break;
                  }

                  continue;
                // reduce:

                case 2:
                  this_production = this.productions_[newState - 1]; // `this.productions_[]` is zero-based indexed while states start from 1 upwards...

                  yyrulelen = this_production[1];
                  r = this.performAction.call(yyval, yyloc, newState, sp - 1, vstack, lstack);

                  if (typeof r !== 'undefined') {
                    // signal end of error recovery loop AND end of outer parse loop
                    action = 3;
                    sp = -2; // magic number: signal outer "fast parse loop" ACCEPT state that we already have a properly set up `retval` parser return value.

                    retval = r;
                    break;
                  } // pop off stack


                  sp -= yyrulelen; // don't overwrite the `symbol` variable: use a local var to speed things up:

                  var ntsymbol = this_production[0]; // push nonterminal (reduce)

                  stack[sp] = ntsymbol;
                  vstack[sp] = yyval.$;
                  lstack[sp] = yyval._$; // goto new state = table[STATE][NONTERMINAL]

                  newState = table[sstack[sp - 1]][ntsymbol];
                  sstack[sp] = newState;
                  ++sp;
                  continue;
                // accept:

                case 3:
                  retval = true; // Return the `$accept` rule's `$$` result, if available.
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

                  if (sp >= 0 && typeof vstack[sp] !== 'undefined') {
                    retval = vstack[sp];
                  }

                  sp = -2; // magic number: signal outer "fast parse loop" ACCEPT state that we already have a properly set up `retval` parser return value.

                  break;
              } // break out of loop: we accept or fail with error


              break;
            } // should we also break out of the regular/outer parse loop,
            // i.e. did the parser already produce a parse result in here?!
            // *or* did we hit an unsupported parse state, to be handled
            // in the `switch/default` code further below?


            ASSERT(action !== 2, "line 1272");

            if (!action || action === 1) {
              continue;
            }
          }
        }

        switch (action) {
          // catch misc. parse failures:
          default:
            // this shouldn't happen, unless resolve defaults are off
            if (action instanceof Array) {
              p = this.constructParseErrorInfo('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol, null, null, false);
              r = this.parseError(p.errStr, p, this.JisonParserError);

              if (typeof r !== 'undefined') {
                retval = r;
              }

              break;
            } // Another case of better safe than sorry: in case state transitions come out of another error recovery process
            // or a buggy LUT (LookUp Table):


            p = this.constructParseErrorInfo('Parsing halted. No viable error recovery approach available due to internal system failure.', null, null, false);
            r = this.parseError(p.errStr, p, this.JisonParserError);

            if (typeof r !== 'undefined') {
              retval = r;
            }

            break;
          // shift:

          case 1:
            stack[sp] = symbol;
            vstack[sp] = lexer.yytext;
            lstack[sp] = copy_yylloc(lexer.yylloc);
            sstack[sp] = newState; // push state

            ++sp;
            symbol = 0;
            ASSERT(preErrorSymbol === 0, "line 1352"); // normal execution / no error

            ASSERT(recovering === 0, "line 1353"); // normal execution / no error
            // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:

            yyloc = lexer.yylloc;
            continue;
          // reduce:

          case 2:
            ASSERT(preErrorSymbol === 0, "line 1364"); // normal execution / no error

            ASSERT(recovering === 0, "line 1365"); // normal execution / no error

            this_production = this.productions_[newState - 1]; // `this.productions_[]` is zero-based indexed while states start from 1 upwards...

            yyrulelen = this_production[1];
            r = this.performAction.call(yyval, yyloc, newState, sp - 1, vstack, lstack);

            if (typeof r !== 'undefined') {
              retval = r;
              break;
            } // pop off stack


            sp -= yyrulelen; // don't overwrite the `symbol` variable: use a local var to speed things up:

            var ntsymbol = this_production[0]; // push nonterminal (reduce)

            stack[sp] = ntsymbol;
            vstack[sp] = yyval.$;
            lstack[sp] = yyval._$; // goto new state = table[STATE][NONTERMINAL]

            newState = table[sstack[sp - 1]][ntsymbol];
            sstack[sp] = newState;
            ++sp;
            continue;
          // accept:

          case 3:
            if (sp !== -2) {
              retval = true; // Return the `$accept` rule's `$$` result, if available.
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
            }

            break;
        } // break out of loop: we accept or fail with error


        break;
      }
    } catch (ex) {
      // report exceptions through the parseError callback too, but keep the exception intact
      // if it is a known parser or lexer error which has been thrown by parseError() already:
      if (ex instanceof this.JisonParserError) {
        throw ex;
      } else if (lexer && typeof lexer.JisonLexerError === 'function' && ex instanceof lexer.JisonLexerError) {
        throw ex;
      }

      p = this.constructParseErrorInfo('Parsing aborted due to exception.', ex, null, false);
      retval = false;
      r = this.parseError(p.errStr, p, this.JisonParserError);

      if (typeof r !== 'undefined') {
        retval = r;
      }
    } finally {
      retval = this.cleanupAfterParse(retval, true, true);
      this.__reentrant_call_depth--;
    } // /finally


    return retval;
  },
  yyError: 1
};
parser$1.originalParseError = parser$1.parseError;
parser$1.originalQuoteName = parser$1.quoteName;
/* lexer generated by jison-lex 0.6.1-216 */

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

var lexer = function () {
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
    __currentRuleSet__: null,
    /// INTERNAL USE ONLY: internal rule set cache for the current lexer state  
    __error_infos: [],
    /// INTERNAL USE ONLY: the set of lexErrorInfo objects created since the last cleanup  
    __decompressed: false,
    /// INTERNAL USE ONLY: mark whether the lexer instance has been 'unfolded' completely and is now ready for use  
    done: false,
    /// INTERNAL USE ONLY  
    _backtrack: false,
    /// INTERNAL USE ONLY  
    _input: '',
    /// INTERNAL USE ONLY  
    _more: false,
    /// INTERNAL USE ONLY  
    _signaled_error_token: false,
    /// INTERNAL USE ONLY  
    conditionStack: [],
    /// INTERNAL USE ONLY; managed via `pushState()`, `popState()`, `topState()` and `stateStackSize()`  
    match: '',
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction. `match` is identical to `yytext` except that this one still contains the matched input string after `lexer.performAction()` has been invoked, where userland code MAY have changed/replaced the `yytext` value entirely!  
    matched: '',
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks entire input which has been matched so far  
    matches: false,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks RE match result for last (successful) match attempt  
    yytext: '',
    /// ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction; this value is transferred to the parser as the 'token value' when the parser consumes the lexer token produced through a call to the `lex()` API.  
    offset: 0,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks the 'cursor position' in the input string, i.e. the number of characters matched so far. (**WARNING:** this value MAY be negative if you `unput()` more text than you have already lexed. This type of behaviour is generally observed for one kind of 'lexer/parser hack' where custom token-illiciting characters are pushed in front of the input stream to help simulate multiple-START-points in the parser. When this happens, `base_position` will be adjusted to help track the original input's starting point in the `_input` buffer.)  
    base_position: 0,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: index to the original starting point of the input; always ZERO(0) unless `unput()` has pushed content before the input: see the `offset` **WARNING** just above.  
    yyleng: 0,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: length of matched input for the token under construction (`yytext`)  
    yylineno: 0,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: 'line number' at which the token under construction is located  
    yylloc: null,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks location info (lines + columns) for the token under construction  
    CRLF_Re: /\r\n?|\n/,
    /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: regex used to split lines while tracking the lexer cursor position.  

    /**
     * INTERNAL USE: construct a suitable error info hash object instance for `parseError`.
     * 
     * @public
     * @this {RegExpLexer}
     */
    constructLexErrorInfo: function lexer_constructLexErrorInfo(msg, recoverable, show_input_position) {
      msg = '' + msg; // heuristic to determine if the error message already contains a (partial) source code dump
      // as produced by either `showPosition()` or `prettyPrintRange()`:

      if (show_input_position == undefined) {
        show_input_position = !(msg.indexOf('\n') > 0 && msg.indexOf('^') > 0);
      }

      if (this.yylloc && show_input_position) {
        if (typeof this.prettyPrintRange === 'function') {
          var pretty_src = this.prettyPrintRange(this.yylloc);

          if (!/\n\s*$/.test(msg)) {
            msg += '\n';
          }

          msg += '\n  Erroneous area:\n' + this.prettyPrintRange(this.yylloc);
        } else if (typeof this.showPosition === 'function') {
          var pos_str = this.showPosition();

          if (pos_str) {
            if (msg.length && msg[msg.length - 1] !== '\n' && pos_str[0] !== '\n') {
              msg += '\n' + pos_str;
            } else {
              msg += pos_str;
            }
          }
        }
      }
      /** @constructor */


      var pei = {
        errStr: msg,
        recoverable: !!recoverable,
        text: this.match,
        // This one MAY be empty; userland code should use the `upcomingInput` API to obtain more text which follows the 'lexer cursor position'...  
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
      }; // track this instance so we can `destroy()` it once we deem it superfluous and ready for garbage collection!

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
    yyerror: function yyError(str
    /*, ...args */
    ) {
      var lineno_msg = '';

      if (this.yylloc) {
        lineno_msg = ' on line ' + (this.yylineno + 1);
      }

      var p = this.constructLexErrorInfo('Lexical error' + lineno_msg + ': ' + str, this.options.lexerErrorsAreRecoverable); // Add any extra args to the hash under the name `extra_error_attributes`:

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
      this.setInput('', {}); // nuke the error hash info instances created during this run.
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
      this.match = ''; // - DO NOT reset `this.matched`

      this.matches = false;
      this._more = false;
      this._backtrack = false;
      var col = this.yylloc ? this.yylloc.last_column : 0;
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
      this.yy = yy || this.yy || {}; // also check if we've fully initialized the lexer instance,
      // including expansion work to be done to go from a loaded
      // lexer to a usable lexer:

      if (!this.__decompressed) {
        // step 1: decompress the regex list:
        var rules = this.rules;

        for (var i = 0, len = rules.length; i < len; i++) {
          var rule_re = rules[i]; // compression: is the RE an xref to another RE slot in the rules[] table?

          if (typeof rule_re === 'number') {
            rules[i] = rules[rule_re];
          }
        } // step 2: unfold the conditions[] set to make these ready for use:


        var conditions = this.conditions;

        for (var k in conditions) {
          var spec = conditions[k];
          var rule_ids = spec.rules;
          var len = rule_ids.length;
          var rule_regexes = new Array(len + 1); // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in `lexer_next()` fast and simple! 

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
      this.base_position = 0;
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
        } // else: keep `this._input` as is.  

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
      this.matched += ch; // Count the linenumber up when we hit the LF (or a stand-alone CR).
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
      var lines = ch.split(this.CRLF_Re);
      this._input = ch + this._input;
      this.yytext = this.yytext.substr(0, this.yytext.length - len);
      this.yyleng = this.yytext.length;
      this.offset -= len; // **WARNING:** 
      // The `offset` value MAY be negative if you `unput()` more text than you have already lexed. 
      // This type of behaviour is generally observed for one kind of 'lexer/parser hack' 
      // where custom token-illiciting characters are pushed in front of the input stream to help 
      // simulate multiple-START-points in the parser. 
      // When this happens, `base_position` will be adjusted to help track the original input's 
      // starting point in the `_input` buffer.

      if (-this.offset > this.base_position) {
        this.base_position = -this.offset;
      }

      this.match = this.match.substr(0, this.match.length - len);
      this.matched = this.matched.substr(0, this.matched.length - len);

      if (lines.length > 1) {
        this.yylineno -= lines.length - 1;
        this.yylloc.last_line = this.yylineno + 1; // Get last entirely matched line into the `pre_lines[]` array's
        // last index slot; we don't mind when other previously 
        // matched lines end up in the array too. 

        var pre = this.match;
        var pre_lines = pre.split(this.CRLF_Re);

        if (pre_lines.length === 1) {
          pre = this.matched;
          pre_lines = pre.split(this.CRLF_Re);
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
     * return the upcoming input *which has not been lexed yet*.
     * This can, for example, be used for custom look-ahead inspection code 
     * in your lexer.
     * 
     * The entire pending input string is returned.
     *
     * > ### NOTE ###
     * >
     * > When augmenting error reports and alike, you might want to
     * > look at the `upcomingInput()` API instead, which offers more
     * > features for limited input extraction and which includes the
     * > part of the input which has been lexed by the last token a.k.a.
     * > the *currently lexed* input.
     * > 
     * 
     * @public
     * @this {RegExpLexer}
     */
    lookAhead: function lexer_lookAhead() {
      return this._input || '';
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

        if (this.yylloc) {
          lineno_msg = ' on line ' + (this.yylineno + 1);
        }

        var p = this.constructLexErrorInfo('Lexical error' + lineno_msg + ': You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).', false);
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
     * A negative `maxSize` limit value equals *unlimited*, i.e. 
     * produce the entire input that has already been lexed.
     * 
     * A negative `maxLines` limit value equals *unlimited*, i.e. limit the result
     * to the `maxSize` specified number of characters *only*.
     * 
     * @public
     * @this {RegExpLexer}
     */
    pastInput: function lexer_pastInput(maxSize, maxLines) {
      var past = this.matched.substring(0, this.matched.length - this.match.length);
      if (maxSize < 0) maxSize = past.length;else if (!maxSize) maxSize = 20;
      if (maxLines < 0) maxLines = past.length; // can't ever have more input lines than this! 
      else if (!maxLines) maxLines = 1; // `substr` anticipation: treat \r\n as a single character and take a little
      // more than necessary so that we can still properly check against maxSize
      // after we've transformed and limited the newLines in here:

      past = past.substr(-maxSize * 2 - 2); // now that we have a significantly reduced string to process, transform the newlines
      // and chop them, then limit them:

      var a = past.split(this.CRLF_Re);
      a = a.slice(-maxLines);
      past = a.join('\n'); // When, after limiting to maxLines, we still have too much to return,
      // do add an ellipsis prefix...

      if (past.length > maxSize) {
        past = '...' + past.substr(-maxSize);
      }

      return past;
    },

    /**
     * return (part of the) upcoming input *including* the input 
     * matched by the last token (see also the NOTE below). 
     * This can be used to augment error messages, for example.
     * 
     * Limit the returned string length to `maxSize` (default: 20).
     * 
     * Limit the returned string to the `maxLines` number of lines of input (default: 1).
     * 
     * A negative `maxSize` limit value equals *unlimited*, i.e. 
     * produce the entire input that is yet to be lexed.
     * 
     * A negative `maxLines` limit value equals *unlimited*, i.e. limit the result
     * to the `maxSize` specified number of characters *only*.
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
     * > When you want access to the 'upcoming input' in that you want access
     * > to the input *which has not been lexed yet* for look-ahead
     * > inspection or likewise purposes, please consider using the
     * > `lookAhead()` API instead.
     * > 
     * 
     * @public
     * @this {RegExpLexer}
     */
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
      var next = this.match;
      var source = this._input || '';
      if (maxSize < 0) maxSize = next.length + source.length;else if (!maxSize) maxSize = 20;
      if (maxLines < 0) maxLines = maxSize; // can't ever have more input lines than this! 
      else if (!maxLines) maxLines = 1; // `substring` anticipation: treat \r\n as a single character and take a little
      // more than necessary so that we can still properly check against maxSize
      // after we've transformed and limited the newLines in here:

      if (next.length < maxSize * 2 + 2) {
        next += source.substring(0, maxSize * 2 + 2 - next.length); // substring is faster on Chrome/V8 
      } // now that we have a significantly reduced string to process, transform the newlines
      // and chop them, then limit them:


      var a = next.split(this.CRLF_Re, maxLines + 1); // stop splitting once we have reached just beyond the reuired number of lines. 

      a = a.slice(0, maxLines);
      next = a.join('\n'); // When, after limiting to maxLines, we still have too much to return,
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
     * return an YYLLOC info object derived off the given context (actual, preceding, following, current).
     * Use this method when the given `actual` location is not guaranteed to exist (i.e. when
     * it MAY be NULL) and you MUST have a valid location info object anyway:
     * then we take the given context of the `preceding` and `following` locations, IFF those are available,
     * and reconstruct the `actual` location info from those.
     * If this fails, the heuristic is to take the `current` location, IFF available.
     * If this fails as well, we assume the sought location is at/around the current lexer position
     * and then produce that one as a response. DO NOTE that these heuristic/derived location info
     * values MAY be inaccurate!
     *
     * NOTE: `deriveLocationInfo()` ALWAYS produces a location info object *copy* of `actual`, not just
     * a *reference* hence all input location objects can be assumed to be 'constant' (function has no side-effects).
     * 
     * @public
     * @this {RegExpLexer}
     */
    deriveLocationInfo: function lexer_deriveYYLLOC(actual, preceding, following, current) {
      var loc = {
        first_line: 1,
        first_column: 0,
        last_line: 1,
        last_column: 0,
        range: [0, 0]
      };

      if (actual) {
        loc.first_line = actual.first_line | 0;
        loc.last_line = actual.last_line | 0;
        loc.first_column = actual.first_column | 0;
        loc.last_column = actual.last_column | 0;

        if (actual.range) {
          loc.range[0] = actual.range[0] | 0;
          loc.range[1] = actual.range[1] | 0;
        }
      }

      if (loc.first_line <= 0 || loc.last_line < loc.first_line) {
        // plan B: heuristic using preceding and following:
        if (loc.first_line <= 0 && preceding) {
          loc.first_line = preceding.last_line | 0;
          loc.first_column = preceding.last_column | 0;

          if (preceding.range) {
            loc.range[0] = actual.range[1] | 0;
          }
        }

        if ((loc.last_line <= 0 || loc.last_line < loc.first_line) && following) {
          loc.last_line = following.first_line | 0;
          loc.last_column = following.first_column | 0;

          if (following.range) {
            loc.range[1] = actual.range[0] | 0;
          }
        } // plan C?: see if the 'current' location is useful/sane too:


        if (loc.first_line <= 0 && current && (loc.last_line <= 0 || current.last_line <= loc.last_line)) {
          loc.first_line = current.first_line | 0;
          loc.first_column = current.first_column | 0;

          if (current.range) {
            loc.range[0] = current.range[0] | 0;
          }
        }

        if (loc.last_line <= 0 && current && (loc.first_line <= 0 || current.first_line >= loc.first_line)) {
          loc.last_line = current.last_line | 0;
          loc.last_column = current.last_column | 0;

          if (current.range) {
            loc.range[1] = current.range[1] | 0;
          }
        }
      } // sanitize: fix last_line BEFORE we fix first_line as we use the 'raw' value of the latter
      // or plan D heuristics to produce a 'sensible' last_line value:


      if (loc.last_line <= 0) {
        if (loc.first_line <= 0) {
          loc.first_line = this.yylloc.first_line;
          loc.last_line = this.yylloc.last_line;
          loc.first_column = this.yylloc.first_column;
          loc.last_column = this.yylloc.last_column;
          loc.range[0] = this.yylloc.range[0];
          loc.range[1] = this.yylloc.range[1];
        } else {
          loc.last_line = this.yylloc.last_line;
          loc.last_column = this.yylloc.last_column;
          loc.range[1] = this.yylloc.range[1];
        }
      }

      if (loc.first_line <= 0) {
        loc.first_line = loc.last_line;
        loc.first_column = 0; // loc.last_column; 

        loc.range[1] = loc.range[0];
      }

      if (loc.first_column < 0) {
        loc.first_column = 0;
      }

      if (loc.last_column < 0) {
        loc.last_column = loc.first_column > 0 ? loc.first_column : 80;
      }

      return loc;
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
      loc = this.deriveLocationInfo(loc, context_loc, context_loc2);
      const CONTEXT = 3;
      const CONTEXT_TAIL = 1;
      const MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT = 2;
      var input = this.matched + (this._input || '');
      var lines = input.split('\n');
      var l0 = Math.max(1, context_loc ? context_loc.first_line : loc.first_line - CONTEXT);
      var l1 = Math.max(1, context_loc2 ? context_loc2.last_line : loc.last_line + CONTEXT_TAIL);
      var lineno_display_width = 1 + Math.log10(l1 | 1) | 0;
      var ws_prefix = new Array(lineno_display_width).join(' ');
      var nonempty_line_indexes = [[], [], []];
      var rv = lines.slice(l0 - 1, l1 + 1).map(function injectLineNumber(line, index) {
        var lno = index + l0;
        var lno_pfx = (ws_prefix + lno).substr(-lineno_display_width);
        var rv = lno_pfx + ': ' + line;
        var errpfx = new Array(lineno_display_width + 1).join('^');
        var offset = 2 + 1;
        var len = 0;

        if (lno === loc.first_line) {
          offset += loc.first_column;
          len = Math.max(2, (lno === loc.last_line ? loc.last_column : line.length) - loc.first_column + 1);
        } else if (lno === loc.last_line) {
          len = Math.max(2, loc.last_column + 1);
        } else if (lno > loc.first_line && lno < loc.last_line) {
          len = Math.max(2, line.length + 1);
        }

        var nli;

        if (len) {
          var lead = new Array(offset).join('.');
          var mark = new Array(len).join('^');
          rv += '\n' + errpfx + lead + mark;
          nli = 1;
        } else if (lno < loc.first_line) {
          nli = 0;
        } else if (lno > loc.last_line) {
          nli = 2;
        }

        if (line.trim().length > 0) {
          nonempty_line_indexes[nli].push(index);
        }

        rv = rv.replace(/\t/g, ' ');
        return rv;
      }); // now make sure we don't print an overly large amount of lead/error/tail area: limit it 
      // to the top and bottom line count:

      for (var i = 0; i <= 2; i++) {
        var line_arr = nonempty_line_indexes[i];

        if (line_arr.length > 2 * MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT) {
          var clip_start = line_arr[MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT - 1] + 1;
          var clip_end = line_arr[line_arr.length - MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT] - 1;
          var intermediate_line = new Array(lineno_display_width + 1).join(' ') + '  (...continued...)';

          if (i === 1) {
            intermediate_line += '\n' + new Array(lineno_display_width + 1).join('-') + '  (---------------)';
          }

          rv.splice(clip_start, clip_end - clip_start + 1, intermediate_line);
        }
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
      match_str_len = match_str.length; // if (match_str.indexOf('\n') !== -1 || match_str.indexOf('\r') !== -1) {

      lines = match_str.split(this.CRLF_Re);

      if (lines.length > 1) {
        this.yylineno += lines.length - 1;
        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = lines[lines.length - 1].length;
      } else {
        this.yylloc.last_column += match_str_len;
      } // }


      this.yytext += match_str;
      this.match += match_str;
      this.matched += match_str;
      this.matches = match;
      this.yyleng = this.yytext.length;
      this.yylloc.range[1] += match_str_len; // previous lex rules MAY have invoked the `more()` API rather than producing a token:
      // those rules will already have moved this `offset` forward matching their match lengths,
      // hence we must only add our own match length now:

      this.offset += match_str_len;
      this._more = false;
      this._backtrack = false;
      this._input = this._input.slice(match_str_len); // calling this method:
      //
      //   function lexer__performAction(yy, yyrulenumber, YY_START) {...}

      token = this.performAction.call(this, this.yy, indexed_rule, this.conditionStack[this.conditionStack.length - 1]
      /* = YY_START */
      ); // otherwise, when the action codes are all simple return token statements:
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
        return false; // rule action called reject() implying the next rule should be tested instead. 
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
        spec = this.__currentRuleSet__ = this._currentRules(); // Check whether a *sane* condition has been pushed before: this makes the lexer robust against
        // user-programmer bugs such as https://github.com/zaach/jison-lex/issues/19

        if (!spec || !spec.rules) {
          var lineno_msg = '';

          if (this.options.trackPosition) {
            lineno_msg = ' on line ' + (this.yylineno + 1);
          }

          var p = this.constructLexErrorInfo('Internal lexer engine error' + lineno_msg + ': The lex grammar programmer pushed a non-existing condition name "' + this.topState() + '"; this is a fatal error and should be reported to the application programmer team!', false); // produce one 'error' token until this situation has been resolved, most probably by parse termination!

          return this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;
        }
      }

      var rule_ids = spec.rules;
      var regexes = spec.__rule_regexes;
      var len = spec.__rule_count; // Note: the arrays are 1-based, while `len` itself is a valid index,
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
              continue; // rule action called reject() implying a rule MISmatch. 
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
        } // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)


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

        var p = this.constructLexErrorInfo('Lexical error' + lineno_msg + ': Unrecognized text.', this.options.lexerErrorsAreRecoverable);
        var pendingInput = this._input;
        var activeCondition = this.topState();
        var conditionStackDepth = this.conditionStack.length;
        token = this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR;

        if (token === this.ERROR) {
          // we can try to recover from a lexer error that `parseError()` did not 'recover' for us
          // by moving forward at least one character at a time IFF the (user-specified?) `parseError()`
          // has not consumed/modified any pending input or changed state in the error handler:
          if (!this.matches && // and make sure the input has been modified/consumed ...
          pendingInput === this._input && // ...or the lexer state has been modified significantly enough
          // to merit a non-consuming error handling action right now.
          activeCondition === this.topState() && conditionStackDepth === this.conditionStack.length) {
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
      var r; // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:

      if (typeof this.pre_lex === 'function') {
        r = this.pre_lex.call(this, 0);
      }

      if (typeof this.options.pre_lex === 'function') {
        // (also account for a userdef function which does not return any value: keep the token as is)
        r = this.options.pre_lex.call(this, r) || r;
      }

      if (this.yy && typeof this.yy.pre_lex === 'function') {
        // (also account for a userdef function which does not return any value: keep the token as is)
        r = this.yy.pre_lex.call(this, r) || r;
      }

      while (!r) {
        r = this.next();
      }

      if (this.yy && typeof this.yy.post_lex === 'function') {
        // (also account for a userdef function which does not return any value: keep the token as is)
        r = this.yy.post_lex.call(this, r) || r;
      }

      if (typeof this.options.post_lex === 'function') {
        // (also account for a userdef function which does not return any value: keep the token as is)
        r = this.options.post_lex.call(this, r) || r;
      }

      if (typeof this.post_lex === 'function') {
        // (also account for a userdef function which does not return any value: keep the token as is)
        r = this.post_lex.call(this, r) || r;
      }

      return r;
    },

    /**
     * return next match that has a token. Identical to the `lex()` API but does not invoke any of the 
     * `pre_lex()` nor any of the `post_lex()` callbacks.
     * 
     * @public
     * @this {RegExpLexer}
     */
    fastLex: function lexer_fastLex() {
      var r;

      while (!r) {
        r = this.next();
      }

      return r;
    },

    /**
     * return info about the lexer state that can help a parser or other lexer API user to use the
     * most efficient means available. This API is provided to aid run-time performance for larger
     * systems which employ this lexer.
     * 
     * @public
     * @this {RegExpLexer}
     */
    canIUse: function lexer_canIUse() {
      var rv = {
        fastLex: !(typeof this.pre_lex === 'function' || typeof this.options.pre_lex === 'function' || this.yy && typeof this.yy.pre_lex === 'function' || this.yy && typeof this.yy.post_lex === 'function' || typeof this.options.post_lex === 'function' || typeof this.post_lex === 'function') && typeof this.fastLex === 'function'
      };
      return rv;
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
      var n = this.conditionStack.length - 1;
      var state;

      if (n >= 0) {
        state = this.conditionStack[n];
      } else {
        state = 'INITIAL';
      }

      return this.conditions[state] || this.conditions['INITIAL'];
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
      easy_keyword_rules: true
    },
    JisonLexerError: JisonLexerError,
    performAction: function lexer__performAction(yy, yyrulenumber, YY_START) {
      var yy_ = this;

      switch (yyrulenumber) {
        case 0:
          /*! Conditions:: INITIAL macro options rules */

          /*! Rule::       \/\/[^\r\n]* */

          /* skip single-line comment */
          break;

        case 1:
          /*! Conditions:: INITIAL macro options rules */

          /*! Rule::       \/\*[^]*?\*\/ */

          /* skip multi-line comment */
          break;

        case 2:
          /*! Conditions:: action */

          /*! Rule::       %\{([^]*?)%\}(?!\}) */
          yy_.yytext = this.matches[1];
          yy.include_command_allowed = false;
          return 36;
          break;

        case 3:
          /*! Conditions:: action */

          /*! Rule::       %include\b */
          if (yy.include_command_allowed) {
            // This is an include instruction in place of (part of) an action:
            this.pushState('options');
            return 32;
          } else {
            // TODO
            yy_.yyerror(rmCommonWS`
                                                %include statements must occur on a line on their own and cannot occur inside an action code block.
                                                Its use is not permitted at this position.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
            return 37;
          }

          break;

        case 4:
          /*! Conditions:: action */

          /*! Rule::       \/\*[^]*?\*\/ */
          //yy.include_command_allowed = false; -- doesn't impact include-allowed state
          return 36;
          break;

        case 5:
          /*! Conditions:: action */

          /*! Rule::       \/\/.* */
          yy.include_command_allowed = false;
          return 36;
          break;

        case 6:
          /*! Conditions:: action */

          /*! Rule::       \| */
          if (yy.depth === 0) {
            this.popState();
            this.unput(yy_.yytext); // yy_.yytext = '';    --- ommitted as this is the side-effect of .unput(yy_.yytext) already!

            return 24;
          } else {
            return 36;
          }

          break;

        case 7:
          /*! Conditions:: action */

          /*! Rule::       %% */
          if (yy.depth === 0) {
            this.popState();
            this.unput(yy_.yytext); // yy_.yytext = '';    --- ommitted as this is the side-effect of .unput(yy_.yytext) already!

            return 24;
          } else {
            return 36;
          }

          break;

        case 8:
          /*! Conditions:: action */

          /*! Rule::       \/(?=\s) */
          return 36; // most probably a `/` divide operator.  

          break;

        case 9:
          /*! Conditions:: action */

          /*! Rule::       \/.* */
          yy.include_command_allowed = false;
          var l = scanRegExp(yy_.yytext);

          if (l > 0) {
            this.unput(yy_.yytext.substring(l));
            yy_.yytext = yy_.yytext.substring(0, l);
          } else {
            // assume it's a division operator:
            this.unput(yy_.yytext.substring(1));
            yy_.yytext = yy_.yytext[0];
          }

          return 36;
          break;

        case 10:
          /*! Conditions:: action */

          /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}"|'{QUOTED_STRING_CONTENT}'|`{ES2017_STRING_CONTENT}` */
          yy.include_command_allowed = false;
          return 36;
          break;

        case 11:
          /*! Conditions:: action */

          /*! Rule::       [^/"'`%\{\}\/{BR}]+ */
          yy.include_command_allowed = false;
          return 36;
          break;

        case 12:
          /*! Conditions:: action */

          /*! Rule::       % */
          yy.include_command_allowed = false;
          return 36;
          break;

        case 13:
          /*! Conditions:: action */

          /*! Rule::       \{ */
          yy.depth++;
          yy.include_command_allowed = false;
          return 36;
          break;

        case 14:
          /*! Conditions:: action */

          /*! Rule::       \} */
          yy.include_command_allowed = false;

          if (yy.depth <= 0) {
            yy_.yyerror(rmCommonWS`
                                                too many closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
            return 39;
          } else {
            yy.depth--;
          }

          return 36;
          break;

        case 15:
          /*! Conditions:: action */

          /*! Rule::       (?:[\s\r\n]*?){BR}+{WS}+ */
          yy.include_command_allowed = true;
          return 36; // keep empty lines as-is inside action code blocks.  

          break;

        case 17:
          /*! Conditions:: action */

          /*! Rule::       {BR} */
          if (yy.depth > 0) {
            yy.include_command_allowed = true;
            return 36; // keep empty lines as-is inside action code blocks. 
          } else {
            // end of action code chunk; allow parent mode to see this mode-terminating linebreak too.
            this.popState();
            this.unput(yy_.yytext); // yy_.yytext = '';    --- ommitted as this is the side-effect of .unput(yy_.yytext) already!

            return 24;
          }

          break;

        case 18:
          /*! Conditions:: action */

          /*! Rule::       $ */
          yy.include_command_allowed = false;

          if (yy.depth !== 0) {
            yy_.yyerror(rmCommonWS`
                                                missing ${yy.depth} closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
            return 38;
          }

          this.popState();
          yy_.yytext = '';
          return 24;
          break;

        case 19:
          /*! Conditions:: INITIAL rules code options */

          /*! Rule::       [%\{]\{+ */
          {
            yy.depth = 0;
            yy.include_command_allowed = false;
            this.pushState('action'); // keep matched string in local variable as the `unput()` call at the end will also 'unput' `yy_.yytext`,
            // which for our purposes here is highly undesirable (see trimActionCode() use in the BNF parser spec).

            var marker = yy_.yytext; // check whether this `%{` marker was located at the start of the line:
            // if it is, we treat it as a different token to signal the grammar we've
            // got an action which stands on its own, i.e. is not a rule action, %code
            // section, etc...
            //var precedingStr = this.pastInput(1,2).replace(/[\r\n]/g, '\n');
            //var precedingStr = this.matched.substr(-this.match.length - 1, 1);

            var precedingStr = this.matched[this.matched.length - this.match.length - 1];
            var atSOL = !precedingStr
            /* @ Start Of File */
            || precedingStr === '\n'; // Make sure we've the proper lexer rule regex active for any possible `%{...%}`, `{{...}}` or what have we here?

            var endMarker = this.setupDelimitedActionChunkLexerRegex(marker); // Early sanity check for better error reporting: 
            // we'd better make sure that end marker indeed does exist in the
            // remainder of the input! When it's not, we'll have the `action`
            // lexer state running past its due date as it'll then go and spit
            // out a 'too may closing braces' error report at some spot way
            // beyond the intended end of the action code chunk.
            // 
            // Writing the wrong end marker is a common user mistake, we can
            // easily look ahead and check for it now and report a proper hint
            // to cover this failure mode in a more helpful manner.

            var remaining = this.lookAhead();
            var prevEnd = 0;
            var endMarkerIndex;

            for (;;) {
              endMarkerIndex = remaining.indexOf(endMarker, prevEnd); // check for both simple non-existence *and* non-match due to trailing braces,
              // e.g. in this input: `%{{...%}}}` -- note the 3rd curly closing brace.

              if (endMarkerIndex >= 0 && remaining[endMarkerIndex + endMarker.length] === '}') {
                prevEnd = endMarkerIndex + endMarker.length;
                continue;
              }

              if (endMarkerIndex < 0) {
                yy_.yyerror(rmCommonWS`
                                                    Incorrectly terminated action code block. We're expecting the
                                                    '${endMarker}' end marker to go with the given start marker.
                                                    Regrettably, it does not exist in the remainder of the input.

                                                      Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
                return 25;
              }

              break;
            } // Allow the start marker to be re-matched by the generated lexer rule regex:


            this.unput(marker); // Now RESET `yy_.yytext` to what it was originally, i.e. un-unput that lexer variable explicitly:

            yy_.yytext = marker; // and allow the next lexer round to match and execute the suitable lexer rule(s) to parse this incoming action code block. 

            if (atSOL) {
              return 23;
            }

            return 26;
          }
          break;

        case 20:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       -> */
          yy.depth = 0;
          yy.include_command_allowed = false;
          this.pushState('action');
          return 35;
          break;

        case 21:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       → */
          yy.depth = 0;
          yy.include_command_allowed = false;
          this.pushState('action');
          return 35;
          break;

        case 22:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       => */
          yy.depth = 0;
          yy.include_command_allowed = false;
          this.pushState('action');
          return 35;
          break;

        case 23:
          /*! Conditions:: rules */

          /*! Rule::       {WS}+(?!(?:\{\{|\||%|->|=>|→|{WS}|{BR})) */
          {
            {
              yy.depth = 0;
              yy.include_command_allowed = true; //console.error('*** ACTION start @ 355:', yy_.yytext);

              this.pushState('action'); // Do a bit of magic that's useful for the parser when we
              // call `trimActionCode()` in there to perform a bit of
              // rough initial action code chunk cleanup: 
              // when we start the action block -- hence *delimit* the
              // action block -- with a plain old '{' brace, we can
              // throw that one and its counterpart out safely without
              // damaging the action code in any way.
              //
              // In order to be able to detect that, we look ahead
              // now and see whether or rule's regex with the fancy
              // '/!' postcondition check actually hit a '{', which
              // is the only action code block starter we cannot
              // detect explicitly using any of the '%{.*?%}' lexer
              // rules you've seen further above.
              //
              // Thanks to this rule's regex, we DO know that the
              // first look-ahead character will be a non-whitespace
              // character, which would either be an action code block
              // delimiter *or* a comment starter. In the latter case
              // we just throw up our hands and leave code trimming
              // and analysis to the more advanced systems which
              // follow after `trimActionCode()` has passed once we
              // get to the parser productions which process this
              // upcoming action code block.

              var la = this.lookAhead();

              if (la[0] === '{') {
                yy_.yytext = '{'; // hint the parser  
              }

              return 26;
            }
          }
          break;

        case 24:
          /*! Conditions:: rules */

          /*! Rule::       %% */
          this.popState();
          this.pushState('code');
          return 19;
          break;

        case 25:
          /*! Conditions:: rules */

          /*! Rule::       $ */
          this.popState();
          this.pushState('code');
          return 19;
          break;

        case 30:
          /*! Conditions:: options */

          /*! Rule::       %%|\||; */
          this.popState();
          this.unput(yy_.yytext);
          return 22;
          break;

        case 31:
          /*! Conditions:: options */

          /*! Rule::       %include\b */
          yy.depth = 0;
          yy.include_command_allowed = true;
          this.pushState('action'); // push the parsed '%include' back into the input-to-parse
          // to trigger the `<action>` state to re-parse it
          // and issue the desired follow-up token: 'INCLUDE':

          this.unput(yy_.yytext);
          return 26;
          break;

        case 32:
          /*! Conditions:: options */

          /*! Rule::       > */
          this.popState();
          this.unput(yy_.yytext);
          return 22;
          break;

        case 35:
          /*! Conditions:: options */

          /*! Rule::       <{ID}> */
          yy_.yytext = this.matches[1];
          return 'TOKEN_TYPE';
          break;

        case 37:
          /*! Conditions:: options */

          /*! Rule::       {BR}{WS}+(?=\S) */

          /* ignore */
          break;

        case 38:
          /*! Conditions:: options */

          /*! Rule::       {BR} */
          this.popState();
          this.unput(yy_.yytext);
          return 22;
          break;

        case 39:
          /*! Conditions:: options */

          /*! Rule::       {WS}+ */

          /* skip whitespace */
          break;

        case 40:
          /*! Conditions:: INITIAL */

          /*! Rule::       {ID} */
          this.pushState('macro');
          return 20;
          break;

        case 41:
          /*! Conditions:: macro */

          /*! Rule::       {BR}+ */
          this.popState();
          this.unput(yy_.yytext);
          return 21;
          break;

        case 42:
          /*! Conditions:: macro */

          /*! Rule::       $ */
          this.popState();
          this.unput(yy_.yytext);
          return 21;
          break;

        case 43:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       {BR}+ */

          /* skip newlines */
          break;

        case 44:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       {WS}+ */

          /* skip whitespace */
          break;

        case 48:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       {ANY_LITERAL_CHAR}+ */
          // accept any non-regex, non-lex, non-string-delim,
          // non-escape-starter, non-space character as-is
          return 51;
          break;

        case 49:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       \[ */
          this.pushState('set');
          return 46;
          break;

        case 64:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       < */
          this.pushState('options');
          return 3;
          break;

        case 66:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       \/! */
          return 42; // treated as `(?!atom)`  

          break;

        case 67:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       \/ */
          return 13; // treated as `(?=atom)`  

          break;

        case 69:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       \\(?:([0-7]{1,3})|c([@A-Z])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]{1,8})\}) */
          var m = this.matches;
          yy_.yytext = NaN;

          if (m[1]) {
            // [1]: octal char: `\012` --> \x0A
            var v = parseInt(m[1], 8);
            yy_.yytext = v;
          } else if (m[2]) {
            // [2]: CONTROL char: `\cA` --> \u0001
            var v = m[2].charCodeAt(0) - 64;
            yy_.yytext = v;
          } else if (m[3]) {
            // [3]: hex char: `\x41` --> A
            var v = parseInt(m[3], 16);
            yy_.yytext = v;
          } else if (m[4]) {
            // [4]: unicode/UTS2 char: `\u03c0` --> PI
            var v = parseInt(m[4], 16);
            yy_.yytext = v;
          } else if (m[5]) {
            // [5]: unicode code point: `\u{00003c0}` --> PI
            var v = parseInt(m[5], 16);
            yy_.yytext = v;
          }

          return 44;
          break;

        case 70:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       \\. */
          yy_.yytext = yy_.yytext.substring(1);
          return 51;
          break;

        case 73:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       %option[s]? */
          this.pushState('options');
          return 29;
          break;

        case 74:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       %s\b */
          this.pushState('options');
          return 33;
          break;

        case 75:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       %x\b */
          this.pushState('options');
          return 34;
          break;

        case 76:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       %code\b */
          this.pushState('options');
          return 31;
          break;

        case 77:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       %import\b */
          this.pushState('options');
          return 30;
          break;

        case 80:
          /*! Conditions:: INITIAL rules code */

          /*! Rule::       %include\b */
          yy.depth = 0;
          yy.include_command_allowed = true;
          this.pushState('action'); // push the parsed '%include' back into the input-to-parse
          // to trigger the `<action>` state to re-parse it
          // and issue the desired follow-up token: 'INCLUDE':

          this.unput(yy_.yytext);
          return 26;
          break;

        case 81:
          /*! Conditions:: INITIAL rules code */

          /*! Rule::       %{NAME}([^\r\n]*) */

          /* ignore unrecognized decl */
          this.warn(rmCommonWS`
                                                ignoring unsupported lexer option ${dquote(yy_.yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
          yy_.yytext = {
            name: this.matches[1],
            // {NAME}  
            value: this.matches[2].trim() // optional value/parameters 

          };
          return 28;
          break;

        case 82:
          /*! Conditions:: rules macro INITIAL */

          /*! Rule::       %% */
          this.pushState('rules');
          return 19;
          break;

        case 90:
          /*! Conditions:: set */

          /*! Rule::       \] */
          this.popState();
          return 47;
          break;

        case 91:
          /*! Conditions:: code */

          /*! Rule::       (?:[^%{BR}][^{BR}]*{BR}+)+ */
          return 55; // shortcut to grab a large bite at once when we're sure not to encounter any `%include` in there at start-of-line.  

          break;

        case 93:
          /*! Conditions:: code */

          /*! Rule::       [^{BR}]+ */
          return 55; // the bit of CODE just before EOF...  

          break;

        case 94:
          /*! Conditions:: action */

          /*! Rule::       " */
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 95:
          /*! Conditions:: action */

          /*! Rule::       ' */
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 96:
          /*! Conditions:: action */

          /*! Rule::       ` */
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 97:
          /*! Conditions:: options */

          /*! Rule::       " */
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 98:
          /*! Conditions:: options */

          /*! Rule::       ' */
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 99:
          /*! Conditions:: options */

          /*! Rule::       ` */
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 100:
          /*! Conditions:: * */

          /*! Rule::       " */
          var rules = this.topState() === 'macro' ? 'macro\'s' : this.topState();
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 101:
          /*! Conditions:: * */

          /*! Rule::       ' */
          var rules = this.topState() === 'macro' ? 'macro\'s' : this.topState();
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 102:
          /*! Conditions:: * */

          /*! Rule::       ` */
          var rules = this.topState() === 'macro' ? 'macro\'s' : this.topState();
          yy_.yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 40;
          break;

        case 103:
          /*! Conditions:: macro rules */

          /*! Rule::       . */

          /* b0rk on bad characters */
          var rules = this.topState() === 'macro' ? 'macro\'s' : this.topState();
          yy_.yyerror(rmCommonWS`
                                            unsupported lexer input encountered while lexing
                                            ${rules} (i.e. jison lex regexes) in ${dquote(this.topState())} state.

                                                NOTE: When you want this input to be interpreted as a LITERAL part
                                                      of a lex rule regex, you MUST enclose it in double or
                                                      single quotes.

                                                      If not, then know that this input is not accepted as a valid
                                                      regex expression here in jison-lex ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 2;
          break;

        case 104:
          /*! Conditions:: options */

          /*! Rule::       . */
          yy_.yyerror(rmCommonWS`
                                            unsupported lexer input: ${dquote(yy_.yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                            If this input was intentional, you might want to put quotes around
                                            it; any JavaScript string quoting style is accepted (single quotes,
                                            double quotes *or* backtick quotes a la ES6 string templates).

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 2;
          break;

        case 105:
          /*! Conditions:: * */

          /*! Rule::       . */
          yy_.yyerror(rmCommonWS`
                                            unsupported lexer input: ${dquote(yy_.yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
          return 2;
          break;

        default:
          return this.simpleCaseActionClusters[yyrulenumber];
      }
    },
    simpleCaseActionClusters: {
      /*! Conditions:: action */

      /*! Rule::       {WS}+ */
      16: 36,

      /*! Conditions:: options */

      /*! Rule::       = */
      26: 18,

      /*! Conditions:: options */

      /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */
      27: 53,

      /*! Conditions:: options */

      /*! Rule::       '{QUOTED_STRING_CONTENT}' */
      28: 53,

      /*! Conditions:: options */

      /*! Rule::       `{ES2017_STRING_CONTENT}` */
      29: 53,

      /*! Conditions:: options */

      /*! Rule::       , */
      33: 17,

      /*! Conditions:: options */

      /*! Rule::       \* */
      34: 11,

      /*! Conditions:: options */

      /*! Rule::       {ANY_LITERAL_CHAR}+ */
      36: 54,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */
      45: 50,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       '{QUOTED_STRING_CONTENT}' */
      46: 50,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       `{ES2017_STRING_CONTENT}` */
      47: 50,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \| */
      50: 7,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \(\?: */
      51: 41,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \(\?= */
      52: 41,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \(\?! */
      53: 41,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \(\?<= */
      54: 41,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \(\?<! */
      55: 41,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \( */
      56: 8,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \) */
      57: 9,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \+ */
      58: 10,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \* */
      59: 11,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \? */
      60: 12,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \^ */
      61: 15,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       , */
      62: 17,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       <<EOF>> */
      63: 16,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       > */
      65: 6,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \\(?:[sSbBwWdDpP]|[rfntv\\*+()${}|[\]\/.^?]) */
      68: 43,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \$ */
      71: 16,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \. */
      72: 14,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       %pointer\b */
      78: 'FLEX_POINTER_MODE',

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       %array\b */
      79: 'FLEX_ARRAY_MODE',

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \{\d+(,\s*\d+|,)?\} */
      83: 49,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \{{ID}\} */
      84: 45,

      /*! Conditions:: set options */

      /*! Rule::       \{{ID}\} */
      85: 45,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \{ */
      86: 4,

      /*! Conditions:: rules macro INITIAL */

      /*! Rule::       \} */
      87: 5,

      /*! Conditions:: set */

      /*! Rule::       (?:\\[^{BR}]|[^\]{])+ */
      88: 48,

      /*! Conditions:: set */

      /*! Rule::       \{ */
      89: 48,

      /*! Conditions:: code */

      /*! Rule::       [^{BR}]*{BR}+ */
      92: 55,

      /*! Conditions:: * */

      /*! Rule::       $ */
      106: 1
    },
    rules: [
    /*   0: */
    /^(?:\/\/[^\r\n]*)/,
    /*   1: */
    /^(?:\/\*[\s\S]*?\*\/)/,
    /*   2: */
    /^(?:%\{([\s\S]*?)%\}(?!\}))/,
    /*   3: */
    /^(?:%include\b)/,
    /*   4: */
    /^(?:\/\*[\s\S]*?\*\/)/,
    /*   5: */
    /^(?:\/\/.*)/,
    /*   6: */
    /^(?:\|)/,
    /*   7: */
    /^(?:%%)/,
    /*   8: */
    /^(?:\/(?=\s))/,
    /*   9: */
    /^(?:\/.*)/,
    /*  10: */
    /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)"|'((?:\\'|\\[^']|[^\n\r'\\])*)'|`((?:\\`|\\[^`]|[^\\`])*)`)/,
    /*  11: */
    /^(?:[^\n\r"%'\/`{}]+)/,
    /*  12: */
    /^(?:%)/,
    /*  13: */
    /^(?:\{)/,
    /*  14: */
    /^(?:\})/,
    /*  15: */
    /^(?:(?:\s*?)(\r\n|\n|\r)+([^\S\n\r])+)/,
    /*  16: */
    /^(?:([^\S\n\r])+)/,
    /*  17: */
    /^(?:(\r\n|\n|\r))/,
    /*  18: */
    /^(?:$)/,
    /*  19: */
    /^(?:[%{]\{+)/,
    /*  20: */
    /^(?:->)/,
    /*  21: */
    /^(?:→)/,
    /*  22: */
    /^(?:=>)/,
    /*  23: */
    /^(?:([^\S\n\r])+(?!(?:\{\{|\||%|->|=>|→|([^\S\n\r])|(\r\n|\n|\r))))/,
    /*  24: */
    /^(?:%%)/,
    /*  25: */
    /^(?:$)/,
    /*  26: */
    /^(?:=)/,
    /*  27: */
    /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
    /*  28: */
    /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
    /*  29: */
    /^(?:`((?:\\`|\\[^`]|[^\\`])*)`)/,
    /*  30: */
    /^(?:%%|\||;)/,
    /*  31: */
    /^(?:%include\b)/,
    /*  32: */
    /^(?:>)/,
    /*  33: */
    /^(?:,)/,
    /*  34: */
    /^(?:\*)/,
    /*  35: */
    new XRegExp('^(?:<([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*)>)', ''),
    /*  36: */
    /^(?:([^\s!"$%'-,.\/:-?\[-\^`{-}])+)/,
    /*  37: */
    /^(?:(\r\n|\n|\r)([^\S\n\r])+(?=\S))/,
    /*  38: */
    /^(?:(\r\n|\n|\r))/,
    /*  39: */
    /^(?:([^\S\n\r])+)/,
    /*  40: */
    new XRegExp('^(?:([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*))', ''),
    /*  41: */
    /^(?:(\r\n|\n|\r)+)/,
    /*  42: */
    /^(?:$)/,
    /*  43: */
    /^(?:(\r\n|\n|\r)+)/,
    /*  44: */
    /^(?:([^\S\n\r])+)/,
    /*  45: */
    /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
    /*  46: */
    /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
    /*  47: */
    /^(?:`((?:\\`|\\[^`]|[^\\`])*)`)/,
    /*  48: */
    /^(?:([^\s!"$%'-,.\/:-?\[-\^`{-}])+)/,
    /*  49: */
    /^(?:\[)/,
    /*  50: */
    /^(?:\|)/,
    /*  51: */
    /^(?:\(\?:)/,
    /*  52: */
    /^(?:\(\?=)/,
    /*  53: */
    /^(?:\(\?!)/,
    /*  54: */
    /^(?:\(\?<=)/,
    /*  55: */
    /^(?:\(\?<!)/,
    /*  56: */
    /^(?:\()/,
    /*  57: */
    /^(?:\))/,
    /*  58: */
    /^(?:\+)/,
    /*  59: */
    /^(?:\*)/,
    /*  60: */
    /^(?:\?)/,
    /*  61: */
    /^(?:\^)/,
    /*  62: */
    /^(?:,)/,
    /*  63: */
    /^(?:<<EOF>>)/,
    /*  64: */
    /^(?:<)/,
    /*  65: */
    /^(?:>)/,
    /*  66: */
    /^(?:\/!)/,
    /*  67: */
    /^(?:\/)/,
    /*  68: */
    /^(?:\\(?:[BDPSWbdpsw]|[$(-+.\/?\[-\^fnrtv{-}]))/,
    /*  69: */
    /^(?:\\(?:([0-7]{1,3})|c([@-Z])|x([\dA-Fa-f]{2})|u([\dA-Fa-f]{4})|u\{([\dA-Fa-f]{1,8})\}))/,
    /*  70: */
    /^(?:\\.)/,
    /*  71: */
    /^(?:\$)/,
    /*  72: */
    /^(?:\.)/,
    /*  73: */
    /^(?:%option[s]?)/,
    /*  74: */
    /^(?:%s\b)/,
    /*  75: */
    /^(?:%x\b)/,
    /*  76: */
    /^(?:%code\b)/,
    /*  77: */
    /^(?:%import\b)/,
    /*  78: */
    /^(?:%pointer\b)/,
    /*  79: */
    /^(?:%array\b)/,
    /*  80: */
    /^(?:%include\b)/,
    /*  81: */
    new XRegExp('^(?:%([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}\\-_]*(?:[\\p{Alphabetic}\\p{Number}_]))?)([^\\n\\r]*))', ''),
    /*  82: */
    /^(?:%%)/,
    /*  83: */
    /^(?:\{\d+(,\s*\d+|,)?\})/,
    /*  84: */
    new XRegExp('^(?:\\{([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*)\\})', ''),
    /*  85: */
    new XRegExp('^(?:\\{([\\p{Alphabetic}_](?:[\\p{Alphabetic}\\p{Number}_])*)\\})', ''),
    /*  86: */
    /^(?:\{)/,
    /*  87: */
    /^(?:\})/,
    /*  88: */
    /^(?:(?:\\[^\n\r]|[^\]{])+)/,
    /*  89: */
    /^(?:\{)/,
    /*  90: */
    /^(?:\])/,
    /*  91: */
    /^(?:(?:[^\n\r%][^\n\r]*(\r\n|\n|\r)+)+)/,
    /*  92: */
    /^(?:[^\n\r]*(\r\n|\n|\r)+)/,
    /*  93: */
    /^(?:[^\n\r]+)/,
    /*  94: */
    /^(?:")/,
    /*  95: */
    /^(?:')/,
    /*  96: */
    /^(?:`)/,
    /*  97: */
    /^(?:")/,
    /*  98: */
    /^(?:')/,
    /*  99: */
    /^(?:`)/,
    /* 100: */
    /^(?:")/,
    /* 101: */
    /^(?:')/,
    /* 102: */
    /^(?:`)/,
    /* 103: */
    /^(?:.)/,
    /* 104: */
    /^(?:.)/,
    /* 105: */
    /^(?:.)/,
    /* 106: */
    /^(?:$)/],
    conditions: {
      'rules': {
        rules: [0, 1, 19, 20, 21, 22, 23, 24, 25, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 86, 87, 100, 101, 102, 103, 105, 106],
        inclusive: true
      },
      'macro': {
        rules: [0, 1, 20, 21, 22, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 82, 83, 84, 86, 87, 100, 101, 102, 103, 105, 106],
        inclusive: true
      },
      'code': {
        rules: [19, 80, 81, 91, 92, 93, 100, 101, 102, 105, 106],
        inclusive: false
      },
      'options': {
        rules: [0, 1, 19, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 85, 97, 98, 99, 100, 101, 102, 104, 105, 106],
        inclusive: false
      },
      'action': {
        rules: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 94, 95, 96, 100, 101, 102, 105, 106],
        inclusive: false
      },
      'set': {
        rules: [85, 88, 89, 90, 100, 101, 102, 105, 106],
        inclusive: false
      },
      'INITIAL': {
        rules: [0, 1, 19, 20, 21, 22, 40, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 86, 87, 100, 101, 102, 105, 106],
        inclusive: true
      }
    }
  };
  var rmCommonWS = helpers.rmCommonWS;
  var dquote = helpers.dquote;
  var scanRegExp = helpers.scanRegExp; // Calculate the end marker to match and produce a
  // lexer rule to match when the need arrises:

  lexer.setupDelimitedActionChunkLexerRegex = function lexer__setupDelimitedActionChunkLexerRegex(marker) {
    // Special: when we encounter `{` as the start of the action code block,
    // we DO NOT patch the `%{...%}` lexer rule as we will handle `{...}` 
    // elsewhere in the lexer anyway: we cannot use a simple regex like 
    // `/{[^]*?}/` to match an entire action code block after all!
    var doNotPatch = marker === '{';
    var action_end_marker = marker.replace(/\{/g, '}');

    if (!doNotPatch) {
      // Note: this bit comes straight from the lexer kernel!
      //
      // Get us the currently active set of lexer rules. 
      // (This is why we push the 'action' lexer condition state above *before*
      // we commence and work on the ruleset itself.)
      var spec = this.__currentRuleSet__;

      if (!spec) {
        // Update the ruleset cache as we apparently encountered a state change or just started lexing.
        // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
        // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
        // speed up those activities a tiny bit.
        spec = this.__currentRuleSet__ = this._currentRules();
      }

      var regexes = spec.__rule_regexes;
      var len = spec.__rule_count;
      var rules = spec.rules;
      var i;
      var action_chunk_regex; // Must we still locate the rule to patch or have we done 
      // that already during a previous encounter?
      //
      // WARNING: our cache/patch must live beyond the current lexer+parser invocation:
      // our patching must remain detected indefinitely to ensure subsequent invocations
      // of the parser will still work as expected!
      // This implies that we CANNOT store anything in the `yy` context as that one
      // is short-lived: `yy` dies once the current parser.parse() has completed!
      // Hence we store our patch data in the lexer instance itself: in `spec`.
      //

      if (!spec.__action_chunk_rule_idx) {
        // **WARNING**: *(this bit, like so much else in here, comes straight from the lexer kernel)*
        //
        // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in `lexer_next()` fast and simple!
        var orig_re_str1 = '/^(?:%\\{([^]*?)%\\}(?!\\}))/';
        var orig_re_str2 = '/^(?:%\\{([\\s\\S]*?)%\\}(?!\\}))/'; // the XRegExp 'cross-platform' version of the same. 
        // Note: the arrays are 1-based, while `len` itself is a valid index,
        // hence the non-standard less-or-equal check in the next loop condition!

        for (i = 1; i <= len; i++) {
          var rule_re = regexes[i];
          var re_str = rule_re.toString(); //console.error('test regexes:', {i, len, re1: re_str, match1: rule_re.toString() === orig_re_str1, match1: rule_re.toString() === orig_re_str2});

          if (re_str === orig_re_str1 || re_str === orig_re_str2) {
            spec.__action_chunk_rule_idx = i;
            break;
          }
        }

        if (!spec.__action_chunk_rule_idx) {
          //console.error('ruleset dump:', spec);
          throw new Error('INTERNAL DEV ERROR: cannot locate %{...%} rule regex!');
        } // As we haven't initialized yet, we're sure the rule cache doesn't exist either.
        // Make it happen:


        spec.__cached_action_chunk_rule = {}; // set up empty cache 
      }

      i = spec.__action_chunk_rule_idx; // Must we build the lexer rule or did we already run this variant 
      // through this lexer before? When the latter, fetch the cached version!

      action_chunk_regex = spec.__cached_action_chunk_rule[marker];

      if (!action_chunk_regex) {
        action_chunk_regex = spec.__cached_action_chunk_rule[marker] = new RegExp('^(?:' + marker.replace(/\{/g, '\\{') + '([^]*?)' + action_end_marker.replace(/\}/g, '\\}') + '(?!\\}))'); //console.warn('encode new action block regex:', action_chunk_regex); 
      } //console.error('new ACTION REGEX:', { i, action_chunk_regex });
      // and patch the lexer regex table for the current lexer condition state:


      regexes[i] = action_chunk_regex;
    }

    return action_end_marker;
  };

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

parser$1.lexer = lexer;
var rmCommonWS$1 = helpers.rmCommonWS;
var checkActionBlock$1 = helpers.checkActionBlock;
var mkIdentifier$1 = helpers.mkIdentifier;
var isLegalIdentifierInput$1 = helpers.isLegalIdentifierInput;
var trimActionCode$1 = helpers.trimActionCode; // see also:
// - https://en.wikipedia.org/wiki/C0_and_C1_control_codes
// - https://docs.microsoft.com/en-us/dotnet/standard/base-types/character-escapes-in-regular-expressions
// - https://kangax.github.io/compat-table/es6/#test-RegExp_y_and_u_flags
// - http://2ality.com/2015/07/regexp-es6.html
// - http://www.regular-expressions.info/quickstart.html

const charCvtTable = {
  // "\a": "\x07",
  // "\e": "\x1B",
  // "\b": "\x08",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\v": "\\v"
};
const escCvtTable = {
  "a": "\\x07",
  "e": "\\x1B",
  "b": "\\x08",
  "f": "\\f",
  "n": "\\n",
  "r": "\\r",
  "t": "\\t",
  "v": "\\v"
};
const codeCvtTable = {
  12: "\\f",
  10: "\\n",
  13: "\\r",
  9: "\\t",
  11: "\\v"
}; // Note about 'b' in the regex below:
// when inside a literal string, it's BACKSPACE, otherwise it's
// the regex word edge condition `\b`. Here it's BACKSPACE.

var codedCharRe = /(?:([sSBwWdDpP])|([*+()${}|[\]\/.^?])|([aberfntv])|([0-7]{1,3})|c([@A-Z])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]{1,8})\}|())/g;

function encodeCharCode(v) {
  if (v < 32) {
    var rv = codeCvtTable[v];
    if (rv) return rv;
    return '\\u' + ('0000' + v.toString(16)).substr(-4);
  } else {
    return String.fromCharCode(v);
  }
}

function encodeUnicodeCodepoint(v) {
  if (v < 32) {
    var rv = codeCvtTable[v];
    if (rv) return rv;
    return '\\u' + ('0000' + v.toString(16)).substr(-4);
  } else {
    return String.fromCodePoint(v);
  }
}

function encodeRegexLiteralStr(s, edge) {
  var rv = ''; //console.warn("encodeRegexLiteralStr INPUT:", {s, edge});

  for (var i = 0, l = s.length; i < l; i++) {
    var c = s[i];

    switch (c) {
      case '\\':
        i++;

        if (i < l) {
          c = s[i];

          if (c === edge) {
            rv += c;
            continue;
          }

          var pos = '\'"`'.indexOf(c);

          if (pos >= 0) {
            rv += '\\\\' + c;
            continue;
          }

          if (c === '\\') {
            rv += '\\\\';
            continue;
          }

          codedCharRe.lastIndex = i; // we 'fake' the RegExp 'y'=sticky feature cross-platform by using 'g' flag instead
          // plus an empty capture group at the end of the regex: when that one matches,
          // we know we did not get a hit.

          var m = codedCharRe.exec(s);

          if (m && m[0]) {
            if (m[1]) {
              // [1]: regex operators, which occur in a literal string: `\s` --> \\s
              rv += '\\\\' + m[1];
              i += m[1].length - 1;
              continue;
            }

            if (m[2]) {
              // [2]: regex special characters, which occur in a literal string: `\[` --> \\\[
              rv += '\\\\\\' + m[2];
              i += m[2].length - 1;
              continue;
            }

            if (m[3]) {
              // [3]: special escape characters, which occur in a literal string: `\a` --> BELL
              rv += escCvtTable[m[3]];
              i += m[3].length - 1;
              continue;
            }

            if (m[4]) {
              // [4]: octal char: `\012` --> \x0A
              var v = parseInt(m[4], 8);
              rv += encodeCharCode(v);
              i += m[4].length - 1;
              continue;
            }

            if (m[5]) {
              // [5]: CONTROL char: `\cA` --> \u0001
              var v = m[5].charCodeAt(0) - 64;
              rv += encodeCharCode(v);
              i++;
              continue;
            }

            if (m[6]) {
              // [6]: hex char: `\x41` --> A
              var v = parseInt(m[6], 16);
              rv += encodeCharCode(v);
              i += m[6].length;
              continue;
            }

            if (m[7]) {
              // [7]: unicode/UTS2 char: `\u03c0` --> PI
              var v = parseInt(m[7], 16);
              rv += encodeCharCode(v);
              i += m[7].length;
              continue;
            }

            if (m[8]) {
              // [8]: unicode code point: `\u{00003c0}` --> PI
              var v = parseInt(m[8], 16);
              rv += encodeUnicodeCodepoint(v);
              i += m[8].length;
              continue;
            }
          }
        } // all the rest: simply treat the `\\` escape as a character on its own:


        rv += '\\\\';
        i--;
        continue;

      default:
        // escape regex operators:
        var pos = ".*+?^${}()|[]/\\".indexOf(c);

        if (pos >= 0) {
          rv += '\\' + c;
          continue;
        }

        var cc = charCvtTable[c];

        if (cc) {
          rv += cc;
          continue;
        }

        var cc = c.charCodeAt(0);

        if (cc < 32) {
          var rvp = codeCvtTable[v];

          if (rvp) {
            rv += rvp;
          } else {
            rv += '\\u' + ('0000' + cc.toString(16)).substr(-4);
          }
        } else {
          rv += c;
        }

        continue;
    }
  }

  s = rv; //console.warn("encodeRegexLiteralStr ROUND 3:", {s});

  return s;
} // convert string value to number or boolean value, when possible
// (and when this is more or less obviously the intent)
// otherwise produce the string itself as value.


function parseValue(v) {
  if (v === 'false') {
    return false;
  }

  if (v === 'true') {
    return true;
  } // http://stackoverflow.com/questions/175739/is-there-a-built-in-way-in-javascript-to-check-if-a-string-is-a-valid-number
  // Note that the `v` check ensures that we do not convert `undefined`, `null` and `''` (empty string!)


  if (v && !isNaN(v)) {
    var rv = +v;

    if (isFinite(rv)) {
      return rv;
    }
  }

  return v;
}

parser$1.warn = function p_warn() {
  console.warn.apply(console, arguments);
};

parser$1.log = function p_log() {
  console.log.apply(console, arguments);
};

parser$1.pre_parse = function p_lex() {
  if (parser$1.yydebug) parser$1.log('pre_parse:', arguments);
};

parser$1.yy.pre_parse = function p_lex() {
  if (parser$1.yydebug) parser$1.log('pre_parse YY:', arguments);
};

parser$1.yy.post_lex = function p_lex() {
  if (parser$1.yydebug) parser$1.log('post_lex:', arguments);
};

function Parser() {
  this.yy = {};
}

Parser.prototype = parser$1;
parser$1.Parser = Parser;

function yyparse() {
  return parser$1.parse.apply(parser$1, arguments);
}

var lexParser = {
  parser: parser$1,
  Parser,
  parse: yyparse
};
module.exports = lexParser;
