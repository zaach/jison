# jison-lex


[![build status](https://secure.travis-ci.org/GerHobbelt/jison-lex.png)](http://travis-ci.org/GerHobbelt/jison-lex)


A lexical analyzer generator used by [jison](http://jison.org). It takes a lexical grammar definition (either in JSON or Bison's lexical grammar format) and outputs a JavaScript lexer.


## install

npm install jison-lex


## build

To build the lexer generator yourself, clone the git repo then run:

    make prep
    
to install required packages and then run:

    make
    
to run the unit tests.


## usage

```
Usage: jison-lex [file] [options]

file     file containing a lexical grammar

Options:
   -o FILE, --outfile FILE       Filename and base module name of the generated parser
   -t TYPE, --module-type TYPE   The type of module to generate (commonjs, js)
   --version                     print version and exit
```


## programmatic usage

```
var JisonLex = require('jison-lex');

var grammar = {
  rules: [
    ["x", "return 'X';" ],
    ["y", "return 'Y';" ],
    ["$", "return 'EOF';" ]
  ]
};

// or load from a file
// var grammar = fs.readFileSync('mylexer.l', 'utf8');

// generate source
var lexerSource = JisonLex.generate(grammar);

// or create a parser in memory
var lexer = new JisonLex(grammar);
lexer.setInput('xyxxy');
lexer.lex();
// => 'X'
lexer.lex();
// => 'Y'


## license

MIT
