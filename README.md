Jison
=====
* [issues](http://github.com/zaach/jison/issues)
* [discuss](mailto:jison@librelist.com)

An API for creating parsers in JavaScript
-----------------------------------------

Jison generates bottom-up parsers in JavaScript. Its API is similar to Bison's, hence the name. It supports many of Bison's major features, plus some of its own. If you are new to parser generators such as Bison, and Context-free Grammars in general, a [good introduction][1] is found in the Bison manual. If you already know Bison, Jison should be easy to pickup.

A brief warning before proceeding: **the API is ridiculously unstable** right now. The goal is to mirror Bison where it makes sense, but we're not even there yet. Also, optimization has not been a main focus as of yet.

Briefly, Jison takes a JSON encoded grammar specification and outputs a JavaScript file capable of parsing the language described by that grammar specification. You can then use the generated script to parse inputs and accept, reject, or perform actions based on the input.

Installation
------------
Jison can be installed for [Narwhal](http://github.com/280north/narwhal) using its bundled `tusk` command or for [Node](http://nodejs.org) using [`npm`](http://github.com/isaacs/npm/)

Using npm:

    npm install jison

Using tusk:

    tusk install jison

Usage from the command line
-----------------------

Clone the github repository for examples:

    git clone git://github.com/zaach/jison.git
    cd jison/examples

Now you're ready to generate some parsers:

    jison calculator.jison

This will generate `calculator.js` in your current working directory. This file can be used to parse an input file, like so:

    echo "2^32 / 1024" > testcalc
    node calculator.js testcalc

This will print out `4194304`.

Usage from a CommonJS module
--------------------------

You can generate parsers programatically from JavaScript as well. Assuming Jison is in your commonjs environment's load path:

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
    
    var parser = new Parser(grammar);
    
    // generate source, ready to be written to disk
    var parserSource = parser.generate();
    
    // you can also use the parser directly from memory
    
    // returns true
    parser.parse("adfe34bc e82a");
    
    // throws lexical error
    parser.parse("adfe34bc zxg");


More Documentation
------------------
For more information on creating grammars and using the generated parsers, read the [documentation](http://jison.org/docs).

How to contribute
-----------------
Fork the integration branch, make your changes, run tests and/or add tests then send a pull request.

Run tests with:

    make test

Projects using Jison
------------------

* [CoffeeScript](http://github.com/jashkenas/coffee-script)
* [handlebars.js](https://github.com/wycats/handlebars.js)
* [jQuery.sheet](http://visop-dev.com/Project+jQuery.sheet)
* [cafe](http://github.com/zaach/cafe)
* [jsonlint](http://github.com/zaach/jsonlint)
* [Orderly.js](http://github.com/zaach/orderly.js)


Contributors
------------
[Githubbers](http://github.com/zaach/jison/contributors)

Special thanks to Jarred Ligatti, Manuel E. Bermúdez 

License
-------

> Copyright (c) 2009 Zachary Carter
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

