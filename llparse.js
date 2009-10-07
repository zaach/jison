// ll parser

function llParseGrammer(tokens){

 // Example right recursive grammer from class
 // S := E$     1st = 0
 // E := TF     1st = 0
 // F := +TF    1st = +
 // F :=        Follows = $
 // T := 0      1st = 0
 
function consume(token) {
  if(peek() == token)
    tokens.shift();
  else {
    print(tokens);
    throw 'Parse error. Expected token: '+token;
  }
}

function peek() {
  return tokens[0];
}

function throwUnexpected(token) {
 throw 'Parse error. Unexpected token: '+token||peek();
}

function parseS() {
  parseE();consume('ENDOFFILE');return;
}

function parseE() {
  switch(peek()) {
    case 'ZERO':
      parseT();parseF(); return;
    default:
      throwUnexpected(peek());
  }
}

function parseF() {
  switch(peek()) {
    case 'PLUS':
      consume('PLUS');parseT();parseF(); return;
    case 'ENDOFFILE':
      return;
    default:
      throwUnexpected(peek());
  }
}

function parseT() {
  consume('ZERO');return;
}

  parseS();
  print('Success!');
}

var tokens = ['ZERO', 'PLUS', 'ZERO', 'PLUS', 'ZERO', 'ENDOFFILE'];
var tokens = ['ZERO', 'PLUS', 'ZERO', 'PLUS', 'ENDOFFILE'];

llParseGrammer(tokens);
