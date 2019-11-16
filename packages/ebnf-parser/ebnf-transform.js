import parser from './transform-parser.js';
import XRegExp from '@gerhobbelt/xregexp';

//import assert from 'assert';

var devDebug = 0;

// WARNING: this regex MUST match the regex for `ID` in ebnf-parser::bnf.l jison language lexer spec! (`ID = [{ALPHA}]{ALNUM}*`)
//
// This is the base XRegExp ID regex used in many places; this should match the ID macro definition in the EBNF/BNF parser et al as well!
const ID_REGEX_BASE = '[\\p{Alphabetic}_][\\p{Alphabetic}_\\p{Number}]*';

// produce a unique production symbol.
// Use this to produce rule productions from transformed EBNF which are
// guaranteed not to collide with previously generated / already existing
// rules (~ symbols).
function generateUniqueSymbol(id, postfix, opts) {
    var sym = id + postfix;
    if (opts.grammar[sym]) {
        var i = 2;              // the first occurrence won't have a number, this is already a collision, so start numbering at *2*.
        do {
            sym = id + postfix + i;
            i++;
        } while (opts.grammar[sym]);
    }
    return sym;
}

function generatePushAction(handle, offset) {
    var terms = handle.terms;
    var rv = [];

    for (var i = 0, len = terms.length; i < len; i++) {
        rv.push('$' + (i + offset));
    }
    rv = rv.join(', ');
    // and make sure we contain a term series unambiguously, i.e. anything more complex than
    // a single term inside an EBNF check is produced as an array so we can differentiate
    // between */+/? EBNF operator results and groups of tokens per individual match.
    if (len > 1) {
        rv = '[' + rv + ']';
    }
    return rv;
}

function transformExpression(e, opts, emit) {
    var type = e[0],
        value = e[1],
        name = false,
        has_transformed = 0;
    var list, n;

    if (type === 'xalias') {
        type = e[1];
        value = e[2];
        name = e[3];
        if (type) {
            e = e.slice(1);
        } else {
            e = value;
            type = e[0];
            value = e[1];
        }
        if (devDebug > 3) console.log('xalias: ', e, type, value, name);
    }

    if (type === 'symbol') {
        n = e[1];
        if (devDebug > 2) console.log('symbol EMIT: ', n + (name ? '[' + name + ']' : ''));
        emit(n + (name ? '[' + name + ']' : ''));
    } else if (type === '+') {
        if (!name) {
            name = generateUniqueSymbol(opts.production, '_repetition_plus', opts);
        }
        if (devDebug > 2) console.log('+ EMIT name: ', name);
        emit(name);

        has_transformed = 1;

        opts = optsForProduction(name, opts.grammar);
        list = transformExpressionList([value], opts);
        opts.grammar[name] = [
            [
                list.fragment,
                '$$ = [' + generatePushAction(list, 1) + '];'
            ],
            [
                name + ' ' + list.fragment,
                '$1.push(' + generatePushAction(list, 2) + ');\n$$ = $1;'
            ]
        ];
    } else if (type === '*') {
        if (!name) {
            name = generateUniqueSymbol(opts.production, '_repetition', opts);
        }
        if (devDebug > 2) console.log('* EMIT name: ', name);
        emit(name);

        has_transformed = 1;

        opts = optsForProduction(name, opts.grammar);
        list = transformExpressionList([value], opts);
        opts.grammar[name] = [
            [
                '',
                '$$ = [];'
            ],
            [
                name + ' ' + list.fragment,
                '$1.push(' + generatePushAction(list, 2) + ');\n$$ = $1;'
            ]
        ];
    } else if (type === '?') {
        if (!name) {
            name = generateUniqueSymbol(opts.production, '_option', opts);
        }
        if (devDebug > 2) console.log('? EMIT name: ', name);
        emit(name);

        has_transformed = 1;

        opts = optsForProduction(name, opts.grammar);
        list = transformExpressionList([value], opts);
        // you want to be able to check if 0 or 1 occurrences were recognized: since jison
        // by default *copies* the lexer token value, i.e. `$$ = $1` is the (optional) default action,
        // we will need to set the action up explicitly in case of the 0-count match:
        // `$$ = undefined`.
        //
        // Note that we MUST return an array as the
        // '1 occurrence' match CAN carry multiple terms, e.g. in constructs like
        // `(T T T)?`, which would otherwise be unrecognizable from the `T*` construct.
        opts.grammar[name] = [
            [
                '',
                '$$ = undefined;'
            ],
            [
                list.fragment,
                '$$ = ' + generatePushAction(list, 1) + ';'
            ]
        ];
    } else if (type === '()') {
        if (value.length === 1 && !name) {
            list = transformExpressionList(value[0], opts);
            if (list.first_transformed_term_index) {
                has_transformed = list.first_transformed_term_index;
            }
            if (devDebug > 2) console.log('group EMIT len=1: ', list);
            emit(list);
        } else {
            if (!name) {
                name = generateUniqueSymbol(opts.production, '_group', opts);
            }
            if (devDebug > 2) console.log('group EMIT name: ', name);
            emit(name);

            has_transformed = 1;

            opts = optsForProduction(name, opts.grammar);
            opts.grammar[name] = value.map(function (handle) {
                var list = transformExpressionList(handle, opts);
                return [
                    list.fragment,
                    '$$ = ' + generatePushAction(list, 1) + ';'
                ];
            });
        }
    }

    return has_transformed;
}

