# lex-parser


[![Join the chat at https://gitter.im/jison-parsers-lexers/Lobby](https://badges.gitter.im/jison-parsers-lexers/Lobby.svg)](https://gitter.im/jison-parsers-lexers/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
[![Build Status](https://travis-ci.org/GerHobbelt/lex-parser.svg?branch=master)](https://travis-ci.org/GerHobbelt/lex-parser)
[![NPM version](https://badge.fury.io/js/%40gerhobbelt%2Flex-parser.svg)](http://badge.fury.io/js/%40gerhobbelt%2Flex-parser)
[![Dependency Status](https://img.shields.io/david/GerHobbelt/lex-parser.svg)](https://david-dm.org/GerHobbelt/lex-parser)
[![npm](https://img.shields.io/npm/dm/@gerhobbelt/lex-parser.svg?maxAge=2592000)]()




A parser for lexical grammars used by [jison](http://jison.org) and jison-lex.



## install

    npm install @gerhobbelt/lex-parser

or the entire bundle via 

    npm install jison-gho

Then the `lex-parser` library is located in the subdirectory `packages/lex-parser/` of the `jison-gho` monorepo, i.e. `.../node_modules/jison-gho/packages/lex-parser/`.

Alternatively, the entire `lex-parser` API is also available via the `jison` API itself as can be seen from this internal `jison` code snippet:

```
import Lexer from '../packages/jison-lex';
import ebnfParser from '../packages/ebnf-parser';
import lexParser from '../packages/lex-parser';
import grammarPrinter from './util/grammar-printer.js';
import helpers from '../packages/helpers-lib';
var rmCommonWS = helpers.rmCommonWS;
var camelCase  = helpers.camelCase;
var code_exec  = helpers.exec;
import XRegExp from '@gerhobbelt/xregexp';
import recast from 'recast';
import astUtils from 'ast-util';
import json5 from '@gerhobbelt/json5';

// Also export other APIs: the JISON module should act as a 'facade' for the others,
// so applications using the JISON compiler itself can rely on it providing everything
// in a guaranteed compatible version as it allows userland code to use the precise
// same APIs as JISON will be using itself:
Jison.Lexer = Lexer;
Jison.ebnfParser = ebnfParser;
Jison.lexParser = lexParser;
Jison.codeExec = code_exec;
Jison.XRegExp = XRegExp;
Jison.recast = recast;
Jison.astUtils = astUtils;
Jison.JSON5 = json5;
Jison.prettyPrint = grammarPrinter;
Jison.rmCommonWS = rmCommonWS;
Jison.mkStdOptions = mkStdOptions;
Jison.camelCase = camelCase;
Jison.autodetectAndConvertToJSONformat = autodetectAndConvertToJSONformat;
...
Jison.Parser = Parser;

export default Jison;
```

hence you can get at it this way, for example:

```
import jisonAPI from 'jison-gho';
// get a reference to the full `lex-parser` API:
const lexParserAPI = jisonAPI.lexParser;
```



## build

Follow the install & build directions of the monorepo.
    
You can also only build this particular subpackage by `cd`-ing into this directory
and then invoking the local make:
    
    cd packages/lex-parser
    make

This will generate `lex-parser.js` and the rollup/babel-postprocessed ES6 and ES5 
compatible libraries in the local `dist/` directory.

>
> ### Note about ES6/rollup usage vs. ES5
>
> All `dist/` library files are 'self-contained': they include all 'local imports' 
> from within this jison monorepo in order to deliver a choice of source files
> for your perusal where you only need to worry about importing **external dependencies**
> (such as `recast`).
>
> As such, these `dist/` files **should** be easier to minify and/or use in older
> (ES5) environments.
>
> #### rollup
>
> Iff you use `rollup` or similar tools in an ES6/ES2015/ES2017 setting, then the
> [`package.json::module`](https://github.com/rollup/rollup/wiki/pkg.module) has
> already been set up for you to use the *original sources* instead!
> 


## usage

    var lexParser = require("@gerhobbelt/lex-parser");

    // parse a lexical grammar and return JSON
    lexParser.parse("%% ... ");


## example

The parser can parse its own lexical grammar, shown below:

```
%code imports %{
  import helpers from 'jison-helpers-lib';
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
ANY_LITERAL_CHAR                        [^\s\r\n<>\[\](){}.*+?:!=|%\/\\^$,\'\";]


%s rules macro named_chunk
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

"%{"                                    yy.dept = 0;
                                        yy.include_command_allowed = false;
                                        this.pushState('action'); 
                                        this.unput(yytext);
                                        yytext = '';
                                        return 'ACTION_START';
<action>"%{"([^]*?)"%}"                 yytext = this.matches[1]; 
                                        yy.include_command_allowed = true;
                                        return 'ACTION';
<action>"%include"                      %{
                                            if (yy.include_command_allowed) {
                                                // This is an include instruction in place of an action:
                                                //
                                                // - one %include per action chunk
                                                // - one %include replaces an entire action chunk
                                                this.pushState('path');
                                                return 'INCLUDE';
                                            } else {
                                                // TODO
                                                yyerror('oops!');
                                                return 'INCLUDE_PLACEMENT_ERROR';
                                            }
                                        %}
<action>{WS}*"/*"[^]*?"*/"              //yy.include_command_allowed = false; -- doesn't impact include-allowed state 
                                        return 'ACTION_BODY_C_COMMENT';
<action>{WS}*"//".*                     yy.include_command_allowed = false; 
                                        return 'ACTION_BODY_CPP_COMMENT';
<action>{WS}+                           return 'ACTION_BODY_WHITESPACE';

// make sure to terminate on linefeed before the next rule alternative,
// which is announced by `|`:                                        
<action>"|"                             if (yy.include_command_allowed) {
                                            this.popState();
                                            this.unput(yytext);
                                            yytext = '';
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';    
                                        }

// make sure to terminate on linefeed before the rule section ends,
// which is announced by `%%`:                                        
<action>"%%"                            if (yy.include_command_allowed) {
                                            this.popState();
                                            this.unput(yytext);
                                            yytext = '';
                                            return 'ACTION_END';
                                        } else {
                                            return 'ACTION_BODY';    
                                        }

<action>"%"                             return 'ACTION_BODY';    

// regexp with braces or quotes (and no spaces, so we don't mistake
// a *division operator* `/` for a regex delimiter here in most circumstances):
<action>"/"[^\s/]*?(?:['"`{}][^\s/]*?)*"/"
                                        yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
// hack to cope with slashes which MAY be divide operators OR are regex starters:
// we simply gobble the entire line until the end or until we hit a closing brace,
// as we MUST keep track of the curly brace pairs inside an action body.
<action>"/"[^}{BR}]*
                                        yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
<action>\"{DOUBLEQUOTED_STRING_CONTENT}\"
                                        yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
<action>\'{QUOTED_STRING_CONTENT}\'     yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
<action>\`{ES2017_STRING_CONTENT}\`     yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
<action>[^{}/"'`|%\{\}{BR}{WS}]+        yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
<action>"{"                             yy.depth++; 
                                        yy.include_command_allowed = false; 
                                        return 'ACTION_BODY';
<action>"}"                             %{
                                            yy.include_command_allowed = false; 
                                            if (yy.depth <= 0) {
                                                yyerror(rmCommonWS`
                                                    too many closing curly braces in lexer rule action block.

                                                    Note: the action code chunk may be too complex for jison to parse
                                                    easily; we suggest you wrap the action code chunk in '%{...%\}'
                                                    to help jison grok more or less complex action code chunks.

                                                      Erroneous area:
                                                    ` + this.prettyPrintRange(this, yylloc));
                                                return 'BRACKETS_SURPLUS';
                                            } else {
                                                yy.depth--;
                                            }
                                            return 'ACTION_BODY';
                                        %}
// make sure to terminate on linefeed before the next rule alternative,
// which is announced by `|`.
// Note that lexer options & commands should be at the start-of-line, i.e.
// without leading whitespace. The only lexer command which we do accept
// here after the last indent is `%include`, which is considered (part
// of) the rule's action code block.
<action>(?:{BR}{WS}+)+/[^{WS}{BR}|]     yy.include_command_allowed = true; 
                                        return 'ACTION_BODY_WHITESPACE';           // keep empty lines as-is inside action code blocks.
<action>{BR}                            if (yy.depth > 0) {
                                            yy.include_command_allowed = true; 
                                            return 'ACTION_BODY_WHITESPACE';       // keep empty lines as-is inside action code blocks.
                                        } else {
                                            // end of action code chunk
                                            this.popState();
                                            this.unput(yytext);
                                            yytext = '';
                                            return 'ACTION_END';
                                        }
<action><<EOF>>                         %{
                                            yy.include_command_allowed = false; 
                                            if (yy.depth !== 0) {
                                                yyerror(rmCommonWS`
                                                    missing ${yy.depth} closing curly braces in lexer rule action block.

                                                    Note: the action code chunk may be too complex for jison to parse
                                                    easily; we suggest you wrap the action code chunk in '%{...%\}'
                                                    to help jison grok more or less complex action code chunks.

                                                      Erroneous area:
                                                    ` + this.prettyPrintRange(this, yylloc));
                                                yytext = '';
                                                return 'BRACKETS_MISSING';
                                            }
                                            this.popState();
                                            yytext = '';
                                            return 'ACTION_END';
                                        %}

<conditions>{NAME}                      return 'NAME';
<conditions>">"                         this.popState(); return '>';
<conditions>","                         return ',';
<conditions>"*"                         return '*';

// Comments should be gobbled and discarded anywhere
// *except* the code/action blocks:
<INITIAL,start_condition,macro,path,options>{WS}*"//"[^\r\n]*
                                        /* skip single-line comment */
<INITIAL,start_condition,macro,path,options>{WS}*"/*"[^]*?"*/"
                                        /* skip multi-line comment */

<rules>{BR}+                            /* empty */
<rules>{WS}+{BR}+                       /* empty */
<rules>"//"[^\r\n]*
                                        /* skip single-line comment */
<rules>"/*"[^]*?"*/"
                                        /* skip multi-line comment */
// ACTION code chunks follow rules and are generally indented, but
// never start with characters special to the lex language itself:
// - `%` can start options, commands, etc., e.g. `%include` or `%options`
// - `|` starts a rule alternative, never a chunk of action code.
// -  					
<rules>{WS}+/[^{WS}{BR}|%]              yy.depth = 0; 
                                        yy.include_command_allowed = true; 
                                        this.pushState('action'); 
                                        return 'ACTION_START';
<rules>"%%"                             this.popState(); 
                                        this.pushState('code'); 
                                        return '%%';
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
                                        yytext = unescQuote(this.matches[1], /\\"/g); return 'OPTION_STRING_VALUE';   // value is always a string type
<options>\'{QUOTED_STRING_CONTENT}\'
                                        yytext = unescQuote(this.matches[1], /\\'/g); return 'OPTION_STRING_VALUE';   // value is always a string type
<options>\`{ES2017_STRING_CONTENT}\`
                                        yytext = unescQuote(this.matches[1], /\\`/g); return 'OPTION_STRING_VALUE';   // value is always a string type

<options>[^\s\r\n]+                     return 'OPTION_VALUE';
<options>{BR}{WS}+(?=\S)                /* skip leading whitespace on the next line of input, when followed by more options */
<options>{BR}                           this.popState(); return 'OPTIONS_END';
<options>{WS}+                          /* skip whitespace */

<start_condition>{ID}                   return 'START_COND';
<start_condition>{BR}+                  this.popState();
<start_condition>{WS}+                  /* empty */

<named_chunk>{ID}                       return 'NAME';
<INITIAL>{ID}                           this.pushState('macro'); return 'NAME';
<macro,named_chunk>{BR}+                this.popState();

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
                                            yytext = unescQuote(this.matches[1], /\\"/g);
                                            return 'STRING_LIT';
                                        %}
\'{QUOTED_STRING_CONTENT}\'             %{
                                            yytext = unescQuote(this.matches[1], /\\'/g);
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

"%code"                                 this.pushState('named_chunk'); return 'INIT_CODE';
"%import"                               this.pushState('named_chunk'); return 'IMPORT';

"%include"                              yy.depth = 0;
                                        yy.include_command_allowed = true; 
                                        this.pushState('action'); 
                                        this.unput(yytext);
                                        yytext = '';
                                        return 'ACTION_START';

<code>"%include"                        this.pushState('path'); 
                                        return 'INCLUDE';

<INITIAL,rules,code>"%"{NAME}([^\r\n]*)
                                        %{
                                            /* ignore unrecognized decl */
                                            this.warn(rmCommonWS`
                                                LEX: ignoring unsupported lexer option ${dquote(yytext)}
                                                while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(this, yylloc));
                                            yytext = [
                                                this.matches[1],            // {NAME}
                                                this.matches[2].trim()      // optional value/parameters
                                            ];
                                            return 'UNKNOWN_DECL';
                                        %}
"%%"                                    this.pushState('rules');
                                        return '%%';
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


// detect and report unterminated string constants ASAP
// for 'action', 'options', but also for other lexer conditions:
//
// these error catching rules fix https://github.com/GerHobbelt/jison/issues/13
<action>\"                              yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';
<action>\'                              yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';
<action>\`                              yyerror(rmCommonWS`
                                            unterminated string constant in lexer rule action block.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';

<options>\"                             yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';
<options>\'                             yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';
<options>\`                             yyerror(rmCommonWS`
                                            unterminated string constant in %options entry.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';

<*>\"                                   var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unterminated string constant  encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';
<*>\'                                   var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unterminated string constant  encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';
<*>\`                                   var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                        yyerror(rmCommonWS`
                                            unterminated string constant  encountered while lexing
                                            ${rules}.

                                              Erroneous area:
                                            ` + this.prettyPrintRange(this, yylloc));
                                        return 'error';


<macro,rules>.                          %{
                                            /* b0rk on bad characters */
                                            var rules = (this.topState() === 'macro' ? 'macro\'s' : this.topState());
                                            yyerror(rmCommonWS`
                                                unsupported lexer input encountered while lexing
                                                ${rules} (i.e. jison lex regexes).

                                                    NOTE: When you want this input to be interpreted as a LITERAL part
                                                          of a lex rule regex, you MUST enclose it in double or
                                                          single quotes.

                                                          If not, then know that this input is not accepted as a valid
                                                          regex expression here in jison-lex ${rules}.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(this, yylloc));
                                        %}

<*>.                                    %{
                                            yyerror(rmCommonWS`
                                                unsupported lexer input: ${dquote(yytext)} 
						while lexing in ${dquote(this.topState())} state.

                                                  Erroneous area:
                                                ` + this.prettyPrintRange(this, yylloc));
                                        %}

<*><<EOF>>                              return 'EOF';

%%


var rmCommonWS = helpers.rmCommonWS;
var dquote     = helpers.dquote;


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
```



## license

MIT



## related repositories

- [jison / jison-gho](https://github.com/GerHobbelt/jison) @ [NPM](https://www.npmjs.com/package/jison-gho)
- [jison-lex](https://github.com/GerHobbelt/jison/master/packages/jison-lex) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/jison-lex)
- [lex-parser](https://github.com/GerHobbelt/jison/master/packages/lex-parser) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/lex-parser)
- [ebnf-parser](https://github.com/GerHobbelt/jison/master/packages/ebnf-parser) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/ebnf-parser)
- [jison2json](https://github.com/GerHobbelt/jison/master/packages/jison2json) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/jison2json)
- [json2jison](https://github.com/GerHobbelt/jison/master/packages/json2jison) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/json2jison)
- [jison-helpers-lib](https://github.com/GerHobbelt/jison/master/packages/helpers-lib) @ [NPM](https://www.npmjs.com/package/jison-helpers-lib)
- ### secondary source repositories
  + [jison-lex](https://github.com/GerHobbelt/jison-lex)
  + [lex-parser](https://github.com/GerHobbelt/lex-parser)
  + [ebnf-parser](https://github.com/GerHobbelt/ebnf-parser)
  + [jison2json](https://github.com/GerHobbelt/jison2json)
  + [json2jison](https://github.com/GerHobbelt/json2jison)
  + [jison-helpers-lib](https://github.com/GerHobbelt/jison-helpers-lib)

