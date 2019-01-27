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


import recast from '@gerhobbelt/recast';
//import astUtils from '@gerhobbelt/ast-util';
import * as babel from '@babel/core';
import babelParser from '@gerhobbelt/babel-parser';
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



// used internally by mapMarkerChars2AvailableIdentifierStart 
var NAIScache;


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
function mapMarkerChars2AvailableIdentifierStart() {
    // ECMAScript 6/Unicode v10.0.0 NonAsciiIdentifierStart 
    // Ripped from esprima/recast source.
    // 
    // IMPORTANT: we only want the single char Unicodes in here
    // so we can do this transformation at 'Char'-word rather than 'Code'-codepoint level.
    const NonAsciiIdentifierStart = '\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2118-\u211D\u2124\u2126\u2128\u212A-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309B-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC';

    // convert the above string to something more usable for us:
    if (!NAIScache) {
        var spec = NonAsciiIdentifierStart.split('');
        var m = [];
        for (var i = 0, len = spec.length - 3; i < len; i++) {
            var c1 = spec[i];
            var c2 = spec[i + 1];
            if (c2 === '-') {
                c2 = spec[i + 2];
                i += 2;
                m.push([c1, c2]);
            } else {
                m.push(c1);
            }
        }

        NAIScache = {
            IdentifierChars: m,
            IdentifierStartRegex: new RegExp('[^' + NonAsciiIdentifierStart + '][' + NonAsciiIdentifierStart + ']', 'g'),
            IdentifierEndRegex: new RegExp('[' + NonAsciiIdentifierStart + '][^' + NonAsciiIdentifierStart + ']', 'g'),
        };
    }

    // We use an 'escape code' approach as sourcecode may contain any IdentifierStart Unicode character anyway
    // and we want to uniquely identify jison variables in both source code and parsed/compiled/rewritten AST:
    // 
    // For this we come up with a sequence which is expected to NOT occur in any sane sourcecode (as we combine
    // characters from quite different languages in a single variable name): any *malicious* sourcecode 
    // should be processed without trouble as well as we also provide a second escape sequence for those
    // malicious attempts to thwart us. :-)
    // 
    //  Encoding scheme, given sequences A1, A2, A3, A4, A5, A6 and B1: any input which already contains 
    //  any An or B1 gets those encoded as B1An and B1B1 respectively, while any jison identifier 
    //  characters ($, #, @, each with optional '-' dash plus digit immediately following it) get encoded 
    //  as A1..A6, depending on which jison variable prefix (or postfix) we find.
    //  This encoding schema is guaranteed reversible, which means we can apply the inverse transform once
    //  jison has generated code from the lexer/parser specs and action chunks fed to it.   
    const I = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ';   // 1..12, but accepted as IdentifierStart in JavaScript :-) 
    const As = 'ઊᖰᚬ'; 
    const Ae = 'ᛗᖳઊ';
    const B = 'ဏᏱⰂ ꄤꔷꔪꕇꕕꕥꕞꖅꖎꗇꗨꗰꗟ'; 


    // ## JISON identifier formats ##
    // 
    // - direct symbol references, e.g. `#NUMBER#` when there's a `%token NUMBER` for your grammar.
    //   These represent the token ID number.
    //   
    // - alias/token value references, e.g. `$token`, `$2`
    // 
    // - alias/token location reference, e.g. `@token`, `@2`
    // 
    // - alias/token id numbers, e.g. `#token`, `#2`
    // 
    // - alias/token stack indexes, e.g. `##token`, `##2`
    // 
    // - result value reference `$$`
    // 
    // - result location reference `@$`
    // 
    // - rule id number `#$`
    // 
    // - result stack index `##$`
    // 
    // - 'negative index' value references, e.g. `$-2`
    // 
    // - 'negative index' location reference, e.g. `@-2`
    // 
    // - 'negative index' stack indexes, e.g. `##-2`
    // 







        // if (action.match(new XRegExp(`(?:[$@#]|##)${ID_REGEX_BASE}`))) {



            // When the rule is fitted with aliases it doesn't mean that the action code MUST use those:
            // we therefor allow access to both the original (non)terminal and the alias.
            //
            // Also note that each (non)terminal can also be uniquely addressed by [$@]<nonterminal><N>
            // where N is a number representing the number of this particular occurrence of the given
            // (non)terminal.
            //
            // For example, given this (intentionally contrived) production:
            //     elem[alias] elem[another_alias] another_elem[alias] elem[alias] another_elem[another_alias]
            // all the items can be accessed as:
            //     $1 $2 $3 $4 $5
            //     $elem1 $elem2 $another_elem1 $elem3 $another_elem2
            //     $elem $elem2 $another_elem $elem3 $another_elem2
            //     $alias1 $another_alias1 $alias2 $alias3 $another_alias2
            //     $alias $another_alias $alias2 $alias3 $another_alias2
            // where each line above is equivalent to the top-most line. Note the numbers postfixed to
            // both (non)terminal identifiers and aliases alike and also note alias2 === another_elem1:
            // the postfix numbering is independent.
            //
            // WARNING: this feature is disabled for a term when there already exists an
            //          (human-defined) *alias* for this term *or* when the numbered auto-alias already
            //          exists because the user has used it as an alias for another term, e.g.
            //
            //             e: WORD[e1] '=' e '+' e;
            //
            //          would *not* produce the `e1` and `e2` aliases, as `e1` is already defined
            //          as an explicit alias: adding auto-alias `e1` would then break the system,
            //          while `e2` would be ambiguous from the human perspective as he *might* then
            //          expect `e2` and `e3`.
            var addName = function addName(s) {
                var base = s.replace(/[0-9]+$/, '');
                var dna = donotalias[base];

                if (names[s]) {
                    count[s]++;
                    if (!dna) {
                        names[s + count[s]] = i + 1;
                        count[s + count[s]] = 1;
                    }
                } else {
                    names[s] = i + 1;
                    count[s] = 1;
                    if (!dna) {
                        names[s + count[s]] = i + 1;
                        count[s + count[s]] = 1;
                    }
                }
            };

            // register the alias/rule name when the real one ends with a number, e.g. `rule5` as
            // *blocking* the auto-aliasing process for the term of the same base, e.g. `rule`.
            // This will catch the `WORD[e1]` example above too, via `e1` --> `donotalias['e']`
            var markBasename = function markBasename(s) {
                if (/[0-9]$/.test(s)) {
                    s = s.replace(/[0-9]+$/, '');
                    donotalias[s] = true;
                }
            };

            for (i = 0; i < rhs.length; i++) {
                // mark both regular and aliased names, e.g., `id[alias1]` and `id1`
                rhs_i = aliased[i];
                markBasename(rhs_i);
                if (rhs_i !== rhs[i]) {
                    markBasename(rhs[i]);
                }
            }

            for (i = 0; i < rhs.length; i++) {
                // check for aliased names, e.g., id[alias]
                rhs_i = aliased[i];
                addName(rhs_i);
                if (rhs_i !== rhs[i]) {
                    addName(rhs[i]);
                }
            }
            action = action.replace(
                new XRegExp(`([$@#]|##)(${ID_REGEX_BASE})`, 'g'), function (str, mrkr, pl) {
                    if (names[pl] && count[pl] !== 1) {
                        throw new Error(`The action block references the ambiguous named alias or term reference "${pl}" which is mentioned ${count[pl]} times in production "${handle.handle}", implicit and explicit aliases included.` +
                            '\nYou should either provide unambiguous = uniquely named aliases for these terms or use numeric index references (e.g. `$3`) as a stop-gap in your action code.');
                    }
                    return names[pl] ? mrkr + names[pl] : str;
                });




        action = action
            // replace references to `$$` with `this.$`, `@$` with `this._$` and `#$` with the token ID of the current rule
            .replace(/\$\$/g, 'this.$')
            .replace(/@\$/g, 'this._$')
            .replace(/#\$/g, function (_) {
                return provideSymbolAsSourcecode(symbol);
            })
            // replace semantic value references ($n) with stack value (stack[n])
            .replace(/\$(-?\d+)\b/g, function (_, n) {
                return 'yyvstack[yysp' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
            })
            // same as above for location references (@n)
            .replace(/@(-?\d+)\b/g, function (_, n) {
                return 'yylstack[yysp' + indexToJsExpr(n, rhs.length, rule4msg) + ']';
            })
            // same as above for positional value references (##n): these represent stack indexes
            .replace(/##(-?\d+)\b/g, function (_, n) {
                return '(yysp' + indexToJsExpr(n, rhs.length, rule4msg) + ')';
            })
            .replace(/##\$/g, function (_) {
                return 'yysp';
            })
            // same as above for token ID references (#n)
            .replace(/#(-?\d+)\b/g, function (_, n) {
                var i = parseInt(n, 10) - 1;
                if (!rhs[i]) {
                    throw new Error(`invalid token location reference in action code for rule: "${rule4msg}" - location reference: "${_}"`);
                }
                return provideSymbolAsSourcecode(rhs[i]);
            });

        // Now that the user action (if any) has been expanded to valid JavaScript code
        // (we're SOL and very probably looking at bugs in the user-written action code
        // if it is NOT VALID by now!) we can perform code analysis to see which,
        // if any, default actions have to be injected in the code snippet.
        //
        // The rules of the game are:
        // - when there's *use* of `$$` or `@$` *before* they are assigned a value,
        //   the corresponding default action is required.
        // - when there's *nothing* about (no use of, no assignment to) `$$` or `@$`
        //   then the corresponding default action should be injected IFF the
        //   code analysis flags have been set, i.e. only inject the default action
        //   when we already *know* that other parts of the parser state machine
        //   (other rules' actions!) *are* using these.
        //   We DO NOT include "flow analysis" so we cannot determine if
        //   *this particular* rule's values will be accessed; iff location tracking
        //   is used at all, we inject it everywhere. Ditto for value tracking.
        // - value tracking (`$$` et al) is considered *independently* from location
        //   tracking (`@$` et al): the one or the other may need the default
        //   actions for more-or-less sensible (or at least *deterministic*!) results
        //   and consequently should get them, indenpent of whether the user-written
        //   action code fuly addresses the other.
        //
        //   Generally, user actions concern themselves with assigning a value to `$$`,
        //   while not addressing `@$`: in that case, the location tracking default
        //   action `@$ = ...` will be injected in that action snippet.
        //
        //   Also note that, in order to prevent obscure failures due to analysis
        //   false positives, all default actions are injected *before* the user-written
        //   action code.
        //
        // Technical Note
        //
        // We perform the action code analysis *after* jison variable expansions are done
        // because we want the analysis to be *independent* of how the user wrote
        // the action code: if some Smart Alec decides to code `this.$` instead of
        // `$$` it SHOULD NOT confuse the code analysis here!

        var uses_$$ = analyzeFeatureUsage(action, /\bthis\.\$[^\w]/g, 0);   // use includes assignment, not just read accesses!



}









