/* Demonstrates use of semantic whitespace pseudo-tokens. */

%start prog

%ebnf

%options token-stack


%% /* language grammar */

prog
	: proglist ENDOFFILE
	{ console.log("AST: %j", $proglist); }
	;

proglist
	: proglist stmt
	{ $proglist.push($stmt); $$ = $proglist; }
	| stmt
	{ $$ = [$stmt]; }
	;

if_stmt
	: IF LPAREN expr RPAREN COLON stmt_block
	{ $$ = [ "if", $expr, $stmt_block ]; }
	| IF LPAREN expr RPAREN COLON stmt_block ELSE COLON stmt_block
	{ $$ = [ "if", $expr, $6, $9 ]; }
	;

print_stmt
	: PRINT STRING
	{ $$ = ["print", $2]; }
	;

stmt
	: if_stmt
	| print_stmt
	;

stmt_list
	: stmt
	{ $$ = ["stmt_list", $stmt]; }
	| stmt_list stmt
	{ $stmt_list.push($stmt); $$ = $stmt_list; }
	;

stmt_block
	: INDENT stmt_list DEDENT
	{ $$ = $stmt_list; }
	;

atom
	: ID
	{ $$ = ["id", $1]; }
	| NATLITERAL
	{ $$ = ["natlit", $1]; }
	| LPAREN expr RPAREN
	{ $$ = ["expr", $2]; }
	;

expr
	: atom
	| expr PLUS atom
	{ $expr.push(["plus", $atom]); $$ = $expr; }
	| expr MINUS atom
	{ $expr.push(["minus", $atom]); $$ = $expr; }
	;
