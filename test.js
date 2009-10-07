load('jslex.js');
load('dj.js');

var input = "  // hihi \n main { var forever; var boo = stuf(788); var mainer; } ";

JSLex.lex(djLex, input);
