// https://gist.github.com/juliandavidmr/5c545f8cc1fe58d19986625a7a17f756

/* description: Parses end executes mathematical expressions. */

/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?\b  return 'NUMBER'
"true"                return 'TRUE'
"false"               return 'FALSE'
"not"                 return 'NOT'
"and"                 return 'AND'
"or"                  return 'OR'
"def"                 return 'DEF'
"end"                 return 'END'
"println"             return 'PRINTLN'
[a-zA-Z_][a-zA-Z0-9_]* return 'ID'
"%"                   return '%'
"="                   return 'ASSIGN'
"=="                  return '='
"!="                  return '<>'
"<>"                  return '<>'
"*"                   return '*'
"/"                   return '/'
"-"                   return '-'
"+"                   return '+'
">"                   return '>'
"<"                   return '<'
">="                  return '>='
"<="                  return '<='
"^"                   return '^'
"("                   return 'PAR_OPEN'
")"                   return 'PAR_CLOSE'
"PI"                  return 'PI'
"E"                   return 'E'
";"                   return 'SEMICOL'
\"(?:\"\"|[^"])*\"    return 'STRING'
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex

/* operator associations and precedence */

%left '%'
%left '+' '-'
%left '*' '/'
%left '^'
%left '>' '<' '>=' '<='
%left 'NOT'
%left 'AND' 'OR' 
%left '=' '<>'
%left UMINUS

%start expressions

%ebnf

%% /* language grammar */

expressions
    : e EOF
        {return $1;}
    | FUNCTION EOF
        {return $1;}
;

e
    : e '+' e
        {$$ = $1 + $3;}
    | 'NOT' e
        {$$ = !$2;}
    | e 'OR' e
        {$$ = $1 || $3;}
    | e 'AND' e
        {$$ = $1 && $3;}
    | e '=' e
        {$$ = $1 == $3;}
    | e '<>' e
        {$$ = $1 != $3;}
    | e '-' e
        {$$ = $1 - $3;}
    | e '*' e
        {$$ = $1 * $3;}
    | e '/' e
        {$$ = $1 / $3;}
    | e '>' e
        {$$ = $1 > $3;}
    | e '<' e
        {$$ = $1 < $3;}
    | e '>=' e
        {$$ = $1 >= $3;}
    | e '<=' e
        {$$ = $1 <= $3;}
    | e '^' e
        {$$ = Math.pow($1, $3);}
    | '-' e %prec UMINUS
        {$$ = -$2;}
    | PAR_OPEN e PAR_CLOSE
        {$$ = $2;}
    | e '%'
        {$$ = $1 / 100;}
    | TRUE
        {$$ = true;}
    | FALSE
        {$$ = false;}
    | NUMBER
        {$$ = Number(yytext);}
    | STRING
        {$$ = $1;}
    | IDENT
        {$$ = __data__[$1];}
    | E
        {$$ = Math.E;}
    | PI
        {$$ = Math.PI;}    
;

FUNCTION
    : DEF ID PAR_OPEN PAR_CLOSE
        SENTENCE*
      END
        { $$ = 'function ' + $2 + '(){' + $5 + '}' }
;

SENTENCE
    : PRINT
    | VAR_ASSIGN
;

PRINT
    : PRINTLN e
        { $$ = 'echo ' + $e + ';' }
;

VAR_ASSIGN
    : ID ASSIGN e 
        { $$ = '$' + $1 + '=' + $3 }
;

UNARY_OPERATOR
	: '&'
	| '*'
	| '+'
	| '-'
	| '~'
	| '!'
;



// ----------------------------------------------------------------------------------------

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
    var inputs = [
        `
def hello()
    println "dsasd"
end
        `, `
def hello()
    a = 3
    println "dsasd"
end
        `
    ];
    for (var i = 0, l = inputs.length; i < l ; i++) {
        var rv = parser.parse(inputs[i]);
        console.log(inputs[i], " ==> ", rv);
    }

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

