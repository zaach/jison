%lex
%%
\s+                           {}
(global|local|integer|float)  { return yytext; }
[a-zA-Z_]\w*                  { return 'id'; }
.                             { return yytext; }
/lex
%%
D
  : C T L
  ;

C
  : global
  | local
  ;

T
  : integer
  | float
  ;

L
  : L ',' id    {
                  console.log("L -> L ',' id ("+yytext+")");
                  console.log($id + ' is of type ' + $0);
                  console.log($1 + ' is of class ' + $-1);
                }
  | id          {
                  console.log("L -> id ("+yytext+")");
                  console.log($id + ' is of type ' + $0);
                  console.log($1 + ' is of class ' + $-1);
                }
  ;
%%
