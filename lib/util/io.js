
var fs = require('fs');
var util = require('util');

exports.p = util.puts;
exports.cwd = process.cwd;
exports.join = require('path').join;
exports.basename = require('path').basename;
exports.args = process.argv.slice(1);
exports.exit = process.exit;
exports.resolve = require('url').resolve;

exports.read = function (fname) {
    return fs.readFileSync(fname, "utf8");
};

exports.write = function (fname, data) {
    fs.writeFileSync(fname, data);
};

exports.stdin = function (cb) {
    var stdin = process.openStdin(),
        data = '';

    stdin.setEncoding('utf8');
    stdin.addListener('data', function (chunk) {
        data += chunk;
    });
    stdin.addListener('end', function () {
        cb(data);
    });
};

exports.stdout = function (out) {
    process.stdout.write(out);
};

