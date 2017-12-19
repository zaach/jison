// title: Parse error when using arrow function in rules
// test_input: A a B C 1 + 2 + 3
// ...
//  
// This is the FAILING lexer spec
// 

let grammar = {
    rules: [
        ['\\s+', ''],
        ['\\d+', () => 'NUMBER'],
        ['\\w+', () => { 
            if (yytext === 'a') {
                return 'TOK_A';                
            } else {
                return 'WORD'; 
            }
          } 
        ],
        ['\\+', () => '+'],
        ['$', () => 'EOF'],
    ]
};

module.exports = grammar;
// export default grammar;

