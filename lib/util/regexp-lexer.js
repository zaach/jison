// Basic Lexer implemented using JavaScript regular expressions
// MIT Licensed

'use strict';

var XRegExp = require('xregexp');
var lexParser = require('./lex-parser');
var version = require('./package.json').version;
var assert = require('assert');

// expand macros and convert matchers to RegExp's
function prepareRules(dict, actions, caseHelper, tokens, startConditions, opts) {
    var m, i, k, action, conditions,
        active_conditions,
        rules = dict.rules,
        newRules = [],
        macros = {};

    // Assure all options are camelCased:
    assert(typeof opts.options['case-insensitive'] === 'undefined');

    // Depending on the location within the regex we need different expansions of the macros:
    // one expansion for when a macro is *inside* a `[...]` and another expansion when a macro
    // is anywhere else in a regex:
    if (dict.macros) {
        macros = prepareMacros(dict.macros, opts);
    }

    function tokenNumberReplacement(str, token) {
        return 'return ' + (tokens[token] || '\'' + token.replace(/'/g, '\\\'') + '\'');
    }

    // make sure a comment does not contain any embedded '*/' end-of-comment marker
    // as that would break the generated code
    function postprocessComment(str) {
        if (Array.isArray(str)) {
            str = str.join(' ');
        }
        str = str.replace(/\*\//g, '*\\/');         // destroy any inner `*/` comment terminator sequence.
        return str;
    }

    actions.push('switch($avoiding_name_collisions) {');

    for (i = 0; i < rules.length; i++) {
        active_conditions = [];
        if (Object.prototype.toString.apply(rules[i][0]) !== '[object Array]') {
            // implicit add to all inclusive start conditions
            for (k in startConditions) {
                if (startConditions[k].inclusive) {
                    active_conditions.push(k);
                    startConditions[k].rules.push(i);
                }
            }
        } else if (rules[i][0][0] === '*') {
            // Add to ALL start conditions
            active_conditions.push('*');
            for (k in startConditions) {
                startConditions[k].rules.push(i);
            }
            rules[i].shift();
        } else {
            // Add to explicit start conditions
            conditions = rules[i].shift();
            for (k = 0; k < conditions.length; k++) {
                if (!startConditions.hasOwnProperty(conditions[k])) {
                    startConditions[conditions[k]] = {
                        rules: [], 
                        inclusive: false
                    };
                    console.warn('Lexer Warning : "' + conditions[k] + '" start condition should be defined as %s or %x; assuming %x now.');
                }
                active_conditions.push(conditions[k]);
                startConditions[conditions[k]].rules.push(i);
            }
        }

        m = rules[i][0];
        if (typeof m === 'string') {
            m = expandMacros(m, macros, opts);
            m = new XRegExp('^(?:' + m + ')', opts.options.caseInsensitive ? 'i' : '');
        }
        newRules.push(m);
        if (typeof rules[i][1] === 'function') {
            rules[i][1] = String(rules[i][1]).replace(/^\s*function \(\)\s?\{/, '').replace(/\}\s*$/, '');
        }
        action = rules[i][1];
        if (tokens && action.match(/return '(?:\\'|[^']+)+'/)) {
            action = action.replace(/return '((?:\\'|[^']+)+)'/g, tokenNumberReplacement);
        }
        if (tokens && action.match(/return "(?:\\"|[^"]+)+"/)) {
            action = action.replace(/return "((?:\\"|[^"]+)+)"/g, tokenNumberReplacement);
        }

        var code = ['\n/*! Conditions::'];
        code.push(postprocessComment(active_conditions));
        code.push('*/', '\n/*! Rule::      ');
        code.push(postprocessComment(rules[i][0]));
        code.push('*/', '\n');

        // When the action is *only* a simple `return TOKEN` statement, then add it to the caseHelpers;
        // otherwise add the additional `break;` at the end.
        //
        // Note: we do NOT analyze the action block any more to see if the *last* line is a simple
        // `return NNN;` statement as there are too many shoddy idioms, e.g.
        //
        // ```
        // %{ if (cond)
        //      return TOKEN;
        // %}
        // ```
        //
        // which would then cause havoc when our action code analysis (using regexes or otherwise) was 'too simple'
        // to catch these culprits; hence we resort and stick with the most fundamental approach here:
        // always append `break;` even when it would be obvious to a human that such would be 'unreachable code'.
        var match_nr = /^return[\s\r\n]+((?:'(?:\\'|[^']+)+')|(?:"(?:\\"|[^"]+)+")|\d+)[\s\r\n]*;?$/.exec(action.trim());
        if (match_nr) {
            caseHelper.push([].concat(code, i, ':', match_nr[1]).join(' ').replace(/[\n]/g, '\n  '));
        } else {
            actions.push([].concat('case', i, ':', code, action, '\nbreak;').join(' '));
        }
    }
    actions.push('default:');
    actions.push('  return this.simpleCaseActionClusters[$avoiding_name_collisions];');
    actions.push('}');

    return {
        rules: newRules,
        macros: macros
    };
}

// 'Join' a regex set `[...]` into a Unicode range spanning logic array, flagging every character in the given set.
function set2bitarray(bitarr, s) {
    var orig = s;
    var set_is_inverted = false;
    var apply = [];

    function mark(d1, d2) {
        if (d2 == null) d2 = d1;
        for (var i = d1; i <= d2; i++) {
            bitarr[i] = true;
        }
    }

    function exec() {
        // array gets sorted on entry [0] of each sub-array
        apply.sort(function (a, b) {
            return a[0] - b[0];
        });           

        // When we have marked all slots, '^' NEGATES the set, hence we flip all slots:
        if (set_is_inverted) {
            for (var i = 0; i < 65536; i++) {
                bitarr[i] = !bitarr[i];
            }
        }
    }

    function eval_escaped_code(s) {
        // decode escaped code? If none, just take the character as-is
        if (s.indexOf('\\') === 0) {
            var l = s.substr(0, 2);
            switch (l) {
            case '\\c':
                var c = s.charCodeAt(2) - 'A'.charCodeAt(0) + 1;
                return String.fromCharCode(c);

            case '\\x':
                s = s.substr(2);
                var c = parseInt(s, 16);
                return String.fromCharCode(c);

            case '\\u':
                s = s.substr(2);
                if (s[0] === '{') {
                    s = s.substr(1, s.length - 2);
                }
                var c = parseInt(s, 16);
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
                var c = parseInt(s, 8);
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

            case '\\r':
                return '\r';

            default:
                // just the chracter itself:
                return s.substr(1);
            }
        } else {
            return s;
        }
    }

    if (s && s.length) {
        // inverted set?
        if (s[0] === '^') {
            set_is_inverted = !set_is_inverted;
            s = s.substr(1);
        }

        // BITARR collects flags for characters set. Inversion means the complement set of character is st instead.
        // This results in an OR operations when sets are joined/chained.

        var chr_re = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})/;
        var xregexp_unicode_escape_re = /^\{[A-Za-z0-9 \-\._]+\}/;              // Matches the XRegExp Unicode escape braced part, e.g. `{Number}`

        while (s.length) {
            var c1 = s.match(chr_re);
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
                    var c2 = s.match(xregexp_unicode_escape_re);
                    if (c2) {
                        c2 = c2[0];
                        s = s.substr(c2.length);
                        // expand escape:
                        var xr = new XRegExp('[' + c1 + c2 + ']');           // TODO: case-insensitive grammar???
                        var xs = '' + xr;
                        // remove the wrapping `/[...]/`:
                        xs = xs.substr(2, xs.length - 4);
                        // inject back into source string:
                        s = xs + s;
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
                    switch (c1[1]) {
                    case 'S':
                        // [^ \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
                        set2bitarray(bitarr, '^ \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff');
                        continue;                    

                    case 's':
                        // [ \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
                        set2bitarray(bitarr, ' \f\n\r\t\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff');
                        continue;                    

                    case 'D':
                        // [^0-9]
                        set2bitarray(bitarr, '^0-9');
                        continue;                    

                    case 'd':
                        // [0-9]
                        set2bitarray(bitarr, '0-9');
                        continue;                    

                    case 'W':
                        // [^A-Za-z0-9_]
                        set2bitarray(bitarr, '^A-Za-z0-9_');
                        continue;                    

                    case 'w':
                        // [A-Za-z0-9_]
                        set2bitarray(bitarr, 'A-Za-z0-9_');
                        continue;                    
                    }
                    continue;

                case '\\b':
                    // matches a backspace: https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions#special-backspace
                    c1 = '\u0008';
                    break;
                }
            }
            var v1 = eval_escaped_code(c1);
            v1 = v1.charCodeAt(0);
            s = s.substr(c1.length);

            if (s[0] === '-' && s.length >= 2) {
                // we can expect a range like 'a-z':
                s = s.substr(1);
                var c2 = s.match(chr_re);
                if (!c2) {
                    // hit an illegal escape sequence? cope anyway!
                    c2 = s[0];
                } else {
                    c2 = c2[0];
                }
                var v2 = eval_escaped_code(c2);
                v2 = v2.charCodeAt(0);
                s = s.substr(c2.length);

                // legal ranges go UP, not /DOWN!
                if (v1 <= v2) {
                    mark(v1, v2);
                } else {
                    console.warn("INVALID CHARACTER RANGE found in regex: ", { re: orig, start: c1, start_n: v1, end: c2, end_n: v2 });
                    mark(v1);
                    mark('-'.charCodeAt(0));
                    mark(v2);
                }
                continue;
            }
            mark(v1);
        }

        // Since a regex like `[^]` should match everything(?really?), we don't need to check if the MARK
        // phase actually marked anything at all (apply.length > 0):
        exec();
    }
}


// convert a simple bitarray back into a regex set `[...]` content:
function bitarray2set(l, output_inverted_variant) {
    function i2c(i) {
        var c;

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
        // Check and warn user about Unicode Supplementary Plane content as that will be FRIED!
        if (i >= 0xD800 && i < 0xDFFF) {
            throw new Error("You have Unicode Supplementary Plane content in a regex set: JavaScript has severe problems with Supplementary Plane content, particularly in regexes, so you are kindly required to get rid of this stuff. Sorry! (Offending UCS-2 code which triggered this: 0x" + i.toString(16) + ")");
        }
        if (i < 32 
                || i > 0xFFF0 /* Unicode Specials, also in UTF16 */ 
                || (i >= 0xD800 && i < 0xDFFF) /* Unicode Supplementary Planes; we're TOAST in JavaScript as we're NOT UTF-16 but UCS-2! */
                || String.fromCharCode(i).match(/[\u2028\u2029]/) /* Code compilation via `new Function()` does not like to see these, or rather: treats them as just another form of CRLF, which breaks your generated regex code! */ 
            ) {
            // Detail about a detail:
            // U+2028 and U+2029 are part of the `\s` regex escape code (`\s` and `[\s]` match either of these) and when placed in a JavaScript
            // source file verbatim (without escaping it as a `\uNNNN` item) then JavaScript will interpret it as such and consequently report
            // a b0rked generated parser, as the generated code would include this regex right here.
            // Hence we MUST escape these buggers everywhere we go...
            c = '0000' + i.toString(16);
            return '\\u' + c.substr(c.length - 4);
        }
        return String.fromCharCode(i);
    }

    // construct the inverse(?) set from the mark-set:
    //
    // Before we do that, we inject a sentinel so that our inner loops
    // below can be simple and fast:
    l[65536] = 1;
    // now reconstruct the regex set:
    var rv = [];
    var i, j;
    var entire_range_is_marked = false;
    if (output_inverted_variant) {
        // generate the inverted set, hence all unmarked slots are part of the output range:
        i = 0;
        while (i <= 65535) {
            // find first character not in original set:
            while (l[i]) {
                i++;
            }
            if (i > 65535) {
                break;
            }
            // find next character not in original set:
            for (j = i + 1; !l[j]; j++) {} /* empty loop */
            // generate subset:
            rv.push(i2c(i));
            if (j - 1 > i) {
                entire_range_is_marked = (i === 0 && j === 65536);
                rv.push((j - 2 > i ? '-' : '') + i2c(j - 1));
            }
            i = j;
        }
    } else {
        // generate the non-inverted set, hence all logic checks are inverted here... 
        i = 0;
        while (i <= 65535) {
            // find first character not in original set:
            while (!l[i]) {
                i++;
            }
            if (i > 65535) {
                break;
            }
            // find next character not in original set:
            for (j = i + 1; l[j]; j++) {} /* empty loop */
            if (j > 65536) {
                j = 65536;
            }
            // generate subset:
            rv.push(i2c(i));
            if (j - 1 > i) {
                entire_range_is_marked = (i === 0 && j === 65536);
                rv.push((j - 2 > i ? '-' : '') + i2c(j - 1));
            }
            i = j;
        }
    }

    // When there's nothing in the output we output a special 'match-nothing' regex: `[^\S\s]`.
    // When we find the entire Unicode range is in the output match set, we also replace this with 
    // a shorthand regex: `[\S\s]` (thus replacing the `[\u0000-\uffff]` regex we generated here).
    var s;
    if (!rv.length) {
        // entire range turnes out to be EXCLUDED: 
        s = '^\\S\\s';
    } else if (entire_range_is_marked) {
        // entire range turnes out to be INCLUDED: 
        s = '\\S\\s';
    } else {
        s = rv.join('');
    }

    return s;
}


// Pretty brutal conversion of 'regex' `s` back to raw regex set content: strip outer [...] when they're there;
// ditto for inner combos of sets, i.e. `]|[` as in `[0-9]|[a-z]`.
function reduceRegexToSet(s, name) {
    var orig = s;

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }
    
    var chr_re = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})/;
    var set_part_re = /^(?:[^\\\]]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;
    var nothing_special_re = /^(?:[^\\\[\]\(\)\|^]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;

    var l = new Array(65536 + 3);
    var internal_state = 0;

    while (s.length) {
        var c1 = s.match(chr_re);
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
                var inner = s.match(set_part_re);
                if (!inner) {
                    inner = s.match(chr_re);
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
            var c2 = s.match(chr_re);
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
                set2bitarray(l, se);

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
                set2bitarray(l, c1);

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

    return s;
}


// expand all macros (with maybe one exception) in the given regex: the macros may exist inside `[...]` regex sets or 
// elsewhere, which requires two different treatments to expand these macros.
function reduceRegex(s, name, opts, expandAllMacrosInSet_cb, expandAllMacrosElsewhere_cb) {
    var orig = s;
    var regex_simple_size = 0;
    var regex_previous_alts_simple_size = 0;

    function errinfo() {
        if (name) {
            return 'macro [[' + name + ']]'; 
        } else {
            return 'regex [[' + orig + ']]';
        }
    }

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }
    
    var chr_re = /^(?:[^\\]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})/;
    var set_part_re = /^(?:[^\\\]]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;
    var nothing_special_re = /^(?:[^\\\[\]\(\)\|^\{\}]|\\[^cxu0-9]|\\[0-9]{1,3}|\\c[A-Z]|\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]\}{4})+/;
    var xregexp_unicode_escape_re = /^\{[A-Za-z0-9 \-\._]+\}/;              // Matches the XRegExp Unicode escape braced part, e.g. `{Number}`

    var rv = [];

    while (s.length) {
        var c1 = s.match(chr_re);
        if (!c1) {
            // cope with illegal escape sequences too!
            return new Error(errinfo() + ': illegal escape sequence at start of regex part: ' + s);
        } else {
            c1 = c1[0];
        }
        s = s.substr(c1.length);

        switch (c1) {
        case '[':
            // this is starting a set within the regex: scan until end of set!
            var set_content = [];
            var l = new Array(65536 + 3);

            while (s.length) {
                var inner = s.match(set_part_re);
                if (!inner) {
                    inner = s.match(chr_re);
                    if (!inner) {
                        // cope with illegal escape sequences too!
                        return new Error(errinfo() + ': illegal escape sequence at start of regex part: ' + s);
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
            var c2 = s.match(chr_re);
            if (!c2) {
                // cope with illegal escape sequences too!
                return new Error(errinfo() + ': regex set expression is broken: "' + s + '"');
            } else {
                c2 = c2[0];
            }
            if (c2 !== ']') {
                return new Error(errinfo() + ': regex set expression is broken: apparently unterminated');
            }
            s = s.substr(c2.length);

            var se = set_content.join('');

            // expand any macros in here:
            if (expandAllMacrosInSet_cb) {
                se = expandAllMacrosInSet_cb(se);
                assert(se);
                if (se instanceof Error) {
                    return new Error(errinfo() + ': ' + se.message);
                }
            }

            set2bitarray(l, se);

            // find out which set expression is optimal in size:
            var s1 = bitarray2set(l);
            var s2 = /* '^' + */ bitarray2set(l, true);
            if (s2[0] === '^') {
                s2 = s2.substr(1);
            } else {
                s2 = '^' + s2;
            }
            // check if the source regex set potentially has any expansions (guestimate!)
            //
            // The indexOf('{') picks both XRegExp Unicode escapes and JISON lexer macros, which is perfect for us here.
            var has_expansions = (se.indexOf('{') >= 0);
            if (s2.length < s1.length) {
                s1 = s2;
            }
            if (!has_expansions && se.length < s1.length) {
                s1 = se;
            }
            rv.push('[' + s1 + ']');
            break;

        // XRegExp Unicode escape, e.g. `\\p{Number}`:
        case '\\p':
            var c2 = s.match(xregexp_unicode_escape_re);
            if (c2) {
                c2 = c2[0];
                s = s.substr(c2.length);

                // nothing to expand.
                rv.push(c1 + c2);
            } else {
                // nothing to stretch this match, hence nothing to expand.
                rv.push(c1);
            }
            break;

        // Either a range expression or the start of a macro reference: `.{1,3}` or `{NAME}`.
        // Treat it as a macro reference and see if it will expand to anything:
        case '{':
            var c2 = s.match(nothing_special_re);
            if (c2) {
                c2 = c2[0];
                s = s.substr(c2.length);

                var c3 = s[0];
                s = s.substr(c3.length);
                if (c3 === '}') {
                    // possibly a macro name in there... Expand if possible:
                    c2 = c1 + c2 + c3;
                    if (expandAllMacrosElsewhere_cb) {
                        c2 = expandAllMacrosElsewhere_cb(c2);
                        assert(c2);
                        if (c2 instanceof Error) {
                            return new Error(errinfo() + ': ' + c2.message);
                        }
                    }
                } else {
                    // not a well-terminated macro reference or something completely different: 
                    // we do not even attempt to expand this as there's guaranteed nothing to expand
                    // in this bit.
                    c2 = c1 + c2 + c3;
                }
                rv.push(c2);
            } else {
                // nothing to stretch this match, hence nothing to expand.
                rv.push(c1);
            }
            break;

        // Recognize some other regex elements, but there's no need to understand them all. 
        //
        // We are merely interested in any chunks now which do *not* include yet another regex set `[...]`
        // nor any `{MACRO}` reference:
        default:
            // non-set character or word: see how much of this there is for us and then see if there
            // are any macros still lurking inside there:
            var c2 = s.match(nothing_special_re);
            if (c2) {
                c2 = c2[0];
                s = s.substr(c2.length);

                // nothing to expand.
                rv.push(c1 + c2);
            } else {
                // nothing to stretch this match, hence nothing to expand.
                rv.push(c1);
            }
            break;
        }
    }

    s = rv.join('');
    
    // When this result is suitable for use in a set, than we should be able to compile 
    // it in a regex; that way we can easily validate whether macro X is fit to be used 
    // inside a regex set:
    try {
        var re;
        re = new XRegExp(s);
        re.test(s[0]);
    } catch (ex) {
        // make sure we produce a regex expression which will fail badly when it is used
        // in actual code:
        return new Error(errinfo() + ': expands to an invalid regex: /' + s + '/'); 
    }

    return s;
}


// 'normalize' a `[...]` set by inverting an inverted `[^...]` set:
function normalizeSet(s, output_inverted_variant) {
    var orig = s;

    // propagate deferred exceptions = error reports.
    if (s instanceof Error) {
        return s;
    }

    if (s && s.length) {
        // // inverted set?
        // if (s[0] === '^') {
        //     output_inverted_variant = !output_inverted_variant;
        //     s = s.substr(1);
        // }

        var l = new Array(65536 + 3);
        set2bitarray(l, s);

        s = bitarray2set(l, output_inverted_variant);
    }

    return s;
}




// expand macros within macros and cache the result
function prepareMacros(dict_macros, opts) {
    var macros = {};

    // expand a `{NAME}` macro which exists inside a `[...]` set:
    function expandMacroInSet(i) {
        var k, a, m;
        if (!macros[i]) {
            m = dict_macros[i];

            if (m.indexOf('{') >= 0) {
                // set up our own record so we can detect definition loops:
                macros[i] = {
                    in_set: false,
                    in_inv_set: false,
                    elsewhere: null,
                    raw: dict_macros[i]
                };

                for (k in dict_macros) {
                    if (dict_macros.hasOwnProperty(k) && i !== k) {
                        // it doesn't matter if the lexer recognized that the inner macro(s)
                        // were sitting inside a `[...]` set or not: the fact that they are used
                        // here in macro `i` which itself sits in a set, makes them *all* live in
                        // a set so all of them get the same treatment: set expansion style.
                        //
                        // Note: make sure we don't try to expand any XRegExp `\p{...}` or `\P{...}`
                        // macros here:
                        if (XRegExp.isUnicodeSlug(k)) {
                            // Work-around so that you can use `\p{ascii}` for an XRegExp slug
                            // while using `\p{ASCII}` as a *macro expansion* of the `ASCII`
                            // macro:
                            if (k.toUpperCase() !== k) {
                                m = new Error('Cannot use name "' + k + '" as a macro name as it clashes with the same XRegExp "\\p{..}" Unicode slug name. Use all-uppercase macro names, e.g. name your macro "' + k.toUpperCase() + '" to work around this issue or give your offending macro a different name.');
                                break;
                            }
                        }

                        a = m.split('{' + k + '}');
                        if (a.length > 1) {
                            var x = expandMacroInSet(k);
                            assert(x);
                            if (x instanceof Error) {
                                m = x;
                                break;
                            }
                            m = a.join(x);
                        }
                    }
                }
            }

            m = reduceRegexToSet(m, i);

            macros[i] = {
                in_set: normalizeSet(m, false),
                in_inv_set: normalizeSet(m, true),
                elsewhere: null,
                raw: dict_macros[i]
            };
        } else {
            m = macros[i].in_set;

            if (m instanceof Error) {
                // this turns out to be an macro with 'issues' and it is used, so the 'issues' do matter: bombs away!
                return new Error(m.message);
            }

            // detect definition loop:
            if (m === false) {
                return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
            }
        }

        return m;
    }

    function expandMacroElsewhere(i) {
        var k, a, m;

        if (macros[i].elsewhere == null) {
            m = dict_macros[i];

            // set up our own record so we can detect definition loops:
            macros[i].elsewhere = false;

            // the macro MAY contain other macros which MAY be inside a `[...]` set in this
            // macro or elsewhere, hence we must parse the regex:
            m = reduceRegex(m, i, opts, expandAllMacrosInSet, expandAllMacrosElsewhere);
            assert(m);
            // propagate deferred exceptions = error reports.
            if (m instanceof Error) {
                return m;
            }

            macros[i].elsewhere = m;
        } else {
            m = macros[i].elsewhere;

            if (m instanceof Error) {
                // this turns out to be an macro with 'issues' and it is used, so the 'issues' do matter: bombs away!
                return m;
            }

            // detect definition loop:
            if (m === false) {
                return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
            }
        }

        return m;
    }

    function expandAllMacrosInSet(s) {
        var i, x;

        // process *all* the macros inside [...] set:
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        x = expandMacroInSet(i);
                        assert(x);
                        if (x instanceof Error) {
                            return new Error('failure to expand the macro [' + i + '] in set [' + s + ']: ' + x.message);
                        }
                        s = a.join(x);
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }

    function expandAllMacrosElsewhere(s) {
        var i, x;

        // When we process the remaining macro occurrences in the regex
        // every macro used in a lexer rule will become its own capture group.
        // 
        // Meanwhile the cached expansion will expand any submacros into
        // *NON*-capturing groups so that the backreference indexes remain as you'ld
        // expect and using macros doesn't require you to know exactly what your
        // used macro will expand into, i.e. which and how many submacros it has.
        // 
        // This is a BREAKING CHANGE from vanilla jison 0.4.15! 
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    // These are all submacro expansions, hence non-capturing grouping is applied:
                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        x = expandMacroElsewhere(i);
                        assert(x);
                        if (x instanceof Error) {
                            return new Error('failure to expand the macro [' + i + '] in regex /' + s + '/: ' + x.message);
                        }
                        s = a.join('(?:' + x + ')');
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }


    var m, i;
    
    if (opts.debug) console.log('\n############## RAW macros: ', dict_macros);

    // first we create the part of the dictionary which is targeting the use of macros
    // *inside* `[...]` sets; once we have completed that half of the expansions work,
    // we then go and expand the macros for when they are used elsewhere in a regex:
    // iff we encounter submacros then which are used *inside* a set, we can use that
    // first half dictionary to speed things up a bit as we can use those expansions
    // straight away!
    for (i in dict_macros) {
        if (dict_macros.hasOwnProperty(i)) {
            expandMacroInSet(i);
        }
    }

    for (i in dict_macros) {
        if (dict_macros.hasOwnProperty(i)) {
            expandMacroElsewhere(i);
        }
    }
    
    if (opts.debug) console.log('\n############### expanded macros: ', macros);
    
    return macros;
}



// expand macros in a regex; expands them recursively
function expandMacros(src, macros, opts) {
    var expansion_count = 0;

    // By the time we call this function `expandMacros` we MUST have expanded and cached all macros already!
    // Hence things should be easy in there:

    function expandAllMacrosInSet(s) {
        var i, m, x;

        // process *all* the macros inside [...] set:
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    m = macros[i];

                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        var x = m.in_set;

                        assert(x);
                        if (x instanceof Error) {
                            // this turns out to be an macro with 'issues' and it is used, so the 'issues' do matter: bombs away!
                            throw x;
                        }

                        // detect definition loop:
                        if (x === false) {
                            return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
                        }

                        s = a.join(x);
                        expansion_count++;
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }

    function expandAllMacrosElsewhere(s) {
        var i, m, x;

        // When we process the main macro occurrences in the regex
        // every macro used in a lexer rule will become its own capture group.
        // 
        // Meanwhile the cached expansion will expand any submacros into
        // *NON*-capturing groups so that the backreference indexes remain as you'ld
        // expect and using macros doesn't require you to know exactly what your
        // used macro will expand into, i.e. which and how many submacros it has.
        // 
        // This is a BREAKING CHANGE from vanilla jison 0.4.15! 
        if (s.indexOf('{') >= 0) {
            for (i in macros) {
                if (macros.hasOwnProperty(i)) {
                    m = macros[i];

                    var a = s.split('{' + i + '}');
                    if (a.length > 1) {
                        // These are all main macro expansions, hence CAPTURING grouping is applied:
                        x = m.elsewhere;
                        assert(x);

                        // detect definition loop:
                        if (x === false) {
                            return new Error('Macro name "' + i + '" has an illegal, looping, definition, i.e. it\'s definition references itself, either directly or indirectly, via other macros.');
                        }

                        s = a.join('(' + x + ')');
                        expansion_count++;
                    }

                    // stop the brute-force expansion attempt when we done 'em all:
                    if (s.indexOf('{') === -1) {
                        break;
                    }
                }
            }
        }

        return s;
    }


    // When we process the macro occurrences in the regex
    // every macro used in a lexer rule will become its own capture group.
    // 
    // Meanwhile the cached expansion will have expanded any submacros into
    // *NON*-capturing groups so that the backreference indexes remain as you'ld
    // expect and using macros doesn't require you to know exactly what your
    // used macro will expand into, i.e. which and how many submacros it has.
    // 
    // This is a BREAKING CHANGE from vanilla jison 0.4.15! 
    var s2 = reduceRegex(src, null, opts, expandAllMacrosInSet, expandAllMacrosElsewhere);
    // propagate deferred exceptions = error reports.
    if (s2 instanceof Error) {
        throw s2;
    }
    
    // only when we did expand some actual macros do we take the re-interpreted/optimized/regenerated regex from reduceRegex()
    // in order to keep our test cases simple and rules recognizable. This assumes the user can code good regexes on his own,
    // as long as no macros are involved...
    //
    // Also pick the reduced regex when there (potentially) are XRegExp extensions in the original, e.g. `\\p{Number}`,
    // unless the `xregexp` output option has been enabled.
    if (expansion_count > 0 || (src.indexOf('\\p{') >= 0 && !opts.options.xregexp)) {
        src = s2;
    } else {
        // Check if the reduced regex is smaller in size; when it is, we still go with the new one!
        if (s2.length < src.length) {
            src = s2;
        }
    }

    return src;
}

function prepareStartConditions (conditions) {
    var sc,
        hash = {};
    for (sc in conditions) {
        if (conditions.hasOwnProperty(sc)) {
            hash[sc] = {rules:[], inclusive: !conditions[sc]};
        }
    }
    return hash;
}

function buildActions(dict, tokens, opts) {
    var actions = [dict.actionInclude || '', 'var YYSTATE = YY_START;'];
    var tok;
    var toks = {};
    var caseHelper = [];

    for (tok in tokens) {
        toks[tokens[tok]] = tok;
    }

    if (opts.options.flex) {
        dict.rules.push(['.', 'console.log(yytext);']);
    }

    var gen = prepareRules(dict, actions, caseHelper, tokens && toks, opts.conditions, opts);

    var fun = actions.join('\n');
    'yytext yyleng yylineno yylloc'.split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp('\\b(' + yy + ')\\b', 'g'), 'yy_.$1');
    });

    return {
        caseHelperInclude: '{\n' + caseHelper.join(',') + '\n}',

        actions: 'function anonymous(yy, yy_, $avoiding_name_collisions, YY_START) {\n' + fun + '\n}',

        rules: gen.rules,
        macros: gen.macros                   // propagate these for debugging/diagnostic purposes
    };
}

