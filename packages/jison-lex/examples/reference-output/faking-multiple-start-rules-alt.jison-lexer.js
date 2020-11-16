
            
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
  trackPosition: true
},
    JisonLexerError: JisonLexerError,
    performAction: function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            
var YYSTATE = YY_START;
switch(yyrulenumber) {
case 0 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       \u0001 */ 
 this.popState();
            console.log('detected date mode');
            return 'DATE_PARSE_MODE' 
break;
case 1 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       \u0002 */ 
 this.popState();
            console.log('detected time mode');
            return 'TIME_PARSE_MODE' 
break;
case 2 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       \u0003 */ 
 this.popState();
            console.log('detected value mode');
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE' 
break;
case 3 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       . */ 
 this.popState();
            console.log('detected DEFAULT (value) mode');
            /*
             * When we did not observe one of the special character codes at the forefront of our
             * input stream then we will parsing the entire input in the default mode, i.e. as a numeric value.
             *
             * Therefore, let the previous lexer state (should be `INITIAL`) process this bit instead;
             * do not consume the matched input.
             *
             * **WARNING**: you might think this would be easily accomplished using the lexer.reject()
             * call like this:
             *
             *     this.reject();
             *
             * but `reject()` only works as expected _as long as you do NOT switch lexer states_!
             *
             * Some understanding of the lexer internals is required here: when you call `reject()`, the
             * lexer will simply test the input against the next regex in the current set. The key here
             * is _the current set_: when the lexer is required to produce a token, it will construct
             * a _regex set_ given the _current lexer state_.
             *
             * What we need here is the lexer retrying matching the same input after we changed the
             * lexer state above when we called:
             *
             *     this.popState();
             *
             * The way to accomplish this is to 'push back' the matched content into the input buffer using
             * `.unput()` and then signal the lexer that we matched nothing by returning no token at all:
             *
             *      return false;
             *
             * That `return false` will make sure the lexer considers this action as 'complete' (by
             * us `return`ing from the lexer), while the boolean `false` tells the lexer it will need
             * to run another round in order to provide its caller with a 'real' lexed token.
             *
             *
             * ### For the technically inquisitive
             *
             * The crux is us employing the side effects of the jison lexer engine,
             * more specifically this bit, where I'd like you to take notice of
             * the recursive nature of the `.lex()` method in here, plus the fact that `.next()`
             * will call `._currentRules()` each time it is invoked (while this is a very much
             * reduced and somewhat paraphrased extract of the original):
             *
             *      // generated by jison-lex...
             *      parser.lexer = {
             *          ...,
             *          next: function () {
             *              ...
             *              var match, token, rule_under_test;
             *              var rules = this._currentRules();
             *              for (var i = 0; i < rules.length; i++) {
             *                  rule_under_test = this.rules[rules[i]];
             *                  match = this._input.match(rule_under_test);
             *                  ...
             *                  if (match) {
             *                      // exec the matching lexer action code:
             *                      token = this.test_match(match, rule_under_test);
             *
             *                      // stay in this loop when .reject() was called,
             *                      // otherwise we'll run with this match:
             *                      if (!this.rejected) break;
             *                  }
             *              }
             *              if (match) {
             *                  ...
             *                  if (token !== false) {
             *                      return token;
             *                  }
             *                  // else: this is a lexer rule which consumes input
             *                  //       without producing a token (e.g. whitespace)
             *                  return false;
             *              }
             *              ...
             *          },
             *
             *          // return next match that has a token
             *          lex: function lex() {
             *              var r = this.next();
             *              if (r) {
             *                  return r;
             *              } else {
             *                  return this.lex();
             *              }
             *          },
             *
             *          // produce the lexer rule set which is active
             *          // for the currently active lexer condition state
             *          _currentRules: function _currentRules() {
             *              ...
             *              return this.conditions[...].rules;
             *          },
             *
             *          ...
             *
             *          conditions: {
             *              "PARSE_MODE_DETECTION": {
             *                  rules: [
             *                      0, 1, 2, 3, 4
             *                  ],
             *                  inclusive: false
             *              },
             *              ...
             *              "INITIAL": {
             *                  rules: [
             *                      5, 6, 7, 8, 9,
             *                      ...
             *                  ],
             *                  inclusive: true
             *              }
             *          }
             *      };
             *
             */
            this.unput(this.matches[0]);
            
            // Pick the default parse mode:
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE' 
break;
case 4 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       $ */ 
 this.popState();
            // let the previous lexer state process that EOF for real...
            return false 
break;
case 6 : 
/*! Conditions:: VALUE_MODE */ 
/*! Rule::       {BASIC_FLOATING_POINT_NUMBER} */ 
 yy_.yytext = parseFloat(yy_.yytext);
            return 'FLOAT' 
break;
case 7 : 
/*! Conditions:: VALUE_MODE INITIAL */ 
/*! Rule::       {DIGIT}+ */ 
 yy_.yytext = parseInt(yy_.yytext, 10);
            return 'INTEGER' 
break;
case 13 : 
/*! Conditions:: VALUE_MODE INITIAL */ 
/*! Rule::       \s+ */ 
 /*: skip whitespace */ 
break;
case 15 : 
/*! Conditions:: VALUE_MODE INITIAL */ 
/*! Rule::       . */ 
 yy.lexer.parseError("Don't know what to do with this: it's unsupported input: '" + yy_.yytext + "'");
            return 'error' 
break;
default:
  return this.simpleCaseActionClusters[yyrulenumber];
}
        },
    simpleCaseActionClusters: {

  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       {UNICODE_LETTER}+ */ 
   5 : 'MONTH',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       - */ 
   8 : '-',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       \+ */ 
   9 : '+',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       \/ */ 
   10 : '/',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       : */ 
   11 : ':',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       \. */ 
   12 : '.',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       $ */ 
   14 : 'EOF'
},
    rules: [
        /*  0: */  /^(?:\u0001)/,
/*  1: */  /^(?:\u0002)/,
/*  2: */  /^(?:\u0003)/,
/*  3: */  /^(?:.)/,
/*  4: */  /^(?:$)/,
/*  5: */  /^(?:([^\u0000-@\[-`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])+)/,
/*  6: */  /^(?:((?:\d+(?:\.\d*)?|\.\d+)))/,
/*  7: */  /^(?:([\d²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൘-൞൦-൸෦-෯๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꧰-꧹꩐-꩙꯰-꯹０-９])+)/,
/*  8: */  /^(?:-)/,
/*  9: */  /^(?:\+)/,
/* 10: */  /^(?:\/)/,
/* 11: */  /^(?::)/,
/* 12: */  /^(?:\.)/,
/* 13: */  /^(?:\s+)/,
/* 14: */  /^(?:$)/,
/* 15: */  /^(?:.)/
    ],
    conditions: {
  "PARSE_MODE_DETECTION": {
    rules: [
      0,
      1,
      2,
      3,
      4
    ],
    inclusive: false
  },
  "VALUE_MODE": {
    rules: [
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
      15
    ],
    inclusive: true
  },
  "INITIAL": {
    rules: [
      5,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15
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
        [
          'PARSE_MODE_DETECTION',
        ],
        '\\u0001',
        `this.popState();
            console.log('detected date mode');
            return 'DATE_PARSE_MODE'`,
      ],
      [
        [
          'PARSE_MODE_DETECTION',
        ],
        '\\u0002',
        `this.popState();
            console.log('detected time mode');
            return 'TIME_PARSE_MODE'`,
      ],
      [
        [
          'PARSE_MODE_DETECTION',
        ],
        '\\u0003',
        `this.popState();
            console.log('detected value mode');
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE'`,
      ],
      [
        [
          'PARSE_MODE_DETECTION',
        ],
        '.',
        `this.popState();
            console.log('detected DEFAULT (value) mode');
            /*
             * When we did not observe one of the special character codes at the forefront of our
             * input stream then we will parsing the entire input in the default mode, i.e. as a numeric value.
             *
             * Therefore, let the previous lexer state (should be \`INITIAL\`) process this bit instead;
             * do not consume the matched input.
             *
             * **WARNING**: you might think this would be easily accomplished using the lexer.reject()
             * call like this:
             *
             *     this.reject();
             *
             * but \`reject()\` only works as expected _as long as you do NOT switch lexer states_!
             *
             * Some understanding of the lexer internals is required here: when you call \`reject()\`, the
             * lexer will simply test the input against the next regex in the current set. The key here
             * is _the current set_: when the lexer is required to produce a token, it will construct
             * a _regex set_ given the _current lexer state_.
             *
             * What we need here is the lexer retrying matching the same input after we changed the
             * lexer state above when we called:
             *
             *     this.popState();
             *
             * The way to accomplish this is to 'push back' the matched content into the input buffer using
             * \`.unput()\` and then signal the lexer that we matched nothing by returning no token at all:
             *
             *      return false;
             *
             * That \`return false\` will make sure the lexer considers this action as 'complete' (by
             * us \`return\`ing from the lexer), while the boolean \`false\` tells the lexer it will need
             * to run another round in order to provide its caller with a 'real' lexed token.
             *
             *
             * ### For the technically inquisitive
             *
             * The crux is us employing the side effects of the jison lexer engine,
             * more specifically this bit, where I'd like you to take notice of
             * the recursive nature of the \`.lex()\` method in here, plus the fact that \`.next()\`
             * will call \`._currentRules()\` each time it is invoked (while this is a very much
             * reduced and somewhat paraphrased extract of the original):
             *
             *      // generated by jison-lex...
             *      parser.lexer = {
             *          ...,
             *          next: function () {
             *              ...
             *              var match, token, rule_under_test;
             *              var rules = this._currentRules();
             *              for (var i = 0; i < rules.length; i++) {
             *                  rule_under_test = this.rules[rules[i]];
             *                  match = this._input.match(rule_under_test);
             *                  ...
             *                  if (match) {
             *                      // exec the matching lexer action code:
             *                      token = this.test_match(match, rule_under_test);
             *
             *                      // stay in this loop when .reject() was called,
             *                      // otherwise we'll run with this match:
             *                      if (!this.rejected) break;
             *                  }
             *              }
             *              if (match) {
             *                  ...
             *                  if (token !== false) {
             *                      return token;
             *                  }
             *                  // else: this is a lexer rule which consumes input
             *                  //       without producing a token (e.g. whitespace)
             *                  return false;
             *              }
             *              ...
             *          },
             *
             *          // return next match that has a token
             *          lex: function lex() {
             *              var r = this.next();
             *              if (r) {
             *                  return r;
             *              } else {
             *                  return this.lex();
             *              }
             *          },
             *
             *          // produce the lexer rule set which is active
             *          // for the currently active lexer condition state
             *          _currentRules: function _currentRules() {
             *              ...
             *              return this.conditions[...].rules;
             *          },
             *
             *          ...
             *
             *          conditions: {
             *              "PARSE_MODE_DETECTION": {
             *                  rules: [
             *                      0, 1, 2, 3, 4
             *                  ],
             *                  inclusive: false
             *              },
             *              ...
             *              "INITIAL": {
             *                  rules: [
             *                      5, 6, 7, 8, 9,
             *                      ...
             *                  ],
             *                  inclusive: true
             *              }
             *          }
             *      };
             *
             */
            this.unput(this.matches[0]);
            
            // Pick the default parse mode:
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE'`,
      ],
      [
        [
          'PARSE_MODE_DETECTION',
        ],
        '$',
        `this.popState();
            // let the previous lexer state process that EOF for real...
            return false`,
      ],
      [
        '{UNICODE_LETTER}+',
        "return 'MONTH'",
      ],
      [
        [
          'VALUE_MODE',
        ],
        '{BASIC_FLOATING_POINT_NUMBER}',
        "yytext = parseFloat(yytext);\n            return 'FLOAT'",
      ],
      [
        '{DIGIT}+',
        "yytext = parseInt(yytext, 10);\n            return 'INTEGER'",
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
        '\\/',
        "return '/'",
      ],
      [
        ':',
        "return ':'",
      ],
      [
        '\\.',
        "return '.'",
      ],
      [
        '\\s+',
        '/*: skip whitespace */',
      ],
      [
        '$',
        "return 'EOF'",
      ],
      [
        '.',
        `yy.lexer.parseError("Don't know what to do with this: it's unsupported input: '" + yytext + "'");
            return 'error'`,
      ],
    ],
    moduleInclude: `/*
 * This chunk is included in the parser object code,
 * following the 'init' code block that may be set in \`%{ ... %}\` at the top of this
 * grammar definition file.
 */



/* @const */ var DATE_MODE = 'D';
/* @const */ var TIME_MODE = 'T';
/* @const */ var VALUE_MODE = 'V';

var parseModeInitialized = 0;

function initParseMode(yy, parser_mode) {
    /*
     * The 'init phase' is always invoked for every parse invocation.
     *
     * At this point in time, nothing has happened yet: no token has
     * been lexed, no real statement has been parsed yet.
     */

    /*
     * Depending on parser mode we must push a 'magick marker' into the lexer stream
     * which is a hack offering a working alternative to having the parser generator
     * support multiple %start rules.
     */
    yy.lexer.pushState('PARSE_MODE_DETECTION');


    parseModeInitialized = 1;


    // prevent crash in lexer as the look-ahead activity in there may already have 
    // changed yytext to become another type (not string any more):
    //yy.lexer.yytext = yy.lexer.match;


    switch (parser_mode) {
    default:
        break;

    case DATE_MODE:
        yy.lexer.unput("\\u0001");
        break;

    case TIME_MODE:
        yy.lexer.unput("\\u0002");
        break;

    case VALUE_MODE:
        yy.lexer.unput("\\u0003");
        break;
    }
};





// Demo main() to showcase the use of this example:
parser.main = function () {
    // set up a custom parseError handler.
    //
    // Note that this one has an extra feature: it returns a special (truthy) 'parse value'
    // which will be returned by the parse() call when this handler was invoked: this is 
    // very useful to quickly make the parse process a known result even when errors have
    // occurred: 
    parser.parseError = function altParseError(msg, hash) {
        if (hash && hash.exception) {
            msg = hash.exception.message;
            //console.log('ex:', hash.exception, hash.exception.stack);
        }
        console.log("### ERROR: " + msg);
        return {
            error: 'parse error'
        };
    };

    // Because JISON doesn't reduce epsilon rules *before* the next non-epsilon rule is
    // inspected, i.e. JISON *always* fetches a single look-ahead token from the lexer,
    // and we cannot have that as we need to push back the parse mode marker *before*
    // anything is lexed in there, so we have to complicate this hack by hooking into
    // the lexer and making it spit out dummy tokens until we observe the parse mode
    // being set up via initParseMode() above...
    parser.lexer.options.pre_lex = function () {
        // This callback can return a token ID to prevent the lexer from munching any
        // input:
        if (!parseModeInitialized) {
            //console.log('pre_lex pre init --> DUMMY');
            return parser.symbols_['DUMMY'];
        }
        //console.log('pre_lex');
    };

    // And hook into setInput AI to reset the global flag...
    var si_f = parser.lexer.setInput;
    parser.lexer.setInput = function (input, yy) {
        parseModeInitialized = 0;

        console.log('setting input: ', input);
        
        return si_f.call(this, input, yy);
    };

    // End of fixup to make the hack work. 
    //
    // Compare this with the code in the faking-multiple-start-rules.jison example which
    // employs the pre_parse() API: that one is much cleaner than this!


    console.log('\\n\\nUsing number parse mode:\\n');

    var input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));



    console.log('\\n\\nUsing date parse mode:\\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));



    console.log('\\n\\nUsing time parse mode:\\n');

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));




    console.log('\\n\\nUsing DEFAULT parse mode:\\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));



}`,
    macros: {
      ASCII_LETTER: '[a-zA-z]',
      UNICODE_LETTER: '[\\p{Alphabetic}]',
      DIGIT: '[\\p{Number}]',
      WHITESPACE: '[\\s\\r\\n\\p{Separator}]',
      BASIC_FLOATING_POINT_NUMBER: '(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)',
    },
    startConditions: {
      PARSE_MODE_DETECTION: 1,
      VALUE_MODE: 0,
    },
    codeSections: [],
    importDecls: [],
    unknownDecls: [],
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
  },
  moduleType: 'commonjs',
  conditions: {
    PARSE_MODE_DETECTION: {
      rules: [
        0,
        1,
        2,
        3,
        4,
      ],
      inclusive: false,
    },
    VALUE_MODE: {
      rules: [
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
      ],
      inclusive: true,
    },
    INITIAL: {
      rules: [
        5,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
      ],
      inclusive: true,
    },
  },
  performAction: `function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            
var YYSTATE = YY_START;
switch(yyrulenumber) {
case 0 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       \\u0001 */ 
 this.popState();
            console.log('detected date mode');
            return 'DATE_PARSE_MODE' 
break;
case 1 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       \\u0002 */ 
 this.popState();
            console.log('detected time mode');
            return 'TIME_PARSE_MODE' 
break;
case 2 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       \\u0003 */ 
 this.popState();
            console.log('detected value mode');
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE' 
break;
case 3 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       . */ 
 this.popState();
            console.log('detected DEFAULT (value) mode');
            /*
             * When we did not observe one of the special character codes at the forefront of our
             * input stream then we will parsing the entire input in the default mode, i.e. as a numeric value.
             *
             * Therefore, let the previous lexer state (should be \`INITIAL\`) process this bit instead;
             * do not consume the matched input.
             *
             * **WARNING**: you might think this would be easily accomplished using the lexer.reject()
             * call like this:
             *
             *     this.reject();
             *
             * but \`reject()\` only works as expected _as long as you do NOT switch lexer states_!
             *
             * Some understanding of the lexer internals is required here: when you call \`reject()\`, the
             * lexer will simply test the input against the next regex in the current set. The key here
             * is _the current set_: when the lexer is required to produce a token, it will construct
             * a _regex set_ given the _current lexer state_.
             *
             * What we need here is the lexer retrying matching the same input after we changed the
             * lexer state above when we called:
             *
             *     this.popState();
             *
             * The way to accomplish this is to 'push back' the matched content into the input buffer using
             * \`.unput()\` and then signal the lexer that we matched nothing by returning no token at all:
             *
             *      return false;
             *
             * That \`return false\` will make sure the lexer considers this action as 'complete' (by
             * us \`return\`ing from the lexer), while the boolean \`false\` tells the lexer it will need
             * to run another round in order to provide its caller with a 'real' lexed token.
             *
             *
             * ### For the technically inquisitive
             *
             * The crux is us employing the side effects of the jison lexer engine,
             * more specifically this bit, where I'd like you to take notice of
             * the recursive nature of the \`.lex()\` method in here, plus the fact that \`.next()\`
             * will call \`._currentRules()\` each time it is invoked (while this is a very much
             * reduced and somewhat paraphrased extract of the original):
             *
             *      // generated by jison-lex...
             *      parser.lexer = {
             *          ...,
             *          next: function () {
             *              ...
             *              var match, token, rule_under_test;
             *              var rules = this._currentRules();
             *              for (var i = 0; i < rules.length; i++) {
             *                  rule_under_test = this.rules[rules[i]];
             *                  match = this._input.match(rule_under_test);
             *                  ...
             *                  if (match) {
             *                      // exec the matching lexer action code:
             *                      token = this.test_match(match, rule_under_test);
             *
             *                      // stay in this loop when .reject() was called,
             *                      // otherwise we'll run with this match:
             *                      if (!this.rejected) break;
             *                  }
             *              }
             *              if (match) {
             *                  ...
             *                  if (token !== false) {
             *                      return token;
             *                  }
             *                  // else: this is a lexer rule which consumes input
             *                  //       without producing a token (e.g. whitespace)
             *                  return false;
             *              }
             *              ...
             *          },
             *
             *          // return next match that has a token
             *          lex: function lex() {
             *              var r = this.next();
             *              if (r) {
             *                  return r;
             *              } else {
             *                  return this.lex();
             *              }
             *          },
             *
             *          // produce the lexer rule set which is active
             *          // for the currently active lexer condition state
             *          _currentRules: function _currentRules() {
             *              ...
             *              return this.conditions[...].rules;
             *          },
             *
             *          ...
             *
             *          conditions: {
             *              "PARSE_MODE_DETECTION": {
             *                  rules: [
             *                      0, 1, 2, 3, 4
             *                  ],
             *                  inclusive: false
             *              },
             *              ...
             *              "INITIAL": {
             *                  rules: [
             *                      5, 6, 7, 8, 9,
             *                      ...
             *                  ],
             *                  inclusive: true
             *              }
             *          }
             *      };
             *
             */
            this.unput(this.matches[0]);
            
            // Pick the default parse mode:
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE' 
break;
case 4 : 
/*! Conditions:: PARSE_MODE_DETECTION */ 
/*! Rule::       $ */ 
 this.popState();
            // let the previous lexer state process that EOF for real...
            return false 
break;
case 6 : 
/*! Conditions:: VALUE_MODE */ 
/*! Rule::       {BASIC_FLOATING_POINT_NUMBER} */ 
 yy_.yytext = parseFloat(yy_.yytext);
            return 'FLOAT' 
break;
case 7 : 
/*! Conditions:: VALUE_MODE INITIAL */ 
/*! Rule::       {DIGIT}+ */ 
 yy_.yytext = parseInt(yy_.yytext, 10);
            return 'INTEGER' 
break;
case 13 : 
/*! Conditions:: VALUE_MODE INITIAL */ 
/*! Rule::       \\s+ */ 
 /*: skip whitespace */ 
break;
case 15 : 
/*! Conditions:: VALUE_MODE INITIAL */ 
/*! Rule::       . */ 
 yy.lexer.parseError("Don't know what to do with this: it's unsupported input: '" + yy_.yytext + "'");
            return 'error' 
break;
default:
  return this.simpleCaseActionClusters[yyrulenumber];
}
        }`,
  caseHelperInclude: `{

  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       {UNICODE_LETTER}+ */ 
   5 : 'MONTH',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       - */ 
   8 : '-',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       \\+ */ 
   9 : '+',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       \\/ */ 
   10 : '/',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       : */ 
   11 : ':',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       \\. */ 
   12 : '.',
  /*! Conditions:: VALUE_MODE INITIAL */ 
  /*! Rule::       $ */ 
   14 : 'EOF'
}`,
  rules: [
    {
      re: '/^(?:\\u0001)/',
      source: '^(?:\\u0001)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\u0001)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\u0002)/',
      source: '^(?:\\u0002)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\u0002)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\u0003)/',
      source: '^(?:\\u0003)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\u0003)',
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
    {
      re: '/^(?:$)/',
      source: '^(?:$)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:$)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\u0000-@\\[-`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])+)/',
      source: '^(?:([^\\u0000-@\\[-`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\u0000-@\\[-`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:((?:\\d+(?:\\.\\d*)?|\\.\\d+)))/',
      source: '^(?:((?:\\d+(?:\\.\\d*)?|\\.\\d+)))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:((?:\\d+(?:\\.\\d*)?|\\.\\d+)))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([\\d²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൘-൞൦-൸෦-෯๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꧰-꧹꩐-꩙꯰-꯹０-９])+)/',
      source: '^(?:([\\d²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൘-൞൦-൸෦-෯๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꧰-꧹꩐-꩙꯰-꯹０-９])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([\\d²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൘-൞൦-൸෦-෯๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꧰-꧹꩐-꩙꯰-꯹０-９])+)',
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
      re: '/^(?:\\s+)/',
      source: '^(?:\\s+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\s+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:$)/',
      source: '^(?:$)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:$)',
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
    ASCII_LETTER: {
      in_set: 'A-z',
      elsewhere: '[A-z]',
      raw: '[a-zA-z]',
    },
    UNICODE_LETTER: {
      in_set: 'A-Za-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-ٟٮ-ۓە-ۜۡ-ۭۨ-ۯۺ-ۼۿܐ-ܿݍ-ޱߊ-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣৰৱৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼ੰ-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൗൟ-ൣൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟෲෳก-ฺเ-ๆํກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍໜ-ໟༀཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-ဿၐ-ၢၥ-ၨၮ-ႆႎႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨛᨠ-ᩞᩡ-ᩴᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋᮀ-ᮩᮬ-ᮯᮺ-ᯥᯧ-ᯱᰀ-ᰵᱍ-ᱏᱚ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⒶ-ⓩⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧꡀ-ꡳꢀ-ꣃꣅꣲ-ꣷꣻꣽꤊ-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨶꩀ-ꩍꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ',
      elsewhere: '[^\\u0000-@\\[-`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]',
      raw: '[\\p{Alphabetic}]',
    },
    DIGIT: {
      in_set: '0-9²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൘-൞൦-൸෦-෯๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꧰-꧹꩐-꩙꯰-꯹０-９',
      elsewhere: '[\\d²³¹¼-¾٠-٩۰-۹߀-߉०-९০-৯৴-৹੦-੯૦-૯୦-୯୲-୷௦-௲౦-౯౸-౾೦-೯൘-൞൦-൸෦-෯๐-๙໐-໙༠-༳၀-၉႐-႙፩-፼ᛮ-ᛰ០-៩៰-៹᠐-᠙᥆-᥏᧐-᧚᪀-᪉᪐-᪙᭐-᭙᮰-᮹᱀-᱉᱐-᱙⁰⁴-⁹₀-₉⅐-ↂↅ-↉①-⒛⓪-⓿❶-➓⳽〇〡-〩〸-〺㆒-㆕㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿꘠-꘩ꛦ-ꛯ꠰-꠵꣐-꣙꤀-꤉꧐-꧙꧰-꧹꩐-꩙꯰-꯹０-９]',
      raw: '[\\p{Number}]',
    },
    WHITESPACE: {
      in_set: '\\s',
      elsewhere: '\\s',
      raw: '[\\s\\r\\n\\p{Separator}]',
    },
    BASIC_FLOATING_POINT_NUMBER: {
      in_set: {
        message: '[macro [BASIC_FLOATING_POINT_NUMBER] is unsuitable for use inside regex set expressions: "[(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)]"]',
        name: 'Error',
      },
      elsewhere: '(?:\\d+(?:\\.\\d*)?|\\.\\d+)',
      raw: '(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)',
    },
  },
  regular_rule_count: 9,
  simple_rule_count: 7,
  conditionStack: [
    'INITIAL',
  ],
  actionInclude: '',
  moduleInclude: `/*
 * This chunk is included in the parser object code,
 * following the 'init' code block that may be set in \`%{ ... %}\` at the top of this
 * grammar definition file.
 */



/* @const */ var DATE_MODE = 'D';
/* @const */ var TIME_MODE = 'T';
/* @const */ var VALUE_MODE = 'V';

var parseModeInitialized = 0;

function initParseMode(yy, parser_mode) {
    /*
     * The 'init phase' is always invoked for every parse invocation.
     *
     * At this point in time, nothing has happened yet: no token has
     * been lexed, no real statement has been parsed yet.
     */

    /*
     * Depending on parser mode we must push a 'magick marker' into the lexer stream
     * which is a hack offering a working alternative to having the parser generator
     * support multiple %start rules.
     */
    yy.lexer.pushState('PARSE_MODE_DETECTION');


    parseModeInitialized = 1;


    // prevent crash in lexer as the look-ahead activity in there may already have 
    // changed yytext to become another type (not string any more):
    //yy.lexer.yytext = yy.lexer.match;


    switch (parser_mode) {
    default:
        break;

    case DATE_MODE:
        yy.lexer.unput("\\u0001");
        break;

    case TIME_MODE:
        yy.lexer.unput("\\u0002");
        break;

    case VALUE_MODE:
        yy.lexer.unput("\\u0003");
        break;
    }
};





// Demo main() to showcase the use of this example:
parser.main = function () {
    // set up a custom parseError handler.
    //
    // Note that this one has an extra feature: it returns a special (truthy) 'parse value'
    // which will be returned by the parse() call when this handler was invoked: this is 
    // very useful to quickly make the parse process a known result even when errors have
    // occurred: 
    parser.parseError = function altParseError(msg, hash) {
        if (hash && hash.exception) {
            msg = hash.exception.message;
            //console.log('ex:', hash.exception, hash.exception.stack);
        }
        console.log("### ERROR: " + msg);
        return {
            error: 'parse error'
        };
    };

    // Because JISON doesn't reduce epsilon rules *before* the next non-epsilon rule is
    // inspected, i.e. JISON *always* fetches a single look-ahead token from the lexer,
    // and we cannot have that as we need to push back the parse mode marker *before*
    // anything is lexed in there, so we have to complicate this hack by hooking into
    // the lexer and making it spit out dummy tokens until we observe the parse mode
    // being set up via initParseMode() above...
    parser.lexer.options.pre_lex = function () {
        // This callback can return a token ID to prevent the lexer from munching any
        // input:
        if (!parseModeInitialized) {
            //console.log('pre_lex pre init --> DUMMY');
            return parser.symbols_['DUMMY'];
        }
        //console.log('pre_lex');
    };

    // And hook into setInput AI to reset the global flag...
    var si_f = parser.lexer.setInput;
    parser.lexer.setInput = function (input, yy) {
        parseModeInitialized = 0;

        console.log('setting input: ', input);
        
        return si_f.call(this, input, yy);
    };

    // End of fixup to make the hack work. 
    //
    // Compare this with the code in the faking-multiple-start-rules.jison example which
    // employs the pre_parse() API: that one is much cleaner than this!


    console.log('\\n\\nUsing number parse mode:\\n');

    var input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));



    console.log('\\n\\nUsing date parse mode:\\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));



    console.log('\\n\\nUsing time parse mode:\\n');

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));




    console.log('\\n\\nUsing DEFAULT parse mode:\\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    console.log('\\n\\nErrors in this mode:\\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));



}`,
  __in_rules_failure_analysis_mode__: false,
  exportSourceCode: {
    enabled: false,
  },
  is_custom_lexer: false,
}

        