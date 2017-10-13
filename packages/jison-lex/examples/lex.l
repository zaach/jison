
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
QUOTED_STRING_CONTENT                   (?:\\\'|\\[^\']|[^\\\'])*
DOUBLEQUOTED_STRING_CONTENT             (?:\\\"|\\[^\"]|[^\\\"])*

// Accept any non-regex-special character as a direct literal without
// the need to put quotes around it:
ANY_LITERAL_CHAR                        [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,\'\";]


%s indented trail rules macro
%x code start_condition options conditions action path set


%options easy_keyword_rules
//%options ranges
%options xregexp



%%

<action>"/*"[^]*?"*/"                   return 'ACTION_BODY';
<action>"//".*                          return 'ACTION_BODY';
// regexp with braces or quotes (and no spaces, so we don't mistake
// a *division operator* `/` for a regex delimiter here in most circumstances):
<action>"/"[^\s/]*?['"{}][^\s]*?"/"     return 'ACTION_BODY';
<action>\"{DOUBLEQUOTED_STRING_CONTENT}\"
                                        return 'ACTION_BODY';
<action>\'{QUOTED_STRING_CONTENT}\'    
                                        return 'ACTION_BODY';
<action>[/"'][^{}/"']+                  return 'ACTION_BODY';
<action>[^{}/"']+                       return 'ACTION_BODY';
<action>"{"                             yy.depth++; return '{';
<action>"}"                             %{
                                            if (yy.depth == 0) {
                                                this.popState();
                                                this.pushState('trail');
                                            } else {
                                                yy.depth--;
                                            }
                                            return '}';
                                        %}

<conditions>{NAME}                      return 'NAME';
<conditions>">"                         this.popState(); return '>';
<conditions>","                         return ',';
<conditions>"*"                         return '*';

<rules>{BR}+                            /* empty */
<rules>{WS}+{BR}+                       /* empty */
<rules>{WS}+                            this.pushState('indented');
<rules>"%%"                             this.popState(); this.pushState('code'); return '%%';
// Accept any non-regex-special character as a direct literal without
// the need to put quotes around it:
<rules>{ANY_LITERAL_CHAR}+
                                        %{
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 'CHARACTER_LIT';
                                        %}
<options>{NAME}                         return 'NAME';
<options>"="                            return '=';
<options>\"{DOUBLEQUOTED_STRING_CONTENT}\"
                                        yytext = unescQuote(this.matches[1]); return 'OPTION_STRING_VALUE';   // value is always a string type
<options>\'{QUOTED_STRING_CONTENT}\'
                                        yytext = unescQuote(this.matches[1]); return 'OPTION_STRING_VALUE';   // value is always a string type

// Comments should be gobbled and discarded anywhere *except* the code/action blocks:
<INITIAL,start_condition,trail,rules,macro,path,options>"//"[^\r\n]*
                                        /* skip single-line comment */
<INITIAL,start_condition,trail,rules,macro,path,options>"/*"(.|\n|\r)*?"*/"
                                        /* skip multi-line comment */

<options>[^\s\r\n]+                     return 'OPTION_VALUE';
<options>{BR}{WS}+(?=\S)                /* skip leading whitespace on the next line of input, when followed by more options */
<options>{BR}                           this.popState(); return 'OPTIONS_END';
<options>{WS}+                          /* skip whitespace */

<start_condition>{ID}                   return 'START_COND';
<start_condition>{BR}+                  this.popState();
<start_condition>{WS}+                  /* empty */

<trail>{WS}*{BR}+                       this.popState(); this.unput(yytext); /*  this.unput(yytext); can be used here instead of this.reject(); which would only work when we set the backtrack_lexer option */ 

<indented>{WS}*{BR}+                    this.popState();
<indented>"{"                           yy.depth = 0; this.pushState('action'); return '{';
<indented>"%{"((?:.|{BR})*?)"%}"        this.pushState('trail'); yytext = this.matches[1]; return 'ACTION';
"%{"((?:.|{BR})*?)"%}"                  yytext = this.matches[1]; return 'ACTION';
<indented>"%include"                    %{
                                            // This is an include instruction in place of an action:
                                            // thanks to the `<indented>.+` rule immediately below we need to semi-duplicate
                                            // the `%include` token recognition here vs. the almost-identical rule for the same
                                            // further below.
                                            // There's no real harm as we need to do something special in this case anyway:
                                            // push 2 (two!) conditions.
                                            //
                                            // (Anecdotal: to find that we needed to place this almost-copy here to make the test grammar
                                            // parse correctly took several hours as the debug facilities were - and are - too meager to
                                            // quickly diagnose the problem while we hadn't. So the code got littered with debug prints
                                            // and finally it hit me what the *F* went wrong, after which I saw I needed to add *this* rule!)

                                            // first push the 'trail' condition which will be the follow-up after we're done parsing the path parameter...
                                            this.pushState('trail');
                                            // then push the immediate need: the 'path' condition.
                                            this.pushState('path');
                                            return 'INCLUDE';
                                        %}
<indented>.*                            this.popState(); return 'ACTION';

<INITIAL>{ID}                           this.pushState('macro'); return 'NAME';
<macro>{BR}+                            this.popState();

// Accept any non-regex-special character as a direct literal without
// the need to put quotes around it:
<macro>{ANY_LITERAL_CHAR}+              %{
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 'CHARACTER_LIT';
                                        %}

{BR}+                                   /* empty */
\s+                                     /* empty */

\"{DOUBLEQUOTED_STRING_CONTENT}\"       %{
                                            yytext = unescQuote(this.matches[1]); 
                                            return 'STRING_LIT';
                                        %}
\'{QUOTED_STRING_CONTENT}\'             %{
                                            yytext = unescQuote(this.matches[1]); 
                                            return 'STRING_LIT';
                                        %}
"["                                     this.pushState('set'); return 'REGEX_SET_START';
"|"                                     return '|';
"(?:"                                   return 'SPECIAL_GROUP';
"(?="                                   return 'SPECIAL_GROUP';
"(?!"                                   return 'SPECIAL_GROUP';
"("                                     return '(';
")"                                     return ')';
"+"                                     return '+';
"*"                                     return '*';
"?"                                     return '?';
"^"                                     return '^';
","                                     return ',';
"<<EOF>>"                               return '$';
"<"                                     this.pushState('conditions'); return '<';
"/!"                                    return '/!';                    // treated as `(?!atom)`
"/"                                     return '/';                     // treated as `(?=atom)`
"\\"([0-7]{1,3}|[rfntvsSbBwWdD\\*+()${}|[\]\/.^?]|"c"[A-Z]|"x"[0-9A-F]{2}|"u"[a-fA-F0-9]{4})
                                        return 'ESCAPE_CHAR';
"\\".                                   yytext = yytext.replace(/^\\/g, ''); return 'ESCAPE_CHAR';
"$"                                     return '$';
"."                                     return '.';
"%options"                              this.pushState('options'); return 'OPTIONS';
"%s"                                    this.pushState('start_condition'); return 'START_INC';
"%x"                                    this.pushState('start_condition'); return 'START_EXC';
<INITIAL,trail,code>"%include"          this.pushState('path'); return 'INCLUDE';
<INITIAL,rules,trail,code>"%"{NAME}([^\r\n]*)
                                        %{
                                            /* ignore unrecognized decl */
                                            var l0 = Math.max(0, yylloc.last_column - yylloc.first_column);
                                            var l2 = 19;
                                            var l1 = Math.min(79 - 4 - l0 - l2, yylloc.first_column, 0);
                                            this.warn('LEX: ignoring unsupported lexer option', dquote(yytext), 'while lexing in', this.topState(), 'state:\n' + indent(this.showPosition(l1, l2), 4)
                                                // , '\n', {
                                                //     remaining_input: this._input, 
                                                //     matched: this.matched,
                                                //     matches: this.matches
                                                // }
                                            );
                                            yytext = [
                                                this.matches[1],            // {NAME}
                                                this.matches[2].trim()      // optional value/parameters
                                            ];
                                            return 'UNKNOWN_DECL';
                                        %}
"%%"                                    this.pushState('rules'); return '%%';
"{"\d+(","\s*\d+|",")?"}"               return 'RANGE_REGEX';
"{"{ID}"}"                              return 'NAME_BRACE';
<set,options>"{"{ID}"}"                 return 'NAME_BRACE';
"{"                                     return '{';
"}"                                     return '}';


<set>(?:"\\\\"|"\\]"|[^\]{])+           return 'REGEX_SET';
<set>"{"                                return 'REGEX_SET';
<set>"]"                                this.popState(); 
                                        return 'REGEX_SET_END';


// in the trailing CODE block, only accept these `%include` macros when
// they appear at the start of a line and make sure the rest of lexer
// regexes account for this one so it'll match that way only:
<code>[^\r\n]*(\r|\n)+                  return 'CODE';
<code>[^\r\n]+                          return 'CODE';      // the bit of CODE just before EOF...


<path>{BR}                              this.popState(); this.unput(yytext);
<path>\"{DOUBLEQUOTED_STRING_CONTENT}\"
                                        yytext = unescQuote(this.matches[1]); 
					this.popState(); 
					return 'PATH';
<path>\'{QUOTED_STRING_CONTENT}\'
                                        yytext = unescQuote(this.matches[1]); 
					this.popState(); 
					return 'PATH';
<path>{WS}+                             // skip whitespace in the line
<path>[^\s\r\n]+                        this.popState(); 
                                        return 'PATH';

<macro,rules>.                          %{
                                            /* b0rk on bad characters */
                                            var l0 = Math.max(0, yylloc.last_column - yylloc.first_column);
                                            var l2 = 39;
                                            var l1 = Math.min(79 - 4 - l0 - l2, yylloc.first_column, 0);
                                            var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                            var pos_str = this.showPosition(l1, l2);
                                            if (pos_str && pos_str[0] !== '\n') {
                                                pos_str = '\n\n       Offending input:\n' + indent(pos_str, 4);
                                            }
                                            yyerror('unsupported lexer input: ' + dquote(yytext) + ' while lexing ' + rules + '\n       (i.e. jison lex regexes).\n\n       NOTE: When you want the input ' + dquote(yytext) + ' to be interpreted as a literal part\n       of a lex rule regex, you MUST enclose it in double or single quotes,\n       e.g. as shown in this error message just before. If not, then know\n       that this is not accepted as a regex operator here in\n       jison-lex ' + rules + '.' + pos_str);
                                        %}

<*>.                                    %{
                                            /* b0rk on bad characters */
                                            var l0 = Math.max(0, yylloc.last_column - yylloc.first_column);
                                            var l2 = 39;
                                            var l1 = Math.min(79 - 4 - l0 - l2, yylloc.first_column, 0);
                                            var pos_str = this.showPosition(l1, l2);
                                            if (pos_str && pos_str[0] !== '\n') {
                                                pos_str = '\n\n       Offending input:\n' + indent(pos_str, 4);
                                            }
                                            yyerror('unsupported lexer input: ' + dquote(yytext) + ' while lexing in ' + dquote(this.topState()) + ' state.' + pos_str);
                                        %}

<*><<EOF>>                              return 'EOF';

%%


var helpers    = require('../../modules/helpers-lib');
var dquote = helpers.dquote;


function indent(s, i) {
    var a = s.split('\n');
    var pf = (new Array(i + 1)).join(' ');
    return pf + a.join('\n' + pf);
}

// unescape a string value which is wrapped in quotes/doublequotes 
function unescQuote(str) {
    str = '' + str;
    var a = str.split('\\\\');
    a = a.map(function (s) {
        return s.replace(/\\'/g, "'").replace(/\\"/g, '"');
    });
    str = a.join('\\\\');
    return str;
}


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