//
// NOTE: this is *almost* a copy of the JisonParserError producing code in 
//       jison/lib/jison.js @ line 2304:lrGeneratorMixin.generateErrorClass
//      
function generateErrorClass() {
    // See also:
    // http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508
    // but we keep the prototype.constructor and prototype.name assignment lines too for compatibility
    // with userland code which might access the derived class in a 'classic' way.
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
            if (Error.hasOwnProperty('captureStackTrace')) { // V8
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

    // wrap this init code in a function so we can String(function)-dump it into the generated 
    // output: that way we only have to write this code *once*!
    function __extra_code__() {
        if (typeof Object.setPrototypeOf === 'function') {
            Object.setPrototypeOf(JisonLexerError.prototype, Error.prototype);
        } else {
            JisonLexerError.prototype = Object.create(Error.prototype);
        }
        JisonLexerError.prototype.constructor = JisonLexerError;
        JisonLexerError.prototype.name = 'JisonLexerError';
    }
    __extra_code__();

    var t = new JisonLexerError('test', 42);
    assert(t instanceof Error);
    assert(t instanceof JisonLexerError);
    assert(t.hash === 42);
    assert(t.message === 'test');
    assert(t.toString() === 'JisonLexerError: test');

    var t2 = new Error('a');
    var t3 = new JisonLexerError('test', { exception: t2 });
    assert(t2 instanceof Error);
    assert(!(t2 instanceof JisonLexerError));
    assert(t3 instanceof Error);
    assert(t3 instanceof JisonLexerError);
    assert(!t2.hash);
    assert(t3.hash);
    assert(t3.hash.exception);
    assert(t2.message === 'a');
    assert(t3.message === 'a');
    assert(t2.toString() === 'Error: a');
    assert(t3.toString() === 'JisonLexerError: a');

    var prelude = [
        '// See also:',
        '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508',
        '// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility',
        '// with userland code which might access the derived class in a \'classic\' way.',
        String(JisonLexerError).replace(/^    /gm, ''),
        String(__extra_code__).replace(/^    /gm, '').replace(/function [^\{]+\{/, '').replace(/\}$/, ''),
        '',
    ];

    return prelude;
}


var jisonLexerErrorDefinition = generateErrorClass();


function RegExpLexer(dict, input, tokens) {
    var opts;
    var dump = false;

    function test_me(tweak_cb, description, src_exception, ex_callback) {
        opts = processGrammar(dict, tokens);
        opts.in_rules_failure_analysis_mode = false;
        if (tweak_cb) {
            tweak_cb();
        }
        var source = generateModuleBody(opts);
        try {
            // The generated code will always have the `lexer` variable declared at local scope
            // as `eval()` will use the local scope.
            // 
            // The compiled code will look something like this:
            // 
            // ```
            // var lexer;
            // bla bla...
            // ```
            // 
            // or
            // 
            // ```
            // var lexer = { bla... };
            // ```
            var testcode = [
                '// provide a local version for test purposes:',
                jisonLexerErrorDefinition.join('\n'),
                '',
                'var __hacky_counter__ = 0;',
                'function XRegExp(re, f) {',
                '  this.re = re;',
                '  this.flags = f;',
                '  var fake = /./;',    // WARNING: this exact 'fake' is also depended upon by the xregexp unit test!
                '  __hacky_counter__++;',
                '  fake.__hacky_backy__ = __hacky_counter__;',
                '  return fake;',
                '}',
                '',
                source,
                'return lexer;'].join('\n');
            //console.log("===============================TEST CODE\n", testcode, "\n=====================END====================\n");
            var lexer_f = new Function('', testcode);
            var lexer = lexer_f();

            if (!lexer) {
                throw new Error('no lexer defined *at all*?!');
            }
            if (typeof lexer.options !== 'object' || lexer.options == null) {
                throw new Error('your lexer class MUST have an .options member object or it won\'t fly!');
            }
            if (typeof lexer.setInput !== 'function') {
                throw new Error('your lexer class MUST have a .setInput function member or it won\'t fly!');
            }
            if (lexer.EOF !== 1 && lexer.ERROR !== 2) {
                throw new Error('your lexer class MUST have these constants defined: lexer.EOF = 1 and lexer.ERROR = 2 or it won\'t fly!');
            }

            // When we do NOT crash, we found/killed the problem area just before this call!
            if (src_exception && description) {
                src_exception.message += '\n        (' + description + ')';
            }

            // patch the pre and post handlers in there, now that we have some live code to work with:
            if (opts.options) {
                var pre = opts.options.pre_lex;
                var post = opts.options.post_lex;
                // since JSON cannot encode functions, we'll have to do it manually now:
                if (typeof pre === 'function') {
                    lexer.options.pre_lex = pre;
                }
                if (typeof post === 'function') {
                    lexer.options.post_lex = post;
                }
            }

            if (opts.options.showSource) {
                if (typeof opts.options.showSource === 'function') {
                    opts.options.showSource(lexer, source, opts);
                } else {
                    console.log("\nGenerated lexer sourcecode:\n----------------------------------------\n", source, "\n----------------------------------------\n");
                }
            }
            return lexer;
        } catch (ex) {
            // if (src_exception) {
            //     src_exception.message += '\n        (' + description + ': ' + ex.message + ')';
            // }

            if (ex_callback) {
                ex_callback(ex);
            } else if (dump) {
                console.log('source code:\n', source);
            }
            return false;
        }
    }

    var lexer = test_me(null, null, null, function (ex) {
        // When we get an exception here, it means some part of the user-specified lexer is botched.
        //
        // Now we go and try to narrow down the problem area/category:
        if (!test_me(function () {
            opts.conditions = [];
            opts.showSource = false;
        }, (dict.rules.length > 0 ? 
            'One or more of your lexer state names are possibly botched?' :
            'Your custom lexer is somehow botched.'), ex)) {
            if (!test_me(function () {
                // opts.conditions = [];
                opts.rules = [];
                opts.showSource = false;
                opts.in_rules_failure_analysis_mode = true;
            }, 'One or more of your lexer rules are possibly botched?', ex)) {
                // kill each rule action block, one at a time and test again after each 'edit':
                var rv = false;
                for (var i = 0, len = dict.rules.length; i < len; i++) {
                    dict.rules[i][1] = '{ /* nada */ }';
                    rv = test_me(function () {
                        // opts.conditions = [];
                        // opts.rules = [];
                        // opts.in_rules_failure_analysis_mode = true;
                    }, 'Your lexer rule "' + dict.rules[i][0] + '" action code block is botched?', ex);
                    if (rv) {
                        break;
                    }
                }
                if (!rv) {
                    test_me(function () {
                        opts.conditions = [];
                        opts.rules = [];
                        opts.performAction = 'null';
                        // opts.options = {};
                        // opts.caseHelperInclude = '{}';
                        opts.showSource = false;
                        opts.in_rules_failure_analysis_mode = true;

                        dump = false;
                    }, 'One or more of your lexer rule action code block(s) are possibly botched?', ex);
                }
            }
        }
        throw ex;
    });

    lexer.yy = {};
    if (input) {
        lexer.setInput(input);
    }

    lexer.generate = function () {
        return generateFromOpts(opts);
    };
    lexer.generateModule = function () {
        return generateModule(opts);
    };
    lexer.generateCommonJSModule = function () {
        return generateCommonJSModule(opts);
    };
    lexer.generateAMDModule = function () {
        return generateAMDModule(opts);
    };

    // internal APIs to aid testing:
    lexer.getExpandedMacros = function () {
        return opts.macros;
    };

    return lexer;
}

RegExpLexer.prototype = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,

    parseError: function lexer_parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },
    
    // resets the lexer, sets new input
    setInput: function lexer_setInput(input, yy) {
        this.yy = yy || this.yy || {};
        this._input = input;
        this._more = this._backtrack = this._signaled_error_token = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {
            first_line: 1,
            first_column: 0,
            last_line: 1,
            last_column: 0
        };
        if (this.options.ranges) {
            this.yylloc.range = [0, 0];
        }
        this.offset = 0;
        return this;
    },

    // consumes and returns one char from the input
    input: function lexer_input() {
        if (!this._input) {
            this.done = true;
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
                if (this.options.ranges) {
                    this.yylloc.range[1]++;
                }
            }
        }
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) {
            this.yylloc.range[1]++;
        }

        this._input = this._input.slice(slice_len);
        return ch;
    },

    // unshifts one char (or a string) into the input
    unput: function lexer_unput(ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length - len);
        this.matched = this.matched.substr(0, this.matched.length - len);

        if (lines.length - 1) {
            this.yylineno -= lines.length - 1;
        }

        this.yylloc.last_line = this.yylineno + 1;
        this.yylloc.last_column = (lines ?
                (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                + oldLines[oldLines.length - lines.length].length - lines[0].length :
                this.yylloc.first_column - len);

        if (this.options.ranges) {
            this.yylloc.range[1] = this.yylloc.range[0] + this.yyleng - len;
        }
        this.yyleng = this.yytext.length;
        this.done = false;
        return this;
    },

    // When called from action, caches matched text and appends it on next action
    more: function lexer_more() {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function lexer_reject() {
        if (this.options.backtrack_lexer) {
            this._backtrack = true;
        } else {
            // when the parseError() call returns, we MUST ensure that the error is registered.
            // We accomplish this by signaling an 'error' token to be produced for the current
            // .lex() run.
            this._signaled_error_token = (this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                text: this.match,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR);
        }
        return this;
    },

    // retain first n characters of the match
    less: function lexer_less(n) {
        this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages
    pastInput: function lexer_pastInput(maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

    // return (part of the) upcoming input, i.e. for error messages
    upcomingInput: function lexer_upcomingInput(maxSize) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (next.length < maxSize) {
            next += this._input.substr(0, maxSize - next.length);
        }
        return (next.length > maxSize ? next.substr(0, maxSize) + '...' : next);
    },

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function lexer_showPosition() {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // test the lexed token: return FALSE when not a match, otherwise return token
    test_match: function lexer_test_match(match, indexed_rule) {
        var token,
            lines,
            backup;

        if (this.options.backtrack_lexer) {
            // save context
            backup = {
                yylineno: this.yylineno,
                yylloc: {
                    first_line: this.yylloc.first_line,
                    last_line: this.last_line,
                    first_column: this.yylloc.first_column,
                    last_column: this.yylloc.last_column
                },
                yytext: this.yytext,
                match: this.match,
                matches: this.matches,
                matched: this.matched,
                yyleng: this.yyleng,
                offset: this.offset,
                _more: this._more,
                _input: this._input,
                yy: this.yy,
                conditionStack: this.conditionStack.slice(0),
                done: this.done
            };
            if (this.options.ranges) {
                backup.yylloc.range = this.yylloc.range.slice(0);
            }
        }

        lines = match[0].match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno += lines.length;
        }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                         this.yylloc.last_column + match[0].length
        };
        this.yytext += match[0];
        this.match += match[0];
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        this.offset += this.yyleng;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match[0].length);
        this.matched += match[0];
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
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
            return false; // rule action called reject() implying the next rule should be tested instead.
        } else if (this._signaled_error_token) {
            // produce one 'error' token as .parseError() in reject() did not guarantee a failure signal by throwing an exception!
            token = this._signaled_error_token;
            this._signaled_error_token = false;
            return token;
        }
        return false;
    },

    // return next match in input
    next: function lexer_next() {
        function clear() {
            this.yytext = '';
            this.yyleng = 0;
            this.match = '';
            this.matches = false;
            this._more = false;
            this._backtrack = false;
        }

        if (this.done) {
            clear.call(this);
            return this.EOF;
        }
        if (!this._input) {
            this.done = true;
        }

        var token,
            match,
            tempMatch,
            index;
        if (!this._more) {
            clear.call(this);
        }
        var rules = this._currentRules();
        for (var i = 0; i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rules[i]);
                    if (token !== false) {
                        return token;
                    } else if (this._backtrack) {
                        match = false;
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
            token = this.test_match(match, rules[index]);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === '') {
            clear.call(this);
            this.done = true;
            return this.EOF;
        } else {
            token = this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                text: this.match + this._input,
                token: null,
                line: this.yylineno,
                loc: this.yylloc,
                lexer: this
            }) || this.ERROR;
            if (token === this.ERROR) {
                // we can try to recover from a lexer error that parseError() did not 'recover' for us, by moving forward at least one character at a time:
                if (!this.match.length) {
                    this.input();
                }
            }
            return token;
        }
    },

    // return next match that has a token
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

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    begin: function lexer_begin(condition) {
        this.conditionStack.push(condition);
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function lexer_popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // produce the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function lexer__currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function lexer_topState(n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // alias for begin(condition)
    pushState: function lexer_pushState(condition) {
        this.begin(condition);
    },

    // return the number of states currently on the stack
    stateStackSize: function lexer_stateStackSize() {
        return this.conditionStack.length;
    }
};


// Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'` 
function camelCase(s) {
    return s.replace(/-\w/g, function (match) { 
        return match.charAt(1).toUpperCase(); 
    });
}

// camelCase all options: 
function camelCaseAllOptions(opts) {
    opts = opts || {};
    var options = {};
    for (var key in opts) {
        var nk = camelCase(key);
        options[nk] = opts[key];
    }
    return options;
}



// generate lexer source from a grammar
function generate(dict, tokens) {
    var opt = processGrammar(dict, tokens);

    return generateFromOpts(opt);
}

// process the grammar and build final data structures and functions
function processGrammar(dict, tokens) {
    var opts = {};
    if (typeof dict === 'string') {
        dict = lexParser.parse(dict);
    }
    dict = dict || {};

    // Feed the possibly reprocessed 'dictionary' above back to the caller
    // (for use by our error diagnostic assistance code)
    opts.lex_rule_dictionary = dict;

    // Make sure to camelCase all options: 
    opts.options = camelCaseAllOptions(dict.options);

    opts.moduleType = opts.options.moduleType;
    opts.moduleName = opts.options.moduleName;

    opts.conditions = prepareStartConditions(dict.startConditions);
    opts.conditions.INITIAL = {
        rules: [], 
        inclusive: true
    };

    var code = buildActions(dict, tokens, opts);
    opts.performAction = code.actions;
    opts.caseHelperInclude = code.caseHelperInclude;
    opts.rules = code.rules;
    opts.macros = code.macros;

    opts.conditionStack = ['INITIAL'];

    opts.actionInclude = (dict.actionInclude || '');
    opts.moduleInclude = (opts.moduleInclude || '') + (dict.moduleInclude || '').trim();
    return opts;
}

