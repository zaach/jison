
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

