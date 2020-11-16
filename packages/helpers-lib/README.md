# jison-helpers-lib


[![Join the chat at https://gitter.im/jison-parsers-lexers/Lobby](https://badges.gitter.im/jison-parsers-lexers/Lobby.svg)](https://gitter.im/jison-parsers-lexers/Lobby?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) 
[![Build Status](https://travis-ci.org/GerHobbelt/jison-helpers-lib.svg?branch=master)](https://travis-ci.org/GerHobbelt/jison-helpers-lib)
[![NPM version](https://badge.fury.io/js/jison-helpers-lib.svg)](http://badge.fury.io/js/jison-helpers-lib)
[![Dependency Status](https://img.shields.io/david/GerHobbelt/jison-helpers-lib.svg)](https://david-dm.org/GerHobbelt/jison-helpers-lib)
[![npm](https://img.shields.io/npm/dm/jison-helpers-lib.svg?maxAge=2592000)]()



Helper functions shared among the jison repositories (jison, ebnf-parser, lex-parser, jison-lex)



## install

    npm install @gerhobbelt/jison-helpers-lib

or the entire bundle via

    npm install jison-gho

Then the `jison-helpers` library is located in the subdirectory `packages/helpers-lib/` of the `jison-gho` monorepo, i.e. `.../node_modules/jison-gho/packages/helpers-lib/`.

Alternatively, most parts of the `helpers-lib` API are also available via the `jison` API itself as can be seen from this internal `jison` code snippet:

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
// get a reference to the parts of the `jison-helpers-lib` API:
const codeExec = jisonAPI.codeExec;
...etc...
```



## build

Follow the install & build directions of the monorepo.
    
You can also only build this particular subpackage by `cd`-ing into this directory
and then invoking the local make:
    
    cd packages/helpers-lib
    make

This will generate the rollup/babel-postprocessed ES6 and ES5 
compatible libraries in the local `dist/` directory.

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
var helpers = require('jison-helpers-lib');

...
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
