/*
 * Which advanced JISON features are showcased in this grammar?
 * ============================================================
 *
 * - lexer macro expansion inside regex sets, e.g. `[{NAME}...]`
 *
 * - `%options xregexp`, i.e. allowing the use of XRegExp escapes, e.g. to identify Unicode
 *   'letter' and/or 'digit' ranges. See also  http://xregexp.com/syntax/#unicode  and
     http://xregexp.com/plugins/#unicode
 *
 * The sample grammar itself is a toy language and only there to show the lexer features
 * at work.
 */








%lex


%options ranges
%options backtrack_lexer
%options xregexp








ASCII_LETTER                        [a-zA-z]
// \p{Alphabetic} already includes [a-zA-z], hence we don't need to merge with {ASCII_LETTER}:
UNICODE_LETTER_RANGE                [\p{Alphabetic}]

IDENTIFIER_START                    [{UNICODE_LETTER_RANGE}_]
IDENTIFIER_LAST                     [{IDENTIFIER_START}\p{Number}_]
IDENTIFIER_MIDDLE                   [{IDENTIFIER_LAST}.]

WHITESPACE                          [\s\r\n\p{Separator}]

NON_OPERATOR_CHAR                   [{WHITESPACE}{IDENTIFIER_LAST}]





/*
    https://github.com/mishoo/UglifyJS2/blob/master/lib/parse.js#L121
*/
ID                                  [{IDENTIFIER_START}][{IDENTIFIER_LAST}]*
DOTTED_ID                           [{IDENTIFIER_START}](?:[{IDENTIFIER_MIDDLE}]*[{IDENTIFIER_LAST}])?
WORD                                [{IDENTIFIER_LAST}]+
WORDS                               [{IDENTIFIER_LAST}](?:[\s{IDENTIFIER_LAST}]*[{IDENTIFIER_LAST}])?
DOTTED_WORDS                        [{IDENTIFIER_LAST}](?:[\s{IDENTIFIER_MIDDLE}]*[{IDENTIFIER_LAST}])?

OPERATOR                            [^{NON_OPERATOR_CHAR}]{1,3}

// Match simple floating point values, for example `1.0`, but also `9.`, `.05` or just `7`:
BASIC_FLOATING_POINT_NUMBER         (?:[0-9]+(?:"."[0-9]*)?|"."[0-9]+)



%%

// 1.0e7
[0-9]+\.[0-9]*(?:[eE][-+]*[0-9]+)?\b             
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// .5e7
[0-9]*\.[0-9]+(?:[eE][-+]*[0-9]+)?\b             
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// 5 / 3e4
[0-9]+(?:[eE][-+]*[0-9]+)?\b             
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

[a-zA-Z_]+[a-zA-Z_0-9]*\b
                      %{
                        if (is_constant(yytext)) {
                          return 'CONSTANT';
                        }
                        if (is_function(yytext)) {
                          return 'FUNCTION';
                        }
                        return 'VAR';
                      %}



