

// Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'`
/** @public */
export default function camelCase(s) {
    // Convert first character to lowercase
    return s.replace(/^\w/, function (match) {
        return match.toLowerCase();
    })
    .replace(/-\w/g, function (match) {
        return match.charAt(1).toUpperCase();
    });
}
