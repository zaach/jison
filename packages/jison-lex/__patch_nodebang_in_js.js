
const globby = require('globby');
const fs = require('fs');

 
globby(['dist/cli*.js']).then(paths => {
	var count = 0;

    //console.log(paths);
    paths.forEach(path => {
    	var updated = false;

    	//console.log('path: ', path);

    	var src = fs.readFileSync(path, 'utf8');
    	src = "#!/usr/bin/env node\n\n\n" + src.replace(/^#![^\n]+/, '');
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

    console.log('\nUpdated', count, 'files\' CLI/node hash-bang');
});
