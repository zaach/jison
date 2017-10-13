// rollup.config.js
export default {
  input: 'lex-parser.js',
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
  ]
};
