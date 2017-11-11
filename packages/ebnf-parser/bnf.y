
%code imports %{
  import XRegExp from '@gerhobbelt/xregexp';       // for helping out the `%options xregexp` in the lexer
  import helpers from '../helpers-lib';
  import fs from 'fs';
  import transform from './ebnf-transform';
%}



%start spec

// %parse-param options


/* grammar for parsing jison grammar files */

%{
var ebnf = false;
%}


%code error_recovery_reduction %{
    // Note:
    //
    // This code section is specifically targetting error recovery handling in the
    // generated parser when the error recovery is unwinding the parse stack to arrive
    // at the targeted error handling production rule.
    //
    // This code is treated like any production rule action code chunk:
    // Special variables `$$`, `$@`, etc. are recognized, while the 'rule terms' can be
    // addressed via `$n` macros as in usual rule actions, only here we DO NOT validate
    // their usefulness as the 'error reduce action' accepts a variable number of
    // production terms (available in `yyrulelength` in case you wish to address the
    // input terms directly in the `yyvstack` and `yylstack` arrays, for instance).
    //
    // This example recovery rule simply collects all parse info stored in the parse
    // stacks and which would otherwise be discarded immediately after this call, thus
    // keeping all parse info details up to the point of actual error RECOVERY available
    // to userland code in the handling 'error rule' in this grammar.
%}


%%

spec
    : declaration_list '%%' grammar optional_end_block EOF
        {
            $$ = $declaration_list;
            if ($optional_end_block.trim() !== '') {
                yy.addDeclaration($$, { include: $optional_end_block });
            }
            return extend($$, $grammar);
        }
    | declaration_list '%%' grammar error EOF
        {
            yyerror(rmCommonWS`
                Maybe you did not correctly separate trailing code from the grammar rule set with a '%%' marker on an otherwise empty line?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @grammar)}
            `);
        }
    | declaration_list error EOF
        {
            yyerror(rmCommonWS`
                Maybe you did not correctly separate the parse 'header section' (token definitions, options, lexer spec, etc.) from the grammar rule set with a '%%' on an otherwise empty line?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @declaration_list)}
            `);
        }
    ;

optional_end_block
    : %empty
        { $$ = ''; }
    | '%%' extra_parser_module_code
        { 
            var rv = checkActionBlock($extra_parser_module_code, @extra_parser_module_code);
            if (rv) {
                yyerror(rmCommonWS`
                    The extra parser module code section (a.k.a. 'epilogue') does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@extra_parser_module_code)}
                `);
            }
            $$ = $extra_parser_module_code; 
        }
    ;

optional_action_header_block
    : %empty
        { $$ = {}; }
    | optional_action_header_block ACTION
        {
            $$ = $optional_action_header_block;
            var rv = checkActionBlock($ACTION, @ACTION);
            if (rv) {
                yyerror(rmCommonWS`
                    action header code block does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@ACTION)}
                `);
            }
            yy.addDeclaration($$, { actionInclude: $ACTION });
        }
    | optional_action_header_block include_macro_code
        {
            $$ = $optional_action_header_block;
            var rv = checkActionBlock($include_macro_code, @include_macro_code);
            if (rv) {
                yyerror(rmCommonWS`
                    action header code block does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@include_macro_code)}
                `);
            }
            yy.addDeclaration($$, { actionInclude: $include_macro_code });
        }
    ;

declaration_list
    : declaration_list declaration
        { $$ = $declaration_list; yy.addDeclaration($$, $declaration); }
    | %epsilon
        { $$ = {}; }
    | declaration_list error
        {
            // TODO ...
            yyerror(rmCommonWS`
                declaration list error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @declaration_list)}
            `);
        }
    ;

