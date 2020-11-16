'use strict';

var fs = require('fs');
var path$1 = require('path');
var XRegExp = require('@gerhobbelt/xregexp');
var recast = require('recast');
var babel = require('@babel/core');
var assert = require('assert');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path$1);
var XRegExp__default = /*#__PURE__*/_interopDefaultLegacy(XRegExp);
var recast__default = /*#__PURE__*/_interopDefaultLegacy(recast);
var assert__default = /*#__PURE__*/_interopDefaultLegacy(assert);

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
                var m = /^(\s*)\S/.exec(line);
                // only non-empty ~ content-carrying lines matter re common indent calculus:
                if (m) {
                    if (indent_str == null) {
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
        var c = match.charAt(1);
        var rv = c.toUpperCase();
        // do not mutate 'a-2' to 'a2':
        if (c === rv && c.match(/\d/)) {
            return match;
        }
        return rv;
    })
}

// Convert dashed option keys and other inputs to Camel Cased legal JavaScript identifiers
/** @public */
function mkIdentifier(s) {
    s = '' + s;
    return s
    // Convert dashed ids to Camel Case (though NOT lowercasing the initial letter though!), 
    // e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
    .replace(/-\w/g, function (match) {
        var c = match.charAt(1);
        var rv = c.toUpperCase();
        // do not mutate 'a-2' to 'a2':
        if (c === rv && c.match(/\d/)) {
            return match;
        }
        return rv;
    })
    // cleanup: replace any non-suitable character series to a single underscore:
    .replace(/^[^\w_]/, '_')
    // do not accept numerics at the leading position, despite those matching regex `\w`:
    .replace(/^\d/, '_')
    .replace(/[^\w\d_]/g, '_')
    // and only accept multiple (double, not triple) underscores at start or end of identifier name:
    .replace(/^__+/, '#')
    .replace(/__+$/, '#')
    .replace(/_+/g, '_')
    .replace(/#/g, '__');
}

// Check if the start of the given input matches a regex expression.
// Return the length of the regex expression or -1 if none was found.
/** @public */
function scanRegExp(s) {
    s = '' + s;
    // code based on Esprima scanner: `Scanner.prototype.scanRegExpBody()`
    var index = 0;
    var length = s.length;
    var ch = s[index];
    //assert.assert(ch === '/', 'Regular expression literal must start with a slash');
    var str = s[index++];
    var classMarker = false;
    var terminated = false;
    while (index < length) {
        ch = s[index++];
        str += ch;
        if (ch === '\\') {
            ch = s[index++];
            // https://tc39.github.io/ecma262/#sec-literals-regular-expression-literals
            if (isLineTerminator(ch.charCodeAt(0))) {
                break;             // UnterminatedRegExp
            }
            str += ch;
        }
        else if (isLineTerminator(ch.charCodeAt(0))) {
            break;                 // UnterminatedRegExp
        }
        else if (classMarker) {
            if (ch === ']') {
                classMarker = false;
            }
        }
        else {
            if (ch === '/') {
                terminated = true;
                break;
            }
            else if (ch === '[') {
                classMarker = true;
            }
        }
    }
    if (!terminated) {
        return -1;                  // UnterminatedRegExp
    }
    return index;
}


// https://tc39.github.io/ecma262/#sec-line-terminators
function isLineTerminator(cp) {
    return (cp === 0x0A) || (cp === 0x0D) || (cp === 0x2028) || (cp === 0x2029);
}

// Check if the given input can be a legal identifier-to-be-camelcased:
// use this function to check if the way the identifier is written will
// produce a sensible & comparable identifier name using the `mkIdentifier'
// API - for humans that transformation should be obvious/trivial in
// order to prevent confusion.
/** @public */
function isLegalIdentifierInput(s) {
    s = '' + s;
    // Convert dashed ids to Camel Case (though NOT lowercasing the initial letter though!), 
    // e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
    s = s
    .replace(/-\w/g, function (match) {
        var c = match.charAt(1);
        var rv = c.toUpperCase();
        // do not mutate 'a-2' to 'a2':
        if (c === rv && c.match(/\d/)) {
            return match;
        }
        return rv;
    });
    var alt = mkIdentifier(s);
    return alt === s;
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



function chkBugger(src) {
    src = String(src);
    if (src.match(/\bcov_\w+/)) {
        console.error('### ISTANBUL COVERAGE CODE DETECTED ###\n', src);
    }
}




// Helper function: pad number with leading zeroes
function pad(n, p) {
    p = p || 2;
    var rv = '0000' + n;
    return rv.slice(-p);
}


// attempt to dump in one of several locations: first winner is *it*!
function dumpSourceToFile(sourcecode, errname, err_id, options, ex) {
    var dumpfile;
    options = options || {};

    try {
        var dumpPaths = [(options.outfile ? path__default['default'].dirname(options.outfile) : null), options.inputPath, process.cwd()];
        var dumpName = path__default['default'].basename(options.inputFilename || options.moduleName || (options.outfile ? path__default['default'].dirname(options.outfile) : null) || options.defaultModuleName || errname)
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
                dumpfile = path__default['default'].normalize(dumpPaths[i] + '/' + dumpName);
                fs__default['default'].writeFileSync(dumpfile, sourcecode, 'utf8');
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
};

//



assert__default['default'](recast__default['default']);
var types = recast__default['default'].types;
assert__default['default'](types);
var namedTypes = types.namedTypes;
assert__default['default'](namedTypes);
var b = types.builders;
assert__default['default'](b);
// //assert(astUtils);



// WARNING: this regex MUST match the regex for `ID` in ebnf-parser::bnf.l jison language lexer spec! (`ID = [{ALPHA}]{ALNUM}*`)
//
// This is the base XRegExp ID regex used in many places; this should match the ID macro definition in the EBNF/BNF parser et al as well!
const ID_REGEX_BASE = '[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*';
// regex set expression which can be used as part of a conditional check to find word/ID/token boundaries 
// as this lists all characters which are not allowed in an Identifier anywhere:
const IN_ID_CHARSET = '\\p{Alphabetic}_\\p{Number}';




// Determine which Unicode NonAsciiIdentifierStart characters 
// are unused in the given sourcecode and provide a mapping array
// from given (JISON) start/end identifier character-sequences
// to these.
// 
// The purpose of this routine is to deliver a reversible
// transform from JISON to plain JavaScript for any action
// code chunks. 
// 
// This is the basic building block which helps us convert
// jison variables such as `$id`, `$3`, `$-1` ('negative index' reference),
// `@id`, `#id`, `#TOK#` to variable names which can be
// parsed by a regular JavaScript parser such as esprima or babylon.
function generateMapper4JisonGrammarIdentifiers(input) {
    // IMPORTANT: we only want the single char Unicodes in here
    // so we can do this transformation at 'Char'-word rather than 'Code'-codepoint level.
    
    //const IdentifierStart = unicode4IdStart.filter((e) => e.codePointAt(0) < 0xFFFF);

    // As we will be 'encoding' the Jison Special characters @ and # into the IDStart Unicode 
    // range to make JavaScript parsers *not* barf a hairball on Jison action code chunks, we
    // must consider a few things while doing that:
    // 
    // We CAN use an escape system where we replace a single character with multiple characters,
    // as JavaScript DOES NOT discern between single characters and multi-character strings: anything
    // between quotes is a string and there's no such thing as C/C++/C#'s `'c'` vs `"c"` which is 
    // *character* 'c' vs *string* 'c'.
    // 
    // As we can safely escape characters, all we need to do is find a character (or set of characters)
    // which are in the ID_Start range and are expected to be used rarely while clearly identifyable
    // by humans for ease of debugging of the escaped intermediate values.
    // 
    // The escape scheme is simple and borrowed from ancient serial communication protocols and
    // the JavaScript string spec alike:
    // 
    // - assume the escape character is A
    // - then if the original input stream includes an A, we output AA
    // - if the original input includes a character #, which must be escaped, it is encoded/output as A
    // 
    // This is the same as the way the backslash escape in JavaScript strings works and has a minor issue:
    // sequences of AAA with an odd number of A's CAN occur in the output, which might be a little hard to read.
    // Those are, however, easily machine-decodable and that's what's most important here.
    // 
    // To help with that AAA... issue AND because we need to escape multiple Jison markers, we choose to 
    // a slightly tweaked approach: we are going to use a set of 2-char wide escape codes, where the
    // first character is fixed and the second character is chosen such that the escape code 
    // DOES NOT occur in the original input -- unless someone would have intentionally fed nasty input 
    // to the encoder as we will pick the 2 characters in the escape from 2 utterly different *human languages*:
    // 
    // - the first character is ဩ which is highly visible and allows us to quickly search through a 
    //   source to see if and where there are *any* Jison escapes.
    // - the second character is taken from the Unicode CANADIAN SYLLABICS range (0x1400-0x1670) as far as
    //   those are part of ID_Start (0x1401-0x166C or there-abouts) and, unless an attack is attempted at jison,
    //   we can be pretty sure that this 2-character sequence won't ever occur in real life: even when one
    //   writes such a escape in the comments to document this system, e.g. 'ဩᐅ', then there's still plenty
    //   alternatives for the second character left.
    // - the second character represents the escape type: $-n, $#, #n, @n, #ID#, etc. and each type will
    //   pick a different base shape from that CANADIAN SYLLABICS charset. 
    // - note that the trailing '#' in Jison's '#TOKEN#' escape will be escaped as a different code to 
    //   signal '#' as a token terminator there.
    // - meanwhile, only the initial character in the escape needs to be escaped if encountered in the
    //   original text: ဩ -> ဩဩ as the 2nd and 3rd character are only there to *augment* the escape.
    //   Any CANADIAN SYLLABICS in the original input don't need escaping, as these only have special meaning
    //   when prefixed with ဩ
    // - if the ဩ character is used often in the text, the alternative ℹ இ ண ஐ Ϟ ല ઊ characters MAY be considered 
    //   for the initial escape code, hence we start with analyzing the entire source input to see which
    //   escapes we'll come up with this time.
    //
    // The basic shapes are:
    // 
    // - 1401-141B:  ᐁ             1
    // - 142F-1448:  ᐯ             2
    // - 144C-1465:  ᑌ             3
    // - 146B-1482:  ᑫ             4
    // - 1489-14A0:  ᒉ             5  
    // - 14A3-14BA:  ᒣ             6 
    // - 14C0-14CF:  ᓀ             
    // - 14D3-14E9:  ᓓ             7
    // - 14ED-1504:  ᓭ             8
    // - 1510-1524:  ᔐ             9
    // - 1526-153D:  ᔦ 
    // - 1542-154F:  ᕂ
    // - 1553-155C:  ᕓ
    // - 155E-1569:  ᕞ
    // - 15B8-15C3:  ᖸ
    // - 15DC-15ED:  ᗜ            10
    // - 15F5-1600:  ᗵ
    // - 1614-1621:  ᘔ
    // - 1622-162D:  ᘢ
    //
    // ## JISON identifier formats ##
    // 
    // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
    //   These represent the token ID number.
    //   
    //   -> (1+2) start-# + end-#
    //   
    // - alias/token value references, e.g. `$token`, `$2`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - alias/token location reference, e.g. `@token`, `@2`
    // 
    //   -> (6) single-@
    // 
    // - alias/token id numbers, e.g. `#token`, `#2`
    // 
    //   -> (3) single-#
    // 
    // - alias/token stack indexes, e.g. `##token`, `##2`
    // 
    //   -> (4) double-#
    // 
    // - result value reference `$$`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - result location reference `@$`
    // 
    //   -> (6) single-@
    // 
    // - rule id number `#$`
    // 
    //   -> (3) single-#
    //   
    // - result stack index `##$`
    // 
    //   -> (4) double-#
    // 
    // - 'negative index' value references, e.g. `$-2`
    // 
    //   -> (8) single-negative-$
    //   
    // - 'negative index' location reference, e.g. `@-2`
    // 
    //   -> (7) single-negative-@
    //   
    // - 'negative index' stack indexes, e.g. `##-2`
    // 
    //   -> (5) double-negative-#
    // 
    
    // count the number of occurrences of ch in src:
    // 
    // function countOccurrences(ch, src) {
    //     let cnt = 0;
    //     let offset = 0;
    //     for (;;) {
    //         let pos = src.indexOf(ch, offset);
    //         if (pos === -1) {
    //             return cnt;
    //         }
    //         cnt++;
    //         offset = pos + 1;
    //     }
    // }
    function countOccurrences(ch, src) {
        let i = ch.codePointAt(0);
        return hash[i] || 0;
    }

    // pick an infrequent occurring character from the given `set`.
    // Preferrably has ZERO occurrences in the given `input`, but otherwise
    // deliver the one with the least number of occurrences.
    function pickChar(set, input) {
        // strip out the spaces:
        set = set.replace(/\s+/g, '');

        assert__default['default'](set.length >= 1);
        let lsidx = 0;
        let lsfreq = Infinity;
        for (let i = 0, l = set.length; i < l; i++) {
            let ch = set[i];
            let freq = countOccurrences(ch);
            if (freq === 0) {
                return ch;
            }
            if (freq < lsfreq) {
                lsfreq = freq;
                lsidx = i;
            }
        }
        return set[lsidx];
    }

    const escCharSet = "ဩ ℹ இ ண ஐ Ϟ ല ઊ";

    // Currently we only need 7 rows of typeIdCharSets. The other rows are commented out but available for future use:
    const typeIdCharSets = [
        "ᐁ  ᐂ  ᐃ  ᐄ  ᐅ  ᐆ  ᐇ  ᐈ  ᐉ  ᐊ  ᐋ  ᐌ  ᐍ  ᐎ  ᐏ  ᐐ  ᐑ  ᐒ  ᐓ  ᐔ  ᐕ  ᐖ  ᐗ  ᐘ  ᐙ  ᐚ  ᐛ  ᐫ  ᐬ  ᐭ  ᐮ",
        //"ᐯ  ᐰ  ᐱ  ᐲ  ᐳ  ᐴ  ᐵ  ᐶ  ᐷ  ᐸ  ᐹ  ᐺ  ᐻ  ᐼ  ᐽ  ᐾ  ᐿ  ᑀ  ᑁ  ᑂ  ᑃ  ᑄ  ᑅ  ᑆ  ᑇ  ᑈ",
        "ᑌ  ᑍ  ᑎ  ᑏ  ᑐ  ᑑ  ᑒ  ᑓ  ᑔ  ᑕ  ᑖ  ᑗ  ᑘ  ᑙ  ᑚ  ᑛ  ᑜ  ᑝ  ᑞ  ᑟ  ᑠ  ᑡ  ᑢ  ᑣ  ᑤ  ᑥ  ᑧ  ᑨ  ᑩ  ᑪ",
        "ᑫ  ᑬ  ᑭ  ᑮ  ᑯ  ᑰ  ᑱ  ᑲ  ᑳ  ᑴ  ᑵ  ᑶ  ᑷ  ᑸ  ᑹ  ᑺ  ᑻ  ᑼ  ᑽ  ᑾ  ᑿ  ᒀ  ᒁ  ᒂ  ᒅ  ᒆ  ᒇ  ᒈ",
        //"ᒉ  ᒊ  ᒋ  ᒌ  ᒍ  ᒎ  ᒏ  ᒐ  ᒑ  ᒒ  ᒓ  ᒔ  ᒕ  ᒖ  ᒗ  ᒘ  ᒙ  ᒚ  ᒛ  ᒜ  ᒝ  ᒞ  ᒟ  ᒠ",
        //"ᒣ  ᒤ  ᒥ  ᒦ  ᒧ  ᒨ  ᒩ  ᒪ  ᒫ  ᒬ  ᒭ  ᒮ  ᒯ  ᒰ  ᒱ  ᒲ  ᒳ  ᒴ  ᒵ  ᒶ  ᒷ  ᒸ  ᒹ  ᒺ",
        //"ᓓ  ᓔ  ᓕ  ᓖ  ᓗ  ᓘ  ᓙ  ᓚ  ᓛ  ᓜ  ᓝ  ᓞ  ᓟ  ᓠ  ᓡ  ᓢ  ᓣ  ᓤ  ᓥ  ᓦ  ᓧ  ᓨ  ᓩ",
        //"ᓭ  ᓮ  ᓯ  ᓰ  ᓱ  ᓲ  ᓳ  ᓴ  ᓵ  ᓶ  ᓷ  ᓸ  ᓹ  ᓺ  ᓻ  ᓼ  ᓽ  ᓾ  ᓿ  ᔀ  ᔁ  ᔂ  ᔃ  ᔄ",
        //"ᔐ  ᔑ  ᔒ  ᔓ  ᔔ  ᔕ  ᔖ  ᔗ  ᔘ  ᔙ  ᔚ  ᔛ  ᔜ  ᔝ  ᔞ  ᔟ  ᔠ  ᔡ  ᔢ  ᔣ  ᔤ",
        "ᔦ  ᔧ  ᔨ  ᔩ  ᔪ  ᔫ  ᔬ  ᔭ  ᔮ  ᔯ  ᔰ  ᔱ  ᔲ  ᔳ  ᔴ  ᔵ  ᔶ  ᔷ  ᔸ  ᔹ  ᔺ  ᔻ  ᔼ  ᔽ",
        //"ᓀ  ᓁ  ᓂ  ᓃ  ᓄ  ᓅ  ᓆ  ᓇ  ᓈ  ᓉ  ᓊ  ᓋ  ᓌ  ᓍ  ᓎ  ᓏ",
        //"ᕂ  ᕃ  ᕄ  ᕅ  ᕆ  ᕇ  ᕈ  ᕉ  ᕊ  ᕋ  ᕌ  ᕍ  ᕎ  ᕏ",
        //"ᕞ  ᕟ  ᕠ  ᕡ  ᕢ  ᕣ  ᕤ  ᕥ  ᕦ  ᕧ  ᕨ  ᕩ",
        //"ᖸ  ᖹ  ᖺ  ᖻ  ᖼ  ᖽ  ᖾ  ᖿ  ᗀ  ᗁ  ᗂ  ᗃ",
        "ᗜ  ᗝ  ᗞ  ᗟ  ᗠ  ᗡ  ᗢ  ᗣ  ᗤ  ᗥ  ᗦ  ᗧ  ᗨ  ᗩ  ᗪ  ᗫ  ᗬ  ᗭ",
        //"ᗯ  ᗰ  ᗱ  ᗲ  ᗳ  ᗴ  ᗵ  ᗶ  ᗷ  ᗸ  ᗹ  ᗺ  ᗻ  ᗼ  ᗽ  ᗾ  ᗿ  ᘀ",
        "ᘔ  ᘕ  ᘖ  ᘗ  ᘘ  ᘙ  ᘚ  ᘛ  ᘜ  ᘝ  ᘞ  ᘟ  ᘠ  ᘡ",
        //"ᘢ  ᘣ  ᘤ  ᘥ  ᘦ  ᘧ  ᘨ  ᘩ  ᘪ  ᘫ  ᘬ  ᘭ  ᘴ  ᘵ  ᘶ  ᘷ  ᘸ  ᘹ",
        //"ᕓ  ᕔ  ᕕ  ᕖ  ᕗ  ᕘ  ᕙ  ᕚ  ᕛ  ᕜ",
        "ᗄ  ᗅ  ᗆ  ᗇ  ᗈ  ᗉ  ᗊ  ᗋ  ᗌ  ᗍ  ᗎ  ᗏ  ᗐ  ᗑ  ᗒ  ᗓ  ᗔ  ᗕ  ᗖ  ᗗ  ᗘ  ᗙ  ᗚ  ᗛ",
    ];

    //const I = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ';   // 1..12, but accepted as IdentifierStart in JavaScript :-) 

    // Probable speed improvement: scan a single time through the (probably large) input source,
    // looking for all characters in parallel, instead of scanning N times through there:
    // construct a regex to dig out all potential occurrences and take it from there.
    let reStr = escCharSet + typeIdCharSets.join("");
    reStr = reStr.replace(/\s+/g, '');
    const re = new RegExp(`[${reStr}]`, 'g');
    var hash = new Array(0xD800);
    let m;
    while ((m = re.exec(input)) !== null) {
        let i = m[0].codePointAt();
        hash[i] = (hash[i] || 0) + 1;
    }

    //
    // The basic shapes are:
    // 
    // - 1401-141B:  ᐁ             1
    // - 142F-1448:  ᐯ             2
    // - 144C-1465:  ᑌ             3
    // - 146B-1482:  ᑫ             4
    // - 1489-14A0:  ᒉ             5  
    // - 14A3-14BA:  ᒣ             6 
    // - 14C0-14CF:  ᓀ             
    // - 14D3-14E9:  ᓓ             7
    // - 14ED-1504:  ᓭ             8
    // - 1510-1524:  ᔐ             9
    // - 1526-153D:  ᔦ 
    // - 1542-154F:  ᕂ
    // - 1553-155C:  ᕓ
    // - 155E-1569:  ᕞ
    // - 15B8-15C3:  ᖸ
    // - 15DC-15ED:  ᗜ            10
    // - 15F5-1600:  ᗵ
    // - 1614-1621:  ᘔ
    // - 1622-162D:  ᘢ
    //
    // ## JISON identifier formats ##
    // 
    // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
    //   These represent the token ID number.
    //   
    //   -> (1+2) start-# + end-#
    //   
    // - alias/token value references, e.g. `$token`, `$2`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - alias/token location reference, e.g. `@token`, `@2`
    // 
    //   -> (6) single-@
    // 
    // - alias/token id numbers, e.g. `#token`, `#2`
    // 
    //   -> (3) single-#
    // 
    // - alias/token stack indexes, e.g. `##token`, `##2`
    // 
    //   -> (4) double-#
    // 
    // - result value reference `$$`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - result location reference `@$`
    // 
    //   -> (6) single-@
    // 
    // - rule id number `#$`
    // 
    //   -> (3) single-#
    //   
    // - result stack index `##$`
    // 
    //   -> (4) double-#
    // 
    // - 'negative index' value references, e.g. `$-2`
    // 
    //   -> (8) single-negative-$
    //   
    // - 'negative index' location reference, e.g. `@-2`
    // 
    //   -> (7) single-negative-@
    //   
    // - 'negative index' stack indexes, e.g. `##-2`
    // 
    //   -> (5) double-negative-#
    // 

    const escChar = pickChar(escCharSet);
    let typeIdChar = [];
    for (let i = 0, l = typeIdCharSets.length; i < l; i++) {
        typeIdChar[i] = pickChar(typeIdCharSets[i]);
    }

    // produce a function set for encoding and decoding content, 
    // plus the basic strings to build regexes for matching the various jison
    // identifier types:
    return {
        // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
        //   These represent the token ID number.
        //   
        //   -> (1) start-#
        tokenDirectIdentifierStart: escChar + typeIdChar[0],
        tokenDirectIdentifierRe: new XRegExp__default['default'](`#(${ID_REGEX_BASE})#`, 'g'),

        // - alias/token value references, e.g. `$token`, `$2`
        // 
        //   -> $ is an accepted starter, so no encoding required
        // - result value reference `$$`
        // 
        //   -> $ is an accepted starter, so no encoding required
        tokenValueReferenceStart: '$',
        tokenValueReferenceRe: new XRegExp__default['default'](`$(${ID_REGEX_BASE})|$([0-9]+)`, 'g'),

        // - alias/token location reference, e.g. `@token`, `@2`
        // 
        //   -> (6) single-@
        // - result location reference `@$`
        // 
        //   -> (6) single-@
        tokenLocationStart: escChar + typeIdChar[1],
        tokenLocationRe: new XRegExp__default['default'](`@(${ID_REGEX_BASE})|@([0-9]+)`, 'g'),

        // - alias/token id numbers, e.g. `#token`, `#2`
        // 
        //   -> (3) single-#
        // - rule id number `#$`
        // 
        //   -> (3) single-#
        tokenIdentifierStart: escChar + typeIdChar[2],
        tokenIdentifierRe: new XRegExp__default['default'](`#(${ID_REGEX_BASE})|#([0-9]+)`, 'g'),
        
        // - alias/token stack indexes, e.g. `##token`, `##2`
        // 
        //   -> (4) double-#
        // - result stack index `##$`
        // 
        //   -> (4) double-#
        tokenStackIndexStart: escChar + typeIdChar[3],
        tokenStackIndexRe: new XRegExp__default['default'](`##(${ID_REGEX_BASE})|##([0-9]+)`, 'g'),

        // - 'negative index' value references, e.g. `$-2`
        // 
        //   -> (8) single-negative-$
        tokenNegativeValueReferenceStart: escChar + typeIdChar[4],
        tokenValueReferenceRe: new XRegExp__default['default'](`$-([0-9]+)`, 'g'),
           
        // - 'negative index' location reference, e.g. `@-2`
        // 
        //   -> (7) single-negative-@
        tokenNegativeLocationStart: escChar + typeIdChar[5],
        tokenNegativeLocationRe: new XRegExp__default['default'](`@-([0-9]+)`, 'g'),
           
        // - 'negative index' stack indexes, e.g. `##-2`
        // 
        //   -> (5) double-negative-#
        tokenNegativeStackIndexStart: escChar + typeIdChar[6],
        tokenNegativeStackIndexRe: new XRegExp__default['default'](`#-([0-9]+)`, 'g'),

        // combined regex for encoding direction
        tokenDetect4EncodeRe: new XRegExp__default['default'](`([^$@#${IN_ID_CHARSET}])([$@#]|##)(${ID_REGEX_BASE}|[$]|-?[0-9]+)(#?)(?![$@#${IN_ID_CHARSET}])`, 'g'),

        // combined regex for decoding direction
        tokenDetect4DecodeRe: new XRegExp__default['default'](`([^$${IN_ID_CHARSET}])(${escChar}[${typeIdChar.slice(0,7).join('')}])(${ID_REGEX_BASE}|[$]|[0-9]+)(?![$@#${IN_ID_CHARSET}])`, 'g'),

        encode: function encodeJisonTokens(src, locationOffsetSpec) {
            let re = this.tokenDetect4EncodeRe;

            // reset regex
            re.lastIndex = 0;            

            // patch `src` for the lookbehind emulation in the main regex used:
            src = ' ' + src;

            // Perform the encoding, one token at a time via callback function.
            // 
            // Note: all erroneous inputs are IGNORED as those MAY be part of a string
            // or comment, where they are perfectly legal.
            // This is a tad sub-optimal as we won't be able to report errors early 
            // but otherwise we would be rejecting some potentially *legal* action code
            // and we DO NOT want to be pedantically strict while we are unable to parse
            // the input very precisely yet.
            src = src.replace(re, (m, p1, p2, p3, p4, offset) => {
                // p1 is only serving as lookbehind emulation
                 
                switch (p2) {
                case '$':
                    // no encoding required UNLESS it's a negative index; p4 MUST be empty
                    if (p4 !== '') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3} cannot be followed by ${p4}`, src, offset + p1.length + p2.length + p3.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p3[0] === '-') {
                        return p1 + this.tokenNegativeValueReferenceStart + p3.substring(1);
                    }
                    return p1 + p2 + p3;

                case '##':
                    // p4 MUST be empty
                    if (p4 !== '') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3} cannot be followed by ${p4}`, src, offset + p1.length + p2.length + p3.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p3[0] === '-') {
                        return p1 + this.tokenNegativeStackIndexStart + p3.substring(1);
                    }
                    return p1 + this.tokenStackIndexStart + p3;

                case '@':
                    // p4 MUST be empty
                    if (p4 !== '') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3} cannot be followed by ${p4}`, src, offset + p1.length + p2.length + p3.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p3[0] === '-') {
                        return p1 + this.tokenNegativeLocationStart + p3.substring(1);
                    }
                    return p1 + this.tokenLocationStart + p3;

                case '#':
                    // p4 MAY be non-empty; p3 CANNOT be a negative value or token ID
                    if (p3[0] === '-') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3 + p4} is an illegal negative reference type`, src, offset + p1.length + p2.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p4 !== '') {
                        return p1 + this.tokenDirectIdentifierStart + p3;
                    }
                    return p1 + this.tokenIdentifierStart + p3;

                // no default case needed as all possible matches are handled in the cases above.
                }
            });

            // and remove the added prefix which was used for lookbehind emulation:
            return src.substring(1);
        },

        decode: function decodeJisonTokens(src, locationOffsetSpec) {
            let re = this.tokenDetect4DecodeRe;

            // reset regex
            re.lastIndex = 0;            

            // patch `src` for the lookbehind emulation in the main regex used:
            src = ' ' + src;

            // Perform the encoding, one token at a time via callback function.
            // 
            // Note: all erroneous inputs are IGNORED as those MAY be part of a string
            // or comment, where they are perfectly legal.
            // This is a tad sub-optimal as we won't be able to report errors early 
            // but otherwise we would be rejecting some potentially *legal* action code
            // and we DO NOT want to be pedantically strict while we are unable to parse
            // the input very precisely yet.
            src = src.replace(re, (m, p1, p2, p3, offset) => {
                // p1 is only serving as lookbehind emulation
                
                switch (p2) {
                case this.tokenNegativeValueReferenceStart:
                    return p1 + "$-" + p3;

                case this.tokenNegativeStackIndexStart:
                    return p1 + "##-" + p3;

                case this.tokenStackIndexStart:
                    return p1 + "##" + p3;

                case this.tokenNegativeLocationStart:
                    return p1 + "@-" + p3;

                case this.tokenLocationStart:
                    return p1 + "@" + p3;

                case this.tokenDirectIdentifierStart:
                    // p3 CANNOT be a negative value or token ID
                    if (p3[0] === '-') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3 + p4} is an illegal negative reference type`, src, offset + p1.length + p2.length);
                        }
                        return p1 + p2 + p3;
                    }
                    return p1 + '#' + p3 + '#';

                case this.tokenIdentifierStart:
                    // p3 CANNOT be a negative value or token ID
                    if (p3[0] === '-') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3 + p4} is an illegal negative reference type`, src, offset + p1.length + p2.length);
                        }
                        return p1 + p2 + p3;
                    }
                    return p1 + '#' + p3;

                default:
                    if (locationOffsetSpec) {
                        locationOffsetSpec.reportLocation(`syntax error: unexpected jison token sentinel escape ${p2} at ${p2 + p3}`, src, offset + p1.length);
                    }
                    return p1 + p2 + p3;
                }
            });

            // and remove the added prefix which was used for lookbehind emulation:
            return src.substring(1);
        },
    };
}









