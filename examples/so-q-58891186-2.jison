// https://stackoverflow.com/questions/58891186/custom-location-tracking-in-jison-gho

%lex

%{

/*  After reading a lexeme go to "delimit" state to
      expect delimiter and return the lexeme. Arrow function
    is used to bind this. */
var delimit = (terminal) => { this.begin('delimit'); return terminal }

%}

DELIMITER                   ";"

%x delimit
%x string_literal

%%

"LT"                        { return delimit('LT') }
"LE"                        { return delimit('LE') }
"EQ"                        { return delimit('EQ') }
"NE"                        { return delimit('NE') }
"GE"                        { return delimit('GE') }
"GT"                        { return delimit('GT') }

"PLUS"                      { return delimit('PLUS') }
"MINUS"                     { return delimit('MINUS') }
"MUL"                       { return delimit('MUL') }
"DIV"                       { return delimit('DIV') }
"MOD"                       { return delimit('MOD') }

"TRUE"                      { return delimit('TRUE') }
"FALSE"                     { return delimit('FALSE') }
"NOT"                       { return delimit('NOT') }
"OR"                        { return delimit('OR') }
"AND"                       { return delimit('AND') }

"ASSIGN"                    { return delimit('ASSIGN') }
"NONE"                      { return delimit('NONE') }

"LPAR"                      { return delimit('LPAR') }
"RPAR"                      { return delimit('RPAR') }
"LBRA"                      { return delimit('LBRA') }
"RBRA"                      { return delimit('RBRA') }
"LCURLY"                    { return delimit('LCURLY') }
"RCURLY"                    { return delimit('RCURLY') }

"IF"                        { return delimit('IF') }
"ELSE"                      { return delimit('ELSE') }
"WHILE"                     { return delimit('WHILE') }
"FOR"                       { return delimit('FOR') }

"CLASS"                     { return delimit('CLASS') }
"FUNCTION"                  { return delimit('FUNCTION') }
"RETURN"                    { return delimit('RETURN') }
"CONTINUE"                  { return delimit('CONTINUE') }
"BREAK"                     { return delimit('BREAK') }

"SPACE"                     {
                                /* ignore spaces unless in string literal */
                                this.begin('delimit')
                            }
<string_literal>"SPACE"     { yytext = ' '; return delimit('LETTER') }
"SEMICOLON"                 { return delimit('SEMICOLON') }
"DOT"                       { return delimit('DOT') }
"PROP"                      { return delimit('PROP') }
"COMMA"                     { return delimit('COMMA') }
"QUOTE"                     { this.begin('string_literal'); return delimit('QUOTE') }
<string_literal>"QUOTE"     { this.popState(); return delimit('QUOTE') }
<INITIAL,string_literal>D[0-9]
                            { yytext = yytext.substr(1); return delimit('DIGIT') }
<INITIAL,string_literal>[A-Z_]
                            { return delimit('LETTER') }

<delimit>{DELIMITER}        { this.popState() }

<INITIAL,delimit,string_literal>\s+     /* ignore whitespace */
<delimit>.                  { throw new Error('Delimiter expected: ' + yytext) }
<string_literal>.           { throw new Error('End of string literal expected: ' + yytext) }
<INITIAL>.                  { throw new Error(`Unknown gifcode "${yytext}"`) }

<delimit><<EOF>>            { throw new Error('Delimiter expected') }
<<EOF>>                     { return 'EOF' }


%%

// lexer extra code

var token_counter = 0;

lexer.post_lex = function (token) {
    ++token_counter;
    this.yylloc.counter = token_counter;
    return token;
};

// extra helper so multiple parse() calls will restart counting tokens:
lexer.reset_token_counter = function () {
    token_counter = 0;
};


/lex

/* operator associations and precedence */
%left OR
%left AND
%left EQ NE
%left LT LE GE GT
%left PLUS MINUS
%left MUL DIV MOD

