// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

import base from './rollup.config-template.js';

export default Object.assign(base, {
  input: 'lib/cli.js',
  //treeshake: false,
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
});

