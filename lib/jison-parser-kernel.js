
function parse(input, parseParams) {
    var self = this;
    var stack = new Array(128);         // token stack: stores token which leads to state at the same index (column storage)
    var sstack = new Array(128);        // state stack: stores states (column storage)
    var tstack = [];                    // token stack (only used when `%options token_stack` support has been enabled)
    var vstack = new Array(128);        // semantic value stack
    var lstack = new Array(128);        // location stack
    var table = this.table;
    var sp = 0;                         // 'stack pointer': index into the stacks
    var yyloc;
    var yytext;
    var yylineno;
    var yyleng;

    var symbol = 0;
    var preErrorSymbol = 0;
    var lastEofErrorStateDepth = Infinity;
    var recoveringErrorInfo = null;
    var recovering = 0;                 // (only used when the grammar contains error recovery rules)
    var TERROR = this.TERROR;
    var EOF = this.EOF;
    var ERROR_RECOVERY_TOKEN_DISCARD_COUNT = (this.options.errorRecoveryTokenDiscardCount | 0) || 3;
    var NO_ACTION = [0, YY_ERROR_RECOVERY_COMBINE_ID /* === table.length :: ensures that anyone using this new state will fail dramatically! */];

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
        post_lex: undefined,
        parseParamsAsMembers: parseParamsAsMembers      // WARNING: must be written this way for the code expanders to work correctly in both ES5 and ES6 modes!
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

//_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

    this.yyGetErrorInfoTrack = function yyGetErrorInfoTrack() {
        return recoveringErrorInfo;
    };

//_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
//_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

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

    var yydebug = false;
    if (this.options.debug) {
        yydebug = function yydebug_impl(msg, obj) {
            var ref_list;
            var ref_names;

            function deepClone(from, sub) {
                if (sub == null) {
                    ref_list = [];
                    ref_names = [];
                    sub = 'root';
                }
                if (typeof from === 'function') return '[Function]';
                if (from == null || typeof from !== 'object') return from;
                if (from.constructor !== Object && from.constructor !== Array) {
                    return from;
                }

                for (var i = 0, len = ref_list.length; i < len; i++) {
                    if (ref_list[i] === from) {
                        return '[Circular/Xref:' + ref_names[i] + ']';   // circular or cross reference
                    }
                }
                ref_list.push(from);
                ref_names.push(sub);

                var to = new from.constructor();
                for (var name in from) {
                    if (name === 'parser') continue;
                    if (name === 'lexer') continue;
                    to[name] = deepClone(from[name], name);
                }
                return to;
            }

            obj = obj || {};
            if (obj.symbol) {
                obj.local_yytext = yytext;
                obj.lexer_yytext = lexer.yytext;
                obj.lexer_yylloc = lexer.yylloc;
                obj.lexer_yyllineno = lexer.yyllineno;
            }

            // warning: here we fetch from closure (stack et al)
            obj.symbol_stack = stack;
            obj.state_stack = sstack;
            obj.value_stack = vstack;
            obj.location_stack = lstack;
            obj.stack_pointer = sp;

            // ready the object for printing:
            obj = deepClone(obj);

            // wrap try/catch in a function to help the V8 JIT compiler...
            function yydebug_cvt(obj) {
                var js;
                try {
                    var re1;
                    if (typeof XRegExp === 'undefined') {
                        re1 = /  \"([a-z_][a-z_0-9. ]*)\": /ig;
                    } else {
                        re1 = new XRegExp('  \"([\\p{Alphabetic}_][\\p{Alphabetic}\\p{Number}_. ]*)\": ', 'g');
                    }
                    js = JSON.stringify(obj, null, 2).replace(re1, '  $1: ').replace(/[\n\s]+/g, ' ');
                } catch (ex) {
                    js = String(obj);
                }
                return js;
            }

            self.trace(msg, yydebug_cvt(obj), '\n');
        };
    }

    // disable debugging at run-time ANYWAY when you've *explicitly* set "yy.yydebug = false":
    if (sharedState_yy.yydebug === false) {
        yydebug = undefined;
    }

    // *Always* setup `yyError`, `YYRECOVERING`, `yyErrOk` and `yyClearIn` functions as it is paramount
    // to have *their* closure match ours -- if we only set them up once,
    // any subsequent `parse()` runs will fail in very obscure ways when
    // these functions are invoked in the user action code block(s) as
    // their closure will still refer to the `parse()` instance which set
    // them up. Hence we MUST set them up at the start of every `parse()` run!
    if (this.yyError) {
        this.yyError = function yyError(str /*, ...args */) {
            if (yydebug) yydebug('yyerror: ', { message: str, args: arguments, symbol: symbol, state: state, newState: newState, recovering: recovering, action: action });

//_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

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

//_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules

            var expected = this.collect_expected_token_set(state);
            var hash = this.constructParseErrorInfo(str, null, expected, false);

//_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

            // Add any extra args to the hash under the name `extra_error_attributes`:
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length) {
                hash.extra_error_attributes = args;
            }

            var r = this.parseError(str, hash, this.JisonParserError);
            return r;
        };
    }

