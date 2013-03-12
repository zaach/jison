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

    var fileName = process.argv[2].replace('.jison', '');
    var requirePath = path.resolve(process.argv[2]).replace('.jison', '') + '.js';

    console.log("Opening newly created jison js file: " + fileName + '.js');
    var Parser = require(requirePath);

    var symbols = Parser.parser.symbols_;
    var terminals = Parser.parser.terminals_;
    var productions = Parser.parser.productions_;

    var table = Parser.parser.table;
    var defaultActions = Parser.parser.defaultActions;

    //turn regex into string
    var rules = [];
    for (var i = 0; i < Parser.parser.lexer.rules.length; i++) {
        rules.push(Parser.parser.lexer.rules[i].toString());
    }

    var conditions = Parser.parser.lexer.conditions;
    var options = Parser.parser.lexer.options;
    var parserPerformAction = Parser.parser.performAction.toString();
    var lexerPerformAction = Parser.parser.lexer.performAction.toString();

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
				//console.log(arguments);
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
            parserActionsInjection = [],
            rulesInjection = [],
            conditionsInjection = [],
            tableInjection = [];

        for (var symbol in symbols) {
            var _symbol = symbol.replace('$', '');

            symbolsInjection.push('var ' + _symbol + ' = new ParserSymbol("' + _symbol + '", ' + symbols[symbol] + ')');
            symbolsInjection.push('ParserActions.Add(' + symbols[symbol] + ', ' + _symbol + ')');

            parserActionsInjection.push('{' + _symbol + '.Index, ' + _symbol + '}');
        }

        result += symbolsInjection.join(';\n') + ';\n\n';
        result += 'ParserActions = new Dictionary<int, ParserSymbol>() {' + parserActionsInjection.join(',\n') + '};\n\n';

        for (var rule in rules) {
            rulesInjection.push('{' + rule + ', new Regex("' + rules[rule].substring(1, rules[rule].length - 1).replace('\/', '\\/') + '")}');
        }

        result += 'Rules = new Dictionary<int, Regex>() {' + rulesInjection.join(',\n') + '};\n\n';

        for (var condition in conditions) {
            conditionsInjection.push('Conditions.Add("' + condition  + '", new ParserConditions(new List<int> { ' + conditions[condition].rules.join(',') + ' }, ' + conditions[condition].inclusive + '));\n');
        }

        result += conditionsInjection.join(';');

        for (var items in table) {
            var itemsInjection = [];
            console.log(table[items]);
            for (var item in table[items]) {
                if (table[items] && table[items][item]) {
                    itemsInjection.push('{' + item + ', new ParserAction(' + (table[items][item].join ? table[items][item].join(', ') : table[items][item]) + ')}');
                }
            }
            tableInjection.push('Table.Add(new Dictionary<int, ParserAction>() {' + itemsInjection.join(',\n') + '});');
        }

        result += tableInjection.join('\n\n');

        return result;
    }

    parserRaw = parserRaw
        .replace('class Parser', 'class ' + phpOption.parserClass)
        .replace('new Parser', 'new ' + phpOption.parserClass)
        .replace('class Lexer', 'class ' + phpOption.lexerClass)
        .replace('new Lexer', 'new ' + phpOption.lexerClass)

        .replace('//@@INJECT@@',
            Inject()
        )
		
		.replace('//@@ParserPerformActionInjection@@',
			jsPerformActionToCs(parserPerformAction)
		)
		
		.replace('//@@LexerPerformActionInjection@@',
			jsPerformActionToCs(lexerPerformAction, true)
		);/*

        .replace('"<@@SYMBOLS@@>"', "json_decode('" + (symbols) + "', true)")
        .replace('"<@@TERMINALS@@>"', "json_decode('" + (terminals) + "', true)")
        .replace('"<@@PRODUCTIONS@@>"', "json_decode('" + (productions) + "', true)")

        .replace('"<@@TABLE@@>"', "json_decode('" + (table) + "', true)")
        .replace('"<@@DEFAULT_ACTIONS@@>"', "json_decode('" + (defaultActions) + "', true)")

        .replace('"<@@RULES@@>"', 'array(' + rules + ')')
        .replace('"<@@CONDITIONS@@>"', "json_decode('" + JSON.stringify(conditions) + "', true)")

        .replace('"<@@OPTIONS@@>"', "json_decode('" + (options) + "', true)")

        .replace('"<@@PARSER_PERFORM_ACTION@@>";', jsPerformActionToCs(parserPerformAction))
        .replace('"<@@LEXER_PERFORM_ACTION@@>";', jsPerformActionToCs(lexerPerformAction));*/

    fs.writeFile(phpOption.fileName, parserRaw, function (err) {
        if (err) {
            console.log("Something went bad");
        } else {
            console.log("Success writing new parser files " + fileName + ".js" + " & " + phpOption.fileName);
            console.log("Please Note: The csharp version of the jison parser is only an ATTEMPTED conversion");
        }
    });
});