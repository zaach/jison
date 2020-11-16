

// Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
/** @public */
export default function camelCase(s) {
    // Convert first character to lowercase
    return s.replace(/^\w/, function (match) {
        return match.toLowerCase();
    })
    .replace(/-\w/g, function (match) {
        var c = match.charAt(1);
        var rv = c.toUpperCase();
        // do not mutate 'a-2' to 'a2':
        if (c === rv && c.match(/\d/)) {
            return match;
        }
        return rv;
    })
}
