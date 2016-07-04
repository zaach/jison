//
// Stage 1 parser: 'The Front End'
//
// This one represents the classic textbook 'parser/tokenizer' frontend: 
// converting input text stream to AST (Abstract Syntax Tree) / tokens,
// a.k.a. IR (Intermediate Representation).
//
// We create an AST as an *array* rather than a tree (less objects to
// create and update).
//
// We can use an array to carry a full-fledged AST as this is the
// 'pre-order traversal' (https://en.wikipedia.org/wiki/Tree_traversal)
// representation of said (theoretic) AST.
//
// Ergo we get an array which looks suspiciously like it's carrying
// tokenized math expressions in Polish Notation (https://en.wikipedia.org/wiki/Polish_notation)
// which has the known benefit of not requiring storing info about 
// any priority reversal (https://en.wikipedia.org/wiki/Order_of_operations) 
// as you would with 'infix notation': the `(...)` braces around 
// sub-expressions.
//
// Of course, nothing is as trivial as it seems, because there still is
// a problem which doesn't show up in theory but does in practice: when you
// perform calculations, the order of execution of theoretically fully
// associative operator sequences IS important. 
// (https://www.mathsisfun.com/associative-commutative-distributive.html)
// Here's an example:
//
// ```
// A=1
// B=1e17 + 1e9
// C=1e17 - 1e9
//
// A+(B-C)   --> (B-C) => 2e9,    A+. => 2000000001 
// A+B-C     --> A+B => 1e17+1e9, .-C => 2000000000 
// ```
//
// What you observe here is floating point accuricy loss due to the limited
// size of the mantissa. Consequently, we must realize that any seemingly
// 'superfluous braces' used in the formula MUST be preserved and recreated
// when we wish to re-print/format/display the given AST (formula) via the
// `compiled_calc_print.jison` tree-walking backend grammar: associative
// operators do have a preferred (default) order of execution and any AST
// we create carrying a non-default order of execution must be recognized
// as such by the backend grammars ('code generators'): compile_calc_exec and
// compile_calc_print.
//
// ASTs for the above example:
//
// ```
// A+(B-C)   --> +A-BC 
// A+B-C     --> -+ABC 
// ```
//
// And here's another example, using only a single operator (`+` addition):
//
// ```
// A=1
// B=+1e17 + 1e9
// C=-1e17 + 1e9
//
// A+(B+C)   --> (B+C) => 2e9,    A+. => 2000000001 
// A+B+C     --> A+B => 1e17+1e9, .+C => 2000000000 
// ```
//
// ASTs for the above example:
//
// ```
// A +1 (B +2 C)   --> +1A+2BC 
// A +1 B +2 C     --> +2+1ABC 
// ```
//
// The default vs. non-default order of execution effect on AST tree inbalance
// is maybe easier to observe when we start with a symmetric tree:
//
// ```
// (A +1 B) +2 (C +3 D)  -->                  [[ +2 ]]
//                                            /      \ 
//                                          [+1]    [+3]
//                                          /  \    /  \
//                                         A    B  C    D
// --> +2 +1 A B +3 C D
//
// A +1 B +2 C +3 D -->
//  (using a left-recursive grammar, representing left-associativity)
// --> +3 +2 +1 A B C D
//                                            [[+3]]
//                                            /    \ 
//                                          [+2]    D
//                                          /  \     
//                                        [+1]  C
//                                        /  \     
//                                       A    B     
//
// ...ditto... -->
//  (using a right-recursive grammar, representing right-associativity,
//   which is the only associativity type easily constructed in top-down parsers,
//   either hand-coded or LL(k)-generator based. LR/LALR doesn't suffer from this problem!)
// --> +1 +2 +3 A B C D
//                                            [[+1]]
//                                            /    \ 
//                                          [+2]    D
//                                          /  \     
//                                        [+3]  C
//                                        /  \     
//                                       A    B     
//
//
// Hence when we encounter a left child of an AST node which carries a
// mutually associative operator (`+` or `-`, etc.), then we are looking at 
// a probably enforced order of execution due to extra `(..)` braces.
// THAT of course assumes you've got your grammar set up properly and set
// up your `%left`/`%right` token associativity to help JISON cope with rules
// which specify *both* associativities via left-and-right recursion in 
// the grammar -- like the grammar should below!
//


