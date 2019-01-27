
const globby = require('globby');
const fs = require('fs');

function encode(str) {
    return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '$\\{')
    .trim();
}

var kernel = encode(fs.readFileSync('jison-lexer-kernel.js', 'utf8'))
    // strip header comment too:
    .replace(/^[^{]*/, '');

var errorClassCode = encode(fs.readFileSync('jison-lexer-error-code.js', 'utf8'));

globby(['regexp-lexer.js']).then(paths => {
    var count = 0;

    //console.log(paths);
    paths.forEach(path => {
        var updated = false;

        var src = fs.readFileSync(path, 'utf8');
        src = src
        .replace(/(\/\/ --- START lexer kernel ---)[^]+?(\/\/ --- END lexer kernel ---)/, function f(m, p1, p2) {
            return p1 + `
return \`${kernel}\`;
    ` + p2;
        })
        .replace(/(\/\/ --- START lexer error class ---)[^]+?(\/\/ --- END lexer error class ---)/, function f(m, p1, p2) {
            return p1 + `

var prelude = \`${errorClassCode}\`;

    ` + p2;
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

    console.log('\nUpdated', count, 'files\' lexer kernel core code.');
});
