
%import symbols  "./output/compiled_calc/compiled_calc_parse.js"



%token      NUM             // Simple double precision number  
%token      VAR FUNCTION    // Variable and Function            
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E

%token      FUNCTION_END    // token to mark the end of a function argument list in the output token stream


%nonassoc  '='
%nonassoc   '-' '+'
%nonassoc   '*' '/'
%nonassoc  POWER  
%nonassoc '!'
%nonassoc '%'
%nonassoc  UMINUS     /* Negation--unary minus */
%nonassoc  UPLUS      /* unary plus */
%nonassoc  ','

/* Grammar follows */

%start input


%%


input:   
  /* empty */
| input line
;

line:
  exp   
        { 
            console.log($exp); 
        }
;

exp:
  NUM        
| CONSTANT        
| VAR        
| '=' VAR exp 
| FUNCTION FUNCTION_END 
| FUNCTION arglist FUNCTION_END   
| '+' exp exp         
| '-' exp exp         
| '*' exp exp         
| '/' exp exp         
| UMINUS exp 
| UPLUS exp
| POWER exp exp         
| '!' exp 
| '%' exp 
;

arglist:
  exp
| ',' exp arglist
;

/* End of grammar */


%%

