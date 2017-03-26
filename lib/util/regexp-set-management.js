//
// Helper library for set definitions
//
// MIT Licensed
//
//
// This code is intended to help parse regex set expressions and mix them
// together, i.e. to answer questions like this:
// 
// what is the resulting regex set expression when we mix the regex set
// `[a-z]` with the regex set `[^\s]` where with 'mix' we mean that any
// input which matches either input regex should match the resulting
// regex set. (a.k.a. Full Outer Join, see also http://www.diffen.com/difference/Inner_Join_vs_Outer_Join)
// 

'use strict';

var XRegExp = require('xregexp');
var assert = require('assert');




const XREGEXP_UNICODE_ESCAPE_RE = /^\{[A-Za-z0-9 \-\._]+\}/;              // Matches the XRegExp Unicode escape braced part, e.g. `{Number}`
const CHR_RE = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\})/;
const SET_PART_RE = /^(?:[^\\\]]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\})+/;
const NOTHING_SPECIAL_RE = /^(?:[^\\\[\]\(\)\|^\{\}]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\})+/;
const SET_IS_SINGLE_PCODE_RE = /^\\[dDwWsS]$|^\\p\{[A-Za-z0-9 \-\._]+\}$/;

const UNICODE_BASE_PLANE_MAX_CP = 65535;

// The expanded regex sets which are equivalent to the given `\\{c}` escapes:
//
// `/\s/`:
const WHITESPACE_SETSTR = ' \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';     
// `/\d/`:
const DIGIT_SETSTR = '0-9';
// `/\w/`:
const WORDCHAR_SETSTR = 'A-Za-z0-9_';





// Helper for `bitarray2set()`: convert character code to a representation string suitable for use in a regex
function i2c(i) {
    var c, x;

    switch (i) {
    case 10:
        return '\\n';

    case 13:
        return '\\r';

    case 9:
        return '\\t';

    case 8:
        return '\\b';

    case 12:
        return '\\f';

    case 11:
        return '\\v';

    case 45:        // ASCII/Unicode for '-' dash
        return '\\-';

    case 91:        // '['
        return '\\[';

    case 92:        // '\\'
        return '\\\\';

    case 93:        // ']'
        return '\\]';

    case 94:        // ']'
        return '\\^';
    }
    if (i < 32
            || i > 0xFFF0 /* Unicode Specials, also in UTF16 */
            || (i >= 0xD800 && i <= 0xDFFF) /* Unicode Supplementary Planes; we're TOAST in JavaScript as we're NOT UTF-16 but UCS-2! */
            || String.fromCharCode(i).match(/[\u2028\u2029]/) /* Code compilation via `new Function()` does not like to see these, or rather: treats them as just another form of CRLF, which breaks your generated regex code! */
        ) {
        // Detail about a detail:
        // U+2028 and U+2029 are part of the `\s` regex escape code (`\s` and `[\s]` match either of these) and when placed in a JavaScript
        // source file verbatim (without escaping it as a `\uNNNN` item) then JavaScript will interpret it as such and consequently report
        // a b0rked generated parser, as the generated code would include this regex right here.
        // Hence we MUST escape these buggers everywhere we go...
        x = i.toString(16);
        if (x.length >= 1 && i <= 0xFFFF) {
          c = '0000' + x;
          return '\\u' + c.substr(c.length - 4);
        } else {
          return '\\u{' + x + '}';
        }
    }
    return String.fromCharCode(i);
}


// Helper collection for `bitarray2set()`: we have expanded all these cached `\\p{NAME}` regex sets when creating
// this bitarray and now we should look at these expansions again to see if `bitarray2set()` can produce a
// `\\p{NAME}` shorthand to represent [part of] the bitarray:
var Pcodes_bitarray_cache = {};
var Pcodes_bitarray_cache_test_order = [];

// Helper collection for `bitarray2set()` for minifying special cases of result sets which can be represented by 
// a single regex 'escape', e.g. `\d` for digits 0-9.
var EscCode_bitarray_output_refs;

// now initialize the EscCodes_... table above:
init_EscCode_lookup_table();

