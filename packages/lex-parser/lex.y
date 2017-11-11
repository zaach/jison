
%code imports %{
  import XRegExp from '@gerhobbelt/xregexp';       // for helping out the `%options xregexp` in the lexer
  import helpers from '../helpers-lib';
  import fs from 'fs';
%}



%start lex

/* Jison lexer file format grammar */

%nonassoc '/' '/!'

%left '*' '+' '?' RANGE_REGEX
%left '|'
%left '('



%%

lex
    : init definitions rules_and_epilogue EOF
        {
          $$ = $rules_and_epilogue;
          for (var key in $definitions) {
            $$[key] = $definitions[key];
          }

          // if there are any options, add them all, otherwise set options to NULL:
          // can't check for 'empty object' by `if (yy.options) ...` so we do it this way:
          for (key in yy.options) {
            $$.options = yy.options;
            break;
          }

          if (yy.actionInclude) {
            var asrc = yy.actionInclude.join('\n\n');
            // Only a non-empty action code chunk should actually make it through:
            if (asrc.trim() !== '') {
              $$.actionInclude = asrc;
            }
          }

          delete yy.options;
          delete yy.actionInclude;
          return $$;
        }
    | init definitions error EOF
        {
            yyerror(rmCommonWS`
                There's an error in your lexer regex rules or epilogue.
                Maybe you did not correctly separate the lexer sections with a '%%'
                on an otherwise empty line?
                The lexer spec file should have this structure:

                        definitions
                        %%
                        rules
                        %%                  // <-- optional!
                        extra_module_code   // <-- optional epilogue!

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

rules_and_epilogue
    : '%%' rules '%%' extra_lexer_module_code
      {
        if ($extra_lexer_module_code.trim() !== '') {
          $$ = { rules: $rules, moduleInclude: $extra_lexer_module_code };
        } else {
          $$ = { rules: $rules };
        }
      }
    | '%%' error rules '%%' extra_lexer_module_code
      {
        yyerror(rmCommonWS`
            There's probably an error in one or more of your lexer regex rules.
            The lexer rule spec should have this structure:

                    regex  action_code

            where 'regex' is a lex-style regex expression (see the
            jison and jison-lex documentation) which is intended to match a chunk
            of the input to lex, while the 'action_code' block is the JS code
            which will be invoked when the regex is matched. The 'action_code' block
            may be any (indented!) set of JS statements, optionally surrounded
            by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.

              Erroneous code:
            ${yylexer.prettyPrintRange(@error)}

              Technical error report:
            ${$error.errStr}
        `);
      }
    | '%%' rules '%%' error
      {
        yyerror(rmCommonWS`
            There's an error in your lexer epilogue a.k.a. 'extra_module_code' block.

              Erroneous code:
            ${yylexer.prettyPrintRange(@error)}

              Technical error report:
            ${$error.errStr}
        `);
      }
    | '%%' error rules
      {
        yyerror(rmCommonWS`
            There's probably an error in one or more of your lexer regex rules.
            The lexer rule spec should have this structure:

                    regex  action_code

            where 'regex' is a lex-style regex expression (see the
            jison and jison-lex documentation) which is intended to match a chunk
            of the input to lex, while the 'action_code' block is the JS code
            which will be invoked when the regex is matched. The 'action_code' block
            may be any (indented!) set of JS statements, optionally surrounded
            by '{...}' curly braces or otherwise enclosed in a '%{...%}' block.

              Erroneous code:
            ${yylexer.prettyPrintRange(@error)}

              Technical error report:
            ${$error.errStr}
        `);
      }
    | '%%' rules
      /* Note: an empty rules set is allowed when you are setting up an `%options custom_lexer` */
      {
        $$ = { rules: $rules };
      }
    | ε
      /* Note: an empty rules set is allowed when you are setting up an `%options custom_lexer` */
      {
        $$ = { rules: [] };
      }
    ;

// because JISON doesn't support mid-rule actions,
// we set up `yy` using this empty rule at the start:
init
    : ε
        {
            yy.actionInclude = [];
            if (!yy.options) yy.options = {};
        }
    ;

definitions
    : definitions definition
        {
          $$ = $definitions;
          if ($definition != null) {
            if ('length' in $definition) {
              $$.macros[$definition[0]] = $definition[1];
            } else {
              switch ($definition.type) {
              case 'names':
                for (var name in $definition.names) {
                  $$.startConditions[name] = $definition.names[name];
                }
                break;

              case 'unknown':
                $$.unknownDecls.push($definition.body);
                break;

              case 'imports':
                $$.importDecls.push($definition.body);
                break;

              case 'codeSection':
                $$.codeSections.push($definition.body);
                break;

              default:
                yyerror(rmCommonWS`
                  Encountered an unsupported definition type: ${$definition.type}.

                    Erroneous area:
                  ${yylexer.prettyPrintRange(@definition)}
                `);
                break;
              }
            }
          }
        }
    | ε
        {
          $$ = {
            macros: {},           // { hash table }
            startConditions: {},  // { hash table }
            codeSections: [],     // [ array of {qualifier,include} pairs ]
            importDecls: [],      // [ array of {name,path} pairs ]
            unknownDecls: []      // [ array of {name,value} pairs ]
          };
        }
    ;

definition
    : NAME regex
        { $$ = [$NAME, $regex]; }
    | START_INC names_inclusive
        { $$ = $names_inclusive; }
    | START_EXC names_exclusive
        { $$ = $names_exclusive; }
    | action
        {
            var rv = checkActionBlock($action, @action);
            if (rv) {
                yyerror(rmCommonWS`
                    The '%{...%}' lexer setup action code section does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@action)}
                `);
            }
            yy.actionInclude.push($action);
            $$ = null;
        }
    | options
        { $$ = null; }
    | UNKNOWN_DECL
        { 
            $$ = {
                type: 'unknown', 
                body: $1
            }; 
        }
    | IMPORT import_name import_path
        { 
            $$ = {
                type: 'imports', 
                body: { 
                    name: $import_name, 
                    path: $import_path 
                } 
            }; 
        }
    | IMPORT import_name error
        {
            yyerror(rmCommonWS`
                You did not specify a legal file path for the '%import' initialization code statement, which must have the format:
                    %import qualifier_name file_path

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error, @IMPORT)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | IMPORT error
        {
            yyerror(rmCommonWS`
                %import name or source filename missing maybe?

                Note: each '%import'-ed initialization code section must be qualified by a name, e.g. 'required' before the import path itself:
                    %import qualifier_name file_path

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error, @IMPORT)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | INIT_CODE init_code_name action
        {
            var rv = checkActionBlock($action, @action);
            var name = $init_code_name;
            var code = $action;
            if (rv) {
                yyerror(rmCommonWS`
                    The '%code ${name}' action code section does not compile: ${rv}

                    ${code}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@action, @INIT_CODE)}
                `);
            }
            $$ = {
                type: 'codeSection',
                body: {
                  qualifier: $init_code_name,
                  include: $action
                }
            };
        }
    | INIT_CODE error action
        {
            yyerror(rmCommonWS`
                Each '%code' initialization code section must be qualified by a name, e.g. 'required' before the action code itself:
                    %code qualifier_name {action code}

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error, @INIT_CODE, @action)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

