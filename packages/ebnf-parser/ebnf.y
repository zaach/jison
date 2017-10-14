/* EBNF grammar spec */

%code imports %{
  import XRegExp from '@gerhobbelt/xregexp';       // for helping out the `%options xregexp` in the lexer
%}



%lex


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





%options easy_keyword_rules
%options ranges
%options xregexp



%%

\s+                       /* skip whitespace */
{ID}                      return 'SYMBOL';
"$end"                    return 'SYMBOL';
"["{ID}"]"                yytext = this.matches[1]; return 'ALIAS';

// Stringified tokens are always `'`-surrounded by the bnf.y grammar unless the token
// itself contain an `'`.
//
// Note about edge case: EBNF grammars should not barf a hairball if someone
// ever decided that the combo of quotes, i.e. `'"` would be a legal token in their grammar,
// e.g. `rule: A '\'"' B`.
//
// And, yes, we assume that the `bnf.y` parser is our regular input source, so we may
// be a bit stricter here in what we lex than in the userland-facing `bnf.l` lexer.
\'{QUOTED_STRING_CONTENT}\'
                          return 'SYMBOL';
\"{DOUBLEQUOTED_STRING_CONTENT}\"
                          return 'SYMBOL';
"."                       return 'SYMBOL';

"("                       return '(';
")"                       return ')';
"*"                       return '*';
"?"                       return '?';
"|"                       return '|';
"+"                       return '+';
<<EOF>>                   return 'EOF';

/lex



%start production

%%

production
  : handle EOF
    { return $handle; }
  ;

handle_list
  : handle
    { $$ = [$handle]; }
  | handle_list '|' handle
    {
      $handle_list.push($handle);
      $$ = $handle_list;
    }
  ;

handle
  : %epsilon
    { $$ = []; }
  | rule
    { $$ = $rule; }
  ;

rule
  : suffixed_expression
    { $$ = [$suffixed_expression]; }
  | rule suffixed_expression
    {
      $rule.push($suffixed_expression);
      $$ = $rule;
    }
  ;

suffixed_expression
  : expression suffix ALIAS
    { $$ = ['xalias', $suffix, $expression, $ALIAS]; }
  | expression suffix
    {
      if ($suffix) {
        $$ = [$suffix, $expression];
      } else {
        $$ = $expression;
      }
    }
  ;

expression
  : SYMBOL
    { $$ = ['symbol', $SYMBOL]; }
  | '(' handle_list ')'
    { $$ = ['()', $handle_list]; }
  ;

suffix
  : %epsilon
    { $$ = undefined; }
  | '*'
    { $$ = $1; }
  | '?'
    { $$ = $1; }
  | '+'
    { $$ = $1; }
  ;