{OPERATOR}
        %{
            /*
             * Check if the matched string STARTS WITH an operator in the list below.
             *
             * On the first pass, a hash table is created (and cached) to speed up matching.
             */
            if (!this.__operator_hash_table) {
                var definition_table = [
                    {
                        name: "$",
                        lexer_opcode: FKA_FIXED_ROW_OR_COLUMN_MARKER,
                        produce: function () {
                            return '$';
                        }
                    },
                    {
                        name: ":",
                        lexer_opcode: FKA_RANGE_MARKER,
                        produce: function () {
                            return ':';
                        }
                    },
                    {
                        name: "...",                   /* .. and ... equal : */
                        lexer_opcode: FKA_RANGE_MARKER,
                        produce: function () {
                            return ':';
                        }
                    },
                    {
                        name: "..",                    /* .. and ... equal : */
                        lexer_opcode: FKA_RANGE_MARKER,
                        produce: function () {
                            return ':';
                        }
                    },
                    {
                        name: ",",
                        lexer_opcode: FKA_COMMA,
                        produce: function () {
                            return ',';
                        }
                    },
                    {
                        name: "/*",
                        produce: function (loc) {
                            // set the end-of-comment marker for this comment and switch to parsing the comment
                            if (this.options.inline_comment_mode < this.inline_comments_monitor) {
                                this.inline_comment_end_markers = ["*/"];
                                this.inline_comment_start_yylloc = parser.deepCopy(loc);
                                this.pushState('INLINE_COMMENT');
                                return false;
                            }
                            // no dice, try another!
                            this.reject();
                        }
                    },
                    {
                        name: "(*",
                        produce: function (loc) {
                            // set the end-of-comment marker for this comment and switch to parsing the comment
                            if (this.options.inline_comment_mode < this.inline_comments_monitor) {
                                this.inline_comment_end_markers = ["*)"];
                                this.inline_comment_start_yylloc = parser.deepCopy(loc);
                                this.pushState('INLINE_COMMENT');
                                return false;
                            }
                            // no dice, try another!
                            this.reject();
                        }
                    },
                    {
                        name: "{*",
                        produce: function (loc) {
                            // set the end-of-comment marker for this comment and switch to parsing the comment
                            if (this.options.inline_comment_mode < this.inline_comments_monitor) {
                                this.inline_comment_end_markers = ["*}"];
                                this.inline_comment_start_yylloc = parser.deepCopy(loc);
                                this.pushState('INLINE_COMMENT');
                                return false;
                            }
                            // no dice, try another!
                            this.reject();
                        }
                    },
                    {
                        name: "#",
                        produce: function (loc) {
                            // set the end-of-comment marker for this comment and switch to parsing the comment
                            if (this.options.inline_comment_mode < this.inline_comments_monitor) {
                                this.inline_comment_end_markers = ["#"];
                                this.inline_comment_start_yylloc = parser.deepCopy(loc);
                                this.pushState('INLINE_COMMENT');
                                return false;
                            }
                            // no dice, try another!
                            this.reject();
                        }
                    },
                    {
                        name: "\u203c",                                  /* ‼ */
                        produce: function (loc) {
                            // set the end-of-comment marker for this comment and switch to parsing the comment
                            if (this.options.inline_comment_mode < this.inline_comments_monitor) {
                                this.inline_comment_end_markers = ["!!", "\u203c" /* ‼ */];
                                this.inline_comment_start_yylloc = parser.deepCopy(loc);
                                this.pushState('INLINE_COMMENT');
                                return false;
                            }
                            // no dice, try another!
                            this.reject();
                        }
                    },
                    {
                        name: "\u2590",                                  /* ▐ */
                        produce: function (loc) {
                            // set the end-of-comment marker for this comment and switch to parsing the comment
                            if (this.options.inline_comment_mode < this.inline_comments_monitor) {
                                this.inline_comment_end_markers = ["\u258c" /* ▌ */, "\u2590" /* ▐ */];
                                this.inline_comment_start_yylloc = parser.deepCopy(loc);
                                this.pushState('INLINE_COMMENT');
                                return false;
                            }
                            // no dice, try another!
                            this.reject();
                        }
                    },
                    {
                        name: "&&",
                        opcode: FKW_BOOLEAN_AND_OPERATOR | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'BOOLEAN_AND_OPERATOR';
                        }
                    },
                    {
                        name: "||",
                        opcode: FKW_BOOLEAN_OR_OPERATOR | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'BOOLEAN_OR_OPERATOR';
                        }
                    },
                    {
                        name: "&",
                        opcode: FKW_STRING_CONCATENATION_OPERATOR | FT_STRING | FU_STRING,
                        produce: function () {
                            return 'STRING_CONCATENATION_OPERATOR';
                        }
                    },
                    {
                        name: "<=",                                     // Unicode alternatives: \u22dc
                        opcode: FKW_LESS_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'LESS_OR_EQUAL';
                        }
                    },
                    {
                        name: ">=",                                     // Unicode alternatives: \u22dd
                        opcode: FKW_GREATER_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'GREATER_OR_EQUAL';
                        }
                    },
                    {
                        name: "\u2264",
                        opcode: FKW_LESS_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'LESS_OR_EQUAL';                         /* ≤ */
                        }
                    },
                    {
                        name: "\u2266",
                        opcode: FKW_LESS_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'LESS_OR_EQUAL';                         /* ≦ */
                        }
                    },
                    {
                        name: "\u2265",
                        opcode: FKW_GREATER_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'GREATER_OR_EQUAL';                      /* ≥ */
                        }
                    },
                    {
                        name: "\u2267",
                        opcode: FKW_GREATER_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'GREATER_OR_EQUAL';                      /* ≧ */
                        }
                    },
                    {
                        name: "<>",                                     // Unicode alternatives: \u2276, \u2277
                        opcode: FKW_NOT_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'NOT_EQUAL';
                        }
                    },
                    {
                        name: "!=",                                     // Unicode alternatives: \u2260
                        opcode: FKW_NOT_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'NOT_EQUAL';
                        }
                    },
                    {
                        name: "!==",
                        opcode: FKW_NOT_IDENTICAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'NOT_IDENTICAL';
                        }
                    },
                    {
                        name: "<",
                        opcode: FKW_LESS_THAN | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return '<';
                        }
                    },
                    {
                        name: ">",
                        opcode: FKW_GREATER_THAN | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return '>';
                        }
                    },
                    {
                        name: "===",
                        opcode: FKW_IS_IDENTICAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'IS_IDENTICAL';
                        }
                    },
                    {
                        name: "==",
                        opcode: FKW_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'IS_EQUAL';
                        }
                    },
                    {
                        name: "=",
                        opcode: FKW_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            // This MAY be the `=` starting a formula: mark the event for the inline comments:
                            if (this.options.inline_comment_mode > 0) {
                                if (!this.inline_comments_monitor) {
                                    this.inline_comments_monitor = this.options.inline_comment_mode + 1;
                                }
                            }
                            return '=';
                        }
                    },
                    {
                        name: "**",
                        opcode: FKW_POWER | FT_NUMBER | FU_ANY,
                        produce: function () {
                            return '^';
                        }
                    },
                    {
                        name: "*",
                        opcode: FKW_MULTIPLY | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '*';
                        }
                    },
                    {
                        name: "/",
                        opcode: FKW_DIVIDE | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '/';
                        }
                    },
                    {
                        name: "-",
                        opcode: FKW_SUBTRACT | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '-';
                        }
                    },
                    {
                        name: "+",
                        opcode: FKW_ADD | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '+';
                        }
                    },
                    {
                        name: "^",
                        opcode: FKW_POWER | FT_NUMBER | FU_ANY,
                        produce: function () {
                            return '^';
                        }
                    },
                    {
                        name: "%",
                        opcode: FKW_MODULO_OPERATOR,
                        produce: function () {
                            return 'MODULO_OPERATOR';
                        }
                    },
                    {
                        name: "\u2030",
                        opcode: FKW_PROMILAGE_OPERATOR,
                        produce: function () {
                            return 'PROMILAGE_OPERATOR';                 /* ‰ */
                        }
                    },
                    {
                        name: "\u221a",
                        opcode: FKW_SQRT_OPERATOR | FT_NUMBER | FU_ANY,
                        produce: function () {
                            return 'SQRT_OPERATOR';                     /* √ */
                        }
                    },
                    {
                        name: "\u2248",
                        opcode: FKW_ALMOST_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'ALMOST_EQUAL';                      /* ≈ */
                        }
                    },
                    {
                        name: "\u2260",
                        opcode: FKW_NOT_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'NOT_EQUAL';                         /* ≠ */
                        }
                    },
                    {
                        name: "\u2264",
                        opcode: FKW_LESS_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'LESS_OR_EQUAL';                     /* ≤ */
                        }
                    },
                    {
                        name: "\u2265",
                        opcode: FKW_GREATER_OR_EQUAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'GREATER_OR_EQUAL';                  /* ≥ */
                        }
                    },
                    {
                        name: "\u2212",
                        opcode: FKW_SUBTRACT | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '-';                                 /* − */
                        }
                    },
                    {
                        name: "\u2013",
                        opcode: FKW_SUBTRACT | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '-';                                 /* – */
                        }
                    },
                    {
                        name: "\u2012",
                        opcode: FKW_SUBTRACT | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '-';                                 /* ‒ */
                        }
                    },
                    {
                        name: "\u2014",
                        opcode: FKW_SUBTRACT | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '-';                                 /* — */
                        }
                    },
                    {
                        name: "\u2215",
                        opcode: FKW_DIVIDE | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '/';                                 /* ∕ */
                        }
                    },
                    {
                        name: "\u2044",
                        opcode: FKW_DIVIDE | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '/';                                 /* ⁄ */
                        }
                    },
                    {
                        name: "\u2219",
                        opcode: FKW_MULTIPLY | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '*';                                 /* ∙ */
                        }
                    },
                    {
                        name: "\u2022",
                        opcode: FKW_MULTIPLY | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '*';                                 /* • */
                        }
                    },
                    {
                        name: "\u2261",
                        opcode: FKW_IS_IDENTICAL | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'IS_IDENTICAL';                      /* ≡ */
                        }
                    },
                    {
                        name: "\u2310",
                        opcode: FKW_BOOLEAN_NOT_OPERATOR | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return '!';                                 /* ⌐ */
                        }
                    },
                    {
                        name: "\u00ac",
                        opcode: FKW_BOOLEAN_NOT_OPERATOR | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return '!';                                 /* ¬ */
                        }
                    },
                    {
                        name: "!",
                        opcode: FKW_BOOLEAN_NOT_OPERATOR | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return '!';
                        }
                    },
                    {
                        name: "\u2229",
                        opcode: FKW_BOOLEAN_AND_OPERATOR | FT_BOOLEAN | FU_DERIVED,
                        produce: function () {
                            return 'BOOLEAN_AND_OPERATOR';              /* ∩ */
                        }
                    },
                    {
                        name: "\u00f7",
                        opcode: FKW_DIVIDE | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '/';                                 /* ÷ */
                        }
                    },
                    {
                        name: "\u00d7",
                        opcode: FKW_MULTIPLY | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '*';                                 /* × */
                        }
                    },
                    {
                        name: "\u00b7",
                        opcode: FKW_MULTIPLY | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '*';                                 /* · */
                        }
                    },
                    {
                        name: "\u2219",
                        opcode: FKW_MULTIPLY | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return '*';                                 /* ∙ */
                        }
                    },
                    {
                        name: "\u00b0",
                        opcode: FKW_DEGREES_OPERATOR,
                        produce: function () {
                            return 'DEGREES_OPERATOR';                  /* ° */
                        }
                    },
                    {
                        name: "\u00b2",
                        opcode: FKW_SQUARE_OPERATOR | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return 'SQUARE_OPERATOR';                   /* ² */
                        }
                    },
                    {
                        name: "\u00b3",
                        opcode: FKW_CUBE_OPERATOR | FT_NUMBER | FU_DERIVED,
                        produce: function () {
                            return 'CUBE_OPERATOR';                     /* ³ */
                        }
                    },
                    {
                        /*
                         * This token is an alternative notation which does not require the curly braces around
                         * a 'fragmented range reference', e.g. `{A1, A2, A3, B1}` is equivalent to `A1 ○ A2 ○ A3 ○ B1`
                         * which could also be written as `A1:A3 ○ B1`
                         */
                        name: "\u25cb",
                        opcode: FKW_ARRAY_CONCATENATION_OPERATOR,
                        produce: function () {
                            return 'ARRAY_CONCATENATION_OPERATOR';      /* ○ */
                        }
                    },
                    {
                        /*
                         * This token is an alternative notation which does not require the curly braces around
                         * a 'fragmented range reference', e.g. `{A1, A2, A3, B1}` is equivalent to `A1 ◦ A2 ◦ A3 ◦ B1`
                         * which could also be written as `A1:A3 ◦ B1`
                         */
                        name: "\u25e6",
                        opcode: FKW_ARRAY_CONCATENATION_OPERATOR,
                        produce: function () {
                            return 'ARRAY_CONCATENATION_OPERATOR';      /* ◦ */
                        }
                    },
                    {
                        name: "@",
                        opcode: FKW_DATA_MARKER,
                        produce: function () {
                            return '@';
                        }
                    },
                    {
                        name: ".",
                        opcode: FKW_DOT,
                        produce: function () {
                            // switch lexer modes RIGHT NOW: next up is the `json_filter_expression` rule!
                            assert(this.topState() !== 'JSON_FILTERING');
                            //this.pushState('JSON_FILTERING');   -- Fixed #880 

                            return '.';
                        }
                    }
                ];
                var k, d, tlen, ht;

                ht = [{}, {}, {}, {}];
                for (var k = 0, tlen = definition_table.length; k < tlen; k++) {
                    d = definition_table[k];
                    assert(d.name);
                    ht[d.name.length][d.name] = d;
                }

                this.__operator_hash_table = ht;
            }

            var s1 = false, s2 = false, s3 = false;

            s = yytext;
            switch (s.length) {
            case 3:
                s3 = s;
                s = s.substr(0, 2);
                // fall through
            case 2:
                s2 = s;
                s = s.substr(0, 1);
                // fall through
            case 1:
                s1 = s;
                break;
            default:
                assert(0, "should never get here");
                break;
            }

            // reset `s`:
            s = yytext;

            // now find matches in the operator lookup table, largest match first:
            rv = this.__operator_hash_table[3][s3] || this.__operator_hash_table[2][s2] || this.__operator_hash_table[1][s1];
            if (rv) {
                // push the remainder back into the buffer before we continue:
                if (s.length > rv.name.length) {
                    this.unput(s.substr(rv.name.length));
                }

                if (rv.opcode) {
                    yytext = (new Visyond.FormulaParser.ASTopcode(rv.opcode))
                        .setLocationInfo(yylloc)
                        .setCommentsIndex(parser.getNextCommentIndex())
                        .setLexedText(rv.name);
                } else if (rv.lexer_opcode) {
                    yytext = (new Visyond.FormulaParser.lexerToken(rv.lexer_opcode))
                        .setLocationInfo(yylloc)
                        .setCommentsIndex(parser.getNextCommentIndex())
                        .setLexedText(rv.name);
                }
                return rv.produce.call(this, yylloc, yytext);
            }

            /* This may be a single Unicode character representing some constant or currency */
            if (s.length > 1) {
                this.unput(s.substr(1));
            }
            s = s1;

            rv = parser.getSymbol4Currency(s);
            if (rv) {
                yytext = (new Visyond.FormulaParser.ASTcurrency.ASTcurrency(rv))
                    .setLocationInfo(yylloc)
                    .setCommentsIndex(parser.getNextCommentIndex())
                    .setLexedText(s);
                return 'CURRENCY';
            }

            // no dice, now see if this is a predefined constant
            rv = parser.getSymbol4DefinedConstant(s);
            if (rv) {
                yytext = (new Visyond.FormulaParser.ASTvalue(rv.value, rv.attributes))
                    .setPredefinedConstantInfo(rv)
                    .setLocationInfo(yylloc)
                    .setCommentsIndex(parser.getNextCommentIndex())
                    .setLexedText(s);
                switch (yytext.getValueType()) {
                default:
                    return 'CONSTANT';

                case FT_BOOLEAN:
                    if (rv.value)
                        return 'TRUE';
                    else
                        return 'FALSE';

                case FT_STRING:
                    return 'STRING';
                }
            }

            // when we don't have a match at all, we leave it to the other rules to hit something:
            this.reject();
        %}






