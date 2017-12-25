
var API = {
    TERROR: 2,
    EOF: 1,

    // internals: defined here so the object *structure* doesn't get modified by parse() et al,
    // thus helping JIT compilers like Chrome V8.
    originalQuoteName: null,
    originalParseError: null,
    cleanupAfterParse: null,
    constructParseErrorInfo: null,
    yyMergeLocationInfo: null,

    __reentrant_call_depth: 0,      // INTERNAL USE ONLY
    __error_infos: [],              // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup
    __error_recovery_infos: [],     // INTERNAL USE ONLY: the set of parseErrorInfo objects created since the last cleanup

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
        }

        // Otherwise... this might refer to a RULE token i.e. a non-terminal: see if we can dig that one up.
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
        }
        else if (symbol === this.EOF) {
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
        var check = {};
        // Has this (error?) state been outfitted with a custom expectations description text for human consumption?
        // If so, use that one instead of the less palatable token set.
        if (!do_not_describe && this.state_descriptions_ && this.state_descriptions_[state]) {
            return [
                this.state_descriptions_[state]
            ];
        }
        for (var p in this.table[state]) {
            p = +p;
            if (p !== TERROR) {
                var d = do_not_describe ? p : this.describeSymbol(p);
                if (d && !check[d]) {
                    tokenset.push(d);
                    check[d] = true;        // Mark this token description as already mentioned to prevent outputting duplicate entries.
                }
            }
        }
        return tokenset;
    }
};
