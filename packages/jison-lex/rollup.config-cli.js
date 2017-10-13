// rollup.config.js
export default {
  input: 'cli.js',
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
	    name: 'regexp-lexer',
	    format: 'umd'
	  }
  ]
};
