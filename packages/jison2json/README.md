# jison2json


[![build status](https://secure.travis-ci.org/GerHobbelt/jison2json.png)](http://travis-ci.org/GerHobbelt/jison2json)


[jison](http://jison.org) grammars come in two formats: JSON or a special text format similar to Bison's. This utility converts from the jison's format to JSON. See the [json2jison](https://github.com/zaach/json2jison) for the reverse conversion.


## install

    npm install @gerhobbelt/jison2json -g



## build

Follow the install & build directions of the monorepo.
    
You can also only build this particular subpackage by `cd`-ing into this directory
and then invoking the local make:
    
    cd packages/jison2json
    make

This will generate the rollup/babel-postprocessed ES6 and ES5 
compatible libraries in the local `dist/` directory.



## usage

    # single grammar
    jison2json grammar.y

    # or separate grammars
    jison2json grammar.y lex.l

Or require it and convert programatically:

    var jison2json = require('@gerhobbelt/jison2json');
    var grammar = "%% foo: bar { return true; };";

    var json = jison2json.convert(grammar);


## license

MIT
