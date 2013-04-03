var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;
var path = require('path');

function puts(error, stdout, stderr) {
    util.puts(stdout);
}

console.log("Executing: " + "jison " + process.argv[2]);

exec("jison " + process.argv[2], function (error) {
    if (error) {
        console.log(error);
        return;
    }

    var fileName = process.argv[2].replace('.jison', ''),
        requirePath = path.resolve(process.argv[2]).replace('.jison', '') + '.js';

    console.log("Opening newly created jison js file: " + fileName + '.js');

    var Parser = require(requirePath),
        symbols = Parser.parser.symbols_,
        terminals = Parser.parser.terminals_,
        productions = Parser.parser.productions_,
        table = Parser.parser.table,
        defaultActions = Parser.parser.defaultActions,
        //turn regex into string
        rules = [];
    
    for (var i = 0; i < Parser.parser.lexer.rules.length; i++) {
        rules.push(Parser.parser.lexer.rules[i].toString());
    }

    var conditions = Parser.parser.lexer.conditions,
        options = Parser.parser.lexer.options,
        parserPerformAction = Parser.parser.performAction.toString(),
        lexerPerformAction = Parser.parser.lexer.performAction.toString();

    function jsFnBody(str) {
        str = str.split('{');
        str.shift();
        str = str.join('{');

        str = str.split('}');
        str.pop();
        str = str.join('}');

        return str;
    }

    function jsPerformActionToCs(str, isLex) {
        str = jsFnBody(str);
        str = str.replace("var $0 = $$.length - 1;", '');
        str = str.replace("var YYSTATE=YY_START", '');
        str = str.replace(new RegExp('[$]0', 'g'), 'SO');
        str = str.replace(new RegExp('[$][$]', 'g'), 'SS');
        str = str.replace(new RegExp('default[:][;]', 'g'), '');
        str = str.replace(new RegExp('this[.][$]', 'g'), 'thisS');
        str = str.replace(new RegExp('[.]yytext', 'g'), '.yytext');
        str = str.replace(new RegExp('[$]accept', 'g'), 'accept');
        str = str.replace(new RegExp('[$]end', 'g'), 'end');
        str = str.replace(new RegExp('console[.]log'), '');
        str = str.replace(new RegExp('[$]avoiding_name_collisions'), 'avoiding_name_collisions');
		if (isLex) {
			str = str.replace(/(return[ ]+)(['"])([a-zA-Z0-9]+)(['"][;])/g, function() {
				return arguments[1] + symbols[arguments[3]] + ';';
			});
		}

        str = str.split(/\n/g);

        var strNew = [];
        for (var i = 0; i < str.length; i++) {
            if (str[i].match('//cs ') || !str[i].match(/\/\/js|\/\/php/g)) {
                strNew.push(str[i].replace(/\/\/cs /g, ''));
            }
        }

        str = strNew;

        str = str.join('\n');

        str = str.replace(/(\d)\n/g, function () {
            return arguments[1] + ';\n';
        });

        return str;
    }

    var phpOption = {
        parserClass: 'Parser',
        lexerClass: 'Lexer',
        fileName: fileName + '.cs'
    };

    var parserDefinition = fs.readFileSync(fileName + '.jison', "utf8");
    parserDefinition = parserDefinition.split(/\n/g);
    for (var i = 0; i < parserDefinition.length; i++) {
        if (parserDefinition[i].match('//csOption ')) {
            parserDefinition[i] = parserDefinition[i].replace('//csOption ', '');
            parserDefinition[i] = parserDefinition[i].split(':');
            phpOption[parserDefinition[i][0]] = parserDefinition[i][1];
        }
    }

    console.log(phpOption);

    var parserRaw = fs.readFileSync(__dirname + "/template.cs", "utf8");

    function Inject() {
        var result = '',
            symbolsInjection = [],
            symbolsByIndex = [],
            rulesInjection = [],
            conditionsInjection = [],
            tableInjection = [],
            terminalInjections = [];

        for (var i in symbols) {
            symbolsByIndex[symbols[i] * 1] = {
                name: i.replace('$', ''),
                index: symbols[i]
            };
        }

        for (var i in symbolsByIndex) {
            var symbol = symbolsByIndex[i];
            symbolsInjection.push('\t\t\tvar symbol' + symbol.index + ' = new ParserSymbol("' + symbol.name + '", ' + symbol.index + ')');
            symbolsInjection.push('\t\t\tSymbols.Push(symbol' + symbol.index + ')');
            
        }

        result += symbolsInjection.join(';\n') + ';\n\n';

        for (var i in rules) {
            rulesInjection.push('\t\t\t\t{' + i + ', new Regex("' + rules[i].substring(1, rules[i].length - 1).replace('\/', '\\/') + '")}');
        }

        result += '\t\t\tRules = new Dictionary<int, Regex>() {\n' + rulesInjection.join(',\n') + '};\n\n';

        for (var i in conditions) {
            conditionsInjection.push('\t\t\tConditions.Add("' + i + '", new ParserConditions(new List<int> { ' + conditions[i].rules.join(',') + ' }, ' + conditions[i].inclusive + '))');
        }

        result += conditionsInjection.join(';\n') + ';\n\n';

        for (var i in terminals) {
            terminalInjections.push('\t\t\t\t{' + i + ',symbol' + i + '}');
        }

        result += '\t\t\tTerminals = new Dictionary<int, ParserSymbol>(){\n' + terminalInjections.join(',\n') + '};\n\n';
        
        for (var i in table) {
            var itemsInjection = [];
            for (var j in table[i]) {
                var item = table[i][j],
                    action = -1,
                    state = -1;
                if (item.join) { //is array
                    if (item.length == 1) {
                        state = item[0];
                        itemsInjection.push('\t\t\t\t{' + j + ', new ParserAction(' + state + ')}');
                    } else {
                        action = item[0];
                        state = item[1];
                        itemsInjection.push('\t\t\t\t{' + j + ', new ParserAction(' + action + ',' + state + ')}');
                    }
                } else {
                    state = item;
                    itemsInjection.push('\t\t\t\t{' + j + ', new ParserAction(' + action + ',' + state + ')}');
                }
            }
            tableInjection.push('\t\t\tTable.Push(new Dictionary<int, ParserAction>() {\n' + itemsInjection.join(',\n') + '});');
        }

        result += tableInjection.join('\n\n') + '\n\n';

        for (var i in defaultActions) {
            result += '\t\t\tDefaultActions.Add(' + i + ', new ParserAction(' + defaultActions[i].join(',') + '));\n';
        }

        result += '\n\n';
        
        for (var i in productions) {
            var production = productions[i];
            if (production.join) {
                var symbol = production[0],
                    len = production[1];
                result += '\t\t\tProductions.Push(new ParserProduction(symbol' + symbolsByIndex[symbol].index + ',' + len + '));\n';
            } else {
                var symbol = production;
                result += '\t\t\tProductions.Push(new ParserProduction(symbol' + symbolsByIndex[symbol].index + '));\n';
            }
        }

        return result;
    }

    parserRaw = parserRaw
        .replace('class Parser', 'class ' + phpOption.parserClass)
        .replace('new Parser(', 'new ' + phpOption.parserClass + '(')

        .replace('//@@INJECT@@',
            Inject()
        )
		
		.replace('//@@ParserPerformActionInjection@@',
			jsPerformActionToCs(parserPerformAction)
		)
		
		.replace('//@@LexerPerformActionInjection@@',
			jsPerformActionToCs(lexerPerformAction, true)
		);

    fs.writeFile(phpOption.fileName, parserRaw, function (err) {
        if (err) {
            console.log("Something went bad");
        } else {
            console.log("Success writing new parser files " + fileName + ".js" + " & " + phpOption.fileName);
            console.log("Please Note: The csharp version of the jison parser is only an ATTEMPTED conversion");
        }
    });
});