function parseCodeChunkToAST(src, options) {
    let s = options.mapper4JisonGrammarIdentifiers.encode(src, options.mapperErrorReporter);
    let ast = recast__default['default'].parse(s);
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
      
      ignore: [
        "node_modules/**/*.js"
      ],
      compact: false,
      retainLines: false,
      presets: [
        ["@babel/preset-env", {
          targets: {
            browsers: ["last 2 versions"],
            node: "8.0"
          }
        }]
      ]
    }, options);

    return babel.transformSync(src, options); // => { code, map, ast }
}


function prettyPrintAST(ast, options) {
    const defaultOptions = { 
        tabWidth: 2,
        quote: 'single',
        arrowParensAlways: true,

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        reuseWhitespace: false
    };

    let s = recast__default['default'].prettyPrint(ast, defaultOptions);
    let new_src = s.code;

    new_src = new_src
    .replace(/\r\n|\n|\r/g, '\n');    // platform dependent EOL fixup

    // backpatch possible jison variables extant in the prettified code:
    let dst = options.mapper4JisonGrammarIdentifiers.decode(new_src, options.mapperErrorReporter);

    return dst;
}




// validate the given JISON+JavaScript snippet: does it compile?
// 
// Return either the parsed AST (object) or an error message (string). 
function checkActionBlock(src, yylloc, options) {
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
        var rv = parseCodeChunkToAST(src, options);
        return false;
    } catch (ex) {
        return ex.message || "code snippet cannot be parsed";
    }
}