function init_EscCode_lookup_table() {
    var s, bitarr, set2esc = {}, esc2bitarr = {};

    // patch global lookup tables for the time being, while we calculate their *real* content in this function:
    EscCode_bitarray_output_refs = {
        esc2bitarr: {},
        set2esc: {}
    };
    Pcodes_bitarray_cache_test_order = [];

    // `/\S':
    bitarr = [];
    set2bitarray(bitarr, '^' + WHITESPACE_SETSTR);
    s = bitarray2set(bitarr);
    esc2bitarr['S'] = bitarr;
    set2esc[s] = 'S';
    // set2esc['^' + s] = 's';
    Pcodes_bitarray_cache['\\S'] = bitarr;

    // `/\s':
    bitarr = [];
    set2bitarray(bitarr, WHITESPACE_SETSTR);
    s = bitarray2set(bitarr);
    esc2bitarr['s'] = bitarr;
    set2esc[s] = 's';
    // set2esc['^' + s] = 'S';
    Pcodes_bitarray_cache['\\s'] = bitarr;

    // `/\D':
    bitarr = [];
    set2bitarray(bitarr, '^' + DIGIT_SETSTR);
    s = bitarray2set(bitarr);
    esc2bitarr['D'] = bitarr;
    set2esc[s] = 'D';
    // set2esc['^' + s] = 'd';
    Pcodes_bitarray_cache['\\D'] = bitarr;

    // `/\d':
    bitarr = [];
    set2bitarray(bitarr, DIGIT_SETSTR);
    s = bitarray2set(bitarr);
    esc2bitarr['d'] = bitarr;
    set2esc[s] = 'd';
    // set2esc['^' + s] = 'D';
    Pcodes_bitarray_cache['\\d'] = bitarr;

    // `/\W':
    bitarr = [];
    set2bitarray(bitarr, '^' + WORDCHAR_SETSTR);
    s = bitarray2set(bitarr);
    esc2bitarr['W'] = bitarr;
    set2esc[s] = 'W';
    // set2esc['^' + s] = 'w';
    Pcodes_bitarray_cache['\\W'] = bitarr;

    // `/\w':
    bitarr = [];
    set2bitarray(bitarr, WORDCHAR_SETSTR);
    s = bitarray2set(bitarr);
    esc2bitarr['w'] = bitarr;
    set2esc[s] = 'w';
    // set2esc['^' + s] = 'W';
    Pcodes_bitarray_cache['\\w'] = bitarr;

    EscCode_bitarray_output_refs = {
        esc2bitarr: esc2bitarr,
        set2esc: set2esc
    };

    updatePcodesBitarrayCacheTestOrder();
} 

