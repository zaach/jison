// title: Simple lexer example - a lexer spec without any errors
// test_input: DEFINE A = B × C
// ...
//  


%code imports %{
  import JSON5 from '@gerhobbelt/json5';

  import helpers from '../../helpers-lib';
%}



ASCII_LETTER                            [a-zA-z]
// \p{Alphabetic} already includes [a-zA-z], hence we don't need to merge
// with {UNICODE_LETTER} (though jison has code to optimize if you *did*
// include the `[a-zA-Z]` anyway):
UNICODE_LETTER                          [\p{Alphabetic}]
ALPHA                                   [{UNICODE_LETTER}_]
DIGIT                                   [\p{Number}]
WHITESPACE                              [\s\r\n\p{Separator}]
ALNUM                                   [{ALPHA}{DIGIT}]

NAME                                    [{ALPHA}](?:[{ALNUM}-]*{ALNUM})?
ID                                      [{ALPHA}]{ALNUM}*
DECIMAL_NUMBER                          [1-9][0-9]*
HEX_NUMBER                              "0"[xX][0-9a-fA-F]+
BR                                      \r\n|\n|\r
// WhiteSpace MUST NOT match CR/LF and the regex `\s` DOES, so we cannot use
// that one directly. Instead we define the {WS} macro here:
WS                                      [^\S\r\n]

// Quoted string content: support *escaped* quotes inside strings:
QUOTED_STRING_CONTENT                   (?:\\\'|\\[^\']|[^\\\'\r\n])*
DOUBLEQUOTED_STRING_CONTENT             (?:\\\"|\\[^\"]|[^\\\"\r\n])*
// backquoted ES6/ES2017 string templates MAY span multiple lines:
ES2017_STRING_CONTENT                   (?:\\\`|\\[^\`]|[^\\\`])*

// Accept any non-regex-special character as a direct literal without
// the need to put quotes around it:
ANY_LITERAL_CHAR                        [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,\'\"\`;]



%s rules macro
%x code options action set



%options easy_keyword_rules
%options ranges
%options xregexp



%%

// Comments should be gobbled and discarded anywhere
// *except* the code/action blocks:
<INITIAL,macro,options,rules>"//"[^\r\n]*
                                        /* skip single-line comment */
<INITIAL,macro,options,rules>"/*"[^]*?"*/"
                                        /* skip multi-line comment */

// Here we recognize the action code blocks in a grammar parser spec, including those chunks of
// user-defined action code which are wrapped in `%{...%}` or `{{...}}`.
//
// These `%{...%}` and `{{...}}` chunks are special in that *anything 
// **except the given 'end marker' (`%}` and `}}` respectively)** may 
// exist within the markers: those contents will be copied verbatim.
//
// Note the 'fringe case' where one or more of those end markers 
// is an integral part of your action code: you then have the choice to
// either use the other chunk format *or* not wrap [that part of] your
// code in any special marker block, but rely on the lexer rules for
// parsing a regular `{...}` JavaScript code chunk instead.
//
// Thus these won't lex/parse correctly:
//
// `%{ return '%}'; %}`
// `{{ return '{{}}'; }}`
// `{{ return '%{ {{ }} %}'; }}`
//
// while these would:
//
// `{{ return '%}'; }}`
// `%{ return '{{}}'; %}`
// `{ return '%{ {{ }} %}'; }`
// `{ return '%}'; }`
// `{ return '{{}}'; }`
//
// Since 0.6.5 we also allow another approach, which can be used instead: 
// 'repeated `{` markers', which is like the `%{...%}` and `{{...}}` in that
// anything that's not the corresponding end marker is accepted as content
// as far as the lexer is concerned (the parser will want to check the validity
// of the entire action code block before using it as part of the generated
// lexer/parser kernel code though), e.g. these would lex as valid chunks:
//
// `%{{ return '%}'; %}}`
// `{{{ return '{{}}'; }}}`
// `{{{ return '%{ {{ }} %}'; }}}`
// `%{{{ return ['%}','%}}']; %}}}`
//
// To speed up the lexer and keep things simple, we test these lexer rules
// *only when we're sure to match them*, while we use an advanced
// feature of the lexer kernel by *generating the proper lexer rule regex on the fly*
// at the moment when we find we need it: for this we employ some 
// intimate knowledge of the lexer kernel which will be generated for this 
// lexer spec: for this we only the lexer rule for `%{...%}` to exist, as
// we will pick up that one and modify it on the fly as the need occurs.
//

<action>"%{"([^]*?)"%}"                 yytext = this.matches[1];
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY';

<action>"%include"                      if (yy.include_command_allowed) {
                                            // This is an include instruction in place of (part of) an action:
                                            this.pushState('options');
                                            return 'INCLUDE';
                                        } else {
                                            // TODO
                                            yyerror(rmCommonWS`
                                                %include statements must occur on a line on their own and cannot occur inside an %{...%} action code block.
                                                Its use is not permitted at this position.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yylloc));
                                            return 'INCLUDE_PLACEMENT_ERROR';
                                        }

