
            
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
  xregexp: true,
  ranges: true,
  trackPosition: true,
  easy_keyword_rules: true
},
    JisonLexerError: JisonLexerError,
    performAction: function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            
var YYSTATE = YY_START;
switch(yyrulenumber) {
case 0 : 
/*! Conditions:: INITIAL macro options rules */ 
/*! Rule::       \/\/[^\r\n]* */ 
 /* skip single-line comment */ 
break;
case 1 : 
/*! Conditions:: INITIAL macro options rules */ 
/*! Rule::       \/\*[^]*?\*\/ */ 
 /* skip multi-line comment */ 
break;
case 2 : 
/*! Conditions:: action */ 
/*! Rule::       %\{([^]*?)%\} */ 
 yy_.yytext = this.matches[1];
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 3 : 
/*! Conditions:: action */ 
/*! Rule::       %include\b */ 
 if (yy.include_command_allowed) {
                                            // This is an include instruction in place of (part of) an action:
                                            this.pushState('options');
                                            return 'INCLUDE';
                                        } else {
                                            // TODO
                                            yy_.yyerror(rmCommonWS`
                                                %include statements must occur on a line on their own and cannot occur inside an %{...%} action code block.
                                                Its use is not permitted at this position.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
                                            return 'INCLUDE_PLACEMENT_ERROR';
                                        } 
break;
case 4 : 
/*! Conditions:: action */ 
/*! Rule::       \/\*[^]*?\*\/ */ 
 //yy.include_command_allowed = false; -- doesn't impact include-allowed state
                                        return 'ACTION_BODY' 
break;
case 5 : 
/*! Conditions:: action */ 
/*! Rule::       \/\/.* */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 6 : 
/*! Conditions:: action */ 
/*! Rule::       \| */ 
 if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yy_.yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        } 
break;
case 7 : 
/*! Conditions:: action */ 
/*! Rule::       %% */ 
 if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yy_.yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        } 
break;
case 8 : 
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
                                        return 'ACTION_BODY' 
break;
case 9 : 
/*! Conditions:: action */ 
/*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}"|'{QUOTED_STRING_CONTENT}'|`{ES2017_STRING_CONTENT}` */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 10 : 
/*! Conditions:: action */ 
/*! Rule::       [^/"'`|%\{\}{BR}{WS}]+ */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 11 : 
/*! Conditions:: action */ 
/*! Rule::       % */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 12 : 
/*! Conditions:: action */ 
/*! Rule::       \{ */ 
 yy.depth++;
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 13 : 
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
                                            return 'BRACKET_SURPLUS';
                                        } else {
                                            yy.depth--;
                                        }
                                        return 'ACTION_BODY' 
break;
case 14 : 
/*! Conditions:: action */ 
/*! Rule::       (?:[\s\r\n]*?){BR}+{WS}+(?=[^{WS}{BR}|]) */ 
 yy.include_command_allowed = true;
                                        return 'ACTION_BODY';           // keep empty lines as-is inside action code blocks. 
break;
case 16 : 
/*! Conditions:: action */ 
/*! Rule::       {BR} */ 
 if (yy.depth > 0) {
                                            yy.include_command_allowed = true;
                                            return 'ACTION_BODY';       // keep empty lines as-is inside action code blocks.
                                        } else {
                                            // end of action code chunk; allow parent mode to see this mode-terminating linebreak too.
                                            this.popState();
                                            this.unput(yy_.yytext);
                                            return 'ACTION_END';
                                        } 
break;
case 17 : 
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
                                            return 'BRACKET_MISSING';
                                        }
                                        this.popState();
                                        return 'ACTION_END' 
break;
case 18 : 
/*! Conditions:: INITIAL rules options */ 
/*! Rule::       [%\{]\{+ */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');

                                        // Make sure we've the proper lexer rule regex active for any possible `%{...%}`, `{{...}}` or what have we here?
                                        this.setupDelimitedActionChunkLexerRegex(yy_.yytext, yy);

                                        // Allow the start marker to be re-matched by the generated lexer rule regex:
                                        this.unput(yy_.yytext);

                                        // and allow the next lexer round to match and execute the suitable lexer rule(s) to parse this incoming action code block. 
                                        return 'ACTION_START' 
break;
case 19 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       -> */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START' 
break;
case 20 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       → */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START' 
break;
case 21 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       => */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START' 
break;
case 22 : 
/*! Conditions:: rules */ 
/*! Rule::       {WS}+(?=[^{WS}{BR}|]) */ 
 yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        return 'ACTION_START' 
break;
case 23 : 
/*! Conditions:: rules */ 
/*! Rule::       %% */ 
 this.popState();
                                        this.pushState('code');
                                        return '%%' 
break;
case 24 : 
/*! Conditions:: rules */ 
/*! Rule::       $ */ 
 this.popState();
                                        this.pushState('code');
                                        return '%%' 
break;
case 29 : 
/*! Conditions:: options */ 
/*! Rule::       %% */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'OPTIONS_END' 
break;
case 30 : 
/*! Conditions:: options */ 
/*! Rule::       %include\b */ 
 yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the `<action>` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yy_.yytext);
                                        return 'ACTION_START' 
break;
case 31 : 
/*! Conditions:: options */ 
/*! Rule::       > */ 
 this.popState();
                                        this.unput(yy_.yytext);     
                                        return 'OPTIONS_END' 
break;
case 34 : 
/*! Conditions:: options */ 
/*! Rule::       <{ID}> */ 
 yy_.yytext = this.matches[1];
                                        return 'TOKEN_TYPE' 
break;
case 36 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}{WS}+(?=\S) */ 
 /* ignore */ 
break;
case 37 : 
/*! Conditions:: options */ 
/*! Rule::       {BR} */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'OPTIONS_END' 
break;
case 38 : 
/*! Conditions:: options */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 39 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {ID} */ 
 this.pushState('macro');
                                        return 'MACRO_NAME' 
break;
case 40 : 
/*! Conditions:: macro */ 
/*! Rule::       {BR}+ */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'MACRO_END' 
break;
case 41 : 
/*! Conditions:: macro */ 
/*! Rule::       $ */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'MACRO_END' 
break;
case 42 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       {BR}+ */ 
 /* skip newlines */ 
break;
case 43 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 47 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       {ANY_LITERAL_CHAR}+ */ 
 // accept any non-regex, non-lex, non-string-delim,
                                        // non-escape-starter, non-space character as-is
                                        return 'CHARACTER_LIT' 
break;
case 48 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \[ */ 
 this.pushState('set');
                                        return 'REGEX_SET_START' 
break;
case 63 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       < */ 
 this.pushState('options');
                                        return '<' 
break;
case 65 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \/! */ 
 return '/!';                    // treated as `(?!atom)` 
break;
case 66 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \/ */ 
 return '/';                     // treated as `(?=atom)` 
break;
case 68 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\(?:([0-7]{1,3})|c([@A-Z])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]{1,8})\}) */ 
 var m = this.matches;
                                            yy_.yytext = NaN;
                                            if (m[1]) {
                                                // [1]: octal char: `\012` --> \x0A
                                                var v = parseInt(m[1], 8);
                                                yy_.yytext = v;
                                            }
                                            else if (m[2]) {
                                                // [2]: CONTROL char: `\cA` --> \u0001
                                                var v = m[2].charCodeAt(0) - 64;
                                                yy_.yytext = v;
                                            }
                                            else if (m[3]) {
                                                // [3]: hex char: `\x41` --> A
                                                var v = parseInt(m[3], 16);
                                                yy_.yytext = v;
                                            }
                                            else if (m[4]) {
                                                // [4]: unicode/UTS2 char: `\u03c0` --> PI
                                                var v = parseInt(m[4], 16);
                                                yy_.yytext = v;
                                            }
                                            else if (m[5]) {
                                                // [5]: unicode code point: `\u{00003c0}` --> PI
                                                var v = parseInt(m[5], 16);
                                                yy_.yytext = v;
                                            }
                                            return 'ESCAPED_CHAR' 
break;
case 69 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\. */ 
 yy_.yytext = yy_.yytext.substring(1);
                                        return 'CHARACTER_LIT' 
break;
case 72 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %option[s]? */ 
 this.pushState('options');
                                        return 'OPTIONS' 
break;
case 73 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %s\b */ 
 this.pushState('options');
                                        return 'START_INC' 
break;
case 74 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %x\b */ 
 this.pushState('options');
                                        return 'START_EXC' 
break;
case 75 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %code\b */ 
 this.pushState('options');
                                        return 'CODE' 
break;
case 76 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %import\b */ 
 this.pushState('options');
                                        return 'IMPORT' 
break;
case 77 : 
/*! Conditions:: INITIAL rules code */ 
/*! Rule::       %include\b */ 
 yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the `<action>` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yy_.yytext);
                                        return 'ACTION_START' 
