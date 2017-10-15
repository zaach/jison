// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';

export default {
  input: 'lib/cli.js',
  output: [
  	  {
	    file: 'dist/cli-cjs.js',
	    format: 'cjs'
	  },
	  {
	    file: 'dist/cli-es6.js',
	    format: 'es'
	  },
	  {
	    file: 'dist/cli-umd.js',
	    name: 'jison-cli',
	    format: 'umd'
	  }
  ],
  plugins: [
    resolve({
      // use "module" field for ES6 module if possible
      module: true, // Default: true

      // use "main" field or index.js, even if it's not an ES6 module
      // (needs to be converted from CommonJS to ES6
      // – see https://github.com/rollup/rollup-plugin-commonjs
      main: true,  // Default: true

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
    '@gerhobbelt/ast-util',
    '@gerhobbelt/json5',
    '@gerhobbelt/nomnom',
    '@gerhobbelt/prettier-miscellaneous',
    '@gerhobbelt/recast',
    '@gerhobbelt/xregexp',
    'jison-helpers-lib',
    'assert',
    'fs',
    'path',
    'process',
  ]
};
