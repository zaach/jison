// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

import base from '../../rollup.config-template.js';

export default Object.assign(base, {
  input: 'regexp-lexer.js',
  //treeshake: false,
  output: [
  	  {
	    file: 'dist/regexp-lexer-cjs.js',
	    format: 'cjs'
	  },
	  {
	    file: 'dist/regexp-lexer-es6.js',
	    format: 'es'
	  },
	  {
	    file: 'dist/regexp-lexer-umd.js',
	    name: 'regexp-lexer',
	    format: 'umd'
	  }
  ],
});

