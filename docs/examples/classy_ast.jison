/* description: ClassyLang grammar with AST-building actions. Very classy. */
/*
  To build parser:

    $ ./bin/jison examples/classy_ast.jison examples/classy.jisonlex

*/

/* author: Zach Carter */

%{
    function prependChild(node, child){
      node.splice(2,0,child);
      return node;
    }
%}

%right ASSIGN
%left OR
%nonassoc EQUALITY GREATER
%left PLUS MINUS
%left TIMES
%right NOT
%left DOT

%%

pgm
    : cdl MAIN LBRACE vdl el RBRACE ENDOFFILE
        {{$$ = ['PROGRAM',{},$1,$4,$5]; return $$;}}
    ;

cdl
    : c cdl
        {$$ = prependChild($2, $1);}
    |
        {{$$ = ['CLASS_DECL_LIST',{}];}}
    ;

c
    : CLASS id EXTENDS id LBRACE vdl mdl RBRACE
        {{$$ = ['CLASS_DECL',{},$2,$4,$6,$7];}}
    ;

vdl
    : VAR t id SEMICOLON vdl
        {{$$ = prependChild($5, ['VAR_DECL',{},$2,$3]);}}
    |
        {{$$ = ['VAR_DECL_LIST',{}];}}
    ;

mdl
    : t id LPAREN t id RPAREN LBRACE vdl el RBRACE mdl
        {{$$ = prependChild($11, ['METHOD_DECL',{},$1,$2,$4,$5,$8,$9]);}}
    |
        {{$$ = ['METHOD_DECL_LIST',{}];}}
    ;

t
    : NATTYPE
        {{$$ = ['NAT_TYPE',{}];}}
    | id
        {$$ = $1}
    ;

id
    : ID
        {{$$ = ['AST_ID',{val:yytext}]}}
    ;

el
    : e SEMICOLON el
        {$$ = prependChild($3, $1);}
    | e SEMICOLON
        {{$$ = ['EXPR_LIST',{},$1];}}
    ;

e
    : NATLITERAL
        {{$$ = ['NAT_LITERAL_EXPR',{val:parseInt(yytext)}];}}
    | NUL
        {{$$ = ['NULL_EXPR',{}];}}
    | id
        {{$$ = ['ID_EXPR',{},$1];}}
    | NEW id
        {{$$ = ['NEW_EXPR',{},$2];}}
    | THIS
        {{$$ = ['THIS_EXPR',{}];}}
    | IF LPAREN e RPAREN LBRACE el RBRACE ELSE LBRACE el RBRACE
        {{$$ = ['IF_THEN_ELSE_EXPR',{},$3,$6,$10];}}
    | FOR LPAREN e SEMICOLON e SEMICOLON e RPAREN LBRACE el RBRACE
        {{$$ = ['FOR_EXPR',{},$3,$5,$7,$10];}}
    | READNAT LPAREN RPAREN
        {{$$ = ['READ_EXPR',{}];}}
    | PRINTNAT LPAREN e RPAREN
        {{$$ = ['PRINT_EXPR',{},$3];}}
    | e PLUS e
        {{$$ = ['PLUS_EXPR',{},$1,$3];}}
    | e MINUS e
        {{$$ = ['MINUS_EXPR',{},$1,$3];}}
    | e TIMES e
        {{$$ = ['TIMES_EXPR',{},$1,$3];}}
    | e EQUALITY e
        {{$$ = ['EQUALITY_EXPR',{},$1,$3];}}
    | e GREATER e
        {{$$ = ['GREATER_THAN_EXPR',{},$1,$3];}}
    | NOT e
        {{$$ = ['NOT_EXPR',{},$2];}}
    | e OR e
        {{$$ = ['OR_EXPR',{},$1,$3];}}
    | e DOT id
        {{$$ = ['DOT_ID_EXPR',{},$1,$3];}}
    | id ASSIGN e
        {{$$ = ['ASSIGN_EXPR',{},$1,$3];}}
    | e DOT id ASSIGN e
        {{$$ = ['DOT_ASSIGN_EXPR',{},$1,$3,$5];}}
    | id LPAREN e RPAREN
        {{$$ = ['METHOD_CALL_EXPR',{},$1,$3];}}
    | e DOT id LPAREN e RPAREN
        {{$$ = ['DOT_METHOD_CALL_EXPR',{},$1,$3,$5];}}
    | LPAREN e RPAREN
        {$$ = $2;}
    ;