%lex

%%

// 1.0e7
[0-9]+\.[0-9]*(?:[eE][-+]*[0-9]+)?\b             
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// .5e7
[0-9]*\.[0-9]+(?:[eE][-+]*[0-9]+)?\b             
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// 5 / 3e4
[0-9]+(?:[eE][-+]*[0-9]+)?\b             
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

[a-zA-Z_]+[a-zA-Z_0-9]*\b
                      %{
                        if (is_constant(yytext)) {
                          return 'CONSTANT';
                        }
                        if (is_function(yytext)) {
                          return 'FUNCTION';
                        }
                        return 'VAR';
                      %}

'='                     return '=';
'-'                     return '-';
'+'                     return '+';
'*'                     return '*';
'/'                     return '/';
'^'                     return 'POWER';    /* Exponentiation        */
'('                     return '(';
')'                     return ')';
','                     return ',';
'!'                     return '!';
'%'                     return '%';


[\r\n]+                 return 'NL';

[^\S\r\n]+              // ignore whitespace

\/\/.*                  // skip comments
\/\*.*?\*\/             // skip comments

<<EOF>>                 return 'EOF';
.                       return 'INVALID';


/lex



%token      NUM             // Simple double precision number  
%token      VAR FUNCTION    // Variable and Function            
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E

%token      END             // token to mark the end of a function argument list in the output token stream


%right  '='
%left   '-' '+'
%left   '*' '/'
%right  POWER  
%right '!'
%right '%'
%right  UMINUS     /* Negation--unary minus */
%right  UPLUS      /* unary plus */

/* Grammar follows */

%start input


%%


input:   
  /* empty */
                                { $$ = []; }
| input line
                                { $$ = $input.concat($line); }
;

line:
  NL
                                { $$ = []; }
| EOF
                                { $$ = []; }
| exp NL   
                                { 
                                    console.log('line: ', JSON.stringify($exp, null, 2)); 

                                    $$ = $exp.concat(#NL#);
                                }
| error NL 
                                { 
                                    yyerrok;
                                    yyclearin;
                                    console.log('skipped erroneous input line');
                                    $$ = [];
                                }
;

exp:
  NUM                
                                { $$ = [-#NUM, $NUM]; }
| CONSTANT                
                                { $$ = [-#CONSTANT, $CONSTANT]; }
| VAR                
                                { $$ = [-#VAR, $VAR]; }
| VAR '='[assign] exp        
                                { $$ = [#assign, -#VAR, $VAR].concat($exp); }
| FUNCTION '(' ')'
                                { $$ = [-#FUNCTION, $FUNCTION, #END#]; }
| FUNCTION '(' arglist ')'
                                { $$ = [-#FUNCTION, $FUNCTION].concat($arglist, #END#); }
| exp '+'[add] exp        
                                { $$ = [#add].concat($exp1, $exp2); }
| exp '-'[subtract] exp        
                                { $$ = [#subtract].concat($exp1, $exp2); }
| exp '*'[multiply] exp        
                                { $$ = [#multiply].concat($exp1, $exp2); }
| exp '/'[divide] exp        
                                { $$ = [#divide].concat($exp1, $exp2); }
| '-' exp       %prec UMINUS 
                                { $$ = [#UMINUS#].concat($exp); }
| '+' exp       %prec UPLUS
                                { $$ = [#UPLUS#].concat($exp); }
| exp POWER exp        
                                { $$ = [#POWER].concat($exp1, $exp2); }
| exp '%'[percent]        
                                { $$ = [#percent].concat($exp); }
| exp '!'[facult]        
                                { $$ = [#facult].concat($exp); }
| '(' exp ')'        
                                { $$ = $exp; }
;

arglist:
  exp
                                { $$ = $exp; }
| exp ','[comma] arglist
                                { $$ = [#comma].concat($exp, $arglist); }
;



// FAKE rule to make sure the tokens all make it into the symbol table for use in the next phase:
phony: UMINUS UPLUS END
;

/* End of grammar */


%%

