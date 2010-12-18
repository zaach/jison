
// node
if (typeof process !== 'undefined') {

var fs = require('fs');
var sys = require('sys');

exports.p = sys.puts;
exports.cwd = process.cwd;
exports.join = require('path').join;
exports.basename = require('path').basename;
exports.args = process.argv.slice(1);
exports.exit = process.exit;
exports.resolve = require('url').resolve;

exports.read = function (fname) {
    return fs.readFileSync(fname, "utf8");
}

exports.write = function (fname, data) {
    fs.writeFileSync(fname, data);
}

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
}

exports.stdout = function (out) {
    process.stdout.write(out);
}

// commonjs/narwhal-like
} else {

var fs = require('file');
var system = require('system');

exports.p = print;
exports.cwd = fs.cwd;
exports.join = fs.join;
exports.basename = fs.basename;
exports.args = system.args.slice(0);
exports.exit = require('os').exit;
exports.resolve = fs.resolve;

exports.read = function (fname) {
    return fs.read(fname);
}

exports.write = function (fname, data) {
    fs.write(fname, data);
}

exports.stdin = function (cb) {
    cb(system.stdin.read());
}

exports.stdout = function (out) {
    system.stdout.print(out);
}

}
