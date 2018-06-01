
// title: test classy grammar
// 
// ...
// 

%%

pgm 
: cdl MAIN LBRACE vdl el RBRACE ENDOFFILE 
; cdl 
: c cdl 
| 
;