// The rough-and-ready preprocessor for any action code block:
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
    var s = src.trim();
    // remove outermost set of braces UNLESS there's
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
    generateMapper4JisonGrammarIdentifiers,
    parseCodeChunkToAST,
    compileCodeToES5,
    prettyPrintAST,
    checkActionBlock,
    trimActionCode,

    ID_REGEX_BASE,
    IN_ID_CHARSET,
};

function chkBugger$1(src) {
    src = String(src);
    if (src.match(/\bcov_\w+/)) {
        console.error('### ISTANBUL COVERAGE CODE DETECTED ###\n', src);
    }
}


/// HELPER FUNCTION: print the function in source code form, properly indented.
/** @public */
function printFunctionSourceCode(f) {
    var src = String(f);
    chkBugger$1(src);
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







var stringifier = {
	printFunctionSourceCode,
	printFunctionSourceCodeContainer,
};

// 
// 
// 
function detectIstanbulGlobal() {
    const gcv = "__coverage__";
    const globalvar = new Function('return this')();
    var coverage = globalvar[gcv];
    return coverage || false;
}

//
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
function checkRegExp(re_src, re_flags, XRegExp) {
    var re;

    // were we fed a RegExp object or a string?
    if (re_src
        && typeof re_src.source === 'string'
        && typeof re_src.flags === 'string'
        && typeof re_src.toString === 'function'
        && typeof re_src.test === 'function'
        && typeof re_src.exec === 'function'
    ) {
        // we're looking at a RegExp (or XRegExp) object, so we can trust the `.source` member
        // and the `.toString()` method to produce something that's compileable by XRegExp
        // at least...
        if (!re_flags || re_flags === re_src.flags) {
            // no change of flags: we assume it's okay as it's already contained
            // in an RegExp or XRegExp object
            return false;
        }
    }
    // we DO accept empty regexes: `''` but we DO NOT accept null/undefined
    if (re_src == null) {
        return new Error('invalid regular expression source: ' + re_src);
    }

    re_src = '' + re_src;
    if (re_flags == null) {
        re_flags = undefined;       // `new RegExp(..., flags)` will barf a hairball when `flags===null`
    } else {
        re_flags = '' + re_flags;
    }

    XRegExp = XRegExp || RegExp;

    try {
        re = new XRegExp(re_src, re_flags);
    } catch (ex) {
        return ex;
    }
    return false;
}

// provide some info about the given regex.
//
// You can specify an (advanced or regular) regex class as a third parameter.
// The default assumed is the standard JavaScript `RegExp` class.
//
// Return FALSE when the input is not a legal regex.
function getRegExpInfo(re_src, re_flags, XRegExp) {
    var re1, re2, m1, m2;

    // were we fed a RegExp object or a string?
    if (re_src
        && typeof re_src.source === 'string'
        && typeof re_src.flags === 'string'
        && typeof re_src.toString === 'function'
        && typeof re_src.test === 'function'
        && typeof re_src.exec === 'function'
    ) {
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
            re_flags = undefined;       // `new RegExp(..., flags)` will barf a hairball when `flags===null`
        } else {
            re_flags = '' + re_flags;
        }
    }

    XRegExp = XRegExp || RegExp;

    try {
        // A little trick to obtain the captures from a regex:
        // wrap it and append `(?:)` to ensure it matches
        // the empty string, then match it against it to
        // obtain the `match` array.
        re1 = new XRegExp(re_src, re_flags);
        re2 = new XRegExp('(?:' + re_src + ')|(?:)', re_flags);
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

var path = [];

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
                path.push('[' + i + ']');
                dst[i] = shallow_copy_and_strip_depth(dst[i], parentKey + '[' + i + ']');
                path.pop();
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
                cyclerefpath.push(path.join('.'));
                linkref.push(v);
                linkrefpath.push(path.join('.'));

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
            path.push('[' + key + ']');

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
                    path.push('value_stack');
                    err.value_stack = treat_value_stack(err.value_stack);
                    path.pop();
                }
            }

            inf[key] = err;

            path.pop();
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
        path.push('__error_infos');
        l.__error_infos = treat_value_stack(l.__error_infos);
        path.pop();
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
        path.push('__error_infos');
        p.__error_infos = treat_value_stack(p.__error_infos);
        path.pop();
    }

    if (p.__error_recovery_infos) {
        path.push('__error_recovery_infos');
        p.__error_recovery_infos = treat_value_stack(p.__error_recovery_infos);
        path.pop();
    }

    if (p.lexer) {
        path.push('lexer');
        p.lexer = treat_lexer(p.lexer);
        path.pop();
    }

    return p;
}

