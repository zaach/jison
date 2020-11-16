// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

import base from './rollup.config-template.js';

export default Object.assign(base, {
  input: 'lib/jison.js',
  //treeshake: false,
  output: [
  	  {
	    file: 'dist/jison-cjs.js',
	    format: 'cjs'
	  },
	  {
	    file: 'dist/jison-es6.js',
	    format: 'es'
	  },
	  {
	    file: 'dist/jison-umd.js',
	    name: 'jison',
	    format: 'umd'
	  }
  ],
});

