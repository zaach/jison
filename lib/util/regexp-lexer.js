// Basic Lexer implemented using JavaScript regular expressions
// Zachary Carter <zach@carter.name>
// MIT Licensed

'use strict';

var XRegExp = require('xregexp');
var json5 = require('json5');
var lexParser = require('./lex-parser');
var setmgmt = require('./regexp-set-management');
var version = require('./package.json').version;
var assert = require('assert');

const XREGEXP_UNICODE_ESCAPE_RE = setmgmt.XREGEXP_UNICODE_ESCAPE_RE;              // Matches the XRegExp Unicode escape braced part, e.g. `{Number}`
const CHR_RE = setmgmt.CHR_RE;
const SET_PART_RE = setmgmt.SET_PART_RE;
const NOTHING_SPECIAL_RE = setmgmt.NOTHING_SPECIAL_RE;
const UNICODE_BASE_PLANE_MAX_CP = setmgmt.UNICODE_BASE_PLANE_MAX_CP;

// The expanded regex sets which are equivalent to the given `\\{c}` escapes:
//
// `/\s/`:
const WHITESPACE_SETSTR = setmgmt.WHITESPACE_SETSTR;
// `/\d/`:
const DIGIT_SETSTR = setmgmt.DIGIT_SETSTR;
// `/\w/`:
const WORDCHAR_SETSTR = setmgmt.WORDCHAR_SETSTR;



// see also ./lib/cli.js
const defaultJisonLexOptions = {
    moduleType: 'commonjs',
    debug: false,
    json: false,
    noMain: false,                  // CLI: not:(--main option)

    moduleName: undefined,
    defaultModuleName: 'lexer',
    file: undefined,
    outfile: undefined,
    inputPath: undefined,
    warn_cb: undefined,  // function(msg) | true (= use Jison.Print) | false (= throw Exception)

    parseParams: undefined,
    xregexp: false,
    lexer_errors_are_recoverable: false,
    flex: false,
    backtrack_lexer: false,
    ranges: undefined,
    caseInsensitive: false,
    showSource: false,
    pre_lex: undefined,
    post_lex: undefined,
};


// Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
function camelCase(s) {
    // Convert first character to lowercase
    return s.replace(/^\w/, function (match) {
        return match.toLowerCase();
    })
    .replace(/-\w/g, function (match) {
        return match.charAt(1).toUpperCase();
    });
}

// Merge sets of options.
//
// Convert alternative jison option names to their base option.
//
// The *last* option set which overrides the default wins, where 'override' is
// defined as specifying a not-undefined value which is not equal to the
// default value.
//
// Return a fresh set of options.
function mkStdOptions(/*args...*/) {
    var h = Object.prototype.hasOwnProperty;

    // clone defaults, so we do not modify those constants.
    var opts = {};
    var o = defaultJisonLexOptions;

    for (var p in o) {
        if (h.call(o, p) && typeof o[p] !== 'undefined') {
            opts[p] = o[p];
        }
    }

    for (var i = 0, len = arguments.length; i < len; i++) {
        o = arguments[i];

        // clone input (while camel-casing the options), so we do not modify those either.
        var o2 = {};

        for (var p in o) {
            if (h.call(o, p) && typeof o[p] !== 'undefined') {
                o2[camelCase(p)] = o[p];
            }
        }

        // now clean them options up:
        if (typeof o2.main !== 'undefined') {
            o2.noMain = !o2.main;
        }

        delete o2.main;

        // special check for `moduleName` to ensure we detect the 'default' moduleName entering from the CLI
        // NOT overriding the moduleName set in the grammar definition file via an `%options` entry:
        if (o2.moduleName === o2.defaultModuleName) {
            delete o2.moduleName;
        }

        // now see if we have an overriding option here:
        for (var p in o2) {
            if (h.call(o2, p)) {
                if (o2[p] !== undefined && o2[p] !== defaultJisonLexOptions[p]) {
                    opts[p] = o2[p];
                }
            }
        }
    }

    return opts;
}


// Autodetect if the input lexer spec is in JSON or JISON
// format when the `options.json` flag is `true`.
//
// Produce the JSON lexer spec result when these are JSON formatted already as that
// would save us the trouble of doing this again, anywhere else in the JISON
// compiler/generator.
//
// Otherwise return the *parsed* lexer spec as it has
// been processed through LEXParser.
function autodetectAndConvertToJSONformat(lexerSpec, options) {
  var chk_l = null;
  var ex1;

  if (typeof lexerSpec === 'string') {
    if (options.json) {
      try {
          chk_l = json5.parse(lexerSpec);

          // When JSON5-based parsing of the lexer spec succeeds, this implies the lexer spec is specified in `JSON mode`
          // *OR* there's a JSON/JSON5 format error in the input:
      } catch (e) {
          ex1 = e;
      }
    }
    if (!chk_l) {
      // // WARNING: the lexer may receive options specified in the **grammar spec file**,
      // //          hence we should mix the options to ensure the lexParser always
      // //          receives the full set!
      // //
      // // make sure all options are 'standardized' before we go and mix them together:
      // options = mkStdOptions(grammar.options, options);
      try {
          chk_l = lexParser.parse(lexerSpec, options);
      } catch (e) {
          if (options.json) {
              err = new Error('Could not parse lexer spec in JSON AUTODETECT mode\nError: ' + ex1.message + ' (' + e.message + ')');
              err.secondary_exception = e;
              err.stack = ex1.stack;
          } else {
              err = new Error('Could not parse lexer spec\nError: ' + e.message);
              err.stack = e.stack;
          }
          throw err;
      }
    }
  } else {
    chk_l = lexerSpec;
  }

  // Save time! Don't reparse the entire lexer spec *again* inside the code generators when that's not necessary:

  return chk_l;
}