//_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

    if (this.yyRecovering) {
        this.yyRecovering = function yyRecovering() {
            if (yydebug) yydebug('yyrecovering: ', { symbol: symbol, state: state, newState: newState, recovering: recovering, action: action });
            return recovering;
        };
    }

    if (this.yyErrOk) {
        this.yyErrOk = function yyErrOk() {
            if (yydebug) yydebug('yyerrok: ', { symbol: symbol, state: state, newState: newState, recovering: recovering, action: action });
            recovering = 0;

            // DO NOT reset/cleanup `recoveringErrorInfo` yet: userland code
            // MAY invoke this API before the error is actually fully
            // recovered, in which case the parser recovery code won't be able
            // to append the skipped tokens to this info object.
            // 
            // The rest of the kernel code is safe enough that it won't inadvertedly
            // re-use an old `recoveringErrorInfo` chunk so we'ld better wait
            // with destruction/cleanup until the end of the parse or until another
            // fresh parse error rears its ugly head...
            //
            // if (recoveringErrorInfo && typeof recoveringErrorInfo.destroy === 'function') {
            //     recoveringErrorInfo.destroy();
            //     recoveringErrorInfo = undefined;
            // }
        };
    }

    if (this.yyClearIn) {
        this.yyClearIn = function yyClearIn() {
            if (yydebug) yydebug('yyclearin: ', { symbol: symbol, newState: newState, recovering: recovering, action: action, preErrorSymbol: preErrorSymbol });
            if (symbol === TERROR) {
                symbol = 0;
                yytext = null;
                yyleng = 0;
                yyloc = undefined;
            }
            preErrorSymbol = 0;
        };
    }

//_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
//_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

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

//_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

            for (var i = this.__error_recovery_infos.length - 1; i >= 0; i--) {
                var el = this.__error_recovery_infos[i];
                if (el && typeof el.destroy === 'function') {
                    el.destroy();
                }
            }
            this.__error_recovery_infos.length = 0;

            // `recoveringErrorInfo` is also part of the `__error_recovery_infos` array,
            // hence has been destroyed already: no need to do that *twice*.
            if (recoveringErrorInfo) {
                recoveringErrorInfo = undefined;
            }

//_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
//_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

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

//_lexer_without_token_stack:

    function stdLex() {
        var token = lexer.lex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }

        return token || EOF;
    }

    function fastLex() {
        var token = lexer.fastLex();
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            token = self.symbols_[token] || token;
        }

        return token || EOF;
    }

    var lex = stdLex;

//_lexer_with_token_stack:

    // lex function that supports token stacks
    function tokenStackLex() {
        var token;
        token = tstack.pop() || lexer.lex() || EOF;
        // if token isn't its numeric value, convert
        if (typeof token !== 'number') {
            if (token instanceof Array) {
                tstack = token;
                token = tstack.pop();
            }
            // if token isn't its numeric value, convert
            if (typeof token !== 'number') {
                token = self.symbols_[token] || token;
            }
        }

        return token || EOF;
    }

//_lexer_with_token_stack_end:

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

