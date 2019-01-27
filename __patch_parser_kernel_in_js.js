
const globby = require('globby');
const fs = require('fs');

function encode(str) {
    return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '$\\{')
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



// DIAGNOSTICS/DEBUGGING:
//
// set `test` to TRUE to help verify that all code chunks are properly detected and edited:
const test = false;


if (test) {
    kernel = 'kernel::xxxxxx';
    parseErrorCode = 'parseError::xxxxxx';
    errorClassCode = 'errorClass::xxxxxx';
    debugTraceCode = 'debugTrace::xxxxxx';
    commonJsMainCode = 'commonJsMain::xxxxxx';
    parserAPIs1Code = 'APIchunk::xxxxxx';
}



globby(['lib/jison.js']).then(paths => {
    var count = 0;
    var edit_cnt = 0;

    //console.log(paths);
    paths.forEach(path => {
        var updated = false;

        //console.log('path: ', path);

        var src = fs.readFileSync(path, 'utf8');
        var dst = src
        .replace(/(\/\/ --- START parser kernel ---)[^]+?(\/\/ --- END( of)? parser kernel ---)/, function f(m, p1, p2) {
            edit_cnt++;
            return p1 + `
parser.parse = \`
${kernel}
\`;
` + p2;
        })
        .replace(/(\/\/ --- START parser error class ---)[^]+?(\/\/ --- END( of)? parser error class ---)/, function f(m, p1, p2) {
            edit_cnt++;
            return p1 + `
    const prelude = \`
${errorClassCode}
\`;
    ` + p2;
        })
        .replace(/(const parseErrorSourceCode = `)[^]+?(\/\/ --- END( of)? parseErrorSourceCode chunk ---)/, function f(m, p1, p2) {
            edit_cnt++;
            return p1 + '\n' + parseErrorCode + '\n\`;\n' + p2;
        })
        .replace(/(const debugTraceSrc = `)[^]+?(\/\/ --- END( of)? debugTraceSrc chunk ---)/, function f(m, p1, p2) {
            edit_cnt++;
            return p1 + '\n' + debugTraceCode + '\n\`;\n' + p2;
        })
        .replace(/(const commonJsMain = `)[^]+?(\/\/ --- END( of)? commonJsMain chunk ---)/, function f(m, p1, p2) {
            edit_cnt++;
            return p1 + '\n' + commonJsMainCode + '\n\`;\n' + p2;
        })
        .replace(/(const define_parser_APIs_1 = `)[^]+?(\/\/ --- END( of)? define_parser_APIs_1 chunk ---)/, function f(m, p1, p2) {
            edit_cnt++;
            return p1 + '\n    ' + parserAPIs1Code + '\n\`;\n' + p2;
        });
        updated = (dst !== src);

        if (updated) {
            count++;
            console.log('updated: ', path);
            fs.writeFileSync(path, dst, {
                encoding: 'utf8',
                flags: 'w'
            });
        }
    });

    if (edit_cnt !== 6) {
        console.error('ERROR: unexpected number of edits: check jison.js and this patch tool\'s regexes, then fix them or this verification number:', edit_cnt);
        process.exit(1);
    }

    console.log('\nUpdated', count, 'files\' parser kernel core code.');
});