// HELPER FUNCTION: print the function in source code form, properly indented.
function printFunctionSourceCode(f) {
    return String(f).replace(/^    /gm, '');
}
function printFunctionSourceCodeContainer(f) {
    return String(f).replace(/^    /gm, '').replace(/^    /gm, '').replace(/function [^\{]+\{/, '').replace(/\}$/, '');
}



// expand macros and convert matchers to RegExp's
function prepareRules(dict, actions, caseHelper, tokens, startConditions, opts) {
    var m, i, k, rule, action, conditions,
        active_conditions,
        rules = dict.rules,
        newRules = [],
        macros = {},
        regular_rule_count = 0,
        simple_rule_count = 0;

    // Assure all options are camelCased:
    assert(typeof opts.options['case-insensitive'] === 'undefined');

    if (!tokens) {
        tokens = {};
    }

    // Depending on the location within the regex we need different expansions of the macros:
    // one expansion for when a macro is *inside* a `[...]` and another expansion when a macro
    // is anywhere else in a regex:
    if (dict.macros) {
        macros = prepareMacros(dict.macros, opts);
    }

    function tokenNumberReplacement(str, token) {
        return 'return ' + (tokens[token] || '\'' + token.replace(/'/g, '\\\'') + '\'');
    }

    // Make sure a comment does not contain any embedded '*/' end-of-comment marker
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
        rule = rules[i];
        m = rule[0];

        active_conditions = [];
        if (Object.prototype.toString.apply(m) !== '[object Array]') {
            // implicit add to all inclusive start conditions
            for (k in startConditions) {
                if (startConditions[k].inclusive) {
                    active_conditions.push(k);
                    startConditions[k].rules.push(i);
                }
            }
        } else if (m[0] === '*') {
            // Add to ALL start conditions
            active_conditions.push('*');
            for (k in startConditions) {
                startConditions[k].rules.push(i);
            }
            rule.shift();
            m = rule[0];
        } else {
            // Add to explicit start conditions
            conditions = rule.shift();
            m = rule[0];
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

        if (typeof m === 'string') {
            m = expandMacros(m, macros, opts);
            m = new XRegExp('^(?:' + m + ')', opts.options.caseInsensitive ? 'i' : '');
        }
        newRules.push(m);
        if (typeof rule[1] === 'function') {
            rule[1] = String(rule[1]).replace(/^\s*function \(\)\s?\{/, '').replace(/\}\s*$/, '');
        }
        action = rule[1];
        action = action.replace(/return '((?:\\'|[^']+)+)'/g, tokenNumberReplacement);
        action = action.replace(/return "((?:\\"|[^"]+)+)"/g, tokenNumberReplacement);

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
            simple_rule_count++;
            caseHelper.push([].concat(code, i, ':', match_nr[1]).join(' ').replace(/[\n]/g, '\n  '));
        } else {
            regular_rule_count++;
            actions.push([].concat('case', i, ':', code, action, '\nbreak;').join(' '));
        }
    }
    actions.push('default:');
    actions.push('  return this.simpleCaseActionClusters[$avoiding_name_collisions];');
    actions.push('}');

    return {
        rules: newRules,
        macros: macros,

        regular_rule_count: regular_rule_count,
        simple_rule_count: simple_rule_count,
    };
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

    var c1, c2;
    var rv = [];
    var derr;
    var se;

    while (s.length) {
        c1 = s.match(CHR_RE);
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
            var l = new Array(UNICODE_BASE_PLANE_MAX_CP + 1);

            while (s.length) {
                var inner = s.match(SET_PART_RE);
                if (!inner) {
                    inner = s.match(CHR_RE);
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
            c2 = s.match(CHR_RE);
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

            se = set_content.join('');

            // expand any macros in here:
            if (expandAllMacrosInSet_cb) {
                se = expandAllMacrosInSet_cb(se);
                assert(se);
                if (se instanceof Error) {
                    return new Error(errinfo() + ': ' + se.message);
                }
            }

            derr = setmgmt.set2bitarray(l, se, opts);
            if (derr instanceof Error) {
                return new Error(errinfo() + ': ' + derr.message);
            }

            // find out which set expression is optimal in size:
            var s1 = setmgmt.produceOptimizedRegex4Set(l);

            // check if the source regex set potentially has any expansions (guestimate!)
            //
            // The indexOf('{') picks both XRegExp Unicode escapes and JISON lexer macros, which is perfect for us here.
            var has_expansions = (se.indexOf('{') >= 0);

            se = '[' + se + ']';

            if (!has_expansions && se.length < s1.length) {
                s1 = se;
            }
            rv.push(s1);
            break;

        // XRegExp Unicode escape, e.g. `\\p{Number}`:
        case '\\p':
            c2 = s.match(XREGEXP_UNICODE_ESCAPE_RE);
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
            c2 = s.match(NOTHING_SPECIAL_RE);
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
            c2 = s.match(NOTHING_SPECIAL_RE);
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

    assert(s);
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
                        if (XRegExp._getUnicodeProperty(k)) {
                            // Work-around so that you can use `\p{ascii}` for a XRegExp slug, a.k.a.
                            // Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories,
                            // while using `\p{ASCII}` as a *macro expansion* of the `ASCII`
                            // macro:
                            if (k.toUpperCase() !== k) {
                                m = new Error('Cannot use name "' + k + '" as a macro name as it clashes with the same XRegExp "\\p{..}" Unicode \'General Category\' Property name. Use all-uppercase macro names, e.g. name your macro "' + k.toUpperCase() + '" to work around this issue or give your offending macro a different name.');
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

            var mba = setmgmt.reduceRegexToSetBitArray(m, i, opts);

            var s1;

            // propagate deferred exceptions = error reports.
            if (mba instanceof Error) {
                s1 = mba;
            } else {
                s1 = setmgmt.bitarray2set(mba, false);

                m = s1;
            }

            macros[i] = {
                in_set: s1,
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
                        x = m.in_set;

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

    // tokens: map/array of token numbers to token names
    for (tok in tokens) {
        var idx = parseInt(tok);
        if (idx && idx > 0) {
            toks[tokens[tok]] = idx;
        }
    }

    if (opts.options.flex) {
        dict.rules.push(['.', 'console.log(yytext); /* `flex` lexing mode: the last resort rule! */']);
    }

    var gen = prepareRules(dict, actions, caseHelper, tokens && toks, opts.conditions, opts);

    var fun = actions.join('\n');
    'yytext yyleng yylineno yylloc'.split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp('\\b(' + yy + ')\\b', 'g'), 'yy_.$1');
    });

    return {
        caseHelperInclude: '{\n' + caseHelper.join(',') + '\n}',

        actions: expandParseArguments('function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START, parseParams) {\n', opts) + fun + '\n}',

        rules: gen.rules,
        macros: gen.macros,                   // propagate these for debugging/diagnostic purposes

        regular_rule_count: gen.regular_rule_count,
        simple_rule_count: gen.simple_rule_count,
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

    var prelude = [
        '// See also:',
        '// http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/#35881508',
        '// but we keep the prototype.constructor and prototype.name assignment lines too for compatibility',
        '// with userland code which might access the derived class in a \'classic\' way.',
        printFunctionSourceCode(JisonLexerError),
        printFunctionSourceCodeContainer(__extra_code__),
        '',
    ];

    return prelude.join('\n');
}


var jisonLexerErrorDefinition = generateErrorClass();


function RegExpLexer(dict, input, tokens, build_options) {
    var opts;
    var dump = false;

    function test_me(tweak_cb, description, src_exception, ex_callback) {
        opts = processGrammar(dict, tokens, build_options);
        opts.__in_rules_failure_analysis_mode__ = false;
        assert(opts.options);
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
                jisonLexerErrorDefinition,
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
                opts.__in_rules_failure_analysis_mode__ = true;
            }, 'One or more of your lexer rules are possibly botched?', ex)) {
                // kill each rule action block, one at a time and test again after each 'edit':
                var rv = false;
                for (var i = 0, len = dict.rules.length; i < len; i++) {
                    dict.rules[i][1] = '{ /* nada */ }';
                    rv = test_me(function () {
                        // opts.conditions = [];
                        // opts.rules = [];
                        // opts.__in_rules_failure_analysis_mode__ = true;
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
                        opts.__in_rules_failure_analysis_mode__ = true;

                        dump = false;
                    }, 'One or more of your lexer rule action code block(s) are possibly botched?', ex);
                }
            }
        }
        throw ex;
    });

    lexer.setInput(input);

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

// code stripping performance test for very simple grammar:
//
// - removing backtracking parser code branches:                    730K -> 750K rounds
// - removing all location info tracking: yylineno, yylloc, etc.:   750K -> 900K rounds
// - no `yyleng`:                                                   900K -> 905K rounds
// - no `this.done` as we cannot have a NULL `_input` anymore:      905K -> 930K rounds
// - `simpleCaseActionClusters` as array instead of hash object:    930K -> 940K rounds
// - lexers which have only return stmts, i.e. only a
//   `simpleCaseActionClusters` lookup table to produce
//   lexer tokens: *inline* the `performAction` call:               940K -> 950K rounds
// - given all the above, you can *inline* what's left of
//   `lexer_next()`:                                                950K -> 955K rounds (? this stuff becomes hard to measure; inaccuracy abounds!)
//
// Total gain when we forget about very minor (and tough to nail) *inlining* `lexer_next()` gains:
//
//     730 -> 950  ~ 30% performance gain.
//

// As a function can be reproduced in source-code form by any JavaScript engine, we're going to wrap this chunk
// of code in a function so that we can easily get it including it comments, etc.:
function getRegExpLexerPrototype() {
var __objdef__ = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,        // <-- injected by the code generator

    // options: {},                             // <-- injected by the code generator

    // yy: ...,                                 // <-- injected by setInput()

    __currentRuleSet__: null,                   // <-- internal rule set cache for the current lexer state

    __error_infos: [],                          // INTERNAL USE ONLY: the set of lexErrorInfo objects created since the last cleanup

    __decompressed: false,                      // INTERNAL USE ONLY: mark whether the lexer instance has been 'unfolded' completely and is now ready for use

    done: false,                                // INTERNAL USE ONLY
    _backtrack: false,                          // INTERNAL USE ONLY
    _input: '',                                 // INTERNAL USE ONLY
    _more: false,                               // INTERNAL USE ONLY
    _signaled_error_token: false,               // INTERNAL USE ONLY

    conditionStack: [],                         // INTERNAL USE ONLY; managed via `pushState()`, `popState()`, `topState()` and `stateStackSize()`

    match: '',                                  // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction. `match` is identical to `yytext` except that this one still contains the matched input string after `lexer.performAction()` has been invoked, where userland code MAY have changed/replaced the `yytext` value entirely!
    matched: '',                                // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks entire input which has been matched so far
    matches: false,                             // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks RE match result for last (successful) match attempt
    yytext: '',                                 // ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction; this value is transferred to the parser as the 'token value' when the parser consumes the lexer token produced through a call to the `lex()` API.
    offset: 0,                                  // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks the 'cursor position' in the input string, i.e. the number of characters matched so far
    yyleng: 0,                                  // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: length of matched input for the token under construction (`yytext`)
    yylineno: 0,                                // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: 'line number' at which the token under construction is located
    yylloc: null,                               // READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks location info (lines + columns) for the token under construction

    // INTERNAL USE: construct a suitable error info hash object instance for `parseError`.
    constructLexErrorInfo: function lexer_constructLexErrorInfo(msg, recoverable) {
        var pei = {
            errStr: msg,
            recoverable: !!recoverable,
            text: this.match,           // This one MAY be empty; userland code should use the `upcomingInput` API to obtain more text which follows the 'lexer cursor position'...
            token: null,
            line: this.yylineno,
            loc: this.yylloc,
            yy: this.yy,
            lexer: this,

            // and make sure the error info doesn't stay due to potential
            // ref cycle via userland code manipulations.
            // These would otherwise all be memory leak opportunities!
            //
            // Note that only array and object references are nuked as those
            // constitute the set of elements which can produce a cyclic ref.
            // The rest of the members is kept intact as they are harmless.
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

    parseError: function lexer_parseError(str, hash, ExceptionClass) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash, ExceptionClass) || this.ERROR;
        } else if (typeof this.yy.parseError === 'function') {
            return this.yy.parseError(str, hash, ExceptionClass) || this.ERROR;
        } else {
            throw new ExceptionClass(str, hash);
        }
    },

    // final cleanup function for when we have completed lexing the input;
    // make it an API so that external code can use this one once userland
    // code has decided it's time to destroy any lingering lexer error
    // hash object instances and the like: this function helps to clean
    // up these constructs, which *may* carry cyclic references which would
    // otherwise prevent the instances from being properly and timely
    // garbage-collected, i.e. this function helps prevent memory leaks!
    cleanupAfterLex: function lexer_cleanupAfterLex(do_not_nuke_errorinfos) {
        var rv;

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

    // clear the lexer token context; intended for internal use only
    clear: function lexer_clear() {
        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        this.matches = false;
        this._more = false;
        this._backtrack = false;
    },

    // resets the lexer, sets new input
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
            var rule_regexes = new Array(len + 1);            // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in `lexer_next()` fast and simple!
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
            // when the `parseError()` call returns, we MUST ensure that the error is registered.
            // We accomplish this by signaling an 'error' token to be produced for the current
            // `.lex()` run.
            var p = this.constructLexErrorInfo('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), false);
            this._signaled_error_token = (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
        }
        return this;
    },

    // retain first n characters of the match
    less: function lexer_less(n) {
        return this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    pastInput: function lexer_pastInput(maxSize, maxLines) {
        var past = this.matched.substring(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = past.length;         // can't ever have more input lines than this!
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

    // return (part of the) upcoming input, i.e. for error messages.
    // Limit the returned string length to `maxSize` (default: 20).
    // Limit the returned string to the `maxLines` number of lines of input (default: 1).
    // Negative limit values equal *unlimited*.
    upcomingInput: function lexer_upcomingInput(maxSize, maxLines) {
        var next = this.match;
        if (maxSize < 0)
            maxSize = next.length + this._input.length;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = maxSize;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substring` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        if (next.length < maxSize * 2 + 2) {
            next += this._input.substring(0, maxSize * 2 + 2);  // substring is faster on Chrome/V8
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

    // return a string which displays the character position where the lexing error occurred, i.e. for error messages
    showPosition: function lexer_showPosition(maxPrefix, maxPostfix) {
        var pre = this.pastInput(maxPrefix).replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput(maxPostfix).replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // helper function, used to produce a human readable description as a string, given
    // the input `yylloc` location object.
    // Set `display_range_too` to TRUE to include the string character index position(s)
    // in the description if the `yylloc.range` is available.
    describeYYLLOC: function lexer_describe_yylloc(yylloc, display_range_too) {
        var l1 = yylloc.first_line;
        var l2 = yylloc.last_line;
        var o1 = yylloc.first_column;
        var o2 = yylloc.last_column - 1;
        var dl = l2 - l1;
        var d_o = (dl === 0 ? o2 - o1 : 1000);
        var rv;
        if (dl === 0) {
            rv = 'line ' + l1 + ', ';
            if (d_o === 0) {
                rv += 'column ' + o1;
            } else {
                rv += 'columns ' + o1 + ' .. ' + o2;
            }
        } else {
            rv = 'lines ' + l1 + '(column ' + o1 + ') .. ' + l2 + '(column ' + o2 + ')';
        }
        if (yylloc.range && display_range_too) {
            var r1 = yylloc.range[0];
            var r2 = yylloc.range[1] - 1;
            if (r2 === r1) {
                rv += ' {String Offset: ' + r1 + '}';
            } else {
                rv += ' {String Offset range: ' + r1 + ' .. ' + r2 + '}';
            }
        }
        return rv;
        // return JSON.stringify(yylloc);
    },

    // test the lexed token: return FALSE when not a match, otherwise return token.
    //
    // `match` is supposed to be an array coming out of a regex match, i.e. `match[0]`
    // contains the actually matched text string.
    //
    // Also move the input cursor forward and update the match collectors:
    // - yytext
    // - yyleng
    // - match
    // - matches
    // - yylloc
    // - offset
    test_match: function lexer_test_match(match, indexed_rule, parseParams) {
        var token,
            lines,
            backup,
            match_str,
            match_str_len;

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

        match_str = match[0];
        match_str_len = match_str.length;
        // if (match_str.indexOf('\n') !== -1 || match_str.indexOf('\r') !== -1) {
            lines = match_str.match(/(?:\r\n?|\n).*/g);
            if (lines) {
                this.yylineno += lines.length;
            }
        // }
        this.yylloc = {
            first_line: this.yylloc.last_line,
            last_line: this.yylineno + 1,
            first_column: this.yylloc.last_column,
            last_column: lines ?
                         lines[lines.length - 1].length - lines[lines.length - 1].match(/^\r?\n?/)[0].length :
                         this.yylloc.last_column + match_str_len
        };
        this.yytext += match_str;
        this.match += match_str;
        this.matches = match;
        this.yyleng = this.yytext.length;
        if (this.options.ranges) {
            this.yylloc.range = [this.offset, this.offset + this.yyleng];
        }
        // previous lex rules MAY have invoked the `more()` API rather than producing a token:
        // those rules will already have moved this `offset` forward matching their match lengths,
        // hence we must only add our own match length now:
        this.offset += match_str_len;
        this._more = false;
        this._backtrack = false;
        this._input = this._input.slice(match_str_len);
        this.matched += match_str;

        // calling this method:
        //
        //   function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START) {...}
        token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1] /* = YY_START */, parseParams);
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
            return false; // rule action called reject() implying the next rule should be tested instead.
        } else if (this._signaled_error_token) {
            // produce one 'error' token as `.parseError()` in `reject()` did not guarantee a failure signal by throwing an exception!
            token = this._signaled_error_token;
            this._signaled_error_token = false;
            return token;
        }
        return false;
    },

    // return next match in input
    next: function lexer_next(parseParams) {
        if (this.done) {
            this.clear();
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
                var p = this.constructLexErrorInfo('Internal lexer engine error on line ' + (this.yylineno + 1) + '. The lex grammar programmer pushed a non-existing condition name "' + this.topState() + '"; this is a fatal error and should be reported to the application programmer team!\n', false);
                // produce one 'error' token until this situation has been resolved, most probably by parse termination!
                return (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
            }
        }

        var rule_ids = spec.rules;
//        var dispatch = spec.__dispatch_lut;
        var regexes = spec.__rule_regexes;
        var len = spec.__rule_count;

//        var c0 = this._input[0];

        // Note: the arrays are 1-based, while `len` itself is a valid index,
        // hence the non-standard less-or-equal check in the next loop condition!
        //
        // `dispatch` is a lookup table which lists the *first* rule which matches the 1-char *prefix* of the rule-to-match.
        // By using that array as a jumpstart, we can cut down on the otherwise O(n*m) behaviour of this lexer, down to
        // O(n) ideally, where:
        //
        // - N is the number of input particles -- which is not precisely characters
        //   as we progress on a per-regex-match basis rather than on a per-character basis
        //
        // - M is the number of rules (regexes) to test in the active condition state.
        //
        for (var i = 1 /* (dispatch[c0] || 1) */ ; i <= len; i++) {
            tempMatch = this._input.match(regexes[i]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (this.options.backtrack_lexer) {
                    token = this.test_match(tempMatch, rule_ids[i], parseParams);
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
            token = this.test_match(match, rule_ids[index], parseParams);
            if (token !== false) {
                return token;
            }
            // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
            return false;
        }
        if (this._input === '') {
            this.done = true;
            return this.EOF;
        } else {
            var p = this.constructLexErrorInfo('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), this.options.lexer_errors_are_recoverable);
            token = (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
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

    // return next match that has a token
    lex: function lexer_lex(parseParams) {
        var r;
        // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
        if (typeof this.options.pre_lex === 'function') {
            r = this.options.pre_lex.call(this, parseParams);
        }
        while (!r) {
            r = this.next(parseParams);
        }
        if (typeof this.options.post_lex === 'function') {
            // (also account for a userdef function which does not return any value: keep the token as is)
            r = this.options.post_lex.call(this, r, parseParams) || r;
        }
        return r;
    },

    // backwards compatible alias for `pushState()`;
    // the latter is symmetrical with `popState()` and we advise to use
    // those APIs in any modern lexer code, rather than `begin()`.
    begin: function lexer_begin(condition) {
        return this.pushState(condition);
    },

    // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
    pushState: function lexer_pushState(condition) {
        this.conditionStack.push(condition);
        this.__currentRuleSet__ = null;
        return this;
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function lexer_popState() {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            this.__currentRuleSet__ = null;
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
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

    // (internal) determine the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function lexer__currentRules() {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]];
        } else {
            return this.conditions['INITIAL'];
        }
    },

    // return the number of states currently on the stack
    stateStackSize: function lexer_stateStackSize() {
        return this.conditionStack.length;
    }
};
    return __objdef__;
}

RegExpLexer.prototype = getRegExpLexerPrototype();




// Fill in the optional, extra parse parameters (`%parse-param ...`)
// in the generated *lexer*.
//
// See for important context:
//
//     https://github.com/zaach/jison/pull/332
function expandParseArguments(parseFn, options) {
    var arglist = (options && options.parseParams);

    if (!arglist) {
        parseFn = parseFn.replace(/, parseParams\b/g, '');
        parseFn = parseFn.replace(/\bparseParams\b/g, '');
    } else {
        parseFn = parseFn.replace(/, parseParams\b/g, ', ' + arglist.join(', '));
        parseFn = parseFn.replace(/\bparseParams\b/g, arglist.join(', '));
    }
    return parseFn;
}



// The lexer code stripper, driven by optimization analysis settings and
// lexer options, which cannot be changed at run-time:
function stripUnusedLexerCode(src, options) {
    return src;
}





// generate lexer source from a grammar
function generate(dict, tokens, build_options) {
    var opt = processGrammar(dict, tokens, build_options);

    return generateFromOpts(opt);
}

// process the grammar and build final data structures and functions
function processGrammar(dict, tokens, build_options) {
    build_options = build_options || {};
    var opts = {};

    // include the knowledge passed through `build_options` about which lexer
    // features will actually be *used* by the environment (which in 99.9%
    // of cases is a jison *parser*):
    //
    // (this stuff comes straight from the jison Optimization Analysis.)
    //
    opts.parseActionsAreAllDefault = build_options.parseActionsAreAllDefault;
    opts.parseActionsUseYYLENG = build_options.parseActionsUseYYLENG;
    opts.parseActionsUseYYLINENO = build_options.parseActionsUseYYLINENO;
    opts.parseActionsUseYYTEXT = build_options.parseActionsUseYYTEXT;
    opts.parseActionsUseYYLOC = build_options.parseActionsUseYYLOC;
    opts.parseActionsUseParseError = build_options.parseActionsUseParseError;
    opts.parseActionsUseYYERROR = build_options.parseActionsUseYYERROR;
    opts.parseActionsUseYYERROK = build_options.parseActionsUseYYERROK;
    opts.parseActionsUseYYCLEARIN = build_options.parseActionsUseYYCLEARIN;
    opts.parseActionsUseValueTracking = build_options.parseActionsUseValueTracking;
    opts.parseActionsUseValueAssignment = build_options.parseActionsUseValueAssignment;
    opts.parseActionsUseLocationTracking = build_options.parseActionsUseLocationTracking;
    opts.parseActionsUseLocationAssignment = build_options.parseActionsUseLocationAssignment;
    opts.parseActionsUseYYSTACK = build_options.parseActionsUseYYSTACK;
    opts.parseActionsUseYYSSTACK = build_options.parseActionsUseYYSSTACK;
    opts.parseActionsUseYYSTACKPOINTER = build_options.parseActionsUseYYSTACKPOINTER;
    opts.parserHasErrorRecovery = build_options.parserHasErrorRecovery;

    dict = autodetectAndConvertToJSONformat(dict, build_options) || {};

    // Feed the possibly reprocessed 'dictionary' above back to the caller
    // (for use by our error diagnostic assistance code)
    opts.lex_rule_dictionary = dict;

    // Always provide the lexer with an options object, even if it's empty!
    // Make sure to camelCase all options:
    opts.options = mkStdOptions(build_options, dict.options);

    opts.parseParams = opts.options.parseParams;

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

    switch (opt.moduleType) {
    case 'js':
        code = generateModule(opt);
        break;
    case 'amd':
        code = generateAMDModule(opt);
        break;
    case 'es':
        code = generateESModule(opt);
        break;
    case 'commonjs':
    default:
        code = generateCommonJSModule(opt);
        break;
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
    // make the JSON output look more like JavaScript:
    function cleanupJSON(str) {
        str = str.replace(/  "rules": \[/g, '  rules: [');
        str = str.replace(/  "inclusive": /g, '  inclusive: ');
        return str;
    }

    function produceOptions(opts) {
        var obj = {};
        var do_not_pass = {
          debug: !opts.debug,     // do not include this item when it is FALSE as there's no debug tracing built into the generated grammar anyway!
          json: 1,
          _: 1,
          noMain: 1,
          reportStats: 1,
          file: 1,
          outfile: 1,
          inputPath: 1,
          defaultModuleName: 1,
          moduleName: 1,
          moduleType: 1,
          lexer_errors_are_recoverable: 0,
          flex: 0,
          backtrack_lexer: 0,
          caseInsensitive: 0,
          showSource: 1,
          parseActionsAreAllDefault: 1,
          parseActionsUseYYLENG: 1,
          parseActionsUseYYLINENO: 1,
          parseActionsUseYYTEXT: 1,
          parseActionsUseYYLOC: 1,
          parseActionsUseParseError: 1,
          parseActionsUseYYERROR: 1,
          parseActionsUseYYERROK: 1,
          parseActionsUseYYCLEARIN: 1,
          parseActionsUseValueTracking: 1,
          parseActionsUseValueAssignment: 1,
          parseActionsUseLocationTracking: 1,
          parseActionsUseLocationAssignment: 1,
          parseActionsUseYYSTACK: 1,
          parseActionsUseYYSSTACK: 1,
          parseActionsUseYYSTACKPOINTER: 1,
          parserHasErrorRecovery: 1,
        };
        for (var k in opts) {
            if (!do_not_pass[k] && opts[k] != null && opts[k] !== false) {
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

        // And now some options which should receive some special processing:
        var pre = obj.pre_lex;
        var post = obj.post_lex;
        // since JSON cannot encode functions, we'll have to do it manually at run-time, i.e. later on:
        obj.pre_lex = (pre ? true : undefined);
        obj.post_lex = (post ? true : undefined);

        var js = JSON.stringify(obj, null, 2);

        js = js.replace(new XRegExp('  "([\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*)": ', 'g'), '  $1: ');
        js = js.replace(/^( +)pre_lex: true,$/gm, "$1pre_lex: " + String(pre) + ',');
        js = js.replace(/^( +)post_lex: true,$/gm, "$1post_lex: " + String(post) + ',');
        return js;
    }


    var out;
    if (opt.rules.length > 0 || opt.__in_rules_failure_analysis_mode__) {
        var descr;

        // we don't mind that the `test_me()` code above will have this `lexer` variable re-defined:
        // JavaScript is fine with that.
        out = `
var lexer = {
    // Code Generator Information Report
    // ---------------------------------
    //
    // Options:
    //   backtracking:        ${opt.options.backtrack_lexer}
    //   location.ranges:     ${opt.options.ranges}
    //
    // Forwarded Parser Analysis flags:
    //   uses yyleng:         ${opt.parseActionsUseYYLENG}
    //   uses yylineno:       ${opt.parseActionsUseYYLINENO}
    //   uses yytext:         ${opt.parseActionsUseYYTEXT}
    //   uses yylloc:         ${opt.parseActionsUseYYLOC}
    //   uses lexer values:   ${opt.parseActionsUseValueTracking} / ${opt.parseActionsUseValueAssignment}
    //   location tracking:   ${opt.parseActionsUseLocationTracking}
    //   location assignment: ${opt.parseActionsUseLocationAssignment}
    //
    // --------- END OF REPORT -----------

`;

        // get the RegExpLexer.prototype in source code form:
        var protosrc = String(getRegExpLexerPrototype);
        // and strip off the surrounding bits we don't want:
        protosrc = protosrc
        .replace(/^[\s\r\n]*function getRegExpLexerPrototype\(\) \{[\s\r\n]*var __objdef__ = \{[\s]*[\r\n]/, '')
        .replace(/[\s\r\n]*\};[\s\r\n]*return __objdef__;[\s\r\n]*\}[\s\r\n]*/, '');
        protosrc = expandParseArguments(protosrc, opt.options);
        protosrc = stripUnusedLexerCode(protosrc, opt);
        out += protosrc + ',\n';

        assert(opt.options);
        // Assure all options are camelCased:
        assert(typeof opt.options['case-insensitive'] === 'undefined');

        out += '    options: ' + produceOptions(opt.options);

        out += ',\n    JisonLexerError: JisonLexerError';
        out += ',\n    performAction: ' + String(opt.performAction);
        out += ',\n    simpleCaseActionClusters: ' + String(opt.caseHelperInclude);
        out += ',\n    rules: [\n' + generateRegexesInitTableCode(opt) + '\n]';
        out += ',\n    conditions: ' + cleanupJSON(JSON.stringify(opt.conditions, null, 2));
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

function generateGenericHeaderComment() {
    var out = '/* lexer generated by jison-lex ' + version + ' */\n'
        + '/*\n'
        + ' * Returns a Lexer object of the following structure:\n'
        + ' *\n'
        + ' *  Lexer: {\n'
        + ' *    yy: {}     The so-called "shared state" or rather the *source* of it;\n'
        + ' *               the real "shared state" `yy` passed around to\n'
        + ' *               the rule actions, etc. is a derivative/copy of this one,\n'
        + ' *               not a direct reference!\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  Lexer.prototype: {\n'
        + ' *    yy: {},\n'
        + ' *    EOF: 1,\n'
        + ' *    ERROR: 2,\n'
        + ' *\n'
        + ' *    JisonLexerError: function(msg, hash),\n'
        + ' *\n'
        + ' *    performAction: function lexer__performAction(yy, yy_, $avoiding_name_collisions, YY_START, ...),\n'
        + ' *               where `...` denotes the (optional) additional arguments the user passed to\n'
        + ' *               `lexer.lex(...)` and specified by way of `%parse-param ...` in the **parser** grammar file\n'
        + ' *\n'
        + ' *               The function parameters and `this` have the following value/meaning:\n'
        + ' *               - `this`    : reference to the `lexer` instance.\n'
        + ' *\n'
        + ' *               - `yy`      : a reference to the `yy` "shared state" object which was passed to the lexer\n'
        + ' *                             by way of the `lexer.setInput(str, yy)` API before.\n'
        + ' *\n'
        + ' *               - `yy_`     : lexer instance reference used internally.\n'
        + ' *\n'
        + ' *               - `$avoiding_name_collisions`   : index of the matched lexer rule (regex), used internally.\n'
        + ' *\n'
        + ' *               - `YY_START`: the current lexer "start condition" state.\n'
        + ' *\n'
        + ' *               - `...`     : the extra arguments you specified in the `%parse-param` statement in your\n'
        + ' *                             **parser** grammar definition file and which are passed to the lexer via\n'
        + ' *                             its `lexer.lex(...)` API.\n'
        + ' *\n'
        + ' *    parseError: function(str, hash, ExceptionClass),\n'
        + ' *\n'
        + ' *    constructLexErrorInfo: function(error_message, is_recoverable),\n'
        + ' *               Helper function.\n'
        + ' *               Produces a new errorInfo \'hash object\' which can be passed into `parseError()`.\n'
        + ' *               See it\'s use in this lexer kernel in many places; example usage:\n'
        + ' *\n'
        + ' *                   var infoObj = lexer.constructParseErrorInfo(\'fail!\', true);\n'
        + ' *                   var retVal = lexer.parseError(infoObj.errStr, infoObj, lexer.JisonLexerError);\n'
        + ' *\n'
        + ' *    options: { ... lexer %options ... },\n'
        + ' *\n'
        + ' *    lex: function([args...]),\n'
        + ' *               Produce one token of lexed input, which was passed in earlier via the `lexer.setInput()` API.\n'
        + ' *               You MAY use the additional `args...` parameters as per `%parse-param` spec of the **parser** grammar:\n'
        + ' *               these extra `args...` are passed verbatim to the lexer rules\' action code.\n'
        + ' *\n'
        + ' *    cleanupAfterLex: function(do_not_nuke_errorinfos),\n'
        + ' *               Helper function.\n'
        + ' *               This helper API is invoked when the parse process has completed. This helper may\n'
        + ' *               be invoked by user code to ensure the internal lexer gets properly garbage collected.\n'
        + ' *\n'
        + ' *        setInput: function(input, [yy]),\n'
        + ' *        input: function(),\n'
        + ' *        unput: function(str),\n'
        + ' *        more: function(),\n'
        + ' *        reject: function(),\n'
        + ' *        less: function(n),\n'
        + ' *        pastInput: function(n),\n'
        + ' *        upcomingInput: function(n),\n'
        + ' *        showPosition: function(),\n'
        + ' *        test_match: function(regex_match_array, rule_index),\n'
        + ' *        next: function(...),\n'
        + ' *        lex: function(...),\n'
        + ' *        begin: function(condition),\n'
        + ' *        pushState: function(condition),\n'
        + ' *        popState: function(),\n'
        + ' *        topState: function(),\n'
        + ' *        _currentRules: function(),\n'
        + ' *        stateStackSize: function(),\n'
        + ' *\n'
        + ' *        options: { ... lexer %options ... },\n'
        + ' *\n'
        + ' *        performAction: function(yy, yy_, $avoiding_name_collisions, YY_START, ...),\n'
        + ' *        rules: [...],\n'
        + ' *        conditions: {associative list: name ==> set},\n'
        + ' *  }\n'
        + ' *\n'
        + ' *\n'
        + ' *  token location info (`yylloc`): {\n'
        + ' *    first_line: n,\n'
        + ' *    last_line: n,\n'
        + ' *    first_column: n,\n'
        + ' *    last_column: n,\n'
        + ' *    range: [start_number, end_number]\n'
        + ' *               (where the numbers are indexes into the input string, zero-based)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * ---\n'
        + ' *\n'
        + ' * The `parseError` function receives a \'hash\' object with these members for lexer errors:\n'
        + ' *\n'
        + ' *  {\n'
        + ' *    text:        (matched text)\n'
        + ' *    token:       (the produced terminal token, if any)\n'
        + ' *    token_id:    (the produced terminal token numeric ID, if any)\n'
        + ' *    line:        (yylineno)\n'
        + ' *    loc:         (yylloc)\n'
        + ' *    recoverable: (boolean: TRUE when the parser MAY have an error recovery rule\n'
        + ' *                  available for this particular error)\n'
        + ' *    yy:          (object: the current parser internal "shared state" `yy`\n'
        + ' *                  as is also available in the rule actions; this can be used,\n'
        + ' *                  for instance, for advanced error analysis and reporting)\n'
        + ' *    lexer:       (reference to the current lexer instance used by the parser)\n'
        + ' *  }\n'
        + ' *\n'
        + ' * while `this` will reference the current lexer instance.\n'
        + ' *\n'
        + ' * When `parseError` is invoked by the lexer, the default implementation will\n'
        + ' * attempt to invoke `yy.parser.parseError()`; when this callback is not provided\n'
        + ' * it will try to invoke `yy.parseError()` instead. When that callback is also not\n'
        + ' * provided, a `JisonLexerError` exception will be thrown containing the error\n'
        + ' * message and `hash`, as constructed by the `constructLexErrorInfo()` API.\n'
        + ' *\n'
        + ' * Note that the lexer\'s `JisonLexerError` error class is passed via the\n'
        + ' * `ExceptionClass` argument, which is invoked to construct the exception\n'
        + ' * instance to be thrown, so technically `parseError` will throw the object\n'
        + ' * produced by the `new ExceptionClass(str, hash)` JavaScript expression.\n'
        + ' *\n'
        + ' * ---\n'
        + ' *\n'
        + ' * You can specify lexer options by setting / modifying the `.options` object of your Lexer instance.\n'
        + ' * These options are available:\n'
        + ' *\n'
        + ' * (Options are permanent.)\n'
        + ' *  \n'
        + ' *  yy: {\n'
        + ' *      parseError: function(str, hash, ExceptionClass)\n'
        + ' *                 optional: overrides the default `parseError` function.\n'
        + ' *  }\n'
        + ' *\n'
        + ' *  lexer.options: {\n'
        + ' *      pre_lex:  function()\n'
        + ' *                 optional: is invoked before the lexer is invoked to produce another token.\n'
        + ' *                 `this` refers to the Lexer object.\n'
        + ' *      post_lex: function(token) { return token; }\n'
        + ' *                 optional: is invoked when the lexer has produced a token `token`;\n'
        + ' *                 this function can override the returned token value by returning another.\n'
        + ' *                 When it does not return any (truthy) value, the lexer will return\n'
        + ' *                 the original `token`.\n'
        + ' *                 `this` refers to the Lexer object.\n'
        + ' *\n'
        + ' * WARNING: the next set of options are not meant to be changed. They echo the abilities of\n'
        + ' * the lexer as per when it was compiled!\n'
        + ' *\n'
        + ' *      ranges: boolean\n'
        + ' *                 optional: `true` ==> token location info will include a .range[] member.\n'
        + ' *      flex: boolean\n'
        + ' *                 optional: `true` ==> flex-like lexing behaviour where the rules are tested\n'
        + ' *                 exhaustively to find the longest match.\n'
        + ' *      backtrack_lexer: boolean\n'
        + ' *                 optional: `true` ==> lexer regexes are tested in order and for invoked;\n'
        + ' *                 the lexer terminates the scan when a token is returned by the action code.\n'
        + ' *      xregexp: boolean\n'
        + ' *                 optional: `true` ==> lexer rule regexes are "extended regex format" requiring the\n'
        + ' *                 `XRegExp` library. When this %option has not been specified at compile time, all lexer\n'
        + ' *                 rule regexes have been written as standard JavaScript RegExp expressions.\n'
        + ' *  }\n'
        + ' */\n';

    return out;
}

function prepareOptions(opt) {
    opt = opt || {};

    // check for illegal identifier
    if (!opt.moduleName || !opt.moduleName.match(/^[a-zA-Z_$][a-zA-Z0-9_$\.]*$/)) {
        if (opt.moduleName) {
            var msg = 'WARNING: The specified moduleName "' + opt.moduleName + '" is illegal (only characters [a-zA-Z0-9_$] and "." dot are accepted); using the default moduleName "lexer" instead.';
            if (typeof opt.warn_cb === 'function') {
                opt.warn_cb(msg);
            } else {
                // do not treat as warning; barf hairball instead so that this oddity gets noticed right away!
                throw new Error(msg);
            }
        }
        opt.moduleName = 'lexer';
    }
    return opt;
}

function generateModule(opt) {
    opt = prepareOptions(opt);

    var out = [
        generateGenericHeaderComment(),
        '',
        'var ' + opt.moduleName + ' = (function () {',
        jisonLexerErrorDefinition,
        '',
        generateModuleBody(opt),
        '',
        (opt.moduleInclude ? opt.moduleInclude + ';' : ''),
        '',
        'return lexer;',
        '})();'
    ];

    return out.join('\n');
}

function generateAMDModule(opt) {
    opt = prepareOptions(opt);

    var out = [
        generateGenericHeaderComment(),
        '',
        'define([], function () {',
        jisonLexerErrorDefinition,
        '',
        generateModuleBody(opt),
        '',
        (opt.moduleInclude ? opt.moduleInclude + ';' : ''),
        '',
        'return lexer;',
        '});'
    ];

    return out.join('\n');
}

function generateESModule(opt) {
    opt = prepareOptions(opt);

    var out = [
        generateGenericHeaderComment(),
        '',
        'var lexer = (function () {',
        jisonLexerErrorDefinition,
        '',
        generateModuleBody(opt),
        '',
        (opt.moduleInclude ? opt.moduleInclude + ';' : ''),
        '',
        'return lexer;',
        '})();',
        '',
        'export {lexer};'
    ];

    return out.join('\n');
}

function generateCommonJSModule(opt) {
    opt = prepareOptions(opt);

    var out = [
        generateGenericHeaderComment(),
        '',
        'var ' + opt.moduleName + ' = (function () {',
        jisonLexerErrorDefinition,
        '',
        generateModuleBody(opt),
        '',
        (opt.moduleInclude ? opt.moduleInclude + ';' : ''),
        '',
        'return lexer;',
        '})();',
        '',
        'if (typeof require !== \'undefined\' && typeof exports !== \'undefined\') {',
        '  exports.lexer = ' + opt.moduleName + ';',
        '  exports.lex = function () {',
        '    return ' + opt.moduleName + '.lex.apply(lexer, arguments);',
        '  };',
        '}'
    ];

    return out.join('\n');
}

RegExpLexer.generate = generate;

RegExpLexer.defaultJisonLexOptions = defaultJisonLexOptions;
RegExpLexer.mkStdOptions = mkStdOptions;
RegExpLexer.camelCase = camelCase;
RegExpLexer.autodetectAndConvertToJSONformat = autodetectAndConvertToJSONformat;

module.exports = RegExpLexer;

