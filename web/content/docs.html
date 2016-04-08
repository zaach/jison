---
title: Documentation
---
Documentation
=============

Jison takes a context-free grammar as input and outputs a JavaScript file capable of parsing the language described by that grammar. You can then use the generated script to parse inputs and accept, reject, or perform actions based on the input. If you're familiar with Bison or Yacc, or other clones, you're almost ready to roll.

* [Installation](#installation)
* [Usage from the command line](#usage-from-the-command-line)
* [Usage from a CommonJS Module](#usage-from-a-commonjs-module)
* [Using the Generated Parser](#using-the-generated-parser)
* [Using the Parser from the Web](#using-the-parser-from-the-web)
* [The Concepts of Jison](#the-concepts-of-jison)
* [Specifying a Language](#specifying-a-language)
* [Lexical Analysis](#lexical-analysis)
* [Tracking Locations](#tracking-locations)
* [Custom Scanners](#custom-scanners)
* [Sharing Scope](#sharing-scope)
* [Parsing algorithms](#parsing-algorithms)
* [Projects using Jison](#projects-using-jison)
* [Contributors](#contributors)
* [License](#license)



Installation
------------

Jison can be installed for [Node](http://nodejs.org) using [`npm`](http://github.com/isaacs/npm/)

Using npm:

    npm install jison -g



Usage from the command line
-----------------------

Clone the github repository for examples:

    git clone git://github.com/zaach/jison.git
    cd jison/examples

Now you're ready to generate some parsers:

    jison calculator.jison

This will generate `calculator.js` in your current working directory. This script can be used to parse an input file, like so:

    echo "2^32 / 1024" > testcalc
    node calculator.js testcalc

This will print out `4194304`.



Usage from a CommonJS Module
--------------------------

You can generate parsers programmatically from JavaScript as well. Assuming Jison is in your CommonJS environment's load path:

    // mygenerator.js
    var Parser = require("jison").Parser;

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

    parser.parse("adfe34bc e82a");
    // returns true

    parser.parse("adfe34bc zxg");
    // throws lexical error

Alternatively, if you want to use the Jison file format but not generate a static JavaScript file for it, you could use a snippet like this:

    // myparser.js
    var fs = require("fs");
    var jison = require("jison");

    var bnf = fs.readFileSync("grammar.jison", "utf8");
    var parser = new jison.Parser(bnf);

    module.exports = parser;



Using the Generated Parser
--------------------------

Once you have generated the parser and saved it, you no longer need Jison or any other dependencies.

As demonstrated before, the parser can be used from the command line:

    node calculator.js testcalc

Though, more ideally, the parser will be a dependency of another module. You can require it from another module like so:

    // mymodule.js
    var parser = require("./calculator").parser;

    function exec (input) {
        return parser.parse(input);
    }

    var twenty = exec("4 * 5");

Or more succinctly:

    // mymodule.js
    function exec (input) {
        return require("./calculator").parse(input);
    }

    var twenty = exec("4 * 5");



Using the Parser from the Web
----------------------------

The generated parser script may be included in a web page without any need for a CommonJS loading environment. It's as simple as pointing to it via a script tag:

    <script src="calculator.js"></script>

When you generate the parser, you can specify the variable name it will be declared as:

    // mygenerator.js
    var parserSource = generator.generate({moduleName: "calc"});
    // then write parserSource to a file called, say, calc.js

Whatever `moduleName` you specified will be the the variable you can access the parser from in your web page:

    <script src="calc.js"></script>
    <script>
      calc.parse("42 / 0");
    </script>

The moduleName you specify can also include a namespace, e.g:

    // mygenerator.js
    var parserSource = parser.generate({moduleName: "myCalculator.parser"});

And could be used like so:

    <script>
      var myCalculator = {};
    </script>

    <script src="calc.js"></script>

    <script>
      myCalculator.parser.parse("42 / 0");
    </script>

Or something like that -- you get the picture.

A demo of the calculator script used in a web page is [here](/jison/demos/calc/).



The Concepts of Jison
---------------------

Until the [Bison guide](http://dinosaur.compilertools.net/bison/bison_4.html#SEC7) is properly ported for Jison, you can refer to it for the major concepts, which are equivalent (except for the bits about static typing of semantic values, and other obvious C artifacts.)

Other helpful sections:

* [Bison Grammar Files](http://dinosaur.compilertools.net/bison/bison_6.html#SEC34)
* [The Bison Parser Algorithm](http://dinosaur.compilertools.net/bison/bison_8.html#SEC68)
* [Error Recovery](http://dinosaur.compilertools.net/bison/bison_9.html#SEC81) (alpha support, at this point)



Specifying a Language
---------------------

The process of parsing a language involves two phases: **lexical analysis** (tokenizing) and **parsing**, which the Lex/Yacc and Flex/Bison combinations are famous for. Jison lets you specify a parser much like you would using Bison/Flex, with separate files for tokenization rules and for the language grammar, or with the tokenization rules embedded in the main grammar.

For example, here is the grammar for the calculator parser:

    /* description: Parses end executes mathematical expressions. */

    /* lexical grammar */
    %lex

    %%
    \s+                   /* skip whitespace */
    [0-9]+("."[0-9]+)?\b  return 'NUMBER';
    "*"                   return '*';
    "/"                   return '/';
    "-"                   return '-';
    "+"                   return '+';
    "^"                   return '^';
    "("                   return '(';
    ")"                   return ')';
    "PI"                  return 'PI';
    "E"                   return 'E';
    <<EOF>>               return 'EOF';

    /lex

    /* operator associations and precedence */

    %left '+' '-'
    %left '*' '/'
    %left '^'
    %left UMINUS

    %start expressions

    %% /* language grammar */

    expressions
        : e EOF
            {print($1); return $1;}
        ;

    e
        : e '+' e
            {$$ = $1+$3;}
        | e '-' e
            {$$ = $1-$3;}
        | e '*' e
            {$$ = $1*$3;}
        | e '/' e
            {$$ = $1/$3;}
        | e '^' e
            {$$ = Math.pow($1, $3);}
        | '-' e %prec UMINUS
            {$$ = -$2;}
        | '(' e ')'
            {$$ = $2;}
        | NUMBER
            {$$ = Number(yytext);}
        | E
            {$$ = Math.E;}
        | PI
            {$$ = Math.PI;}
        ;


which compiles down to this JSON representation used directly by Jison:

    {
        "lex": {
            "rules": [
               ["\\s+",                    "/* skip whitespace */"],
               ["[0-9]+(?:\\.[0-9]+)?\\b", "return 'NUMBER';"],
               ["\\*",                     "return '*';"],
               ["\\/",                     "return '/';"],
               ["-",                       "return '-';"],
               ["\\+",                     "return '+';"],
               ["\\^",                     "return '^';"],
               ["\\(",                     "return '(';"],
               ["\\)",                     "return ')';"],
               ["PI\\b",                   "return 'PI';"],
               ["E\\b",                    "return 'E';"],
               ["$",                       "return 'EOF';"]
            ]
        },

        "operators": [
            ["left", "+", "-"],
            ["left", "*", "/"],
            ["left", "^"],
            ["left", "UMINUS"]
        ],

        "bnf": {
            "expressions" :[[ "e EOF",   "print($1); return $1;"  ]],

            "e" :[[ "e + e",   "$$ = $1 + $3;" ],
                  [ "e - e",   "$$ = $1 - $3;" ],
                  [ "e * e",   "$$ = $1 * $3;" ],
                  [ "e / e",   "$$ = $1 / $3;" ],
                  [ "e ^ e",   "$$ = Math.pow($1, $3);" ],
                  [ "- e",     "$$ = -$2;", {"prec": "UMINUS"} ],
                  [ "( e )",   "$$ = $2;" ],
                  [ "NUMBER",  "$$ = Number(yytext);" ],
                  [ "E",       "$$ = Math.E;" ],
                  [ "PI",      "$$ = Math.PI;" ]]
        }
    }

Jison accepts both the Bison/Flex style format, or the raw JSON format, e.g:

    node bin/jison examples/calculator.jison

or

    node bin/jison examples/calculator.json

When the lexical grammar resides in its own (.jisonlex) file, use that as the second argument to Jison, e.g.:

    node bin/jison examples/classy.jison examples/classy.jisonlex

More examples can be found in the [`examples/`](http://github.com/zaach/jison/tree/master/examples/) and [`tests/parser/`](http://github.com/zaach/jison/tree/master/tests/parser/) directories.



Lexical Analysis
----------------

Jison includes a rather rudimentary scanner generator, though **any module that supports the basic scanner API could be used** in its place.

The format of the [input file](http://dinosaur.compilertools.net/flex/flex_6.html#SEC6) (including macro support) and the style of the [pattern matchers](http://dinosaur.compilertools.net/flex/flex_7.html#SEC7) are modeled after Flex. Several [metacharacters have been added](https://github.com/zaach/jison/wiki/Deviations-From-Flex-Bison), but there is also one minor inconvenience compared to Flex patterns, namely exact string patterns must be placed in quotes e.g.:

Bad:

    [0-9]+zomg    print(yytext)

Good:

    [0-9]+"zomg"    print(yytext);

Actions that span multiple lines should be surrounded by braces:

    [0-9]+"zomg"    %{ print(yytext);
                       return 'ZOMG'; %}

A recently added feature are **[start conditions](http://dinosaur.compilertools.net/flex/flex_11.html)**, which allow certain rules to only match in certain states. If the lexer is not in that state, then the rule is ignored. The lexer starts in the `INITIAL` state, but can move to new states specified by you. Read that link for the run-down. An example below shows where Jison differs, namely `this.begin('state')` instead of `BEGIN(STATE)` for changing states within an action:

    %s expect

    %%
    expect-floats        this.begin('expect');

    <expect>[0-9]+"."[0-9]+      {
                console.log( "found a float, = " + yytext );
                }
    <expect>\n           %{
                /* that's the end of the line, so
                 * we need another "expect-number"
                 * before we'll recognize any more
                 * numbers
                 */
                this.begin('INITIAL');
                %}

    [0-9]+      console.log( "found an integer, = " + yytext );

    "."         console.log( "found a dot" );



>
> ### Note: `begin()` API is old; use `pushState()` API instead.
>
> As Jison maintains a **start condition _stack_** it is advised to use 
> the more recent lexer API methods `pushState('state')` and `popState()` rather than 
> the older `this.begin('state')` described just above as these `pushState()` and 
> `popState()` better describe of what the lexer does and what you can expect.
>
> The old `this.begin('state')` lexer API call is identical to calling the new `this.pushState('state')` API.
>



If you use `%x` instead of `%s` to declare your start condition then _only_ rules that match the current start condition will be considered.

Consider the following example of a scanner that simply scans all double-quote delimited strings in a text file but disallows newlines inside quotations:

    %x string

    %%
    ["]               this.begin("string");
    <string>[^"\n]*   return "STRING";
    <string>[\n]      return "NEWLINE_IN_STRING";
    <string><<EOF>>   return "EOF_IN_STRING";
    <string>["]       this.popState();

    [.\n]+            /* skip over text not in quotes */
    <<EOF>>           return "EOF";

Additionally, use `this.popState()` within an action to revert to the previous state.

Using the JSON format, start conditions are defined with an array before the rule's matcher:

    {
      rules: [
        [['expect'], '[0-9]+"."[0-9]+', 'console.log( "found a float, = " + yytext );']
      ]
    }

The array contains the list of start conditions for the rule.



Tracking Locations
------------------

Jison's lexical analyzer will track line number and column number information for each token and make them available within parser actions.
The API is identical to [Bison's](http://www.gnu.org/software/bison/manual/html_node/Actions-and-Locations.html#Actions-and-Locations).



Custom Scanners
---------------

You don't have to use the builtin Jison lexical scanner. An object with a `lex` and a `setInput` function would suffice, e.g.:

    parser.lexer = {
		lex: function () { 
			return 'NIL'; 
		}, 
		setInput: function (str) {} 
	};

This lexer would simply return `NIL` tokens *ad infinitum*.

The following example demonstrates a scanner that looks for upper and lower case letters, ignoring all whitespace:

    // myscanner.js
    function AlphabetScanner() {
        var text = "";
        this.yytext = "";
        this.yyloc = {
            first_column: 0,
            first_line: 1,
            last_line: 1,
            last_column: 0
        };
        this.yylloc = this.yyloc;
        this.setInput = function(text_) {
            text = text_;
        };
        this.lex = function() {
            // Return the EOF token when we run out of text.
            if (text === "") {
                return "EOF";
            }

            // Consume a single character and increment our column numbers.
            var c = text.charAt(0);
            text = text.substring(1);
            this.yytext = c;
            this.yyloc.first_column++;
            this.yyloc.last_column++;

            if (c === "\n") {
                // Increment our line number when we hit newlines.
                this.yyloc.first_line++;
                this.yyloc.last_line++;
                // Try to keep lexing because we aren't interested
                // in newlines.
                return this.lex();
            } else if (/[a-z]/.test(c)) {
                return "LOWER_CASE";
            } else if (/[A-Z]/.test(c)) {
                return "UPPER_CASE";
            } else if (/\s/.test(c)) {
                // Try to keep lexing because we aren't interested
                // in whitespace.
                return this.lex();
            } else {
                return "INVALID";
            }
        };
    }
    parser.lexer = new AlphabetScanner();



Sharing Scope
------------

In Bison, code is expected to be lexically defined within the scope of the semantic actions. E.g., chunks of code may be included in the generated parser source, which are available from semantic actions.

Jison supports inline code blocks like Bison, but also exposes state that can be accessed from other modules. Instead of pulling code into the generated module, the generated module can be required and used by other modules. The parser has a `yy` property which is exposed to actions as the `yy` free variable. Any functionality attached to this property is available in both lexical and semantic actions through the `yy` free variable.

An example from orderly.js:

    var parser = require("./orderly/parse").parser;

    // set parser's shared scope
    parser.yy = require("./orderly/scope");

    // returns the JSON object
    var parse = exports.parse = function (input) {
        return parser.parse(input);
    };
    ...

The `scope` module contains logic for building data structures, which is used within the semantic actions.



Parsing algorithms
------------------

Like Bison, Jison can recognize languages described by LALR(1) grammars, though it also has modes for LR(0), SLR(1), and LR(1). It also has a special mode for generating LL(1) parse tables (requested by my professor,) and could be extended to generate a recursive descent parser for LL(k) languages in the future. But, for now, Jison is geared toward bottom-up parsing.

**LR(1) mode is currently not practical for use with anything other than toy grammars, but that is entirely a consequence of the algorithm used, and may change in the future.**



Deviations from Flex / Bison
----------------------------

<!-- #################################################### -->
<!-- this bit is also available in the wiki at:  -->
<!-- #################################################### -->






## Lex Patterns



### Literal tokens

>
> #### WARNING: vanilla zaach/jison has 'easy keyword' support turned *on* all the time
>
> The section currently describes the GerHobbelt fork which has the 
>
> ```
> %options easy_keyword_rules
> ``` 
>
> feature while vanilla jison has not (at least not a pullreq for this is posted by me (@GerHobbelt) and accepted.
>
> Hence vanilla jison will work as if you *implicitly* specified `%options easy_keyword_rules` in every lexer of yours.
>


When the lexer 'easy keyword' option has been turned on in your lexer file / section using 

```
%options easy_keyword_rules
```

you will notice that token `"foo"` will match whole word only, while `("foo")` will match `foo` anywhere unless. 

See [issue #63](https://github.com/zaach/jison/issues/63) and [GHO commit 64759c43](https://github.com/GerHobbelt/jison/commit/64759c4362af04f63e980764e322ddca279737a5).



>
> #### Under The Hood
>
> Technically what happens is that `%options easy_keyword_rules` turns on lexer rule inspection and where it recognizes that
> a rule *ends* with a literal character, then the regex *word edge* `\\b` check is appended to the lexer regex for the given rule.
>




### Longest rule matching

The lexer will use the first rule that matches the input string unless you use `%options flex`, in which case it will use the rule with the longest match.




### Additions

Because Jison uses JavaScript’s regular expression engine, it is possible to use some metacharacters that are not present in Flex patterns.

See for a full list of available regex metacharacters the MDN documentation: [Using Special Characters](https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions#Using_special_characters)




#### Negative Lookahead

Flex patterns support lookahead using `/`, Jison adds negative lookahead using `/!`.

>
> ##### Under The Hood
>
> Technically what happens is that `/\<atom>` and `/!\<atom>` are 1:1 replaced by the regex expressions `(?=\<atom>)` and `(?!\<atom>)` respectively.
>




#### Advanced Grouping Options

Jison supports as advanced grouping options

  * non-grouping brackets `(?:PATTERN)`,
  * positive lookahead `(?=PATTERN)` and
  * negative lookahead `(?!PATTERN)`.



#### yymore, yyless, etc...

The flex macros `yymore()` and `yyless` must be rewritten to use the Jison lexer's JavaScript API calls:

  * `yymore()` -> `this.more()` 
    (See: [flex manual](http://flex.sourceforge.net/manual/Actions.html#index-g_t_007c_002c-use-of-114) 
    and the Jison [example as "test more()"](https://github.com/zaach/jison-lex/blob/master/tests/regexplexer.js#L288))
  * `yyless()` -> `this.less()`
    (See [flex manual](http://flex.sourceforge.net/manual/Actions.html#index-yyless_0028_0029-119)
    and the Jison [example as "test less()"](https://github.com/zaach/jison-lex/blob/master/tests/regexplexer.js#L790))




#### Braces in actions

Within **lexer** actions use `%{ ... %}` delimiters if you want to use block-style statements, e.g.:

``` plain
.*  %{
  if (true) {
    console.log('test');
  }
  // ...
%}
```

Within **parser** actions you may alternatively use `{{ .. }}` delimiters for the same purpose:

``` plain
test
  : STRING EOF  {{
    if (true) {
      console.log('test');
    }
    // ...
    return $1;
  }}
  ;
```

though Jison also supports `%{ ... %}` multi-line action blocks in the *grammar* rules:

``` plain
test
  : STRING EOF  %{
    if (true) {
      console.log('test');
    }
    // ...
    return $1;
  }%
  ;
```

See [issue #85](https://github.com/zaach/jison/issues/85)



## Semantic Actions

Actions should contain JavaScript instead of C, naturally.

  


### Braces

As of Jison v0.2.8, you no longer need to use double braces `{{...}}` around grammar rule
action code blocks.

From now on, single braces `{...}` suffice.




### Short-hand syntax

There is a short-hand arrow syntax:
```
 exp:    ...
         | '(' exp ')' -> $2
         | exp '+' exp -> $1 + $3
```



### Accessing values and location information

Normally, you’ld have to use the position of the corresponding nonterminal or terminal in the production, prefixed by a dollar sign $, e.g.:

```
 exp:    ...
         | '(' exp ')'
             { $$ = $2; }
```

Now, you can also access the value by using the name of the nonterminal instead of its position, e.g.:

```
 exp:    ...
         | '(' exp ')'
             { $$ = $exp; }
```

If the rule is ambiguous (the nonterminal appears more than once,) append a number to the end of the nonterminal name to disambiguate the desired value:

```
 exp:    ...
         | exp '+' exp
             { $$ = $exp1 + $exp2; }
```

Association by name leads to a looser coupling (and is easier to grok.)

This also works for accessing location information (compare with the [Bison manual on Named references](http://www.gnu.org/software/bison/manual/html_node/Named-References.html#Named-References) and their [Actions and Locations](http://www.gnu.org/software/bison/manual/html_node/Actions-and-Locations.html#Actions-and-Locations) section):

```
 exp:    ...
         | '(' exp ')'
             { @$ = @exp; /* instead of @$ = $2 */ }
```

Another way to resolve ambiguity would be to use *aliases* in square brackets, for example:

```
 exp:    ...
         | exp\[left] '+' exp\[right]
             { $$ = $left + $right; }
```



#### Auto-numbered named accessors

'Auto-numbering' means that the first occurrence of label (token name or alias) `nnn` will also be available as `nnn*1*`, and so on.

In the section above you may have seen one example where the nonterminal *names* have been auto-numbered to provide unambiguous access to each:

```
 exp:    ...
         | exp '+' exp
             { $$ = $exp1 + $exp2; }
```

Note that in every Jison rule production, all the nonterminal names *and* all the *aliases* are always also available in 'auto-numbered' form, 
that is: when the same nonterminal name or alias occurs multiple times in the same rule, the action block can uniquely address a particular 
nonterminal or alias by using the auto-numbered form.

An example:

``` plain
test
: subrule\[alt] subrule\[wicked_middle] subrule\[alt] '?'\[alt]
%{
    // These are all unambiguous and legal to address $1, $2, $3 and $4:
    //
    // $1 === $subrule1 === $alt1
    // $1 === $alt  <-- first occurrence also registers the name itself!
    // $2 === $subrule2 === $wicked_middle
    // $3 === $subrule3 === $alt2
    // $4 === $alt3
    //
    // @1 === @subrule1 === @alt1
    // @1 === @alt  <-- first occurrence also registers the name itself!
    // @2 === @subrule2 === @wicked_middle
    // @3 === @subrule3 === @alt2
    // @4 === @alt3
%}
```

>
> ##### Caveat Emptor 
>
> It doesn't say what'll happen if you go and game the system by using aliases with the same name as the nonterminals, e.g.
>
> ```
> exp:    ...
>          | exp\[exp] '+' exp\[exp]
>              { $$ = $exp1 + $exp3 /* 3? Are we sure about this? */; }
> ```
> 
> If you wonder, [RTFC: vanilla](https://github.com/zaach/jison/blob/master/lib/jison.js#L279) vs. [RTFC: GerHobbelt](https://github.com/GerHobbelt/jison/blob/master/lib/jison.js#L385)
>
> 
> ---
> 
>
> #### WARNING: vanilla zaach/jison doesn't behave the same when it comes to mixing aliases and nonterminal names.
>
> The section currently describes the GerHobbelt fork. With vanilla zaach/jison the safe rule of thumb here is that when you specify an *alias* for a nonterminal, then you SHOULD NOT USE the nonterminal name itself any more in your action code.
>
> RTFC to compare and check each's behaviour here: [vanilla](https://github.com/zaach/jison/blob/master/lib/jison.js#L279) vs. [GerHobbelt](https://github.com/GerHobbelt/jison/blob/master/lib/jison.js#L385) 
>



## Extended BNF

Jison now supports EBNF syntax, showcased [here](https://gist.github.com/1659274).







## Extended BNF: how it works and what to keep in mind when using this

EBNF is accepted by the jison grammar engine and transposed to a *BNF* grammar using equivalence transforms for each of the EBNF `*`, `+`, `?` and `(...)` operators.



For these EBNF wildcards & groups the following treatment must be kept in mind:

- Only the outermost wild-carded group's label or index is addressable in your action. That group
  is translated to a single nonterminal, e.g.

  ```
  rule: A (B C D E)?
  ```

  becomes

  ```
  rule: A subrule_option0

  subrule_option0: /* nil */ | B C D E;
  ```

  hence your action block for rule `rule` will only have `$1` and `$2` (the `subrule_option0` nonterminal) to play with.

  As jison allows labeling the wildcarded group, such an alias might keep things more readable:

  ```
  rule: A (B C D E)?\[choice]
  ```

  becomes

  ```
  rule: A subrule_option0\[choice]

  subrule_option0: /* nil */ | B C D E;
  ```

  **WARNING**: it's illegal to attempt to access `$B`, `$C` et al from your `rule`'s action code block and very bad things will happen you.

  + vanilla zaach/jison will not translate those references and your code will be *TOAST*.

  + GerHobbelt/jison analyzes your action code chunk and attempts to locate all your `$whatever` and `@whatever` references in there and barfs a hairball (i.e. fails at jison compile time) with a big fat error message if you do.

    >
    > Do note that we are a little dumb scanner, so we *will* recognize those references even when they sit in a nice cozy **comment** in there!
    >

- `(...)*`, `(...)+` and `(...)?` are the wildcarded ones and will be rewritten to equivalent BNF rules.

  You MAY nest these constructs.

- The `(...)` group is also recognized (no wildcard operator there): it will be unrolled. Unless there's a label attacked to it. In that case it's rewritten.

  Hence

  ```
  rule: A (B C D E)
  ```

  becomes

  ```
  rule: A B C D E;
  ```
 
  while

  ```
  rule: A (B C D E)\[groupies]
  ```

  becomes

  ```
  rule: A subrule\[groupies]

  subrule: B C D E;
  ```

  so be aware that a little change like that can play havoc on your (*action*) code: the former, unrolled, grouping gives you
  access to all it terms (nonterminals and terminals alike), while the labeled a.k.a. aliased version *hides* those inner terms from you.

- In order to have something decent to work with in your action code, every *wildcard* or non-wilcarded group 
  which is not unrolled will collect all its terms' values (`yytext`) as
  produced by the lexer and store it in an array, thus constructing a *Poor Man's AST*:

  ```
  rule: A (B C+ (D E)\[hoobahop])?\[choice]
  ```

  becomes

  ```
  rule: A subrule_option0\[choice]

  subrule_option0: /* nil */ | subrule_option1;

  subrule_option1: B C+ (D E)\[hoobahop];
  ```

  which becomes

  ```
  rule: A subrule_option0\[choice]

  subrule_option0: /* nil */ | subrule_option0;

  subrule_option1: B subrule_series1 hoobahop_group0;

  subrule_series1: subrule_series1 C | C;

  hoobahop_group0: D E;
  ```

  which will deliver in your `$choice` reference an array shaped like this 
  (comments show the origin of each bit):

  ```
  // subrule_option0
  \[
    // **Note**:
    // as this is choice, you get only the value 
    //
    //     undefined
    // 
    // when you've hit the **nil** epsilon choice instead!
    
    // subrule_option1: 
    \[
      B,
      // subrule_series1
      \[
        // the EBNF rewriter is smart enough to see that there's
        // only 1(one) term in this one: `C` so no extra arrays-in-array
        // for you here:
        C,
        C,
        ...
      ], 
      // hoobahop_group0
      \[
        D,
        E
      ]
    ]
  ]
  ```



### BIG FAT WARNING:

The above is written for the GerHobbelt fork as currently EBNF support in vanilla zaach/jison is ever so slightly b0rked.

But that's not what this warning is about!

As I (Gerhobbelt) write this, I wonder if this **really** **really** is the truth. It *may* be that the current bleeding edge
(master branch) still has a few, ahh..., sub-optimalities in reality compared to the above.

**To Be Checked**




 




---


Some improvements have been made for parser and lexer grammars in Jison 0.3 (demonstrated in the FlooP/BlooP example below.)

For lexers:

* Patterns may use unquoted characters instead of strings
* Two new options, `%options flex case-insensitive`
 * `flex`: the rule with the longest match is used, and no word boundary patterns are added
 * `case-insensitive`: all patterns are case insensitive
* User code section is included in the generated module

For parsers:

* Arrow syntax for semantic actions
* EBNF syntax (enabled using the `%ebnf` declaration)
 * Operators include repetition (`*`), non-empty repetition (`+`), grouping (`()`), alternation within groups (`|`), and option (`?`)
* User code section and code blocks are included in the generated module

Also, Robert Plummer has created a [PHP port](https://github.com/zaach/jison/tree/master/ports/php) of Jison's parser.

See the grammar below for more examples.

---







<!-- #################################################### -->
<!-- end of the 'wiki::Deviations from Felx / Bison' part -->
<!-- #################################################### -->



Projects using Jison
--------------------

View them on the [wiki](https://github.com/zaach/jison/wiki/ProjectsUsingJison), or add your own.



Contributors
------------

via [github](http://github.com/zaach/jison/contributors)



License
-------

> Copyright (c) 2009-2013 Zachary Carter
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

