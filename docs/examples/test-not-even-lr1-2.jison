/*
 * From http://stackoverflow.com/questions/8496065/why-is-this-lr1-grammar-not-lalr1 / http://compilers.iecc.com/comparch/article/95-02-053 :
 * 
 * > 
 * > Here's a real example I came across. It's from the "Arden Syntax",
 * > the formal specification (ASTM E1460) of which I am currently editing:
 * > 
 * > ```
 * > expr_function ::=
 * > expr_factor
 * > | of_func_op opt_OF expr_function
 * > | from_of_func_op index_modifier opt_OF expr_function
 * > | from_of_func_op index_modifier expr_factor FROM expr_function
 * > | from_func_op index_modifier expr_factor FROM expr_function
 * > 
 * > opt_OF ::= OF | {* empty *}
 * > ```
 * > 
 * > YACC (and BISON) didn't like this; I had to replace the 3rd rule by 2
 * > lines (one with OF and one without). Note that the 2nd rule still
 * > has opt_OF:
 * > 
 * > ```
 * > expr_function ::=
 * > expr_factor
 * > | of_func_op opt_OF expr_function
 * > | from_of_func_op index_modifier expr_function
 * > | from_of_func_op index_modifier OF expr_function
 * > | from_of_func_op index_modifier expr_factor FROM expr_function
 * > | from_func_op index_modifier expr_factor FROM expr_function
 * > ```
 * > 
 * > Peter Ludemann ludemann@netcom.com
 * > 
 * > ---- 
 * > 
 * > From:   adam@index.ping.dk (Adam Dickmeiss)
 * > 
 * > About the first grammar presented by Peter Ludemann:
 * > 
 * > The grammar presented is not even LR(1). This is due to the fact that
 * > it only contains shift/reduce conflicts. If a grammar is LR(1) but
 * > not LALR then there have to be at least one reduce/reduce conflict.
 * > 
 * > I asked myself, is it ambiguous or is it LR(2) or higher. I tried
 * > to search for two leftmost derivations for the same sentence but
 * > I cannot find one.
 * > 
 * > I believe that the grammar is really LR(2), but I cannot prove that.
 * > 
 * > -- Adam
 * > 
 */


%options module-name=bison_bugger


%lex

%options ranges

%%

\s+                   /* skip whitespace */
a                     return 'A';
b                     return 'B';
c                     return 'C';
d                     return 'D';
e                     return 'E';
f                     return 'FROM';
v                     return 'OF';
';'                   return ';';
':'                   return ':';
','                   return ',';
'+'                   return '+';
'-'                   return '-';
'='                   return '=';
'('                   return '(';
')'                   return ')';
'['                   return '[';
']'                   return ']';
.                     return 'ERROR';

/lex




%token A B C D E OF FROM

%%

expr_function :
      expr_factor
    | of_func_op opt_OF expr_function

//  | from_of_func_op index_modifier opt_OF expr_function      <-- shift/reduce trouble!

    | from_of_func_op index_modifier OF expr_function
    | from_of_func_op index_modifier    expr_function
    | from_of_func_op index_modifier expr_factor FROM expr_function
    | from_func_op index_modifier expr_factor FROM expr_function
    ;

opt_OF :
      OF 
    | %empty
    ;



expr_factor : A;

of_func_op : B;

from_of_func_op : C;

index_modifier : D;

from_func_op: E;


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
    var rv = parser.parse('a+b');
    console.log("test #1: 'a+b' ==> ", rv, parser.yy);
    assert.equal(rv, '+aDabX:a');

    rv = parser.parse('a-b');
    console.log("test #2: 'a-b' ==> ", rv);
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