// Assemble the final source from the processed grammar
function generateFromOpts(opt) {
    var code = '';

    if (opt.moduleType === 'commonjs') {
        code = generateCommonJSModule(opt);
    } else if (opt.moduleType === 'amd') {
        code = generateAMDModule(opt);
    } else {
        code = generateModule(opt);
    }

    return code;
}

function generateRegexesInitTableCode(opt) {
    var a = opt.rules;
    var print_xregexp = opt.options && opt.options.xregexp;
    a = a.map(function generateXRegExpInitCode(re) {
        if (re instanceof XRegExp) {
            // When we don't need the special XRegExp sauce at run-time, we do with the original
            // JavaScript RegExp instance a.k.a. 'native regex':
            if (re.xregexp.isNative || !print_xregexp) {
                return re;
            }
            // And make sure to escape the regex to make it suitable for placement inside a *string*
            // as it is passed as a string argument to the XRegExp constructor here.
            return 'new XRegExp("' + re.xregexp.source.replace(/[\\"]/g, '\\$&') + '", "' + re.xregexp.flags + '")';
        } else {
            return re;
        }
    });
    return a.join(',\n');
}

function generateModuleBody(opt) {
    var functionDescriptions = {
        setInput: 'resets the lexer, sets new input',
        input: 'consumes and returns one char from the input',
        unput: 'unshifts one char (or a string) into the input',
        more: 'When called from action, caches matched text and appends it on next action',
        reject: 'When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.',
        less: 'retain first n characters of the match',
        pastInput: 'return (part of the) already matched input, i.e. for error messages',
        upcomingInput: 'return (part of the) upcoming input, i.e. for error messages',
        showPosition: 'return a string which displays the character position where the lexing error occurred, i.e. for error messages',
        test_match: 'test the lexed token: return FALSE when not a match, otherwise return token',
        next: 'return next match in input',
        lex: 'return next match that has a token',
        begin: 'activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)',
        popState: 'pop the previously active lexer condition state off the condition stack',
        _currentRules: 'produce the lexer rule set which is active for the currently active lexer condition state',
        topState: 'return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available',
        pushState: 'alias for begin(condition)',
        stateStackSize: 'return the number of states currently on the stack'
    };

    // make the JSON output look more like JavaScript:
    function cleanupJSON(str) {
        str = str.replace(/  "rules": \[/g, '  rules: [');
        str = str.replace(/  "inclusive": /g, '  inclusive: ');
        return str;
    }

    function produceOptions(opts) {
        var obj = {};
        var do_not_pass = {
          moduleName: 1,
          moduleType: 1,
        };
        for (var k in opts) {
            if (!do_not_pass[k]) {
                // make sure numeric values are encoded as numeric, the rest as boolean/string.
                if (typeof opts[k] === 'string') {
                    var f = parseFloat(opts[k]);
                    if (f == opts[k]) {
                        obj[k] = f;
                        continue;
                    }
                }
                obj[k] = opts[k];
            }
        }

        var pre = obj.pre_lex;
        var post = obj.post_lex;
        // since JSON cannot encode functions, we'll have to do it manually at run-time, i.e. later on:
        obj.pre_lex = (pre ? true : undefined);
        obj.post_lex = (post ? true : undefined);

        var js = JSON.stringify(obj, null, 2);

        js = js.replace(/  \"([a-zA-Z_][a-zA-Z0-9_]*)\": /g, "  $1: ");
        js = js.replace(/^( +)pre_lex: true,$/gm, "$1pre_lex: " + String(pre) + ',');
        js = js.replace(/^( +)post_lex: true,$/gm, "$1post_lex: " + String(post) + ',');
        return js;
    }


    var out;
    if (opt.rules.length > 0 || opt.in_rules_failure_analysis_mode) {
        var p = [];
        var descr;

        // we don't mind that the `test_me()` code above will have this `lexer` variable re-defined:
        // JavaScript is fine with that.
        out = 'var lexer = {\n';

        for (var k in RegExpLexer.prototype) {
            if (RegExpLexer.prototype.hasOwnProperty(k) && k.indexOf('generate') === -1) {
                // copy the function description as a comment before the implementation; supports multi-line descriptions
                descr = '\n';
                if (functionDescriptions[k]) {
                    descr += '// ' + functionDescriptions[k].replace(/\n/g, '\n\/\/ ') + '\n';
                }
                p.push(descr + k + ':' + (RegExpLexer.prototype[k].toString() || '""'));
            }
        }
        out += p.join(',\n');

        if (opt.options) {
            // Assure all options are camelCased:
            assert(typeof opt.options['case-insensitive'] === 'undefined');

            out += ',\noptions: ' + produceOptions(opt.options);
        }

        out += ',\nJisonLexerError: JisonLexerError';
        out += ',\nperformAction: ' + String(opt.performAction);
        out += ',\nsimpleCaseActionClusters: ' + String(opt.caseHelperInclude);
        out += ',\nrules: [\n' + generateRegexesInitTableCode(opt) + '\n]';
        out += ',\nconditions: ' + cleanupJSON(JSON.stringify(opt.conditions, null, 2));
        out += '\n};\n';
    } else {
        // We're clearly looking at a custom lexer here as there's no lexer rules at all.
        // 
        // We are re-purposing the `%{...%}` `actionInclude` code block here as it serves no purpose otherwise.
        // 
        // Meanwhile we make sure we have the `lexer` variable declared in *local scope* no matter
        // what crazy stuff (or lack thereof) the userland code is pulling in the `actionInclude` chunk.
        out = 'var lexer;\n';

        if (opt.actionInclude) {
            out += opt.actionInclude + (!opt.actionInclude.match(/;[\s\r\n]*$/) ? ';' : '') + '\n';
        }
    }

    // The output of this function is guaranteed to read something like this:
    // 
    // ```
    // var lexer;
    // 
    // bla bla bla bla ... lotsa bla bla;
    // ```
    // 
    // and that should work nicely as an `eval()`-able piece of source code.
    return out;
}

function generateModule(opt) {
    opt = opt || {};

    var out = ['/* generated by jison-lex ' + version + ' */'];
    var moduleName = opt.moduleName || 'lexer';

    out.push('var ' + moduleName + ' = (function () {');
    out.push.apply(out, jisonLexerErrorDefinition);
    out.push(generateModuleBody(opt));

    if (opt.moduleInclude) {
        out.push(opt.moduleInclude + ';');
    }

    out.push(
        'return lexer;',
        '})();'
    );

    return out.join('\n');
}

function generateAMDModule(opt) {
    opt = opt || {};

    var out = ['/* generated by jison-lex ' + version + ' */'];

    out.push('define([], function () {');
    out.push.apply(out, jisonLexerErrorDefinition);
    out.push(generateModuleBody(opt));

    if (opt.moduleInclude) {
        out.push(opt.moduleInclude + ';');
    }

    out.push(
        'return lexer;',
        '});'
    );

    return out.join('\n');
}

function generateCommonJSModule(opt) {
    opt = opt || {};

    var out = [];
    var moduleName = opt.moduleName || 'lexer';

    out.push(
        generateModule(opt),
        'exports.lexer = ' + moduleName + ';',
        'exports.lex = function () {',
        ' return ' + moduleName + '.lex.apply(lexer, arguments);',
        '};'
    );
    return out.join('\n');
}

RegExpLexer.generate = generate;

module.exports = RegExpLexer;