function transformExpressionList(list, opts) {
    var first_transformed_term_index = false;
    var terms = list.reduce(function (tot, e) {
        var ci = tot.length;

        var has_transformed = transformExpression(e, opts, function (name) {
            if (name.terms) {
                tot.push.apply(tot, name.terms);
            } else {
                tot.push(name);
            }
        });

        if (has_transformed) {
            first_transformed_term_index = ci + has_transformed;
        }
        return tot;
    }, []);

    return {
        fragment: terms.join(' '),
        terms: terms,
        first_transformed_term_index: first_transformed_term_index              // 1-based index
    };
}

function optsForProduction(id, grammar) {
    return {
        production: id,
        grammar: grammar
    };
}

function transformProduction(id, production, grammar) {
    var transform_opts = optsForProduction(id, grammar);
    return production.map(function (handle) {
        var action = null,
            opts = null;
        var i, len, n;

        if (typeof handle !== 'string') {
            action = handle[1];
            opts = handle[2];
            handle = handle[0];
        }
        var expressions = handle;
        if (typeof expressions === 'string') {
            expressions = parser.parse(handle);
        }

        if (devDebug > 1) console.log('\n================\nEBNF transform expressions:\n ', handle, opts, JSON.stringify(expressions, null, 2));

        var list = transformExpressionList(expressions, transform_opts);

        var ret = [list.fragment];
        if (action) {
            // make sure the action doesn't address any inner items.
            if (list.first_transformed_term_index) {
                var rhs = list.fragment;
                // seek out all names and aliases; strip out literal tokens first as those cannot serve as $names:
                var alist = list.terms; // rhs.replace(/'[^']+'/g, '~').replace(/"[^"]+"/g, '~').split(' ');
                // we also know at which index the first transformation occurred:
                var first_index = list.first_transformed_term_index - 1;
                if (devDebug > 2) console.log('alist ~ rhs rule terms: ', alist, rhs);

                var alias_re = new XRegExp(`\\[${ID_REGEX_BASE}\\]`);
                var term_re = new XRegExp(`^${ID_REGEX_BASE}$`);
                // and collect the PERMITTED aliases: the names of the terms and all the remaining aliases
                var good_aliases = {};
                var alias_cnt = {};
                var donotalias = {};

                // WARNING: this replicates the knowledge/code of jison.js::addName()
                var addName = function addNameEBNF(s, i) {
                    var base = s.replace(/[0-9]+$/, '');
                    var dna = donotalias[base];

                    if (good_aliases[s]) {
                        alias_cnt[s]++;
                        if (!dna) {
                            good_aliases[s + alias_cnt[s]] = i + 1;
                            alias_cnt[s + alias_cnt[s]] = 1;
                        }
                    } else {
                        good_aliases[s] = i + 1;
                        alias_cnt[s] = 1;
                        if (!dna) {
                            good_aliases[s + alias_cnt[s]] = i + 1;
                            alias_cnt[s + alias_cnt[s]] = 1;
                        }
                    }
                };

                // WARNING: this replicates the knowledge/code of jison.js::markBasename()
                var markBasename = function markBasenameEBNF(s) {
                    if (/[0-9]$/.test(s)) {
                        s = s.replace(/[0-9]+$/, '');
                        donotalias[s] = true;
                    }
                };

                // mark both regular and aliased names, e.g., `id[alias1]` and `id1`
                //
                // WARNING: this replicates the knowledge/code of jison.js::markBasename()+addName() usage
                for (i = 0, len = alist.length; i < len; i++) {
                    var term = alist[i];
                    var alias = term.match(alias_re);
                    if (alias) {
                        markBasename(alias[0].substr(1, alias[0].length - 2));
                        term = term.replace(alias_re, '');
                    }
                    if (term.match(term_re)) {
                        markBasename(term);
                    }
                }
                // then check & register both regular and aliased names, e.g., `id[alias1]` and `id1`
                for (i = 0, len = alist.length; i < len; i++) {
                    var term = alist[i];
                    var alias = term.match(alias_re);
                    if (alias) {
                        addName(alias[0].substr(1, alias[0].length - 2), i);
                        term = term.replace(alias_re, '');
                    }
                    if (term.match(term_re)) {
                        addName(term, i);
                    }
                }
                if (devDebug > 2) console.log('good_aliases: ', {
                    donotalias: donotalias,
                    good_aliases: good_aliases,
                    alias_cnt: alias_cnt,
                });

                // now scan the action for all named and numeric semantic values ($nonterminal / $1 / @1, ##1, ...)
                //
                // Note that `#name` are straight **static** symbol translations, which are okay as they don't
                // require access to the parse stack: `#n` references can be resolved completely 
                // at grammar compile time.
                //
                var nameref_re = new XRegExp(`(?:[$@]|##)${ID_REGEX_BASE}`, 'g');
                var named_spots = nameref_re.exec(action);
                var numbered_spots = action.match(/(?:[$@]|##)[0-9]+\b/g);
                var max_term_index = list.terms.length;
                if (devDebug > 2) console.log('ACTION named_spots: ', named_spots);
                if (devDebug > 2) console.log('ACTION numbered_spots: ', numbered_spots);

                // loop through the XRegExp alias regex matches in `action`
                while (named_spots) {
                    n = named_spots[0].replace(/^(?:[$@]|##)/, '');
                    if (!good_aliases[n]) {
                        throw new Error('The action block references the named alias "' + n + '" ' +
                                        'which is not available in production "' + handle + '"; ' +
                                        'it probably got removed by the EBNF rule rewrite process.\n' +
                                        'Be reminded that you cannot reference sub-elements within EBNF */+/? groups, ' +
                                        'only the outer-most EBNF group alias will remain available at all times ' +
                                        'due to the EBNF-to-BNF rewrite process.');
                    }

                    if (alias_cnt[n] !== 1) {
                        throw new Error('The action block references the ambiguous named alias or term reference "' + n + '" ' +
                                        'which is mentioned ' + alias_cnt[n] + ' times in production "' + handle + '", implicit and explicit aliases included.\n' +
                                        'You should either provide unambiguous = uniquely named aliases for these terms or use numeric index references (e.g. `$3`) as a stop-gap in your action code.\n' +
                                        'Be reminded that you cannot reference sub-elements within EBNF */+/? groups, ' +
                                        'only the outer-most EBNF group alias will remain available at all times ' +
                                        'due to the EBNF-to-BNF rewrite process.');
                    }
                    //assert(good_aliases[n] <= max_term_index, 'max term index');

                    named_spots = nameref_re.exec(action);
                }
                if (numbered_spots) {
                    for (i = 0, len = numbered_spots.length; i < len; i++) {
                        n = parseInt(numbered_spots[i].replace(/^(?:[$@]|##)/, ''));
                        if (n > max_term_index) {
                            /* @const */ var n_suffixes = [ 'st', 'nd', 'rd', 'th' ];
                            throw new Error('The action block references the ' + n + n_suffixes[Math.max(0, Math.min(3, n - 1))] + ' term, ' +
                                            'which is not available in production "' + handle + '"; ' +
                                            'Be reminded that you cannot reference sub-elements within EBNF */+/? groups, ' +
                                            'only the outer-most EBNF group alias will remain available at all times ' +
                                            'due to the EBNF-to-BNF rewrite process.');
                        }
                    }
                }
            }
            ret.push(action);
        }
        if (opts) {
            ret.push(opts);
        }
        if (devDebug > 1) console.log('\n\nEBNF tx result:\n ', JSON.stringify(list, null, 2), JSON.stringify(ret, null, 2));

        if (ret.length === 1) {
            return ret[0];
        } else {
            return ret;
        }
    });
};

var ref_list;
var ref_names;

// create a deep copy of the input, so we will keep the input constant.
function deepClone(from, sub) {
    if (sub == null) {
        ref_list = [];
        ref_names = [];
        sub = 'root';
    }
    if (typeof from === 'function') return from;
    if (from == null || typeof from !== 'object') return from;
    if (from.constructor !== Object && from.constructor !== Array) {
        return from;
    }

    var idx = ref_list.indexOf(from);
    if (idx >= 0) {
        throw new Error('[Circular/Xref:' + ref_names[i] + ']');   // circular or cross reference
    }
    ref_list.push(from);
    ref_names.push(sub);

    if (from.constructor === Array) {
        var to = from.slice();
        for (var i = 0, len = to.length; i < len; i++) {
            to[i] = deepClone(from[i], sub + '[' + i + ']');
        }
    } else {
        sub += '.';

        var to = new from.constructor();
        for (var name in from) {
            to[name] = deepClone(from[name], sub + name);
        }
    }
    return to;
}

function transformGrammar(grammar) {
    grammar = deepClone(grammar);

    Object.keys(grammar).forEach(function transformGrammarForKey(id) {
        grammar[id] = transformProduction(id, grammar[id], grammar);
    });

    return grammar;
};

function transform(ebnf) {
    if (devDebug > 0) console.log('EBNF:\n ', JSON.stringify(ebnf, null, 2));
    var rv = transformGrammar(ebnf);
    if (devDebug > 0) console.log('\n\nEBNF after transformation:\n ', JSON.stringify(rv, null, 2));

    return rv;
}

export default transform;

