// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  //input: 'dummy.js',
  //treeshake: false,
  //output: [
  //  {
  //    file: 'dist/dummy-cjs.js',
  //    format: 'cjs'
  //  },
  //  {
  //    file: 'dist/dummy-es6.js',
  //    format: 'es'
  //  },
  //  {
  //    file: 'dist/dummy-umd.js',
  //    name: 'jison-cli',
  //    format: 'umd'
  //  }
  //],
  plugins: [
    resolve({
      // use "module" field for ES6 module if possible
      // 
      // use "main" field or index.js, even if it's not an ES6 module
      // (needs to be converted from CommonJS to ES6
      // – see https://github.com/rollup/rollup-plugin-commonjs
      mainFields: ['module', 'main'],

      // not all files you want to resolve are .js files
      extensions: [ '.js' ],  // Default: ['.js']

      // whether to prefer built-in modules (e.g. `fs`, `path`) or
      // local ones with the same names
      preferBuiltins: true,  // Default: true

      // If true, inspect resolved files to check that they are
      // ES2015 modules
      modulesOnly: true, // Default: false
    })
  ],
  external: [
    'ast-util',
    '@gerhobbelt/json5',
    '@gerhobbelt/nomnom',
    '@gerhobbelt/prettier-miscellaneous',
    'recast',
    '@gerhobbelt/xregexp',
    'jison-helpers-lib',
    '@gerhobbelt/lex-parser',
    '@gerhobbelt/jison-lex',
    '@gerhobbelt/ebnf-parser',
    '@gerhobbelt/jison2json',
    '@gerhobbelt/json2jison',
    'jison-gho',
    'assert',
    'fs',
    'path',
    'process',
  ]
};

