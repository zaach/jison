// given the grammar rule
// 
//       | NAT
//
// any of the alternative codings below will work, while the last is advised:

$$ = parseInt(yytext);
$$ = parseInt($1);
$$ = parseInt($NAT);
