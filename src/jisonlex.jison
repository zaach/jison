/* Jison lexer file format grammar */

%nonassoc '/' '/!'

%left '*' '+' '?' RANGE_REGEX

%%

lex
    : definitions '%%' rules epilogue
        { $$ = {rules: $rules};
          if ($definitions[0]) $$.macros = $definitions[0];
          if ($definitions[1]) $$.startConditions = $definitions[1];
          if ($epilogue) $$.moduleInclude = $epilogue;
          if (yy.options) $$.options = yy.options;
          if (yy.actionInclude) $$.actionInclude = yy.actionInclude;
          delete yy.options;
          delete yy.actionInclude;
          return $$; }
    ;

epilogue
    : EOF
      { $$ = null; }
    | '%%' EOF
      { $$ = null; }
    | '%%' CODE EOF
      { $$ = $2; }
    ;

definitions
    : definition definitions
        {
          $$ = $definitions;
          if ('length' in $definition) {
            $$[0] = $$[0] || {};
            $$[0][$definition[0]] = $definition[1];
          } else {
            $$[1] = $$[1] || {};
            for (var name in $definition) {
              $$[1][name] = $definition[name];
            }
          }
        }
    | ACTION definitions
        { yy.actionInclude += $1; $$ = $definitions; }
    |
        { yy.actionInclude = ''; $$ = [null,null]; }
    ;

definition
    : NAME regex
        { $$ = [$1, $2]; }
    | START_INC names_inclusive
        { $$ = $2; }
    | START_EXC names_exclusive
        { $$ = $2; }
    ;

names_inclusive
    : START_COND
        { $$ = {}; $$[$1] = 0; }
    | names_inclusive START_COND
        { $$ = $1; $$[$2] = 0; }
    ;

names_exclusive
    : START_COND
        { $$ = {}; $$[$1] = 1; }
    | names_exclusive START_COND
        { $$ = $1; $$[$2] = 1; }
    ;

rules
    : rules rule
        { $$ = $1; $$.push($2); }
    | rule
        { $$ = [$1]; }
    ;

rule
    : start_conditions regex action
        { $$ = $1 ? [$1, $2, $3] : [$2,$3]; }
    ;

action
    : '{' action_body '}'
        {$$ = $2;}
    | ACTION
        {$$ = $1;}
    ;

action_body
    :
        {$$ = '';}
    | ACTION_BODY
        {$$ = yytext;}
    | action_body '{' action_body '}' ACTION_BODY
        {$$ = $1+$2+$3+$4+$5;}
    | action_body '{' action_body '}'
        {$$ = $1+$2+$3+$4;}
    ;



start_conditions
    : '<' name_list '>'
        { $$ = $2; }
    | '<' '*' '>'
        { $$ = ['*']; }
    |
    ;

name_list
    : NAME
        { $$ = [$1]; }
    | name_list ',' NAME
        { $$ = $1; $$.push($3); }
    ;

regex
    : regex_list
        { $$ = $1;
          if (!(yy.options && yy.options.flex) && $$.match(/[\w\d]$/) && !$$.match(/\\(b|c[A-Z]|x[0-9A-F]{2}|u[a-fA-F0-9]{4}|[0-7]{1,3})$/))
              $$ += "\\b";
        }
    ;

regex_list
    : regex_list '|' regex_concat
        { $$ = $1+'|'+$3; }
    | regex_list '|'
        { $$ = $1+'|'; }
    | regex_concat
    |
        { $$ = '' }
    ;

regex_concat
    : regex_concat regex_base
        { $$ = $1+$2; }
    | regex_base
    ;

regex_base
    : '(' regex_list ')'
        { $$ = '('+$2+')'; }
    | SPECIAL_GROUP regex_list ')'
        { $$ = $1+$2+')'; }
    | regex_base '+'
        { $$ = $1+'+'; }
    | regex_base '*'
        { $$ = $1+'*'; }
    | regex_base '?'
        { $$ = $1+'?'; }
    | '/' regex_base
        { $$ = '(?='+$2+')'; }
    | '/!' regex_base
        { $$ = '(?!'+$2+')'; }
    | name_expansion
    | regex_base range_regex
        { $$ = $1+$2; }
    | any_group_regex
    | '.'
        { $$ = '.'; }
    | '^'
        { $$ = '^'; }
    | '$'
        { $$ = '$'; }
    | string
    | escape_char
    ;

name_expansion
    : NAME_BRACE
    ;

any_group_regex
    : ANY_GROUP_REGEX
        { $$ = yytext; }
    ;

escape_char
    : ESCAPE_CHAR
        { $$ = yytext; }
    ;

range_regex
    : RANGE_REGEX
        { $$ = yytext; }
    ;

string
    : STRING_LIT
        { $$ = yy.prepareString(yytext.substr(1, yytext.length-2)); }
    | CHARACTER_LIT
    ;