%nonassoc IF_WITHOUT_ELSE
%nonassoc ELSE

%start Program

%%

Program
    : Primitives EOF                { return new yy.Stmt.ProgramStmt($1, @$) }
    ;

Primitives
    : Primitives Statement          { $1.push($2); $$ = $1 }
    | Primitives ClassDefinition    { $1.push($2); $$ = $1 }
    | %epsilon                      { $$ = [] }
    ;

Identifier
    : LETTER Alfanum            { $$ = $1 + $2 }
    ;

Alfanum
    : AlfanumAtom Alfanum       { $$ = $1 + $2 }
    | %epsilon                  { $$ = '' }
    ;

AlfanumAtom
    : LETTER                    { $$ = $1 }
    | DIGIT                     { $$ = $1 }
    ;

UFloat
    : UInt DOT UInt             { $$ = $1 + '.' + $3 }
    ;

UInt
    : UInt DIGIT                { $$ = $1 + $2 }
    | DIGIT                     { $$ = $1 }
    ;

String
    : QUOTE Alfanum QUOTE       { $$ = $2 }
    ;

PrimaryComnon
    : Identifier                { $$ = new yy.Expr.VariableRefExpr($1, @$) }
    | LPAR Expr RPAR            { $$ = $2 }
    | ArrayLiteral              { $$ = $1 }
    | Literal                   { $$ = $1 }
    ;

Literal
    : TRUE                      { $$ = new yy.Expr.VariableRefExpr('TRUE', @$) }
    | FALSE                     { $$ = new yy.Expr.VariableRefExpr('FALSE', @$) }
    | NONE                      { $$ = new yy.Expr.NoneValueExpr(@$) }
    | UInt                      { $$ = new yy.Expr.NumberValueExpr($1, @$) }
    | UFloat                    { $$ = new yy.Expr.NumberValueExpr($1, @$) }
    | String                    { $$ = new yy.Expr.StringValueExpr($1, @$) }
    ;

ArrayLiteral
    : LBRA ElementList RBRA     { $$ = new yy.Expr.ArrayValueExpr($2, @$) }
    | LBRA RBRA                 { $$ = new yy.Expr.ArrayValueExpr([], @$) }
    ;

ElementList
    : Expr                      { $$ = [$1] }
    | ElementList COMMA Expr    { $1.push($3); $$ = $1 }
    ;

MemberExpr
    : MemberExpr PROP Identifier    { $$ = new yy.Expr.DotAccessorRefExpr($1, $3, @$) }
    | MemberExpr LBRA Expr RBRA     { $$ = new yy.Expr.SquareAccessorRefExpr($1, $3, @$) }
    | PrimaryComnon                 { $$ = $1 }
    ;

CallExpr
    : MemberExpr Arguments      { $$ = new yy.Expr.CallValueExpr($1, $2, @$) }
    | CallExpr Arguments        { $$ = new yy.Expr.CallValueExpr($1, $2, @$) }
    | CallExpr PROP Identifier  { $$ = new yy.Expr.DotAccessorRefExpr($1, $3, @$) }
    | CallExpr LBRA Expr RBRA   { $$ = new yy.Expr.SquareAccessorRefExpr($1, $3, @$) }
    ;

Arguments
    : LPAR RPAR                 { $$ = [] }
    | LPAR ElementList RPAR     { $$ = $2 }
    ;

PrimaryExpr
    : CallExpr                  { $$ = $1 }
    | MemberExpr                { $$ = $1 }
    ;

UnaryExpr
    : PLUS UnaryExpr            { $$ = new yy.Expr.UnaryPlusMinusValueExpr(yy.Operator.PLUS, $2, @$) }
    | MINUS UnaryExpr           { $$ = new yy.Expr.UnaryPlusMinusValueExpr(yy.Operator.MINUS, $2, @$) }
    | NOT UnaryExpr             { $$ = new yy.Expr.UnaryNotValueExpr($2, @$) }
    | PrimaryExpr               { $$ = $1 }
    ;