function updatePcodesBitarrayCacheTestOrder(opts) {
    var t = new Array(UNICODE_BASE_PLANE_MAX_CP + 1);
    var l = {};
    var user_has_xregexp = opts && opts.options && opts.options.xregexp;
    var i, j, k, ba;

    // mark every character with which regex pcodes they are part of:
    for (k in Pcodes_bitarray_cache) {
        ba = Pcodes_bitarray_cache[k];

        if (!user_has_xregexp && k.indexOf('\\p{') >= 0) {
            continue;
        }

        var cnt = 0;
        for (i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
            if (ba[i]) {
                cnt++;
                if (!t[i]) {
                    t[i] = [k];
                } else {
                    t[i].push(k);
                }
            }
        }
        l[k] = cnt;
    }

    // now dig out the unique ones: only need one per pcode.
    // 
    // We ASSUME every \\p{NAME} 'pcode' has at least ONE character
    // in it that is ONLY matched by that particular pcode. 
    // If this assumption fails, nothing is lost, but our 'regex set
    // optimized representation' will be sub-optimal as than this pcode
    // won't be tested during optimization. 
    // 
    // Now that would be a pity, so the assumption better holds...
    // Turns out the assumption doesn't hold already for /\S/ + /\D/
    // as the second one (\D) is a pure subset of \S. So we have to
    // look for markers which match multiple escapes/pcodes for those
    // ones where a unique item isn't available...
    var lut = [];
    var done = {};
    var keys = Object.keys(Pcodes_bitarray_cache);

    for (i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
        k = t[i][0];
        if (t[i].length === 1 && !done[k]) {
            assert(l[k] > 0);
            lut.push([i, k]);
            done[k] = true;
        }
    }

    for (j = 0; keys[j]; j++) {
        k = keys[j];

        if (!user_has_xregexp && k.indexOf('\\p{') >= 0) {
            continue;
        }
        
        if (!done[k]) {
            assert(l[k] > 0);
            // find a minimum span character to mark this one:
            var w = Infinity;
            var rv;
            ba = Pcodes_bitarray_cache[k];
            for (i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
                if (ba[i]) {
                    var tl = t[i].length;
                    if (tl > 1 && tl < w) {
                        assert(l[k] > 0);
                        rv = [i, k];
                        w = tl;
                    }
                }
            }
            if (rv) {
                done[k] = true;
                lut.push(rv);
            }
        }
    }

    // order from large set to small set so that small sets don't gobble
    // characters also represented by overlapping larger set pcodes.
    // 
    // Again we assume something: that finding the large regex pcode sets
    // before the smaller, more specialized ones, will produce a more
    // optimal minification of the regex set expression. 
    // 
    // This is a guestimate/heuristic only!
    lut.sort(function (a, b) {
        var k1 = a[1];
        var k2 = b[1];
        var ld = l[k2] - l[k1];
        if (ld) {
            return ld;
        }
        // and for same-size sets, order from high to low unique identifier.
        return b[0] - a[0];
    });

    Pcodes_bitarray_cache_test_order = lut;
}