/*
 * String Handling
 * ---------------
 */


"\u2039"([^\u203a]*)"\u203a"
        %{                                                  /* ‹string› */
            s = this.matches[1];
            yytext = (new Visyond.FormulaParser.ASTvalue(s, FKW_VALUE | FT_STRING | FU_STRING))
                .setNotationAttributes(FKA_DELIMITERS_2039)
                .setLocationInfo(yylloc)
                .setCommentsIndex(parser.getNextCommentIndex());
            return 'STRING';
        %}

"\u201c"([^\u201d]*)"\u201d"
        %{                                                  /* “string” */
            s = this.matches[1];
            yytext = (new Visyond.FormulaParser.ASTvalue(s, FKW_VALUE | FT_STRING | FU_STRING))
                .setNotationAttributes(FKA_DELIMITERS_201C)
                .setLocationInfo(yylloc)
                .setCommentsIndex(parser.getNextCommentIndex());
            return 'STRING';
        %}

"\u00ab"([^\u00bb]*)"\u00bb"
        %{                                                  /* «string» */
            s = this.matches[1];
            yytext = (new Visyond.FormulaParser.ASTvalue(s, FKW_VALUE | FT_STRING | FU_STRING))
                .setNotationAttributes(FKA_DELIMITERS_00AB)
                .setLocationInfo(yylloc)
                .setCommentsIndex(parser.getNextCommentIndex());
            return 'STRING';
        %}



