// title: Parse error when using arrow function in rules
//
// ...
//  
// This is the FAILING lexer spec
// 

let grammar = {
    lex: {
        rules: [
            ['\\s+', ''],
            ['\\d+', () => 'NUMBER'],
            ['\\+', () => '+'],
            ['$', () => 'EOF'],
        ]
    },
    operators: [
        ['left', '+']
    ],
    bnf: {
        'es': [
            ['e EOF', 'return $1']
        ],
        'e': [
            ['e + e', '$$ = $e1 + $e2'],
            ['NUMBER', '$$ = Number(yytext)']
        ]
    }
};

module.exports = grammar;
// export default grammar;