declaration
    : START id
        { $$ = {start: $id}; }
    | LEX_BLOCK
        { $$ = {lex: {text: $LEX_BLOCK, position: @LEX_BLOCK}}; }
    | operator
        { $$ = {operator: $operator}; }
    | TOKEN full_token_definitions
        { $$ = {token_list: $full_token_definitions}; }
    | ACTION
        { 
            var rv = checkActionBlock($ACTION, @ACTION);
            if (rv) {
                yyerror(rmCommonWS`
                    action code block does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@ACTION)}
                `);
            }
            $$ = {include: $ACTION}; 
        }
    | include_macro_code
        { 
            var rv = checkActionBlock($include_macro_code, @include_macro_code);
            if (rv) {
                yyerror(rmCommonWS`
                    action header code block does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@include_macro_code)}
                `);
            }
            $$ = {include: $include_macro_code}; 
        }
    | parse_params
        { $$ = {parseParams: $parse_params}; }
    | parser_type
        { $$ = {parserType: $parser_type}; }
    | options
        { $$ = {options: $options}; }
    | DEBUG
        { $$ = {options: [['debug', true]]}; }
    | EBNF
        {
            ebnf = true; 
            $$ = {options: [['ebnf', true]]}; 
        }
    | UNKNOWN_DECL
        { $$ = {unknownDecl: $UNKNOWN_DECL}; }
    | IMPORT import_name import_path
        { $$ = {imports: {name: $import_name, path: $import_path}}; }
    | IMPORT import_name error
        {
            yyerror(rmCommonWS`
                You did not specify a legal file path for the '%import' initialization code statement, which must have the format:

                    %import qualifier_name file_path

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @IMPORT)}
            `);
        }
    | IMPORT error import_path
        {
            yyerror(rmCommonWS`
                Each '%import'-ed initialization code section must be qualified by a name, e.g. 'required' before the import path itself:

                    %import qualifier_name file_path

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @IMPORT)}
            `);
        }
    | INIT_CODE init_code_name action_ne
        {
            var rv = checkActionBlock($action_ne, @action_ne);
            if (rv) {
                yyerror(rmCommonWS`
                    %code "${$init_code_name}" initialization section action code block does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@action_ne, @INIT_CODE)}
                `);
            }
            $$ = {
                initCode: {
                    qualifier: $init_code_name,
                    include: $action_ne
                }
            };
        }
    | INIT_CODE error action_ne
        {
            yyerror(rmCommonWS`
                Each '%code' initialization code section must be qualified by a name, e.g. 'required' before the action code itself:

                    %code qualifier_name {action code}

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @INIT_CODE, @action_ne)}
            `);
        }
    | START error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %start token error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @START)}
            `);
        }
    | TOKEN error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %token definition list error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @TOKEN)}
            `);
        }
    | IMPORT error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %import name or source filename missing maybe?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @IMPORT)}
            `);
        }
//    | INIT_CODE error
    ;

init_code_name
    : ID
        { $$ = $ID; }
    | NAME
        { $$ = $NAME; }
    | STRING
        { $$ = $STRING; }
    ;

import_name
    : ID
        { $$ = $ID; }
    | STRING
        { $$ = $STRING; }
    ;

import_path
    : ID
        { $$ = $ID; }
    | STRING
        { $$ = $STRING; }
    ;

options
    : OPTIONS option_list OPTIONS_END
        { $$ = $option_list; }
    | OPTIONS error OPTIONS_END
        {
            // TODO ...
            yyerror(rmCommonWS`
                %options ill defined / error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @OPTIONS, @OPTIONS_END)}
            `);
        }
    | OPTIONS error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %options don't seem terminated?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @OPTIONS)}
            `);
        }
    ;

option_list
    : option_list option
        { $$ = $option_list; $$.push($option); }
    | option
        { $$ = [$option]; }
    ;

option
    : NAME[option]
        { $$ = [$option, true]; }
    | NAME[option] '=' OPTION_STRING_VALUE[value]
        { $$ = [$option, $value]; }
    | NAME[option] '=' OPTION_VALUE[value]
        { $$ = [$option, parseValue($value)]; }
    | NAME[option] '=' NAME[value]
        { $$ = [$option, parseValue($value)]; }
    | NAME[option] '=' error
        {
            // TODO ...
            yyerror(rmCommonWS`
                named %option value error for ${$option}?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @option)}
            `);
        }
    | NAME[option] error
        {
            // TODO ...
            yyerror(rmCommonWS`
                named %option value assignment error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @option)}
            `);
        }
    ;