"'"([^']*(?:"''"[^']*)*)"'"(?={DUALIC_OPERATOR_MUST_FOLLOW})
        %{
            // this.unput(this.matches[2]);

            s = this.matches[1];
            s2 = parser.dedupQuotedString(s, "'");
            yytext = (new Visyond.FormulaParser.ASTvalue(s2, FKW_VALUE | FT_STRING | FU_STRING))
                .setNotationAttributes(FKA_DELIMITERS_SINGLEQUOTE)
                .setLocationInfo(yylloc)
                .setCommentsIndex(parser.getNextCommentIndex());
            return 'STRING';
        %}

'"'([^"]*(?:'""'[^"]*)*)'"'(?={DUALIC_OPERATOR_MUST_FOLLOW})
        %{
            // this.unput(this.matches[2]);

            s = this.matches[1];
            s2 = parser.dedupQuotedString(s, '"');
            yytext = (new Visyond.FormulaParser.ASTvalue(s2, FKW_VALUE | FT_STRING | FU_STRING))
                .setNotationAttributes(FKA_DELIMITERS_DOUBLEQUOTE)
                .setLocationInfo(yylloc)
                .setCommentsIndex(parser.getNextCommentIndex());
            return 'STRING';
        %}





/*
 * Comment parsing
 * ---------------
 */


