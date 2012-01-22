var EBNF = (function(){
    var grammar = {
        "lex": {
            "rules": [
                ["\\s+", "/* skip whitespace */"],
                ["[A-Za-z_]+", "return 'symbol';"],
                ["'[^']*'", "return 'symbol';"],
                ["\\\\.", "return 'symbol';"],
                ["bar", "return 'bar';"],
                ["\\(", "return '(';"],
                ["\\)", "return ')';"],
                ["\\*", "return '*';"],
                ["\\+", "return '+';"],
                ["\\?", "return '?';"],
                ["\\|", "return '|';"],
                ["$", "return 'EOF';"]
            ]
        },
        "start": "production",
        "bnf": {
            "production": [
                ["handle EOF", "return $handle;"],
            ],
            "handle_list": [
                ["handle", "$$ = [$handle];"],
                ["handle_list | handle", "$handle_list.push($handle);"]
            ],
            "handle": [
                ["", "$$ = [];"],
                ["handle expression_suffix", "$handle.push($expression_suffix);"]
            ],
            "expression_suffix": [
                ["expression suffix", "if ($suffix) $$ = [$suffix, $expression]; else $$ = $expression;"]
            ],
            "expression": [
                ["symbol", "$$ = ['symbol', $symbol];"],
                ["( handle_list )", "$$ = ['()', $handle_list];"]
            ],
            "suffix": ["", "*", "?", "+"]
        }
    };

    var parser = new require('jison').Parser(grammar);

    var transformExpression = function(e, opts, emit) {
        var type = e[0], value = e[1];

        if (type === 'symbol') {
            if (e[1][0] === '\\') emit (e[1][1])
            else if (e[1][0] === '\'') emit (e[1].substring(1, e[1].length-1))
            else emit (e[1])
        } else if (type === "+") {
            var name = opts.production + "_repetition_plus" + opts.repid++;
            emit(name)

            opts = optsForProduction(name, opts.grammar)
            var list = transformExpressionList([value], opts);
            var production = opts.grammar[name] = [
                [list, "$$ = [$1];"],
                [
                    name + " " + list,
                    "$1.push($2);"
                ]
            ];
        } else if (type === "*") {
            var name = opts.production + "_repetition" + opts.repid++;
            emit(name)

            opts = optsForProduction(name, opts.grammar)
            var production = opts.grammar[name] = [
                ["", "$$ = [];"],
                [
                    name + " " + transformExpressionList([value], opts),
                    "$1.push($2);"
                ]
            ];
        } else if (type ==="?") {
            var name = opts.production + "_option" + opts.optid++;
            emit(name)

            opts = optsForProduction(name, opts.grammar);
            var production = opts.grammar[name] = [
                "", transformExpressionList([value], opts)
            ];
        } else if (type === "()") {
            if (value.length == 1) {
                emit(transformExpressionList(value[0], opts))
            } else {
                var name = opts.production + "_group" + opts.groupid++;
                emit(name)

                opts = optsForProduction(name, opts.grammar)
                var production = opts.grammar[name] = value.map(function(handle) {
                    return transformExpressionList(handle, opts)
                })
            }
        }
    };

    var transformExpressionList = function(list, opts) {
        return list.reduce (function (tot, e) {
            transformExpression (e, opts, function (i) { tot.push(i) })
            return tot;
        }, []).
        join(" ")
    }

    var optsForProduction = function(id, grammar) {
        return {
            production: id,
            repid: 0,
            groupid: 0,
            optid: 0,
            grammar: grammar
        }
    }

    var transformProduction = function(id, production, grammar) {
        var transform_opts = optsForProduction(id, grammar)
        return production.map(function (handle) {
            var action = null, opts = null
            if (!(typeof(handle) === 'string'))
                action = handle[1],
                opts = handle[2],
                handle = handle[0];
            var expressions = parser.parse(handle)

            handle = transformExpressionList(expressions, transform_opts)

            var ret = [handle]
            if (action) ret.push(action)
            if (opts) ret.push(opts)
            if (ret.length == 1) return ret[0]
            else return ret
        })
    }

    var transformGrammar = function(grammar) {
        Object.keys(grammar).forEach(function(id) {
            grammar[id] = transformProduction(id, grammar[id], grammar)
        })
    }

    return {
        transform: function (ebnf) {
            transformGrammar(ebnf);
            return ebnf;
        },
    }
})();

exports.transform = EBNF.transform;

