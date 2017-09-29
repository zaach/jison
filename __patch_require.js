//
// patch the require() statements in the javascript fed to us via STDIN
//

const getStdin = require('get-stdin');
 
getStdin().then(str => {
	const modules = "regexp-set-management regexp-lexer ebnf-parser ebnf-transform transform-parser lex-parser".split(' ');

	modules.forEach(function repl_module(name) {
		var re = new RegExp(`require\\([^)]*?${name}['"]\\)`, 'g');

		str = str
		.replace(re, `require('./${name}')`);

		return str;
	});

    console.log(str);
});