<action>"/*"[^]*?"*/"                   //yy.include_command_allowed = false; -- doesn't impact include-allowed state
                                        return 'ACTION_BODY';
<action>"//".*                          yy.include_command_allowed = false;
                                        return 'ACTION_BODY';

// make sure to terminate before the next rule alternative,
// which is announced by `|`:
<action>"|"                             if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        }

// make sure to terminate before the rule section ends,
// which is announced by `%%`:
<action>"%%"                            if (yy.include_command_allowed /* && yy.depth === 0 */) {
                                            this.popState();
                                            this.unput(yytext);
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';
                                        }

// regexp in action code handling:
//
// simply scan using an Esprima-equivalent regex scanner: when the next
// bit turns out to be a regex, assume it is one and pass it on.
<action>"/".*
                                        yy.include_command_allowed = false;
                                        var l = scanRegExp(yytext);
                                        if (l > 0) {
                                            this.unput(yytext.substring(l));
                                            yytext = yytext.substring(0, l);
                                        } else {
                                            // assume it's a division operator:
                                            this.unput(yytext.substring(1));
                                            yytext = yytext[0];
                                        }
                                        return 'ACTION_BODY';

<action>\"{DOUBLEQUOTED_STRING_CONTENT}\"|\'{QUOTED_STRING_CONTENT}\'|\`{ES2017_STRING_CONTENT}\`
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY';
<action>[^/"'`|%\{\}{BR}{WS}]+          yy.include_command_allowed = false;
                                        return 'ACTION_BODY';
<action>"%"                             yy.include_command_allowed = false;
                                        return 'ACTION_BODY';

<action>"{"                             yy.depth++;
                                        yy.include_command_allowed = false;
                                        return 'ACTION_BODY';
<action>"}"                             yy.include_command_allowed = false;
                                        if (yy.depth <= 0) {
                                            yyerror(rmCommonWS`
                                                too many closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yylloc));
                                            return 'BRACKET_SURPLUS';
                                        } else {
                                            yy.depth--;
                                        }
                                        return 'ACTION_BODY';

// make sure to terminate before the next rule alternative,
// which is announced by `|` or any regex or options.
//
// Note that lexer options & commands should be at the start-of-line, i.e.
// without leading whitespace. The only lexer command which we do accept
// here after the last indent is `%include`, which is considered (part
// of) the rule's action code block.
<action>(?:[\s\r\n]*?){BR}+{WS}+/[^{WS}{BR}|]
                                        yy.include_command_allowed = true;
                                        return 'ACTION_BODY';           // keep empty lines as-is inside action code blocks.
<action>{WS}+                           return 'ACTION_BODY';
<action>{BR}                            if (yy.depth > 0) {
                                            yy.include_command_allowed = true;
                                            return 'ACTION_BODY';       // keep empty lines as-is inside action code blocks.
                                        } else {
                                            // end of action code chunk; allow parent mode to see this mode-terminating linebreak too.
                                            this.popState();
                                            this.unput(yytext);
                                            return 'ACTION_END';
                                        }
<action><<EOF>>                         yy.include_command_allowed = false;
                                        if (yy.depth !== 0) {
                                            yyerror(rmCommonWS`
                                                missing ${yy.depth} closing curly braces in lexer rule action block.

                                                Note: the action code chunk may be too complex for jison to parse
                                                easily; we suggest you wrap the action code chunk in '%{...%}'
                                                to help jison grok more or less complex action code chunks.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yylloc));
                                            return 'BRACKET_MISSING';
                                        }
                                        this.popState();
                                        return 'ACTION_END';

