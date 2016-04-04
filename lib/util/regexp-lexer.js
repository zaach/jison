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

    function tokenNumberReplacement (str, token) {
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
            m = expandMacros(m, macros);
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

// expand macros within macros and cache the result
function prepareMacros(dict_macros, opts) {
    var macros = {};

    // Pretty brutal conversion of 'regex' in macro back to raw set: strip outer [...] when they're there;
    // ditto for inner combos of sets, i.e. `]|[` as in `[0-9]|[a-z]`.
    //
    // Of course this brutish approach is NOT SMART enough to cope with *negated* sets such as
    // `[^0-9]` in nested macros!
    function reduceRegexToSet(s, name) {
        // First make sure legal regexes such as `[-@]` or `[@-]` get their hyphens at the edges
        // properly escaped as they'll otherwise produce havoc when being combined into new
        // sets thanks to macro expansion inside the outer regex set expression.
        var m = s.split('\\\\'); // help us find out which chars in there are truly escaped
        for (var i = 0, len = m.length; i < len; i++) {
            s = ' ' + m[i]; // make our life easier when we check the next regex(es)...

            // Any unescaped '[' or ']' is the begin/end marker of a regex set, hence when 
            // such sets start/end with a '-' dash, it's a *literal* dash, and since we expect
            // to be merging regex sets, we MUST escape all literaL dashes like that.
            s = s.replace(/([^\\])\[-/g, '$1[\\-').replace(/-\]/g, '\\-]');

            // Catch the remains of constructs like `[0-9]|[a-z]`.
            s = s.replace(/([^\\])\]\|\[/g, '$1');

            // Strip unescaped pipes to catch constructs like `\\r|\\n` and turn them into
            // something ready for use inside a regex set, e.g. `\\r\\n`.
            // 
            // > Of course, we realize that converting more complex piped constructs this way
            // > will produce something you might not expect, e.g. `A|WORD2` -> `AWORD2` which
            // > would then end up as the set `[AWORD2]` which is something else than the input
            // > entirely.
            // > 
            // > However, we can only depend on the user (grammar writer) to realize this and 
            // > prevent this from happening by not creating such oddities in the input grammar. 
            s = s.replace(/([^\\])\|/g, '$1');

            m[i] = s.substr(1, s.length - 1);
        }
        s = m.join('\\\\');

        // Also remove the outer brackets if this thing is a set all by itself: we accept either
        // `[0-9]` or `0-9` as good macro content to land in a (larger) set and this should
        // take care of the `[]` brackets around the former.
        // 
        // Also strip off some other possible outer wrappers which we know how to remove.
        // We don't worry about 'damaging' the regex as any too-complex regex will be caught
        // in the validation check at the end; our 'strippers' here would not damage useful
        // regexes anyway and them damaging the unacceptable ones is fine.
        s = s.replace(/^\((?:\?:)?(.*?)\)$/, '$1');       // (?:...) -> ...  and  (...) -> ...
        s = s.replace(/^\[(.*?)\]$/, '$1');

        // Now ensure that any `-` dash at the start or end of the set list is properly escaped:
        // we won't have caught all of them yet above, just the ones in sub-sets!
        
        s = s.replace(/^-/, '\\-');
        s = s.replace(/-$/, '\\-');

        // When this result is suitable for use in a set, than we should be able to compile 
        // it in a regex; that way we can easily validate whether macro X is fit to be used 
        // inside a regex set:
        try {
            var re;
            re = new XRegExp('[' + s + ']');
            re.test(s[0]);

            // One thing is apparently *not* caught by the RegExp compile action above: `[a[b]c]`
            // so we check for lingering UNESCAPED brackets in here as those cannot be:
            if (/[^\\][\[\]]/.exec(s)) {
                throw 'unescaped brackets in set data';
            }
        } catch (ex) {
            // make sure we produce a set range expression which will fail badly when it is used
            // in actual code:
            s = '[macro \'' + name + '\' is unsuitable for use inside regex set expressions: "[' + s + ']"]'; 
        }

        return s;
    }

    // expand a macro which exists inside a `[...]` set:
    function expandMacroInSet(i) {
        var k, a, m;
        if (!macros[i]) {
            m = dict_macros[i];

            for (k in dict_macros) {
                if (dict_macros.hasOwnProperty(k) && i !== k) {
                    // it doesn't matter if the lexer recognized that the inner macro(s)
                    // were sitting inside a `[...]` set or not: the fact that they are used
                    // here in macro `i` which itself sits in a set, makes them *all* live in
                    // a set so all of them get the same treatment: set expansion style.
                    a = m.split('{[{' + k + '}]}');
                    if (a.length > 1) {
                        m = a.join(expandMacroInSet(k));
                    }
                    
                    // Note: make sure we don't try to expand any XRegExp `\p{...}` or `\P{...}`
                    // macros here:
                    if ((opts.xregexp || 1) && XRegExp.isUnicodeSlug(k)) {
                        // Work-around so that you can use `\p{ascii}` for an XRegExp slug
                        // while using `\p{ASCII}` as a *macro expansion* of the `ASCII`
                        // macro:
                        if (k.toUpperCase() !== k) {
                            throw 'Cannot use name "' + k + '" as a macro name as it clashes with the same XRegExp "\\p{..}" Unicode slug name. Use all-uppercase macro names, e.g. name your macro "' + k.toUpperCase() + '" to work around this issue or give your offending macro a different name.';
                        }
                    }

                    a = m.split('{' + k + '}');
                    if (a.length > 1) {
                        m = a.join(expandMacroInSet(k));
                    }
                }
            }

            m = reduceRegexToSet(m, i);

            macros[i] = {
                in_set: m,
                elsewhere: null,
                raw: dict_macros[i]
            };
        } else {
            m = macros[i].in_set;
        }

        return m;
    }

    function expandMacroElsewhere(i) {
        var k, a, m;

        if (!macros[i].elsewhere) {
            m = dict_macros[i];

            // the macro MAY contain other macros which MAY be inside a `[...]` set in this
            // macro, hence we first expand those submacros all the way:
            for (k in dict_macros) {
                if (dict_macros.hasOwnProperty(k) && i !== k) {
                    a = m.split('{[{' + k + '}]}');
                    if (a.length > 1) {
                        m = a.join(macros[k].in_set);
                    }
                    
                    a = m.split('{' + k + '}');
                    if (a.length > 1) {
                        m = a.join('(?:' + expandMacroElsewhere(k) + ')');
                    }
                }
            }

            macros[i].elsewhere = m;
        } else {
            m = macros[i].elsewhere;
        }

        return m;
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
function expandMacros(src, macros) {
    var i, m;

    // first process *all* the macros inside [...] set expressions:
    if (src.indexOf('{[{') >= 0) {
        for (i in macros) {
            if (macros.hasOwnProperty(i)) {
                m = macros[i];

                src = src.split('{[{' + i + '}]}').join(m.in_set);
            }
        }
    }

    // then process the remaining macro occurrences in the regex:
    // every macro used in a lexer rule will become its own capture group. 
    // Meanwhile the cached expansion will have expanded any submacros into
    // *NON*-capturing groups so that the backreference indexes remain as you'ld
    // expect and using macros doesn't require you to know exactly what your
    // used macro will expand into, i.e. which and how many submacros it has.
    // 
    // This is a BREAKING CHANGE from vanilla jison 0.4.15! 
    if (src.indexOf('{') >= 0) {
        for (i in macros) {
            if (macros.hasOwnProperty(i)) {
                m = macros[i];

                src = src.split('{' + i + '}').join('(' + m.elsewhere + ')');
            }
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
            var testcode = '' +
                '// provide a local version for test purposes:\n' +
                jisonLexerErrorDefinition.join('\n') + '\n' +
                'function XRegExp(re, f) {\n' +
                '  this.re = re;\n' +
                '  this.flags = f;\n' +
                '}\n' +
                source + '\n' +
                'return lexer;\n';
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

    return lexer;
}

RegExpLexer.prototype = {
    EOF: 1,
    ERROR: 2,

    // JisonLexerError: JisonLexerError,

    parseError: function parseError(str, hash) {
        if (this.yy.parser && typeof this.yy.parser.parseError === 'function') {
            return this.yy.parser.parseError(str, hash) || this.ERROR;
        } else {
            throw new this.JisonLexerError(str);
        }
    },
    
    // resets the lexer, sets new input
    setInput: function (input, yy) {
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
    input: function () {
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
    unput: function (ch) {
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
    more: function () {
        this._more = true;
        return this;
    },

    // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
    reject: function () {
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
    less: function (n) {
        this.unput(this.match.slice(n));
    },

    // return (part of the) already matched input, i.e. for error messages
    pastInput: function(maxSize) {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = past.length;
        else if (!maxSize)
            maxSize = 20;
        return (past.length > maxSize ? '...' + past.substr(-maxSize) : past);
    },

    // return (part of the) upcoming input, i.e. for error messages
    upcomingInput: function(maxSize) {
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
    showPosition: function () {
        var pre = this.pastInput().replace(/\s/g, ' ');
        var c = new Array(pre.length + 1).join('-');
        return pre + this.upcomingInput().replace(/\s/g, ' ') + '\n' + c + '^';
    },

    // test the lexed token: return FALSE when not a match, otherwise return token
    test_match: function(match, indexed_rule) {
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
    next: function () {
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
    lex: function lex () {
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
    begin: function begin (condition) {
        this.conditionStack.push(condition);
    },

    // pop the previously active lexer condition state off the condition stack
    popState: function popState () {
        var n = this.conditionStack.length - 1;
        if (n > 0) {
            return this.conditionStack.pop();
        } else {
            return this.conditionStack[0];
        }
    },

    // produce the lexer rule set which is active for the currently active lexer condition state
    _currentRules: function _currentRules () {
        if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
            return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
        } else {
            return this.conditions['INITIAL'].rules;
        }
    },

    // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
    topState: function topState (n) {
        n = this.conditionStack.length - 1 - Math.abs(n || 0);
        if (n >= 0) {
            return this.conditionStack[n];
        } else {
            return 'INITIAL';
        }
    },

    // alias for begin(condition)
    pushState: function pushState (condition) {
        this.begin(condition);
    },

    // return the number of states currently on the stack
    stateStackSize: function stateStackSize() {
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

