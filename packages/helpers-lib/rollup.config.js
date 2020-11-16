// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

import base from '../../rollup.config-template.js';

export default Object.assign(base, {
  input: 'index.js',
  //treeshake: false,
  output: [
  	  {
	    file: 'dist/helpers-lib-cjs.js',
	    format: 'cjs'
	  },
	  {
	    file: 'dist/helpers-lib-es6.js',
	    format: 'es'
	  },
	  {
	    file: 'dist/helpers-lib-umd.js',
	    name: 'jison-helpers-lib',
	    format: 'umd'
	  }
  ],
});

