/* BlooP and FlooP parser - http://en.wikipedia.org/wiki/BlooP_and_FlooP */

/* Code blocks are inserted at the top of the generated module. */
%{
var ast = require('./ast'),

Program       = ast.Program,
ProcedureStmt = ast.ProcedureStmt,
BlockStmt     = ast.BlockStmt,
LoopStmt      = ast.LoopStmt,
MuLoopStmt    = ast.MuLoopStmt,
NumberLit     = ast.NumberLit,
BooleanLit    = ast.BooleanLit,
OutputExpr    = ast.OutputExpr,
Identifier    = ast.Identifier,
CellExpr      = ast.CellExpr,
PlusExpr      = ast.PlusExpr,
TimesExpr     = ast.TimesExpr,
ApplyExpr     = ast.ApplyExpr,
LessCond      = ast.LessCond,
GreaterCond   = ast.GreaterCond,
GreaterCond   = ast.GreaterCond,
EqualCond     = ast.EqualCond,
CompoundCond  = ast.CompoundCond,
AssignStmt    = ast.AssignStmt,
IfThenStmt    = ast.IfThenStmt,
QuitStmt      = ast.QuitStmt,
AbortStmt     = ast.AbortStmt;

%}

%nonassoc '+'
%nonassoc '*'

/* enable EBNF grammar syntax */
%ebnf

%%

program
  : procedure* EOF
    { return Program({},$1) }
  ;

procedure
  : DEFINE PROCEDURE QUOTE IDENT QUOTE '[' (identifier ',')* identifier? ']' ':' block '.'
    -> ProcedureStmt({name:$4},[$7.concat([$8]),$11])
  ;

block
  : BLOCK NUMBER ':' BEGIN (statement ';')+ BLOCK NUMBER ':' END
    -> BlockStmt({id: $2},$5)
  ;

statement
  : cell '<=' expression                          -> AssignStmt({}, [$1, $3])
  | output '<=' expression                        -> AssignStmt({}, [$1, $3])
  | LOOP (AT MOST)? expression TIMES ':' block    -> LoopStmt({}, [$3, $6])
  | MU_LOOP ':' block                             -> MuLoopStmt({}, [$3])
  | IF condition ',' THEN ':' (statement | block) -> IfThenStmt({}, [$2, $6])
  | QUIT BLOCK NUMBER                             -> QuitStmt({id: $3})
  | ABORT LOOP NUMBER                             -> AbortStmt({id: $3})
  ;

condition
  : expression
  | expression '<' expression       -> LessCond({}, [$1, $3])
  | expression '>' expression       -> GreaterCond({}, [$1, $3])
  | expression '=' expression       -> EqualCond({}, [$1, $3])
  | '{' condition AND condition '}' -> CompoundCond({}, [$1, $3])
  ;

expression
  : NUMBER                    -> NumberLit({value: $1}, [])
  | identifier
  | IDENT '[' (expression ',')* expression? ']'   -> ApplyExpr({name:$1}, $3.concat([$4]))
  | cell
  | output
  | NO                        -> BooleanLit({value: false}, [])
  | YES                       -> BooleanLit({value: true}, [])
  | expression '+' expression -> PlusExpr({}, [$1, $3])
  | expression '*' expression -> TimesExpr({}, [$1, $3])
  ;

output
  : OUTPUT -> OutputExpr({},[])
  ;

cell
  : CELL '(' NUMBER ')' -> CellExpr({id: $3})
  ;

identifier
  : IDENT -> Identifier({value: $1})
  ;

%%

// additional user code here
