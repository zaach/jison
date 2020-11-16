// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

import base from '../../rollup.config-template.js';

export default Object.assign(base, {
  input: 'lex-parser.js',
  //treeshake: false,
  output: [
  	  {
	    file: 'dist/lex-parser-cjs.js',
	    format: 'cjs'
	  },
	  {
	    file: 'dist/lex-parser-es6.js',
	    format: 'es'
	  },
	  {
	    file: 'dist/lex-parser-umd.js',
	    name: 'lex-parser',
	    format: 'umd'
	  }
  ],
});

