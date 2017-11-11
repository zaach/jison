
const globby = require('globby');
const fs = require('fs');

var kernel = fs.readFileSync('lib/jison-parser-kernel.js', 'utf8');
kernel = kernel
.replace(/\\/g, '\\\\')
.replace(/`/g, '\\`')
.trim();
 
var parseErrorCode = fs.readFileSync('lib/jison-parser-parseError-function.js', 'utf8');
parseErrorCode = parseErrorCode
.replace(/\\/g, '\\\\')
.replace(/`/g, '\\`')
.trim();
 
var errorClassCode = fs.readFileSync('lib/jison-parser-error-code.js', 'utf8');
errorClassCode = errorClassCode
.replace(/\\/g, '\\\\')
.replace(/`/g, '\\`')
.trim();
 
globby(['lib/jison.js']).then(paths => {
	var count = 0;

    //console.log(paths);
    paths.forEach(path => {
    	var updated = false;

    	//console.log('path: ', path);

    	var src = fs.readFileSync(path, 'utf8');
    	src = src
        .replace(/(\/\/ --- START parser kernel ---)[^]+?(\/\/ --- END parser kernel ---)/, function f(m, p1, p2) {
            return p1 + `
parser.parse = \`${kernel}\`;
` + p2;
        })
        .replace(/(\/\/ --- START parser error class ---)[^]+?(\/\/ --- END parser error class ---)/, function f(m, p1, p2) {
            return p1 + `

var prelude = \`${errorClassCode}\`;

    ` + p2;
        })
        .replace(/(const parseErrorSourceCode = `)[^]+?(\/\/ END of parseErrorSourceCode chunk)/, function f(m, p1, p2) {
            return p1 + '\n' + parseErrorCode + '\`;    ' + p2;
        });
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

    console.log('\nUpdated', count, 'files\' parser kernel core code.');
});