BinaryExpr
    : BinaryExpr MUL BinaryExpr     { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.MUL, $1, $3, @$) }
    | BinaryExpr DIV BinaryExpr     { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.DIV, $1, $3, @$) }
    | BinaryExpr MOD BinaryExpr     { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.MOD, $1, $3, @$) }

    | BinaryExpr PLUS BinaryExpr    { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.PLUS, $1, $3, @$) }
    | BinaryExpr MINUS BinaryExpr   { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.MINUS, $1, $3, @$) }

    | BinaryExpr LT BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.LT, $1, $3, @$) }
    | BinaryExpr LE BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.LE, $1, $3, @$) }
    | BinaryExpr GE BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.GE, $1, $3, @$) }
    | BinaryExpr GT BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.GT, $1, $3, @$) }

    | BinaryExpr EQ BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.EQ, $1, $3, @$) }
    | BinaryExpr NE BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.NE, $1, $3, @$) }

    | BinaryExpr AND BinaryExpr     { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.AND, $1, $3, @$) }
    | BinaryExpr OR BinaryExpr      { $$ = new yy.Expr.BinaryValueExpr(yy.Operator.OR, $1, $3, @$) }
    | UnaryExpr                     { $$ = $1 }
    ;

Expr
    : PrimaryExpr ASSIGN Expr       {
                                        console.error("ASSIGN:", $PrimaryExpr, $Expr, @PrimaryExpr, @Expr);
                                      if ($1 instanceof yy.Expr.VariableRefExpr
                                        || $1 instanceof yy.Expr.DotAccessorRefExpr
                                        || $1 instanceof yy.Expr.SquareAccessorRefExpr) {
                                        $$ = new yy.Expr.AssignmentValueExpr($1, $3, @$)
                                      } else {
                                        // TODO: Update this when working on error reporting.
                                        throw new Error('TODO: Cannot assign to non-lvalue type.')
                                        YYABORT;
                                      }
                                    }
    | BinaryExpr                    { $$ = $1 }
    ;

Statement
    : Block                         { $$ = $1 }
    | Expr SEMICOLON                { $$ = new yy.Stmt.ExprStmt($1, @$) }
    | FunctionDeclaration           { $$ = $1 }
    | /* Empty statement */ SEMICOLON
                                    { $$ = new yy.Stmt.EmptyStmt(@$) }
    | IfStatement                   { $$ = $1  }
    | IterationStatement            { $$ = $1  }
    | ReturnStatement SEMICOLON     { $$ = $1  }
    | ContinueStatement SEMICOLON   { $$ = $1  }
    | BreakStatement SEMICOLON      { $$ = $1  }
    ;

Block
    : LCURLY RCURLY                 { $$ = new yy.Stmt.BlockStmt([], @$) }
    | LCURLY StatementList RCURLY   { $$ = new yy.Stmt.BlockStmt($2, @$) }
    ;

StatementList
    : Statement                     { $$ = [$1] }
    | StatementList Statement       { $1.push($2); $$ = $1 }
    ;

FunctionDeclaration
    : FUNCTION Identifier Parameters Block
                                    { $$ = new yy.Stmt.FunctionDeclStmt($2, $3, $4, @$) }
    ;

Parameters
    : LPAR IdentifierList RPAR      { $$ = $2 }
    | LPAR RPAR                     { $$ = [] }
    ;

IdentifierList
    : Identifier                    { $$ = [$1] }
    | IdentifierList COMMA Identifier
                                    { $1.push($3); $$ = $1 }
    ;

IfStatement
    : IF LPAR Expr RPAR Statement %prec IF_WITHOUT_ELSE
                                    { $$ = new yy.Stmt.IfStmt($3, $5, null, @$) }
    | IF LPAR Expr RPAR Statement ELSE Statement
                                    { $$ = new yy.Stmt.IfStmt($3, $5, $7, @$) }
    ;

