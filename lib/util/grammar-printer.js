
// import Lexer from '../../packages/jison-lex';
// import ebnfParser from '../../packages/ebnf-parser';
// import lexParser from '../../packages/lex-parser';
// import XRegExp from '@gerhobbelt/xregexp';
// import recast from '@gerhobbelt/recast';
// import astUtils from '@gerhobbelt/ast-util';
// import prettier from '@gerhobbelt/prettier-miscellaneous';
import json5 from '@gerhobbelt/json5';
import helpers from '../../packages/helpers-lib';
var rmCommonWS = helpers.rmCommonWS;
var camelCase  = helpers.camelCase;
import assert from 'assert';


var devDebug = 0;


/**
 * Output the `raw` input (JSON format or plain STRING containing JSON-formatted data)
 * as JISON source file format in the returned string.
 *
 * @returns a string containing the file contents of an input-equivalent JISON parser/lexer source file.
 * @public
 */
function grammarPrinter(raw, options) {
    if (typeof raw !== 'object') {
        raw = json5.parse(raw);
    }
    options = options || {};
    options.showLexer = (options.showLexer !== undefined ? !!options.showLexer : true);
    options.showParser = (options.showParser !== undefined ? !!options.showParser : true);
    switch (String(options.format).toLowerCase()) {
    default:
    case 'jison':
        options.format = 'jison';
        break;

    case 'json5':
        options.format = 'json5';
        break;
        
    case '.y':
    case '.yacc':
        options.format = 'jison';
        options.showLexer = false;
        options.showParser = true;
        break;
        
    case '.l':
    case '.lex':
        options.format = 'jison';
        options.showLexer = true;
        options.showParser = false;
        break;
    }
    
    function isWord(key) {
        if (typeof key !== 'string') {
            return false;
        }
        if (!isWordStart(key[0])) {
            return false;
        }
        var i = 1, length = key.length;
        while (i < length) {
            if (!isWordChar(key[i])) {
                return false;
            }
            i++;
        }
        return true;
    }

    function makeIndent(num) {
        return (new Array(num + 1)).join(' ');
    }

    function padRight(str, num) {
        return str + (new Array(Math.max(0, num - str.length) + 1)).join(' ');
    }

    function indentAction(src, num) {
        // It's dangerous to indent an action code chunk as it MAY contain **template strings**
        // which MAY get corrupted that way as their actual content would change then!

        // construct fake nesting levels to arrive at the intended start indent value: `num`
        var nesting_levels = num / 2;
        var pre = '// **PRE**',
            post = '// **POST**';
        for ( ; nesting_levels > 0; nesting_levels--) {
            pre = 'function x() {\n' + pre;
            post += '\n}';
        }
        src = '\n' + pre + '\n' + src + '\n' + post + '\n';        

        var ast = helpers.parseCodeChunkToAST(src);
        var new_src = helpers.prettyPrintAST(ast);

        var start = new_src.indexOf('// **PRE**');
        var end = new_src.lastIndexOf('// **POST**');
        new_src = new_src
        .substring(start + 10, end)
        .trim();

        return new_src;
    }

    function isEmptyObj(obj) {
        var keys = obj && typeof obj === 'object' && Object.keys(obj);
        return keys && keys.length === 0;
    }

    function isEmptyArr(arr) {
        if (arr && arr instanceof Array) {
            for (var i = 0, len = arr.length; i < len; i++) {
                if (arr[i] !== undefined) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    // Copied from Crokford's implementation of JSON
    // See https://github.com/douglascrockford/JSON-js/blob/e39db4b7e6249f04a195e7dd0840e610cc9e941e/json2.js#L195
    // Begin
    var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        meta = { // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    };

    function escapeString(string) {
        // If the string contains no control characters, no quote characters, and no
        // backslash characters, then we can safely slap some quotes around it.
        // Otherwise we must also replace the offending characters with safe escape
        // sequences.
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ?
                c :
                '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }

    var ref_list;
    var ref_names;

    // create a deep copy of the input, so we can delete the parts we converted and dump the remainder
    // so that we always output the entire thing, even when we don't know all the details about the
    // actual input:
    function deepClone(from, sub) {
        if (sub == null) {
            ref_list = [];
            ref_names = [];
            sub = 'root';
        }
        if (typeof from === 'function') return '[Function]';
        if (from == null || typeof from !== 'object') return from;
        if (from.constructor !== Object && from.constructor !== Array) {
            return from;
        }

        for (var i = 0, len = ref_list.length; i < len; i++) {
            if (ref_list[i] === from) {
                return '[Circular/Xref:' + ref_names[i] + ']';   // circular or cross reference
            }
        }
        ref_list.push(from);
        ref_names.push(sub);
        sub += '.';

        var to = new from.constructor();
        for (var name in from) {
            to[name] = deepClone(from[name], sub + name);
        }
        return to;
    }


    var originalInput = raw;
    raw = deepClone(raw);

    var lex_out_str = '';
    if (raw.lex) {
        var lex_pre = [];
        var lex_rules = [];
        var lex_post = [];
        var key, src;

        src = raw.lex.macros;
        delete raw.lex.macros;
        if (src && !isEmptyObj(src)) {
            lex_pre.push(rmCommonWS`
                // macros:
            `);

            var keylen = 0;
            for (key in src) {
                keylen = Math.max(keylen, key.length);
            }
            console.log('macros keylen:', keylen);
            keylen = ((keylen / 4) | 0) * 4 + 4;
            console.log('macros keylen B:', keylen);
            for (key in src) {
                lex_pre.push(padRight(key, keylen) + src[key]);
            }

            lex_pre.push(rmCommonWS`
                // END of the lexer macros.
            `);
        }

        src = raw.lex.unknownDecls;
        delete raw.lex.unknownDecls;
        if (src && !isEmptyObj(src)) {
            lex_pre.push(rmCommonWS`
                // unknown declarations:
            `);

            for (var i = 0, len = src.length; i < len; i++) {
                var entry = src[i];
                var key = entry[0];
                var value = entry[1];

                lex_pre.push('%' + key + ' ' + value);
            }

            lex_pre.push(rmCommonWS`
                // END of unknown declarations.
            `);
        }

        src = raw.lex.options;
        delete raw.lex.options;
        if (src && !isEmptyObj(src)) {
            lex_pre.push(rmCommonWS`
                // options:
            `);

            for (key in src) {
                var value = src[key];
                if (value) {
                    lex_pre.push('%options ' + key + '=' + value);
                }
                else {
                    lex_pre.push('%options ' + key);
                }
            }
        }

        src = raw.lex.startConditions;
        delete raw.lex.startConditions;
        if (src && !isEmptyObj(src)) {
            for (key in src) {
                var value = src[key];

                lex_pre.push((value ? '%x ' : '%s ') + key);
            }
        }

        src = raw.lex.actionInclude;
        delete raw.lex.actionInclude;
        if (src && src.trim()) {
            lex_pre.push('%{\n' + indentAction(src.trim(), 4) + '\n%}');
        }

        src = raw.lex.rules;
        delete raw.lex.rules;
        if (src) {
            for (var i = 0, len = src.length; i < len; i++) {
                var entry = src[i];
                key = entry[0];
                var action = indentAction(entry[1], 4);

                var actionHasLF = /[\r\n]/.test(action);
                console.log('indented action:', {
                    entry: entry[1],
                    action,
                    actionHasLF
                });
                if (key.length <= 12) {
                    if (!actionHasLF) {
                        lex_rules.push(padRight(key, 16) + indentAction(action, 16));
                    }
                    else {
                        lex_rules.push(padRight(key, 16) + '%' + indentAction('{ ' + action + ' }', 16) + '%');
                    }
                }
                else {
                    if (!actionHasLF) {
                        lex_rules.push(key, makeIndent(16) + indentAction(action, 16));
                    }
                    else {
                        lex_rules.push(key, makeIndent(16) + '%' + indentAction('{ ' + action + ' }', 16) + '%');
                    }
                }
            }
        }

        src = raw.lex.moduleInclude;
        delete raw.lex.moduleInclude;
        if (src && src.trim()) {
            lex_post.push(indentAction(src.trim(), 0));
        }

        var out = '';

        if (!isEmptyObj(raw.lex)) {
            // dump the remainder as a comment:
            var rem = json5.stringify(raw.lex, null, 2);
            out += rmCommonWS`
                /*
                 * Lexer stuff that's unknown to the JISON prettyPrint service:
                 *
                 * ${rem.replace(/\*\//g, '*\\/')}
                 */
                
            `;
        }
        delete raw.lex;

        out += lex_pre.join('\n') + '\n\n';
        out += rmCommonWS`

            %%

        ` + lex_rules.join('\n') + '\n\n';
        if (lex_post.length > 0) {
            out += rmCommonWS`

                %%

            ` + lex_post.join('\n') + '\n\n';
        }
        lex_out_str = out;
    }

    var grammar_pre = [];
    var grammar_mid = [];
    var ebnf_rules = [];
    var bnf_rules = [];
    var grammar_post = [];
    var key, src;

    var fmtprod = function fmtprod(rule, prodset) {
        var backup = deepClone(prodset);

        rule += prodset[0] ? prodset[0] : '%epsilon';
        var prec = null;
        var lead = rule.split(/\r\n\|\n|\r/).pop();
        delete prodset[0];

        if (prodset.length === 3 && typeof prodset[2] === 'object') {
            prec = '%prec ' + prodset[2].prec;
            if (lead.length < 12) {
                rule += makeIndent(12 - lead.length);
            } 
            rule += '  ' + prec;

            delete prodset[2].prec;
            if (isEmptyObj(prodset[2])) {
                delete prodset[2];
            }
        }
        else if (prodset.length === 2 && typeof prodset[1] === 'object') {
            prec = '%prec ' + prodset[1].prec;
            if (lead.length < 12) {
                rule += makeIndent(12 - lead.length);
            } 
            rule += '  ' + prec;

            delete prodset[1].prec;
            if (isEmptyObj(prodset[1])) {
                delete prodset[1];
            }
        }
        if (typeof prodset[1] === 'string') {
            var action = prodset[1];
            if (lead.length < 12 - 1) {
                rule += makeIndent(12 - lead.length) + indentAction('{ ' + action + ' }', 12); 
            }
            else {
                rule += '\n' + makeIndent(12) + indentAction('{ ' + action + ' }', 12); 
            }
            delete prodset[1];
        }

        if (isEmptyArr(prodset)) {
            prodset.length = 0;
        }
        else {
            prodset = backup;
        }
        return rule;
    };

    var grammarfmt = function grammarfmt(src) {
        var key;
        var dst = [];

        for (key in src) {
            var prodset = src[key];
            var rule;
            console.log('format one rule:', {
                key, 
                prodset
            });

            if (typeof prodset === 'string') {
                rule = fmtprod(key + ' : ', [prodset]) + ';'; 
                delete src[key];
            }
            else if (prodset instanceof Array) {
                if (prodset.length === 1) {
                    if (typeof prodset[0] === 'string') {
                        rule = fmtprod(key + ' : ', [prodset]) + ';';
                        delete src[key];
                    }
                    else if (prodset[0] instanceof Array) {
                        rule = fmtprod(key + ' : ', prodset[0]);
                        rule += '\n    ;';
                        if (prodset[0].length === 0) {
                            delete src[key];
                        }
                    }
                    else {
                        rule = key + '\n    : **ERRONEOUS PRODUCTION** (see the dump for more): ' + prodset[0];
                    }
                }
                else if (prodset.length > 1) {
                    if (typeof prodset[0] === 'string') {
                        rule = fmtprod(key + '\n    : ', [prodset[0]]);
                        delete prodset[0];
                    }
                    else if (prodset[0] instanceof Array) {
                        rule = fmtprod(key + '\n    : ', prodset[0]);
                        if (prodset[0].length === 0) {
                            delete prodset[0];
                        }
                    }
                    else {
                        rule = key + '\n    : **ERRONEOUS PRODUCTION** (see the dump for more): ' + prodset[0];
                    }
                    for (var i = 1, len = prodset.length; i < len; i++) {
                        if (typeof prodset[i] === 'string') {
                            rule += fmtprod('\n    | ', [prodset[i]]);
                            delete prodset[i];
                        } 
                        else if (prodset[i] instanceof Array) {
                            rule += fmtprod('\n    | ', prodset[i]);
                            if (prodset[i].length === 0) {
                                delete prodset[i];
                            }
                        } 
                        else {
                            rule += '\n    | **ERRONEOUS PRODUCTION** (see the dump for more): ' + prodset[i];
                        }
                    }
                    rule += '\n    ;';

                    if (isEmptyArr(prodset)) {
                        delete src[key];
                    }
                }
            }
            else {
                rule = key + '\n    : **ERRONEOUS PRODUCTION** (see the dump for more): ' + prodset;
            }
            dst.push(rule);
        }

        return dst;
    };

    src = raw.ebnf;
    if (src) {
        ebnf_rules = grammarfmt(src);

        if (isEmptyObj(src)) {
            delete raw.ebnf;
        }
    }

    src = raw.bnf;
    //delete raw.bnf;
    if (src) {
        bnf_rules = grammarfmt(src);

        if (isEmptyObj(src)) {
            delete raw.bnf;
        }
    }

    src = raw.unknownDecls;
    delete raw.unknownDecls;
    if (src && !isEmptyObj(src)) {
        lex_pre.push(rmCommonWS`
            // unknown declarations:
        `);

        for (var i = 0, len = src.length; i < len; i++) {
            var entry = src[i];
            var key = entry[0];
            var value = entry[1];

            lex_pre.push('%' + key + ' ' + value);
        }

        lex_pre.push(rmCommonWS`
            // END of unknown declarations.
        `);
    }

    //src = raw.lex;
    //delete raw.lex;
    //if (src) {
    if (lex_out_str.trim() && options.showLexer) {
        grammar_pre.push(rmCommonWS`
            // ============================== START lexer section =========================== 
            
            %lex
            
            ${lex_out_str}

            /lex

            // ============================== END lexer section =============================

        `);
    }

    src = raw.options;
    delete raw.options;
    if (src && !isEmptyObj(src)) {
        var a = [];
        for (key in src) {
            var value = src[key];
            switch (key) {
            default:
                if (value !== true) {
                    a.push('options', '%options ' + key + '=' + value);
                }
                else {
                    a.push('options', '%options ' + key);
                }
                break;

            case 'ebnf':
                if (value) {
                    a.push(key, '%ebnf');
                }
                break;

            case 'type':
                if (value) {
                    a.push(key, '%parser-type ' + value);
                }
                break;

            case 'debug':
                if (typeof value !== 'boolean') {
                    a.push(key, '%debug ' + value);
                }
                else if (value) {
                    a.push(key, '%debug');
                }
                break;
            }
        }
        var type = null;
        for (var i = 0, len = a.length; i < len; i += 2) {
            var t = a[i];
            var line = a[i + 1];
            if (t !== type) {
                type = t;
                grammar_pre.push('');
            }
            grammar_pre.push(line);
        }
        grammar_pre.push('');
    }

    src = raw.imports;
    if (src) {
        var clean = true;
        for (var i = 0, len = src.length; i < len; i++) {
            var entry = src[i];

            grammar_pre.push('%import ' + entry.name + '  ' + entry.path);
            delete entry.name;
            delete entry.path;
            if (isEmptyObj(entry)) {
                delete src[i];
            }
            else {
                clean = false;
            } 
        }
        if (clean) {
            delete raw.imports;
        }
    }

    src = raw.moduleInit;
    if (src) {
        var clean = true;
        for (var i = 0, len = src.length; i < len; i++) {
            var entry = src[i];

            grammar_pre.push('%code ' + entry.qualifier + '  ' + entry.include);
            delete entry.qualifier;
            delete entry.include;
            if (isEmptyObj(entry)) {
                delete src[i];
            }
            else {
                clean = false;
            } 
        }
        if (clean) {
            delete raw.moduleInit;
        }
    }

    src = raw.operators;
    if (src) {
        var clean = true;
        for (var i = 0, len = src.length; i < len; i++) {
            var entry = src[i];
            var tokens = entry[1];
            var line = '%' + entry[0] + ' ';

            for (var t = 0, tlen = tokens.length; t < tlen; t++) {
                line += ' ' + tokens[t];
            }

            grammar_pre.push(line);

            if (entry.length === 2) {
                delete src[i];
            }
            else {
                clean = false;
            }
        }
        if (clean) {
            delete raw.operators;
        }
    }

    src = raw.extra_tokens;
    if (src) {
        var clean = true;
        for (var i = 0, len = src.length; i < len; i++) {
            var entry = src[i];
            var line = '%token ' + entry.id;
            
            if (entry.type) {
                line += ' <' + entry.type + '>';
                delete entry.type;
            }
            if (entry.value) {
                line += ' ' + entry.value;
                delete entry.value;
            }
            if (entry.description) {
                line += ' ' + escapeString(entry.description);
                delete entry.description;
            }

            grammar_pre.push(line);

            delete entry.id;
            if (isEmptyObj(entry)) {
                delete src[i];
            }
            else {
                clean = false;
            }
        }
        if (clean) {
            delete raw.extra_tokens;
        }
    }

    src = raw.parseParams;
    delete raw.parseParams;
    if (src) {
        grammar_pre.push('%parse-param ' + src.join(' '));
    }

    src = raw.start;
    delete raw.start;
    if (src) {
        grammar_pre.push('%start ' + src);
    }

    src = raw.moduleInclude;
    delete raw.moduleInclude;
    if (src && src.trim()) {
        grammar_post.push(indentAction(src.trim(), 0));
    }

    src = raw.actionInclude;
    delete raw.actionInclude;
    if (src && src.trim()) {
        grammar_mid.push('%{\n' + indentAction(src.trim(), 4) + '\n%}');
    }

    var out = '';

    if (!isEmptyObj(raw)) {
        // dump the remainder as a comment:
        var rem = json5.stringify(raw, null, 2);
        out += rmCommonWS`
            /*
             * Parser stuff that's unknown to the JISON prettyPrint service:
             *
             * ${rem.replace(/\*\//g, '*\\/')}
             */
            
        `;
        // delete raw;
    }

    if (!options.showParser) {
        out += lex_out_str;
    }
    else {
        out += grammar_pre.join('\n') + '\n\n';
        out += rmCommonWS`

            %%

        `;
        if (grammar_mid.length > 0) {
            out += grammar_mid.join('\n') + '\n\n';
        }
        if (ebnf_rules.length > 0) {
            if (bnf_rules.length > 0) {
                // dump the original EBNF grammar as source and dump the BNF derivative as COMMENT:
                var bnf_deriv = bnf_rules.join('\n\n');
                var a = bnf_deriv.split(/\r\n|\n|\r/).map(function (line) {
                    return '// ' + line;
                });

                out += rmCommonWS`
                    //
                    // JISON says:
                    //
                    // This is a EBNF grammar. The resulting **BNF** grammar has been
                    // reproduced here for your convenience:
                    //
                    // ---------------------------- START ---------------------------
                    ${a.join('\n')}
                    // ---------------------------- END OF BNF grammar --------------
                    //


                `;
            }
            out += ebnf_rules.join('\n\n') + '\n\n';
        }
        else if (bnf_rules.length > 0) {
            out += bnf_rules.join('\n\n') + '\n\n';
        }

        if (grammar_post.length > 0) {
            out += rmCommonWS`

                %%

            ` + grammar_post.join('\n') + '\n\n';
        }
    }

    if (options.format === 'json5') {
        var a = out.split(/\r\n|\n|\r/).map(function (line) {
            return '// ' + line;
        });

        out = rmCommonWS`
            //
            // JISON says:
            //
            // The JISON ${options.showParser ? 'grammar' : 'lexer'} has been
            // reproduced here for your convenience:
            //
            // ---------------------------- START ---------------------------
            ${a.join('\n')}
            // ---------------------------- END -----------------------------
            //

        `;

        // process the original input once again: this time via JSON5
        raw = deepClone(originalInput);

        if (!options.showLexer) {
            delete raw.lex;
            out += JSON5.stringify(raw, null, 2);
        }
        else if (!options.showParser) {
            out += JSON5.stringify(raw.lex, null, 2);
        }
    }

    return out;
}

export default grammarPrinter;
