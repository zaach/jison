
// ============================== START lexer section =========================== 

%lex


// macros:

digit   [0-9]
esc     \\
int     -?([0-9]|[1-9][0-9]+)
exp     (?:[eE][-+]?[0-9]+)
frac    (?:\.[0-9]+)

// END of the lexer macros.




%%

\s+             /* skip whitespace */
type            return 'TYPE';
implements      return 'IMPLEMENTS';
{int}{frac}?{exp}?\b
                return 'NUMBER';
"(?:{esc}["bfnrt/{esc}]|{esc}u[a-fA-F0-9]{4}|[^"{esc}])*"
                %{
                  yytext = yytext.substr(1, yyleng - 2);
                  return 'STRING';
                }%
(false|true)    return 'BOOLEAN';
(String|Number|Boolean)
                return 'SCALAR';
[a-zA-Z]+       return 'WORD';
\{              return '{';
\}              return '}';
\[              return '[';
\]              return ']';
\(              return '(';
\)              return ')';
:               return ':';
,               return ',';
;               return ';';
!               return '!';
=               return '=';
#               return '#';
->              return '->';
<-              return '<-';



/lex

// ============================== END lexer section =============================





%%

Schema : ModelList
            {
              return $1;
            }
    ;

ModelList
    : Model
            {
              $$ = [$1];
            }
    | ModelList Model
            {
              $$ = $1;
              $1.push($2);
            }
    ;

Model
    : ModelHeader ModelProperties
            {
              $$ = $1;
              $1.properties = $2;
            }
    | ModelHeader ModelProperties ;
            {
              $$ = $1;
              $1.properties = $2;
            }
    ;

ModelHeader
    : ModelName
            {
              $$ = {
                name: $1
              };
            }
    | ModelName IMPLEMENTS WORD
            {
              $$ = {
                name: $1,
                implements: $3
              };
            }
    ;

ModelName : TYPE WORD
            {
              $$ = $2;
            }
    ;

ModelProperties
    : { }
            {
              $$ = [];
            }
    | { PropertyList }
            {
              $$ = $2;
            }
    ;

PropertyList
    : Property
            {
              $$ = [];
              $$.push($1);
            }
    | PropertyList Property
            {
              $$ = $1;
              $1.push($2);
            }
    ;

Property
    : WORD : PropertyType
            {
              $$ = $3;
              $3.name = $1;
            }
    | WORD : PropertyType ,
            {
              $$ = $3;
              $3.name = $1;
            }
    | WORD : PropertyType ;
            {
              $$ = $3;
              $3.name = $1;
            }
    ;

Value
    : STRING
            {
              $$ = $1;
            }
    | NUMBER
            {
              $$ = Number(yytext);
            }
    | BOOLEAN
            {
              $$ = $1;
            }
    ;

PropertyTypeScalar
    : SCALAR
            {
              $$ = {
                type: $1,
                scalar: true
              };
            }
    | SCALAR !
            {
              $$ = {
                type: $1,
                scalar: true,
                required: true
              };
            }
    ;

PropertyTypeScalarValue : PropertyTypeScalar = Value
            {
              $$ = $1;
              $1.value = $3;
            }
    ;

PropertyType
    : PropertyTypeScalar
            {
              $$ = $1;
            }
    | PropertyTypeScalarValue
            {
              $$ = $1;
            }
    | WORD PropertyRelation
            {
              $$ = $2;
              $2.model = $1;
            }
    | [ WORD ] PropertyRelation
            {
              $$ = $4;
              $4.model = $2;
              $4.many = true;
            }
    ;

PropertyRelation
    : # <-
            {
              $$ = {
                type: 'Relation',
                direction: 'from'
              };
            }
    | # ->
            {
              $$ = {
                type: 'Relation',
                direction: 'to'
              };
            }
    | # <- ( WORD )
            {
              $$ = {
                label: $4,
                type: 'Relation',
                direction: 'from'
              };
            }
    | # -> ( WORD )
            {
              $$ = {
                label: $4,
                type: 'Relation',
                direction: 'to'
              };
            }
    ;