function treat_hash(h) {
    // shallow copy object:
    h = shallow_copy(h);

    if (h.parser) {
        path.push('parser');
        h.parser = treat_parser(h.parser);
        path.pop();
    }

    if (h.lexer) {
        path.push('lexer');
        h.lexer = treat_lexer(h.lexer);
        path.push();
    }

    return h;
}

function treat_error_report_info(e) {
    // shallow copy object:
    e = shallow_copy(e);
    
    if (e && e.hash) {
        path.push('hash');
        e.hash = treat_hash(e.hash);
        path.pop();
    }

    if (e.parser) {
        path.push('parser');
        e.parser = treat_parser(e.parser);
        path.pop();
    }

    if (e.lexer) {
        path.push('lexer');
        e.lexer = treat_lexer(e.lexer);
        path.pop();
    }    

    if (e.__error_infos) {
        path.push('__error_infos');
        e.__error_infos = treat_value_stack(e.__error_infos);
        path.pop();
    }

    if (e.__error_recovery_infos) {
        path.push('__error_recovery_infos');
        e.__error_recovery_infos = treat_value_stack(e.__error_recovery_infos);
        path.pop();
    }

    trim_array_tail(e.symbol_stack);
    trim_array_tail(e.state_stack);
    trim_array_tail(e.location_stack);
    if (e.value_stack) {
        path.push('value_stack');
        e.value_stack = treat_value_stack(e.value_stack);
        path.pop();
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
                cyclerefpath.push(path.join('.'));
                linkref.push(e);
                linkrefpath.push(path.join('.'));

                e = treat_error_report_info(e);
                
                cycleref.pop();
                cyclerefpath.pop();
            }
        }
    }
    return e;
}