parse_params
    : PARSE_PARAM token_list
        { $$ = $token_list; }
    | PARSE_PARAM error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %parse-params declaration error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @PARSE_PARAM)}
            `);
        }
    ;

parser_type
    : PARSER_TYPE symbol
        { $$ = $symbol; }
    | PARSER_TYPE error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %parser-type declaration error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @PARSER_TYPE)}
            `);
        }
    ;

operator
    : associativity token_list
        { $$ = [$associativity]; $$.push.apply($$, $token_list); }
    | associativity error
        {
            // TODO ...
            yyerror(rmCommonWS`
                operator token list error in an associativity statement?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @associativity)}
            `);
        }
    ;

associativity
    : LEFT
        { $$ = 'left'; }
    | RIGHT
        { $$ = 'right'; }
    | NONASSOC
        { $$ = 'nonassoc'; }
    ;

token_list
    : token_list symbol
        { $$ = $token_list; $$.push($symbol); }
    | symbol
        { $$ = [$symbol]; }
    ;

// As per http://www.gnu.org/software/bison/manual/html_node/Token-Decl.html
full_token_definitions
    : optional_token_type id_list
        {
            var rv = [];
            var lst = $id_list;
            for (var i = 0, len = lst.length; i < len; i++) {
                var id = lst[i];
                var m = {id: id};
                if ($optional_token_type) {
                    m.type = $optional_token_type;
                }
                rv.push(m);
            }
            $$ = rv;
        }
    | optional_token_type one_full_token
        {
            var m = $one_full_token;
            if ($optional_token_type) {
                m.type = $optional_token_type;
            }
            $$ = [m];
        }
    ;

one_full_token
    : id token_value token_description
        {
            $$ = {
                id: $id,
                value: $token_value,
                description: $token_description
            };
        }
    | id token_description
        {
            $$ = {
                id: $id,
                description: $token_description
            };
        }
    | id token_value
        {
            $$ = {
                id: $id,
                value: $token_value
            };
        }
    ;

optional_token_type
    : %epsilon
        { $$ = false; }
    | TOKEN_TYPE
        { $$ = $TOKEN_TYPE; }
    ;

token_value
    : INTEGER
        { $$ = $INTEGER; }
    ;

token_description
    : STRING
        { $$ = $STRING; }
    ;

id_list
    : id_list id
        { $$ = $id_list; $$.push($id); }
    | id
        { $$ = [$id]; }
    ;

// token_id
//     : TOKEN_TYPE id
//         { $$ = $id; }
//     | id
//         { $$ = $id; }
//     ;

grammar
    : optional_action_header_block production_list
        {
            $$ = $optional_action_header_block;
            $$.grammar = $production_list;
        }
    ;

production_list
    : production_list production
        {
            $$ = $production_list;
            if ($production[0] in $$) {
                $$[$production[0]] = $$[$production[0]].concat($production[1]);
            } else {
                $$[$production[0]] = $production[1];
            }
        }
    | production
        { $$ = {}; $$[$production[0]] = $production[1]; }
    ;

production
    : production_id handle_list ';'
        {$$ = [$production_id, $handle_list];}
    | production_id error ';'
        {
            // TODO ...
            yyerror(rmCommonWS`
                rule production declaration error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @production_id)}
            `);
        }
    | production_id error
        {
            // TODO ...
            yyerror(rmCommonWS`
                rule production declaration error: did you terminate the rule production set with a semicolon?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @production_id)}
            `);
        }
    ;

production_id
    : id optional_production_description ':'
        {
            $$ = $id;

            // TODO: carry rule description support into the parser generator...
        }
    | id optional_production_description error
        {
            // TODO ...
            yyerror(rmCommonWS`
                rule id should be followed by a colon, but that one seems missing?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @id)}
            `);
        }
    ;