IterationStatement
    : WHILE LPAR Expr RPAR Statement
                                    { $$ = new yy.Stmt.WhileStmt($3, $5, @$) }
    | FOR LPAR
        ExprListOptional SEMICOLON
          ExprOptional SEMICOLON
        ExprListOptional
        RPAR Statement              { $$ = new yy.Stmt.ForStmt($3, $5, $7, $9, @$) }
    ;

ExprOptional
    : Expr                          { $$ = $1 }
    | %epsilon                      { $$ = null }
    ;

ExprList
    : ExprList COMMA Expr           { $1.push($3); $$ = $1 }
    | Expr                          { $$ = [$1] }
    ;

ExprListOptional
    : ExprList                      { $$ = $1 }
    | %epsilon                      { $$ = [] }
    ;

ReturnStatement
    : RETURN                        { $$ = new yy.Stmt.CompletionStmt(yy.CompletionType.RETURN, null, @$) }
    | RETURN Expr                   { $$ = new yy.Stmt.CompletionStmt(yy.CompletionType.RETURN, $2, @$) }
    ;

ContinueStatement
    : CONTINUE                      { $$ = new yy.Stmt.CompletionStmt(yy.CompletionType.CONTINUE, null, @$) }
    ;

BreakStatement
    : BREAK                         { $$ = new yy.Stmt.CompletionStmt(yy.CompletionType.BREAK, null, @$) }
    ;

ClassDefinition
    : CLASS Identifier ClassBlock   { $$ = new yy.Stmt.ClassDefStmt($2, null, $3, @$) }
    | CLASS Identifier LPAR Identifier RPAR ClassBlock
                                    { $$ = new yy.Stmt.ClassDefStmt($2, $4, $6, @$) }
    ;

ClassBlock
    : LCURLY RCURLY                 { $$ = [] }
    | LCURLY InClassStatementList RCURLY
                                    { $$ = $2 }
    ;

InClassStatementList
    : InClassStatementList InClassStatement
                                    { $$ = $1.concat($2) }
    | InClassStatement
                                    { $$ = [$1] }
    ;

InClassStatement
    : FunctionDeclaration           { $$ = $1 }
    ;





%%


// extra helper: reset the token counter at the start of every parse() call:
parser.pre_parse = function (yy) {
    yy.lexer.reset_token_counter();
};




// feature of the GH fork: specify your own main.
//
// compile with
//
//      jison --main that/will/be/me.jison
//
// to generate a parser in `./me.js`, then run
//
//      node ./me.js
//
// to see the output.

var assert = require("assert");