// 'Join' a regex set `[...]` into a Unicode range spanning logic array, flagging every character in the given set.
function set2bitarray(bitarr, s, opts) {
    var orig = s;
    var set_is_inverted = false;
    var bitarr_orig;

    function mark(d1, d2) {
        if (d2 == null) d2 = d1;
        for (var i = d1; i <= d2; i++) {
            bitarr[i] = true;
        }
    }

    function add2bitarray(dst, src) {
        for (var i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
            if (src[i]) {
                dst[i] = true;
            }
        }
    }

    function eval_escaped_code(s) {
        var c;
        // decode escaped code? If none, just take the character as-is
        if (s.indexOf('\\') === 0) {
            var l = s.substr(0, 2);
            switch (l) {
            case '\\c':
                c = s.charCodeAt(2) - 'A'.charCodeAt(0) + 1;
                return String.fromCharCode(c);

            case '\\x':
                s = s.substr(2);
                c = parseInt(s, 16);
                return String.fromCharCode(c);

            case '\\u':
                s = s.substr(2);
                if (s[0] === '{') {
                    s = s.substr(1, s.length - 2);
                }
                c = parseInt(s, 16);
                if (c >= 0x10000) {
                  return new Error('We do NOT support Extended Plane Unicode Codepoints (i.e. CodePoints beyond U:FFFF) in regex set expressions, e.g. \\u{' + s + '}');
                }
                return String.fromCharCode(c);

            case '\\0':
            case '\\1':
            case '\\2':
            case '\\3':
            case '\\4':
            case '\\5':
            case '\\6':
            case '\\7':
                s = s.substr(1);
                c = parseInt(s, 8);
                return String.fromCharCode(c);

            case '\\r':
                return '\r';

            case '\\n':
                return '\n';

            case '\\v':
                return '\v';

            case '\\f':
                return '\f';

            case '\\t':
                return '\t';

            case '\\b':
                return '\b';

            default:
                // just the character itself:
                return s.substr(1);
            }
        } else {
            return s;
        }
    }

    if (s && s.length) {
        var c1, c2;

        // inverted set?
        if (s[0] === '^') {
            set_is_inverted = true;
            s = s.substr(1);
            bitarr_orig = bitarr;
            bitarr = new Array(UNICODE_BASE_PLANE_MAX_CP + 1);
        }

        // BITARR collects flags for characters set. Inversion means the complement set of character is st instead.
        // This results in an OR operations when sets are joined/chained.

        while (s.length) {
            c1 = s.match(CHR_RE);
            if (!c1) {
                // hit an illegal escape sequence? cope anyway!
                c1 = s[0];
            } else {
                c1 = c1[0];
                // Quick hack for XRegExp escapes inside a regex `[...]` set definition: we *could* try to keep those
                // intact but it's easier to unfold them here; this is not nice for when the grammar specifies explicit
                // XRegExp support, but alas, we'll get there when we get there... ;-)
                switch (c1) {
                case '\\p':
                    s = s.substr(c1.length);
                    c2 = s.match(XREGEXP_UNICODE_ESCAPE_RE);
                    if (c2) {
                        c2 = c2[0];
                        s = s.substr(c2.length);
                        // do we have this one cached already?
                        var pex = c1 + c2;
                        var ba4p = Pcodes_bitarray_cache[pex];
                        if (!ba4p) {
                            // expand escape:
                            var xr = new XRegExp('[' + pex + ']');           // TODO: case-insensitive grammar???
                            // rewrite to a standard `[...]` regex set: XRegExp will do this for us via `XRegExp.toString()`:
                            var xs = '' + xr;
                            // remove the wrapping `/.../` to get at the (possibly *combined* series of) `[...]` sets inside:
                            xs = xs.substr(1, xs.length - 2);

                            ba4p = reduceRegexToSetBitArray(xs, pex, opts);

                            Pcodes_bitarray_cache[pex] = ba4p;
                            updatePcodesBitarrayCacheTestOrder(opts);
                        }
                        // merge bitarrays:
                        add2bitarray(bitarr, ba4p);
                        continue;
                    }
                    break;

                case '\\S':
                case '\\s':
                case '\\W':
                case '\\w':
                case '\\d':
                case '\\D':
                    // these can't participate in a range, but need to be treated special:
                    s = s.substr(c1.length);
                    // check for \S, \s, \D, \d, \W, \w and expand them:
                    var ba4e = EscCode_bitarray_output_refs.esc2bitarr[c1[1]];
                    assert(ba4e);
                    add2bitarray(bitarr, ba4e);
                    continue;

                case '\\b':
                    // matches a backspace: https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions#special-backspace
                    c1 = '\u0008';
                    break;
                }
            }
            var v1 = eval_escaped_code(c1);
            // propagate deferred exceptions = error reports.
            if (v1 instanceof Error) {
                return v1;
            }
            v1 = v1.charCodeAt(0);
            s = s.substr(c1.length);

            if (s[0] === '-' && s.length >= 2) {
                // we can expect a range like 'a-z':
                s = s.substr(1);
                c2 = s.match(CHR_RE);
                if (!c2) {
                    // hit an illegal escape sequence? cope anyway!
                    c2 = s[0];
                } else {
                    c2 = c2[0];
                }
                var v2 = eval_escaped_code(c2);
                // propagate deferred exceptions = error reports.
                if (v2 instanceof Error) {
                    return v1;
                }
                v2 = v2.charCodeAt(0);
                s = s.substr(c2.length);

                // legal ranges go UP, not /DOWN!
                if (v1 <= v2) {
                    mark(v1, v2);
                } else {
                    console.warn('INVALID CHARACTER RANGE found in regex: ', { re: orig, start: c1, start_n: v1, end: c2, end_n: v2 });
                    mark(v1);
                    mark('-'.charCodeAt(0));
                    mark(v2);
                }
                continue;
            }
            mark(v1);
        }

        // When we have marked all slots, '^' NEGATES the set, hence we flip all slots.
        // 
        // Since a regex like `[^]` should match everything(?really?), we don't need to check if the MARK
        // phase actually marked anything at all: the `^` negation will correctly flip=mark the entire
        // range then.
        if (set_is_inverted) {
            for (var i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
                if (!bitarr[i]) {
                    bitarr_orig[i] = true;
                }
            }
        }
    }
    return false;
}


