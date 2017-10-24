// Example from btyacc3


%left '+' '-'
%left '*' '/' '%'

%nonassoc PREFIX
%nonassoc POSTFIX '(' '[' '.'

%token  	ID
%token  	CONSTANT
%token		EXTERN REGISTER STATIC CONST VOLATILE IF THEN ELSE CLCL


%start input

%%

opt_scope:		%epsilon 
  | CLCL		
  | opt_scope ID CLCL	
  ;

typename: opt_scope ID
  ;

input: decl_list ;
decl_list: | decl_list decl ;
decl:
    decl_specs declarator_list ';' 
  | decl_specs declarator block_statement
      { finish_fn_def; }
  ;

decl_specs:	
    decl_spec			
  | decl_specs decl_spec	
  ;

cv_quals:			
  | cv_quals cv_qual		
  ;

decl_spec:
    cv_qual		
  | typename		
  | EXTERN		
  | REGISTER		
  | STATIC		
  ;

cv_qual:
    CONST		
  | VOLATILE		
  ;

declarator_list:
    declarator_list ',' declarator
  | declarator
  ;

declarator:
    %empty 				
  | ID				
  | '(' declarator ')'	
  | '*' cv_quals declarator      %prec PREFIX
  | declarator '[' expr ']'
  | declarator '(' formal_arg_list ')' cv_quals
  ;

formal_arg_list:		
  | nonempty_formal_arg_list	
  ;
nonempty_formal_arg_list:
    nonempty_formal_arg_list ',' formal_arg	
  | formal_arg					
  ;
formal_arg:
    decl_specs declarator	
  ;

expr:
    expr '+' expr		
  | expr '-' expr		
  | expr '*' expr		
  | expr '%' expr		
  | expr '/' expr		
  | '*' expr %prec PREFIX	
  | ID				
  | CONSTANT			
  ;

statement:
    decl			
  | expr ';' 
  | IF '(' expr ')' THEN statement ELSE statement 
  | IF '(' expr ')' THEN statement 
  | block_statement 
  ;

statement_list:			
  | statement_list statement	
  ;

block_statement:
    '{' statement_list '}' 
  ;
