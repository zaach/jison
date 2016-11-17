Jison
=====

* [Issues](http://github.com/zaach/jison/issues)
* [Discuss](mailto:jison@librelist.com)

[![build status](https://secure.travis-ci.org/zaach/jison.png)](http://travis-ci.org/zaach/jison)

An API for creating parsers in JavaScript
-----------------------------------------

Jison generates bottom-up parsers in JavaScript. Its API is similar to Bison's, hence the name. It supports many of Bison's major features, plus some of its own. If you are new to parser generators such as Bison, and Context-free Grammars in general, a [good introduction][1] is found in the Bison manual. If you already know Bison, Jison should be easy to pickup.

Briefly, Jison takes a JSON encoded grammar or Bison style grammar and outputs a JavaScript file capable of parsing the language described by that grammar. You can then use the generated script to parse inputs and accept, reject, or perform actions based on the input.

Installation
------------

Jison can be installed for [Node](http://nodejs.org) using [`npm`](http://github.com/isaacs/npm/)

Using npm:

    npm install jison -g

Usage from the command line
---------------------------

Clone the github repository for examples:

    git clone git://github.com/zaach/jison.git
    cd jison/examples

Now you're ready to generate some parsers:

    jison calculator.jison

This will generate `calculator.js` in your current working directory. This file can be used to parse an input file, like so:

    echo "2^32 / 1024" > testcalc
    node calculator.js testcalc

This will print out `4194304`.

Full cli option list:

    Usage: jison [file] [lexfile] [options]

    file        file containing a grammar
    lexfile     file containing a lexical grammar

Where the available `options` are:

:   -j, --json
force jison to expect a grammar in JSON format  [false]

:   -o FILE, --outfile FILE                    
Filepath and base module name of the generated parser; when terminated with a / (dir separator) it is treated as the destination directory where the generated output will be stored

:   -t, --debug                                
Debug mode  [false]

:   -I, --info                                
Report some statistics about the generated parser  [false]

:   -m TYPE, --module-type TYPE                
The type of module to generate (commonjs, amd, es, js)  [commonjs]

:   -n NAME, --module-name NAME                
The name of the generated parser object, namespace supported

:   -p TYPE, --parser-type TYPE                
The type of algorithm to use for the parser (lr0, slr, lalr, lr, ll)  [lalr]

:   -c, --compress-tables                      
Output compressed parser tables in generated modules (0 = no compression, 1 = default compression, 2 = deep compression)  [2]

:   -T, --output-debug-tables                  
Output extra parser tables (rules list + look-ahead analysis) in generated modules to assist debugging / diagnostics purposes  [false]

:   -X, --no-default-resolve                   
Act another way when a conflict is found in the grammar  [false]

:   --no-default-action                        
Generate a parser which does NOT include the default "$$ = $1" action for every rule. This produces a slightly faster parser but now you are solely reponsible for propagating rule action "$$" results.  [false]

:   --no-try-catch                             
Generate a parser which does NOT try/catch exceptions (from the grammar action code or parseError error reporting calls. This produces a slightly faster parser at the cost of enhanced code safety.  [false]

:   -Q, --error-recovery-token-discard-count   
Set the number of lexed tokens that may be gobbled by an error recovery process before we cry wolf (default: 3)  [3]

:   -E, --export-all-tables                    
Next to producing a grammar source file, also export the symbols, terminals, grammar and parse tables to separate JSON files for further use by other tools. The files' names will be derived from the outputFile name by appending a suffix.  [false]

:   -x, --main                                 
Include .main() entry point in generated commonjs module  [false]

:   -y NAME, --module-main NAME                
The main module function definition

:   -V, --version                              
print version and exit



Usage from a CommonJS module
----------------------------

You can generate parsers programmatically from JavaScript as well. Assuming Jison is in your CommonJS environment's load path:

```javascript
// mygenerator.js
var Parser = require("jison").Parser;

// a grammar in JSON
var grammar = {
    "lex": {
        "rules": [
           ["\\s+", "/* skip whitespace */"],
           ["[a-f0-9]+", "return 'HEX';"]
        ]
    },

    "bnf": {
        "hex_strings" :[ "hex_strings HEX",
                         "HEX" ]
    }
};

// `grammar` can also be a string that uses jison's grammar format
var parser = new Parser(grammar);

// generate source, ready to be written to disk
var parserSource = parser.generate();

// you can also use the parser directly from memory

// returns true
parser.parse("adfe34bc e82a");

// throws lexical error
parser.parse("adfe34bc zxg");
```

More Documentation
------------------

For more information on creating grammars and using the generated parsers, read the [documentation](http://jison.org/docs).

How to contribute
-----------------

See [CONTRIBUTING.md](https://github.com/zaach/jison/blob/master/CONTRIBUTING.md) for contribution guidelines, how to run the tests, etc.

Projects using Jison
--------------------

View them on the [wiki](https://github.com/zaach/jison/wiki/ProjectsUsingJison), or add your own.


Contributors
------------

[Githubbers](http://github.com/zaach/jison/contributors)

Special thanks to Jarred Ligatti, Manuel E. Bermúdez

License
-------

> Copyright (c) 2009-2016 Zachary Carter
>
>  Permission is hereby granted, free of
> charge, to any person  obtaining a
> copy of this software and associated
> documentation  files (the "Software"),
> to deal in the Software without
> restriction, including without
> limitation the rights to use,  copy,
> modify, merge, publish, distribute,
> sublicense, and/or sell  copies of the
> Software, and to permit persons to
> whom the  Software is furnished to do
> so, subject to the following
> conditions:
>
>  The above copyright notice and this
> permission notice shall be  included
> in all copies or substantial portions
> of the Software.
>
>  THE SOFTWARE IS PROVIDED "AS IS",
> WITHOUT WARRANTY OF ANY KIND,  EXPRESS
> OR IMPLIED, INCLUDING BUT NOT LIMITED
> TO THE WARRANTIES  OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT  HOLDERS BE
> LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY,  WHETHER IN AN ACTION OF
> CONTRACT, TORT OR OTHERWISE, ARISING
> FROM, OUT OF OR IN CONNECTION WITH THE
> SOFTWARE OR THE USE OR  OTHER DEALINGS
> IN THE SOFTWARE.


  [1]: http://dinosaur.compilertools.net/bison/bison_4.html