//_handle_error_with_recovery:                    // run this code when the grammar includes error recovery rules

    // Return the rule stack depth where the nearest error rule can be found.
    // Return -1 when no error recovery rule was found.
    function locateNearestErrorRecoveryRule(state) {
        var stack_probe = sp - 1;
        var depth = 0;

        // try to recover from error
        while (stack_probe >= 0) {
            // check for error recovery rule in this state
            if (yydebug) yydebug('locateNearestErrorRecoveryRule #test#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
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
                if (yydebug) yydebug('locateNearestErrorRecoveryRule #found#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
                if (symbol === EOF) {
                    if (lastEofErrorStateDepth > sp - 1 - depth) {
                        lastEofErrorStateDepth = sp - 1 - depth;
                    } else {
                        if (yydebug) yydebug('locateNearestErrorRecoveryRule #skip#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
                        --stack_probe; // popStack(1): [symbol, action]
                        state = sstack[stack_probe];
                        ++depth;
                        continue;
                    }
                }
                return depth;
            }
            if (state === 0 /* $accept rule */ || stack_probe < 1) {
                if (yydebug) yydebug('locateNearestErrorRecoveryRule #end=NIL#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
                return -1; // No suitable error recovery rule available.
            }
            --stack_probe; // popStack(1): [symbol, action]
            state = sstack[stack_probe];
            ++depth;
        }
        if (yydebug) yydebug('locateNearestErrorRecoveryRule #EMPTY#: ', { symbol: symbol, state: state, depth: depth, stackidx: sp - 1 - depth, lastidx: lastEofErrorStateDepth });
        return -1; // No suitable error recovery rule available.
    }

//_handle_error_no_recovery:                      // run this code when the grammar does not include any error recovery rules
//_handle_error_end_of_section:                   // this concludes the error recovery / no error recovery code section choice above

    try {
        this.__reentrant_call_depth++;

        lexer.setInput(input, sharedState_yy);

        // NOTE: we *assume* no lexer pre/post handlers are set up *after* 
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

        yytext = lexer.yytext;
        yylineno = lexer.yylineno;
        yyleng = lexer.yyleng;

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

                if (yydebug) yydebug('after FETCH/LEX: ', { symbol: symbol, symbolID: this.terminals_ && this.terminals_[symbol], state: state, newState: newState, recovering: recovering, action: action });

//_handle_error_with_recovery:                // run this code when the grammar includes error recovery rules

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

                        // DO NOT cleanup the old one before we start the new error info track:
                        // the old one will *linger* on the error stack and stay alive until we 
                        // invoke the parser's cleanup API!
                        recoveringErrorInfo = this.shallowCopyErrorInfo(p);

                        r = this.parseError(p.errStr, p, this.JisonParserError);

                        if (yydebug) yydebug('error recovery rule detected: ', { error_rule_depth: error_rule_depth, error: p.errStr, error_hash: p });
                        // Protect against overly blunt userland `parseError` code which *sets*
                        // the `recoverable` flag without properly checking first:
                        // we always terminate the parse when there's no recovery rule available anyhow!
                        if (!p.recoverable || error_rule_depth < 0) {
                            if (typeof r !== 'undefined') {
                                retval = r;
                            }
                            break;
                        } else {
                            // TODO: allow parseError callback to edit symbol and or state at the start of the error recovery process...
                        }
                    }

                    if (yydebug) yydebug('after ERROR DETECT: ', { error_rule_depth: error_rule_depth, error: p.errStr, error_hash: p });

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
                        yyleng = lexer.yyleng;
                        yytext = lexer.yytext;
                        yylineno = lexer.yylineno;
                        yyloc = lexer.yylloc;

                        preErrorSymbol = 0;
                        symbol = lex();

                        if (yydebug) yydebug('after ERROR RECOVERY-3: ', { symbol: symbol, symbolID: this.terminals_ && this.terminals_[symbol] });
                    }

                    // try to recover from error
                    if (error_rule_depth < 0) {
                        ASSERT(recovering > 0, "line 897");
                        recoveringErrorInfo.info_stack_pointer = esp;

                        // barf a fatal hairball when we're out of look-ahead symbols and none hit a match
                        // while we are still busy recovering from another error:
                        var po = this.__error_infos[this.__error_infos.length - 1];

                        // Report error
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

                    preErrorSymbol = (symbol === TERROR ? 0 : symbol); // save the lookahead token
                    symbol = TERROR;            // insert generic error symbol as new lookahead

                    const EXTRA_STACK_SAMPLE_DEPTH = 3;

                    // REDUCE/COMBINE the pushed terms/tokens to a new ERROR token:
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
                        if (yydebug) yydebug('Error recovery process: pushed error info item on the info stack: ', {
                            item: vstack[sp],
                            sp,
                            esp,
                            vstack,
                            stack,
                            sstack,
                            combineState: NO_ACTION[1]
                        });
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

                    if (yydebug) yydebug('Error recovery process: performAction: COMBINE: ', {
                        yyval, yytext, sp, pop_size: yyrulelen, vstack, stack, sstack,
                        combineState: NO_ACTION[1]
                    });
                    r = this.performAction.call(yyval, yytext, yyleng, yylineno, yyloc, NO_ACTION[1], sp - 1, yyrulelen, vstack, lstack, stack, sstack);

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

                    if (yydebug) yydebug('after ERROR POP: ', { error_rule_depth: error_rule_depth, symbol: symbol, preErrorSymbol: preErrorSymbol });

                    // Now duplicate the standard parse machine here, at least its initial
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
                                // **Warning: Edge Case**: the *lexer* may produce
                                // TERROR tokens of its own volition: *those* TERROR
                                // tokens should be treated like *regular tokens*
                                // i.e. tokens which have a lexer-provided `yyvalue`
                                // and `yylloc`:
                                errorSymbolFromParser = false;
                            }
                            // read action for current state and first input
                            t = (table[state] && table[state][symbol]) || NO_ACTION;
                            newState = t[1];
                            action = t[0];

                            if (yydebug) yydebug('after FETCH/LEX: ', { symbol: symbol, symbolID: this.terminals_ && this.terminals_[symbol], state: state, newState: newState, recovering: recovering, action: action });

                            // encountered another parse error? If so, break out to main loop
                            // and take it from there!
                            if (!action) {
                                if (yydebug) yydebug('**NESTED ERROR DETECTED** while still recovering from previous error');

                                ASSERT(recoveringErrorInfo, "line 1087");

                                // Prep state variables so that upon breaking out of
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

                        if (yydebug) yydebug('::: SLOW ERROR RECOVERY PHASE CYCLE action: ' + (action === 1 ? 'shift token ' + symbol + ' (then go to state ' + newState + ')' : action === 2 ? 'reduce by rule: ' + newState + (function __print_rule(nt, state) {
                            if (!nt || !nt.states || !nt.rules)
                              return '';
                            var rulename = nt.states[state];
                            var rulespec = nt.rules[rulename][state];
                            return ' (' + rulespec.symbol + ' := ' + rulespec.handle + ')';
                        })(this.nonterminals_, newState) : action === 3 ? 'accept' : '???unexpected???'), { action: action, newState: newState, recovering: recovering, symbol: symbol });

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
                            stack[sp] = symbol;
                            // ### Note/Warning ###
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
                            symbol = 0;
                            // **Warning: Edge Case**: the *lexer* may have produced
                            // TERROR tokens of its own volition: *those* TERROR
                            // tokens should be treated like *regular tokens*
                            // i.e. tokens which have a lexer-provided `yyvalue`
                            // and `yylloc`:
                            errorSymbolFromParser = false;
                            if (!preErrorSymbol) { // normal execution / no error
                                // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:
                                yyleng = lexer.yyleng;
                                yytext = lexer.yytext;
                                yylineno = lexer.yylineno;
                                yyloc = lexer.yylloc;

                                if (recovering > 0) {
                                    recovering--;
                                    if (yydebug) yydebug('... SHIFT:error rule matching: ', { recovering: recovering, symbol: symbol });
                                }
                            } else {
                                // error just occurred, resume old lookahead f/ before error, *unless* that drops us straight back into error mode:
                                ASSERT(recovering > 0, "line 1163");
                                symbol = preErrorSymbol;
                                preErrorSymbol = 0;
                                if (yydebug) yydebug('... SHIFT:error recovery: ', { recovering: recovering, symbol: symbol });
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
                                    if (yydebug) yydebug('... SHIFT:error recovery: re-application of old symbol doesn\'t work: instead, we\'re moving forward now. ', { recovering: recovering, symbol: symbol });
                                    symbol = 0;
                                }
                            }

                            // once we have pushed the special ERROR token value,
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
                            this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                            yyrulelen = this_production[1];

                            if (yydebug) yydebug('~~~ REDUCE: ', { pop_size: yyrulelen, newState: newState, recovering: recovering, symbol: symbol });

                            r = this.performAction.call(yyval, yytext, yyleng, yylineno, yyloc, newState, sp - 1, yyrulelen, vstack, lstack, stack, sstack);

                            if (typeof r !== 'undefined') {
                                // signal end of error recovery loop AND end of outer parse loop
                                action = 3;
                                sp = -2;      // magic number: signal outer "fast parse loop" ACCEPT state that we already have a properly set up `retval` parser return value.
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
                            if (yydebug) yydebug('REDUCED: ', { newState: newState, recovering: recovering, symbol: symbol });
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
                            if (sp >= 0 && typeof vstack[sp] !== 'undefined') {
                                retval = vstack[sp];
                            }
                            sp = -2;      // magic number: signal outer "fast parse loop" ACCEPT state that we already have a properly set up `retval` parser return value.
                            break;
                        }

                        // break out of loop: we accept or fail with error
                        break;
                    }

                    // should we also break out of the regular/outer parse loop,
                    // i.e. did the parser already produce a parse result in here?!
                    // *or* did we hit an unsupported parse state, to be handled
                    // in the `switch/default` code further below?
                    ASSERT(action !== 2, "line 1272");
                    if (!action || action === 1) {
                        continue;
                    }
                }

