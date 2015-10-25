var EBNF = (function(){
    var parser = require('./transform-parser.js');

var debug = 0;

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
            name = false;

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
            if (debug > 2) console.log('xalias: ', e, type, value, name);
        }

        if (type === 'symbol') {
            var n;
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
            if (debug > 1) console.log('symbol EMIT: ', n + (name ? '[' + name + ']' : ''));
            emit(n + (name ? '[' + name + ']' : ''));
        } else if (type === '+') {
            if (!name) {
                name = opts.production + '_repetition_plus' + opts.repid++;
            }
            if (debug > 1) console.log('+ EMIT name: ', name);
            emit(name);

            opts = optsForProduction(name, opts.grammar);
            var list = transformExpressionList([value], opts);
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
            if (debug > 1) console.log('* EMIT name: ', name);
            emit(name);

            opts = optsForProduction(name, opts.grammar);
            var list = transformExpressionList([value], opts);
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
            if (debug > 1) console.log('? EMIT name: ', name);
            emit(name);

            opts = optsForProduction(name, opts.grammar);
            var list = transformExpressionList([value], opts);
            // you want to be able to check if 0 or 1 occurrences were recognized: since jison
            // by default *copies* the lexer token value, i.e. `$$ = $1` is the default action,
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
            if (value.length === 1) {
                var list = transformExpressionList(value[0], opts);
                if (debug > 1) console.log('group EMIT len=1: ', list);
                emit(list);
            } else {
                if (!name) {
                    name = opts.production + '_group' + opts.groupid++;
                }
                if (debug > 1) console.log('group EMIT name: ', name);
                emit(name);

                opts = optsForProduction(name, opts.grammar);
                opts.grammar[name] = value.map(function(handle) {
                    var list = transformExpressionList(handle, opts);
                    return list.fragment;
                });
            }
        }
    };

    var transformExpressionList = function(list, opts) {
        var terms = list.reduce(function (tot, e) {
            transformExpression(e, opts, function (name) {
                if (name.terms) {
                    tot.push.apply(tot, name.terms);
                } else {
                    tot.push(name);
                }
            });
            return tot;
        }, []);
        return {
            fragment: terms.join(' '),
            terms: terms
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
            if (typeof handle !== 'string') {
                action = handle[1];
                opts = handle[2];
                handle = handle[0];
            }
            var expressions = parser.parse(handle);

            if (debug) console.log("\n================\nEBNF transform expressions:\n ", handle, opts, JSON.stringify(expressions, null, 2));

            handle = transformExpressionList(expressions, transform_opts);

            var ret = [handle.fragment];
            if (action) {
                // TODO: make sure the action doesn't address any inner items.
                ret.push(action);
            }
            if (opts) {
                ret.push(opts);
            }
            if (debug) console.log("\n\nEBNF tx result:\n ", JSON.stringify(handle, null, 2), JSON.stringify(ret, null, 2));

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
            console.log("EBNF:\n ", JSON.stringify(ebnf, null, 2));
            transformGrammar(ebnf);
            console.log("\n\nEBNF after transformation:\n ", JSON.stringify(ebnf, null, 2));
            return ebnf;
        }
    };
})();

exports.transform = EBNF.transform;

