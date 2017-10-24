/*
 * Conflict in grammar: multiple actions possible when lookahead token is ) in state 35
 * - reduce by rule: Type ->
 * - reduce by rule: PropertyHead -> Identifier
 * 
 * States with conflicts:
 * State 35
 *   FunctionHeadItem -> Identifier .Type ? #lookaheads= ) ,
 *   FunctionHeadItem -> Identifier .Type #lookaheads= ) ,
 *   PropertyHead -> Identifier . #lookaheads= . [ ( )
 *   Type -> .: Identifier #lookaheads= ? ) ,
 *   Type -> . #lookaheads= ? ) ,
 *  
 * okay, looks likes there's a conflict with Identifier... 
 * that must mean PropertyHead and Type must together 
 * be ambiguous right? Well no, here's my whole grammar:
 * 
 * (I've outlines significant spots)
 */









%lex

%%

\s+                   /* skip whitespace */

a                     return 'ID';
v                     return 'VARIABLE';
s                     return 'SB';
1                     return 'LITERAL';
'>'                   return 'LAMBDA_INDICATOR';
';'                   return ';';
':'                   return ':';
'('                   return '(';
')'                   return ')';
'['                   return '[';
']'                   return ']';
','                   return ',';
'.'                   return '.';
'?'                   return '?';

.                     return 'ERROR';

/lex




%token ID
%token LAMBDA_INDICATOR
%token VARIABLE
%token SB


%%


Entry
    : Program 					 -> $1
    ;

Program
    : Program Statements -> $1.concat($2)
    |                    -> []
    ;

Statements
    : Statement SB       -> [ $1 ]
    | SB                 -> []
    ;

Statement
    : Expression
    ;

Expression
    : PropertyExpression            -> new node.ExpressionStatement(@1, $1)
    | IndependentLiteral            -> new node.ExpressionStatement(@1, $1)
    ;

// Handle Properties

PropertyExpression
    : PropertyHead PropertyTail    -> new node.PropertyExpression(@2, $1, $2)
    | PropertyHead 
    ;

//
// CONFLICT HERE
// Along with the above rule. `Identifier` on its own doesn't seem to be liked by Jison 
//
// `Literal` rule is omitted from this GH issue for brevity 
PropertyHead
    : Literal
    | Identifier
    | '(' Expression ')'           -> $2
    ;

PropertyTail
    : PropertyTail PropertyTailItem -> $1.concat($2)
    | PropertyTailItem              -> [ $1 ]
    ;

PropertyTailItem
    : '.' Identifier               -> $2
    | '[' Expression ']'            -> new node.EvaluatedIdentifier(@2, $2)
    | '(' List ')'                  -> new node.ArgumentList(@2, $2)
    ;

/**
 * Literals
 */

// Empty for now
Literal
    : LITERAL
    ;

IndependentLiteral
    : Lambda
    ;

Lambda
    : FunctionHead LAMBDA_INDICATOR LambdaBody -> new node.Lambda(@$, $1, $2)
    ;

// Empty for now
LambdaBody
    :
    ;

/**
 * "Function" Rules
 */

FunctionHead
    : '(' FunctionHeadItems ')' -> $2
    ;

FunctionHeadItems
    : 
    | FunctionHeadItem                       -> [ $1 ]
    | FunctionHeadItems ',' FunctionHeadItem -> $1.concat($3)
    ;

//
// CONFLICT HERE
// If `Type` evaluated to its `| ` (empty) derivation. This could just be `Identifier` conflicting with the above
//
FunctionHeadItem
    : Identifier Type '?'                    -> new node.FunctionArgument(@$, [$1, $2], true)
    | Identifier Type                        -> new node.FunctionArgument(@$, [$1, $2], false)
    ;

/**
 * "Helper" Rules
 */

List
    : ListItems
    |                     -> []
    ;

ListItems
    : ListItems ',' Expression -> $1.concat($3)
    | Expression               -> [ $1 ]
    ;

Identifier
    : VARIABLE -> new node.Identifier(@1, $1)
    ;

Type
    : ':' Identifier
    |
    ;

// ... As you can see LAMBDA_INDICATOR is sufficient to determine which to use.






%%

// feature of the GH fork: specify your own main.
//
// compile with
// 
//      jison -o test.js --main that/will/be/me.jison
//
// then run
//
//      node ./test.js
//
// to see the output.

var assert = require("assert");

parser.main = function () {
    var rv = parser.parse('aa;');
    console.log("test #1: 'aa;' ==> ", rv);
    assert.equal(rv, 'VT:a');

    rv = parser.parse('a;');
    console.log("test #2: 'a;' ==> ", rv);
    assert.equal(rv, 'XE');

    console.log("\nAnd now the failing inputs: even these deliver a result:\n");

    // set up an aborting error handler which does not throw an exception
    // but returns a special parse 'result' instead:
    var errmsg = null;
    var errReturnValue = '@@@';
    parser.yy.parseError = function (msg, hash) {
        errmsg = msg;
        return errReturnValue + (hash.parser ? hash.value_stack.slice(0, hash.stack_pointer).join('.') : '???');
    };

    rv = parser.parse('aa');
    console.log("test #3: 'aa' ==> ", rv);
    assert.equal(rv, '@@@.T.a');

    rv = parser.parse('a');
    console.log("test #4: 'a' ==> ", rv);
    assert.equal(rv, '@@@.a');

    rv = parser.parse(';');
    console.log("test #5: ';' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('?');
    console.log("test #6: '?' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('a?');
    console.log("test #7: 'a?' ==> ", rv);
    assert.equal(rv, '@@@.a');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

