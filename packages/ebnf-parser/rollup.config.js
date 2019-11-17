// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

import base from '../../rollup.config-template.js';

export default Object.assign(base, {
  input: 'ebnf-parser.js',
  //treeshake: false,
  output: [
  	  {
	    file: 'dist/ebnf-parser-cjs.js',
	    format: 'cjs'
	  },
	  {
	    file: 'dist/ebnf-parser-es6.js',
	    format: 'es'
	  },
	  {
	    file: 'dist/ebnf-parser-umd.js',
	    name: 'ebnf-parser',
	    format: 'umd'
	  }
  ],
});

