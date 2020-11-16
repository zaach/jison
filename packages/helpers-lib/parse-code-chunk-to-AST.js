//
// Parse a given chunk of code to an AST.
//
// MIT Licensed
//
//
// This code is intended to help test and diagnose arbitrary chunks of code, answering questions like this:
//
// would the given code compile and possibly execute correctly, when included in a lexer, parser or other engine?
// 


//import unicode4IdStart from "unicode-4.0.0/Binary_Property/ID_Start/symbols.js";
import XRegExp from '@gerhobbelt/xregexp';
import recast from 'recast';
//import astUtils from 'ast-util';
import * as babel from '@babel/core';
import assert from 'assert';



assert(recast);
var types = recast.types;
assert(types);
var namedTypes = types.namedTypes;
assert(namedTypes);
var b = types.builders;
assert(b);
// //assert(astUtils);



// WARNING: this regex MUST match the regex for `ID` in ebnf-parser::bnf.l jison language lexer spec! (`ID = [{ALPHA}]{ALNUM}*`)
//
// This is the base XRegExp ID regex used in many places; this should match the ID macro definition in the EBNF/BNF parser et al as well!
const ID_REGEX_BASE = '[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*';
// regex set expression which can be used as part of a conditional check to find word/ID/token boundaries 
// as this lists all characters which are not allowed in an Identifier anywhere:
const IN_ID_CHARSET = '\\p{Alphabetic}_\\p{Number}';




