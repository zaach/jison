var JISON = require('../jison');
    IO = require('./util/io');

exports.main = function (argv) {
    var args = argv.slice(1);
    IO.p(argv);

    if (args.length) {
        var raw = IO.read(IO.join(IO.cwd(),args[0])),
            name = IO.basename(args[0]).replace(/\..*$/g,''),
            lex;
        if (args[1]) {
            lex = IO.read(IO.join(IO.cwd(),args[1]));
        }
        IO.write(name+'.js', processGrammar(raw, lex, name));
    } else {
        var read = false;
        IO.stdin(function (raw) {
            read = true;
            IO.stdout(processGrammar(raw));
        });
        setTimeout(function (){if(!read)IO.exit()}, 100);
    }
}

function processGrammar (rawGrammar, lex, name) {
    var grammar = require("./bnf").parse(rawGrammar);
    var opt = grammar.options || {};
    if (lex) grammar.lex = require("./jisonlex").parse(lex);
    if (!opt.moduleType) opt.moduleType = "commonjs";
    if (!opt.moduleName && name) opt.moduleName = name;

    var generator = new JISON.Generator(grammar, opt);
    return generator.generate(opt);
}

if (typeof process !== 'undefined' || require.main === module)
    exports.main(IO.args);
