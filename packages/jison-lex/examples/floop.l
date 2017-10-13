ID          [A-Z-]+"?"?
NUM         ([1-9][0-9]+|[0-9])

%options flex case-insensitive

%%

\s+         /* ignore */
{NUM}     return 'NUMBER'

DEFINE    return 'DEFINE'
PROCEDURE return 'PROCEDURE'
BLOCK     return 'BLOCK'
BEGIN     return 'BEGIN'
OUTPUT    return 'OUTPUT'
CELL      return 'CELL'
IF        return 'IF'
THEN      return 'THEN'
LOOP      return 'LOOP'
"MU-LOOP" return yy.bloop ? 'INVALID' : 'MU_LOOP'
AT        return 'AT'
MOST      return 'MOST'
TIMES     return 'TIMES'
ABORT     return 'ABORT'
END       return 'END'
QUIT      return 'QUIT'
AND       return 'AND'
YES       return 'YES'
NO        return 'NO'
{ID}      return 'IDENT'
"."       return '.'
"''"      return 'QUOTE'
"["       return '['
"]"       return ']'
"("       return '('
")"       return ')'
"{"       return '{'
"}"       return '}'
":"       return ':'
";"       return ';'
","       return ','
"+"       return '+'
"*"       return '*'
"×"       return '*'  //non-ascii
"<="      return '<='
"⇐"       return '<=' //non-ascii
"<"       return '<'
">"       return '>'
"="       return '='
<<EOF>>   return 'EOF'
.         return 'INVALID'