// Determine which Unicode NonAsciiIdentifierStart characters 
// are unused in the given sourcecode and provide a mapping array
// from given (JISON) start/end identifier character-sequences
// to these.
// 
// The purpose of this routine is to deliver a reversible
// transform from JISON to plain JavaScript for any action
// code chunks. 
// 
// This is the basic building block which helps us convert
// jison variables such as `$id`, `$3`, `$-1` ('negative index' reference),
// `@id`, `#id`, `#TOK#` to variable names which can be
// parsed by a regular JavaScript parser such as esprima or babylon.
function generateMapper4JisonGrammarIdentifiers(input) {
    // IMPORTANT: we only want the single char Unicodes in here
    // so we can do this transformation at 'Char'-word rather than 'Code'-codepoint level.
    
    //const IdentifierStart = unicode4IdStart.filter((e) => e.codePointAt(0) < 0xFFFF);

    // As we will be 'encoding' the Jison Special characters @ and # into the IDStart Unicode 
    // range to make JavaScript parsers *not* barf a hairball on Jison action code chunks, we
    // must consider a few things while doing that:
    // 
    // We CAN use an escape system where we replace a single character with multiple characters,
    // as JavaScript DOES NOT discern between single characters and multi-character strings: anything
    // between quotes is a string and there's no such thing as C/C++/C#'s `'c'` vs `"c"` which is 
    // *character* 'c' vs *string* 'c'.
    // 
    // As we can safely escape characters, all we need to do is find a character (or set of characters)
    // which are in the ID_Start range and are expected to be used rarely while clearly identifyable
    // by humans for ease of debugging of the escaped intermediate values.
    // 
    // The escape scheme is simple and borrowed from ancient serial communication protocols and
    // the JavaScript string spec alike:
    // 
    // - assume the escape character is A
    // - then if the original input stream includes an A, we output AA
    // - if the original input includes a character #, which must be escaped, it is encoded/output as A
    // 
    // This is the same as the way the backslash escape in JavaScript strings works and has a minor issue:
    // sequences of AAA with an odd number of A's CAN occur in the output, which might be a little hard to read.
    // Those are, however, easily machine-decodable and that's what's most important here.
    // 
    // To help with that AAA... issue AND because we need to escape multiple Jison markers, we choose to 
    // a slightly tweaked approach: we are going to use a set of 2-char wide escape codes, where the
    // first character is fixed and the second character is chosen such that the escape code 
    // DOES NOT occur in the original input -- unless someone would have intentionally fed nasty input 
    // to the encoder as we will pick the 2 characters in the escape from 2 utterly different *human languages*:
    // 
    // - the first character is ဩ which is highly visible and allows us to quickly search through a 
    //   source to see if and where there are *any* Jison escapes.
    // - the second character is taken from the Unicode CANADIAN SYLLABICS range (0x1400-0x1670) as far as
    //   those are part of ID_Start (0x1401-0x166C or there-abouts) and, unless an attack is attempted at jison,
    //   we can be pretty sure that this 2-character sequence won't ever occur in real life: even when one
    //   writes such a escape in the comments to document this system, e.g. 'ဩᐅ', then there's still plenty
    //   alternatives for the second character left.
    // - the second character represents the escape type: $-n, $#, #n, @n, #ID#, etc. and each type will
    //   pick a different base shape from that CANADIAN SYLLABICS charset. 
    // - note that the trailing '#' in Jison's '#TOKEN#' escape will be escaped as a different code to 
    //   signal '#' as a token terminator there.
    // - meanwhile, only the initial character in the escape needs to be escaped if encountered in the
    //   original text: ဩ -> ဩဩ as the 2nd and 3rd character are only there to *augment* the escape.
    //   Any CANADIAN SYLLABICS in the original input don't need escaping, as these only have special meaning
    //   when prefixed with ဩ
    // - if the ဩ character is used often in the text, the alternative ℹ இ ண ஐ Ϟ ല ઊ characters MAY be considered 
    //   for the initial escape code, hence we start with analyzing the entire source input to see which
    //   escapes we'll come up with this time.
    //
    // The basic shapes are:
    // 
    // - 1401-141B:  ᐁ             1
    // - 142F-1448:  ᐯ             2
    // - 144C-1465:  ᑌ             3
    // - 146B-1482:  ᑫ             4
    // - 1489-14A0:  ᒉ             5  
    // - 14A3-14BA:  ᒣ             6 
    // - 14C0-14CF:  ᓀ             
    // - 14D3-14E9:  ᓓ             7
    // - 14ED-1504:  ᓭ             8
    // - 1510-1524:  ᔐ             9
    // - 1526-153D:  ᔦ 
    // - 1542-154F:  ᕂ
    // - 1553-155C:  ᕓ
    // - 155E-1569:  ᕞ
    // - 15B8-15C3:  ᖸ
    // - 15DC-15ED:  ᗜ            10
    // - 15F5-1600:  ᗵ
    // - 1614-1621:  ᘔ
    // - 1622-162D:  ᘢ
    //
    // ## JISON identifier formats ##
    // 
    // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
    //   These represent the token ID number.
    //   
    //   -> (1+2) start-# + end-#
    //   
    // - alias/token value references, e.g. `$token`, `$2`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - alias/token location reference, e.g. `@token`, `@2`
    // 
    //   -> (6) single-@
    // 
    // - alias/token id numbers, e.g. `#token`, `#2`
    // 
    //   -> (3) single-#
    // 
    // - alias/token stack indexes, e.g. `##token`, `##2`
    // 
    //   -> (4) double-#
    // 
    // - result value reference `$$`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - result location reference `@$`
    // 
    //   -> (6) single-@
    // 
    // - rule id number `#$`
    // 
    //   -> (3) single-#
    //   
    // - result stack index `##$`
    // 
    //   -> (4) double-#
    // 
    // - 'negative index' value references, e.g. `$-2`
    // 
    //   -> (8) single-negative-$
    //   
    // - 'negative index' location reference, e.g. `@-2`
    // 
    //   -> (7) single-negative-@
    //   
    // - 'negative index' stack indexes, e.g. `##-2`
    // 
    //   -> (5) double-negative-#
    // 
    
    // count the number of occurrences of ch in src:
    // 
    // function countOccurrences(ch, src) {
    //     let cnt = 0;
    //     let offset = 0;
    //     for (;;) {
    //         let pos = src.indexOf(ch, offset);
    //         if (pos === -1) {
    //             return cnt;
    //         }
    //         cnt++;
    //         offset = pos + 1;
    //     }
    // }
    function countOccurrences(ch, src) {
        let i = ch.codePointAt(0);
        return hash[i] || 0;
    }

    // pick an infrequent occurring character from the given `set`.
    // Preferrably has ZERO occurrences in the given `input`, but otherwise
    // deliver the one with the least number of occurrences.
    function pickChar(set, input) {
        // strip out the spaces:
        set = set.replace(/\s+/g, '');

        assert(set.length >= 1);
        let lsidx = 0;
        let lsfreq = Infinity;
        for (let i = 0, l = set.length; i < l; i++) {
            let ch = set[i];
            let freq = countOccurrences(ch, input);
            if (freq === 0) {
                return ch;
            }
            if (freq < lsfreq) {
                lsfreq = freq;
                lsidx = i;
            }
        }
        return set[lsidx];
    }

    const escCharSet = "ဩ ℹ இ ண ஐ Ϟ ല ઊ";

    // Currently we only need 7 rows of typeIdCharSets. The other rows are commented out but available for future use:
    const typeIdCharSets = [
        "ᐁ  ᐂ  ᐃ  ᐄ  ᐅ  ᐆ  ᐇ  ᐈ  ᐉ  ᐊ  ᐋ  ᐌ  ᐍ  ᐎ  ᐏ  ᐐ  ᐑ  ᐒ  ᐓ  ᐔ  ᐕ  ᐖ  ᐗ  ᐘ  ᐙ  ᐚ  ᐛ  ᐫ  ᐬ  ᐭ  ᐮ",
        //"ᐯ  ᐰ  ᐱ  ᐲ  ᐳ  ᐴ  ᐵ  ᐶ  ᐷ  ᐸ  ᐹ  ᐺ  ᐻ  ᐼ  ᐽ  ᐾ  ᐿ  ᑀ  ᑁ  ᑂ  ᑃ  ᑄ  ᑅ  ᑆ  ᑇ  ᑈ",
        "ᑌ  ᑍ  ᑎ  ᑏ  ᑐ  ᑑ  ᑒ  ᑓ  ᑔ  ᑕ  ᑖ  ᑗ  ᑘ  ᑙ  ᑚ  ᑛ  ᑜ  ᑝ  ᑞ  ᑟ  ᑠ  ᑡ  ᑢ  ᑣ  ᑤ  ᑥ  ᑧ  ᑨ  ᑩ  ᑪ",
        "ᑫ  ᑬ  ᑭ  ᑮ  ᑯ  ᑰ  ᑱ  ᑲ  ᑳ  ᑴ  ᑵ  ᑶ  ᑷ  ᑸ  ᑹ  ᑺ  ᑻ  ᑼ  ᑽ  ᑾ  ᑿ  ᒀ  ᒁ  ᒂ  ᒅ  ᒆ  ᒇ  ᒈ",
        //"ᒉ  ᒊ  ᒋ  ᒌ  ᒍ  ᒎ  ᒏ  ᒐ  ᒑ  ᒒ  ᒓ  ᒔ  ᒕ  ᒖ  ᒗ  ᒘ  ᒙ  ᒚ  ᒛ  ᒜ  ᒝ  ᒞ  ᒟ  ᒠ",
        //"ᒣ  ᒤ  ᒥ  ᒦ  ᒧ  ᒨ  ᒩ  ᒪ  ᒫ  ᒬ  ᒭ  ᒮ  ᒯ  ᒰ  ᒱ  ᒲ  ᒳ  ᒴ  ᒵ  ᒶ  ᒷ  ᒸ  ᒹ  ᒺ",
        //"ᓓ  ᓔ  ᓕ  ᓖ  ᓗ  ᓘ  ᓙ  ᓚ  ᓛ  ᓜ  ᓝ  ᓞ  ᓟ  ᓠ  ᓡ  ᓢ  ᓣ  ᓤ  ᓥ  ᓦ  ᓧ  ᓨ  ᓩ",
        //"ᓭ  ᓮ  ᓯ  ᓰ  ᓱ  ᓲ  ᓳ  ᓴ  ᓵ  ᓶ  ᓷ  ᓸ  ᓹ  ᓺ  ᓻ  ᓼ  ᓽ  ᓾ  ᓿ  ᔀ  ᔁ  ᔂ  ᔃ  ᔄ",
        //"ᔐ  ᔑ  ᔒ  ᔓ  ᔔ  ᔕ  ᔖ  ᔗ  ᔘ  ᔙ  ᔚ  ᔛ  ᔜ  ᔝ  ᔞ  ᔟ  ᔠ  ᔡ  ᔢ  ᔣ  ᔤ",
        "ᔦ  ᔧ  ᔨ  ᔩ  ᔪ  ᔫ  ᔬ  ᔭ  ᔮ  ᔯ  ᔰ  ᔱ  ᔲ  ᔳ  ᔴ  ᔵ  ᔶ  ᔷ  ᔸ  ᔹ  ᔺ  ᔻ  ᔼ  ᔽ",
        //"ᓀ  ᓁ  ᓂ  ᓃ  ᓄ  ᓅ  ᓆ  ᓇ  ᓈ  ᓉ  ᓊ  ᓋ  ᓌ  ᓍ  ᓎ  ᓏ",
        //"ᕂ  ᕃ  ᕄ  ᕅ  ᕆ  ᕇ  ᕈ  ᕉ  ᕊ  ᕋ  ᕌ  ᕍ  ᕎ  ᕏ",
        //"ᕞ  ᕟ  ᕠ  ᕡ  ᕢ  ᕣ  ᕤ  ᕥ  ᕦ  ᕧ  ᕨ  ᕩ",
        //"ᖸ  ᖹ  ᖺ  ᖻ  ᖼ  ᖽ  ᖾ  ᖿ  ᗀ  ᗁ  ᗂ  ᗃ",
        "ᗜ  ᗝ  ᗞ  ᗟ  ᗠ  ᗡ  ᗢ  ᗣ  ᗤ  ᗥ  ᗦ  ᗧ  ᗨ  ᗩ  ᗪ  ᗫ  ᗬ  ᗭ",
        //"ᗯ  ᗰ  ᗱ  ᗲ  ᗳ  ᗴ  ᗵ  ᗶ  ᗷ  ᗸ  ᗹ  ᗺ  ᗻ  ᗼ  ᗽ  ᗾ  ᗿ  ᘀ",
        "ᘔ  ᘕ  ᘖ  ᘗ  ᘘ  ᘙ  ᘚ  ᘛ  ᘜ  ᘝ  ᘞ  ᘟ  ᘠ  ᘡ",
        //"ᘢ  ᘣ  ᘤ  ᘥ  ᘦ  ᘧ  ᘨ  ᘩ  ᘪ  ᘫ  ᘬ  ᘭ  ᘴ  ᘵ  ᘶ  ᘷ  ᘸ  ᘹ",
        //"ᕓ  ᕔ  ᕕ  ᕖ  ᕗ  ᕘ  ᕙ  ᕚ  ᕛ  ᕜ",
        "ᗄ  ᗅ  ᗆ  ᗇ  ᗈ  ᗉ  ᗊ  ᗋ  ᗌ  ᗍ  ᗎ  ᗏ  ᗐ  ᗑ  ᗒ  ᗓ  ᗔ  ᗕ  ᗖ  ᗗ  ᗘ  ᗙ  ᗚ  ᗛ",
    ];

    //const I = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ';   // 1..12, but accepted as IdentifierStart in JavaScript :-) 

    // Probable speed improvement: scan a single time through the (probably large) input source,
    // looking for all characters in parallel, instead of scanning N times through there:
    // construct a regex to dig out all potential occurrences and take it from there.
    let reStr = escCharSet + typeIdCharSets.join("");
    reStr = reStr.replace(/\s+/g, '');
    const re = new RegExp(`[${reStr}]`, 'g');
    var hash = new Array(0xD800);
    let m;
    while ((m = re.exec(input)) !== null) {
        let i = m[0].codePointAt();
        hash[i] = (hash[i] || 0) + 1;
    }

    //
    // The basic shapes are:
    // 
    // - 1401-141B:  ᐁ             1
    // - 142F-1448:  ᐯ             2
    // - 144C-1465:  ᑌ             3
    // - 146B-1482:  ᑫ             4
    // - 1489-14A0:  ᒉ             5  
    // - 14A3-14BA:  ᒣ             6 
    // - 14C0-14CF:  ᓀ             
    // - 14D3-14E9:  ᓓ             7
    // - 14ED-1504:  ᓭ             8
    // - 1510-1524:  ᔐ             9
    // - 1526-153D:  ᔦ 
    // - 1542-154F:  ᕂ
    // - 1553-155C:  ᕓ
    // - 155E-1569:  ᕞ
    // - 15B8-15C3:  ᖸ
    // - 15DC-15ED:  ᗜ            10
    // - 15F5-1600:  ᗵ
    // - 1614-1621:  ᘔ
    // - 1622-162D:  ᘢ
    //
    // ## JISON identifier formats ##
    // 
    // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
    //   These represent the token ID number.
    //   
    //   -> (1+2) start-# + end-#
    //   
    // - alias/token value references, e.g. `$token`, `$2`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - alias/token location reference, e.g. `@token`, `@2`
    // 
    //   -> (6) single-@
    // 
    // - alias/token id numbers, e.g. `#token`, `#2`
    // 
    //   -> (3) single-#
    // 
    // - alias/token stack indexes, e.g. `##token`, `##2`
    // 
    //   -> (4) double-#
    // 
    // - result value reference `$$`
    // 
    //   -> $ is an accepted starter, so no encoding required
    // 
    // - result location reference `@$`
    // 
    //   -> (6) single-@
    // 
    // - rule id number `#$`
    // 
    //   -> (3) single-#
    //   
    // - result stack index `##$`
    // 
    //   -> (4) double-#
    // 
    // - 'negative index' value references, e.g. `$-2`
    // 
    //   -> (8) single-negative-$
    //   
    // - 'negative index' location reference, e.g. `@-2`
    // 
    //   -> (7) single-negative-@
    //   
    // - 'negative index' stack indexes, e.g. `##-2`
    // 
    //   -> (5) double-negative-#
    // 

    const escChar = pickChar(escCharSet, input);
    let typeIdChar = [];
    for (let i = 0, l = typeIdCharSets.length; i < l; i++) {
        typeIdChar[i] = pickChar(typeIdCharSets[i], input);
    }

    // produce a function set for encoding and decoding content, 
    // plus the basic strings to build regexes for matching the various jison
    // identifier types:
    return {
        // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
        //   These represent the token ID number.
        //   
        //   -> (1) start-#
        tokenDirectIdentifierStart: escChar + typeIdChar[0],
        tokenDirectIdentifierRe: new XRegExp(`#(${ID_REGEX_BASE})#`, 'g'),

        // - alias/token value references, e.g. `$token`, `$2`
        // 
        //   -> $ is an accepted starter, so no encoding required
        // - result value reference `$$`
        // 
        //   -> $ is an accepted starter, so no encoding required
        tokenValueReferenceStart: '$',
        tokenValueReferenceRe: new XRegExp(`$(${ID_REGEX_BASE})|$([0-9]+)`, 'g'),

        // - alias/token location reference, e.g. `@token`, `@2`
        // 
        //   -> (6) single-@
        // - result location reference `@$`
        // 
        //   -> (6) single-@
        tokenLocationStart: escChar + typeIdChar[1],
        tokenLocationRe: new XRegExp(`@(${ID_REGEX_BASE})|@([0-9]+)`, 'g'),

        // - alias/token id numbers, e.g. `#token`, `#2`
        // 
        //   -> (3) single-#
        // - rule id number `#$`
        // 
        //   -> (3) single-#
        tokenIdentifierStart: escChar + typeIdChar[2],
        tokenIdentifierRe: new XRegExp(`#(${ID_REGEX_BASE})|#([0-9]+)`, 'g'),
        
        // - alias/token stack indexes, e.g. `##token`, `##2`
        // 
        //   -> (4) double-#
        // - result stack index `##$`
        // 
        //   -> (4) double-#
        tokenStackIndexStart: escChar + typeIdChar[3],
        tokenStackIndexRe: new XRegExp(`##(${ID_REGEX_BASE})|##([0-9]+)`, 'g'),

        // - 'negative index' value references, e.g. `$-2`
        // 
        //   -> (8) single-negative-$
        tokenNegativeValueReferenceStart: escChar + typeIdChar[4],
        tokenValueReferenceRe: new XRegExp(`$-([0-9]+)`, 'g'),
           
        // - 'negative index' location reference, e.g. `@-2`
        // 
        //   -> (7) single-negative-@
        tokenNegativeLocationStart: escChar + typeIdChar[5],
        tokenNegativeLocationRe: new XRegExp(`@-([0-9]+)`, 'g'),
           
        // - 'negative index' stack indexes, e.g. `##-2`
        // 
        //   -> (5) double-negative-#
        tokenNegativeStackIndexStart: escChar + typeIdChar[6],
        tokenNegativeStackIndexRe: new XRegExp(`#-([0-9]+)`, 'g'),

        // combined regex for encoding direction
        tokenDetect4EncodeRe: new XRegExp(`([^$@#${IN_ID_CHARSET}])([$@#]|##)(${ID_REGEX_BASE}|[$]|-?[0-9]+)(#?)(?![$@#${IN_ID_CHARSET}])`, 'g'),

        // combined regex for decoding direction
        tokenDetect4DecodeRe: new XRegExp(`([^$${IN_ID_CHARSET}])(${escChar}[${typeIdChar.slice(0,7).join('')}])(${ID_REGEX_BASE}|[$]|[0-9]+)(?![$@#${IN_ID_CHARSET}])`, 'g'),

        encode: function encodeJisonTokens(src, locationOffsetSpec) {
            let re = this.tokenDetect4EncodeRe;

            // reset regex
            re.lastIndex = 0;            

            // patch `src` for the lookbehind emulation in the main regex used:
            src = ' ' + src;

            // Perform the encoding, one token at a time via callback function.
            // 
            // Note: all erroneous inputs are IGNORED as those MAY be part of a string
            // or comment, where they are perfectly legal.
            // This is a tad sub-optimal as we won't be able to report errors early 
            // but otherwise we would be rejecting some potentially *legal* action code
            // and we DO NOT want to be pedantically strict while we are unable to parse
            // the input very precisely yet.
            src = src.replace(re, (m, p1, p2, p3, p4, offset) => {
                // p1 is only serving as lookbehind emulation
                 
                switch (p2) {
                case '$':
                    // no encoding required UNLESS it's a negative index; p4 MUST be empty
                    if (p4 !== '') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3} cannot be followed by ${p4}`, src, offset + p1.length + p2.length + p3.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p3[0] === '-') {
                        return p1 + this.tokenNegativeValueReferenceStart + p3.substring(1);
                    }
                    return p1 + p2 + p3;

                case '##':
                    // p4 MUST be empty
                    if (p4 !== '') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3} cannot be followed by ${p4}`, src, offset + p1.length + p2.length + p3.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p3[0] === '-') {
                        return p1 + this.tokenNegativeStackIndexStart + p3.substring(1);
                    }
                    return p1 + this.tokenStackIndexStart + p3;

                case '@':
                    // p4 MUST be empty
                    if (p4 !== '') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3} cannot be followed by ${p4}`, src, offset + p1.length + p2.length + p3.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p3[0] === '-') {
                        return p1 + this.tokenNegativeLocationStart + p3.substring(1);
                    }
                    return p1 + this.tokenLocationStart + p3;

                case '#':
                    // p4 MAY be non-empty; p3 CANNOT be a negative value or token ID
                    if (p3[0] === '-') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3 + p4} is an illegal negative reference type`, src, offset + p1.length + p2.length);
                        }
                        return p1 + p2 +p3 + p4;
                    }
                    if (p4 !== '') {
                        return p1 + this.tokenDirectIdentifierStart + p3;
                    }
                    return p1 + this.tokenIdentifierStart + p3;

                // no default case needed as all possible matches are handled in the cases above.
                }
            });

            // and remove the added prefix which was used for lookbehind emulation:
            return src.substring(1);
        },

        decode: function decodeJisonTokens(src, locationOffsetSpec) {
            let re = this.tokenDetect4DecodeRe;

            // reset regex
            re.lastIndex = 0;            

            // patch `src` for the lookbehind emulation in the main regex used:
            src = ' ' + src;

            // Perform the encoding, one token at a time via callback function.
            // 
            // Note: all erroneous inputs are IGNORED as those MAY be part of a string
            // or comment, where they are perfectly legal.
            // This is a tad sub-optimal as we won't be able to report errors early 
            // but otherwise we would be rejecting some potentially *legal* action code
            // and we DO NOT want to be pedantically strict while we are unable to parse
            // the input very precisely yet.
            src = src.replace(re, (m, p1, p2, p3, offset) => {
                // p1 is only serving as lookbehind emulation
                
                switch (p2) {
                case this.tokenNegativeValueReferenceStart:
                    return p1 + "$-" + p3;

                case this.tokenNegativeStackIndexStart:
                    return p1 + "##-" + p3;

                case this.tokenStackIndexStart:
                    return p1 + "##" + p3;

                case this.tokenNegativeLocationStart:
                    return p1 + "@-" + p3;

                case this.tokenLocationStart:
                    return p1 + "@" + p3;

                case this.tokenDirectIdentifierStart:
                    // p3 CANNOT be a negative value or token ID
                    if (p3[0] === '-') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3 + p4} is an illegal negative reference type`, src, offset + p1.length + p2.length);
                        }
                        return p1 + p2 + p3;
                    }
                    return p1 + '#' + p3 + '#';

                case this.tokenIdentifierStart:
                    // p3 CANNOT be a negative value or token ID
                    if (p3[0] === '-') {
                        if (locationOffsetSpec) {
                            locationOffsetSpec.reportLocation(`syntax error: ${p2 + p3 + p4} is an illegal negative reference type`, src, offset + p1.length + p2.length);
                        }
                        return p1 + p2 + p3;
                    }
                    return p1 + '#' + p3;

                default:
                    if (locationOffsetSpec) {
                        locationOffsetSpec.reportLocation(`syntax error: unexpected jison token sentinel escape ${p2} at ${p2 + p3}`, src, offset + p1.length);
                    }
                    return p1 + p2 + p3;
                }
            });

            // and remove the added prefix which was used for lookbehind emulation:
            return src.substring(1);
        },
    };
}









function parseCodeChunkToAST(src, options) {
    let s = options.mapper4JisonGrammarIdentifiers.encode(src, options.mapperErrorReporter);
    let ast = recast.parse(s);
    return ast;
}


function compileCodeToES5(src, options) {
    options = Object.assign({}, {
      ast: true,
      code: true,
      sourceMaps: true,
      comments: true,
      filename: 'compileCodeToES5.js',
      sourceFileName: 'compileCodeToES5.js',
      sourceRoot: '.',
      sourceType: 'module',

      babelrc: false,
      
      ignore: [
        "node_modules/**/*.js"
      ],
      compact: false,
      retainLines: false,
      presets: [
        ["@babel/preset-env", {
          targets: {
            browsers: ["last 2 versions"],
            node: "8.0"
          }
        }]
      ]
    }, options);

    return babel.transformSync(src, options); // => { code, map, ast }
}


function prettyPrintAST(ast, options) {
    const defaultOptions = { 
        tabWidth: 2,
        quote: 'single',
        arrowParensAlways: true,

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        reuseWhitespace: false
    };

    let s = recast.prettyPrint(ast, defaultOptions);
    let new_src = s.code;

    new_src = new_src
    .replace(/\r\n|\n|\r/g, '\n');    // platform dependent EOL fixup

    // backpatch possible jison variables extant in the prettified code:
    let dst = options.mapper4JisonGrammarIdentifiers.decode(new_src, options.mapperErrorReporter);

    return dst;
}




// validate the given JISON+JavaScript snippet: does it compile?
// 
// Return either the parsed AST (object) or an error message (string). 
function checkActionBlock(src, yylloc, options) {
    // make sure reasonable line numbers, etc. are reported in any
    // potential parse errors by pushing the source code down:
    if (yylloc && yylloc.first_line > 0) {
        var cnt = yylloc.first_line;
        var lines = new Array(cnt);
        src = lines.join('\n') + src;
    } 
    if (!src.trim()) {
        return false;
    }

    try {
        var rv = parseCodeChunkToAST(src, options);
        return false;
    } catch (ex) {
        return ex.message || "code snippet cannot be parsed";
    }
}



// The rough-and-ready preprocessor for any action code block:
// this one trims off any surplus whitespace and removes any
// trailing semicolons and/or wrapping `{...}` braces,
// when such is easily possible *without having to actually
// **parse** the `src` code block in order to do this safely*.
// 
// Returns the trimmed sourcecode which was provided via `src`.
// 
// Note: the `startMarker` argument is special in that a lexer/parser
// can feed us the delimiter which started the code block here:
// when the starting delimiter actually is `{` we can safely
// remove the outer `{...}` wrapper (which then *will* be present!),
// while otherwise we may *not* do so as complex/specially-crafted
// code will fail when it was wrapped in other delimiters, e.g.
// action code specs like this one:
// 
//              %{
//                  {  // trimActionCode sees this one as outer-starting: WRONG
//                      a: 1
//                  };
//                  {
//                      b: 2
//                  }  // trimActionCode sees this one as outer-ending: WRONG
//              %}
//              
// Of course the example would be 'ludicrous' action code but the
// key point here is that users will certainly be able to come up with 
// convoluted code that is smarter than our simple regex-based
// `{...}` trimmer in here!
// 
function trimActionCode(src, startMarker) {
    var s = src.trim();
    // remove outermost set of braces UNLESS there's
    // a curly brace in there anywhere: in that case
    // we should leave it up to the sophisticated
    // code analyzer to simplify the code!
    //
    // This is a very rough check as it will also look
    // inside code comments, which should not have
    // any influence.
    //
    // Nevertheless: this is a *safe* transform as
    // long as the code doesn't end with a C++-style
    // comment which happens to contain that closing
    // curly brace at the end!
    //
    // Also DO strip off any trailing optional semicolon,
    // which might have ended up here due to lexer rules
    // like this one:
    //
    //     [a-z]+              -> 'TOKEN';
    //
    // We can safely ditch any trailing semicolon(s) as
    // our code generator reckons with JavaScript's
    // ASI rules (Automatic Semicolon Insertion).
    //
    //
    // TODO: make this is real code edit without that
    // last edge case as a fault condition.
    if (startMarker === '{') {
        // code is wrapped in `{...}` for sure: remove the wrapping braces.
        s = s.replace(/^\{([^]*?)\}$/, '$1').trim();
    } else {
        // code may not be wrapped or otherwise non-simple: only remove
        // wrapping braces when we can guarantee they're the only ones there,
        // i.e. only exist as outer wrapping.
        s = s.replace(/^\{([^}]*)\}$/, '$1').trim();
    }
    s = s.replace(/;+$/, '').trim();
    return s;
}





export default {
    generateMapper4JisonGrammarIdentifiers,
    parseCodeChunkToAST,
    compileCodeToES5,
    prettyPrintAST,
    checkActionBlock,
    trimActionCode,

    ID_REGEX_BASE,
    IN_ID_CHARSET,
};
