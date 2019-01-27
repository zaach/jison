// title: Simple lexer example - a lexer spec without any errors
// test_input: 1++25--1000
// ...
//  




%import symbols  "compiled_calc_AST_symbols.json5"




//%options flex
%options case-insensitive
//%options xregexp
//%options backtrack_lexer
//%options ranges
%options easy_keyword_rules


%%

// 1.0e7
[0-9]+\.[0-9]*(?:[eE][-+]*[0-9]+)?\b
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// .5e7
[0-9]*\.[0-9]+(?:[eE][-+]*[0-9]+)?\b
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// 5 / 3e4
[0-9]+(?:[eE][-+]*[0-9]+)?\b
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// reserved keywords:
'and'                 return 'AND';
'or'                  return 'OR';
'xor'                 return 'XOR';
'not'                 return 'NOT';
'if'                  return 'IF';
'then'                return 'THEN';
'else'                return 'ELSE';


// accept variable names with dots in them, e.g. `store.item`:
[a-zA-Z_$]+[a-zA-Z_0-9.$]*\b
                      %{
                        var rv = lookup_constant(yytext);
                        if (rv) {
                          yytext = rv;
                          return 'CONSTANT';
                        }
                        rv = lookup_function(yytext);
                        if (rv) {
                          yytext = rv;
                          return 'FUNCTION';
                        }
                        rv = lookup_or_register_variable(yytext);
                        yytext = rv;
                        return 'VAR';
                      %}

\/\/.*                yytext = yytext.substr(2).trim(); return 'COMMENT'; // skip C++-style comments
\/\*[\s\S]*?\*\/      yytext = yytext.substring(2, yyleng - 2).trim(); return 'COMMENT'; // skip C-style multi-line comments

'==='                   return 'EQ';
'=='                    return 'EQ';
'!='                    return 'NEQ';
'<='                    return 'LEQ';
'>='                    return 'GEQ';

'||'                    return 'OR';
'^^'                    return 'XOR';
'&&'                    return 'AND';

'**'                    return 'POWER';    /* Exponentiation        */

'<'                     return 'LT';
'>'                     return 'GT';

'='                     return '=';
'-'                     return '-';
'+'                     return '+';
'*'                     return '*';
'/'                     return '/';
'('                     return '(';
')'                     return ')';
','                     return ',';
'!'                     return '!';
'%'                     return '%';
'~'                     return '~';

'?'                     return '?';                         // IF
':'                     return ':';                         // ELSE

'|'                     return '|';
'^'                     return '^';
'&'                     return '&';


\\[\r\n]                // accept C-style line continuation: ignore this bit.

[\r\n]                  return 'EOL';

[^\S\r\n]+              // ignore whitespace

<<EOF>>                 return 'EOF';
.                       return 'INVALID';


