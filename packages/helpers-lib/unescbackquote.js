
// unescape the escapes specific to a string value which is wrapped in backquotes
export default function unescBackQuote(str) {
    str = '' + str;
    var a = str.split('\\\\');
    a = a.map(function (s) {
        return s.replace(/\\`/g, '`');
    });
    str = a.join('\\\\');
    return str;
}

