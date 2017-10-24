
// This lexer would simply return `NIL` tokens *ad infinitum*.

parser.lexer = {
    lex: function () { 
        return 'NIL'; 
    }, 
    setInput: function (str) {} 
};
