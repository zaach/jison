var EBNF = (function(){
    var parser = require('./transform-parser.js');
    //var assert = require('assert');

    var devDebug = 0;

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

    var transformExpression = function(e, opts, emit) {
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
            // if (e[1][0] === '\\') {
            //     n = e[1][1];
            // }
            // else if (e[1][0] === '\'') {
            //     n = e[1].substring(1, e[1].length - 1);
            // }
            // else if (e[1][0] === '"') {
            //     n = e[1].substring(1, e[1].length - 1);
            // }
            // else {
                n = e[1];
            // }
            if (devDebug > 2) console.log('symbol EMIT: ', n + (name ? '[' + name + ']' : ''));
            emit(n + (name ? '[' + name + ']' : ''));
        } else if (type === '+') {
            if (!name) {
                name = opts.production + '_repetition_plus' + opts.repid++;
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
                name = opts.production + '_repetition' + opts.repid++;
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
                name = opts.production + '_option' + opts.optid++;
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
            // `(T1 T2 T3)?`.
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
                    name = opts.production + '_group' + opts.groupid++;
                }
                if (devDebug > 2) console.log('group EMIT name: ', name);
                emit(name);

                has_transformed = 1;

                opts = optsForProduction(name, opts.grammar);
                opts.grammar[name] = value.map(function(handle) {
                    var list = transformExpressionList(handle, opts);
                    return [
                        list.fragment,
                        '$$ = ' + generatePushAction(list, 1) + ';'
                    ];
                });
            }
        }

        return has_transformed;
    };

    var transformExpressionList = function(list, opts) {
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
    };

    var optsForProduction = function(id, grammar) {
        return {
            production: id,
            repid: 0,
            groupid: 0,
            optid: 0,
            grammar: grammar
        };
    };

    var transformProduction = function(id, production, grammar) {
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
            var expressions = parser.parse(handle);

            if (devDebug > 1) console.log("\n================\nEBNF transform expressions:\n ", handle, opts, JSON.stringify(expressions, null, 2));

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
                    if (devDebug > 2) console.log("alist ~ rhs rule terms: ", alist, rhs);

                    var alias_re = /\[[a-zA-Z_][a-zA-Z0-9_]*\]/;
                    var term_re = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
                    // and collect the PERMITTED aliases: the names of the terms and all the remaining aliases
                    var good_aliases = {};
                    var alias_cnt = {};

                    // WARNING: this replicates the knowledge/code of jison.js::addName()
                    var addName = function (s, i) {
                        if (good_aliases[s]) {
                            good_aliases[s + (++alias_cnt[s])] = i + 1;
                        } else {
                            good_aliases[s] = i + 1;
                            good_aliases[s + '1'] = i + 1;
                            alias_cnt[s] = 1;
                        }
                    };

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
                    if (devDebug > 2) console.log("good_aliases: ", good_aliases);

                    // now scan the action for all named and numeric semantic values ($nonterminal / $1)
                    var named_spots = action.match(/[$@][a-zA-Z_][a-zA-Z0-9_]*\b/g);
                    var numbered_spots = action.match(/[$@][0-9]+\b/g);
                    var max_term_index = list.terms.length;
                    if (devDebug > 2) console.log("ACTION named_spots: ", named_spots);
                    if (devDebug > 2) console.log("ACTION numbered_spots: ", numbered_spots);

                    if (named_spots) {
                        for (i = 0, len = named_spots.length; i < len; i++) {
                            n = named_spots[i].substr(1);
                            if (!good_aliases[n]) {
                                throw new Error("The action block references the named alias '" + n + "' " +
                                                "which is not available in production '" + handle + "'; " +
                                                "it probably got removed by the EBNF rule rewrite process.\n" +
                                                "Be reminded that you cannot reference sub-elements within EBNF */+/? groups, " +
                                                "only the outer-most EBNF group alias will remain available at all times " +
                                                "due to the EBNF-to-BNF rewrite process.");
                            }
                            //assert(good_aliases[n] <= max_term_index, "max term index");
                        }
                    }
                    if (numbered_spots) {
                        for (i = 0, len = numbered_spots.length; i < len; i++) {
                            n = parseInt(numbered_spots[i].substr(1));
                            if (n > max_term_index) {
                                /* @const */ var n_suffixes = [ "st", "nd", "rd", "th" ];
                                throw new Error("The action block references the " + n + n_suffixes[Math.max(0, Math.min(3, n - 1))] + " term, " +
                                                "which is not available in production '" + handle + "'; " +
                                                "Be reminded that you cannot reference sub-elements within EBNF */+/? groups, " +
                                                "only the outer-most EBNF group alias will remain available at all times " +
                                                "due to the EBNF-to-BNF rewrite process.");
                            }
                        }
                    }
                }
                ret.push(action);
            }
            if (opts) {
                ret.push(opts);
            }
            if (devDebug > 1) console.log("\n\nEBNF tx result:\n ", JSON.stringify(list, null, 2), JSON.stringify(ret, null, 2));

            if (ret.length === 1) {
                return ret[0];
            } else {
                return ret;
            }
        });
    };

    var transformGrammar = function(grammar) {
        Object.keys(grammar).forEach(function(id) {
            grammar[id] = transformProduction(id, grammar[id], grammar);
        });
    };

    return {
        transform: function (ebnf) {
            if (devDebug > 0) console.log("EBNF:\n ", JSON.stringify(ebnf, null, 2));
            transformGrammar(ebnf);
            if (devDebug > 0) console.log("\n\nEBNF after transformation:\n ", JSON.stringify(ebnf, null, 2));
            return ebnf;
        }
    };
})();

exports.transform = EBNF.transform;

