# ebnf-parser


[![build status](https://secure.travis-ci.org/GerHobbelt/ebnf-parser.png)](http://travis-ci.org/GerHobbelt/ebnf-parser)


A parser for BNF and EBNF grammars used by jison.


## install

    npm install ebnf-parser


## build

To build the parser yourself, clone the git repo then run:

    make prep
    
to install required packages and then run:

    make
    
to build the lib and run the unit tests.

This will generate `parser.js`, which is required by `ebnf-parser.js`.


## usage

The parser translates a string grammar or JSON grammar into a JSON grammar that jison can use (ENBF is transformed into BNF).

    var ebnfParser = require('ebnf-parser');

    // parse a bnf or ebnf string grammar
    ebnfParser.parse("%start ... %");

    // transform an ebnf JSON gramamr
    ebnfParser.transform({"ebnf": ...});


## example grammar

The parser can parse its own BNF grammar, shown below:

```
%start spec

// %parse-param options


/* grammar for parsing jison grammar files */

%{
var fs = require('fs');
var transform = require('./ebnf-transform').transform;
var ebnf = false;
var XRegExp = require('xregexp');       // for helping out the `%options xregexp` in the lexer
%}

%%

spec
    : declaration_list '%%' grammar optional_end_block EOF
        {
            $$ = $declaration_list;
            if ($optional_end_block && $optional_end_block.trim() !== '') {
                yy.addDeclaration($$, { include: $optional_end_block });
            }
            return extend($$, $grammar);
        }
    ;

optional_end_block
    : %empty
    | '%%' extra_parser_module_code
        { $$ = $extra_parser_module_code; }
    ;

optional_action_header_block
    : %empty
        { $$ = {}; }
    | optional_action_header_block ACTION
        {
            $$ = $optional_action_header_block;
            yy.addDeclaration($$, { actionInclude: $ACTION });
        }
    | optional_action_header_block include_macro_code
        {
            $$ = $optional_action_header_block;
            yy.addDeclaration($$, { actionInclude: $include_macro_code });
        }
    ;

declaration_list
    : declaration_list declaration
        { $$ = $declaration_list; yy.addDeclaration($$, $declaration); }
    | %epsilon
        { $$ = {}; }
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
        { $$ = {include: $ACTION}; }
    | include_macro_code
        { $$ = {include: $include_macro_code}; }
    | parse_params
        { $$ = {parseParams: $parse_params}; }
    | parser_type
        { $$ = {parserType: $parser_type}; }
    | options
        { $$ = {options: $options}; }
    | DEBUG
        { $$ = {options: [['debug', true]]}; }
    | UNKNOWN_DECL
        { $$ = {unknownDecl: $UNKNOWN_DECL}; }
    | IMPORT import_name import_path
        { $$ = {imports: {name: $import_name, path: $import_path}}; }
    | INIT_CODE import_name action_ne
        { $$ = {initCode: {qualifier: $import_name, include: $action_ne}}; }
    ;

import_name
    : ID
    | STRING
    ;

import_path
    : ID
    | STRING
    ;

options
    : OPTIONS option_list OPTIONS_END
        { $$ = $option_list; }
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
    | NAME[option] '=' OPTION_VALUE[value]
        { $$ = [$option, $value]; }
    | NAME[option] '=' NAME[value]
        { $$ = [$option, $value]; }
    ;

parse_params
    : PARSE_PARAM token_list
        { $$ = $token_list; }
    ;

parser_type
    : PARSER_TYPE symbol
        { $$ = $symbol; }
    ;

operator
    : associativity token_list
        { $$ = [$associativity]; $$.push.apply($$, $token_list); }
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
                value: $token_value
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
                value: $token_value,
                description: $token_description
            };
        }
    ;

optional_token_type
    : %epsilon
        { $$ = false; }
    | TOKEN_TYPE
    ;

token_value
    : INTEGER
    ;

token_description
    : STRING
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
    : id ':' handle_list ';'
        {$$ = [$id, $handle_list];}
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
    ;

handle_action
    : handle prec action
        {
            $$ = [($handle.length ? $handle.join(' ') : '')];
            if ($action) {
                $$.push($action);
            }
            if ($prec) {
                $$.push($prec);
            }
            if ($$.length === 1) {
                $$ = $$[0];
            }
        }
    | EPSILON action
        // %epsilon may only be used to signal this is an empty rule alt; 
        // hence it can only occur by itself 
        // (with an optional action block, but no alias what-so-ever).
        {
            $$ = [''];
            if ($action) {
                $$.push($action);
            }
            if ($$.length === 1) {
                $$ = $$[0];
            }
        }
    ;

handle
    : handle expression_suffix
        {
            $$ = $handle;
            $$.push($expression_suffix);
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

expression_suffix
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
    | STRING
        {
            // Re-encode the string *anyway* as it will
            // be made part of the rule rhs a.k.a. production (type: *string*) again and we want
            // to be able to handle all tokens, including *significant space*
            // encoded as literal tokens in a grammar such as this: `rule: A ' ' B`.
            if ($STRING.indexOf("'") >= 0) {
                $$ = '"' + $STRING + '"';
            } else {
                $$ = "'" + $STRING + "'";
            }
        }
    | '(' handle_sublist ')'
        {
            $$ = '(' + $handle_sublist.join(' | ') + ')';
        }
    ;

suffix
    : %epsilon
        { $$ = ''; }
    | '*'
    | '?'
    | '+'
    ;

prec
    : PREC symbol
        {
            $$ = { prec: $symbol };
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
    | ACTION
        { $$ = $ACTION; }
    | include_macro_code
        { $$ = $include_macro_code; }
    | ARROW_ACTION
        { $$ = '$$ = ' + $ARROW_ACTION; }
    ;

action
    : action_ne
        { $$ = $action_ne; }
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
    ;

action_comments_body
    : ACTION_BODY
        { $$ = $ACTION_BODY; }
    | action_comments_body ACTION_BODY
        { $$ = $action_comments_body + $ACTION_BODY; }
    ;

extra_parser_module_code
    : optional_module_code_chunk
        { $$ = $optional_module_code_chunk; }
    | optional_module_code_chunk include_macro_code extra_parser_module_code
        { $$ = $optional_module_code_chunk + $include_macro_code + $extra_parser_module_code; }
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
            console.error("%include MUST be followed by a valid file path");
        }
    ;

module_code_chunk
    : CODE
        { $$ = $CODE; }
    | module_code_chunk CODE
        { $$ = $module_code_chunk + $CODE; }
    ;

optional_module_code_chunk
    : module_code_chunk
        { $$ = $module_code_chunk; }
    | %epsilon
        { $$ = ''; }
    ;

%%

// transform ebnf to bnf if necessary
function extend(json, grammar) {
    json.bnf = ebnf ? transform(grammar.grammar) : grammar.grammar;
    if (grammar.actionInclude) {
        json.actionInclude = grammar.actionInclude;
    }
    return json;
}
```


## license

MIT
