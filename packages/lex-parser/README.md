# lex-parser


[![build status](https://secure.travis-ci.org/GerHobbelt/lex-parser.png)](http://travis-ci.org/GerHobbelt/lex-parser)


A parser for lexical grammars used by [jison](http://jison.org) and jison-lex.


## install

    npm install lex-parser


## build

To build the parser yourself, clone the git repo then run:

    make prep
    
to install required packages and then run:

    make
    
to run the unit tests.

This will generate `lex-parser.js`.


## usage

    var lexParser = require("lex-parser");

    // parse a lexical grammar and return JSON
    lexParser.parse("%% ... ");


## example

The parser can parse its own lexical grammar, shown below:

```

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


// Off Topic
// ---------
//
// Do NOT specify the xregexp option as we want the XRegExp \p{...} regex macros converted to 
// native regexes and used as such:
//
// %options xregexp

%options easy_keyword_rules
%options ranges
%options xregexp



%%

<action>"/*"(.|\n|\r)*?"*/"             return 'ACTION_BODY';
<action>"//".*                          return 'ACTION_BODY';
// regexp with braces or quotes (and no spaces, so we don't mistake 
// a *division operator* `/` for a regex delimiter here in most circumstances):
<action>"/"[^ /]*?['"{}][^ ]*?"/"       return 'ACTION_BODY'; 
<action>\"("\\\\"|'\"'|[^"])*\"         return 'ACTION_BODY';
<action>"'"("\\\\"|"\'"|[^'])*"'"       return 'ACTION_BODY';
<action>[/"'][^{}/"']+                  return 'ACTION_BODY';
<action>[^{}/"']+                       return 'ACTION_BODY';
<action>"{"                             yy.depth++; return '{';
<action>"}"                             %{
                                            if (yy.depth == 0) { 
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
<rules>"%%"                             this.pushState('code'); return '%%';
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
                                        yytext = yytext.substr(1, yyleng - 2); return 'OPTION_VALUE';
<options>\'{QUOTED_STRING_CONTENT}\'
                                        yytext = yytext.substr(1, yyleng - 2); return 'OPTION_VALUE';
<options>[^\s\r\n]+                     return 'OPTION_VALUE';
<options>{BR}+                          this.popState(); return 'OPTIONS_END';
<options>{WS}+                          /* skip whitespace */

<start_condition>{ID}                   return 'START_COND';
<start_condition>{BR}+                  this.popState();
<start_condition>{WS}+                  /* empty */

<trail>{WS}*{BR}+                       this.pushState('rules');

<indented>"{"                           yy.depth = 0; this.pushState('action'); return '{';
<indented>"%{"(.|{BR})*?"%}"            this.pushState('trail'); yytext = yytext.substr(2, yyleng - 4); return 'ACTION';
"%{"(.|{BR})*?"%}"                      yytext = yytext.substr(2, yyleng - 4); return 'ACTION';
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

"/*"(.|\n|\r)*?"*/"                     /* ignore */
"//"[^\r\n]*                            /* ignore */

<INITIAL>{ID}                           this.pushState('macro'); return 'NAME';
<macro>{BR}+                            this.popState('macro');

// Accept any non-regex-special character as a direct literal without 
// the need to put quotes around it:
<macro>{ANY_LITERAL_CHAR}+
                                        %{
                                            // accept any non-regex, non-lex, non-string-delim,
                                            // non-escape-starter, non-space character as-is
                                            return 'CHARACTER_LIT';
                                        %}

{BR}+                                   /* empty */
\s+                                     /* empty */

\"{DOUBLEQUOTED_STRING_CONTENT}\"
                                        yytext = yytext.replace(/\\"/g,'"'); return 'STRING_LIT';
\'{QUOTED_STRING_CONTENT}\'
                                        yytext = yytext.replace(/\\'/g,"'"); return 'STRING_LIT';
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
                                            console.warn('LEX: ignoring unsupported lexer option: ', yytext + ' while lexing in ' + this.topState() + ' state:', this._input, ' /////// ', this.matched);
                                            // this.pushState('options');
                                            yytext = [
                                                this.matches[1],            // {NAME}
                                                this.matches[2].trim()      // optional value/parameters
                                            ];
                                            return 'UNKNOWN_DECL';
                                        %}
"%%"                                    this.pushState('rules'); return '%%';
"{"\d+(","\s?\d+|",")?"}"               return 'RANGE_REGEX';
"{"{ID}"}"                              return 'NAME_BRACE';
<set,options>"{"{ID}"}"                 return 'NAME_BRACE';
"{"                                     return '{';
"}"                                     return '}';


<set>(?:"\\\\"|"\\]"|[^\]{])+           return 'REGEX_SET';
<set>"{"                                return 'REGEX_SET';
<set>"]"                                this.popState('set'); return 'REGEX_SET_END';


// in the trailing CODE block, only accept these `%include` macros when 
// they appear at the start of a line and make sure the rest of lexer 
// regexes account for this one so it'll match that way only:
<code>[^\r\n]*(\r|\n)+                  return 'CODE';
<code>[^\r\n]+                          return 'CODE';      // the bit of CODE just before EOF...


<path>{BR}                              this.popState(); this.unput(yytext);
<path>\"{DOUBLEQUOTED_STRING_CONTENT}\"
                                        yytext = yytext.substr(1, yyleng - 2); this.popState(); return 'PATH';
<path>\'{QUOTED_STRING_CONTENT}\'
                                        yytext = yytext.substr(1, yyleng - 2); this.popState(); return 'PATH';
<path>{WS}+                             // skip whitespace in the line
<path>[^\s\r\n]+                        this.popState(); return 'PATH';

<*>.                                    %{
                                            /* b0rk on bad characters */
                                            var l0 = Math.max(0, yylloc.last_column - yylloc.first_column);
                                            var l2 = 3;
                                            var l1 = Math.min(79 - 4 - l0 - l2, yylloc.first_column, 0);
                                            throw new Error('unsupported lexer input: ', yytext, ' @ ' + this.describeYYLLOC(yylloc) + ' while lexing in ' + this.topState() + ' state:\n', indent(this.showPosition(l1, l2), 4));
                                        %}

<*><<EOF>>                              return 'EOF';

%%

function indent(s, i) {
    var a = s.split('\n');
    var pf = (new Array(i + 1)).join(' ');
    return pf + a.join('\n' + pf);
}
```


## license

MIT