// convert a simple bitarray back into a regex set `[...]` content:
function bitarray2set(l, output_inverted_variant, output_minimized) {
    // construct the inverse(?) set from the mark-set:
    //
    // Before we do that, we inject a sentinel so that our inner loops
    // below can be simple and fast:
    l[UNICODE_BASE_PLANE_MAX_CP + 1] = 1;
    // now reconstruct the regex set:
    var rv = [];
    var i, j, cnt, lut, tn, tspec, match, pcode, ba4pcode, l2;
    var bitarr_is_cloned = false;
    var l_orig = l;

    if (output_inverted_variant) {
        // generate the inverted set, hence all unmarked slots are part of the output range:
        cnt = 0;
        for (i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
            if (!l[i]) {
                cnt++;
            }
        }
        if (cnt === UNICODE_BASE_PLANE_MAX_CP + 1) {
            // When there's nothing in the output we output a special 'match-nothing' regex: `[^\S\s]`.
            // BUT... since we output the INVERTED set, we output the match-all set instead:
            return '\\S\\s';
        }
        else if (cnt === 0) {
            // When we find the entire Unicode range is in the output match set, we replace this with
            // a shorthand regex: `[\S\s]`
            // BUT... since we output the INVERTED set, we output the match-nothing set instead:
            return '^\\S\\s';
        }

        // Now see if we can replace several bits by an escape / pcode:
        if (output_minimized) {
            lut = Pcodes_bitarray_cache_test_order;
            for (tn = 0; lut[tn]; tn++) {
                tspec = lut[tn];
                // check if the uniquely identifying char is in the inverted set:
                if (!l[tspec[0]]) {
                    // check if the pcode is covered by the inverted set:
                    pcode = tspec[1];
                    ba4pcode = Pcodes_bitarray_cache[pcode];
                    match = 0;
                    for (j = 0; j <= UNICODE_BASE_PLANE_MAX_CP; j++) {
                        if (ba4pcode[j]) {
                            if (!l[j]) {
                                // match in current inverted bitset, i.e. there's at
                                // least one 'new' bit covered by this pcode/escape:
                                match++;
                            } else if (l_orig[j]) {
                                // mismatch!
                                match = false;
                                break;
                            }
                        }
                    }

                    // We're only interested in matches which actually cover some 
                    // yet uncovered bits: `match !== 0 && match !== false`.
                    // 
                    // Apply the heuristic that the pcode/escape is only going to be used
                    // when it covers *more* characters than its own identifier's length:
                    if (match && match > pcode.length) {
                        rv.push(pcode);

                        // and nuke the bits in the array which match the given pcode:
                        // make sure these edits are visible outside this function as
                        // `l` is an INPUT parameter (~ not modified)!
                        if (!bitarr_is_cloned) {
                            l2 = new Array(UNICODE_BASE_PLANE_MAX_CP + 1);
                            for (j = 0; j <= UNICODE_BASE_PLANE_MAX_CP; j++) {
                                l2[j] = l[j] || ba4pcode[j];    // `!(!l[j] && !ba4pcode[j])`
                            }
                            // recreate sentinel
                            l2[UNICODE_BASE_PLANE_MAX_CP + 1] = 1;
                            l = l2;
                            bitarr_is_cloned = true;
                        } else {
                            for (j = 0; j <= UNICODE_BASE_PLANE_MAX_CP; j++) {
                                l[j] = l[j] || ba4pcode[j];
                            }
                        }
                    }
                }
            }
        }
        
        i = 0;
        while (i <= UNICODE_BASE_PLANE_MAX_CP) {
            // find first character not in original set:
            while (l[i]) {
                i++;
            }
            if (i >= UNICODE_BASE_PLANE_MAX_CP + 1) {
                break;
            }
            // find next character not in original set:
            for (j = i + 1; !l[j]; j++) {} /* empty loop */
            // generate subset:
            rv.push(i2c(i));
            if (j - 1 > i) {
                rv.push((j - 2 > i ? '-' : '') + i2c(j - 1));
            }
            i = j;
        }
    } else {
        // generate the non-inverted set, hence all logic checks are inverted here...
        cnt = 0;
        for (i = 0; i <= UNICODE_BASE_PLANE_MAX_CP; i++) {
            if (l[i]) {
                cnt++;
            }
        }
        if (cnt === UNICODE_BASE_PLANE_MAX_CP + 1) {
            // When we find the entire Unicode range is in the output match set, we replace this with
            // a shorthand regex: `[\S\s]`
            return '\\S\\s';
        }
        else if (cnt === 0) {
            // When there's nothing in the output we output a special 'match-nothing' regex: `[^\S\s]`.
            return '^\\S\\s';
        }

        // Now see if we can replace several bits by an escape / pcode:
        if (output_minimized) {
            lut = Pcodes_bitarray_cache_test_order;
            for (tn = 0; lut[tn]; tn++) {
                tspec = lut[tn];
                // check if the uniquely identifying char is in the set:
                if (l[tspec[0]]) {
                    // check if the pcode is covered by the set:
                    pcode = tspec[1];
                    ba4pcode = Pcodes_bitarray_cache[pcode];
                    match = 0;
                    for (j = 0; j <= UNICODE_BASE_PLANE_MAX_CP; j++) {
                        if (ba4pcode[j]) {
                            if (l[j]) {
                                // match in current bitset, i.e. there's at
                                // least one 'new' bit covered by this pcode/escape:
                                match++;
                            } else if (!l_orig[j]) {
                                // mismatch!
                                match = false;
                                break;
                            }
                        }
                    }

                    // We're only interested in matches which actually cover some 
                    // yet uncovered bits: `match !== 0 && match !== false`.
                    // 
                    // Apply the heuristic that the pcode/escape is only going to be used
                    // when it covers *more* characters than its own identifier's length:
                    if (match && match > pcode.length) {
                        rv.push(pcode);

                        // and nuke the bits in the array which match the given pcode:
                        // make sure these edits are visible outside this function as
                        // `l` is an INPUT parameter (~ not modified)!
                        if (!bitarr_is_cloned) {
                            l2 = new Array(UNICODE_BASE_PLANE_MAX_CP + 1);
                            for (j = 0; j <= UNICODE_BASE_PLANE_MAX_CP; j++) {
                                l2[j] = l[j] && !ba4pcode[j];
                            }
                            // recreate sentinel
                            l2[UNICODE_BASE_PLANE_MAX_CP + 1] = 1;
                            l = l2;
                            bitarr_is_cloned = true;
                        } else {
                            for (j = 0; j <= UNICODE_BASE_PLANE_MAX_CP; j++) {
                                l[j] = l[j] && !ba4pcode[j];
                            }
                        }
                    }
                }
            }
        }

        i = 0;
        while (i <= UNICODE_BASE_PLANE_MAX_CP) {
            // find first character not in original set:
            while (!l[i]) {
                i++;
            }
            if (i >= UNICODE_BASE_PLANE_MAX_CP + 1) {
                break;
            }
            // find next character not in original set:
            for (j = i + 1; l[j]; j++) {} /* empty loop */
            if (j > UNICODE_BASE_PLANE_MAX_CP + 1) {
                j = UNICODE_BASE_PLANE_MAX_CP + 1;
            }
            // generate subset:
            rv.push(i2c(i));
            if (j - 1 > i) {
                rv.push((j - 2 > i ? '-' : '') + i2c(j - 1));
            }
            i = j;
        }
    }

    assert(rv.length);
    var s = rv.join('');
    assert(s);

    // Check if the set is better represented by one of the regex escapes:
    var esc4s = EscCode_bitarray_output_refs.set2esc[s];
    if (esc4s) {
        // When we hit a special case like this, it is always the shortest notation, hence wins on the spot!
        return '\\' + esc4s;
    }
    return s;
}