break;
case 78 : 
/*! Conditions:: INITIAL rules code */ 
/*! Rule::       %{NAME}([^\r\n]*) */ 
 /* ignore unrecognized decl */
                                            this.warn(rmCommonWS`
                                                ignoring unsupported lexer option ${dquote(yy_.yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yy_.yylloc));
                                            yy_.yytext = {
                                                name: this.matches[1],              // {NAME}
                                                value: this.matches[2].trim()       // optional value/parameters
                                            };
                                            return 'UNKNOWN_DECL' 
break;
case 79 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %% */ 
 this.pushState('rules');
                                        return '%%' 
break;
case 87 : 
/*! Conditions:: set */ 
/*! Rule::       \] */ 
 this.popState();
                                        return 'REGEX_SET_END' 
break;
case 89 : 
/*! Conditions:: code */ 
/*! Rule::       [^{BR}]+ */ 
 return 'CODE';      // the bit of CODE just before EOF... 
break;
case 90 : 
/*! Conditions:: action */ 
/*! Rule::       " */ 
 yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 91 : 
/*! Conditions:: action */ 
/*! Rule::       ' */ 
 yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 92 : 
/*! Conditions:: action */ 
/*! Rule::       ` */ 
 yy_.yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 93 : 
/*! Conditions:: options */ 
/*! Rule::       " */ 
 yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 94 : 
/*! Conditions:: options */ 
/*! Rule::       ' */ 
 yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 95 : 
/*! Conditions:: options */ 
/*! Rule::       ` */ 
 yy_.yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 96 : 
/*! Conditions:: * */ 
/*! Rule::       " */ 
 var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 97 : 
/*! Conditions:: * */ 
/*! Rule::       ' */ 
 var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 98 : 
/*! Conditions:: * */ 
/*! Rule::       ` */ 
 var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 99 : 
/*! Conditions:: macro rules */ 
/*! Rule::       . */ 
 /* b0rk on bad characters */
                                        var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
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
                                        return 'error' 
break;
case 100 : 
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
                                        return 'error' 
break;
case 101 : 
/*! Conditions:: * */ 
/*! Rule::       . */ 
 yy_.yyerror(rmCommonWS`
                                            unsupported lexer input: ${dquote(yy_.yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yy_.yylloc));
                                        return 'error' 
break;
default:
  return this.simpleCaseActionClusters[yyrulenumber];
}
        },
    simpleCaseActionClusters: {

  /*! Conditions:: action */ 
  /*! Rule::       {WS}+ */ 
   15 : 'ACTION_BODY',
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   25 : '=',
  /*! Conditions:: options */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   26 : 'OPTION_STRING',
  /*! Conditions:: options */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   27 : 'OPTION_STRING',
  /*! Conditions:: options */ 
  /*! Rule::       `{ES2017_STRING_CONTENT}` */ 
   28 : 'OPTION_STRING',
  /*! Conditions:: options */ 
  /*! Rule::       , */ 
   32 : ',',
  /*! Conditions:: options */ 
  /*! Rule::       \* */ 
   33 : '*',
  /*! Conditions:: options */ 
  /*! Rule::       {ANY_LITERAL_CHAR}+ */ 
   35 : 'OPTION_VALUE',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   44 : 'STRING_LIT',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   45 : 'STRING_LIT',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       `{ES2017_STRING_CONTENT}` */ 
   46 : 'STRING_LIT',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \| */ 
   49 : '|',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \(\?: */ 
   50 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \(\?= */ 
   51 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \(\?! */ 
   52 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \(\?<= */ 
   53 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \(\?<! */ 
   54 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \( */ 
   55 : '(',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \) */ 
   56 : ')',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \+ */ 
   57 : '+',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \* */ 
   58 : '*',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \? */ 
   59 : '?',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \^ */ 
   60 : '^',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       , */ 
   61 : ',',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       <<EOF>> */ 
   62 : '$',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       > */ 
   64 : '>',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\(?:[sSbBwWdDpP]|[rfntv\\*+()${}|[\]\/.^?]) */ 
   67 : 'REGEX_SPECIAL_CHAR',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \$ */ 
   70 : '$',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \. */ 
   71 : '.',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \{\d+(,\s*\d+|,)?\} */ 
   80 : 'RANGE_REGEX',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \{{ID}\} */ 
   81 : 'NAME_BRACE',
  /*! Conditions:: set options */ 
  /*! Rule::       \{{ID}\} */ 
   82 : 'NAME_BRACE',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \{ */ 
   83 : '{',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \} */ 
   84 : '}',
  /*! Conditions:: set */ 
  /*! Rule::       (?:\\[^{BR}]|[^\]{])+ */ 
   85 : 'REGEX_SET',
  /*! Conditions:: set */ 
  /*! Rule::       \{ */ 
   86 : 'REGEX_SET',
  /*! Conditions:: code */ 
  /*! Rule::       [^{BR}]*{BR}+ */ 
   88 : 'CODE',
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   102 : 'EOF'
},
    rules: [
        /*   0: */  /^(?:\/\/[^\r\n]*)/,
/*   1: */  /^(?:\/\*[\s\S]*?\*\/)/,
/*   2: */  /^(?:%\{([\s\S]*?)%\})/,
/*   3: */  /^(?:%include\b)/,
/*   4: */  /^(?:\/\*[\s\S]*?\*\/)/,
/*   5: */  /^(?:\/\/.*)/,
/*   6: */  /^(?:\|)/,
/*   7: */  /^(?:%%)/,
/*   8: */  /^(?:\/.*)/,
/*   9: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)"|'((?:\\'|\\[^']|[^\n\r'\\])*)'|`((?:\\`|\\[^`]|[^\\`])*)`)/,
/*  10: */  /^(?:[^\s"%'\/`{-}]+)/,
/*  11: */  /^(?:%)/,
/*  12: */  /^(?:\{)/,
/*  13: */  /^(?:\})/,
/*  14: */  /^(?:(?:\s*?)(\r\n|\n|\r)+([^\S\n\r])+(?=[^\s|]))/,
/*  15: */  /^(?:([^\S\n\r])+)/,
/*  16: */  /^(?:(\r\n|\n|\r))/,
/*  17: */  /^(?:$)/,
/*  18: */  /^(?:[%{]\{+)/,
/*  19: */  /^(?:->)/,
/*  20: */  /^(?:→)/,
/*  21: */  /^(?:=>)/,
/*  22: */  /^(?:([^\S\n\r])+(?=[^\s|]))/,
/*  23: */  /^(?:%%)/,
/*  24: */  /^(?:$)/,
/*  25: */  /^(?:=)/,
/*  26: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
/*  27: */  /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
/*  28: */  /^(?:`((?:\\`|\\[^`]|[^\\`])*)`)/,
/*  29: */  /^(?:%%)/,
/*  30: */  /^(?:%include\b)/,
/*  31: */  /^(?:>)/,
/*  32: */  /^(?:,)/,
/*  33: */  /^(?:\*)/,
/*  34: */  /^(?:<([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])*)>)/,
/*  35: */  /^(?:([^\s!"$%'-,.\/:-?\[-\^`{-}])+)/,
/*  36: */  /^(?:(\r\n|\n|\r)([^\S\n\r])+(?=\S))/,
/*  37: */  /^(?:(\r\n|\n|\r))/,
/*  38: */  /^(?:([^\S\n\r])+)/,
/*  39: */  /^(?:([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])*))/,
/*  40: */  /^(?:(\r\n|\n|\r)+)/,
/*  41: */  /^(?:$)/,
/*  42: */  /^(?:(\r\n|\n|\r)+)/,
/*  43: */  /^(?:([^\S\n\r])+)/,
/*  44: */  /^(?:"((?:\\"|\\[^"]|[^\n\r"\\])*)")/,
/*  45: */  /^(?:'((?:\\'|\\[^']|[^\n\r'\\])*)')/,
/*  46: */  /^(?:`((?:\\`|\\[^`]|[^\\`])*)`)/,
/*  47: */  /^(?:([^\s!"$%'-,.\/:-?\[-\^`{-}])+)/,
/*  48: */  /^(?:\[)/,
/*  49: */  /^(?:\|)/,
/*  50: */  /^(?:\(\?:)/,
/*  51: */  /^(?:\(\?=)/,
/*  52: */  /^(?:\(\?!)/,
/*  53: */  /^(?:\(\?<=)/,
/*  54: */  /^(?:\(\?<!)/,
/*  55: */  /^(?:\()/,
/*  56: */  /^(?:\))/,
/*  57: */  /^(?:\+)/,
/*  58: */  /^(?:\*)/,
/*  59: */  /^(?:\?)/,
/*  60: */  /^(?:\^)/,
/*  61: */  /^(?:,)/,
/*  62: */  /^(?:<<EOF>>)/,
/*  63: */  /^(?:<)/,
/*  64: */  /^(?:>)/,
/*  65: */  /^(?:\/!)/,
/*  66: */  /^(?:\/)/,
/*  67: */  /^(?:\\(?:[BDPSWbdpsw]|[$(-+.\/?\[-\^fnrtv{-}]))/,
/*  68: */  /^(?:\\(?:([0-7]{1,3})|c([@-Z])|x([\dA-Fa-f]{2})|u([\dA-Fa-f]{4})|u\{([\dA-Fa-f]{1,8})\}))/,
/*  69: */  /^(?:\\.)/,
/*  70: */  /^(?:\$)/,
/*  71: */  /^(?:\.)/,
/*  72: */  /^(?:%option[s]?)/,
/*  73: */  /^(?:%s\b)/,
/*  74: */  /^(?:%x\b)/,
/*  75: */  /^(?:%code\b)/,
/*  76: */  /^(?:%import\b)/,
/*  77: */  /^(?:%include\b)/,
/*  78: */  /^(?:%([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-,.\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]*(?:[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff]))?)([^\n\r]*))/,
/*  79: */  /^(?:%%)/,
/*  80: */  /^(?:\{\d+(,\s*\d+|,)?\})/,
/*  81: */  /^(?:\{([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])*)\})/,
/*  82: */  /^(?:\{([^\u0000-@\[-\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff](?:[^\u0000-\/:-@\[-\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\uffff])*)\})/,
/*  83: */  /^(?:\{)/,
/*  84: */  /^(?:\})/,
/*  85: */  /^(?:(?:\\[^\n\r]|[^\]{])+)/,
/*  86: */  /^(?:\{)/,
/*  87: */  /^(?:\])/,
/*  88: */  /^(?:[^\n\r]*(\r\n|\n|\r)+)/,
/*  89: */  /^(?:[^\n\r]+)/,
/*  90: */  /^(?:")/,
/*  91: */  /^(?:')/,
/*  92: */  /^(?:`)/,
/*  93: */  /^(?:")/,
/*  94: */  /^(?:')/,
/*  95: */  /^(?:`)/,
/*  96: */  /^(?:")/,
/*  97: */  /^(?:')/,
/*  98: */  /^(?:`)/,
/*  99: */  /^(?:.)/,
/* 100: */  /^(?:.)/,
/* 101: */  /^(?:.)/,
/* 102: */  /^(?:$)/
    ],
    conditions: {
  "rules": {
    rules: [
      0,
      1,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
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
      83,
      84,
      96,
      97,
      98,
      99,
      101,
      102
    ],
    inclusive: true
  },
  "macro": {
    rules: [
      0,
      1,
      19,
      20,
      21,
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
      79,
      80,
      81,
      83,
      84,
      96,
      97,
      98,
      99,
      101,
      102
    ],
    inclusive: true
  },
  "code": {
    rules: [
      77,
      78,
      88,
      89,
      96,
      97,
      98,
      101,
      102
    ],
    inclusive: false
  },
  "options": {
    rules: [
      0,
      1,
      18,
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
      82,
      93,
      94,
      95,
      96,
      97,
      98,
      100,
      101,
      102
    ],
    inclusive: false
  },
  "action": {
    rules: [
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
      90,
      91,
      92,
      96,
      97,
      98,
      101,
      102
    ],
    inclusive: false
  },
  "set": {
    rules: [
      82,
      85,
      86,
      87,
      96,
      97,
      98,
      101,
      102
    ],
    inclusive: false
  },
  "INITIAL": {
    rules: [
      0,
      1,
      18,
      19,
      20,
      21,
      39,
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
      83,
      84,
      96,
      97,
      98,
      101,
      102
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
          'INITIAL',
          'macro',
          'options',
          'rules',
        ],
        '\\/\\/[^\\r\\n]*',
        '/* skip single-line comment */',
      ],
      [
        [
          'INITIAL',
          'macro',
          'options',
          'rules',
        ],
        '\\/\\*[^]*?\\*\\/',
        '/* skip multi-line comment */',
      ],
      [
        [
          'action',
        ],
        '%\\{([^]*?)%\\}',
        `yytext = this.matches[1];
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY'`,
      ],
      [
        [
          'action',
        ],
        '%include\\b',
        `if (yy.include_command_allowed) {
                                            // This is an include instruction in place of (part of) an action:
                                            this.pushState('options');
                                            return 'INCLUDE';
                                        } else {
                                            // TODO
                                            yyerror(rmCommonWS\`
                                                %include statements must occur on a line on their own and cannot occur inside an %{...%} action code block.
                                                Its use is not permitted at this position.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yylloc));
                                            return 'INCLUDE_PLACEMENT_ERROR';
                                        }`,
      ],
      [
        [
          'action',
        ],
        '\\/\\*[^]*?\\*\\/',
        `//yy.include_command_allowed = false; -- doesn't impact include-allowed state
                                        return 'ACTION_BODY'`,
      ],
      [
        [
          'action',
        ],
        '\\/\\/.*',
        "yy.include_command_allowed = false;\n                                        return 'ACTION_BODY'",
      ],
      [
        [
          'action',
        ],
        '\\|',
        `if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        }`,
      ],
      [
        [
          'action',
        ],
        '%%',
        `if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        }`,
      ],
      [
        [
          'action',
        ],
        '\\/.*',
        `yy.include_command_allowed = false;
                                        var l = scanRegExp(yytext);
                                        if (l > 0) {
                                            this.unput(yytext.substring(l));
                                            yytext = yytext.substring(0, l);
                                        } else {
                                            // assume it's a division operator:
                                            this.unput(yytext.substring(1));
                                            yytext = yytext[0];
                                        }
                                        return 'ACTION_BODY'`,
      ],
      [
        [
          'action',
        ],
        '"{DOUBLEQUOTED_STRING_CONTENT}"|\'{QUOTED_STRING_CONTENT}\'|`{ES2017_STRING_CONTENT}`',
        "yy.include_command_allowed = false;\n                                        return 'ACTION_BODY'",
      ],
      [
        [
          'action',
        ],
        '[^/"\'`|%\\{\\}{BR}{WS}]+',
        "yy.include_command_allowed = false;\n                                        return 'ACTION_BODY'",
      ],
      [
        [
          'action',
        ],
        '%',
        "yy.include_command_allowed = false;\n                                        return 'ACTION_BODY'",
      ],
      [
        [
          'action',
        ],
        '\\{',
        `yy.depth++;
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY'`,
      ],
      [
        [
          'action',
        ],
        '\\}',
        `yy.include_command_allowed = false;
                                        if (yy.depth <= 0) {
                                            yyerror(rmCommonWS\`
                                                too many closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yylloc));
                                            return 'BRACKET_SURPLUS';
                                        } else {
                                            yy.depth--;
                                        }
                                        return 'ACTION_BODY'`,
      ],
      [
        [
          'action',
        ],
        '(?:[\\s\\r\\n]*?){BR}+{WS}+(?=[^{WS}{BR}|])',
        "yy.include_command_allowed = true;\n                                        return 'ACTION_BODY';           // keep empty lines as-is inside action code blocks.",
      ],
      [
        [
          'action',
        ],
        '{WS}+',
        "return 'ACTION_BODY'",
      ],
      [
        [
          'action',
        ],
        '{BR}',
        `if (yy.depth > 0) {
                                            yy.include_command_allowed = true;
                                            return 'ACTION_BODY';       // keep empty lines as-is inside action code blocks.
                                        } else {
                                            // end of action code chunk; allow parent mode to see this mode-terminating linebreak too.
                                            this.popState();
                                            this.unput(yytext);
                                            return 'ACTION_END';
                                        }`,
      ],
      [
        [
          'action',
        ],
        '$',
        `yy.include_command_allowed = false;
                                        if (yy.depth !== 0) {
                                            yyerror(rmCommonWS\`
                                                missing ${yy.depth} closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yylloc));
                                            return 'BRACKET_MISSING';
                                        }
                                        this.popState();
                                        return 'ACTION_END'`,
      ],
      [
        [
          'INITIAL',
          'rules',
          'options',
        ],
        '[%\\{]\\{+',
        `yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');

                                        // Make sure we've the proper lexer rule regex active for any possible \`%{...%}\`, \`{{...}}\` or what have we here?
                                        this.setupDelimitedActionChunkLexerRegex(yytext, yy);

                                        // Allow the start marker to be re-matched by the generated lexer rule regex:
                                        this.unput(yytext);

                                        // and allow the next lexer round to match and execute the suitable lexer rule(s) to parse this incoming action code block. 
                                        return 'ACTION_START'`,
      ],
      [
        '->',
        `yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START'`,
      ],
      [
        '→',
        `yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START'`,
      ],
      [
        '=>',
        `yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START'`,
      ],
      [
        [
          'rules',
        ],
        '{WS}+(?=[^{WS}{BR}|])',
        `yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        return 'ACTION_START'`,
      ],
      [
        [
          'rules',
        ],
        '%%',
        `this.popState();
                                        this.pushState('code');
                                        return '%%'`,
      ],
      [
        [
          'rules',
        ],
        '$',
        `this.popState();
                                        this.pushState('code');
                                        return '%%'`,
      ],
      [
        [
          'options',
        ],
        '=',
        "return '='",
      ],
      [
        [
          'options',
        ],
        '"{DOUBLEQUOTED_STRING_CONTENT}"',
        "return 'OPTION_STRING'",
      ],
      [
        [
          'options',
        ],
        "'{QUOTED_STRING_CONTENT}'",
        "return 'OPTION_STRING'",
      ],
      [
        [
          'options',
        ],
        '`{ES2017_STRING_CONTENT}`',
        "return 'OPTION_STRING'",
      ],
      [
        [
          'options',
        ],
        '%%',
        `this.popState();
                                        this.unput(yytext);
                                        return 'OPTIONS_END'`,
      ],
      [
        [
          'options',
        ],
        '%include\\b',
        `yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the \`<action>\` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yytext);
                                        return 'ACTION_START'`,
      ],
      [
        [
          'options',
        ],
        '>',
        `this.popState();
                                        this.unput(yytext);     
                                        return 'OPTIONS_END'`,
      ],
      [
        [
          'options',
        ],
        ',',
        "return ','",
      ],
      [
        [
          'options',
        ],
        '\\*',
        "return '*'",
      ],
      [
        [
          'options',
        ],
        '<{ID}>',
        "yytext = this.matches[1];\n                                        return 'TOKEN_TYPE'",
      ],
      [
        [
          'options',
        ],
        '{ANY_LITERAL_CHAR}+',
        "return 'OPTION_VALUE'",
      ],
      [
        [
          'options',
        ],
        '{BR}{WS}+(?=\\S)',
        '/* ignore */',
      ],
      [
        [
          'options',
        ],
        '{BR}',
        `this.popState();
                                        this.unput(yytext);
                                        return 'OPTIONS_END'`,
      ],
      [
        [
          'options',
        ],
        '{WS}+',
        '/* skip whitespace */',
      ],
      [
        [
          'INITIAL',
        ],
        '{ID}',
        `this.pushState('macro');
                                        return 'MACRO_NAME'`,
      ],
      [
        [
          'macro',
        ],
        '{BR}+',
        `this.popState();
                                        this.unput(yytext);
                                        return 'MACRO_END'`,
      ],
      [
        [
          'macro',
        ],
        '$',
        `this.popState();
                                        this.unput(yytext);
                                        return 'MACRO_END'`,
      ],
      [
        '{BR}+',
        '/* skip newlines */',
      ],
      [
        '{WS}+',
        '/* skip whitespace */',
      ],
      [
        '"{DOUBLEQUOTED_STRING_CONTENT}"',
        "return 'STRING_LIT'",
      ],
      [
        "'{QUOTED_STRING_CONTENT}'",
        "return 'STRING_LIT'",
      ],
      [
        '`{ES2017_STRING_CONTENT}`',
        "return 'STRING_LIT'",
      ],
      [
        '{ANY_LITERAL_CHAR}+',
        `// accept any non-regex, non-lex, non-string-delim,
                                        // non-escape-starter, non-space character as-is
                                        return 'CHARACTER_LIT'`,
      ],
      [
        '\\[',
        `this.pushState('set');
                                        return 'REGEX_SET_START'`,
      ],
      [
        '\\|',
        "return '|'",
      ],
      [
        '\\(\\?:',
        "return 'SPECIAL_GROUP'",
      ],
      [
        '\\(\\?=',
        "return 'SPECIAL_GROUP'",
      ],
      [
        '\\(\\?!',
        "return 'SPECIAL_GROUP'",
      ],
      [
        '\\(\\?<=',
        "return 'SPECIAL_GROUP'",
      ],
      [
        '\\(\\?<!',
        "return 'SPECIAL_GROUP'",
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
        '\\+',
        "return '+'",
      ],
      [
        '\\*',
        "return '*'",
      ],
      [
        '\\?',
        "return '?'",
      ],
      [
        '\\^',
        "return '^'",
      ],
      [
        ',',
        "return ','",
      ],
      [
        '<<EOF>>',
        "return '$'",
      ],
      [
        '<',
        `this.pushState('options');
                                        return '<'`,
      ],
      [
        '>',
        "return '>'",
      ],
      [
        '\\/!',
        "return '/!';                    // treated as `(?!atom)`",
      ],
      [
        '\\/',
        "return '/';                     // treated as `(?=atom)`",
      ],
      [
        '\\\\(?:[sSbBwWdDpP]|[rfntv\\\\*+()${}|[\\]\\/.^?])',
        "return 'REGEX_SPECIAL_CHAR'",
      ],
      [
        '\\\\(?:([0-7]{1,3})|c([@A-Z])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\\{([0-9a-fA-F]{1,8})\\})',
        `var m = this.matches;
                                            yytext = NaN;
                                            if (m[1]) {
                                                // [1]: octal char: \`\\012\` --> \\x0A
                                                var v = parseInt(m[1], 8);
                                                yytext = v;
                                            }
                                            else if (m[2]) {
                                                // [2]: CONTROL char: \`\\cA\` --> \\u0001
                                                var v = m[2].charCodeAt(0) - 64;
                                                yytext = v;
                                            }
                                            else if (m[3]) {
                                                // [3]: hex char: \`\\x41\` --> A
                                                var v = parseInt(m[3], 16);
                                                yytext = v;
                                            }
                                            else if (m[4]) {
                                                // [4]: unicode/UTS2 char: \`\\u03c0\` --> PI
                                                var v = parseInt(m[4], 16);
                                                yytext = v;
                                            }
                                            else if (m[5]) {
                                                // [5]: unicode code point: \`\\u{00003c0}\` --> PI
                                                var v = parseInt(m[5], 16);
                                                yytext = v;
                                            }
                                            return 'ESCAPED_CHAR'`,
      ],
      [
        '\\\\.',
        "yytext = yytext.substring(1);\n                                        return 'CHARACTER_LIT'",
      ],
      [
        '\\$',
        "return '$'",
      ],
      [
        '\\.',
        "return '.'",
      ],
      [
        '%option[s]?',
        `this.pushState('options');
                                        return 'OPTIONS'`,
      ],
      [
        '%s\\b',
        `this.pushState('options');
                                        return 'START_INC'`,
      ],
      [
        '%x\\b',
        `this.pushState('options');
                                        return 'START_EXC'`,
      ],
      [
        '%code\\b',
        `this.pushState('options');
                                        return 'CODE'`,
      ],
      [
        '%import\\b',
        `this.pushState('options');
                                        return 'IMPORT'`,
      ],
      [
        [
          'INITIAL',
          'rules',
          'code',
        ],
        '%include\\b',
        `yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the \`<action>\` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yytext);
                                        return 'ACTION_START'`,
      ],
      [
        [
          'INITIAL',
          'rules',
          'code',
        ],
        '%{NAME}([^\\r\\n]*)',
        `/* ignore unrecognized decl */
                                            this.warn(rmCommonWS\`
                                                ignoring unsupported lexer option ${dquote(yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yylloc));
                                            yytext = {
                                                name: this.matches[1],              // {NAME}
                                                value: this.matches[2].trim()       // optional value/parameters
                                            };
                                            return 'UNKNOWN_DECL'`,
      ],
      [
        '%%',
        `this.pushState('rules');
                                        return '%%'`,
      ],
      [
        '\\{\\d+(,\\s*\\d+|,)?\\}',
        "return 'RANGE_REGEX'",
      ],
      [
        '\\{{ID}\\}',
        "return 'NAME_BRACE'",
      ],
      [
        [
          'set',
          'options',
        ],
        '\\{{ID}\\}',
        "return 'NAME_BRACE'",
      ],
      [
        '\\{',
        "return '{'",
      ],
      [
        '\\}',
        "return '}'",
      ],
      [
        [
          'set',
        ],
        '(?:\\\\[^{BR}]|[^\\]{])+',
        "return 'REGEX_SET'",
      ],
      [
        [
          'set',
        ],
        '\\{',
        "return 'REGEX_SET'",
      ],
      [
        [
          'set',
        ],
        '\\]',
        "this.popState();\n                                        return 'REGEX_SET_END'",
      ],
      [
        [
          'code',
        ],
        '[^{BR}]*{BR}+',
        "return 'CODE'",
      ],
      [
        [
          'code',
        ],
        '[^{BR}]+',
        "return 'CODE';      // the bit of CODE just before EOF...",
      ],
      [
        [
          'action',
        ],
        '"',
        `yyerror(rmCommonWS\`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          'action',
        ],
        "'",
        `yyerror(rmCommonWS\`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          'action',
        ],
        '`',
        `yyerror(rmCommonWS\`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          'options',
        ],
        '"',
        `yyerror(rmCommonWS\`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          'options',
        ],
        "'",
        `yyerror(rmCommonWS\`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          'options',
        ],
        '`',
        `yyerror(rmCommonWS\`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          '*',
        ],
        '"',
        `var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yyerror(rmCommonWS\`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          '*',
        ],
        "'",
        `var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yyerror(rmCommonWS\`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          '*',
        ],
        '`',
        `var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yyerror(rmCommonWS\`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR'`,
      ],
      [
        [
          'macro',
          'rules',
        ],
        '.',
        `/* b0rk on bad characters */
                                        var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yyerror(rmCommonWS\`
                                            unsupported lexer input encountered while lexing
                                            ${rules} (i.e. jison lex regexes) in ${dquote(this.topState())} state.

                                                NOTE: When you want this input to be interpreted as a LITERAL part
                                                      of a lex rule regex, you MUST enclose it in double or
                                                      single quotes.

                                                      If not, then know that this input is not accepted as a valid
                                                      regex expression here in jison-lex ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'error'`,
      ],
      [
        [
          'options',
        ],
        '.',
        `yyerror(rmCommonWS\`
                                            unsupported lexer input: ${dquote(yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                            If this input was intentional, you might want to put quotes around
                                            it; any JavaScript string quoting style is accepted (single quotes,
                                            double quotes *or* backtick quotes a la ES6 string templates).

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'error'`,
      ],
      [
        [
          '*',
        ],
        '.',
        `yyerror(rmCommonWS\`
                                            unsupported lexer input: ${dquote(yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yylloc));
                                        return 'error'`,
      ],
      [
        [
          '*',
        ],
        '$',
        "return 'EOF'",
      ],
    ],
    moduleInclude: `var rmCommonWS = helpers.rmCommonWS;
var dquote     = helpers.dquote;
var scanRegExp = helpers.scanRegExp;






lexer.setupDelimitedActionChunkLexerRegex = function lexer__setupDelimitedActionChunkLexerRegex(yytext, yy) {
    // Calculate the end marker to match and produce a
    // lexer rule to match when the need arrises:
    var marker = yytext;
    // Special: when we encounter \`{\` as the start of the action code block,
    // we NIL the \`%{...%}\` lexer rule by just using that one:
    if (marker === '{') {
        marker = '%{';
    }
    var action_end_marker = marker.replace(/\\{/g, '}');

    // Note: this bit comes straight from the lexer kernel!
    // Get us the currently active set of lexer rules. 
    // (This is why we push the 'action' lexer condition state above *before*
    // we commence and work on the ruleset itself.)
    var spec = this.__currentRuleSet__;
    if (!spec) {
        // Update the ruleset cache as we apparently encountered a state change or just started lexing.
        // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
        // invoke the \`lex()\` token-producing API and related APIs, hence caching the set for direct access helps
        // speed up those activities a tiny bit.
        spec = this.__currentRuleSet__ = this._currentRules();
    }

    var rules = spec.rules;
    var i, len;
    var action_chunk_regex;

    // Must we still locate the rule to patch or have we done 
    // that already during a previous encounter?
    if (!yy.action_chunk_rule_idx) {
        // **WARNING**: *(this bit comes straight from the lexer kernel)*
        //
        // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in \`lexer_next()\` fast and simple!
        for (i = 1, len = rules.length; i < len; i++) {
            var rule_re = rules[i];
            if (rule_re.toString() === '^(?:%\\\\{([^]*?)%\\\\})') {
                yy.action_chunk_rule_idx = i;
                break;
            }
        }

        // As we haven't initialized yet, we're sure the rule cache doesn't exist either.
        // Make it happen:
        yy.cached_action_chunk_rule = {};   // set up empty cache
    }

    i = yy.action_chunk_rule_idx;

    // Must we build the lexer rule or did we already run this variant 
    // through this lexer before? 
    // If so, fetch the cached version!
    action_chunk_regex = yy.cached_action_chunk_rule[marker];
    if (!action_chunk_regex) {
        action_chunk_regex = yy.cached_action_chunk_rule[marker] = new RegExp('^(?:' + marker.replace(/\\{/g, '\\\\{') + '([^]*?)' + action_end_marker.replace(/\\}/g, '\\\\}') + ')');
    }
    rules[i] = action_chunk_regex;
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
}`,
    macros: {
      ASCII_LETTER: '[a-zA-z]',
      UNICODE_LETTER: '[\\p{Alphabetic}]',
      ALPHA: '[{UNICODE_LETTER}_]',
      DIGIT: '[\\p{Number}]',
      WHITESPACE: '[\\s\\r\\n\\p{Separator}]',
      ALNUM: '[{ALPHA}{DIGIT}]',
      NAME: '[{ALPHA}](?:[{ALNUM}-]*{ALNUM})?',
      ID: '[{ALPHA}]{ALNUM}*',
      DECIMAL_NUMBER: '[1-9][0-9]*',
      HEX_NUMBER: '0[xX][0-9a-fA-F]+',
      BR: '\\r\\n|\\n|\\r',
      WS: '[^\\S\\r\\n]',
      QUOTED_STRING_CONTENT: `(?:\\\\'|\\\\[^\\']|[^\\\\\\'\\r\\n])*`,
      DOUBLEQUOTED_STRING_CONTENT: `(?:\\\\"|\\\\[^\\"]|[^\\\\\\"\\r\\n])*`,
      ES2017_STRING_CONTENT: '(?:\\\\`|\\\\[^\\`]|[^\\\\\\`])*',
      ANY_LITERAL_CHAR: '[^\\s\\r\\n<>\\[\\](){}.*+?:!=|%\\/\\\\^$,\\\'\\"\\`;]',
    },
    startConditions: {
      rules: 0,
      macro: 0,
      code: 1,
      options: 1,
      action: 1,
      set: 1,
    },
    codeSections: [
      {
        qualifier: 'imports',
        include: `import JSON5 from '@gerhobbelt/json5';

  import helpers from '../../helpers-lib'`,
      },
    ],
    importDecls: [],
    unknownDecls: [],
    options: {
      easy_keyword_rules: true,
      ranges: true,
      xregexp: true,
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
    xregexp: true,
    lexerErrorsAreRecoverable: false,
    flex: false,
    backtrack_lexer: false,
    ranges: true,
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
    rules: {
      rules: [
        0,
        1,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
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
        83,
        84,
        96,
        97,
        98,
        99,
        101,
        102,
      ],
      inclusive: true,
    },
    macro: {
      rules: [
        0,
        1,
        19,
        20,
        21,
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
        79,
        80,
        81,
        83,
        84,
        96,
        97,
        98,
        99,
        101,
        102,
      ],
      inclusive: true,
    },
    code: {
      rules: [
        77,
        78,
        88,
        89,
        96,
        97,
        98,
        101,
        102,
      ],
      inclusive: false,
    },
    options: {
      rules: [
        0,
        1,
        18,
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
        82,
        93,
        94,
        95,
        96,
        97,
        98,
        100,
        101,
        102,
      ],
      inclusive: false,
    },
    action: {
      rules: [
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
        90,
        91,
        92,
        96,
        97,
        98,
        101,
        102,
      ],
      inclusive: false,
    },
    set: {
      rules: [
        82,
        85,
        86,
        87,
        96,
        97,
        98,
        101,
        102,
      ],
      inclusive: false,
    },
    INITIAL: {
      rules: [
        0,
        1,
        18,
        19,
        20,
        21,
        39,
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
        83,
        84,
        96,
        97,
        98,
        101,
        102,
      ],
      inclusive: true,
    },
  },
  performAction: `function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            
var YYSTATE = YY_START;
switch(yyrulenumber) {
case 0 : 
/*! Conditions:: INITIAL macro options rules */ 
/*! Rule::       \\/\\/[^\\r\\n]* */ 
 /* skip single-line comment */ 
break;
case 1 : 
/*! Conditions:: INITIAL macro options rules */ 
/*! Rule::       \\/\\*[^]*?\\*\\/ */ 
 /* skip multi-line comment */ 
break;
case 2 : 
/*! Conditions:: action */ 
/*! Rule::       %\\{([^]*?)%\\} */ 
 yy_.yytext = this.matches[1];
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 3 : 
/*! Conditions:: action */ 
/*! Rule::       %include\\b */ 
 if (yy.include_command_allowed) {
                                            // This is an include instruction in place of (part of) an action:
                                            this.pushState('options');
                                            return 'INCLUDE';
                                        } else {
                                            // TODO
                                            yy_.yyerror(rmCommonWS\`
                                                %include statements must occur on a line on their own and cannot occur inside an %{...%} action code block.
                                                Its use is not permitted at this position.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yy_.yylloc));
                                            return 'INCLUDE_PLACEMENT_ERROR';
                                        } 
break;
case 4 : 
/*! Conditions:: action */ 
/*! Rule::       \\/\\*[^]*?\\*\\/ */ 
 //yy.include_command_allowed = false; -- doesn't impact include-allowed state
                                        return 'ACTION_BODY' 
break;
case 5 : 
/*! Conditions:: action */ 
/*! Rule::       \\/\\/.* */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 6 : 
/*! Conditions:: action */ 
/*! Rule::       \\| */ 
 if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yy_.yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        } 
break;
case 7 : 
/*! Conditions:: action */ 
/*! Rule::       %% */ 
 if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yy_.yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        } 
break;
case 8 : 
/*! Conditions:: action */ 
/*! Rule::       \\/.* */ 
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
                                        return 'ACTION_BODY' 
break;
case 9 : 
/*! Conditions:: action */ 
/*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}"|'{QUOTED_STRING_CONTENT}'|\`{ES2017_STRING_CONTENT}\` */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 10 : 
/*! Conditions:: action */ 
/*! Rule::       [^/"'\`|%\\{\\}{BR}{WS}]+ */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 11 : 
/*! Conditions:: action */ 
/*! Rule::       % */ 
 yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 12 : 
/*! Conditions:: action */ 
/*! Rule::       \\{ */ 
 yy.depth++;
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY' 
break;
case 13 : 
/*! Conditions:: action */ 
/*! Rule::       \\} */ 
 yy.include_command_allowed = false;
                                        if (yy.depth <= 0) {
                                            yy_.yyerror(rmCommonWS\`
                                                too many closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yy_.yylloc));
                                            return 'BRACKET_SURPLUS';
                                        } else {
                                            yy.depth--;
                                        }
                                        return 'ACTION_BODY' 
break;
case 14 : 
/*! Conditions:: action */ 
/*! Rule::       (?:[\\s\\r\\n]*?){BR}+{WS}+(?=[^{WS}{BR}|]) */ 
 yy.include_command_allowed = true;
                                        return 'ACTION_BODY';           // keep empty lines as-is inside action code blocks. 
break;
case 16 : 
/*! Conditions:: action */ 
/*! Rule::       {BR} */ 
 if (yy.depth > 0) {
                                            yy.include_command_allowed = true;
                                            return 'ACTION_BODY';       // keep empty lines as-is inside action code blocks.
                                        } else {
                                            // end of action code chunk; allow parent mode to see this mode-terminating linebreak too.
                                            this.popState();
                                            this.unput(yy_.yytext);
                                            return 'ACTION_END';
                                        } 
break;
case 17 : 
/*! Conditions:: action */ 
/*! Rule::       $ */ 
 yy.include_command_allowed = false;
                                        if (yy.depth !== 0) {
                                            yy_.yyerror(rmCommonWS\`
                                                missing ${yy.depth} closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yy_.yylloc));
                                            return 'BRACKET_MISSING';
                                        }
                                        this.popState();
                                        return 'ACTION_END' 
break;
case 18 : 
/*! Conditions:: INITIAL rules options */ 
/*! Rule::       [%\\{]\\{+ */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');

                                        // Make sure we've the proper lexer rule regex active for any possible \`%{...%}\`, \`{{...}}\` or what have we here?
                                        this.setupDelimitedActionChunkLexerRegex(yy_.yytext, yy);

                                        // Allow the start marker to be re-matched by the generated lexer rule regex:
                                        this.unput(yy_.yytext);

                                        // and allow the next lexer round to match and execute the suitable lexer rule(s) to parse this incoming action code block. 
                                        return 'ACTION_START' 
break;
case 19 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       -> */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START' 
break;
case 20 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       → */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START' 
break;
case 21 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       => */ 
 yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START' 
break;
case 22 : 
/*! Conditions:: rules */ 
/*! Rule::       {WS}+(?=[^{WS}{BR}|]) */ 
 yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        return 'ACTION_START' 
break;
case 23 : 
/*! Conditions:: rules */ 
/*! Rule::       %% */ 
 this.popState();
                                        this.pushState('code');
                                        return '%%' 
break;
case 24 : 
/*! Conditions:: rules */ 
/*! Rule::       $ */ 
 this.popState();
                                        this.pushState('code');
                                        return '%%' 
break;
case 29 : 
/*! Conditions:: options */ 
/*! Rule::       %% */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'OPTIONS_END' 
break;
case 30 : 
/*! Conditions:: options */ 
/*! Rule::       %include\\b */ 
 yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the \`<action>\` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yy_.yytext);
                                        return 'ACTION_START' 
break;
case 31 : 
/*! Conditions:: options */ 
/*! Rule::       > */ 
 this.popState();
                                        this.unput(yy_.yytext);     
                                        return 'OPTIONS_END' 
break;
case 34 : 
/*! Conditions:: options */ 
/*! Rule::       <{ID}> */ 
 yy_.yytext = this.matches[1];
                                        return 'TOKEN_TYPE' 
break;
case 36 : 
/*! Conditions:: options */ 
/*! Rule::       {BR}{WS}+(?=\\S) */ 
 /* ignore */ 
break;
case 37 : 
/*! Conditions:: options */ 
/*! Rule::       {BR} */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'OPTIONS_END' 
break;
case 38 : 
/*! Conditions:: options */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 39 : 
/*! Conditions:: INITIAL */ 
/*! Rule::       {ID} */ 
 this.pushState('macro');
                                        return 'MACRO_NAME' 
break;
case 40 : 
/*! Conditions:: macro */ 
/*! Rule::       {BR}+ */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'MACRO_END' 
break;
case 41 : 
/*! Conditions:: macro */ 
/*! Rule::       $ */ 
 this.popState();
                                        this.unput(yy_.yytext);
                                        return 'MACRO_END' 
break;
case 42 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       {BR}+ */ 
 /* skip newlines */ 
break;
case 43 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       {WS}+ */ 
 /* skip whitespace */ 
break;
case 47 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       {ANY_LITERAL_CHAR}+ */ 
 // accept any non-regex, non-lex, non-string-delim,
                                        // non-escape-starter, non-space character as-is
                                        return 'CHARACTER_LIT' 
break;
case 48 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\[ */ 
 this.pushState('set');
                                        return 'REGEX_SET_START' 
break;
case 63 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       < */ 
 this.pushState('options');
                                        return '<' 
break;
case 65 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\/! */ 
 return '/!';                    // treated as \`(?!atom)\` 
break;
case 66 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\/ */ 
 return '/';                     // treated as \`(?=atom)\` 
break;
case 68 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\\\(?:([0-7]{1,3})|c([@A-Z])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\\{([0-9a-fA-F]{1,8})\\}) */ 
 var m = this.matches;
                                            yy_.yytext = NaN;
                                            if (m[1]) {
                                                // [1]: octal char: \`\\012\` --> \\x0A
                                                var v = parseInt(m[1], 8);
                                                yy_.yytext = v;
                                            }
                                            else if (m[2]) {
                                                // [2]: CONTROL char: \`\\cA\` --> \\u0001
                                                var v = m[2].charCodeAt(0) - 64;
                                                yy_.yytext = v;
                                            }
                                            else if (m[3]) {
                                                // [3]: hex char: \`\\x41\` --> A
                                                var v = parseInt(m[3], 16);
                                                yy_.yytext = v;
                                            }
                                            else if (m[4]) {
                                                // [4]: unicode/UTS2 char: \`\\u03c0\` --> PI
                                                var v = parseInt(m[4], 16);
                                                yy_.yytext = v;
                                            }
                                            else if (m[5]) {
                                                // [5]: unicode code point: \`\\u{00003c0}\` --> PI
                                                var v = parseInt(m[5], 16);
                                                yy_.yytext = v;
                                            }
                                            return 'ESCAPED_CHAR' 
break;
case 69 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       \\\\. */ 
 yy_.yytext = yy_.yytext.substring(1);
                                        return 'CHARACTER_LIT' 
break;
case 72 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %option[s]? */ 
 this.pushState('options');
                                        return 'OPTIONS' 
break;
case 73 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %s\\b */ 
 this.pushState('options');
                                        return 'START_INC' 
break;
case 74 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %x\\b */ 
 this.pushState('options');
                                        return 'START_EXC' 
break;
case 75 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %code\\b */ 
 this.pushState('options');
                                        return 'CODE' 
break;
case 76 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %import\\b */ 
 this.pushState('options');
                                        return 'IMPORT' 
break;
case 77 : 
/*! Conditions:: INITIAL rules code */ 
/*! Rule::       %include\\b */ 
 yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the \`<action>\` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yy_.yytext);
                                        return 'ACTION_START' 
break;
case 78 : 
/*! Conditions:: INITIAL rules code */ 
/*! Rule::       %{NAME}([^\\r\\n]*) */ 
 /* ignore unrecognized decl */
                                            this.warn(rmCommonWS\`
                                                ignoring unsupported lexer option ${dquote(yy_.yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                \` + this.prettyPrintRange(yy_.yylloc));
                                            yy_.yytext = {
                                                name: this.matches[1],              // {NAME}
                                                value: this.matches[2].trim()       // optional value/parameters
                                            };
                                            return 'UNKNOWN_DECL' 
break;
case 79 : 
/*! Conditions:: rules macro INITIAL */ 
/*! Rule::       %% */ 
 this.pushState('rules');
                                        return '%%' 
break;
case 87 : 
/*! Conditions:: set */ 
/*! Rule::       \\] */ 
 this.popState();
                                        return 'REGEX_SET_END' 
break;
case 89 : 
/*! Conditions:: code */ 
/*! Rule::       [^{BR}]+ */ 
 return 'CODE';      // the bit of CODE just before EOF... 
break;
case 90 : 
/*! Conditions:: action */ 
/*! Rule::       " */ 
 yy_.yyerror(rmCommonWS\`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 91 : 
/*! Conditions:: action */ 
/*! Rule::       ' */ 
 yy_.yyerror(rmCommonWS\`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 92 : 
/*! Conditions:: action */ 
/*! Rule::       \` */ 
 yy_.yyerror(rmCommonWS\`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 93 : 
/*! Conditions:: options */ 
/*! Rule::       " */ 
 yy_.yyerror(rmCommonWS\`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 94 : 
/*! Conditions:: options */ 
/*! Rule::       ' */ 
 yy_.yyerror(rmCommonWS\`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 95 : 
/*! Conditions:: options */ 
/*! Rule::       \` */ 
 yy_.yyerror(rmCommonWS\`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 96 : 
/*! Conditions:: * */ 
/*! Rule::       " */ 
 var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS\`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 97 : 
/*! Conditions:: * */ 
/*! Rule::       ' */ 
 var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS\`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 98 : 
/*! Conditions:: * */ 
/*! Rule::       \` */ 
 var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS\`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'UNTERMINATED_STRING_ERROR' 
break;
case 99 : 
/*! Conditions:: macro rules */ 
/*! Rule::       . */ 
 /* b0rk on bad characters */
                                        var rules = (this.topState() === 'macro' ? 'macro\\'s' : this.topState());
                                        yy_.yyerror(rmCommonWS\`
                                            unsupported lexer input encountered while lexing
                                            ${rules} (i.e. jison lex regexes) in ${dquote(this.topState())} state.

                                                NOTE: When you want this input to be interpreted as a LITERAL part
                                                      of a lex rule regex, you MUST enclose it in double or
                                                      single quotes.

                                                      If not, then know that this input is not accepted as a valid
                                                      regex expression here in jison-lex ${rules}.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'error' 
break;
case 100 : 
/*! Conditions:: options */ 
/*! Rule::       . */ 
 yy_.yyerror(rmCommonWS\`
                                            unsupported lexer input: ${dquote(yy_.yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                            If this input was intentional, you might want to put quotes around
                                            it; any JavaScript string quoting style is accepted (single quotes,
                                            double quotes *or* backtick quotes a la ES6 string templates).

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'error' 
break;
case 101 : 
/*! Conditions:: * */ 
/*! Rule::       . */ 
 yy_.yyerror(rmCommonWS\`
                                            unsupported lexer input: ${dquote(yy_.yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                              Erroneous area:
                                            \` + this.prettyPrintRange(yy_.yylloc));
                                        return 'error' 
break;
default:
  return this.simpleCaseActionClusters[yyrulenumber];
}
        }`,
  caseHelperInclude: `{

  /*! Conditions:: action */ 
  /*! Rule::       {WS}+ */ 
   15 : 'ACTION_BODY',
  /*! Conditions:: options */ 
  /*! Rule::       = */ 
   25 : '=',
  /*! Conditions:: options */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   26 : 'OPTION_STRING',
  /*! Conditions:: options */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   27 : 'OPTION_STRING',
  /*! Conditions:: options */ 
  /*! Rule::       \`{ES2017_STRING_CONTENT}\` */ 
   28 : 'OPTION_STRING',
  /*! Conditions:: options */ 
  /*! Rule::       , */ 
   32 : ',',
  /*! Conditions:: options */ 
  /*! Rule::       \\* */ 
   33 : '*',
  /*! Conditions:: options */ 
  /*! Rule::       {ANY_LITERAL_CHAR}+ */ 
   35 : 'OPTION_VALUE',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       "{DOUBLEQUOTED_STRING_CONTENT}" */ 
   44 : 'STRING_LIT',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       '{QUOTED_STRING_CONTENT}' */ 
   45 : 'STRING_LIT',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \`{ES2017_STRING_CONTENT}\` */ 
   46 : 'STRING_LIT',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\| */ 
   49 : '|',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\(\\?: */ 
   50 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\(\\?= */ 
   51 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\(\\?! */ 
   52 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\(\\?<= */ 
   53 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\(\\?<! */ 
   54 : 'SPECIAL_GROUP',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\( */ 
   55 : '(',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\) */ 
   56 : ')',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\+ */ 
   57 : '+',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\* */ 
   58 : '*',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\? */ 
   59 : '?',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\^ */ 
   60 : '^',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       , */ 
   61 : ',',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       <<EOF>> */ 
   62 : '$',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       > */ 
   64 : '>',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\\\(?:[sSbBwWdDpP]|[rfntv\\\\*+()${}|[\\]\\/.^?]) */ 
   67 : 'REGEX_SPECIAL_CHAR',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\$ */ 
   70 : '$',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\. */ 
   71 : '.',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\{\\d+(,\\s*\\d+|,)?\\} */ 
   80 : 'RANGE_REGEX',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\{{ID}\\} */ 
   81 : 'NAME_BRACE',
  /*! Conditions:: set options */ 
  /*! Rule::       \\{{ID}\\} */ 
   82 : 'NAME_BRACE',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\{ */ 
   83 : '{',
  /*! Conditions:: rules macro INITIAL */ 
  /*! Rule::       \\} */ 
   84 : '}',
  /*! Conditions:: set */ 
  /*! Rule::       (?:\\\\[^{BR}]|[^\\]{])+ */ 
   85 : 'REGEX_SET',
  /*! Conditions:: set */ 
  /*! Rule::       \\{ */ 
   86 : 'REGEX_SET',
  /*! Conditions:: code */ 
  /*! Rule::       [^{BR}]*{BR}+ */ 
   88 : 'CODE',
  /*! Conditions:: * */ 
  /*! Rule::       $ */ 
   102 : 'EOF'
}`,
  rules: [
    {
      re: '/^(?:\\/\\/[^\\r\\n]*)/',
      source: '^(?:\\/\\/[^\\r\\n]*)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/\\/[^\\r\\n]*)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\/\\*[\\s\\S]*?\\*\\/)/',
      source: '^(?:\\/\\*[\\s\\S]*?\\*\\/)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/\\*[^]*?\\*\\/)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%\\{([\\s\\S]*?)%\\})/',
      source: '^(?:%\\{([\\s\\S]*?)%\\})',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%\\{([^]*?)%\\})',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%include\\b)/',
      source: '^(?:%include\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%include\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\/\\*[\\s\\S]*?\\*\\/)/',
      source: '^(?:\\/\\*[\\s\\S]*?\\*\\/)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/\\*[^]*?\\*\\/)',
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
      re: '/^(?:%%)/',
      source: '^(?:%%)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%%)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\/.*)/',
      source: '^(?:\\/.*)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/.*)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: `/^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)"|'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)'|\`((?:\\\\\`|\\\\[^\`]|[^\\\\\`])*)\`)/`,
      source: `^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)"|'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)'|\`((?:\\\\\`|\\\\[^\`]|[^\\\\\`])*)\`)`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)"|'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)'|\`((?:\\\\\`|\\\\[^\`]|[^\\\\\`])*)\`)`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:[^\\s"%\'\\/`{-}]+)/',
      source: '^(?:[^\\s"%\'\\/`{-}]+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:[^\\s"%\'/`{-}]+)',
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
      re: '/^(?:\\{)/',
      source: '^(?:\\{)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\{)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\})/',
      source: '^(?:\\})',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\})',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(?:\\s*?)(\\r\\n|\\n|\\r)+([^\\S\\n\\r])+(?=[^\\s|]))/',
      source: '^(?:(?:\\s*?)(\\r\\n|\\n|\\r)+([^\\S\\n\\r])+(?=[^\\s|]))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(?:\\s*?)(\\r\\n|\\n|\\r)+([^\\S\\n\\r])+(?=[^\\s|]))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\S\\n\\r])+)/',
      source: '^(?:([^\\S\\n\\r])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\S\\n\\r])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\r\\n|\\n|\\r))/',
      source: '^(?:(\\r\\n|\\n|\\r))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\r\\n|\\n|\\r))',
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
      re: '/^(?:[%{]\\{+)/',
      source: '^(?:[%{]\\{+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:[%{]\\{+)',
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
      re: '/^(?:→)/',
      source: '^(?:→)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:→)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:=>)/',
      source: '^(?:=>)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:=>)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\S\\n\\r])+(?=[^\\s|]))/',
      source: '^(?:([^\\S\\n\\r])+(?=[^\\s|]))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\S\\n\\r])+(?=[^\\s|]))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%%)/',
      source: '^(?:%%)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%%)',
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
      re: `/^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)")/`,
      source: `^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)")`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)")`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: `/^(?:'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)')/`,
      source: `^(?:'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)')`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)')`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:`((?:\\\\`|\\\\[^`]|[^\\\\`])*)`)/',
      source: '^(?:`((?:\\\\`|\\\\[^`]|[^\\\\`])*)`)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:`((?:\\\\`|\\\\[^`]|[^\\\\`])*)`)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%%)/',
      source: '^(?:%%)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%%)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%include\\b)/',
      source: '^(?:%include\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%include\\b)',
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
      re: '/^(?:<([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)>)/',
      source: '^(?:<([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)>)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:<([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)>)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\s!"$%\'-,.\\/:-?\\[-\\^`{-}])+)/',
      source: '^(?:([^\\s!"$%\'-,.\\/:-?\\[-\\^`{-}])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\s!"$%\'-,./:-?\\[-\\^`{-}])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\r\\n|\\n|\\r)([^\\S\\n\\r])+(?=\\S))/',
      source: '^(?:(\\r\\n|\\n|\\r)([^\\S\\n\\r])+(?=\\S))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\r\\n|\\n|\\r)([^\\S\\n\\r])+(?=\\S))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\r\\n|\\n|\\r))/',
      source: '^(?:(\\r\\n|\\n|\\r))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\r\\n|\\n|\\r))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\S\\n\\r])+)/',
      source: '^(?:([^\\S\\n\\r])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\S\\n\\r])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*))/',
      source: '^(?:([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(\\r\\n|\\n|\\r)+)/',
      source: '^(?:(\\r\\n|\\n|\\r)+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\r\\n|\\n|\\r)+)',
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
      re: '/^(?:(\\r\\n|\\n|\\r)+)/',
      source: '^(?:(\\r\\n|\\n|\\r)+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(\\r\\n|\\n|\\r)+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\S\\n\\r])+)/',
      source: '^(?:([^\\S\\n\\r])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\S\\n\\r])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: `/^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)")/`,
      source: `^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)")`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:"((?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*)")`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: `/^(?:'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)')/`,
      source: `^(?:'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)')`,
      flags: '',
      xregexp: {
        captureNames: null,
        source: `^(?:'((?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*)')`,
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:`((?:\\\\`|\\\\[^`]|[^\\\\`])*)`)/',
      source: '^(?:`((?:\\\\`|\\\\[^`]|[^\\\\`])*)`)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:`((?:\\\\`|\\\\[^`]|[^\\\\`])*)`)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:([^\\s!"$%\'-,.\\/:-?\\[-\\^`{-}])+)/',
      source: '^(?:([^\\s!"$%\'-,.\\/:-?\\[-\\^`{-}])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:([^\\s!"$%\'-,./:-?\\[-\\^`{-}])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\[)/',
      source: '^(?:\\[)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\[)',
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
      re: '/^(?:\\(\\?:)/',
      source: '^(?:\\(\\?:)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\(\\?:)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\(\\?=)/',
      source: '^(?:\\(\\?=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\(\\?=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\(\\?!)/',
      source: '^(?:\\(\\?!)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\(\\?!)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\(\\?<=)/',
      source: '^(?:\\(\\?<=)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\(\\?<=)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\(\\?<!)/',
      source: '^(?:\\(\\?<!)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\(\\?<!)',
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
      re: '/^(?:<<EOF>>)/',
      source: '^(?:<<EOF>>)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:<<EOF>>)',
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
      re: '/^(?:\\/!)/',
      source: '^(?:\\/!)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\/!)',
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
      re: '/^(?:\\\\(?:[BDPSWbdpsw]|[$(-+.\\/?\\[-\\^fnrtv{-}]))/',
      source: '^(?:\\\\(?:[BDPSWbdpsw]|[$(-+.\\/?\\[-\\^fnrtv{-}]))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\\\(?:[BDPSWbdpsw]|[$(-+./?\\[-\\^fnrtv{-}]))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\\\(?:([0-7]{1,3})|c([@-Z])|x([\\dA-Fa-f]{2})|u([\\dA-Fa-f]{4})|u\\{([\\dA-Fa-f]{1,8})\\}))/',
      source: '^(?:\\\\(?:([0-7]{1,3})|c([@-Z])|x([\\dA-Fa-f]{2})|u([\\dA-Fa-f]{4})|u\\{([\\dA-Fa-f]{1,8})\\}))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\\\(?:([0-7]{1,3})|c([@-Z])|x([\\dA-Fa-f]{2})|u([\\dA-Fa-f]{4})|u\\{([\\dA-Fa-f]{1,8})\\}))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\\\.)/',
      source: '^(?:\\\\.)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\\\.)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\$)/',
      source: '^(?:\\$)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\$)',
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
      re: '/^(?:%option[s]?)/',
      source: '^(?:%option[s]?)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%option[s]?)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%s\\b)/',
      source: '^(?:%s\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%s\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%x\\b)/',
      source: '^(?:%x\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%x\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%code\\b)/',
      source: '^(?:%code\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%code\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%import\\b)/',
      source: '^(?:%import\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%import\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%include\\b)/',
      source: '^(?:%include\\b)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%include\\b)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-,.\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]*(?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]))?)([^\\n\\r]*))/',
      source: '^(?:%([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-,.\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]*(?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]))?)([^\\n\\r]*))',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-,./:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]*(?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]))?)([^\\n\\r]*))',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:%%)/',
      source: '^(?:%%)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:%%)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\{\\d+(,\\s*\\d+|,)?\\})/',
      source: '^(?:\\{\\d+(,\\s*\\d+|,)?\\})',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\{\\d+(,\\s*\\d+|,)?\\})',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\{([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)\\})/',
      source: '^(?:\\{([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)\\})',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\{([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)\\})',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\{([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)\\})/',
      source: '^(?:\\{([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-\\/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)\\})',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\{([^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*)\\})',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\{)/',
      source: '^(?:\\{)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\{)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\})/',
      source: '^(?:\\})',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\})',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:(?:\\\\[^\\n\\r]|[^\\]{])+)/',
      source: '^(?:(?:\\\\[^\\n\\r]|[^\\]{])+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:(?:\\\\[^\\n\\r]|[^\\]{])+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\{)/',
      source: '^(?:\\{)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\{)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:\\])/',
      source: '^(?:\\])',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:\\])',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:[^\\n\\r]*(\\r\\n|\\n|\\r)+)/',
      source: '^(?:[^\\n\\r]*(\\r\\n|\\n|\\r)+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:[^\\n\\r]*(\\r\\n|\\n|\\r)+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:[^\\n\\r]+)/',
      source: '^(?:[^\\n\\r]+)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:[^\\n\\r]+)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:")/',
      source: '^(?:")',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:")',
        flags: '',
        isNative: true,
      },
    },
    {
      re: "/^(?:')/",
      source: "^(?:')",
      flags: '',
      xregexp: {
        captureNames: null,
        source: "^(?:')",
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:`)/',
      source: '^(?:`)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:`)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:")/',
      source: '^(?:")',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:")',
        flags: '',
        isNative: true,
      },
    },
    {
      re: "/^(?:')/",
      source: "^(?:')",
      flags: '',
      xregexp: {
        captureNames: null,
        source: "^(?:')",
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:`)/',
      source: '^(?:`)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:`)',
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:")/',
      source: '^(?:")',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:")',
        flags: '',
        isNative: true,
      },
    },
    {
      re: "/^(?:')/",
      source: "^(?:')",
      flags: '',
      xregexp: {
        captureNames: null,
        source: "^(?:')",
        flags: '',
        isNative: true,
      },
    },
    {
      re: '/^(?:`)/',
      source: '^(?:`)',
      flags: '',
      xregexp: {
        captureNames: null,
        source: '^(?:`)',
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
    ALPHA: {
      in_set: 'A-Z_a-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-ٟٮ-ۓە-ۜۡ-ۭۨ-ۯۺ-ۼۿܐ-ܿݍ-ޱߊ-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣৰৱৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼ੰ-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൗൟ-ൣൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟෲෳก-ฺเ-ๆํກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍໜ-ໟༀཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-ဿၐ-ၢၥ-ၨၮ-ႆႎႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨛᨠ-ᩞᩡ-ᩴᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋᮀ-ᮩᮬ-ᮯᮺ-ᯥᯧ-ᯱᰀ-ᰵᱍ-ᱏᱚ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⒶ-ⓩⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧꡀ-ꡳꢀ-ꣃꣅꣲ-ꣷꣻꣽꤊ-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨶꩀ-ꩍꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ',
      elsewhere: '[^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]',
      raw: '[{UNICODE_LETTER}_]',
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
    ALNUM: {
      in_set: '0-9A-Z_a-zª²³µ¹º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-٩ٮ-ۓە-ۜۡ-ۭۨ-ۼۿܐ-ܿݍ-ޱ߀-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣ०-९ॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣ০-ৱ৴-৹ৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣ૦-૯ૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱ-୷ஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗ௦-௲ఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣ౦-౯౸-౾ಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣ೦-೯ೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൣ൦-൸ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟ෦-෯ෲෳก-ฺเ-ๆํ๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-၉ၐ-ၢၥ-ၨၮ-ႆႎ႐-႙ႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨛᨠ-ᩞᩡ-ᩴ᪀-᪉᪐-᪙ᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋ᭐-᭙ᮀ-ᮩᮬ-ᯥᯧ-ᯱᰀ-ᰵ᱀-᱉ᱍ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛Ⓐ-⓿❶-➓Ⰰ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎ㆒-㆕ㆠ-ㆺㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧ꠰-꠵ꡀ-ꡳꢀ-ꣃꣅ꣐-꣙ꣲ-ꣷꣻꣽ꤀-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ',
      elsewhere: '[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]',
      raw: '[{ALPHA}{DIGIT}]',
    },
    NAME: {
      in_set: {
        message: '[macro [NAME] is unsuitable for use inside regex set expressions: "[[A-Z_a-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-ٟٮ-ۓە-ۜۡ-ۭۨ-ۯۺ-ۼۿܐ-ܿݍ-ޱߊ-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣৰৱৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼ੰ-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൗൟ-ൣൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟෲෳก-ฺเ-ๆํກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍໜ-ໟༀཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-ဿၐ-ၢၥ-ၨၮ-ႆႎႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨛᨠ-ᩞᩡ-ᩴᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋᮀ-ᮩᮬ-ᮯᮺ-ᯥᯧ-ᯱᰀ-ᰵᱍ-ᱏᱚ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⒶ-ⓩⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧꡀ-ꡳꢀ-ꣃꣅꣲ-ꣷꣻꣽꤊ-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨶꩀ-ꩍꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ](?:[0-9A-Z_a-zª²³µ¹º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-٩ٮ-ۓە-ۜۡ-ۭۨ-ۼۿܐ-ܿݍ-ޱ߀-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣ०-९ॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣ০-ৱ৴-৹ৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣ૦-૯ૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱ-୷ஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗ௦-௲ఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣ౦-౯౸-౾ಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣ೦-೯ೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൣ൦-൸ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟ෦-෯ෲෳก-ฺเ-ๆํ๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-၉ၐ-ၢၥ-ၨၮ-ႆႎ႐-႙ႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨛᨠ-ᩞᩡ-ᩴ᪀-᪉᪐-᪙ᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋ᭐-᭙ᮀ-ᮩᮬ-ᯥᯧ-ᯱᰀ-ᰵ᱀-᱉ᱍ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛Ⓐ-⓿❶-➓Ⰰ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎ㆒-㆕ㆠ-ㆺㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧ꠰-꠵ꡀ-ꡳꢀ-ꣃꣅ꣐-꣙ꣲ-ꣷꣻꣽ꤀-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ-]*0-9A-Z_a-zª²³µ¹º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-٩ٮ-ۓە-ۜۡ-ۭۨ-ۼۿܐ-ܿݍ-ޱ߀-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣ०-९ॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣ০-ৱ৴-৹ৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣ૦-૯ૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱ-୷ஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗ௦-௲ఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣ౦-౯౸-౾ಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣ೦-೯ೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൣ൦-൸ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟ෦-෯ෲෳก-ฺเ-ๆํ๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-၉ၐ-ၢၥ-ၨၮ-ႆႎ႐-႙ႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨛᨠ-ᩞᩡ-ᩴ᪀-᪉᪐-᪙ᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋ᭐-᭙ᮀ-ᮩᮬ-ᯥᯧ-ᯱᰀ-ᰵ᱀-᱉ᱍ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛Ⓐ-⓿❶-➓Ⰰ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎ㆒-㆕ㆠ-ㆺㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧ꠰-꠵ꡀ-ꡳꢀ-ꣃꣅ꣐-꣙ꣲ-ꣷꣻꣽ꤀-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ)?]"]',
        name: 'Error',
      },
      elsewhere: '[^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-,./:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]*(?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff]))?',
      raw: '[{ALPHA}](?:[{ALNUM}-]*{ALNUM})?',
    },
    ID: {
      in_set: {
        message: '[macro [ID] is unsuitable for use inside regex set expressions: "[[A-Z_a-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-ٟٮ-ۓە-ۜۡ-ۭۨ-ۯۺ-ۼۿܐ-ܿݍ-ޱߊ-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣৰৱৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼ੰ-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൗൟ-ൣൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟෲෳก-ฺเ-ๆํກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍໜ-ໟༀཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-ဿၐ-ၢၥ-ၨၮ-ႆႎႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨛᨠ-ᩞᩡ-ᩴᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋᮀ-ᮩᮬ-ᮯᮺ-ᯥᯧ-ᯱᰀ-ᰵᱍ-ᱏᱚ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⒶ-ⓩⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧꡀ-ꡳꢀ-ꣃꣅꣲ-ꣷꣻꣽꤊ-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨶꩀ-ꩍꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]0-9A-Z_a-zª²³µ¹º¼-¾À-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͅͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևְ-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-ٗٙ-٩ٮ-ۓە-ۜۡ-ۭۨ-ۼۿܐ-ܿݍ-ޱ߀-ߪߴߵߺࠀ-ࠗࠚ-ࠬࡀ-ࡘࡠ-ࡪࢠ-ࢴࢶ-ࢽࣔ-ࣣࣟ-ࣰࣩ-ऻऽ-ौॎ-ॐॕ-ॣ०-९ॱ-ঃঅ-ঌএঐও-নপ-রলশ-হঽ-ৄেৈোৌৎৗড়ঢ়য়-ৣ০-ৱ৴-৹ৼਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਾ-ੂੇੈੋੌੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽ-ૅે-ૉોૌૐૠ-ૣ૦-૯ૹ-ૼଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽ-ୄେୈୋୌୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱ-୷ஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-ௌௐௗ௦-௲ఀ-ఃఅ-ఌఎ-ఐఒ-నప-హఽ-ౄె-ైొ-ౌౕౖౘ-ౚౠ-ౣ౦-౯౸-౾ಀ-ಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽ-ೄೆ-ೈೊ-ೌೕೖೞೠ-ೣ೦-೯ೱೲഀ-ഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൌൎൔ-ൣ൦-൸ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆා-ුූෘ-ෟ෦-෯ෲෳก-ฺเ-ๆํ๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆໍ໐-໙ໜ-ໟༀ༠-༳ཀ-ཇཉ-ཬཱ-ཱྀྈ-ྗྙ-ྼက-ံးျ-၉ၐ-ၢၥ-ၨၮ-ႆႎ႐-႙ႜႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፟፩-፼ᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜓᜠ-ᜳᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-ឳា-ៈៗៜ០-៩៰-៹᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤞᤠ-ᤫᤰ-ᤸ᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧚ᨀ-ᨛᨠ-ᩞᩡ-ᩴ᪀-᪉᪐-᪙ᪧᬀ-ᬳᬵ-ᭃᭅ-ᭋ᭐-᭙ᮀ-ᮩᮬ-ᯥᯧ-ᯱᰀ-ᰵ᱀-᱉ᱍ-ᱽᲀ-ᲈᳩ-ᳬᳮ-ᳳᳵᳶᴀ-ᶿᷧ-ᷴḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ⁰ⁱ⁴-⁹ⁿ-₉ₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ⅐-↉①-⒛Ⓐ-⓿❶-➓Ⰰ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳ⳽ⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄮㄱ-ㆎ㆒-㆕ㆠ-ㆺㇰ-ㇿ㈠-㈩㉈-㉏㉑-㉟㊀-㊉㊱-㊿㐀-䶵一-鿪ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-ꙮꙴ-ꙻꙿ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞮꞰ-ꞷꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠧ꠰-꠵ꡀ-ꡳꢀ-ꣃꣅ꣐-꣙ꣲ-ꣷꣻꣽ꤀-ꤪꤰ-ꥒꥠ-ꥼꦀ-ꦲꦴ-ꦿꧏ-꧙ꧠ-ꧤꧦ-ꧾꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩾ-ꪾꫀꫂꫛ-ꫝꫠ-ꫯꫲ-ꫵꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭥꭰ-ꯪ꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ*]"]',
        name: 'Error',
      },
      elsewhere: '[^\\u0000-@\\[-\\^`{-©«-´¶-¹»-¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٠-٭۔۝-۠۩-۬۰-۹۽۾܀-܏݀-݌޲-߉߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।-॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤-৯৲-৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੯੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤-୰୲-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤-౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤-೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൘-൞൤-൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෱෴-฀฻-฿็-์๎-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎-໛໠-໿༁-༿཈཭-཰ྂ-྇྘྽-࿿့္်၀-၏ၣၤၩ-ၭႇ-ႍႏ-ႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥏᥮᥯᥵-᥿᦬-᦯᧊-᧿᨜-᨟᩟᩠᩵-᪦᪨-᫿᬴᭄ᭌ-᭿᮪᮫᮰-᮹᯦᯲-᯿ᰶ-᱌᱐-᱙᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁰⁲-⁾₀-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏-⅟↉-⒵⓪-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆟ㆻ-㇯㈀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘠-꘩꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠿꡴-꡿꣄꣆-꣱꣸-꣺꣼ꣾ-꤉꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧐-꧟ꧥ꧰-꧹꧿꨷-꨿꩎-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff](?:[^\\u0000-/:-@\\[-\\^`{-©«-±´¶-¸»¿×÷˂-˅˒-˟˥-˫˭˯-̈́͆-ͯ͵͸͹;΀-΅·΋΍΢϶҂-҉԰՗՘՚-ՠֈ-֯־׀׃׆׈-׏׫-ׯ׳-؏؛-؟٘٪-٭۔۝-۠۩-۬۽۾܀-܏݀-݌޲-޿߫-߳߶-߹߻-߿࠘࠙࠭-࠿࡙-࡟࡫-࢟ࢵࢾ-࣓࣠-࣢࣪-़्࣯॑-॔।॥॰঄঍঎঑঒঩঱঳-঵঺-়৅৆৉৊্৏-৖৘-৛৞৤৥৲৳৺৻৽-਀਄਋-਎਑਒਩਱਴਷਺-਽੃-੆੉੊੍-੐੒-੘੝੟-੥੶-઀઄઎઒઩઱઴઺-઼૆૊્-૏૑-૟૤૥૰-૸૽-଀଄଍଎଑଒଩଱଴଺-଼୅୆୉୊୍-୕୘-୛୞୤୥୰୸-஁஄஋-஍஑஖-஘஛஝஠-஢஥-஧஫-஭஺-஽௃-௅௉்-௏௑-௖௘-௥௳-௿ఄ఍఑఩఺-఼౅౉్-౔౗౛-౟౤౥౰-౷౿಄಍಑಩಴಺-಼೅೉್-೔೗-ೝ೟೤೥೰ೳ-೿ഄ഍഑഻഼൅൉്൏-൓൤൥൹඀ඁ඄඗-඙඲඼඾඿෇-෎෕෗෠-෥෰෱෴-฀฻-฿็-์๎๏๚-຀຃຅ຆຉ຋ຌຎ-ຓຘຠ຤຦ຨຩຬ຺຾຿໅໇-໌໎໏໚໛໠-໿༁-༟༴-༿཈཭-཰ྂ-྇྘྽-࿿့္်၊-၏ၣၤၩ-ၭႇ-ႍႏႚႛ႞႟჆჈-჌჎჏჻቉቎቏቗቙቞቟኉኎኏኱኶኷኿዁዆዇዗጑጖጗፛-፞፠-፨፽-፿᎐-᎟᏶᏷᏾-᐀᙭᙮ ᚛-᚟᛫-᛭᛹-᛿ᜍ᜔-ᜟ᜴-᜿᝔-᝟᝭᝱᝴-᝿឴឵៉-៖៘-៛៝-៟៪-៯៺-᠏᠚-᠟ᡸ-᡿᢫-᢯᣶-᣿᤟᤬-᤯᤹-᥅᥮᥯᥵-᥿᦬-᦯᧊-᧏᧛-᧿᨜-᨟᩟᩠᩵-᩿᪊-᪏᪚-᪦᪨-᫿᬴᭄ᭌ-᭏᭚-᭿᯦᮪᮫᯲-᯿ᰶ-᰿᱊-᱌᱾᱿Ᲊ-᳨᳭᳴᳷-᳿᷀-ᷦ᷵-᷿἖἗἞἟὆὇὎὏὘὚὜὞὾὿᾵᾽᾿-῁῅῍-῏῔῕῜-῟῭-῱῵´-⁯⁲⁳⁺-⁾₊-₏₝-℁℃-℆℈℉℔№-℘℞-℣℥℧℩℮℺℻⅀-⅄⅊-⅍⅏↊-⑟⒜-⒵─-❵➔-⯿Ⱟⱟ⳥-⳪⳯-⳱⳴-⳼⳾⳿⴦⴨-⴬⴮⴯⵨-⵮⵰-⵿⶗-⶟⶧⶯⶷⶿⷇⷏⷗⷟⸀-⸮⸰-〄〈-〠〪-〰〶〷〽-぀゗-゜゠・㄀-㄄ㄯ㄰㆏-㆑㆖-㆟ㆻ-㇯㈀-㈟㈪-㉇㉐㉠-㉿㊊-㊰㋀-㏿䶶-䷿鿫-鿿꒍-꓏꓾꓿꘍-꘏꘬-꘿꙯-꙳꙼-꙾꛰-꜖꜠꜡꞉꞊ꞯꞸ-ꟶꠂ꠆ꠋ꠨-꠯꠶-꠿꡴-꡿꣄꣆-꣏꣚-꣱꣸-꣺꣼ꣾꣿ꤫-꤯꥓-꥟꥽-꥿꦳꧀-꧎꧚-꧟ꧥ꧿꨷-꨿꩎꩏꩚-꩟꩷-꩹ꩻ-ꩽ꪿꫁꫃-꫚꫞꫟꫰꫱꫶-꬀꬇꬈꬏꬐꬗-꬟꬧꬯꭛ꭦ-꭯꯫-꯯꯺-꯿힤-힯퟇-퟊퟼-﩮﩯﫚-﫿﬇-﬒﬘-﬜﬩﬷﬽﬿﭂﭅﮲-﯒﴾-﵏﶐﶑﷈-﷯﷼-﹯﹵﻽-／：-＠［-｀｛-･﾿-￁￈￉￐￑￘￙￝-\\uffff])*',
      raw: '[{ALPHA}]{ALNUM}*',
    },
    DECIMAL_NUMBER: {
      in_set: {
        message: '[macro [DECIMAL_NUMBER] is unsuitable for use inside regex set expressions: "[[1-9][0-9]*]"]',
        name: 'Error',
      },
      elsewhere: '[1-9]\\d*',
      raw: '[1-9][0-9]*',
    },
    HEX_NUMBER: {
      in_set: {
        message: '[macro [HEX_NUMBER] is unsuitable for use inside regex set expressions: "[0[xX][0-9a-fA-F]+]"]',
        name: 'Error',
      },
      elsewhere: '0[Xx][\\dA-Fa-f]+',
      raw: '0[xX][0-9a-fA-F]+',
    },
    BR: {
      in_set: '\\n\\r',
      elsewhere: '\\r\\n|\\n|\\r',
      raw: '\\r\\n|\\n|\\r',
    },
    WS: {
      in_set: '\\t\\v\\f   ᠎ - \\u2028\\u2029  　﻿',
      elsewhere: '[^\\S\\n\\r]',
      raw: '[^\\S\\r\\n]',
    },
    QUOTED_STRING_CONTENT: {
      in_set: {
        message: `[macro [QUOTED_STRING_CONTENT] is unsuitable for use inside regex set expressions: "[(?:\\\\'|\\\\[^\\']|[^\\\\\\'\\r\\n])*]"]`,
        name: 'Error',
      },
      elsewhere: `(?:\\\\'|\\\\[^']|[^\\n\\r'\\\\])*`,
      raw: `(?:\\\\'|\\\\[^\\']|[^\\\\\\'\\r\\n])*`,
    },
    DOUBLEQUOTED_STRING_CONTENT: {
      in_set: {
        message: `[macro [DOUBLEQUOTED_STRING_CONTENT] is unsuitable for use inside regex set expressions: "[(?:\\\\"|\\\\[^\\"]|[^\\\\\\"\\r\\n])*]"]`,
        name: 'Error',
      },
      elsewhere: `(?:\\\\"|\\\\[^"]|[^\\n\\r"\\\\])*`,
      raw: `(?:\\\\"|\\\\[^\\"]|[^\\\\\\"\\r\\n])*`,
    },
    ES2017_STRING_CONTENT: {
      in_set: {
        message: '[macro [ES2017_STRING_CONTENT] is unsuitable for use inside regex set expressions: "[(?:\\\\`|\\\\[^\\`]|[^\\\\\\`])*]"]',
        name: 'Error',
      },
      elsewhere: '(?:\\\\`|\\\\[^`]|[^\\\\`])*',
      raw: '(?:\\\\`|\\\\[^\\`]|[^\\\\\\`])*',
    },
    ANY_LITERAL_CHAR: {
      in_set: '\\u0000-\\b\\u000e-\\u001f#&\\-0-9@-Z_a-z~-¡-ᙿᚁ-᠍᠏-῿​-‧‪-‮‰-⁞⁠-⿿、-﻾＀-\\uffff',
      elsewhere: '[^\\s!"$%\'-,./:-?\\[-\\^`{-}]',
      raw: '[^\\s\\r\\n<>\\[\\](){}.*+?:!=|%\\/\\\\^$,\\\'\\"\\`;]',
    },
  },
  regular_rule_count: 65,
  simple_rule_count: 38,
  conditionStack: [
    'INITIAL',
  ],
  actionInclude: '',
  moduleInclude: `var rmCommonWS = helpers.rmCommonWS;
var dquote     = helpers.dquote;
var scanRegExp = helpers.scanRegExp;






lexer.setupDelimitedActionChunkLexerRegex = function lexer__setupDelimitedActionChunkLexerRegex(yytext, yy) {
    // Calculate the end marker to match and produce a
    // lexer rule to match when the need arrises:
    var marker = yytext;
    // Special: when we encounter \`{\` as the start of the action code block,
    // we NIL the \`%{...%}\` lexer rule by just using that one:
    if (marker === '{') {
        marker = '%{';
    }
    var action_end_marker = marker.replace(/\\{/g, '}');

    // Note: this bit comes straight from the lexer kernel!
    // Get us the currently active set of lexer rules. 
    // (This is why we push the 'action' lexer condition state above *before*
    // we commence and work on the ruleset itself.)
    var spec = this.__currentRuleSet__;
    if (!spec) {
        // Update the ruleset cache as we apparently encountered a state change or just started lexing.
        // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
        // invoke the \`lex()\` token-producing API and related APIs, hence caching the set for direct access helps
        // speed up those activities a tiny bit.
        spec = this.__currentRuleSet__ = this._currentRules();
    }

    var rules = spec.rules;
    var i, len;
    var action_chunk_regex;

    // Must we still locate the rule to patch or have we done 
    // that already during a previous encounter?
    if (!yy.action_chunk_rule_idx) {
        // **WARNING**: *(this bit comes straight from the lexer kernel)*
        //
        // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in \`lexer_next()\` fast and simple!
        for (i = 1, len = rules.length; i < len; i++) {
            var rule_re = rules[i];
            if (rule_re.toString() === '^(?:%\\\\{([^]*?)%\\\\})') {
                yy.action_chunk_rule_idx = i;
                break;
            }
        }

        // As we haven't initialized yet, we're sure the rule cache doesn't exist either.
        // Make it happen:
        yy.cached_action_chunk_rule = {};   // set up empty cache
    }

    i = yy.action_chunk_rule_idx;

    // Must we build the lexer rule or did we already run this variant 
    // through this lexer before? 
    // If so, fetch the cached version!
    action_chunk_regex = yy.cached_action_chunk_rule[marker];
    if (!action_chunk_regex) {
        action_chunk_regex = yy.cached_action_chunk_rule[marker] = new RegExp('^(?:' + marker.replace(/\\{/g, '\\\\{') + '([^]*?)' + action_end_marker.replace(/\\}/g, '\\\\}') + ')');
    }
    rules[i] = action_chunk_regex;
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
}`,
  __in_rules_failure_analysis_mode__: false,
  exportSourceCode: {
    enabled: false,
  },
  is_custom_lexer: false,
}

        