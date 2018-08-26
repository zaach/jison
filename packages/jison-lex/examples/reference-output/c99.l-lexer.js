
            
var lexer = {
/*JISON-LEX-ANALYTICS-REPORT*/EOF: 1,
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
    _clear_state: 0,                            /// INTERNAL USE ONLY; 0: clear to do, 1: clear done for lex()/next(); -1: clear done for inut()/unput()/...

    conditionStack: [],                         /// INTERNAL USE ONLY; managed via `pushState()`, `popState()`, `topState()` and `stateStackSize()`

    match: '',                                  /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction. `match` is identical to `yytext` except that this one still contains the matched input string after `lexer.performAction()` has been invoked, where userland code MAY have changed/replaced the `yytext` value entirely!
    matched: '',                                /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks entire input which has been matched so far
    matches: false,                             /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks RE match result for last (successful) match attempt
    yytext: '',                                 /// ADVANCED USE ONLY: tracks input which has been matched so far for the lexer token under construction; this value is transferred to the parser as the 'token value' when the parser consumes the lexer token produced through a call to the `lex()` API.
    offset: 0,                                  /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks the 'cursor position' in the input string, i.e. the number of characters matched so far. (**WARNING:** this value MAY be negative if you `unput()` more text than you have already lexed. This type of behaviour is generally observed for one kind of 'lexer/parser hack' where custom token-illiciting characters are pushed in front of the input stream to help simulate multiple-START-points in the parser. When this happens, `base_position` will be adjusted to help track the original input's starting point in the `_input` buffer.)
    base_position: 0,                           /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: index to the original starting point of the input; always ZERO(0) unless `unput()` has pushed content before the input: see the `offset` **WARNING** just above.
    yyleng: 0,                                  /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: length of matched input for the token under construction (`yytext`)
    yylineno: 0,                                /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: 'line number' at which the token under construction is located
    yylloc: null,                               /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: tracks location info (lines + columns) for the token under construction
    CRLF_Re: /\r\n?|\n/,                        /// READ-ONLY EXTERNAL ACCESS - ADVANCED USE ONLY: regex used to split lines while tracking the lexer cursor position.

    /**
     * INTERNAL USE: construct a suitable error info hash object instance for `parseError`.
     *
     * @public
     * @this {RegExpLexer}
     */
    constructLexErrorInfo: function lexer_constructLexErrorInfo(msg, recoverable, show_input_position) {
        "use strict";
    
        msg = '' + msg;

        // heuristic to determine if the error message already contains a (partial) source code dump
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
                "use strict";
                var rec = !!this.recoverable;
                for (var key in this) {
                    if (this[key] && this.hasOwnProperty(key) && typeof this[key] === 'object') {
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
        "use strict";

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
        "use strict";

        var lineno_msg = '';
        if (this.yylloc) {
            lineno_msg = ' on line ' + (this.yylineno + 1);
        }
        var p = this.constructLexErrorInfo('Lexical error' + lineno_msg + ': ' + str, this.options.lexerErrorsAreRecoverable);

        // Add any extra args to the hash under the name `extra_error_attributes`:
        var args = Array.prototype.slice.call(arguments, 1);
        if (args.length) {
            p.extra_error_attributes = args;
        }

        return (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
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
        "use strict";

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
        "use strict";

        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        // - DO NOT reset `this.matched`
        this.matches = false;

        this._more = false;
        this._backtrack = false;

        var col = this.yylloc.last_column;
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
        "use strict";

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

        if (input && typeof input !== 'string') {
            input = '' + input;
        }
        this._input = input || '';
        this._clear_state = -1;
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
        // apply these bits of `this.clear()` as well:
        this.yytext = '';
        this.yyleng = 0;
        this.match = '';
        this.matches = false;

        this._more = false;
        this._backtrack = false;

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
        "use strict";

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
        "use strict";

        if (!this._input) {
            //this.done = true;    -- don't set `done` as we want the lex()/next() API to be able to produce one custom EOF token match after this anyhow. (lexer can match special <<EOF>> tokens and perform user action code for a <<EOF>> match, but only does so *once*)
            return null;
        }
        if (!this._clear_state && !this._more) {
            this._clear_state = -1;
            this.clear();
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
        "use strict";

        var len = ch.length;
        var lines = ch.split(this.CRLF_Re);

        if (!this._clear_state && !this._more) {
            this._clear_state = -1;
            this.clear();
        }

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length - len);
        this.yyleng = this.yytext.length;
        this.offset -= len;
        // **WARNING:**
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

            this.yylloc.last_line = this.yylineno + 1;

            // Get last entirely matched line into the `pre_lines[]` array's
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
        "use strict";

        return this._input || '';
    },

    /**
     * cache matched text and append it on next action
     *
     * @public
     * @this {RegExpLexer}
     */
    more: function lexer_more() {
        "use strict";

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
        "use strict";

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
            this._signaled_error_token = (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
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
        "use strict";

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
        "use strict";

        var past = this.matched.substring(0, this.matched.length - this.match.length);
        if (maxSize < 0)
            maxSize = Infinity;
        else if (!maxSize)
            maxSize = 20;
        if (maxLines < 0)
            maxLines = Infinity;         // can't ever have more input lines than this!
        else if (!maxLines)
            maxLines = 1;
        // `substr` anticipation: treat \r\n as a single character and take a little
        // more than necessary so that we can still properly check against maxSize
        // after we've transformed and limited the newLines in here:
        past = past.substr(-maxSize * 2 - 2);
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = past.split(this.CRLF_Re);
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
        "use strict";

        var next = this.match;
        var source = this._input || '';
        if (maxSize < 0)
            maxSize = next.length + source.length;
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
            next += source.substring(0, maxSize * 2 + 2 - next.length);  // substring is faster on Chrome/V8
        }
        // now that we have a significantly reduced string to process, transform the newlines
        // and chop them, then limit them:
        var a = next.split(this.CRLF_Re, maxLines + 1);     // stop splitting once we have reached just beyond the reuired number of lines.
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
        "use strict";

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
        "use strict";

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
            }

            // plan C?: see if the 'current' location is useful/sane too:
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
        }
        // sanitize: fix last_line BEFORE we fix first_line as we use the 'raw' value of the latter
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
            loc.last_column = (loc.first_column > 0 ? loc.first_column : 80);
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
        "use strict";

        loc = this.deriveLocationInfo(loc, context_loc, context_loc2);

        const CONTEXT = 3;
        const CONTEXT_TAIL = 1;
        const MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT = 2;
        var input = this.matched + (this._input || '');
        var lines = input.split('\n');
        var l0 = Math.max(1, (context_loc ? context_loc.first_line : loc.first_line - CONTEXT));
        var l1 = Math.max(1, (context_loc2 ? context_loc2.last_line : loc.last_line + CONTEXT_TAIL));
        var lineno_display_width = (1 + Math.log10(l1 | 1) | 0);
        var ws_prefix = new Array(lineno_display_width).join(' ');
        var nonempty_line_indexes = [[], [], []];
        var rv = lines.slice(l0 - 1, l1 + 1).map(function injectLineNumber(line, index) {
            "use strict";

            var lno = index + l0;
            var lno_pfx = (ws_prefix + lno).substr(-lineno_display_width);
            var rv = lno_pfx + ': ' + line;
            var errpfx = (new Array(lineno_display_width + 1)).join('^');
            var offset = 2 + 1;
            var len = 0;

            if (lno === loc.first_line) {
              offset += loc.first_column;

              len = Math.max(
                2,
                ((lno === loc.last_line ? loc.last_column : line.length)) - loc.first_column + 1
              );
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
        });

        // now make sure we don't print an overly large amount of lead/error/tail area: limit it
        // to the top and bottom line count:
        for (var i = 0; i <= 2; i++) {
            var line_arr = nonempty_line_indexes[i];
            if (line_arr.length > 2 * MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT) {
                var clip_start = line_arr[MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT - 1] + 1;
                var clip_end = line_arr[line_arr.length - MINIMUM_VISIBLE_NONEMPTY_LINE_COUNT] - 1;

                var intermediate_line = (new Array(lineno_display_width + 1)).join(' ') +     '  (...continued...)';
                if (i === 1) {
                    intermediate_line += '\n' + (new Array(lineno_display_width + 1)).join('-') + '  (---------------)';
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
        "use strict";

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
        "use strict";

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

        lines = match_str.split(this.CRLF_Re);
        if (lines.length > 1) {
            this.yylineno += lines.length - 1;

            this.yylloc.last_line = this.yylineno + 1;
            this.yylloc.last_column = lines[lines.length - 1].length;
        } else {
            this.yylloc.last_column += match_str_len;
        }

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
        token = this.performAction.call(this, this.yy, indexed_rule, this.conditionStack[this.conditionStack.length - 1] /* = YY_START */);
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
        "use strict";

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
            if (!this._clear_state) {
                this._clear_state = 1;
            }
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
                if (this.yylloc) {
                    lineno_msg = ' on line ' + (this.yylineno + 1);
                }
                var p = this.constructLexErrorInfo('Internal lexer engine error' + lineno_msg + ': The lex grammar programmer pushed a non-existing condition name "' + this.topState() + '"; this is a fatal error and should be reported to the application programmer team!', false);
                // produce one 'error' token until this situation has been resolved, most probably by parse termination!
                return (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
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
            if (this.yylloc) {
                lineno_msg = ' on line ' + (this.yylineno + 1);
            }
            var p = this.constructLexErrorInfo('Lexical error' + lineno_msg + ': Unrecognized text.', this.options.lexerErrorsAreRecoverable);

            var pendingInput = this._input;
            var activeCondition = this.topState();
            var conditionStackDepth = this.conditionStack.length;

            token = (this.parseError(p.errStr, p, this.JisonLexerError) || this.ERROR);
            if (token === this.ERROR) {
                // we can try to recover from a lexer error that `parseError()` did not 'recover' for us
                // by moving forward at least one character at a time IFF the (user-specified?) `parseError()`
                // has not consumed/modified any pending input or changed state in the error handler:
                if (!this.matches &&
                    // and make sure the input has been modified/consumed ...
                    pendingInput === this._input &&
                    // ...or the lexer state has been modified significantly enough
                    // to merit a non-consuming error handling action right now.
                    activeCondition === this.topState() &&
                    conditionStackDepth === this.conditionStack.length
                ) {
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
        "use strict";

        var r;

        //this._clear_state = 0;

        // allow the PRE/POST handlers set/modify the return token for maximum flexibility of the generated lexer:
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

        // 1) make sure any outside interference is detected ASAP: 
        //    these attributes are to be treated as 'const' values
        //    once the lexer has produced them with the token (return value `r`).
        // 2) make sure any subsequent `lex()` API invocation CANNOT
        //    edit the `yytext`, etc. token attributes for the *current*
        //    token, i.e. provide a degree of 'closure safety' so that
        //    code like this:
        //    
        //        t1 = lexer.lex();
        //        v = lexer.yytext;
        //        l = lexer.yylloc;
        //        t2 = lexer.lex();
        //        assert(lexer.yytext !== v);
        //        assert(lexer.yylloc !== l);
        //        
        //    succeeds. Older (pre-v0.6.5) jison versions did not *guarantee*
        //    these conditions.
        this.yytext = Object.freeze(this.yytext);
        this.matches = Object.freeze(this.matches);
        this.yylloc.range = Object.freeze(this.yylloc.range);
        this.yylloc = Object.freeze(this.yylloc);

        this._clear_state = 0;

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
        "use strict";

        var r;

        //this._clear_state = 0;

        while (!r) {
            r = this.next();
        }

        // 1) make sure any outside interference is detected ASAP: 
        //    these attributes are to be treated as 'const' values
        //    once the lexer has produced them with the token (return value `r`).
        // 2) make sure any subsequent `lex()` API invocation CANNOT
        //    edit the `yytext`, etc. token attributes for the *current*
        //    token, i.e. provide a degree of 'closure safety' so that
        //    code like this:
        //    
        //        t1 = lexer.lex();
        //        v = lexer.yytext;
        //        l = lexer.yylloc;
        //        t2 = lexer.lex();
        //        assert(lexer.yytext !== v);
        //        assert(lexer.yylloc !== l);
        //        
        //    succeeds. Older (pre-v0.6.5) jison versions did not *guarantee*
        //    these conditions.
        this.yytext = Object.freeze(this.yytext);
        this.matches = Object.freeze(this.matches);
        this.yylloc.range = Object.freeze(this.yylloc.range);
        this.yylloc = Object.freeze(this.yylloc);

        this._clear_state = 0;

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
        "use strict";

        var rv = {
            fastLex: !(
                typeof this.pre_lex === 'function' ||
                typeof this.options.pre_lex === 'function' ||
                (this.yy && typeof this.yy.pre_lex === 'function') ||
                (this.yy && typeof this.yy.post_lex === 'function') ||
                typeof this.options.post_lex === 'function' ||
                typeof this.post_lex === 'function'
            ) && typeof this.fastLex === 'function',
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
        "use strict";

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
        "use strict";

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
        "use strict";

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
        "use strict";

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
        "use strict";

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
        "use strict";

        return this.conditionStack.length;
    },
    options: {
  trackPosition: true,
  easy_keyword_rules: true
},
    JisonLexerError: JisonLexerError,
    performAction: function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            
var YYSTATE = YY_START;
switch(yyrulenumber) {
case 0 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \/\* */ 
 comment() 
break;
case 1 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \/\/.* */ 
 /* consume //-comment */ 
break;
case 47 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {L}{A}* */ 
 // return check_type(); 

                          switch (sym_type(yy_.yytext)) {
                          case TYPEDEF_NAME:                /* previously defined */
                            return 'TYPEDEF_NAME';

                          case ENUMERATION_CONSTANT:        /* previously defined */
                            return 'ENUMERATION_CONSTANT';

                          default:                          /* includes undefined */
                            return 'IDENTIFIER';
                          } 
break;
case 105 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {WS}+ */ 
 /* whitespace separates tokens */ 
break;
case 106 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       . */ 
 /* discard bad characters */ 
break;
default:
  return this.simpleCaseActionClusters[yyrulenumber];
}
        },
    simpleCaseActionClusters: {

  /*! Conditions:: INITIAL */ 
  /*! Rule::       auto\b */ 
   2 : 'AUTO',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       break\b */ 
   3 : 'BREAK',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       case\b */ 
   4 : 'CASE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       char\b */ 
   5 : 'CHAR',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       const\b */ 
   6 : 'CONST',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       continue\b */ 
   7 : 'CONTINUE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       default\b */ 
   8 : 'DEFAULT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       do\b */ 
   9 : 'DO',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       double\b */ 
   10 : 'DOUBLE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       else\b */ 
   11 : 'ELSE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       enum\b */ 
   12 : 'ENUM',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       extern\b */ 
   13 : 'EXTERN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       float\b */ 
   14 : 'FLOAT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       for\b */ 
   15 : 'FOR',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       goto\b */ 
   16 : 'GOTO',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       if\b */ 
   17 : 'IF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       inline\b */ 
   18 : 'INLINE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       int\b */ 
   19 : 'INT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       long\b */ 
   20 : 'LONG',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       register\b */ 
   21 : 'REGISTER',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       restrict\b */ 
   22 : 'RESTRICT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       return\b */ 
   23 : 'RETURN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       short\b */ 
   24 : 'SHORT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       signed\b */ 
   25 : 'SIGNED',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       sizeof\b */ 
   26 : 'SIZEOF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       static\b */ 
   27 : 'STATIC',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       struct\b */ 
   28 : 'STRUCT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       switch\b */ 
   29 : 'SWITCH',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       typedef\b */ 
   30 : 'TYPEDEF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       union\b */ 
   31 : 'UNION',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       unsigned\b */ 
   32 : 'UNSIGNED',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       void\b */ 
   33 : 'VOID',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       volatile\b */ 
   34 : 'VOLATILE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       while\b */ 
   35 : 'WHILE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Alignas\b */ 
   36 : 'ALIGNAS',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Alignof\b */ 
   37 : 'ALIGNOF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Atomic\b */ 
   38 : 'ATOMIC',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Bool\b */ 
   39 : 'BOOL',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Complex\b */ 
   40 : 'COMPLEX',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Generic\b */ 
   41 : 'GENERIC',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Imaginary\b */ 
   42 : 'IMAGINARY',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Noreturn\b */ 
   43 : 'NORETURN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Static_assert\b */ 
   44 : 'STATIC_ASSERT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Thread_local\b */ 
   45 : 'THREAD_LOCAL',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       __func__\b */ 
   46 : 'FUNC_NAME',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}+{IS}? */ 
   48 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {NZ}{D}*{IS}? */ 
   49 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       0{O}*{IS}? */ 
   50 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {CP}?'([^'\\\n]|{ES})+' */ 
   51 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {D}+{E}{FS}? */ 
   52 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {D}*\.{D}+{E}?{FS}? */ 
   53 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {D}+\.{E}?{FS}? */ 
   54 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}+{P}{FS}? */ 
   55 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}*\.{H}+{P}{FS}? */ 
   56 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}+\.{P}{FS}? */ 
   57 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ({SP}?"([^\"\\\n]|{ES})*"{WS}*)+ */ 
   58 : 'STRING_LITERAL',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \.\.\. */ 
   59 : 'ELLIPSIS',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       >>= */ 
   60 : 'RIGHT_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       <<= */ 
   61 : 'LEFT_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \+= */ 
   62 : 'ADD_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       -= */ 
   63 : 'SUB_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \*= */ 
   64 : 'MUL_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \/= */ 
   65 : 'DIV_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       %= */ 
   66 : 'MOD_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       &= */ 
   67 : 'AND_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \^= */ 
   68 : 'XOR_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \|= */ 
   69 : 'OR_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       >> */ 
   70 : 'RIGHT_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       << */ 
   71 : 'LEFT_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \+\+ */ 
   72 : 'INC_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       -- */ 
   73 : 'DEC_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       -> */ 
   74 : 'PTR_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       && */ 
   75 : 'AND_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \|\| */ 
   76 : 'OR_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       <= */ 
   77 : 'LE_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       >= */ 
   78 : 'GE_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       == */ 
   79 : 'EQ_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       != */ 
   80 : 'NE_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ; */ 
   81 : ';',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\{|<%) */ 
   82 : '{',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\}|%>) */ 
   83 : '}',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       , */ 
   84 : ',',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       : */ 
   85 : ':',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       = */ 
   86 : '=',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \( */ 
   87 : '(',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \) */ 
   88 : ')',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\[|<:) */ 
   89 : '[',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\]|:>) */ 
   90 : ']',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \. */ 
   91 : '.',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       & */ 
   92 : '&',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ! */ 
   93 : '!',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ~ */ 
   94 : '~',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       - */ 
   95 : '-',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \+ */ 
   96 : '+',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \* */ 
   97 : '*',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \/ */ 
   98 : '/',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       % */ 
   99 : '%',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       < */ 
   100 : '<',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       > */ 
   101 : '>',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \^ */ 
   102 : '^',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \| */ 
   103 : '|',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \? */ 
   104 : '?'
},
    rules: [
        /*   0: */  /^(?:\/\*)/,
/*   1: */  /^(?:\/\/.*)/,
/*   2: */  /^(?:auto\b)/,
/*   3: */  /^(?:break\b)/,
/*   4: */  /^(?:case\b)/,
/*   5: */  /^(?:char\b)/,
/*   6: */  /^(?:const\b)/,
/*   7: */  /^(?:continue\b)/,
/*   8: */  /^(?:default\b)/,
/*   9: */  /^(?:do\b)/,
/*  10: */  /^(?:double\b)/,
/*  11: */  /^(?:else\b)/,
/*  12: */  /^(?:enum\b)/,
/*  13: */  /^(?:extern\b)/,
/*  14: */  /^(?:float\b)/,
/*  15: */  /^(?:for\b)/,
/*  16: */  /^(?:goto\b)/,
/*  17: */  /^(?:if\b)/,
/*  18: */  /^(?:inline\b)/,
/*  19: */  /^(?:int\b)/,
/*  20: */  /^(?:long\b)/,
/*  21: */  /^(?:register\b)/,
/*  22: */  /^(?:restrict\b)/,
/*  23: */  /^(?:return\b)/,
/*  24: */  /^(?:short\b)/,
/*  25: */  /^(?:signed\b)/,
/*  26: */  /^(?:sizeof\b)/,
/*  27: */  /^(?:static\b)/,
/*  28: */  /^(?:struct\b)/,
/*  29: */  /^(?:switch\b)/,
/*  30: */  /^(?:typedef\b)/,
/*  31: */  /^(?:union\b)/,
/*  32: */  /^(?:unsigned\b)/,
/*  33: */  /^(?:void\b)/,
/*  34: */  /^(?:volatile\b)/,
/*  35: */  /^(?:while\b)/,
/*  36: */  /^(?:_Alignas\b)/,
/*  37: */  /^(?:_Alignof\b)/,
/*  38: */  /^(?:_Atomic\b)/,
/*  39: */  /^(?:_Bool\b)/,
/*  40: */  /^(?:_Complex\b)/,
/*  41: */  /^(?:_Generic\b)/,
/*  42: */  /^(?:_Imaginary\b)/,
/*  43: */  /^(?:_Noreturn\b)/,
/*  44: */  /^(?:_Static_assert\b)/,
/*  45: */  /^(?:_Thread_local\b)/,
/*  46: */  /^(?:__func__\b)/,
/*  47: */  /^(?:([^\W\d])(\w)*)/,
/*  48: */  /^(?:((0[Xx]))([\dA-Fa-f])+((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)/,
/*  49: */  /^(?:([1-9])(\d)*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)/,
/*  50: */  /^(?:0([0-7])*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)/,
/*  51: */  /^(?:((u|U|L))?'([^\n'\\]|((\\(["'?\\abfnrtv]|[0-7]{1,3}|x[\dA-Fa-f]+))))+')/,
/*  52: */  /^(?:(\d)+(([Ee][+-]?(?:\d)+))((f|F|l|L))?)/,
/*  53: */  /^(?:(\d)*\.(\d)+(([Ee][+-]?(?:\d)+))?((f|F|l|L))?)/,
/*  54: */  /^(?:(\d)+\.(([Ee][+-]?(?:\d)+))?((f|F|l|L))?)/,
/*  55: */  /^(?:((0[Xx]))([\dA-Fa-f])+(([Pp][+-]?(?:\d)+))((f|F|l|L))?)/,
/*  56: */  /^(?:((0[Xx]))([\dA-Fa-f])*\.([\dA-Fa-f])+(([Pp][+-]?(?:\d)+))((f|F|l|L))?)/,
/*  57: */  /^(?:((0[Xx]))([\dA-Fa-f])+\.(([Pp][+-]?(?:\d)+))((f|F|l|L))?)/,
/*  58: */  /^(?:(((u8|u|U|L))?"([^\n"\\]|((\\(["'?\\abfnrtv]|[0-7]{1,3}|x[\dA-Fa-f]+))))*"([\t-\f ])*)+)/,
/*  59: */  /^(?:\.\.\.)/,
/*  60: */  /^(?:>>=)/,
/*  61: */  /^(?:<<=)/,
/*  62: */  /^(?:\+=)/,
/*  63: */  /^(?:-=)/,
/*  64: */  /^(?:\*=)/,
/*  65: */  /^(?:\/=)/,
/*  66: */  /^(?:%=)/,
/*  67: */  /^(?:&=)/,
/*  68: */  /^(?:\^=)/,
/*  69: */  /^(?:\|=)/,
/*  70: */  /^(?:>>)/,
/*  71: */  /^(?:<<)/,
/*  72: */  /^(?:\+\+)/,
/*  73: */  /^(?:--)/,
/*  74: */  /^(?:->)/,
/*  75: */  /^(?:&&)/,
/*  76: */  /^(?:\|\|)/,
/*  77: */  /^(?:<=)/,
/*  78: */  /^(?:>=)/,
/*  79: */  /^(?:==)/,
/*  80: */  /^(?:!=)/,
/*  81: */  /^(?:;)/,
/*  82: */  /^(?:(\{|<%))/,
/*  83: */  /^(?:(\}|%>))/,
/*  84: */  /^(?:,)/,
/*  85: */  /^(?::)/,
/*  86: */  /^(?:=)/,
/*  87: */  /^(?:\()/,
/*  88: */  /^(?:\))/,
/*  89: */  /^(?:(\[|<:))/,
/*  90: */  /^(?:(\]|:>))/,
/*  91: */  /^(?:\.)/,
/*  92: */  /^(?:&)/,
/*  93: */  /^(?:!)/,
/*  94: */  /^(?:~)/,
/*  95: */  /^(?:-)/,
/*  96: */  /^(?:\+)/,
/*  97: */  /^(?:\*)/,
/*  98: */  /^(?:\/)/,
/*  99: */  /^(?:%)/,
/* 100: */  /^(?:<)/,
/* 101: */  /^(?:>)/,
/* 102: */  /^(?:\^)/,
/* 103: */  /^(?:\|)/,
/* 104: */  /^(?:\?)/,
/* 105: */  /^(?:([\t-\f ])+)/,
/* 106: */  /^(?:.)/
    ],
    conditions: {
  "INITIAL": {
    rules: [
      0,
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
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
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
      79,
      80,
      81,
      82,
      83,
      84,
      85,
      86,
      87,
      88,
      89,
      90,
      91,
      92,
      93,
      94,
      95,
      96,
      97,
      98,
      99,
      100,
      101,
      102,
      103,
      104,
      105,
      106
    ],
    inclusive: true
  }
}
};
;

            //=============================================================================
            //                     JISON-LEX OPTIONS:

            {
  lexerActionsUseYYLENG: '???',
  lexerActionsUseYYLINENO: '???',
  lexerActionsUseYYTEXT: '???',
  lexerActionsUseYYLOC: '???',
  lexerActionsUseParseError: '???',
  lexerActionsUseYYERROR: '???',
  lexerActionsUseLocationTracking: '???',
  lexerActionsUseMore: '???',
  lexerActionsUseUnput: '???',
  lexerActionsUseReject: '???',
  lexerActionsUseLess: '???',
  lexerActionsUseDisplayAPIs: '???',
  lexerActionsUseDescribeYYLOC: '???',
  lex_rule_dictionary: {
    rules: [
      [
        '\\/\\*',
        'comment()',
      ],
      [
        '\\/\\/.*',
        '/* consume //-comment */',
      ],
      [
        'auto\\b',
        "return 'AUTO'",
      ],
      [
        'break\\b',
        "return 'BREAK'",
      ],
      [
        'case\\b',
        "return 'CASE'",
      ],
      [
        'char\\b',
        "return 'CHAR'",
      ],
      [
        'const\\b',
        "return 'CONST'",
      ],
      [
        'continue\\b',
        "return 'CONTINUE'",
      ],
      [
        'default\\b',
        "return 'DEFAULT'",
      ],
      [
        'do\\b',
        "return 'DO'",
      ],
      [
        'double\\b',
        "return 'DOUBLE'",
      ],
      [
        'else\\b',
        "return 'ELSE'",
      ],
      [
        'enum\\b',
        "return 'ENUM'",
      ],
      [
        'extern\\b',
        "return 'EXTERN'",
      ],
      [
        'float\\b',
        "return 'FLOAT'",
      ],
      [
        'for\\b',
        "return 'FOR'",
      ],
      [
        'goto\\b',
        "return 'GOTO'",
      ],
      [
        'if\\b',
        "return 'IF'",
      ],
      [
        'inline\\b',
        "return 'INLINE'",
      ],
      [
        'int\\b',
        "return 'INT'",
      ],
      [
        'long\\b',
        "return 'LONG'",
      ],
      [
        'register\\b',
        "return 'REGISTER'",
      ],
      [
        'restrict\\b',
        "return 'RESTRICT'",
      ],
      [
        'return\\b',
        "return 'RETURN'",
      ],
      [
        'short\\b',
        "return 'SHORT'",
      ],
      [
        'signed\\b',
        "return 'SIGNED'",
      ],
      [
        'sizeof\\b',
        "return 'SIZEOF'",
      ],
      [
        'static\\b',
        "return 'STATIC'",
      ],
      [
        'struct\\b',
        "return 'STRUCT'",
      ],
      [
        'switch\\b',
        "return 'SWITCH'",
      ],
      [
        'typedef\\b',
        "return 'TYPEDEF'",
      ],
      [
        'union\\b',
        "return 'UNION'",
      ],
      [
        'unsigned\\b',
        "return 'UNSIGNED'",
      ],
      [
        'void\\b',
        "return 'VOID'",
      ],
      [
        'volatile\\b',
        "return 'VOLATILE'",
      ],
      [
        'while\\b',
        "return 'WHILE'",
      ],
      [
        '_Alignas\\b',
        "return 'ALIGNAS'",
      ],
      [
        '_Alignof\\b',
        "return 'ALIGNOF'",
      ],
      [
        '_Atomic\\b',
        "return 'ATOMIC'",
      ],
      [
        '_Bool\\b',
        "return 'BOOL'",
      ],
      [
        '_Complex\\b',
        "return 'COMPLEX'",
      ],
      [
        '_Generic\\b',
        "return 'GENERIC'",
      ],
      [
        '_Imaginary\\b',
        "return 'IMAGINARY'",
      ],
      [
        '_Noreturn\\b',
        "return 'NORETURN'",
      ],
      [
        '_Static_assert\\b',
        "return 'STATIC_ASSERT'",
      ],
      [
        '_Thread_local\\b',
        "return 'THREAD_LOCAL'",
      ],
      [
        '__func__\\b',
        "return 'FUNC_NAME'",
      ],
      [
        '{L}{A}*',
        `// return check_type(); 

                          switch (sym_type(yytext)) {
                          case TYPEDEF_NAME:                /* previously defined */
                            return 'TYPEDEF_NAME';

                          case ENUMERATION_CONSTANT:        /* previously defined */
                            return 'ENUMERATION_CONSTANT';

                          default:                          /* includes undefined */
                            return 'IDENTIFIER';
                          }`,
      ],
      [
        '{HP}{H}+{IS}?',
        "return 'I_CONSTANT'",
      ],
      [
        '{NZ}{D}*{IS}?',
        "return 'I_CONSTANT'",
      ],
      [
        '0{O}*{IS}?',
        "return 'I_CONSTANT'",
      ],
      [
        `{CP}?'([^'\\\\\\n]|{ES})+'`,
        "return 'I_CONSTANT'",
      ],
      [
        '{D}+{E}{FS}?',
        "return 'F_CONSTANT'",
      ],
      [
        '{D}*\\.{D}+{E}?{FS}?',
        "return 'F_CONSTANT'",
      ],
      [
        '{D}+\\.{E}?{FS}?',
        "return 'F_CONSTANT'",
      ],
      [
        '{HP}{H}+{P}{FS}?',
        "return 'F_CONSTANT'",
      ],
      [
        '{HP}{H}*\\.{H}+{P}{FS}?',
        "return 'F_CONSTANT'",
      ],
      [
        '{HP}{H}+\\.{P}{FS}?',
        "return 'F_CONSTANT'",
      ],
      [
        `({SP}?"([^\\"\\\\\\n]|{ES})*"{WS}*)+`,
        "return 'STRING_LITERAL'",
      ],
      [
        '\\.\\.\\.',
        "return 'ELLIPSIS'",
      ],
      [
        '>>=',
        "return 'RIGHT_ASSIGN'",
      ],
      [
        '<<=',
        "return 'LEFT_ASSIGN'",
      ],
      [
        '\\+=',
        "return 'ADD_ASSIGN'",
      ],
      [
        '-=',
        "return 'SUB_ASSIGN'",
      ],
      [
        '\\*=',
        "return 'MUL_ASSIGN'",
      ],
      [
        '\\/=',
        "return 'DIV_ASSIGN'",
      ],
      [
        '%=',
        "return 'MOD_ASSIGN'",
      ],
      [
        '&=',
        "return 'AND_ASSIGN'",
      ],
      [
        '\\^=',
        "return 'XOR_ASSIGN'",
      ],
      [
        '\\|=',
        "return 'OR_ASSIGN'",
      ],
      [
        '>>',
        "return 'RIGHT_OP'",
      ],
      [
        '<<',
        "return 'LEFT_OP'",
      ],
      [
        '\\+\\+',
        "return 'INC_OP'",
      ],
      [
        '--',
        "return 'DEC_OP'",
      ],
      [
        '->',
        "return 'PTR_OP'",
      ],
      [
        '&&',
        "return 'AND_OP'",
      ],
      [
        '\\|\\|',
        "return 'OR_OP'",
      ],
      [
        '<=',
        "return 'LE_OP'",
      ],
      [
        '>=',
        "return 'GE_OP'",
      ],
      [
        '==',
        "return 'EQ_OP'",
      ],
      [
        '!=',
        "return 'NE_OP'",
      ],
      [
        ';',
        "return ';'",
      ],
      [
        '(\\{|<%)',
        "return '{'",
      ],
      [
        '(\\}|%>)',
        "return '}'",
      ],
      [
        ',',
        "return ','",
      ],
      [
        ':',
        "return ':'",
      ],
      [
        '=',
        "return '='",
      ],
      [
        '\\(',
        "return '('",
      ],
      [
        '\\)',
        "return ')'",
      ],
      [
        '(\\[|<:)',
        "return '['",
      ],
      [
        '(\\]|:>)',
        "return ']'",
      ],
      [
        '\\.',
        "return '.'",
      ],
      [
        '&',
        "return '&'",
      ],
      [
        '!',
        "return '!'",
      ],
      [
        '~',
        "return '~'",
      ],
      [
        '-',
        "return '-'",
      ],
      [
        '\\+',
        "return '+'",
      ],
      [
        '\\*',
        "return '*'",
      ],
      [
        '\\/',
        "return '/'",
      ],
      [
        '%',
        "return '%'",
      ],
      [
        '<',
        "return '<'",
      ],
      [
        '>',
        "return '>'",
      ],
      [
        '\\^',
        "return '^'",
      ],
      [
        '\\|',
        "return '|'",
      ],
      [
        '\\?',
        "return '?'",
      ],
      [
        '{WS}+',
        '/* whitespace separates tokens */',
      ],
      [
        '.',
        '/* discard bad characters */',
      ],
    ],
    moduleInclude: `// 
// int yywrap(void)        /* called at end of input */
// {
//     return 1;           /* terminate now */
// }
// 
// static void comment(void)
// {
//     int c;
// 
//     while ((c = input()) != 0)
//         if (c == '*')
//         {
//             while ((c = input()) == '*')
//                 ;
// 
//             if (c == '/')
//                 return;
// 
//             if (c == 0)
//                 break;
//         }
//     yyerror("unterminated comment");
// }
// 
// static int check_type(void)
// {
//     switch (sym_type(yytext))
//     {
//     case TYPEDEF_NAME:                /* previously defined */
//         return TYPEDEF_NAME;
//     case ENUMERATION_CONSTANT:        /* previously defined */
//         return ENUMERATION_CONSTANT;
//     default:                          /* includes undefined */
//         return IDENTIFIER;
//     }
// }
// 
//`,
    macros: {
      O: '[0-7]',
      D: '[0-9]',
      NZ: '[1-9]',
      L: '[a-zA-Z_]',
      A: '[a-zA-Z_0-9]',
      H: '[a-fA-F0-9]',
      HP: '(0[xX])',
      E: '([Ee][+-]?{D}+)',
      P: '([Pp][+-]?{D}+)',
      FS: '(f|F|l|L)',
      IS: '(((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?))',
      CP: '(u|U|L)',
      SP: '(u8|u|U|L)',
      ES: '(\\\\([\'"\\?\\\\abfnrtv]|[0-7]{1,3}|x[a-fA-F0-9]+))',
      WS: '[ \\t\\v\\n\\f]',
    },
    startConditions: {},
    codeSections: [],
    importDecls: [],
    unknownDecls: [],
    options: {
      easy_keyword_rules: true,
    },
  },
  options: {
    moduleType: 'commonjs',
    debug: false,
    enableDebugLogs: false,
    json: true,
    dumpSourceCodeOnFailure: true,
    throwErrorOnCompileFailure: true,
    defaultModuleName: 'lexer',
    xregexp: false,
    lexerErrorsAreRecoverable: false,
    flex: false,
    backtrack_lexer: false,
    ranges: false,
    trackPosition: true,
    caseInsensitive: false,
    exportSourceCode: false,
    exportAST: false,
    prettyCfg: true,
    noMain: true,
    easy_keyword_rules: true,
  },
  moduleType: 'commonjs',
  conditions: {
    INITIAL: {
      rules: [
        0,
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
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
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
        79,
        80,
        81,
        82,
        83,
        84,
        85,
        86,
        87,
        88,
        89,
        90,
        91,
        92,
        93,
        94,
        95,
        96,
        97,
        98,
        99,
        100,
        101,
        102,
        103,
        104,
        105,
        106,
      ],
      inclusive: true,
    },
  },
  performAction: `function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            
var YYSTATE = YY_START;
switch(yyrulenumber) {
case 0 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \\/\\* */ 
 comment() 
break;
case 1 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       \\/\\/.* */ 
 /* consume //-comment */ 
break;
case 47 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {L}{A}* */ 
 // return check_type(); 

                          switch (sym_type(yy_.yytext)) {
                          case TYPEDEF_NAME:                /* previously defined */
                            return 'TYPEDEF_NAME';

                          case ENUMERATION_CONSTANT:        /* previously defined */
                            return 'ENUMERATION_CONSTANT';

                          default:                          /* includes undefined */
                            return 'IDENTIFIER';
                          } 
break;
case 105 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {WS}+ */ 
 /* whitespace separates tokens */ 
break;
case 106 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       . */ 
 /* discard bad characters */ 
break;
default:
  return this.simpleCaseActionClusters[yyrulenumber];
}
        }`,
  caseHelperInclude: `{

  /*! Conditions:: INITIAL */ 
  /*! Rule::       auto\\b */ 
   2 : 'AUTO',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       break\\b */ 
   3 : 'BREAK',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       case\\b */ 
   4 : 'CASE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       char\\b */ 
   5 : 'CHAR',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       const\\b */ 
   6 : 'CONST',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       continue\\b */ 
   7 : 'CONTINUE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       default\\b */ 
   8 : 'DEFAULT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       do\\b */ 
   9 : 'DO',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       double\\b */ 
   10 : 'DOUBLE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       else\\b */ 
   11 : 'ELSE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       enum\\b */ 
   12 : 'ENUM',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       extern\\b */ 
   13 : 'EXTERN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       float\\b */ 
   14 : 'FLOAT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       for\\b */ 
   15 : 'FOR',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       goto\\b */ 
   16 : 'GOTO',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       if\\b */ 
   17 : 'IF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       inline\\b */ 
   18 : 'INLINE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       int\\b */ 
   19 : 'INT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       long\\b */ 
   20 : 'LONG',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       register\\b */ 
   21 : 'REGISTER',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       restrict\\b */ 
   22 : 'RESTRICT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       return\\b */ 
   23 : 'RETURN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       short\\b */ 
   24 : 'SHORT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       signed\\b */ 
   25 : 'SIGNED',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       sizeof\\b */ 
   26 : 'SIZEOF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       static\\b */ 
   27 : 'STATIC',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       struct\\b */ 
   28 : 'STRUCT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       switch\\b */ 
   29 : 'SWITCH',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       typedef\\b */ 
   30 : 'TYPEDEF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       union\\b */ 
   31 : 'UNION',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       unsigned\\b */ 
   32 : 'UNSIGNED',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       void\\b */ 
   33 : 'VOID',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       volatile\\b */ 
   34 : 'VOLATILE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       while\\b */ 
   35 : 'WHILE',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Alignas\\b */ 
   36 : 'ALIGNAS',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Alignof\\b */ 
   37 : 'ALIGNOF',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Atomic\\b */ 
   38 : 'ATOMIC',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Bool\\b */ 
   39 : 'BOOL',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Complex\\b */ 
   40 : 'COMPLEX',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Generic\\b */ 
   41 : 'GENERIC',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Imaginary\\b */ 
   42 : 'IMAGINARY',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Noreturn\\b */ 
   43 : 'NORETURN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Static_assert\\b */ 
   44 : 'STATIC_ASSERT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       _Thread_local\\b */ 
   45 : 'THREAD_LOCAL',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       __func__\\b */ 
   46 : 'FUNC_NAME',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}+{IS}? */ 
   48 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {NZ}{D}*{IS}? */ 
   49 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       0{O}*{IS}? */ 
   50 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {CP}?'([^'\\\\\\n]|{ES})+' */ 
   51 : 'I_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {D}+{E}{FS}? */ 
   52 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {D}*\\.{D}+{E}?{FS}? */ 
   53 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {D}+\\.{E}?{FS}? */ 
   54 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}+{P}{FS}? */ 
   55 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}*\\.{H}+{P}{FS}? */ 
   56 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       {HP}{H}+\\.{P}{FS}? */ 
   57 : 'F_CONSTANT',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ({SP}?"([^\\"\\\\\\n]|{ES})*"{WS}*)+ */ 
   58 : 'STRING_LITERAL',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\.\\.\\. */ 
   59 : 'ELLIPSIS',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       >>= */ 
   60 : 'RIGHT_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       <<= */ 
   61 : 'LEFT_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\+= */ 
   62 : 'ADD_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       -= */ 
   63 : 'SUB_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\*= */ 
   64 : 'MUL_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\/= */ 
   65 : 'DIV_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       %= */ 
   66 : 'MOD_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       &= */ 
   67 : 'AND_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\^= */ 
   68 : 'XOR_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\|= */ 
   69 : 'OR_ASSIGN',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       >> */ 
   70 : 'RIGHT_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       << */ 
   71 : 'LEFT_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\+\\+ */ 
   72 : 'INC_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       -- */ 
   73 : 'DEC_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       -> */ 
   74 : 'PTR_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       && */ 
   75 : 'AND_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\|\\| */ 
   76 : 'OR_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       <= */ 
   77 : 'LE_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       >= */ 
   78 : 'GE_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       == */ 
   79 : 'EQ_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       != */ 
   80 : 'NE_OP',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ; */ 
   81 : ';',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\\{|<%) */ 
   82 : '{',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\\}|%>) */ 
   83 : '}',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       , */ 
   84 : ',',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       : */ 
   85 : ':',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       = */ 
   86 : '=',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\( */ 
   87 : '(',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\) */ 
   88 : ')',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\\[|<:) */ 
   89 : '[',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       (\\]|:>) */ 
   90 : ']',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\. */ 
   91 : '.',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       & */ 
   92 : '&',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ! */ 
   93 : '!',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       ~ */ 
   94 : '~',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       - */ 
   95 : '-',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\+ */ 
   96 : '+',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\* */ 
   97 : '*',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\/ */ 
   98 : '/',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       % */ 
   99 : '%',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       < */ 
   100 : '<',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       > */ 
   101 : '>',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\^ */ 
   102 : '^',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\| */ 
   103 : '|',
  /*! Conditions:: INITIAL */ 
  /*! Rule::       \\? */ 
   104 : '?'
}`,
  rules: [
    {
      re: '/^(?:\\/\\*)/',
      source: '^(?:\\/\\*)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/\\*)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\/\\/.*)/',
      source: '^(?:\\/\\/.*)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/\\/.*)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:auto\\b)/',
      source: '^(?:auto\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:auto\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:break\\b)/',
      source: '^(?:break\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:break\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:case\\b)/',
      source: '^(?:case\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:case\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:char\\b)/',
      source: '^(?:char\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:char\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:const\\b)/',
      source: '^(?:const\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:const\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:continue\\b)/',
      source: '^(?:continue\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:continue\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:default\\b)/',
      source: '^(?:default\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:default\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:do\\b)/',
      source: '^(?:do\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:do\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:double\\b)/',
      source: '^(?:double\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:double\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:else\\b)/',
      source: '^(?:else\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:else\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:enum\\b)/',
      source: '^(?:enum\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:enum\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:extern\\b)/',
      source: '^(?:extern\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:extern\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:float\\b)/',
      source: '^(?:float\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:float\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:for\\b)/',
      source: '^(?:for\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:for\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:goto\\b)/',
      source: '^(?:goto\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:goto\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:if\\b)/',
      source: '^(?:if\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:if\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:inline\\b)/',
      source: '^(?:inline\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:inline\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:int\\b)/',
      source: '^(?:int\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:int\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:long\\b)/',
      source: '^(?:long\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:long\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:register\\b)/',
      source: '^(?:register\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:register\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:restrict\\b)/',
      source: '^(?:restrict\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:restrict\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:return\\b)/',
      source: '^(?:return\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:return\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:short\\b)/',
      source: '^(?:short\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:short\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:signed\\b)/',
      source: '^(?:signed\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:signed\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:sizeof\\b)/',
      source: '^(?:sizeof\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:sizeof\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:static\\b)/',
      source: '^(?:static\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:static\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:struct\\b)/',
      source: '^(?:struct\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:struct\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:switch\\b)/',
      source: '^(?:switch\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:switch\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:typedef\\b)/',
      source: '^(?:typedef\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:typedef\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:union\\b)/',
      source: '^(?:union\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:union\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:unsigned\\b)/',
      source: '^(?:unsigned\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:unsigned\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:void\\b)/',
      source: '^(?:void\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:void\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:volatile\\b)/',
      source: '^(?:volatile\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:volatile\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:while\\b)/',
      source: '^(?:while\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:while\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Alignas\\b)/',
      source: '^(?:_Alignas\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Alignas\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Alignof\\b)/',
      source: '^(?:_Alignof\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Alignof\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Atomic\\b)/',
      source: '^(?:_Atomic\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Atomic\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Bool\\b)/',
      source: '^(?:_Bool\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Bool\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Complex\\b)/',
      source: '^(?:_Complex\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Complex\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Generic\\b)/',
      source: '^(?:_Generic\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Generic\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Imaginary\\b)/',
      source: '^(?:_Imaginary\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Imaginary\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Noreturn\\b)/',
      source: '^(?:_Noreturn\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Noreturn\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Static_assert\\b)/',
      source: '^(?:_Static_assert\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Static_assert\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:_Thread_local\\b)/',
      source: '^(?:_Thread_local\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:_Thread_local\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:__func__\\b)/',
      source: '^(?:__func__\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:__func__\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\W\\d])(\\w)*)/',
      source: '^(?:([^\\W\\d])(\\w)*)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\W\\d])(\\w)*)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:((0[Xx]))([\\dA-Fa-f])+((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)/',
      source: '^(?:((0[Xx]))([\\dA-Fa-f])+((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:((0[Xx]))([\\dA-Fa-f])+((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([1-9])(\\d)*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)/',
      source: '^(?:([1-9])(\\d)*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([1-9])(\\d)*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:0([0-7])*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)/',
      source: '^(?:0([0-7])*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:0([0-7])*((((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?)))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: `/^(?:((u|U|L))?'([^\\n'\\\\]|((\\\\(["'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))))+')/`,
      source: `^(?:((u|U|L))?'([^\\n'\\\\]|((\\\\(["'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))))+')`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:((u|U|L))?'([^\\n'\\\\]|((\\\\(["'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))))+')`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\d)+(([Ee][+-]?(?:\\d)+))((f|F|l|L))?)/',
      source: '^(?:(\\d)+(([Ee][+-]?(?:\\d)+))((f|F|l|L))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\d)+(([Ee][+-]?(?:\\d)+))((f|F|l|L))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\d)*\\.(\\d)+(([Ee][+-]?(?:\\d)+))?((f|F|l|L))?)/',
      source: '^(?:(\\d)*\\.(\\d)+(([Ee][+-]?(?:\\d)+))?((f|F|l|L))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\d)*\\.(\\d)+(([Ee][+-]?(?:\\d)+))?((f|F|l|L))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\d)+\\.(([Ee][+-]?(?:\\d)+))?((f|F|l|L))?)/',
      source: '^(?:(\\d)+\\.(([Ee][+-]?(?:\\d)+))?((f|F|l|L))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\d)+\\.(([Ee][+-]?(?:\\d)+))?((f|F|l|L))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:((0[Xx]))([\\dA-Fa-f])+(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)/',
      source: '^(?:((0[Xx]))([\\dA-Fa-f])+(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:((0[Xx]))([\\dA-Fa-f])+(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:((0[Xx]))([\\dA-Fa-f])*\\.([\\dA-Fa-f])+(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)/',
      source: '^(?:((0[Xx]))([\\dA-Fa-f])*\\.([\\dA-Fa-f])+(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:((0[Xx]))([\\dA-Fa-f])*\\.([\\dA-Fa-f])+(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:((0[Xx]))([\\dA-Fa-f])+\\.(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)/',
      source: '^(?:((0[Xx]))([\\dA-Fa-f])+\\.(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:((0[Xx]))([\\dA-Fa-f])+\\.(([Pp][+-]?(?:\\d)+))((f|F|l|L))?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: `/^(?:(((u8|u|U|L))?"([^\\n"\\\\]|((\\\\(["'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))))*"([\\t-\\f ])*)+)/`,
      source: `^(?:(((u8|u|U|L))?"([^\\n"\\\\]|((\\\\(["'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))))*"([\\t-\\f ])*)+)`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:(((u8|u|U|L))?"([^\\n"\\\\]|((\\\\(["'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))))*"([\\t-\\f ])*)+)`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\.\\.\\.)/',
      source: '^(?:\\.\\.\\.)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\.\\.\\.)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:>>=)/',
      source: '^(?:>>=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:>>=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:<<=)/',
      source: '^(?:<<=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:<<=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\+=)/',
      source: '^(?:\\+=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\+=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:-=)/',
      source: '^(?:-=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:-=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\*=)/',
      source: '^(?:\\*=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\*=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\/=)/',
      source: '^(?:\\/=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%=)/',
      source: '^(?:%=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:&=)/',
      source: '^(?:&=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:&=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\^=)/',
      source: '^(?:\\^=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\^=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\|=)/',
      source: '^(?:\\|=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\|=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:>>)/',
      source: '^(?:>>)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:>>)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:<<)/',
      source: '^(?:<<)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:<<)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\+\\+)/',
      source: '^(?:\\+\\+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\+\\+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:--)/',
      source: '^(?:--)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:--)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:->)/',
      source: '^(?:->)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:->)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:&&)/',
      source: '^(?:&&)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:&&)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\|\\|)/',
      source: '^(?:\\|\\|)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\|\\|)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:<=)/',
      source: '^(?:<=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:<=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:>=)/',
      source: '^(?:>=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:>=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:==)/',
      source: '^(?:==)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:==)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:!=)/',
      source: '^(?:!=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:!=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:;)/',
      source: '^(?:;)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:;)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\{|<%))/',
      source: '^(?:(\\{|<%))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\{|<%))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\}|%>))/',
      source: '^(?:(\\}|%>))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\}|%>))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:,)/',
      source: '^(?:,)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:,)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?::)/',
      source: '^(?::)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?::)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:=)/',
      source: '^(?:=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\()/',
      source: '^(?:\\()',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\()',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\))/',
      source: '^(?:\\))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\[|<:))/',
      source: '^(?:(\\[|<:))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\[|<:))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\]|:>))/',
      source: '^(?:(\\]|:>))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\]|:>))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\.)/',
      source: '^(?:\\.)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\.)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:&)/',
      source: '^(?:&)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:&)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:!)/',
      source: '^(?:!)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:!)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:~)/',
      source: '^(?:~)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:~)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:-)/',
      source: '^(?:-)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:-)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\+)/',
      source: '^(?:\\+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\*)/',
      source: '^(?:\\*)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\*)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\/)/',
      source: '^(?:\\/)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%)/',
      source: '^(?:%)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:<)/',
      source: '^(?:<)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:<)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:>)/',
      source: '^(?:>)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:>)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\^)/',
      source: '^(?:\\^)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\^)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\|)/',
      source: '^(?:\\|)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\|)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\?)/',
      source: '^(?:\\?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([\\t-\\f ])+)/',
      source: '^(?:([\\t-\\f ])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([\\t-\\f ])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:.)/',
      source: '^(?:.)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:.)',
        flags: '',
        isNative: true,
      },
    },
  ],
  macros: {
    O: {
      in_set: '0-7',
      elsewhere: '[0-7]',
      raw: '[0-7]',
    },
    D: {
      in_set: '\\d',
      elsewhere: '\\d',
      raw: '[0-9]',
    },
    NZ: {
      in_set: '1-9',
      elsewhere: '[1-9]',
      raw: '[1-9]',
    },
    L: {
      in_set: 'A-Z_a-z',
      elsewhere: '[^\\W\\d]',
      raw: '[a-zA-Z_]',
    },
    A: {
      in_set: '\\w',
      elsewhere: '\\w',
      raw: '[a-zA-Z_0-9]',
    },
    H: {
      in_set: '0-9A-Fa-f',
      elsewhere: '[\\dA-Fa-f]',
      raw: '[a-fA-F0-9]',
    },
    HP: {
      in_set: {
        message: '[macro [HP] is unsuitable for use inside regex set expressions: "[(0[xX])]"]',
        name: 'Error',
      },
      elsewhere: '(0[Xx])',
      raw: '(0[xX])',
    },
    E: {
      in_set: {
        message: '[macro [E] is unsuitable for use inside regex set expressions: "[([Ee][+-]?\\d+)]"]',
        name: 'Error',
      },
      elsewhere: '([Ee][+-]?(?:\\d)+)',
      raw: '([Ee][+-]?{D}+)',
    },
    P: {
      in_set: {
        message: '[macro [P] is unsuitable for use inside regex set expressions: "[([Pp][+-]?\\d+)]"]',
        name: 'Error',
      },
      elsewhere: '([Pp][+-]?(?:\\d)+)',
      raw: '([Pp][+-]?{D}+)',
    },
    FS: {
      in_set: {
        message: '[macro [FS] is unsuitable for use inside regex set expressions: "[(f|F|l|L)]"]',
        name: 'Error',
      },
      elsewhere: '(f|F|l|L)',
      raw: '(f|F|l|L)',
    },
    IS: {
      in_set: {
        message: '[macro [IS] is unsuitable for use inside regex set expressions: "[(((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?))]"]',
        name: 'Error',
      },
      elsewhere: '(((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?))',
      raw: '(((u|U)(l|L|ll|LL)?)|((l|L|ll|LL)(u|U)?))',
    },
    CP: {
      in_set: {
        message: '[macro [CP] is unsuitable for use inside regex set expressions: "[(u|U|L)]"]',
        name: 'Error',
      },
      elsewhere: '(u|U|L)',
      raw: '(u|U|L)',
    },
    SP: {
      in_set: {
        message: '[macro [SP] is unsuitable for use inside regex set expressions: "[(u8|u|U|L)]"]',
        name: 'Error',
      },
      elsewhere: '(u8|u|U|L)',
      raw: '(u8|u|U|L)',
    },
    ES: {
      in_set: {
        message: `[macro [ES] is unsuitable for use inside regex set expressions: "[(\\\\(['"\\?\\\\abfnrtv]|[0-7]{1,3}|x[a-fA-F0-9]+))]"]`,
        name: 'Error',
      },
      elsewhere: '(\\\\(["\'?\\\\abfnrtv]|[0-7]{1,3}|x[\\dA-Fa-f]+))',
      raw: '(\\\\([\'"\\?\\\\abfnrtv]|[0-7]{1,3}|x[a-fA-F0-9]+))',
    },
    WS: {
      in_set: '\\t-\\f ',
      elsewhere: '[\\t-\\f ]',
      raw: '[ \\t\\v\\n\\f]',
    },
  },
  regular_rule_count: 5,
  simple_rule_count: 102,
  conditionStack: [
    'INITIAL',
  ],
  actionInclude: '',
  moduleInclude: `// 
// int yywrap(void)        /* called at end of input */
// {
//     return 1;           /* terminate now */
// }
// 
// static void comment(void)
// {
//     int c;
// 
//     while ((c = input()) != 0)
//         if (c == '*')
//         {
//             while ((c = input()) == '*')
//                 ;
// 
//             if (c == '/')
//                 return;
// 
//             if (c == 0)
//                 break;
//         }
//     yyerror("unterminated comment");
// }
// 
// static int check_type(void)
// {
//     switch (sym_type(yytext))
//     {
//     case TYPEDEF_NAME:                /* previously defined */
//         return TYPEDEF_NAME;
//     case ENUMERATION_CONSTANT:        /* previously defined */
//         return ENUMERATION_CONSTANT;
//     default:                          /* includes undefined */
//         return IDENTIFIER;
//     }
// }
// 
//`,
  __in_rules_failure_analysis_mode__: false,
  exportSourceCode: {
    enabled: false,
  },
  is_custom_lexer: false,
}

        