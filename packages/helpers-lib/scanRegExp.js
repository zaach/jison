
// Check if the start of the given input matches a regex expression.
// Return the length of the regex expression or -1 if none was found.
/** @public */
export default function scanRegExp(s) {
    s = '' + s;
    // code based on Esprima scanner: `Scanner.prototype.scanRegExpBody()`
    var index = 0;
    var length = s.length;
    var ch = s[index];
    //assert.assert(ch === '/', 'Regular expression literal must start with a slash');
    var str = s[index++];
    var classMarker = false;
    var terminated = false;
    while (index < length) {
        ch = s[index++];
        str += ch;
        if (ch === '\\') {
            ch = s[index++];
            // https://tc39.github.io/ecma262/#sec-literals-regular-expression-literals
            if (isLineTerminator(ch.charCodeAt(0))) {
                break;             // UnterminatedRegExp
            }
            str += ch;
        }
        else if (isLineTerminator(ch.charCodeAt(0))) {
            break;                 // UnterminatedRegExp
        }
        else if (classMarker) {
            if (ch === ']') {
                classMarker = false;
            }
        }
        else {
            if (ch === '/') {
                terminated = true;
                break;
            }
            else if (ch === '[') {
                classMarker = true;
            }
        }
    }
    if (!terminated) {
        return -1;                  // UnterminatedRegExp
    }
    return index;
}


// https://tc39.github.io/ecma262/#sec-line-terminators
function isLineTerminator(cp) {
    return (cp === 0x0A) || (cp === 0x0D) || (cp === 0x2028) || (cp === 0x2029);
}
