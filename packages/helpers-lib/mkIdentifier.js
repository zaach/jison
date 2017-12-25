

import camelCase from './camelCase';

// Convert dashed option keys and other inputs to Camel Cased legal JavaScript identifiers
/** @public */
export default function mkIdentifier(s) {
    s = camelCase('' + s);
    // cleanup: replace any non-suitable character series to a single underscore:
    return s
    .replace(/^[^\w_]/, '_')
    // do not accept numerics at the leading position, despite those matching regex `\w`:
    .replace(/^\d/, '_')
    .replace(/[^\w\d_]+/g, '_')
    // and only accept multiple (double, not triple) underscores at start or end of identifier name:
    .replace(/^__+/, '#')
    .replace(/__+$/, '#')
    .replace(/_+/g, '_')
    .replace(/#/g, '__');
}