function parseCodeChunkToAST(src, options) {
    // src = src
    // .replace(/@/g, '\uFFDA')
    // .replace(/#/g, '\uFFDB')
    // ;
    var ast = recast.parse(src);
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
            browsers: ["last 2 versions", "safari >= 7"],
            node: "4.0"
          }
        }]
      ]
    }, options);

    return babel.transformSync(src, options); // => { code, map, ast }
}


function prettyPrintAST(ast, options) {
    var new_src;
    var options = options || {};
    const defaultOptions = { 
        tabWidth: 2,
        quote: 'single',
        arrowParensAlways: true,

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        reuseWhitespace: false
    };
    for (var key in defaultOptions) {
        if (options[key] === undefined) {
            options[key] = defaultOptions[key];
        }
    }

    var s = recast.prettyPrint(ast, { 
        tabWidth: 2,
        quote: 'single',
        arrowParensAlways: true,

        // Do not reuse whitespace (or anything else, for that matter)
        // when printing generically.
        reuseWhitespace: false
    });
    new_src = s.code;

    new_src = new_src
    .replace(/\r\n|\n|\r/g, '\n')    // platform dependent EOL fixup
    // // backpatch possible jison variables extant in the prettified code:
    // .replace(/\uFFDA/g, '@')
    // .replace(/\uFFDB/g, '#')
    ;

    return new_src;
}




// validate the given JISON+JavaScript snippet: does it compile?
// 
// Return either the parsed AST (object) or an error message (string). 
function checkActionBlock(src, yylloc) {
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
        var rv = parseCodeChunkToAST(src);
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
    parseCodeChunkToAST,
    compileCodeToES5,
    prettyPrintAST,
    checkActionBlock,
    trimActionCode,
};