<INLINE_COMMENT>[^\/\*\)\}#!\u203c\u258c\u2590]+
        %{                                                  /* * / ) | # ! ‼ ▌ ▐ */
            /* keep it all; we haven't hit an end-of-comment marker starting character yet! */
            this.more();
        %}

<INLINE_COMMENT>.
        %{
            for (rv = 0, len = this.inline_comment_end_markers.length; rv < len; rv++) {
                s2 = this.inline_comment_end_markers[rv];
                if (s2[0] === this.matches[0]) {
                    // we got a POTENTIAL MATCH; let's see if we need more:
                    if (s2.length > 1) {
                        // when yes, test the next rule!
                        this.reject();
                        return false;
                    } else {
                        /*
                        * Full match! end of comment reached.
                        *
                        * Remove this last bit from the parsed text and strip leading / trailing whitespace.
                        *
                        * > ### Notes
                        * >
                        * > Since returning actual tokens for any inline comments would
                        * > break the LALR(1) grammar most severely, we concatenate
                        * > comments and attach them to the next token.
                        * >
                        * > Since the 'next token' MAY be `EOF`, we need the parser
                        * > to check if there's any leech called `comment` hanging
                        * > off that EOF it might've got dropped in the in-box...
                        */
                        parser.pushComment();
                        this.popState();
                        return false;
                    }
                }
            }
            // collect input until we hit something we know:
            this.more();
        %}

