# Jison

[![Join the chat at https://gitter.im/jison-parsers-lexers/Lobby](https://badges.gitter.im/jison-parsers-lexers/Lobby.svg)](https://gitter.im/jison-parsers-lexers/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
[![Build Status](https://travis-ci.org/GerHobbelt/jison.svg?branch=master)](https://travis-ci.org/GerHobbelt/jison)
[![NPM version](https://badge.fury.io/js/jison-gho.svg)](http://badge.fury.io/js/jison-gho)
[![Dependency Status](https://img.shields.io/david/GerHobbelt/jison.svg)](https://david-dm.org/GerHobbelt/jison)
[![npm](https://img.shields.io/npm/dm/jison-gho.svg?maxAge=2592000)]()

* [Issues](http://github.com/zaach/jison/issues)
* [Discuss](https://gitter.im/jison-parsers-lexers/Lobby)
* [Website](https://gerhobbelt.github.io/jison/)
* [**Original** JISON Website](http://jison.org)



> # Notice
>
> This repository contains a fork maintained by GerHobbelt. The original JISON work has been done by Zachary Carter and is available in zaach/jison.
>
> For an overview of all all changes \(fixes and features\), see the section [What's New or Different?](#user-content-whats-new-or-different) further below. See also [pullreq \#338](https://github.com/zaach/jison/pull/338).




## An API for creating parsers in JavaScript

Jison generates bottom-up parsers in JavaScript. Its API is similar to Bison's, hence the name. It supports many of Bison's major features, plus some of its own. If you are new to parser generators such as Bison, and Context-free Grammars in general, a [good introduction](http://dinosaur.compilertools.net/bison/bison_4.html) is found in the Bison manual. If you already know Bison, Jison should be easy to pickup.

Briefly, Jison takes a JSON encoded grammar or Bison style grammar and outputs a JavaScript file capable of parsing the language described by that grammar. You can then use the generated script to parse inputs and accept, reject, or perform actions based on the input.




## Installation

Jison can be installed for [Node](http://nodejs.org) using [`npm`](http://github.com/isaacs/npm/)

Using npm:

```
npm install jison -g
```




## Usage from the command line

Clone the github repository for examples:

```
git clone git://github.com/GerHobbelt/jison.git
cd jison/examples
```

Now you're ready to generate some parsers:

```
jison calculator.jison
```

This will generate `calculator.js` in your current working directory. This file can be used to parse an input file, like so:

```
echo "2^32 / 1024" > testcalc
node calculator.js testcalc
```

This will print out `4194304`.

Full cli option list:

```
Usage: jison [file] [lexfile] [options]

file        file containing a grammar
lexfile     file containing a lexical grammar
```

Where the available `options` are:

:   -j, --json
force jison to expect a grammar in JSON format  \[false\]

:   -o FILE, --outfile FILE
Filepath and base module name of the generated parser; when terminated with a / \(dir separator\) it is treated as the destination directory where the generated output will be stored

:   -t, --debug
Debug mode  \[false\]

:   -I, --info
Report some statistics about the generated parser  \[false\]

:   -m TYPE, --module-type TYPE
The type of module to generate \(commonjs, amd, es, js\)  \[commonjs\]

:   -n NAME, --module-name NAME
The name of the generated parser object, namespace supported

:   -p TYPE, --parser-type TYPE
The type of algorithm to use for the parser \(lr0, slr, lalr, lr, ll\)  \[lalr\]

:   -c, --compress-tables
Output compressed parser tables in generated modules \(0 = no compression, 1 = default compression, 2 = deep compression\)  \[2\]

:   -T, --output-debug-tables
Output extra parser tables \(rules list + look-ahead analysis\) in generated modules to assist debugging / diagnostics purposes  \[false\]

:   -X, --no-default-resolve
Act another way when a conflict is found in the grammar  \[false\]

:   --default-action=[for-values,for-locations]
Generate a parser which does NOT include the default "$$ = $1" action for every rule. This produces a slightly faster parser but now you are solely reponsible for propagating rule action "$$" results.  \[false\]

:   --no-try-catch
Generate a parser which does NOT try/catch exceptions \(from the grammar action code or parseError error reporting calls. This produces a slightly faster parser at the cost of enhanced code safety.  \[false\]

:   -Q, --error-recovery-token-discard-count
Set the number of lexed tokens that may be gobbled by an error recovery process before we cry wolf \(default: 3\)  \[3\]

:   -E, --export-all-tables
Next to producing a grammar source file, also export the symbols, terminals, grammar and parse tables to separate JSON files for further use by other tools. The files' names will be derived from the outputFile name by appending a suffix.  \[false\]

:   -x, --main
Include .main\(\) entry point in generated commonjs module  \[false\]

:   -y NAME, --module-main NAME
The main module function definition

:   -V, --version
print version and exit

## Usage from a CommonJS module

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




## More Documentation

For more information on creating grammars and using the generated parsers, read the [documentation](http://jison.org/docs).




## How to contribute

See [CONTRIBUTING.md](https://github.com/GerHobbelt/jison/blob/master/CONTRIBUTING.md) for contribution guidelines, how to run the tests, etc.




## Projects using Jison

View them on the [wiki](https://github.com/zaach/jison/wiki/ProjectsUsingJison), or add your own.




## Submodules for Jison

The JISON tool uses several modules:

* [The `ebnf-parser` library](https://github.com/GerHobbelt/ebnf-parser) parses BNF and EBNF grammars to a basic AST used by Jison to produce a parser engine for your grammar spec.
* [The `lex-parser` library](https://github.com/GerHobbelt/lex-parser) parses `%lex ... /lex` lexical grammars to a basic AST used by Jison to produce a parser engine for your grammar spec.
* [The `jison-lex` library/utility](https://github.com/GerHobbelt/jison-lex) generates lexical analyzers which are included by Jison in your parser run-time engine to lex the input according to your `%lex ... /lex` lexical grammar definition. 
* [The `jison2json` utility](https://github.com/GerHobbelt/jison2json) converts a Jison spec file to JSON format file.
* [The `json2jison` utility](https://github.com/GerHobbelt/json2jison) converts a JSON format file to a Jison spec file.




## Contributors

[Githubbers](http://github.com/GerHobbelt/jison/contributors)

Special thanks to Jarred Ligatti, Manuel E. Bermúdez




## What's New or Different?

Here's a comprehensive list of features and fixes compared to the [original](https://github.com/zaach/jison):

* Full Unicode support: the lexer can handle all Unicode regexes which are supported by the [XRegExp library](https://github.com/slevithan/xregexp), with a few notes:

  * your own software **does not need to include the XRegExp library**: jison will produce standard JavaScript regex expressions for every lexer rule so that you can enjoy most Unicode features without the added burden of another library \(XRegExp\)

  * [astral Unicode codepoints](http://xregexp.com/flags/#astral) are not fully supported within regex character set expressions, unless you yourself include XRegExp and instruct the lexer to produce XRegExp regex expressions via the lexer option `%options xregexp`

* EBNF LR/LALR/SLR/LR0 grammars are correctly rewritten to BNF grammars, allowing your action code blocks to access all elements of the grammar rule at hand. See also [the wiki section about EBNF](https://github.com/zaach/jison/wiki/Deviations-From-Flex-Bison#user-content-extended-bnf).

* **Parser engine optimization**: jison analyzes not just your grammar, but also your action code and will strip any feature you don't use \(such as [location tracking](https://github.com/zaach/jison/wiki/Deviations-From-Flex-Bison#user-content-accessing-values-and-location-information) via
  `@element` references and `yylloc`\) from the parser kernel, which will benefit your parser run-time performance. The fastest parsers are obtained when you do not include error recovery \(`error` tokens in your grammar\), nor any lexer location tracking: this can potentially result in run-time execution cost reductions of over 70% \(hence your parser executes more than 3 times as fast\)!

* generated grammar / lexer source files carry a full API and internals documentation in the code comments to help you to read and debug a grammar. For example, every grammar rule is printed above its action code so that stepping through the parser when debugging hard-to-find problems makes it quite obvious which rule the engine is currently 'reducing'.

* Generated parsers and lexers are JavaScript `strict mode` compliant.

* you can specify a totally _custom lexer_ in the `%lex ... /lex` section of your grammar definition file if you like, i.e. you can define and use a lexer which is not regex ruleset based / generated by jison lex! This is particularly handy when you want to achieve maximum performance / absolute minimum parse and lexing overhead for your high-performance demand grammars.

* `lexer.reject()` et al: the lexer comes with extra APIs to help you write more sophisticated lexers based on the lex/jison mechanism. The `this.reject()` call in your lexer rule action code will reject the current match and continue down the lexer rule set to find another match. Very handy when you do not `flex mode` matching all the time, but want specific, local, control over when a lexer regex \(a.k.a. lexer rule\) actually is a _correct_ match.

* You can now enter _epsilon_ as a token in your grammar rules, so no more hacks like `/* epsilon */` comments for empty rules: you can type any of these:

  * `%epsilon`,
  * `\u0190`
  * `\u025B`
  * `\u03B5`
  * `\u03F5`

  \(See also [https://en.wikipedia.org/wiki/Epsilon\#Glyph\_variants](https://en.wikipedia.org/wiki/Epsilon#Glyph_variants)\)

* `%options easy_keyword_rules`: see also [https://github.com/zaach/jison/wiki/Deviations-From-Flex-Bison\#user-content-literal-tokens](https://github.com/zaach/jison/wiki/Deviations-From-Flex-Bison#user-content-literal-tokens)

* ... more lexer features ...

  * %options ...

  * kernel ...

* ... more parser features ...

  * configurable error recovery search depth \(default: 3 tokens\)

  * augmented error reporting callbacks

  * dedicated parser and lexer `Error`-derived exception classes so you can use `instanceof` to help your generic error code discern what type of error has occurred and what info is available next to the text message itself.

  * \(are we faster even when we run with the same feature set as 'vanilla' zaach jison? Probably a little bit, but haven't measured this thoroughly.\)

  * JSON \(rather than _JISON_\) grammar files support all [JSON5](https://github.com/json5/json5) features, i.e. you can include comments, etc. in your JSON-file based grammar specs!




## License

> Copyright \(c\) 2009-2016 Zachary Carter
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation  files \(the "Software"\), to deal in the Software without restriction, including without
> limitation the rights to use,  copy, modify, merge, publish, distribute,
> sublicense, and/or sell  copies of the
> Software, and to permit persons to
> whom the  Software is furnished to do
> so, subject to the following
> conditions:
>
> The above copyright notice and this
> permission notice shall be  included
> in all copies or substantial portions
> of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS",
> WITHOUT WARRANTY OF ANY KIND,  EXPRESS
> OR IMPLIED, INCLUDING BUT NOT LIMITED
> TO THE WARRANTIES  OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT  HOLDERS BE
> LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY,  WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR  OTHER DEALINGS IN THE SOFTWARE.