parser.main = function () {
    parser.yy.Expr = {
        ArrayValueExpr: function (a1, l1) {
            this.type = "ArrayValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        AssignmentValueExpr: function (a1, s1, l1) {
            this.type = "AssignmentValueExpr";
            this.target = a1;
            this.source = s1;
            this.loc = l1;
        },
        BinaryValueExpr: function (a1, l1) {
            this.type = "BinaryValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        CallValueExpr: function (a1, l1) {
            this.type = "CallValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        DotAccessorRefExpr: function (a1, l1) {
            this.type = "DotAccessorRefExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        NoneValueExpr: function (a1, l1) {
            this.type = "NoneValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        NumberValueExpr: function (a1, l1) {
            this.type = "NumberValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        SquareAccessorRefExpr: function (a1, l1) {
            this.type = "SquareAccessorRefExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        StringValueExpr: function (a1, l1) {
            this.type = "StringValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        UnaryNotValueExpr: function (a1, l1) {
            this.type = "UnaryNotValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        UnaryPlusMinusValueExpr: function (a1, l1) {
            this.type = "UnaryPlusMinusValueExpr";
            this.a1 = a1;
            this.loc = l1;
        },
        VariableRefExpr: function (a1, l1) {
            this.type = "VariableRefExpr";
            this.a1 = a1;
            this.loc = l1;
        },
    };
    parser.yy.CompletionType = {
        BREAK: 1,
        CONTINUE: 2,
        RETURN: 3,
    };
    parser.yy.Operator = {
        AND: 1,
        DIV: 2,
        EQ: 3,
        GE: 4,
        GT: 5,
        LE: 6,
        LT: 7,
        MINUS: 8,
        MOD: 9,
        MUL: 10,
        NE: 11,
        OR: 12,
        PLUS: 13,
    };
    parser.yy.Stmt = {
        BlockStmt: function (a1, l1) {
        this.type = "BlockStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        ClassDefStmt: function (a1, l1) {
        this.type = "ClassDefStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        CompletionStmt: function (a1, l1) {
        this.type = "CompletionStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        EmptyStmt: function (l1) {
        this.type = "EmptyStmt";
            this.loc = l1;
        },
        ExprStmt: function (a1, l1) {
        this.type = "ExprStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        ForStmt: function (a1, l1) {
        this.type = "ForStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        FunctionDeclStmt: function (a1, v1, c1, l1) {
        this.type = "FunctionDeclStmt";
            this.name = a1;
            this.args = v1;
            this.block = c1;
            this.loc = l1;
        },
        IfStmt: function (a1, l1) {
        this.type = "IfStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        ProgramStmt: function (a1, l1) {
        this.type = "ProgramStmt";
            this.a1 = a1;
            this.loc = l1;
        },
        WhileStmt: function (a1, l1) {
        this.type = "WhileStmt";
            this.a1 = a1;
            this.loc = l1;
        },
    };

    var rv = parser.parse('A;B;A;D0;ASSIGN;X;SEMICOLON;\n');
    console.log("test #1: 'A;B;A;D0;ASSIGN;X;SEMICOLON;\\n':=> ", rv, parser.yy, JSON.stringify(rv, null, 2));
    var refval =  {
	  "type": "ProgramStmt",
	  "a1": [
	    {
	      "type": "ExprStmt",
	      "a1": {
	        "type": "AssignmentValueExpr",
	        "target": {
	          "type": "VariableRefExpr",
	          "a1": "ABA0",
	          "loc": {
	            "first_line": 1,
	            "first_column": 0,
	            "last_line": 1,
	            "last_column": 8,
	            "range": [
	              0,
	              8
	            ],
	            "counter": 1
	          }
	        },
	        "source": {
	          "type": "VariableRefExpr",
	          "a1": "X",
	          "loc": {
	            "first_line": 1,
	            "first_column": 16,
	            "last_line": 1,
	            "last_column": 17,
	            "range": [
	              16,
	              17
	            ],
	            "counter": 6
	          }
	        },
	        "loc": {
	          "first_line": 1,
	          "first_column": 0,
	          "last_line": 1,
	          "last_column": 17,
	          "range": [
	            0,
	            17
	          ],
	          "counter": 1
	        }
	      },
	      "loc": {
	        "first_line": 1,
	        "first_column": 0,
	        "last_line": 1,
	        "last_column": 27,
	        "range": [
	          0,
	          27
	        ],
	        "counter": 1
	      }
	    }
	  ],
	  "loc": {
	    "first_line": 1,
	    "first_column": 0,
	    "last_line": 2,
	    "last_column": 0,
	    "range": [
	      0,
	      29
	    ],
	    "counter": 1
	  }
	};

    assert.equal(JSON.stringify(rv, null, 2), JSON.stringify(refval, null, 2));

    var errmsg = null;
    var errReturnValue = '@@@';
    parser.yy.parseError = function (msg, hash) {
        errmsg = msg;
        return errReturnValue + (hash.parser ? hash.value_stack.slice(0, hash.stack_pointer).join('.') : '???');
    };

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