// Pretty brutal conversion of 'regex' `s` back to raw regex set content: strip outer [...] when they're there;
// ditto for inner combos of sets, i.e. `]|[` as in `[0-9]|[a-z]`.
function reduceRegexToSetBitArray(s, name, opts) {
    var orig = s;

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }

    var l = new Array(UNICODE_BASE_PLANE_MAX_CP + 1);
    var internal_state = 0;
    var derr;

    while (s.length) {
        var c1 = s.match(CHR_RE);
        if (!c1) {
            // cope with illegal escape sequences too!
            return new Error('illegal escape sequence at start of regex part: "' + s + '" of regex "' + orig + '"');
        } else {
            c1 = c1[0];
        }
        s = s.substr(c1.length);

        switch (c1) {
        case '[':
            // this is starting a set within the regex: scan until end of set!
            var set_content = [];
            while (s.length) {
                var inner = s.match(SET_PART_RE);
                if (!inner) {
                    inner = s.match(CHR_RE);
                    if (!inner) {
                        // cope with illegal escape sequences too!
                        return new Error('illegal escape sequence at start of regex part: ' + s + '" of regex "' + orig + '"');
                    } else {
                        inner = inner[0];
                    }
                    if (inner === ']') break;
                } else {
                    inner = inner[0];
                }
                set_content.push(inner);
                s = s.substr(inner.length);
            }

            // ensure that we hit the terminating ']':
            var c2 = s.match(CHR_RE);
            if (!c2) {
                // cope with illegal escape sequences too!
                return new Error('regex set expression is broken in regex: "' + orig + '" --> "' + s + '"');
            } else {
                c2 = c2[0];
            }
            if (c2 !== ']') {
                return new Error('regex set expression is broken in regex: ' + orig);
            }
            s = s.substr(c2.length);

            var se = set_content.join('');
            if (!internal_state) {
                derr = set2bitarray(l, se, opts);
                // propagate deferred exceptions = error reports.
                if (derr instanceof Error) {
                    return derr;
                }

                // a set is to use like a single character in a longer literal phrase, hence input `[abc]word[def]` would thus produce output `[abc]`:
                internal_state = 1;
            }
            break;

        // Strip unescaped pipes to catch constructs like `\\r|\\n` and turn them into
        // something ready for use inside a regex set, e.g. `\\r\\n`.
        //
        // > Of course, we realize that converting more complex piped constructs this way
        // > will produce something you might not expect, e.g. `A|WORD2` which
        // > would end up as the set `[AW]` which is something else than the input
        // > entirely.
        // >
        // > However, we can only depend on the user (grammar writer) to realize this and
        // > prevent this from happening by not creating such oddities in the input grammar.
        case '|':
            // a|b --> [ab]
            internal_state = 0;
            break;

        case '(':
            // (a) --> a
            //
            // TODO - right now we treat this as 'too complex':

            // Strip off some possible outer wrappers which we know how to remove.
            // We don't worry about 'damaging' the regex as any too-complex regex will be caught
            // in the validation check at the end; our 'strippers' here would not damage useful
            // regexes anyway and them damaging the unacceptable ones is fine.
            s = s.replace(/^\((?:\?:)?(.*?)\)$/, '$1');         // (?:...) -> ...  and  (...) -> ...
            s = s.replace(/^\^?(.*?)\$?$/, '$1');               // ^...$ --> ...  (catch these both inside and outside the outer grouping, hence do the ungrouping twice: one before, once after this)
            s = s.replace(/^\((?:\?:)?(.*?)\)$/, '$1');         // (?:...) -> ...  and  (...) -> ...

            return new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + orig + ']"]');

        case '.':
        case '*':
        case '+':
        case '?':
            // wildcard
            //
            // TODO - right now we treat this as 'too complex':
            return new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + orig + ']"]');

        case '{':                        // range, e.g. `x{1,3}`, or macro?
            // TODO - right now we treat this as 'too complex':
            return new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + orig + ']"]');

        default:
            // literal character or word: take the first character only and ignore the rest, so that
            // the constructed set for `word|noun` would be `[wb]`:
            if (!internal_state) {
                derr = set2bitarray(l, c1, opts);
                // propagate deferred exceptions = error reports.
                if (derr instanceof Error) {
                    return derr;
                }

                internal_state = 2;
            }
            break;
        }
    }

    s = bitarray2set(l);

    // When this result is suitable for use in a set, than we should be able to compile
    // it in a regex; that way we can easily validate whether macro X is fit to be used
    // inside a regex set:
    try {
        var re;
        assert(s);
        assert(!(s instanceof Error));
        re = new XRegExp('[' + s + ']');
        re.test(s[0]);

        // One thing is apparently *not* caught by the RegExp compile action above: `[a[b]c]`
        // so we check for lingering UNESCAPED brackets in here as those cannot be:
        if (/[^\\][\[\]]/.exec(s)) {
            throw new Error('unescaped brackets in set data');
        }
    } catch (ex) {
        // make sure we produce a set range expression which will fail badly when it is used
        // in actual code:
        s = new Error('[macro [' + name + '] is unsuitable for use inside regex set expressions: "[' + s + ']"]: ' + ex.message);
    }

    assert(s);
    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }
    return l;
}