init_code_name
    : NAME
        { $$ = $NAME; }
    | STRING_LIT
        { $$ = $STRING_LIT; }
    ;

import_name
    : NAME
        { $$ = $NAME; }
    | STRING_LIT
        { $$ = $STRING_LIT; }
    ;

import_path
    : NAME
        { $$ = $NAME; }
    | STRING_LIT
        { $$ = $STRING_LIT; }
    ;

names_inclusive
    : START_COND
        { $$ = {type: 'names', names: {}}; $$.names[$START_COND] = 0; }
    | names_inclusive START_COND
        { $$ = $names_inclusive; $$.names[$START_COND] = 0; }
    ;

names_exclusive
    : START_COND
        { $$ = {type: 'names', names: {}}; $$.names[$START_COND] = 1; }
    | names_exclusive START_COND
        { $$ = $names_exclusive; $$.names[$START_COND] = 1; }
    ;

rules
    : rules rules_collective
        { $$ = $rules.concat($rules_collective); }
    | ε
        { $$ = []; }
    ;

rules_collective
    : start_conditions rule
        {
            if ($start_conditions) {
                $rule.unshift($start_conditions);
            }
            $$ = [$rule];
        }
    | start_conditions '{' rule_block '}'
        {
            if ($start_conditions) {
                $rule_block.forEach(function (d) {
                    d.unshift($start_conditions);
                });
            }
            $$ = $rule_block;
        }
    | start_conditions '{' error '}'
        {
            yyerror(rmCommonWS`
                Seems you made a mistake while specifying one of the lexer rules inside
                the start condition
                   <${$start_conditions.join(',')}> { rules... }
                block.

                  Erroneous area:
                ${yylexer.prettyPrintRange(yylexer.mergeLocationInfo(##start_conditions, ##4), @start_conditions)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | start_conditions '{' error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly bracket a lexer rules set inside
                the start condition
                  <${$start_conditions.join(',')}> { rules... }
                as a terminating curly brace '}' could not be found.

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @start_conditions)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

rule_block
    : rule_block rule
        { $$ = $rule_block; $$.push($rule); }
    | ε
        { $$ = []; }
    ;

rule
    : regex action
        {
            var rv = checkActionBlock($action, @action);
            if (rv) {
                yyerror(rmCommonWS`
                    The rule's action code section does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@action)}
                `);
            }
            $$ = [$regex, $action];
        }
    | regex error
        {
            $$ = [$regex, $error];
            yyerror(rmCommonWS`
                Lexer rule regex action code declaration error?

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error, @regex)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

action
    : ACTION_START action_body BRACKET_MISSING
        {
            yyerror(rmCommonWS`
                Missing curly braces: seems you did not correctly bracket a lexer rule action block in curly braces: '{ ... }'.

                  Offending action body:
                ${yylexer.prettyPrintRange(@BRACKET_MISSING, @1)}
            `);
        }
    | ACTION_START action_body BRACKET_SURPLUS
        {
            yyerror(rmCommonWS`
                Too many curly braces: seems you did not correctly bracket a lexer rule action block in curly braces: '{ ... }'.

                  Offending action body:
                ${yylexer.prettyPrintRange(@BRACKET_SURPLUS, @1)}
            `);
        }
    | ACTION_START action_body ACTION_END
        {
            var s = $action_body.trim();
            // remove outermost set of braces UNLESS there's
            // a curly brace in there anywhere: in that case
            // we should leave it up to the sophisticated
            // code analyzer to simplify the code!
            //
            // This is a very rough check as it will also look
            // inside code comments, which should not have
            // any influence.
            //
            // Nevertheless: this is a *safe* transform!
            if (s[0] === '{' && s.indexOf('}') === s.length - 1) {
                $$ = s.substring(1, s.length - 1).trim();
            } else {
                $$ = s;
            }
        }
    ;

action_body
    : action_body ACTION
        { $$ = $action_body + '\n\n' + $ACTION + '\n\n'; }
    | action_body ACTION_BODY
        { $$ = $action_body + $ACTION_BODY; }
    | action_body ACTION_BODY_C_COMMENT
        { $$ = $action_body + $ACTION_BODY_C_COMMENT; }
    | action_body ACTION_BODY_CPP_COMMENT
        { $$ = $action_body + $ACTION_BODY_CPP_COMMENT; }
    | action_body ACTION_BODY_WHITESPACE
        { $$ = $action_body + $ACTION_BODY_WHITESPACE; }
    | action_body include_macro_code
        { $$ = $action_body + '\n\n' + $include_macro_code + '\n\n'; }
    | action_body INCLUDE_PLACEMENT_ERROR
        {
            yyerror(rmCommonWS`
                You may place the '%include' instruction only at the start/front of a line.

                  Its use is not permitted at this position:
                ${yylexer.prettyPrintRange(@INCLUDE_PLACEMENT_ERROR, @action_body)}
            `);
        }
    | action_body error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly match curly braces '{ ... }' in a lexer rule action block.

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error, @action_body)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | ε
        { $$ = ''; }
    ;

