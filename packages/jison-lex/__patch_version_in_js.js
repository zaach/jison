
// fetch the version from package.json and patch the specified files

const version = require('./package.json').version;
const globby = require('globby');
const fs = require('fs');

 
globby(['*lexer*.js', '*cli*.js']).then(paths => {
	var count = 0;

    //console.log(paths);
    paths.forEach(path => {
    	var updated = false;

    	//console.log('path: ', path);

    	var src = fs.readFileSync(path, 'utf8');
    	src = src.replace(/^(\s*var version = )([^;]+;)/gm, function repl(s, m1, m2) {
    		if (m2 !== "'" + version + "';") {
    			updated = true;
    		}
    		return m1 + "'" + version + "';";
    	});

    	if (updated) {
    		count++;
    		console.log('updated: ', path);
	    	fs.writeFileSync(path, src, {
                encoding: 'utf8',
                flags: 'w'
            });
	    }
    });

    console.log('\nUpdated', count, 'files\' version info to version', version);
});