//
// Recognize any of these action code start markers:
// `{`, `%{`, `{{`, `%{{`, `{{{`, `%{{{`, ...
// and modify the lexer engine to provide the proper matching rule for the case at hand 
// (which is NIL in case the action code chunk starts with `{`!) as described near the
// top of this lexer spec file, where the action state lexer rules reside.
//
<INITIAL,rules,options>[%\{]\{+       {
                                        yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');

                                        // Make sure we've the proper lexer rule regex active for any possible `%{...%}`, `{{...}}` or what have we here?
                                        this.setupDelimitedActionChunkLexerRegex(yytext, yy);

                                        // Allow the start marker to be re-matched by the generated lexer rule regex:
                                        this.unput(yytext);

                                        // and allow the next lexer round to match and execute the suitable lexer rule(s) to parse this incoming action code block. 
                                        return 'ACTION_START';
                                    }

"->"                                    yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START';
"→"                                     yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START';
"=>"                                    yy.depth = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action');
                                        return 'ARROW_ACTION_START';


// ACTION code chunks follow rules and are generally indented and
// may start with the '%' character which is special to the JISON lex language itself:
// - `%` can start options, commands, etc., e.g. `%include` or `%options`, 
//   of which only `%include` is allowed inside an action chunk.
// - `|` starts a rule alternative, never a chunk of action code.
// - `%%` delimits a lexer spec section and should always be placed at the start
//   of a new line, as are most other lexer spec entities.
<rules>{WS}+/[^{WS}{BR}|]               yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        return 'ACTION_START';

<rules>"%%"                             this.popState();
                                        this.pushState('code');
                                        return '%%';
// Also support those lexers which don't have a trailing code section
// by faking a '%%' sentinel and an empty code section following that
// one:
<rules><<EOF>>                          this.popState();
                                        this.pushState('code');
                                        return '%%';

<options>{

"="                                     return '=';

\"{DOUBLEQUOTED_STRING_CONTENT}\"       return 'OPTION_STRING';
\'{QUOTED_STRING_CONTENT}\'             return 'OPTION_STRING';
\`{ES2017_STRING_CONTENT}\`             return 'OPTION_STRING';

// make sure to terminate before the section ends,
// which is announced by `%%`:
"%%"                                    this.popState();
                                        this.unput(yytext);
                                        return 'OPTIONS_END';

// some options may be followed by an action block or `%include`d action block:
// when this happens, let the parser cope by stacking an 'action' mode inside
// the 'options' mode. 
// This is necessary to get a different lexer token stream for these two scenarios, 
// which are functionally different:
//
//     1:  %code option(s)... %{ action %}
//
//     2:  %code option(s)...
//         %{ action %}
//
// NOTE: we do not worry about *deep nesting* 'action' and 'options' modes 
// via `%include` lexing, e.g.:
//
//     %code option(s)... %include 2nd_level_option(s) %include(illegal!) 3rd_level...
//
// While the lexer may not object (and thus *incorrectly reset `yy.depth` to 
// ZERO(0) in the inner `%include` lex action above, for example!) the grammar/parser
// should be able to check against this eventuality and barf an appropriately
// formulated hairball. <wink>
//
"%include"                              yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the `<action>` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yytext);
                                        return 'ACTION_START';

// The 'options' mode also serves to lex condition lists and a few other things...
// We don't mind and allow the lexer to be 'dumb' here as the parser will
// catch any abuse / incorrect input and report accordingly.
">"                                     this.popState();
                                        this.unput(yytext);     
                                        return 'OPTIONS_END';
","                                     return ',';
"*"                                     return '*';

// The 'options' mode also serves to lex extended `%token` specs a la bison:
"<"{ID}">"                              yytext = this.matches[1];
                                        return 'TOKEN_TYPE';

{ANY_LITERAL_CHAR}+                     return 'OPTION_VALUE';

/* skip leading whitespace on the next line of input, when followed by more options */
{BR}{WS}+(?=\S)                         /* ignore */
/* otherwise the EOL marks the end of the options statement */
{BR}                                    this.popState();
                                        this.unput(yytext);
                                        return 'OPTIONS_END';
{WS}+                                   /* skip whitespace */

}
//-- end <options> section.


<INITIAL>{ID}                           this.pushState('macro');
                                        return 'MACRO_NAME';

<macro>{BR}+                            this.popState();
                                        this.unput(yytext);
                                        return 'MACRO_END';

// Also support the rare 'custom lexer without a `%%` + rules':
<macro><<EOF>>                          this.popState();
                                        this.unput(yytext);
                                        return 'MACRO_END';

{BR}+                                   /* skip newlines */
{WS}+                                   /* skip whitespace */

\"{DOUBLEQUOTED_STRING_CONTENT}\"       return 'STRING_LIT';
\'{QUOTED_STRING_CONTENT}\'             return 'STRING_LIT';
\`{ES2017_STRING_CONTENT}\`             return 'STRING_LIT';

// Accept any non-regex-special character as a direct literal without
// the need to put quotes around it:
{ANY_LITERAL_CHAR}+                     // accept any non-regex, non-lex, non-string-delim,
                                        // non-escape-starter, non-space character as-is
                                        return 'CHARACTER_LIT';

"["                                     this.pushState('set');
                                        return 'REGEX_SET_START';
"|"                                     return '|';

// see also: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
"(?:"                                   return 'SPECIAL_GROUP';
"(?="                                   return 'SPECIAL_GROUP';
"(?!"                                   return 'SPECIAL_GROUP';
// regex lookbehind prepwork: see also https://github.com/tc39/proposal-regexp-lookbehind
"(?<="                                  return 'SPECIAL_GROUP';
"(?<!"                                  return 'SPECIAL_GROUP';

"("                                     return '(';
")"                                     return ')';
"+"                                     return '+';
"*"                                     return '*';
"?"                                     return '?';
"^"                                     return '^';
","                                     return ',';
"<<EOF>>"                               return '$';
"<"                                     this.pushState('options');
                                        return '<';
">"                                     return '>';
"/!"                                    return '/!';                    // treated as `(?!atom)`
"/"                                     return '/';                     // treated as `(?=atom)`
"\\"(?:[sSbBwWdDpP]|[rfntv\\*+()${}|[\]\/.^?])
                                        return 'REGEX_SPECIAL_CHAR';
"\\"(?:([0-7]{1,3})|c([@A-Z])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|u\{([0-9a-fA-F]{1,8})\})
                                        %{
                                            var m = this.matches;
                                            yytext = NaN;
                                            if (m[1]) {
                                                // [1]: octal char: `\012` --> \x0A
                                                var v = parseInt(m[1], 8);
                                                yytext = v;
                                            }
                                            else if (m[2]) {
                                                // [2]: CONTROL char: `\cA` --> \u0001
                                                var v = m[2].charCodeAt(0) - 64;
                                                yytext = v;
                                            }
                                            else if (m[3]) {
                                                // [3]: hex char: `\x41` --> A
                                                var v = parseInt(m[3], 16);
                                                yytext = v;
                                            }
                                            else if (m[4]) {
                                                // [4]: unicode/UTS2 char: `\u03c0` --> PI
                                                var v = parseInt(m[4], 16);
                                                yytext = v;
                                            }
                                            else if (m[5]) {
                                                // [5]: unicode code point: `\u{00003c0}` --> PI
                                                var v = parseInt(m[5], 16);
                                                yytext = v;
                                            }
                                            return 'ESCAPED_CHAR';
                                        %}
"\\".                                   yytext = yytext.substring(1);
                                        return 'CHARACTER_LIT';
"$"                                     return '$';
"."                                     return '.';
"%option"[s]?                           this.pushState('options');
                                        return 'OPTIONS';
"%s"                                    this.pushState('options');
                                        return 'START_INC';
"%x"                                    this.pushState('options');
                                        return 'START_EXC';

"%code"                                 this.pushState('options');
                                        return 'CODE';
"%import"                               this.pushState('options');
                                        return 'IMPORT';

<INITIAL,rules,code>"%include"          yy.depth = 0;
                                        yy.include_command_allowed = true;
                                        this.pushState('action');
                                        // push the parsed '%include' back into the input-to-parse
                                        // to trigger the `<action>` state to re-parse it
                                        // and issue the desired follow-up token: 'INCLUDE':
                                        this.unput(yytext);
                                        return 'ACTION_START';

<INITIAL,rules,code>"%"{NAME}([^\r\n]*)
                                        %{
                                            /* ignore unrecognized decl */
                                            this.warn(rmCommonWS`
                                                ignoring unsupported lexer option ${dquote(yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(yylloc));
                                            yytext = {
                                                name: this.matches[1],              // {NAME}
                                                value: this.matches[2].trim()       // optional value/parameters
                                            };
                                            return 'UNKNOWN_DECL';
                                        %}

"%%"                                    this.pushState('rules');
                                        return '%%';

"{"\d+(","\s*\d+|",")?"}"               return 'RANGE_REGEX';
"{"{ID}"}"                              return 'NAME_BRACE';
<set,options>"{"{ID}"}"                 return 'NAME_BRACE';
"{"                                     return '{';
"}"                                     return '}';


<set>(?:"\\"[^{BR}]|[^\]{])+            return 'REGEX_SET';
<set>"{"                                return 'REGEX_SET';
<set>"]"                                this.popState();
                                        return 'REGEX_SET_END';


// in the trailing CODE block, only accept these `%include` macros when
// they appear at the start of a line and make sure the rest of lexer
// regexes account for this one so it'll match that way only:
<code>[^{BR}]*{BR}+                     return 'CODE';
<code>[^{BR}]+                          return 'CODE';      // the bit of CODE just before EOF...


// detect and report unterminated string constants ASAP
// for 'action', 'options', but also for other lexer conditions:
//
// these error catching rules fix https://github.com/GerHobbelt/jison/issues/13
<action>\"                              yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';
<action>\'                              yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';
<action>\`                              yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';

<options>\"                             yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';
<options>\'                             yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';
<options>\`                             yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';

<*>\"                                   var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';
<*>\'                                   var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';
<*>\`                                   var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unterminated string constant encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'UNTERMINATED_STRING_ERROR';


<macro,rules>.                          /* b0rk on bad characters */
                                        var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unsupported lexer input encountered while lexing
                                            ${rules} (i.e. jison lex regexes) in ${dquote(this.topState())} state.

                                                NOTE: When you want this input to be interpreted as a LITERAL part
                                                      of a lex rule regex, you MUST enclose it in double or
                                                      single quotes.

                                                      If not, then know that this input is not accepted as a valid
                                                      regex expression here in jison-lex ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'error';

<options>.                              yyerror(rmCommonWS`
                                            unsupported lexer input: ${dquote(yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                            If this input was intentional, you might want to put quotes around
                                            it; any JavaScript string quoting style is accepted (single quotes,
                                            double quotes *or* backtick quotes a la ES6 string templates).

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'error';

<*>.                                    yyerror(rmCommonWS`
                                            unsupported lexer input: ${dquote(yytext)}
                                            while lexing in ${dquote(this.topState())} state.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(yylloc));
                                        return 'error';

<*><<EOF>>                              return 'EOF';

%%


var rmCommonWS = helpers.rmCommonWS;
var dquote     = helpers.dquote;
var scanRegExp = helpers.scanRegExp;






lexer.setupDelimitedActionChunkLexerRegex = function lexer__setupDelimitedActionChunkLexerRegex(yytext, yy) {
    // Calculate the end marker to match and produce a
    // lexer rule to match when the need arrises:
    var marker = yytext;
    // Special: when we encounter `{` as the start of the action code block,
    // we NIL the `%{...%}` lexer rule by just using that one:
    if (marker === '{') {
        marker = '%{';
    }
    var action_end_marker = marker.replace(/\{/g, '}');

    // Note: this bit comes straight from the lexer kernel!
    // Get us the currently active set of lexer rules. 
    // (This is why we push the 'action' lexer condition state above *before*
    // we commence and work on the ruleset itself.)
    var spec = this.__currentRuleSet__;
    if (!spec) {
        // Update the ruleset cache as we apparently encountered a state change or just started lexing.
        // The cache is set up for fast lookup -- we assume a lexer will switch states much less often than it will
        // invoke the `lex()` token-producing API and related APIs, hence caching the set for direct access helps
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
        // slot 0 is unused; we use a 1-based index approach here to keep the hottest code in `lexer_next()` fast and simple!
        for (i = 1, len = rules.length; i < len; i++) {
            var rule_re = rules[i];
            if (rule_re.toString() === '^(?:%\\{([^]*?)%\\})') {
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
        action_chunk_regex = yy.cached_action_chunk_rule[marker] = new RegExp('^(?:' + marker.replace(/\{/g, '\\{') + '([^]*?)' + action_end_marker.replace(/\}/g, '\\}') + ')');
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
};
