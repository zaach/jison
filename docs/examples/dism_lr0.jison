
/* author: Jay Ligatti */

%parser-type lr0

%%

pgm
    : instlist
    ;

instlist
    : instlist label COLON inst
    | instlist inst
    | inst
    ;

inst
    : ADD intt intt intt
    | SUB intt intt intt
    | MUL intt intt intt
    | MOV intt intt
    | LOD intt intt intt
    | STR intt intt intt
    | JMP intt intt intt
    | BEQ intt intt intt
    | BLT intt intt intt
    | RDN intt
    | PTN intt
    | HLT intt
    ;

label
    : LABEL
    ;

intt
    : INT
    | label
    ;