// Convert bitarray representing, for example, `'0-9'` to regex string `[0-9]` 
// -- or in this example it can be further optimized to only `\d`!
function produceOptimizedRegex4Set(bitarr) {
    // First try to produce a minimum regex from the bitarray directly:
    var s1 = bitarray2set(bitarr, false, true);

    // and when the regex set turns out to match a single pcode/escape, then
    // use that one as-is:
    if (s1.match(SET_IS_SINGLE_PCODE_RE)) {
        // When we hit a special case like this, it is always the shortest notation, hence wins on the spot!
        return s1;
    } else {
        s1 = '[' + s1 + ']';
    }

    // Now try to produce a minimum regex from the *inverted* bitarray via negation:
    // Because we look at a negated bitset, there's no use looking for matches with
    // special cases here.
    var s2 = bitarray2set(bitarr, true, true);

    if (s2[0] === '^') {
        s2 = s2.substr(1);
        if (s2.match(SET_IS_SINGLE_PCODE_RE)) {
            // When we hit a special case like this, it is always the shortest notation, hence wins on the spot!
            return s2;
        }
    } else {
        s2 = '^' + s2;
    }
    s2 = '[' + s2 + ']';

    // Then, as some pcode/escapes still happen to deliver a LARGER regex string in the end,
    // we also check against the plain, unadulterated regex set expressions:
    // 
    // First try to produce a minimum regex from the bitarray directly:
    var s3 = bitarray2set(bitarr, false, false);

    // and when the regex set turns out to match a single pcode/escape, then
    // use that one as-is:
    if (s3.match(SET_IS_SINGLE_PCODE_RE)) {
        // When we hit a special case like this, it is always the shortest notation, hence wins on the spot!
        return s3;
    } else {
        s3 = '[' + s3 + ']';
    }

    // Now try to produce a minimum regex from the *inverted* bitarray via negation:
    // Because we look at a negated bitset, there's no use looking for matches with
    // special cases here.
    var s4 = bitarray2set(bitarr, true, false);

    if (s4[0] === '^') {
        s4 = s4.substr(1);
        if (s4.match(SET_IS_SINGLE_PCODE_RE)) {
            // When we hit a special case like this, it is always the shortest notation, hence wins on the spot!
            return s4;
        }
    } else {
        s4 = '^' + s4;
    }
    s4 = '[' + s4 + ']';

    if (s2.length < s1.length) {
        s1 = s2;
    }
    if (s3.length < s1.length) {
        s1 = s3;
    }
    if (s4.length < s1.length) {
        s1 = s4;
    }

    return s1;
}






module.exports = {
	XREGEXP_UNICODE_ESCAPE_RE: XREGEXP_UNICODE_ESCAPE_RE,
	CHR_RE: CHR_RE,
	SET_PART_RE: SET_PART_RE,
	NOTHING_SPECIAL_RE: NOTHING_SPECIAL_RE,
	SET_IS_SINGLE_PCODE_RE: SET_IS_SINGLE_PCODE_RE,

	UNICODE_BASE_PLANE_MAX_CP: UNICODE_BASE_PLANE_MAX_CP,

	WHITESPACE_SETSTR: WHITESPACE_SETSTR,
	DIGIT_SETSTR: DIGIT_SETSTR,
	WORDCHAR_SETSTR: WORDCHAR_SETSTR,

	set2bitarray: set2bitarray,
	bitarray2set: bitarray2set,
	produceOptimizedRegex4Set: produceOptimizedRegex4Set,
	reduceRegexToSetBitArray: reduceRegexToSetBitArray,
};