optional_production_description
    : STRING
        { $$ = $STRING; }
    | %epsilon
    ;

handle_list
    : handle_list '|' handle_action
        {
            $$ = $handle_list;
            $$.push($handle_action);
        }
    | handle_action
        {
            $$ = [$handle_action];
        }
    | handle_list '|' error
        {
            // TODO ...
            yyerror(rmCommonWS`
                rule alternative production declaration error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @handle_list)}
            `);
        }
    | handle_list ':' error
        {
            // TODO ...
            yyerror(rmCommonWS`
                multiple alternative rule productions should be separated by a '|' pipe character, not a ':' colon!

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @handle_list)}
            `);
        }
    ;

handle_action
    : handle prec action
        {
            $$ = [($handle.length ? $handle.join(' ') : '')];
            if ($action) {
                var rv = checkActionBlock($action, @action);
                if (rv) {
                    yyerror(rmCommonWS`
                        production rule action code block does not compile: ${rv}

                          Erroneous area:
                        ${yylexer.prettyPrintRange(@action, @handle)}
                    `);
                }
                $$.push($action);
            }
            if ($prec) {
                if ($handle.length === 0) {
                    yyerror(rmCommonWS`
                        You cannot specify a precedence override for an epsilon (a.k.a. empty) rule!

                          Erroneous area:
                        ${yylexer.prettyPrintRange(@handle, @0, @action /* @handle is very probably NULL! We need this one for some decent location info! */)}
                    `);
                }
                $$.push($prec);
            }
            if ($$.length === 1) {
                $$ = $$[0];
            }
        }
    | EPSILON action
        // %epsilon may only be used to signal this is an empty rule alt;
        // hence it can only occur by itself
        // (with an optional action block, but no alias what-so-ever nor any precedence override).
        {
            $$ = [''];
            if ($action) {
                var rv = checkActionBlock($action, @action);
                if (rv) {
                    yyerror(rmCommonWS`
                        epsilon production rule action code block does not compile: ${rv}

                          Erroneous area:
                        ${yylexer.prettyPrintRange(@action, @EPSILON)}
                    `);
                }
                $$.push($action);
            }
            if ($$.length === 1) {
                $$ = $$[0];
            }
        }
    | EPSILON error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %epsilon rule action declaration error?

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @EPSILON)}
            `);
        }
    ;

handle
    : handle suffixed_expression
        {
            $$ = $handle;
            $$.push($suffixed_expression);
        }
    | %epsilon
        {
            $$ = [];
        }
    ;

handle_sublist
    : handle_sublist '|' handle
        {
            $$ = $handle_sublist;
            $$.push($handle.join(' '));
        }
    | handle
        {
            $$ = [$handle.join(' ')];
        }
    ;

suffixed_expression
    : expression suffix ALIAS
        {
            $$ = $expression + $suffix + "[" + $ALIAS + "]";
        }
    | expression suffix
        {
            $$ = $expression + $suffix;
        }
    ;

expression
    : ID
        {
            $$ = $ID;
        }
    | EOF_ID
        {
            $$ = '$end';
        }
    | STRING
        {
            // Re-encode the string *anyway* as it will
            // be made part of the rule rhs a.k.a. production (type: *string*) again and we want
            // to be able to handle all tokens, including *significant space*
            // encoded as literal tokens in a grammar such as this: `rule: A ' ' B`.
            $$ = dquote($STRING);
        }
    | '(' handle_sublist ')'
        {
            $$ = '(' + $handle_sublist.join(' | ') + ')';
        }
    | '(' handle_sublist error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly bracket a grammar rule sublist in '( ... )' brackets.

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @1)}
            `);
        }
    ;

suffix
    : %epsilon
        { $$ = ''; }
    | '*'
        { $$ = $1; }
    | '?'
        { $$ = $1; }
    | '+'
        { $$ = $1; }
    ;

