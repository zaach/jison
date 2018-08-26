//
// Helper library for safe code execution/compilation
//
// MIT Licensed
//
//
// This code is intended to help test and diagnose arbitrary regexes, answering questions like this:
//
// - is this a valid regex, i.e. does it compile?
// - does it have captures, and if yes, how many?
//

//import XRegExp from '@gerhobbelt/xregexp';


// validate the given regex.
//
// You can specify an (advanced or regular) regex class as a third parameter.
// The default assumed is the standard JavaScript `RegExp` class.
//
// Return FALSE when there's no failure, otherwise return an `Error` info object.
function checkRegExp(re_src, re_flags, XRegExp) {
    var re;

    // were we fed a RegExp object or a string?
    if (re_src
        && typeof re_src.source === 'string'
        && typeof re_src.flags === 'string'
        && typeof re_src.toString === 'function'
        && typeof re_src.test === 'function'
        && typeof re_src.exec === 'function'
    ) {
        // we're looking at a RegExp (or XRegExp) object, so we can trust the `.source` member
        // and the `.toString()` method to produce something that's compileable by XRegExp
        // at least...
        if (!re_flags || re_flags === re_src.flags) {
            // no change of flags: we assume it's okay as it's already contained
            // in an RegExp or XRegExp object
            return false;
        }
    }
    // we DO accept empty regexes: `''` but we DO NOT accept null/undefined
    if (re_src == null) {
        return new Error('invalid regular expression source: ' + re_src);
    }

    re_src = '' + re_src;
    if (re_flags == null) {
        re_flags = undefined;       // `new RegExp(..., flags)` will barf a hairball when `flags===null`
    } else {
        re_flags = '' + re_flags;
    }

    XRegExp = XRegExp || RegExp;

    try {
        re = new XRegExp(re_src, re_flags);
    } catch (ex) {
        return ex;
    }
    return false;
}

// provide some info about the given regex.
//
// You can specify an (advanced or regular) regex class as a third parameter.
// The default assumed is the standard JavaScript `RegExp` class.
//
// Return FALSE when the input is not a legal regex.
function getRegExpInfo(re_src, re_flags, XRegExp) {
    var re1, re2, m1, m2;

    // were we fed a RegExp object or a string?
    if (re_src
        && typeof re_src.source === 'string'
        && typeof re_src.flags === 'string'
        && typeof re_src.toString === 'function'
        && typeof re_src.test === 'function'
        && typeof re_src.exec === 'function'
    ) {
        // we're looking at a RegExp (or XRegExp) object, so we can trust the `.source` member
        // and the `.toString()` method to produce something that's compileable by XRegExp
        // at least...
        if (!re_flags || re_flags === re_src.flags) {
            // no change of flags: we assume it's okay as it's already contained
            // in an RegExp or XRegExp object
            re_flags = undefined;
        }
    } else if (re_src == null) {
        // we DO NOT accept null/undefined
        return false;
    } else {
        re_src = '' + re_src;

        if (re_flags == null) {
            re_flags = undefined;       // `new RegExp(..., flags)` will barf a hairball when `flags===null`
        } else {
            re_flags = '' + re_flags;
        }
    }

    XRegExp = XRegExp || RegExp;

    try {
        // A little trick to obtain the captures from a regex:
        // wrap it and append `(?:)` to ensure it matches
        // the empty string, then match it against it to
        // obtain the `match` array.
        re1 = new XRegExp(re_src, re_flags);
        re2 = new XRegExp('(?:' + re_src + ')|(?:)', re_flags);
        m1 = re1.exec('');
        m2 = re2.exec('');
        return {
            acceptsEmptyString: !!m1,
            captureCount: m2.length - 1
        };
    } catch (ex) {
        return false;
    }
}








export default {
    checkRegExp: checkRegExp,
    getRegExpInfo: getRegExpInfo
};
