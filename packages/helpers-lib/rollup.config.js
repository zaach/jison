// rollup.config.js
export default {
  input: 'index.js',
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
  ]
};