prec
    : PREC symbol
        {
            $$ = { prec: $symbol };
        }
    | PREC error
        {
            // TODO ...
            yyerror(rmCommonWS`
                %prec precedence override declaration error?

                  Erroneous precedence declaration:
                ${yylexer.prettyPrintRange(@error, @PREC)}
            `);
        }
    | %epsilon
        {
            $$ = null;
        }
    ;

symbol
    : id
        { $$ = $id; }
    | STRING
        { $$ = $STRING; }
    ;

id
    : ID
        { $$ = $ID; }
    ;

action_ne
    : '{' action_body '}'
        { $$ = $action_body; }
    | '{' action_body error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly bracket a parser rule action block in curly braces: '{ ... }'.

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @1)}
            `);
        }
    | ACTION
        { $$ = $ACTION; }
    | include_macro_code
        { $$ = $include_macro_code; }
    ;

action
    : action_ne
        { $$ = $action_ne; }
    | ARROW_ACTION
        { $$ = '$$ = ' + $ARROW_ACTION; }
    | %epsilon
        { $$ = ''; }
    ;

action_body
    : %epsilon
        { $$ = ''; }
    | action_comments_body
        { $$ = $action_comments_body; }
    | action_body '{' action_body '}' action_comments_body
        { $$ = $1 + $2 + $3 + $4 + $5; }
    | action_body '{' action_body '}'
        { $$ = $1 + $2 + $3 + $4; }
    | action_body '{' action_body error
        {
            yyerror(rmCommonWS`
                Seems you did not correctly match curly braces '{ ... }' in a parser rule action block.

                  Erroneous area:
                ${yylexer.prettyPrintRange(@error, @2)}
            `);
        }
    ;

action_comments_body
    : ACTION_BODY
        { $$ = $ACTION_BODY; }
    | action_comments_body ACTION_BODY
        { $$ = $action_comments_body + $ACTION_BODY; }
    ;

extra_parser_module_code
    : optional_module_code_chunk
        { 
            $$ = $optional_module_code_chunk; 
        }
    | optional_module_code_chunk include_macro_code extra_parser_module_code
        { 
            $$ = $optional_module_code_chunk + $include_macro_code + $extra_parser_module_code; 
        }
    ;

include_macro_code
    : INCLUDE PATH
        {
            var fileContent = fs.readFileSync($PATH, { encoding: 'utf-8' });
            var rv = checkActionBlock(fileContent);
            if (rv) {
                yyerror(rmCommonWS`
                    included action code file "${$PATH}" does not compile: ${rv}

                      Erroneous area:
                    ${yylexer.prettyPrintRange(@PATH, @INCLUDE)}
                `);
            }
            // And no, we don't support nested '%include':
            $$ = '\n// Included by Jison: ' + $PATH + ':\n\n' + fileContent + '\n\n// End Of Include by Jison: ' + $PATH + '\n\n';
        }
    | INCLUDE error
        {
            yyerror(rmCommonWS`
                %include MUST be followed by a valid file path.

                  Erroneous path:
                ` + yylexer.prettyPrintRange(@error, @INCLUDE));
        }
    ;

module_code_chunk
    : CODE
        { $$ = $CODE; }
    | module_code_chunk CODE
        { $$ = $module_code_chunk + $CODE; }
    | error
        {
            // TODO ...
            yyerror(rmCommonWS`
                module code declaration error?

                  Erroneous area:
                ` + yylexer.prettyPrintRange(@error));
        }
    ;

optional_module_code_chunk
    : module_code_chunk
        { $$ = $module_code_chunk; }
    | %epsilon
        { $$ = ''; }
    ;

%%


var rmCommonWS = helpers.rmCommonWS;
var dquote = helpers.dquote;
var checkActionBlock = helpers.checkActionBlock;


// transform ebnf to bnf if necessary
function extend(json, grammar) {
    if (ebnf) {
        json.ebnf = grammar.grammar;        // keep the original source EBNF around for possible pretty-printing & AST exports.
        json.bnf = transform(grammar.grammar);
    }
    else {
        json.bnf = grammar.grammar;
    }
    if (grammar.actionInclude) {
        json.actionInclude = grammar.actionInclude;
    }
    return json;
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

