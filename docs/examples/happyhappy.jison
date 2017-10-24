// Simple "happy happy joy joy" parser, written by Nolan Lawson.
// Based on the song of the same name. Inspired by true events.
//
// Valid sentences in this language include:
// "happy happy joy joy"
// "happy happy joy joy happy happy joy joy"
// "happy happy joy joy joy"
//

%lex
%%

\s+                   /* skip whitespace */

//
// the enclosing parentheses ensure that word boundaries don't matter
// so e.g. happyhappyjoyjoy" is okay
// For details see https://github.com/zaach/jison/issues/63
//
("happy")             return 'happy'
("joy")               return 'joy'
<<EOF>>               return 'EOF'

/lex

%start expressions

// ENBF is used in order to give us syntax goodies
// like '+' and '*' repeaters, groups with '(' ')', etc.
// For details see https://gist.github.com/zaach/1659274
%ebnf

%%

expressions
    : e EOF
        {return $1;}
    ;

// yytext means the whole text
// the -> notation is shorthand for {{ $$ = whatever }}
e
    : phrase+ 'joy'? -> $1 + ' ' + yytext
    ;

phrase
    : 'happy' 'happy' 'joy' 'joy'  -> [$1, $2, $3, $4].join(' ');
    ;
