// DJ Grammer, right recursive
//
//pgm : cdl MAIN LBRACE vdl el RBRACE ENDOFFILE   1st= CLASS, MAIN

//cdl : c cdl       1st= CLASS
    //|             Follows= MAIN

//c : CLASS ID EXTENDS ID LBRACE vdl mdl RBRACE   1st= CLASS

//vdl : VAR t ID SEMICOLON vdl          1st= VAR
    //|                                 Follows= NATTYPE, ID, RBRACE

//mdl : t ID LPAREN t ID RPAREN LBRACE vdl el RBRACE mdl    1st= NATTYPE,ID
    //|                                 Follows= RBRACE

//t : NATTYPE                 1st= NATYTYPE
  //| ID                      1st= ID

//el : e SEMICOLON el2         1st=ID,NATLITERAL
   //;

//el2 : el         1st=ID,NATLITERAL
    //|             Follows=RBRACE

//e : 
  //| eb eaopt        1st=ID,NATLITERAL
  //;
  
//eaopt :
  //| ASSIGN eb eaopt          1st=ASSIGN
  //| LPAREN e RPAREN   1st=LPAREN
  //|                   Follows=ID,NATLITERAL
  //;
  
//eb :
  //| ec ebopt
  
//ebopt :
  //| OR ec ebopt
  //| 
  //;
  
//ec :
  //| ed ecopt
  
//ecopt :
  //| EQUALITY ed ecopt
  //| GREATER ed ecopt
  //| 
  //;
  
//ed :
  //| ee edopt
  
//edopt :
  //| PLUS ee edopt
  //| MINUS ee edopt
  //| 
  //;
  
//ee :
  //| ef eeopt
  
//eeopt :
  //| TIMES ef eeopt
  //| 
  //;

//ef :
  //| eg efopt
  
//efopt :
  //| NOT eg efopt
  //| 
  //;

//eg :
  //| g egopt
  
//egopt :
  //| DOT ID egopt
  //| 
  //;

//g :
  //| NATLITERAL
  //| NUL
  //| NEW ID
  //| ID
  //| THIS
  //| IF LPAREN e RPAREN LBRACE el RBRACE ELSE LBRACE el RBRACE
  //| FOR LPAREN e SEMICOLON e SEMICOLON e RPAREN LBRACE el RBRACE
  //| READNAT LPAREN RPAREN
  //| PRINTNAT LPAREN e RPAREN
  //| LPAREN e RPAREN
  //;

  
function parseDJ(tokens) {

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

function parse_pgm(){
  parse_cdl();
  consume('MAIN');consume('LBRACE');
  parse_vdl();
  parse_el();
  consume('RBRACE');
  consume('ENDOFFILE');return;
}

function parse_cdl(){
  switch(peek()){
    case 'CLASS':
      parse_c();parse_cdl();return;
    case 'MAIN':
      return;
    default:
      throwUnexpected();
  }
}

function parse_c(){
  switch(peek()){
    case 'CLASS':
      consume('CLASS');consume('ID');consume('EXTENDS');consume('ID');consume('LBRACE');
      parse_vdl();parse_mdl();
      consume('RBRACE');return;
    default:
      throwUnexpected();
  }
}

function parse_vdl(){
  switch(peek()){
    case 'VAR':
      consume('VAR');parse_t();consume('ID');consume('SEMICOLON');
      parse_vdl();return;
    case 'NATTYPE':
    case 'ID':
    case 'RBRACE':
      return;
    default:
      throwUnexpected();
  }
}

function parse_mdl(){
  switch(peek()){
    case 'NATTYPE':
    case 'ID':
      parse_t();consume('ID');consume('LPAREN');parse_t();consume('ID');consume('RPAREN');consume('LBRACE');
      parse_vdl();parse_el();
      consume('RBRACE');
      parse_mdl();return;
    case 'RBRACE':
      return;
    default:
      throwUnexpected();
  }
}

function parse_t(){
  switch(peek()){
    case 'NATTYPE':
      consume('NATTYPE');return;
    case 'ID':
      consume('ID');return;
    default:
      throwUnexpected();
  }
}

function parse_el(){
  switch(peek()){

  }
  parse_e();consume('SEMICOLON');parse_el2();return;
}

function parse_el2(){
  switch(peek()){
    case 'RBRACE'
      return;
  }
  parse_el();return;
}

function parse_e(){

}

}

var tokens = "CLASS ID EXTENDS ID LBRACE RBRACE MAIN LBRACE NATLITERAL SEMICOLON RBRACE ENDOFFILE".split(' ');


parseDJ(tokens);
