
// hack until jison properly supports the `%code imports %{...%}` feature:

const globby = require('globby');
const fs = require('fs');

const prelude = fs.readFileSync('ebnf-parser-prelude.js', 'utf8');
 
globby(['parser.js', 'transform-parser.js']).then(paths => {
	var count = 0;

    //console.log(paths);
    paths.forEach(path => {
    	var updated = false;

    	//console.log('path: ', path);

    	var src = fs.readFileSync(path, 'utf8');
    	src = prelude + src.replace(/^[^]+?\/\/ end of prelude/, '');
		updated = true;

    	if (updated) {
    		count++;
    		console.log('updated: ', path);
	    	fs.writeFileSync(path, src, {
                encoding: 'utf8',
                flags: 'w'
            });
	    }
    });

    console.log('\nUpdated', count, 'files\' prelude chunk');
});