<INLINE_COMMENT>..
        %{
            /*
             * We only hit this rule when the previous one was `reject()`-ed
             * as that rule will match anything that's the start of this one.
             *
             * Hence we know we have a partial match on a comment terminator,
             * but we need to make sure.
             *
             * We also know that our longest 'end markers' are 2 characters wide,
             * so this solution is sufficient and complete.
             *
             * Now all we have to do is scan the longer-than-1-character
             * comment markers against what we've got here and if there's
             * NO MATCH, we need to keep in mind that nasty people can write
             * comments like `{***}` and we have a hit on `**}` so we may only
             * consume one character here in that case.
             */
            for (rv = 0, len = this.inline_comment_end_markers.length; rv < len; rv++) {
                s2 = this.inline_comment_end_markers[rv];
                if (s2 === this.matches[0]) {
                    /*
                     * Full match! end of comment reached.
                     *
                     * Remove this last bit from the parsed text and strip leading/trailing whitespace.
                     *
                     * Since returning actual tokens for any inline comments would
                     * break the LALR(1) grammar most severely, we concatenate
                     * comments and attach them to the next token.
                     *
                     * Since the 'next token' MAY be `EOF`, we need the parser
                     * to check if there's any leech called `comment` hanging
                     * of that EOF it might've got dropped in the in-box...
                     */
                    parser.pushComment();
                    this.popState();
                    return false;
                }
            }
            // we may only consume a single character, so we `unput()` the last one:
            this.less(1);

            // collect input until we hit something we know:
            this.more();
        %}

<INLINE_COMMENT><<EOF>>
        %{
            // Check if this is a comment type which does not have to be 'terminated':
            for (rv = 0, len = this.inline_comment_end_markers.length; rv < len; rv++) {
                s2 = this.inline_comment_end_markers[rv];
                if (s2 === "") {
                    /*
                    * Full match! end of comment reached.
                    *
                    * Remove this last bit from the parsed text and strip leading / trailing whitespace.
                    *
                    * > ### Notes
                    * >
                    * > Since returning actual tokens for any inline comments would
                    * > break the LALR(1) grammar most severely, we concatenate
                    * > comments and attach them to the next token.
                    * >
                    * > Since the 'next token' MAY be `EOF`, we need the parser
                    * > to check if there's any leech called `comment` hanging
                    * > off that EOF it might've got dropped in the in-box...
                    */
                    parser.pushComment();
                    this.popState();
                    return false;
                }
            }

            // Otherwise, flag this as an unterminated and thus illegal comment chunk.
            parser.pushComment();

            yytext = (new Visyond.FormulaParser.ASTerror(FERR_UNTERMINATED_INLINE_COMMENT, "Unterminated inline comment."))
                .setErrorArguments(this.inline_comment_end_markers)
                .setLocationInfo(yylloc)
                .setCommentsIndex(parser.getNextCommentIndex())
                .setLexedText(yytext);
            return 'error';
        %}





