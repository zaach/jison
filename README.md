Jison
=====

Jison is a parser generator written in JavaScript. Its API is similar to the tried-and-true parser generator written for C, [Bison][1], hence the name. It supports many of Bison's major features, plus some of its own. If you are new to parser generators such as Bison, and Context-free Grammars in general, a [good introduction][2] is found in the Bison manual itself. If you already know Bison, Jison should be easy to pickup.

Briefly, Jison takes a JSON encoded grammar specification and outputs a JavaScript file capable of parsing the language described by that grammar specification. You can then use the generated script to parse inputs and accept, reject, or perform actions based on the input.

Jison uses CommonJS modules, which allows for easy inclusion in CommonJS environments, including the browser, or it may be used by simply including the necessary script files in a web page (this may be removed later to cleanup module code.)

The process involves two phases: **lexical analysis** (tokenizing) and **parsing**, which the Lex/Yacc and Flex/Bison combinations are famous for. Both lexing and parsing information can be included in the grammar spec.

Example Grammar
---------------

A JSON encoded grammar definition looks like this:

    {
        "lex": {
            "rules": [
               ["\\s+", "/* skip whitespace */"],
               ["[0-9]+", "return 'NUMBER';"],
               ["\\+", "return '+';"]
            ]
        },
    
        "tokens": "NUMBER +",
        "bnf": {
            "E" :[ "E + T",
                   "T" ],
            "T" :[ "NUMBER" ]
        }
    }

More examples can be found in the examples/ directory.

  [1]: http://dinosaur.compilertools.net/#bison
  [2]: http://dinosaur.compilertools.net/bison/bison_4.html



Copyright (c) 2009 Zachary Carter

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.