start_conditions
    : '<' name_list '>'
        { $$ = $name_list; }
    | '<' name_list error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly terminate the start condition set <${$name_list.join(',')},???> with a terminating '>'

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error, @1)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | '<' '*' '>'
        { $$ = ['*']; }
    | ε
    ;

name_list
    : NAME
        { $$ = [$NAME]; }
    | name_list ',' NAME
        { $$ = $name_list; $$.push($NAME); }
    ;

regex
    : nonempty_regex_list[re]
        {
          // Detect if the regex ends with a pure (Unicode) word;
          // we *do* consider escaped characters which are 'alphanumeric'
          // to be equivalent to their non-escaped version, hence these are
          // all valid 'words' for the 'easy keyword rules' option:
          //
          // - hello_kitty
          // - γεια_σου_γατούλα
          // - \u03B3\u03B5\u03B9\u03B1_\u03C3\u03BF\u03C5_\u03B3\u03B1\u03C4\u03BF\u03CD\u03BB\u03B1
          //
          // http://stackoverflow.com/questions/7885096/how-do-i-decode-a-string-with-escaped-unicode#12869914
          //
          // As we only check the *tail*, we also accept these as
          // 'easy keywords':
          //
          // - %options
          // - %foo-bar
          // - +++a:b:c1
          //
          // Note the dash in that last example: there the code will consider
          // `bar` to be the keyword, which is fine with us as we're only
          // interested in the trailing boundary and patching that one for
          // the `easy_keyword_rules` option.
          $$ = $re;
          if (yy.options.easy_keyword_rules) {
            // We need to 'protect' `eval` here as keywords are allowed
            // to contain double-quotes and other leading cruft.
            // `eval` *does* gobble some escapes (such as `\b`) but
            // we protect against that through a simple replace regex:
            // we're not interested in the special escapes' exact value
            // anyway.
            // It will also catch escaped escapes (`\\`), which are not
            // word characters either, so no need to worry about
            // `eval(str)` 'correctly' converting convoluted constructs
            // like '\\\\\\\\\\b' in here.
            $$ = $$
            .replace(/\\\\/g, '.')
            .replace(/"/g, '.')
            .replace(/\\c[A-Z]/g, '.')
            .replace(/\\[^xu0-9]/g, '.');

            try {
              // Convert Unicode escapes and other escapes to their literal characters
              // BEFORE we go and check whether this item is subject to the
              // `easy_keyword_rules` option.
              $$ = JSON.parse('"' + $$ + '"');
            }
            catch (ex) {
              yyparser.warn('easy-keyword-rule FAIL on eval: ', ex);

              // make the next keyword test fail:
              $$ = '.';
            }
            // a 'keyword' starts with an alphanumeric character,
            // followed by zero or more alphanumerics or digits:
            var re = new XRegExp('\\w[\\w\\d]*$');
            if (XRegExp.match($$, re)) {
              $$ = $re + "\\b";
            } else {
              $$ = $re;
            }
          }
        }
    ;

regex_list
    : regex_list '|' regex_concat
        { $$ = $1 + '|' + $3; }
    | regex_list '|'
        { $$ = $1 + '|'; }
    | regex_concat
        { $$ = $1; }
    | ε
        { $$ = ''; }
    ;

nonempty_regex_list
    : nonempty_regex_list '|' regex_concat
        { $$ = $1 + '|' + $3; }
    | nonempty_regex_list '|'
        { $$ = $1 + '|'; }
    | '|' regex_concat
        { $$ = '|' + $2; }
    | regex_concat
        { $$ = $1; }
    ;

regex_concat
    : regex_concat regex_base
        { $$ = $1 + $2; }
    | regex_base
        { $$ = $1; }
    ;

regex_base
    : '(' regex_list ')'
        { $$ = '(' + $regex_list + ')'; }
    | SPECIAL_GROUP regex_list ')'
        { $$ = $SPECIAL_GROUP + $regex_list + ')'; }
    | '(' regex_list error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly bracket a lex rule regex part in '(...)' braces.

                  Unterminated regex part:
                ${yylexer.prettyPrintRange(@error, @1)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | SPECIAL_GROUP regex_list error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly bracket a lex rule regex part in '(...)' braces.

                  Unterminated regex part:
                ${yylexer.prettyPrintRange(@error, @SPECIAL_GROUP)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | regex_base '+'
        { $$ = $regex_base + '+'; }
    | regex_base '*'
        { $$ = $regex_base + '*'; }
    | regex_base '?'
        { $$ = $regex_base + '?'; }
    | '/' regex_base
        { $$ = '(?=' + $regex_base + ')'; }
    | '/!' regex_base
        { $$ = '(?!' + $regex_base + ')'; }
    | name_expansion
    | regex_base range_regex
        { $$ = $1 + $2; }
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
    : REGEX_SET_START regex_set REGEX_SET_END
        { $$ = $REGEX_SET_START + $regex_set + $REGEX_SET_END; }
    | REGEX_SET_START regex_set error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly bracket a lex rule regex set in '[...]' brackets.

                  Unterminated regex set:
                ${yylexer.prettyPrintRange(@error, @REGEX_SET_START)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

regex_set
    : regex_set regex_set_atom
        { $$ = $regex_set + $regex_set_atom; }
    | regex_set_atom
    ;

regex_set_atom
    : REGEX_SET
    | name_expansion
        {
            if (XRegExp._getUnicodeProperty($name_expansion.replace(/[{}]/g, ''))
                && $name_expansion.toUpperCase() !== $name_expansion
            ) {
                // treat this as part of an XRegExp `\p{...}` Unicode 'General Category' Property cf. http://unicode.org/reports/tr18/#Categories
                $$ = $name_expansion;
            } else {
                $$ = $name_expansion;
            }
            //yyparser.log("name expansion for: ", { name: $name_expansion, redux: $name_expansion.replace(/[{}]/g, ''), output: $$ });
        }
    ;

escape_char
    : ESCAPE_CHAR
        { $$ = $ESCAPE_CHAR; }
    ;

range_regex
    : RANGE_REGEX
        { $$ = $RANGE_REGEX; }
    ;

string
    : STRING_LIT
        { $$ = prepareString($STRING_LIT); }
    | CHARACTER_LIT
    ;

options
    : OPTIONS option_list OPTIONS_END
        { $$ = null; }
    ;

option_list
    : option option_list
        { $$ = null; }
    | option
        { $$ = null; }
    ;

option
    : NAME[option]
        { yy.options[$option] = true; }
    | NAME[option] '=' OPTION_STRING_VALUE[value]
        { yy.options[$option] = $value; }
    | NAME[option] '=' OPTION_VALUE[value]
        { yy.options[$option] = parseValue($value); }
    | NAME[option] '=' NAME[value]
        { yy.options[$option] = parseValue($value); }
    | NAME[option] '=' error
        {
            // TODO ...
            yyerror(rmCommonWS`
                Internal error: option "${$option}" value assignment failure.

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @option)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    | error
        {
            // TODO ...
            yyerror(rmCommonWS`
                Expected a valid option name (with optional value assignment).

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

extra_lexer_module_code
    : optional_module_code_chunk
        {
            var rv = checkActionBlock($optional_module_code_chunk, @optional_module_code_chunk);
            if (rv) {
                yyerror(rmCommonWS`
                    The extra lexer module code section (a.k.a. 'epilogue') does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@optional_module_code_chunk)}
                `);
            }
            $$ = $optional_module_code_chunk;
        }
    | extra_lexer_module_code include_macro_code optional_module_code_chunk
        {
            // Each of the 3 chunks should be parse-able as a JS snippet on its own.
            //
            // Note: we have already checked the first section in a previous reduction
            // of this rule, so we don't need to check that one again!
            var rv = checkActionBlock($include_macro_code, @include_macro_code);
            if (rv) {
                yyerror(rmCommonWS`
                    The source code %include-d into the extra lexer module code section (a.k.a. 'epilogue') does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@include_macro_code)}
                `);
            }
            rv = checkActionBlock($optional_module_code_chunk, @optional_module_code_chunk);
            if (rv) {
                yyerror(rmCommonWS`
                    The extra lexer module code section (a.k.a. 'epilogue') does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@optional_module_code_chunk)}
                `);
            }
            $$ = $extra_lexer_module_code + $include_macro_code + $optional_module_code_chunk;
        }
    ;

include_macro_code
    : INCLUDE PATH
        {
            var fileContent = fs.readFileSync($PATH, { encoding: 'utf-8' });
            // And no, we don't support nested '%include':
            $$ = '\n// Included by Jison: ' + $PATH + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + $PATH + '\n\n';
        }
    | INCLUDE error
        {
            yyerror(rmCommonWS`
                %include MUST be followed by a valid file path.

                  Erroneous path:
                ${yylexer.prettyPrintRange(@error, @INCLUDE)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

module_code_chunk
    : CODE
        { $$ = $CODE; }
    | module_code_chunk CODE
        { $$ = $module_code_chunk + $CODE; }
    | error CODE
        {
            // TODO ...
            yyerror(rmCommonWS`
                Module code declaration error?

                  Erroneous code:
                ${yylexer.prettyPrintRange(@error)}

                  Technical error report:
                ${$error.errStr}
            `);
        }
    ;

optional_module_code_chunk
    : module_code_chunk
        { $$ = $module_code_chunk; }
    | ε
        { $$ = ''; }
    ;

%%


var rmCommonWS = helpers.rmCommonWS;
var checkActionBlock = helpers.checkActionBlock;


function encodeRE(s) {
    return s.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1').replace(/\\\\u([a-fA-F0-9]{4})/g, '\\u$1');
}

function prepareString(s) {
    // unescape slashes
    s = s.replace(/\\\\/g, "\\");
    s = encodeRE(s);
    return s;
}

// convert string value to number or boolean value, when possible
// (and when this is more or less obviously the intent)
// otherwise produce the string itself as value.
function parseValue(v) {
    if (v === 'false') {
        return false;
    }
    if (v === 'true') {
        return true;
    }
    // http://stackoverflow.com/questions/175739/is-there-a-built-in-way-in-javascript-to-check-if-a-string-is-a-valid-number
    // Note that the `v` check ensures that we do not convert `undefined`, `null` and `''` (empty string!)
    if (v && !isNaN(v)) {
        var rv = +v;
        if (isFinite(rv)) {
            return rv;
        }
    }
    return v;
}


parser.warn = function p_warn() {
    console.warn.apply(console, arguments);
};

parser.log = function p_log() {
    console.log.apply(console, arguments);
};

parser.pre_parse = function p_lex() {
    if (parser.yydebug) parser.log('pre_parse:', arguments);
};

parser.yy.pre_parse = function p_lex() {
    if (parser.yydebug) parser.log('pre_parse YY:', arguments);
};

parser.yy.post_lex = function p_lex() {
    if (parser.yydebug) parser.log('post_lex:', arguments);
};

