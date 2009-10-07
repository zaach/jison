var DEBUG = 1;

if(typeof console != 'undefined' && console.log)
  print = function(str){console.log(str);};

function Token(str) { return str; }

// utility function
//function encodeRE(s) { return s.replace(/[.*+?^${}()|[\]\/\\]/g, '\\$0'); }

var djLex = {
  macros: {
    "digit": "[0-9]",
    "id": "[a-zA-Z][a-zA-Z0-9]*" 
  },

  rules: [
    ["//.*",       function (){ }],
    ["main\b",       function (){ return scanned("MAIN")}],
    ["class\b",      function (){ return scanned("CLASS")}],
    ["extends\b",    function (){ return scanned("EXTENDS")}],
    ["nat\b",        function (){ return scanned("NAT")}],
    ["if\b",         function (){ return scanned("IF")}],
    ["else\b",       function (){ return scanned("ELSE")}],
    ["for\b",        function (){ return scanned("FOR")}],
    ["printNat\b",   function (){ return scanned("PRINTNAT")}],
    ["readNat\b",    function (){ return scanned("READNAT")}],
    ["this\b",       function (){ return scanned("THIS")}],
    ["new\b",        function (){ return scanned("NEW")}],
    ["var\b",        function (){ return scanned("VAR")}],
    ["null\b",       function (){ return scanned("NUL")}],
    ["{digit}+",   function (){ return scanned("NATLITERAL", this.yytext)}],
    ["{id}",       function (){ return scanned("ID", this.yytext)}],
    ["==",         function (){ return scanned("EQUALITY")}],
    ["=",          function (){ return scanned("ASSIGN")}],
    ["\\+",        function (){ return scanned("PLUS")}],
    ["-",          function (){ return scanned("MINUS")}],
    ["\\*",        function (){ return scanned("TIMES")}],
    [">",          function (){ return scanned("GREATER")}],
    ["\\|\\|",     function (){ return scanned("OR")}],
    ["!",          function (){ return scanned("NOT")}],
    ["\\.",        function (){ return scanned("DOT")}],
    ["\\{",        function (){ return scanned("LBRACE")}],
    ["\\}",        function (){ return scanned("RBRACE")}],
    ["\\(",        function (){ return scanned("LPAREN")}],
    ["\\)",        function (){ return scanned("RPAREN")}],
    [";",          function (){ return scanned("SEMICOLON")}],
    ["\\s+",       function (){ /* skip whitespace */ }],
    [".",          function (){ print('Illegal character');
                                throw 'Illegal character'; 
                              }],
    ["$",          function (){ return scanned("ENDOFFILE")}],
  ]
};

function scanned(token, yytext) {
  switch(token) {
    case "NATLITERAL": print(token+"("+yytext+")"); return Token(token);
      break;
    case "ID": print(token+"("+yytext+")"); return Token(token);
      break;
    default: print(token); return Token(token);
  }
}
