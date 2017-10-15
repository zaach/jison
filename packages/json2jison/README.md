# json2jison


[![build status](https://secure.travis-ci.org/GerHobbelt/json2jison.png)](http://travis-ci.org/GerHobbelt/json2jison)


[jison](http://jison.org) grammars come in two formats: JSON or a special text format similar to Bison's. This utility converts from the JSON format to jison's text format. See the [jison2json](https://github.com/zaach/jison2json) utility for the reverse conversion.


## install

    npm install @gerhobbelt/json2jison -g



## build

Follow the install & build directions of the monorepo.
    
You can also only build this particular subpackage by `cd`-ing into this directory
and then invoking the local make:
    
    cd packages/json2jison
    make

This will generate the rollup/babel-postprocessed ES6 and ES5 
compatible libraries in the local `dist/` directory.



## license

MIT