// strip off large chunks from the Error exception object before
// it will be fed to a test log or other output.
// 
// Internal use in the unit test rigs.
function trimErrorForTestReporting(e) {
    cycleref.length = 0;
    cyclerefpath.length = 0;
    linkref.length = 0;
    linkrefpath.length = 0;
    path = ['*'];

    if (e) {
        e = treat_object(e);
    }

    cycleref.length = 0;
    cyclerefpath.length = 0;
    linkref.length = 0;
    linkrefpath.length = 0;
    path = ['*'];

    return e;
}

var index = {
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

    generateMapper4JisonGrammarIdentifiers: parse2AST.generateMapper4JisonGrammarIdentifiers,
    parseCodeChunkToAST: parse2AST.parseCodeChunkToAST,
    compileCodeToES5: parse2AST.compileCodeToES5,
    prettyPrintAST: parse2AST.prettyPrintAST,
    checkActionBlock: parse2AST.checkActionBlock,
    trimActionCode: parse2AST.trimActionCode,

    ID_REGEX_BASE: parse2AST.ID_REGEX_BASE,
    IN_ID_CHARSET: parse2AST.IN_ID_CHARSET,

    printFunctionSourceCode: stringifier.printFunctionSourceCode,
    printFunctionSourceCodeContainer: stringifier.printFunctionSourceCodeContainer,

    detectIstanbulGlobal,
};

module.exports = index;
