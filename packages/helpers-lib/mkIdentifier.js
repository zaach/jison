
// Convert dashed option keys and other inputs to Camel Cased legal JavaScript identifiers
/** @public */
export default function mkIdentifier(s) {
    s = '' + s;
    return s
    // Convert dashed ids to Camel Case (though NOT lowercasing the initial letter though!), 
    // e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
    .replace(/-\w/g, function (match) {
        var c = match.charAt(1);
        var rv = c.toUpperCase();
        // do not mutate 'a-2' to 'a2':
        if (c === rv && c.match(/\d/)) {
            return match;
        }
        return rv;
    })
    // cleanup: replace any non-suitable character series to a single underscore:
    .replace(/^[^\w_]/, '_')
    // do not accept numerics at the leading position, despite those matching regex `\w`:
    .replace(/^\d/, '_')
    .replace(/[^\w\d_]/g, '_')
    // and only accept multiple (double, not triple) underscores at start or end of identifier name:
    .replace(/^__+/, '#')
    .replace(/__+$/, '#')
    .replace(/_+/g, '_')
    .replace(/#/g, '__');
}