//_handle_error_no_recovery:                  // run this code when the grammar does not include any error recovery rules

                // handle parse error
                if (!action) {
                    var errStr;
                    var errSymbolDescr = (this.describeSymbol(symbol) || symbol);
                    var expected = this.collect_expected_token_set(state);

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
                    // we cannot recover from the error!
                    p = this.constructParseErrorInfo(errStr, null, expected, false);
                    r = this.parseError(p.errStr, p, this.JisonParserError);
                    if (typeof r !== 'undefined') {
                        retval = r;
                    }
                    break;
                }

//_handle_error_end_of_section:                  // this concludes the error recovery / no error recovery code section choice above

            }

            if (yydebug) yydebug('::: MAIN CYCLE action: ' + (action === 1 ? 'shift token ' + symbol + ' (then go to state ' + newState + ')' : action === 2 ? 'reduce by rule: ' + newState + (function __print_rule(nt, state) {
                if (!nt || !nt.states || !nt.rules)
                  return '';
                var rulename = nt.states[state];
                var rulespec = nt.rules[rulename][state];
                return ' (' + rulespec.symbol + ' := ' + rulespec.handle + ')';
            })(this.nonterminals_, newState) : action === 3 ? 'accept' : '???unexpected???'), { action: action, newState: newState, recovering: recovering, symbol: symbol });

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
                }
                // Another case of better safe than sorry: in case state transitions come out of another error recovery process
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

                ASSERT(preErrorSymbol === 0, "line 1352");         // normal execution / no error
                ASSERT(recovering === 0, "line 1353");             // normal execution / no error

                // Pick up the lexer details for the current symbol as that one is not 'look-ahead' any more:
                yyleng = lexer.yyleng;
                yytext = lexer.yytext;
                yylineno = lexer.yylineno;
                yyloc = lexer.yylloc;
                continue;

            // reduce:
            case 2:
                ASSERT(preErrorSymbol === 0, "line 1364");         // normal execution / no error
                ASSERT(recovering === 0, "line 1365");             // normal execution / no error

                this_production = this.productions_[newState - 1];  // `this.productions_[]` is zero-based indexed while states start from 1 upwards...
                yyrulelen = this_production[1];

                if (yydebug) yydebug('~~~ REDUCE: ', { pop_size: yyrulelen, newState: newState, recovering: recovering, symbol: symbol });

                r = this.performAction.call(yyval, yytext, yyleng, yylineno, yyloc, newState, sp - 1, yyrulelen, vstack, lstack, stack, sstack);

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
                if (yydebug) yydebug('REDUCED: ', { newState: newState, recovering: recovering, symbol: symbol });
                continue;

            // accept:
            case 3:
                if (sp !== -2) {
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
            retval = false;
            r = this.parseError(p.errStr, p, this.JisonParserError);
            if (typeof r !== 'undefined') {
                retval = r;
            }
        }
    } finally {
        retval = this.cleanupAfterParse(retval, true, true);
        this.__reentrant_call_depth--;
    }   // /finally

    return retval;
}
