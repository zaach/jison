
const globby = require('globby');
const fs = require('fs');

function encode(str) {
    return str 
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .trim();
}

var kernel = encode(fs.readFileSync('lib/jison-parser-kernel.js', 'utf8'));
 
var parseErrorCode = encode(fs.readFileSync('lib/jison-parser-parseError-function.js', 'utf8'));
 
var errorClassCode = encode(fs.readFileSync('lib/jison-parser-error-code.js', 'utf8'));
 
var debugTraceCode = encode(fs.readFileSync('lib/jison-parser-debugTrace-function.js', 'utf8'));
 
var commonJsMainCode = encode(fs.readFileSync('lib/jison-parser-commonJsMain-function.js', 'utf8'));
 
var parserAPIs1Code = encode(fs.readFileSync('lib/jison-parser-API-section1.js', 'utf8'))
    .replace(/^[^{]*\{/, '')
    .replace(/\}[^\}]*$/, '')
    .trim();
 
globby(['lib/jison.js']).then(paths => {
	var count = 0;

    //console.log(paths);
    paths.forEach(path => {
    	var updated = false;

    	//console.log('path: ', path);

    	var src = fs.readFileSync(path, 'utf8');
    	var dst = src
        .replace(/(\/\/ --- START parser kernel ---)[^]+?(\/\/ --- END parser kernel ---)/, function f(m, p1, p2) {
            return p1 + `
parser.parse = \`${kernel}\`;
` + p2;
        })
        .replace(/(\/\/ --- START parser error class ---)[^]+?(\/\/ --- END parser error class ---)/, function f(m, p1, p2) {
            return p1 + `
    const prelude = \`
${errorClassCode}
\`;    ` + p2;
        })
        .replace(/(const parseErrorSourceCode = `)[^]+?(\/\/ END of parseErrorSourceCode chunk)/, function f(m, p1, p2) {
            return p1 + '\n' + parseErrorCode + '\`;    ' + p2;
        })
        .replace(/(const debugTraceSrc = `)[^]+?(\/\/ END of debugTraceSrc chunk)/, function f(m, p1, p2) {
            return p1 + '\n' + debugTraceCode + '\n\`;    ' + p2;
        })
        .replace(/(const commonJsMain = `)[^]+?(\/\/ END of commonJsMain chunk)/, function f(m, p1, p2) {
            return p1 + '\n' + commonJsMainCode + '\n\`;    ' + p2;
        })
        .replace(/(const define_parser_APIs_1 = `)[^]+?(\/\/ END of define_parser_APIs_1 chunk)/, function f(m, p1, p2) {
            return p1 + '\n    ' + parserAPIs1Code + '\n\`;    ' + p2;
        });
		updated = (dst !== src);

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