'='                     return '=';
'-'                     return '-';
'+'                     return '+';
'*'                     return '*';
'/'                     return '/';
'^'                     return 'POWER';    /* Exponentiation        */
'('                     return '(';
')'                     return ')';
','                     return ',';
'!'                     return '!';
'%'                     return '%';


[\r\n]+                 return 'NL';

[^\S\r\n]+              // ignore whitespace

\/\/.*                  // skip comments
\/\*.*?\*\/             // skip comments

<<EOF>>                 return 'EOF';
.                       return 'INVALID';


/lex



%token      NUM             // Simple double precision number  
%token      VAR FUNCTION    // Variable and Function            
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E

%token      END             // token to mark the end of a function argument list in the output token stream


%right  '='
%left   '-' '+'
%left   '*' '/'
%right  POWER  
%right '!'
%right '%'
%right  UMINUS     /* Negation--unary minus */
%right  UPLUS      /* unary plus */

/* Grammar follows */

%start input



%{
    /*
     * This chunk is included in the parser code, before the lexer definition section and after the parser has been defined.
     *
     * WARNING:
     *
     * Meanwhile, keep in mind that all the parser actions, which will execute inside the `parser.performAction()` function,
     * will have a `this` pointing to `$$`.
     *
     * If you want to access the lexer and/or parser, these are accessible inside the parser rule action code via
     * the `yy.lexer` and `yy.parser` dereferences respectively.
     */

    //console.log("parser object definition: ", this);
%}


%% /* language grammar */




input:   
  /* empty */
                                { $$ = []; }
| input line
                                { $$ = $input.concat($line); }
;

line:
  NL
                                { $$ = []; }
| EOF
                                { $$ = []; }
| exp NL   
                                { 
                                    console.log('line: ', JSON.stringify($exp, null, 2)); 

                                    $$ = $exp.concat(#NL#);
                                }
| error NL 
                                { 
                                    yyerrok;
                                    yyclearin;
                                    console.log('skipped erroneous input line');
                                    $$ = [];
                                }
;

exp:
  NUM                
                                { $$ = [-#NUM, $NUM]; }
| CONSTANT                
                                { $$ = [-#CONSTANT, $CONSTANT]; }
| VAR                
                                { $$ = [-#VAR, $VAR]; }
| VAR '='[assign] exp        
                                { $$ = [#assign, -#VAR, $VAR].concat($exp); }
| FUNCTION '(' ')'
                                { $$ = [-#FUNCTION, $FUNCTION, #END#]; }
| FUNCTION '(' arglist ')'
                                { $$ = [-#FUNCTION, $FUNCTION].concat($arglist, #END#); }
| exp '+'[add] exp        
                                { $$ = [#add].concat($exp1, $exp2); }
| exp '-'[subtract] exp        
                                { $$ = [#subtract].concat($exp1, $exp2); }
| exp '*'[multiply] exp        
                                { $$ = [#multiply].concat($exp1, $exp2); }
| exp '/'[divide] exp        
                                { $$ = [#divide].concat($exp1, $exp2); }
| '-' exp       %prec UMINUS 
                                { $$ = [#UMINUS#].concat($exp); }
| '+' exp       %prec UPLUS
                                { $$ = [#UPLUS#].concat($exp); }
| exp POWER exp        
                                { $$ = [#POWER].concat($exp1, $exp2); }
| exp '%'[percent]        
                                { $$ = [#percent].concat($exp); }
| exp '!'[facult]        
                                { $$ = [#facult].concat($exp); }
| '(' exp ')'        
                                { $$ = $exp; }
;

arglist:
  exp
                                { $$ = $exp; }
| exp ','[comma] arglist
                                { $$ = [#comma].concat($exp, $arglist); }
;



// FAKE rule to make sure the tokens all make it into the symbol table for use in the next phase:
phony: UMINUS UPLUS END
;

/* End of grammar */


%%

