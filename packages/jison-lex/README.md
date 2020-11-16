# jison-lex


[![Join the chat at https://gitter.im/jison-parsers-lexers/Lobby](https://badges.gitter.im/jison-parsers-lexers/Lobby.svg)](https://gitter.im/jison-parsers-lexers/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
[![Build Status](https://travis-ci.org/GerHobbelt/jison-lex.svg?branch=master)](https://travis-ci.org/GerHobbelt/jison-lex)
[![NPM version](https://badge.fury.io/js/%40gerhobbelt%2Fjison-lex.svg)](http://badge.fury.io/js/%40gerhobbelt%2Fjison-lex)
[![Dependency Status](https://img.shields.io/david/GerHobbelt/jison-lex.svg)](https://david-dm.org/GerHobbelt/jison-lex)
[![npm](https://img.shields.io/npm/dm/@gerhobbelt/jison-lex.svg?maxAge=2592000)]()




A lexical analyzer generator used by [jison](http://jison.org). It takes a lexical grammar definition (either in JSON or Bison's lexical grammar format) and outputs a JavaScript lexer.



## install

    npm install @gerhobbelt/jison-lex

or the entire bundle via

    npm install jison-gho

Then the `jison-lex` library is located in the subdirectory `packages/jison-lex/` of the `jison-gho` monorepo, i.e. `.../node_modules/jison-gho/packages/jison-lex/`.

Alternatively, the entire `jison-lex` API is also available via the `jison` API itself as can be seen from this internal `jison` code snippet:

```
import Lexer from '../packages/jison-lex';
import ebnfParser from '../packages/ebnf-parser';
import lexParser from '../packages/lex-parser';
import grammarPrinter from './util/grammar-printer.js';
import helpers from '../packages/helpers-lib';
var rmCommonWS = helpers.rmCommonWS;
var camelCase  = helpers.camelCase;
var code_exec  = helpers.exec;
import XRegExp from '@gerhobbelt/xregexp';
import recast from 'recast';
import astUtils from 'ast-util';
import json5 from '@gerhobbelt/json5';

// Also export other APIs: the JISON module should act as a 'facade' for the others,
// so applications using the JISON compiler itself can rely on it providing everything
// in a guaranteed compatible version as it allows userland code to use the precise
// same APIs as JISON will be using itself:
Jison.Lexer = Lexer;
Jison.ebnfParser = ebnfParser;
Jison.lexParser = lexParser;
Jison.codeExec = code_exec;
Jison.XRegExp = XRegExp;
Jison.recast = recast;
Jison.astUtils = astUtils;
Jison.JSON5 = json5;
Jison.prettyPrint = grammarPrinter;
Jison.rmCommonWS = rmCommonWS;
Jison.mkStdOptions = mkStdOptions;
Jison.camelCase = camelCase;
Jison.autodetectAndConvertToJSONformat = autodetectAndConvertToJSONformat;
...
Jison.Parser = Parser;

export default Jison;
```

hence you can get at it this way, for example:

```
import jisonAPI from 'jison-gho';
// get a reference to the full `jison-lex` API:
const jisonLexAPI = jisonAPI.Lexer;
```



## build

Follow the install & build directions of the monorepo.
    
You can also only build this particular subpackage by `cd`-ing into this directory
and then invoking the local make:
    
    cd packages/jison-lex
    make

This will generate the rollup/babel-postprocessed ES6 and ES5 
compatible libraries and CLI in the local `dist/` directory.

>
> ### Note about ES6/rollup usage vs. ES5
>
> All `dist/` library files are 'self-contained': they include all 'local imports' 
> from within this jison monorepo in order to deliver a choice of source files
> for your perusal where you only need to worry about importing **external dependencies**
> (such as `recast`).
>
> As such, these `dist/` files **should** be easier to minify and/or use in older
> (ES5) environments.
>
> #### rollup
>
> Iff you use `rollup` or similar tools in an ES6/ES2015/ES2017 setting, then the
> [`package.json::module`](https://github.com/rollup/rollup/wiki/pkg.module) has
> already been set up for you to use the *original sources* instead!
> 


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
var JisonLex = require('@gerhobbelt/jison-lex');

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
```


## license

MIT



## related repositories

- [jison / jison-gho](https://github.com/GerHobbelt/jison) @ [NPM](https://www.npmjs.com/package/jison-gho)
- [jison-lex](https://github.com/GerHobbelt/jison/master/packages/jison-lex) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/jison-lex)
- [lex-parser](https://github.com/GerHobbelt/jison/master/packages/lex-parser) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/lex-parser)
- [ebnf-parser](https://github.com/GerHobbelt/jison/master/packages/ebnf-parser) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/ebnf-parser)
- [jison2json](https://github.com/GerHobbelt/jison/master/packages/jison2json) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/jison2json)
- [json2jison](https://github.com/GerHobbelt/jison/master/packages/json2jison) @ [NPM](https://www.npmjs.com/package/@gerhobbelt/json2jison)
- [jison-helpers-lib](https://github.com/GerHobbelt/jison/master/packages/helpers-lib) @ [NPM](https://www.npmjs.com/package/jison-helpers-lib)
- ### secondary source repositories
  + [jison-lex](https://github.com/GerHobbelt/jison-lex)
  + [lex-parser](https://github.com/GerHobbelt/lex-parser)
  + [ebnf-parser](https://github.com/GerHobbelt/ebnf-parser)
  + [jison2json](https://github.com/GerHobbelt/jison2json)
  + [json2jison](https://github.com/GerHobbelt/json2jison)
  + [jison-helpers-lib](https://github.com/GerHobbelt/jison-helpers-lib)

