
%lex

%%

[-+]*[0-9]*\.[0-9]*(?:[eE][-+]*[0-9]+)?             
                        return 'NUM';

[a-zA-Z_]+[a-zA-Z_0-9]*
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

%token      FUNCTION_END    // token to mark the end of a function argument list in the output token stream


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
| input line
;

line:
  NL
| exp NL   
        { 
            console.log($exp); 
        }
| error NL 
        { 
            yyerrok;
            yyclearin;
            console.log('skipped erroneous input line');
        }
;

exp:
  NUM                
| CONSTANT                
| VAR                
| VAR '=' exp        
| FUNCTION '(' ')'
| FUNCTION '(' arglist ')'
| exp '+' exp        
| exp '-' exp        
| exp '*' exp        
| exp '/' exp        
| '-' exp       %prec UMINUS 
| '+' exp       %prec UPLUS
| exp POWER exp        
| exp '%'        
| exp '!'        
| '(' exp ')'        
;

arglist:
  exp
| exp ',' arglist
;



// FAKE rule to make sure the tokens all make it into the symbol table for use in the next phase:
phony: UMINUS UPLUS FUNCTION_END
;

/* End of grammar */


%%

