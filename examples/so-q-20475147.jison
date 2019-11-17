// https://stackoverflow.com/questions/20475147/how-can-i-generate-a-parser-with-jison-which-deals-with-grammar-ambiguity/47345984#47345984

//Lexical Grammer
%lex

%%

[\r\n\s]+               // ignore whitespace

[A-Za-z$_][A-Za-z0-9$_]*    return 'ID';
[-+*/^&|]                   return 'OP';        // binary operator
[;]                         return 'SEMICOLON';

.                           return 'BLUBBER';
<<EOF>>                     return 'EOF';

/lex



//Parsing Grammer
%%

Program
    : ProgramSection            -> new yy.Program($1)
    ;

ProgramSection
    : Expression SEMICOLON      -> new yy.ExpressionStatement($1)
    ;

Expression
    : DeclExpression            -> $1
    | Expression OP DeclExpression
                                -> new yy.ExpFromBinary($1, $2, $3)
    ;

DeclExpression
    : TypeDecl VarDeclList      -> new yy.DeclExp($1, $2, 0)
    | PrimaryExpression         -> $1
    ;

VarDeclList
    : VarDecl                   -> new yy.VarDeclList($1)
    ;

VarDecl
    : ID                        -> new yy.VarDecl($1)
    ;

TypeDecl
    : ID                        -> new yy.TypeDecl(new yy.IdList($1), 0)
    ;

PrimaryExpression
    : ID                        -> new yy.ExpFromId($1)
    ;


%%

